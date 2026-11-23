import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, Play, Copy, Check, QrCode, Trash2, RefreshCw, ExternalLink, Clock, KeyRound, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { HostConfig, ActiveShare, PipelineStep, LocalNetworkInfo } from '@/types/share';
import { generateSecureSharePassword, resolveActiveShareUncPath, validateAccountUsername, validateShareName, validateFolderPath } from '@/utils/connectionCode';
import { buildHostGuestUnlockBatchScript } from '@/services/powershellEngine';
import { PipelineTracker } from './PipelineTracker';
import { PresetPasswordGrid } from './PresetPasswordGrid';

interface HostPanelProps {
  netInfo: LocalNetworkInfo;
  shares: ActiveShare[];
  steps: PipelineStep[];
  isExecuting: boolean;
  isRefreshing?: boolean;
  nowMs?: number;
  initialConfig?: HostConfig;
  pendingHostPreset?: { key: string; config: Partial<HostConfig> } | null;
  onClearPendingHostPreset?: () => void;
  onConfigChange?: (config: HostConfig) => void;
  onSelectFolder: (currentPath: string) => Promise<string | null>;
  onCreateShare: (config: HostConfig) => Promise<void>;
  onRemoveShare: (shareName: string) => Promise<void>;
  onOpenFolder: (path: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

const TTL_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '무제한', minutes: 0 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '3시간', minutes: 180 },
];

function formatRemainingTime(expiresAt: string | undefined, nowMs: number): { text: string; expired: boolean; soon: boolean } {
  if (!expiresAt) {
    return { text: '상시 공유 (무제한)', expired: false, soon: false };
  }
  const targetMs = Date.parse(expiresAt);
  if (Number.isNaN(targetMs)) {
    return { text: '상시 공유', expired: false, soon: false };
  }
  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  if (diffSec <= 0) {
    return { text: '만료됨 · 해제 대기', expired: true, soon: true };
  }
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatted = hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  return {
    text: `남은 시간 ${formatted}`,
    expired: false,
    soon: diffSec <= 300,
  };
}

export const HostPanel: React.FC<HostPanelProps> = ({
  netInfo,
  shares,
  steps,
  isExecuting,
  isRefreshing = false,
  nowMs = Date.now(),
  initialConfig,
  pendingHostPreset = null,
  onClearPendingHostPreset,
  onConfigChange,
  onSelectFolder,
  onCreateShare,
  onRemoveShare,
  onOpenFolder,
  onRefresh,
}) => {
  const [config, setConfig] = useState<HostConfig>(() =>
    initialConfig || {
      folderPath: 'C:\\AhBiShared',
      shareName: 'AhBiShared',
      authMode: 'guest',
      permission: 'full',
      username: 'AhBiShare',
      password: generateSecureSharePassword(10),
      ttlMinutes: 0,
      autoRevokeOnExpiry: true,
    }
  );

  const [shareNameCustomized, setShareNameCustomized] = useState(
    Boolean(initialConfig?.shareName && initialConfig.shareName !== 'AhBiShared')
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<ActiveShare | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const lastAppliedPresetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  useEffect(() => {
    if (!pendingHostPreset || pendingHostPreset.key === lastAppliedPresetKeyRef.current) return;
    lastAppliedPresetKeyRef.current = pendingHostPreset.key;
    setValidationError(null);
    setConfig((prev) => ({
      ...prev,
      ...pendingHostPreset.config,
      password:
        pendingHostPreset.config.authMode === 'account'
          ? pendingHostPreset.config.password || generateSecureSharePassword(10)
          : prev.password,
    }));
    setShareNameCustomized(
      Boolean(pendingHostPreset.config.shareName && pendingHostPreset.config.shareName !== 'AhBiShared')
    );
    onClearPendingHostPreset?.();
  }, [pendingHostPreset, onClearPendingHostPreset]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleBrowseFolder = async () => {
    const picked = await onSelectFolder(config.folderPath);
    if (picked) {
      const folderLeaf = picked.split(/[\\/]/).filter(Boolean).pop() || 'AhBiShared';
      const sanitizedLeaf = folderLeaf.replace(/[\\/:*?"<>|]/g, '_') || 'AhBiShared';
      setValidationError(null);
      setConfig((prev) => ({
        ...prev,
        folderPath: picked,
        shareName: !shareNameCustomized ? sanitizedLeaf : prev.shareName,
      }));
    }
  };

  const [copyWarning, setCopyWarning] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    setCopyWarning(null);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {}
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    if (copied) {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedCode(id);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedCode(null);
        copyTimerRef.current = null;
      }, 1800);
    } else {
      setCopyWarning('브라우저 클립보드 권한이 제한되어 있습니다. 위 연결 코드를 드래그해 직접 복사하세요.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExecuting || isRefreshing) return;
    const folderErr = validateFolderPath(config.folderPath);
    if (folderErr) {
      setValidationError(folderErr);
      return;
    }
    const shareErr = validateShareName(config.shareName);
    if (shareErr) {
      setValidationError(shareErr);
      return;
    }
    if (config.authMode === 'account') {
      const userErr = validateAccountUsername(config.username);
      if (userErr) {
        setValidationError(userErr);
        return;
      }
      if (!config.password || config.password.length < 4) {
        setValidationError('보안 계정 접속 암호는 최소 4자 이상 입력하세요.');
        return;
      }
    }
    setValidationError(null);
    void onCreateShare(config);
  };

  const latestShare = shares[0] || null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                메인 PC 공유폴더 원클릭 개설
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                방화벽 포트 445, 네트워크 검색 서비스, NTFS·SMB 권한 설정과 클라이언트용 연결 코드를 한 번에 구성합니다.
              </p>
              <p className="tabular-data text-xs text-slate-500 dark:text-slate-400 pt-1">
                현재 호스트: {netInfo.hostname} · LAN IP: {netInfo.primaryIp} · {netInfo.adapterName}
              </p>
            </div>
            {onRefresh && (
              <button
                id="btn-refresh-host"
                type="button"
                disabled={isRefreshing || isExecuting}
                onClick={() => void onRefresh()}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                {isRefreshing ? '새로고침 중...' : '새로고침'}
              </button>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label htmlFor="host-folder-path" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                공유할 로컬 폴더 경로
              </label>
              <div className="flex gap-2">
                <input
                  id="host-folder-path"
                  type="text"
                  value={config.folderPath}
                  onChange={(e) => setConfig({ ...config, folderPath: e.target.value })}
                  placeholder="C:\AhBiShared"
                  className="flex-1 min-w-0 px-3.5 py-2.5 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  폴더 선택
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="host-share-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  네트워크 공유 이름
                </label>
                <input
                  id="host-share-name"
                  type="text"
                  value={config.shareName}
                  onChange={(e) => {
                    setShareNameCustomized(Boolean(e.target.value.trim()));
                    setValidationError(null);
                    setConfig({ ...config, shareName: e.target.value });
                  }}
                  placeholder="AhBiShared"
                  className="w-full px-3.5 py-2.5 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  폴더 접근 권한
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, permission: 'full' })}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.permission === 'full'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    전체 권한 (쓰기)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, permission: 'read' })}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.permission === 'read'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    읽기 전용
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                SMB 공유 인증 방식
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    setConfig({ ...config, authMode: 'guest' });
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                    config.authMode === 'guest'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  간편 무비밀번호 (Guest / Everyone)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    setConfig({ ...config, authMode: 'account' });
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                    config.authMode === 'account'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  보안 계정 (전용 ID · PW + cmdkey)
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {config.authMode === 'guest'
                  ? '가정·사설 LAN에서 암호 입력 없이 모든 PC가 즉시 접근할 수 있도록 익명/게스트 정책을 자동 개방합니다.'
                  : '호스트에 전용 로컬 계정을 구성하고, 클라이언트 연결 코드에 자격 증명을 포함해 팝업 없이 안전하게 연결합니다.'}
              </p>
              {config.authMode === 'guest' && (
                <div className="mt-2.5 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      무비밀번호 개방 정책 (오류 86·1223 사전 방지)
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      개설 실행 시 LimitBlankPasswordUse=0, forceguest=1 및 Guest 계정이 자동 정렬됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const batContent = buildHostGuestUnlockBatchScript(config.shareName).replace(/\r?\n/g, '\r\n');
                      const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'AhBiShare_Host_Unblock.bat';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    .bat 복구 파일 저장
                  </button>
                </div>
              )}
            </div>

            {config.authMode === 'account' && (
              <div className="space-y-3 pt-2">
                <PresetPasswordGrid
                  currentUsername={config.username}
                  currentPassword={config.password}
                  onSelectPreset={(username, password) => {
                    setValidationError(null);
                    setConfig((prev) => ({
                      ...prev,
                      username,
                      password,
                    }));
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label htmlFor="host-acc-user" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    전용 계정 ID
                  </label>
                  <input
                    id="host-acc-user"
                    type="text"
                    value={config.username}
                    onChange={(e) => {
                      setValidationError(null);
                      setConfig({ ...config, username: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="host-acc-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    접속 암호
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="host-acc-pass"
                      type="text"
                      value={config.password}
                      onChange={(e) => {
                        setValidationError(null);
                        setConfig({ ...config, password: e.target.value });
                      }}
                      className="flex-1 min-w-0 px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setValidationError(null);
                        setConfig({ ...config, password: generateSecureSharePassword(10) });
                      }}
                      title="새 암호 생성"
                      aria-label="새 암호 생성"
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  공유 자동 만료 타이머 (임시 공유 보안)
                </span>
                {(config.ttlMinutes || 0) > 0 && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      id="host-ttl-autorevoke"
                      type="checkbox"
                      checked={Boolean(config.autoRevokeOnExpiry)}
                      onChange={(e) => setConfig({ ...config, autoRevokeOnExpiry: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    만료 시 공유폴더 자동 해제
                  </label>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                {TTL_PRESETS.map((preset) => {
                  const active = (config.ttlMinutes || 0) === preset.minutes;
                  return (
                    <button
                      key={preset.minutes}
                      id={`btn-ttl-${preset.minutes}`}
                      type="button"
                      onClick={() => setConfig({ ...config, ttlMinutes: preset.minutes })}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {(config.ttlMinutes || 0) > 0
                  ? `${config.ttlMinutes}분 후 만료 알림이 표시되며${config.autoRevokeOnExpiry ? ' 공유폴더가 자동 해제됩니다.' : ' 1클릭 보안 원복 배너가 표시됩니다.'}`
                  : '만료 시간 없이 사용자가 직접 공유를 해제할 때까지 유지됩니다.'}
              </p>
            </div>
          </div>

          {validationError && (
            <div role="alert" className="px-4 py-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-xs font-medium text-red-700 dark:text-red-300">
              {validationError}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <span className="tabular-data text-xs text-slate-500 dark:text-slate-400 truncate">
              UNC 경로: \\{netInfo.primaryIp}\{config.shareName.trim() || 'AhBiShared'}
            </span>
            <button
              id="btn-host-oneclick"
              type="submit"
              disabled={isExecuting || isRefreshing}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Play className="w-4 h-4" />
              {isExecuting ? '공유 환경 구성 중...' : '원클릭 공유폴더 개설'}
            </button>
          </div>
        </form>

        <div className="lg:col-span-5 space-y-6">
          {latestShare && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    클라이언트 전달용 연결 코드
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    다른 PC의 클라이언트 화면에 이 코드를 붙여넣으면 한 번의 클릭으로 연결됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrTarget(qrTarget?.shareName === latestShare.shareName ? null : latestShare)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR 보기
                </button>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-24 overflow-y-auto">
                <p className="tabular-data text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                  {latestShare.connectionCode}
                </p>
              </div>

              {qrTarget && qrTarget.shareName === latestShare.shareName && (
                <div className="flex flex-col items-center py-3 bg-white rounded-lg border border-slate-200">
                  <QRCodeSVG value={latestShare.connectionCode} size={148} />
                  <span className="mt-2 tabular-data text-xs text-slate-600">{latestShare.uncPath}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="tabular-data text-xs text-emerald-700 dark:text-emerald-400">
                  개설 완료 · {latestShare.authMode === 'guest' ? '무비밀번호' : `계정(${latestShare.username})`}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(latestShare.connectionCode, latestShare.shareName)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedCode === latestShare.shareName ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode === latestShare.shareName ? '복사됨' : '연결 코드 복사'}
                </button>
              </div>

              {copyWarning && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{copyWarning}</p>
              )}
            </div>
          )}

          <PipelineTracker
            title="호스트 6단계 자동 구성 파이프라인"
            steps={steps}
            isRunning={isExecuting}
          />
        </div>
      </div>

      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            활성 공유폴더 목록 ({shares.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            클라이언트 PC로 연결 코드를 복사해 공유를 시작하세요
          </span>
        </div>

        {shares.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              아직 개설된 공유폴더가 없습니다. 위 양식에서 폴더를 지정하고 원클릭 공유폴더 개설을 실행하세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">공유 이름</th>
                  <th className="py-3 px-4">로컬 경로 / UNC</th>
                  <th className="py-3 px-4">인증 및 권한</th>
                  <th className="py-3 px-4">생성 시각 / 만료 타이머</th>
                  <th className="py-3 px-6 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {shares.map((share) => {
                  const uncTarget = resolveActiveShareUncPath(share, netInfo.primaryIp);
                  const ttlState = formatRemainingTime(share.expiresAt, nowMs);
                  const statusBadge = ttlState.expired
                    ? {
                        label: '만료됨',
                        dotClass: 'bg-red-500',
                        badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
                        title: '공유 만료 시간이 지났습니다',
                      }
                    : ttlState.soon
                      ? {
                          label: '곧 만료',
                          dotClass: 'bg-amber-500 animate-pulse',
                          badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
                          title: '5분 이내에 공유가 만료됩니다',
                        }
                      : {
                          label: '활성',
                          dotClass: 'bg-emerald-500',
                          badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                          title: '정상적으로 공유가 활성화되어 있습니다',
                        };
                  return (
                  <tr key={share.shareName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-6 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span>{share.shareName}</span>
                        <span
                          title={statusBadge.title}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${statusBadge.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusBadge.dotClass}`} aria-hidden="true" />
                          <span>{statusBadge.label}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-data text-xs text-slate-600 dark:text-slate-300">
                      <div>{share.folderPath}</div>
                      <div className="text-slate-400">{share.uncPath}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {share.authMode === 'guest' ? '무비밀번호' : `보안(${share.username})`} · {share.permission === 'full' ? '전체 권한' : '읽기 전용'}
                    </td>
                    <td className="py-3 px-4 tabular-data text-xs whitespace-nowrap">
                      <div className="text-slate-500 dark:text-slate-400">{share.createdAt}</div>
                      <div
                        className={`font-semibold ${
                          ttlState.expired
                            ? 'text-red-600 dark:text-red-400'
                            : ttlState.soon
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {ttlState.text}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(share.connectionCode, `row-${share.shareName}`)}
                          className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-md cursor-pointer"
                        >
                          {copiedCode === `row-${share.shareName}` ? '복사 완료' : '코드 복사'}
                        </button>
                        <button
                          type="button"
                          disabled={!uncTarget}
                          onClick={() => {
                            if (uncTarget) void onOpenFolder(uncTarget);
                          }}
                          title={uncTarget ? `${uncTarget} UNC 경로를 Windows 탐색기에서 열기` : '유효한 UNC 경로가 없습니다'}
                          aria-label={`${share.shareName} 탐색기에서 열기`}
                          className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 rounded-md inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          탐색기에서 열기
                        </button>
                        <button
                          type="button"
                          onClick={() => void onOpenFolder(share.folderPath)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer"
                          title="로컬 폴더 열기"
                          aria-label={`${share.shareName} 로컬 폴더 열기`}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveShare(share.shareName)}
                          className="p-1.5 text-slate-500 hover:text-red-500 rounded-md cursor-pointer"
                          title="공유 해제"
                          aria-label={`${share.shareName} 공유 해제`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
