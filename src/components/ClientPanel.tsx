import React, { useState, useEffect, useCallback } from 'react';
import { Radar, Link2, ExternalLink, Unplug, Check, AlertCircle, Usb, X, ArrowLeftRight } from 'lucide-react';
import {
  ClientTargetConfig,
  DiscoveredPeer,
  HostPolicySnapshot,
  MountedDrive,
  OsNetworkPolicyStatus,
  PipelineStep,
  PortableHostShareEntry,
  PortableStorageStatus,
} from '@/types/share';
import { decodeConnectionCode, validateShareName, validateTargetHost } from '@/utils/connectionCode';
import {
  classifyFailureDiagnostics,
  computeHostClientPolicyDiff,
  findHostPolicySnapshot,
} from '@/services/networkEvolution';
import { PipelineTracker } from './PipelineTracker';

interface ClientPanelProps {
  peers: DiscoveredPeer[];
  mounts: MountedDrive[];
  steps: PipelineStep[];
  isScanning: boolean;
  isConnecting: boolean;
  portableShares?: PortableHostShareEntry[];
  portableStatus?: PortableStorageStatus;
  currentHostname?: string;
  hostPolicySnapshots?: Record<string, HostPolicySnapshot>;
  localPolicyStatus?: OsNetworkPolicyStatus | null;
  pendingAutoFillEntry?: PortableHostShareEntry | null;
  onClearPendingAutoFill?: () => void;
  onPortableAutoFill?: (entry: PortableHostShareEntry) => void;
  onOpenMatrix?: () => void;
  onScanLan: () => Promise<void>;
  onConnect: (config: ClientTargetConfig) => Promise<void>;
  onUnmount: (driveLetter: string) => Promise<void>;
  onOpenDrive: (drivePath: string) => Promise<void>;
  onTargetHostChange?: (host: string) => void;
}

const DRIVE_LETTERS = ['Z:', 'Y:', 'X:', 'W:', 'V:', 'S:', 'M:'];

export const ClientPanel: React.FC<ClientPanelProps> = ({
  peers,
  mounts,
  steps,
  isScanning,
  isConnecting,
  portableShares = [],
  portableStatus,
  currentHostname = '',
  hostPolicySnapshots = {},
  localPolicyStatus = null,
  pendingAutoFillEntry = null,
  onClearPendingAutoFill,
  onPortableAutoFill,
  onOpenMatrix,
  onScanLan,
  onConnect,
  onUnmount,
  onOpenDrive,
  onTargetHostChange,
}) => {
  const [rawCodeInput, setRawCodeInput] = useState('');
  const [codeParseState, setCodeParseState] = useState<'empty' | 'valid' | 'invalid'>('empty');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedPortableIdx, setSelectedPortableIdx] = useState(0);
  const [portableAppliedKey, setPortableAppliedKey] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const mountedSet = new Set(mounts.map((m) => m.driveLetter.toUpperCase()));

  const [config, setConfig] = useState<ClientTargetConfig>({
    targetHost: '192.168.0.10',
    shareName: 'WorkDocs',
    driveLetter: 'Z:',
    authMode: 'guest',
    username: '',
    password: '',
    persistent: true,
  });

  // Reset dismissal/index cleanly if portable share entries update
  useEffect(() => {
    if (portableShares.length > 0 && selectedPortableIdx >= portableShares.length) {
      setSelectedPortableIdx(0);
    }
    if (portableShares.length > 0) {
      setBannerDismissed(false);
    }
  }, [portableShares.length, selectedPortableIdx]);

  // Automatically pick an available drive letter if the currently selected letter becomes occupied
  useEffect(() => {
    const occupied = new Set(mounts.map((m) => m.driveLetter.toUpperCase()));
    setConfig((prev) => {
      if (!occupied.has(prev.driveLetter.toUpperCase())) return prev;
      const nextFree = DRIVE_LETTERS.find((dl) => !occupied.has(dl));
      if (!nextFree || nextFree === prev.driveLetter) return prev;
      return { ...prev, driveLetter: nextFree };
    });
  }, [mounts]);

  useEffect(() => {
    onTargetHostChange?.(config.targetHost);
  }, [config.targetHost, onTargetHostChange]);

  const applyPortableEntry = useCallback(
    (entry: PortableHostShareEntry, notify = true) => {
      setValidationError(null);
      const targetHost = entry.sourceIp || entry.sourceHostName;
      setConfig((prev) => ({
        ...prev,
        targetHost,
        shareName: entry.shareName,
        authMode: entry.authMode,
        username: entry.authMode === 'account' ? entry.username || '' : '',
        password: entry.authMode === 'account' ? entry.password || '' : '',
      }));
      if (entry.connectionCode) {
        setRawCodeInput(entry.connectionCode);
        setCodeParseState(decodeConnectionCode(entry.connectionCode) ? 'valid' : 'empty');
      } else {
        setRawCodeInput('');
        setCodeParseState('empty');
      }
      setPortableAppliedKey(`${entry.sourceHostName}::${entry.shareName}::${entry.updatedAt}`);
      if (notify) {
        onPortableAutoFill?.(entry);
      }
    },
    [onPortableAutoFill]
  );

  useEffect(() => {
    if (pendingAutoFillEntry) {
      const idx = portableShares.findIndex(
        (s) =>
          s.shareName === pendingAutoFillEntry.shareName &&
          s.sourceHostName === pendingAutoFillEntry.sourceHostName
      );
      if (idx >= 0) setSelectedPortableIdx(idx);
      setBannerDismissed(false);
      applyPortableEntry(pendingAutoFillEntry, false);
      onClearPendingAutoFill?.();
    }
  }, [pendingAutoFillEntry, portableShares, applyPortableEntry, onClearPendingAutoFill]);

  const handleCodeChange = (val: string) => {
    setRawCodeInput(val);
    setValidationError(null);
    if (!val.trim()) {
      setCodeParseState('empty');
      return;
    }
    const decoded = decodeConnectionCode(val);
    if (decoded) {
      setCodeParseState('valid');
      setConfig((prev) => ({
        ...prev,
        targetHost: decoded.ip || decoded.hostName,
        shareName: decoded.shareName,
        authMode: decoded.authMode,
        username: decoded.username || '',
        password: decoded.password || '',
      }));
    } else {
      setCodeParseState('invalid');
    }
  };

  const handleSelectPeerShare = (peer: DiscoveredPeer, shareName: string) => {
    setValidationError(null);
    const exactCode = peer.shareCodes?.[shareName];
    if (exactCode) {
      handleCodeChange(exactCode);
      return;
    }
    setRawCodeInput('');
    setCodeParseState('empty');
    setConfig((prev) => ({
      ...prev,
      targetHost: peer.ipAddress,
      shareName,
      authMode: peer.authModeHint === 'account' ? 'account' : 'guest',
      username: '',
      password: '',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hostErr = validateTargetHost(config.targetHost);
    if (hostErr) {
      setValidationError(hostErr);
      return;
    }
    const shareErr = validateShareName(config.shareName);
    if (shareErr) {
      setValidationError(shareErr);
      return;
    }
    if (config.authMode === 'account') {
      if (!config.username.trim()) {
        setValidationError('보안 계정 연결 모드에서는 사용자 ID를 입력하세요.');
        return;
      }
      if (!config.password) {
        setValidationError('보안 계정 연결 모드에서는 접속 암호를 입력하세요.');
        return;
      }
    }
    setValidationError(null);
    void onConnect(config);
  };

  const activePortableEntry =
    portableShares.length > 0
      ? portableShares[Math.min(selectedPortableIdx, portableShares.length - 1)]
      : null;
  const isRemotePortable =
    Boolean(activePortableEntry && currentHostname) &&
    (activePortableEntry?.sourceHostName || '').trim().toLowerCase() !== currentHostname.trim().toLowerCase();
  const currentEntryKey = activePortableEntry
    ? `${activePortableEntry.sourceHostName}::${activePortableEntry.shareName}::${activePortableEntry.updatedAt}`
    : null;
  const isPortableApplied = Boolean(currentEntryKey && portableAppliedKey === currentEntryKey);

  const matchedHostPolicy = findHostPolicySnapshot(
    hostPolicySnapshots,
    activePortableEntry?.sourceHostName
  );
  const portablePolicyConflicts = React.useMemo(() => {
    if (!matchedHostPolicy || !localPolicyStatus) return [];
    return computeHostClientPolicyDiff(matchedHostPolicy, localPolicyStatus).filter(
      (item) => item.status === 'conflict'
    );
  }, [matchedHostPolicy, localPolicyStatus]);

  return (
    <div className="space-y-8">
      {activePortableEntry && !bannerDismissed && (
        <section
          id="portable-usb-banner"
          aria-label="USB 포터블 공유 데이터 감지 알림"
          className="border border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <Usb className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {isRemotePortable
                    ? 'USB에서 메인 PC 공유 데이터가 감지되었습니다'
                    : 'USB 포터블 저장소의 공유 데이터가 감지되었습니다'}
                </h3>
                {portableStatus?.fileName && (
                  <span className="tabular-data text-xs text-slate-500 dark:text-slate-400">
                    · {portableStatus.fileName}
                  </span>
                )}
              </div>

              <p className="tabular-data text-xs text-slate-700 dark:text-slate-300 break-all">
                원본 PC: {activePortableEntry.sourceHostName || '-'} · {activePortableEntry.uncPath || `\\\\${activePortableEntry.sourceIp}\\${activePortableEntry.shareName}`} ·{' '}
                {activePortableEntry.authMode === 'account'
                  ? activePortableEntry.decryptionFailed
                    ? `보안 계정 (${activePortableEntry.username || '-'} · 암호 재입력 필요)`
                    : `보안 계정 (${activePortableEntry.username || '-'} · 암호화 비밀번호 자동 복원)`
                  : '간편 무비밀번호'}
              </p>

              {portableShares.length > 1 && (
                <div className="pt-1.5 flex flex-wrap items-center gap-2">
                  <label htmlFor="portable-share-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    저장된 공유 항목 ({portableShares.length}개):
                  </label>
                  <select
                    id="portable-share-select"
                    value={selectedPortableIdx}
                    onChange={(e) => {
                      setSelectedPortableIdx(Number(e.target.value));
                      setPortableAppliedKey(null);
                    }}
                    className="px-2.5 py-1 text-xs tabular-data bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {portableShares.map((entry, idx) => (
                      <option key={`${entry.sourceHostName}-${entry.shareName}-${idx}`} value={idx}>
                        {entry.sourceHostName || entry.sourceIp} · \\{entry.sourceIp}\{entry.shareName} ({entry.authMode === 'account' ? '보안 계정' : '무비밀번호'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isPortableApplied && (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  연결 정보가 아래 입력 폼에 자동 채워졌습니다. [원클릭 공유폴더 연결]을 실행하세요.
                </p>
              )}

              {portablePolicyConflicts.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    호스트와 OS/SMB/RPC 정책 불일치 {portablePolicyConflicts.length}건 감지 ({portablePolicyConflicts.map((c) => c.label).join(', ')})
                  </span>
                  {onOpenMatrix && (
                    <button
                      id="btn-portable-policy-diff"
                      type="button"
                      onClick={onOpenMatrix}
                      className="font-semibold underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-200 cursor-pointer"
                    >
                      매트릭스에서 맞추기
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              id="btn-portable-autofill"
              type="button"
              onClick={() => applyPortableEntry(activePortableEntry, true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {isPortableApplied ? '연결 정보 다시 채우기' : '원클릭 자동 채우기'}
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="USB 감지 배너 닫기"
              title="배너 닫기"
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  클라이언트 PC 원클릭 연결
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  메인 PC에서 복사한 연결 코드를 붙여넣거나 같은 네트워크의 PC를 자동 탐색해 즉시 연결합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onScanLan()}
                disabled={isScanning}
                className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Radar className={`w-4 h-4 ${isScanning ? 'animate-spin text-indigo-500' : ''}`} />
                {isScanning ? 'LAN 스캔 중...' : 'LAN PC 자동 탐색'}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <label htmlFor="client-conn-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                연결 코드 또는 UNC 경로 붙여넣기 (ABSHARE://... 또는 \\IP\공유명)
              </label>
              <input
                id="client-conn-code"
                type="text"
                value={rawCodeInput}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ABSHARE://... 코드를 붙여넣으면 서버 IP·공유명·계정 정보가 자동 입력됩니다"
                className="w-full px-3.5 py-2.5 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {codeParseState === 'valid' && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  연결 코드 확인 완료 · 대상: \\{config.targetHost}\{config.shareName} ({config.authMode === 'account' ? '보안 계정 포함' : '무비밀번호 모드'})
                </p>
              )}
              {codeParseState === 'invalid' && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  유효한 ABSHARE:// 코드 또는 \\서버\공유명 형식이 아닙니다. 아래에서 직접 입력할 수 있습니다.
                </p>
              )}
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  탐색된 로컬 네트워크 공유 PC ({peers.length})
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  공유 폴더를 클릭하면 연결 대상이 자동 선택됩니다
                </span>
              </div>

              {peers.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    감지된 SMB(445) 호스트가 없습니다. [LAN PC 자동 탐색]을 누르거나 아래에 IP를 직접 입력하세요.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">PC / IP 주소</th>
                        <th className="py-2.5 px-3">공유 폴더 선택</th>
                        <th className="py-2.5 px-3 text-right">응답 시간</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {peers.map((peer) => (
                        <tr key={peer.ipAddress} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 align-top">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{peer.hostName}</div>
                            <div className="tabular-data text-slate-500 dark:text-slate-400">{peer.ipAddress}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {peer.availableShares.length > 0 ? (
                                peer.availableShares.map((sh) => {
                                  const isSelected = config.targetHost === peer.ipAddress && config.shareName === sh;
                                  return (
                                    <button
                                      key={sh}
                                      type="button"
                                      onClick={() => handleSelectPeerShare(peer, sh)}
                                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-500'
                                      }`}
                                    >
                                      {sh}
                                    </button>
                                  );
                                })
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectPeerShare(peer, 'AhBiShared')}
                                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer"
                                >
                                  직접 지정 선택
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-data text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {peer.latencyMs}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="client-target-host" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  메인 PC IP 또는 이름
                </label>
                <input
                  id="client-target-host"
                  type="text"
                  value={config.targetHost}
                  onChange={(e) => {
                    setValidationError(null);
                    setConfig({ ...config, targetHost: e.target.value });
                  }}
                  className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="client-share-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  공유 폴더 이름
                </label>
                <input
                  id="client-share-name"
                  type="text"
                  value={config.shareName}
                  onChange={(e) => {
                    setValidationError(null);
                    setConfig({ ...config, shareName: e.target.value });
                  }}
                  className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="client-drive-letter" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  연결 드라이브 문자
                </label>
                <select
                  id="client-drive-letter"
                  value={config.driveLetter}
                  onChange={(e) => setConfig({ ...config, driveLetter: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DRIVE_LETTERS.map((dl) => (
                    <option key={dl} value={dl}>
                      {dl} 드라이브{mountedSet.has(dl) ? ' (연결됨)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
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
                  무비밀번호 (Win11 0x80070035 자동 해제)
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
                  보안 계정 (cmdkey 자동 등록)
                </button>
              </div>

              {config.authMode === 'account' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    id="client-acc-user"
                    type="text"
                    value={config.username}
                    onChange={(e) => {
                      setValidationError(null);
                      setConfig({ ...config, username: e.target.value });
                    }}
                    placeholder="사용자 ID (예: AhBiShare)"
                    className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    id="client-acc-pass"
                    type="password"
                    value={config.password}
                    onChange={(e) => {
                      setValidationError(null);
                      setConfig({ ...config, password: e.target.value });
                    }}
                    placeholder="공유 계정 암호"
                    className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {validationError && (
              <div role="alert" className="px-4 py-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-xs font-medium text-red-700 dark:text-red-300">
                {validationError}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.persistent}
                  onChange={(e) => setConfig({ ...config, persistent: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                재부팅 후에도 드라이브 연결 유지
              </label>

              <button
                id="btn-client-oneclick"
                type="submit"
                disabled={isConnecting}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Link2 className="w-4 h-4" />
                {isConnecting ? '드라이브 연결 중...' : '원클릭 공유폴더 연결'}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <PipelineTracker
            title="클라이언트 5단계 연결·복구 파이프라인"
            steps={steps}
            isRunning={isConnecting}
          />

          {(() => {
            const failedStep = steps.find((st) => st.status === 'error' && st.error);
            const diag = failedStep ? classifyFailureDiagnostics(failedStep.error) : null;
            if (!diag) return null;
            return (
              <div
                id="client-failure-diagnostic-banner"
                role="alert"
                className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    연결 실패 처방 가이드 · {diag.title}
                  </span>
                  <span className="tabular-data text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    {diag.code}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {diag.detail}
                </p>
                {onOpenMatrix && (
                  <button
                    id="btn-failure-open-matrix"
                    type="button"
                    onClick={onOpenMatrix}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    {diag.actionLabel}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            연결된 네트워크 드라이브 ({mounts.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            연결 완료 즉시 Windows 탐색기에서 바로 사용할 수 있습니다
          </span>
        </div>

        {mounts.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              연결된 네트워크 드라이브가 없습니다. 상단에서 메인 PC를 선택하거나 연결 코드를 입력해 연결하세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">드라이브</th>
                  <th className="py-3 px-4">네트워크 UNC 경로</th>
                  <th className="py-3 px-4">인증 모드</th>
                  <th className="py-3 px-4">연결 시각</th>
                  <th className="py-3 px-6 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {mounts.map((m) => (
                  <tr key={m.driveLetter} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-6 tabular-data font-bold whitespace-nowrap">
                      <span className={m.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {m.driveLetter}
                      </span>
                      {m.status === 'disconnected' && (
                        <span className="ml-2 text-[10px] font-medium text-amber-600 dark:text-amber-400">(오프라인)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-data text-xs text-slate-700 dark:text-slate-300">
                      {m.uncPath}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {m.authMode === 'guest' ? '간편 무비밀번호' : '보안 계정 (cmdkey)'}
                    </td>
                    <td className="py-3 px-4 tabular-data text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {m.mountedAt}
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onOpenDrive(`${m.driveLetter}\\`)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          탐색기 열기
                        </button>
                        <button
                          type="button"
                          onClick={() => void onUnmount(m.driveLetter)}
                          className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Unplug className="w-3.5 h-3.5" />
                          연결 해제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
