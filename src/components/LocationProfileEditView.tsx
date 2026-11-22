import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  FolderOpen,
  HardDrive,
  Laptop,
  Network,
  Plus,
  RotateCcw,
  Save,
  Server,
  Trash2,
} from 'lucide-react';
import {
  ActiveShare,
  AuthMode,
  LocalNetworkInfo,
  LocationClientTargetEntry,
  LocationHostPreset,
  LocationProfileFile,
  PolicyPatchMode,
  PortableHostShareEntry,
  SharePermission,
} from '@/types/share';
import {
  validateAccountUsername,
  validateFolderPath,
  validateShareName,
  validateTargetHost,
} from '@/utils/connectionCode';

type EditorTab = 'general' | 'shares' | 'clients' | 'preset';

interface LocationProfileEditViewProps {
  profile: LocationProfileFile;
  isCurrentlyActive: boolean;
  netInfo: LocalNetworkInfo;
  activeShares: ActiveShare[];
  isSaving: boolean;
  onSelectFolder?: (currentPath: string) => Promise<string | null>;
  onCancel: () => void;
  onSave: (edited: LocationProfileFile, applyToWorkspace: boolean) => Promise<boolean>;
}

const DRIVE_LETTERS = [
  'Z:', 'Y:', 'X:', 'W:', 'V:', 'U:', 'T:', 'S:', 'R:', 'Q:', 'P:',
  'O:', 'N:', 'M:', 'L:', 'K:', 'J:', 'I:', 'H:', 'G:', 'F:', 'E:', 'D:',
];

const PATCH_MODE_OPTIONS: Array<{ value: '' | PolicyPatchMode; label: string }> = [
  { value: '', label: '미지정 (기본 동작 유지)' },
  { value: 'safe_compat', label: '안전 호환 패치 (SMB 서명·탐색 완화)' },
  { value: 'rpc_printer_compat', label: '프린터 RPC 공유 호환 패치' },
  { value: 'deep_stack_reset', label: '심층 네트워크 스택 초기화' },
  { value: 'strict_26h2_default', label: 'Win 11 26H2 보안 기본값 원복' },
  { value: 'rpc_printer_default', label: '프린터 RPC 개인정보 인증 기본값 복원' },
  { value: 'enable_uac_token_filter', label: 'UAC 원격 관리 토큰 필터 완화 (LocalAccountTokenFilterPolicy=1)' },
  { value: 'disable_uac_token_filter', label: 'UAC 원격 관리 토큰 필터 기본 차단 (LocalAccountTokenFilterPolicy=0)' },
  { value: 'enable_smbv1_client', label: 'SMBv1 클라이언트 활성화 (구형 NAS)' },
  { value: 'legacy_bridge_compat', label: 'Win 7/8 레거시 브릿지 호환' },
  { value: 'legacy_smb1_enable', label: '레거시 SMB 1.0 호스트·클라이언트 활성화' },
  { value: 'legacy_bridge_rollback', label: '레거시 브릿지 보안 원복' },
];

function formatUpdatedDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextAvailableDriveLetter(existing: LocationClientTargetEntry[]): string {
  const used = new Set(existing.map((c) => c.driveLetter.replace(/:?$/, ':').toUpperCase()));
  return DRIVE_LETTERS.find((dl) => !used.has(dl)) || 'Z:';
}

export const LocationProfileEditView: React.FC<LocationProfileEditViewProps> = ({
  profile,
  isCurrentlyActive,
  netInfo,
  activeShares,
  isSaving,
  onSelectFolder,
  onCancel,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('general');
  const [locationName, setLocationName] = useState(profile.locationName);
  const [description, setDescription] = useState(profile.description || '');
  const [subnetPrefix, setSubnetPrefix] = useState(profile.networkHint?.subnetPrefix || '');
  const [primaryIp, setPrimaryIp] = useState(profile.networkHint?.primaryIp || '');
  const [hostname, setHostname] = useState(profile.networkHint?.hostname || '');
  const [adapterName, setAdapterName] = useState(profile.networkHint?.adapterName || '');
  const [preferredPatchMode, setPreferredPatchMode] = useState<'' | PolicyPatchMode>(
    profile.preferredPatchMode || ''
  );

  const [savedShares, setSavedShares] = useState<PortableHostShareEntry[]>(() =>
    (profile.savedShares || []).map((s) => ({ ...s }))
  );
  const [clientTargets, setClientTargets] = useState<LocationClientTargetEntry[]>(() =>
    (profile.clientTargets || []).map((c) => ({ ...c }))
  );
  const [hasHostPreset, setHasHostPreset] = useState<boolean>(Boolean(profile.hostPreset));
  const [hostPreset, setHostPreset] = useState<LocationHostPreset>(() =>
    profile.hostPreset
      ? { ...profile.hostPreset }
      : {
          folderPath: 'C:\\AhBiShared',
          shareName: 'AhBiShared',
          authMode: 'guest',
          permission: 'full',
          username: 'AhBiShare',
          password: '',
          ttlMinutes: undefined,
          autoRevokeOnExpiry: false,
        }
  );

  const [applyToWorkspace, setApplyToWorkspace] = useState<boolean>(isCurrentlyActive);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisible = (key: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFillCurrentNetwork = () => {
    setSubnetPrefix(netInfo.subnetPrefix);
    setPrimaryIp(netInfo.primaryIp);
    setHostname(netInfo.hostname);
    setAdapterName(netInfo.adapterName || '');
    setValidationError(null);
  };

  const handleBrowseShareFolder = async (idx: number) => {
    if (!onSelectFolder) return;
    const current = savedShares[idx]?.folderPath || 'C:\\AhBiShared';
    const picked = await onSelectFolder(current);
    if (picked) {
      setSavedShares((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, folderPath: picked } : item))
      );
      setValidationError(null);
    }
  };

  const handleBrowsePresetFolder = async () => {
    if (!onSelectFolder) return;
    const picked = await onSelectFolder(hostPreset.folderPath || 'C:\\AhBiShared');
    if (picked) {
      setHostPreset((prev) => ({ ...prev, folderPath: picked }));
      setValidationError(null);
    }
  };

  const handleAddShare = () => {
    const idx = savedShares.length + 1;
    const baseName = idx === 1 ? 'AhBiShared' : `AhBiShared${idx}`;
    setSavedShares((prev) => [
      ...prev,
      {
        sourceHostName: hostname.trim() || netInfo.hostname,
        sourceIp: primaryIp.trim() || netInfo.primaryIp,
        shareName: baseName,
        folderPath: idx === 1 ? 'C:\\AhBiShared' : `C:\\AhBiShared\\Share${idx}`,
        uncPath: `\\\\${primaryIp.trim() || netInfo.primaryIp}\\${baseName}`,
        authMode: 'guest',
        permission: 'full',
        createdAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        updatedAt: new Date().toISOString(),
        connectionCode: '',
      },
    ]);
    setValidationError(null);
  };

  const handleImportActiveShares = () => {
    if (activeShares.length === 0) return;
    setSavedShares((prev) => {
      const existingNames = new Set(prev.map((s) => s.shareName.trim().toLowerCase()));
      const additions: PortableHostShareEntry[] = [];
      for (const sh of activeShares) {
        if (existingNames.has(sh.shareName.trim().toLowerCase())) continue;
        additions.push({
          sourceHostName: sh.sourceHostName || netInfo.hostname,
          sourceIp: sh.sourceIp || netInfo.primaryIp,
          shareName: sh.shareName,
          folderPath: sh.folderPath,
          uncPath: sh.uncPath,
          authMode: sh.authMode,
          permission: sh.permission,
          ...(sh.username ? { username: sh.username } : {}),
          ...(sh.restoredPassword ? { password: sh.restoredPassword } : {}),
          createdAt: sh.createdAt,
          updatedAt: sh.updatedAt || new Date().toISOString(),
          ...(typeof sh.ttlMinutes === 'number' && sh.ttlMinutes > 0
            ? { ttlMinutes: sh.ttlMinutes, expiresAt: sh.expiresAt, autoRevokeOnExpiry: sh.autoRevokeOnExpiry }
            : {}),
          connectionCode: sh.connectionCode,
        });
      }
      return [...prev, ...additions];
    });
    setValidationError(null);
  };

  const handleUpdateShare = (idx: number, patch: Partial<PortableHostShareEntry>) => {
    setSavedShares((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
    setValidationError(null);
  };

  const handleRemoveShare = (idx: number) => {
    setSavedShares((prev) => prev.filter((_, i) => i !== idx));
    setVisiblePasswords((prev) => {
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith('share-')) {
          next[k] = v;
        } else {
          const n = parseInt(k.slice(6), 10);
          if (!Number.isNaN(n)) {
            if (n < idx) next[k] = v;
            else if (n > idx) next[`share-${n - 1}`] = v;
          }
        }
      }
      return next;
    });
    setValidationError(null);
  };

  const handleAddClientTarget = () => {
    setClientTargets((prev) => [
      ...prev,
      {
        targetHost: primaryIp.trim() || netInfo.primaryIp || '192.168.0.10',
        shareName: savedShares[0]?.shareName || 'AhBiShared',
        driveLetter: nextAvailableDriveLetter(prev),
        authMode: 'guest',
        persistent: true,
      },
    ]);
    setValidationError(null);
  };

  const handleUpdateClientTarget = (idx: number, patch: Partial<LocationClientTargetEntry>) => {
    setClientTargets((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
    setValidationError(null);
  };

  const handleRemoveClientTarget = (idx: number) => {
    setClientTargets((prev) => prev.filter((_, i) => i !== idx));
    setVisiblePasswords((prev) => {
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith('client-')) {
          next[k] = v;
        } else {
          const n = parseInt(k.slice(7), 10);
          if (!Number.isNaN(n)) {
            if (n < idx) next[k] = v;
            else if (n > idx) next[`client-${n - 1}`] = v;
          }
        }
      }
      return next;
    });
    setValidationError(null);
  };

  const handleCopyFirstShareToPreset = () => {
    const first = savedShares[0];
    if (!first) return;
    setHasHostPreset(true);
    setHostPreset({
      folderPath: first.folderPath || 'C:\\AhBiShared',
      shareName: first.shareName || 'AhBiShared',
      authMode: first.authMode,
      permission: first.permission,
      username: first.username || 'AhBiShare',
      password: first.password || '',
      ...(first.encryptedCredentials && !first.password
        ? { encryptedCredentials: first.encryptedCredentials }
        : {}),
      ttlMinutes: first.ttlMinutes,
      autoRevokeOnExpiry: first.autoRevokeOnExpiry,
    });
    setValidationError(null);
  };

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = locationName.trim();
    if (!cleanName) {
      setActiveTab('general');
      setValidationError('사용장소 이름을 입력하세요.');
      return;
    }

    for (let i = 0; i < savedShares.length; i++) {
      const sh = savedShares[i];
      const normalizedFolder = sh.folderPath.trim().replace(/\//g, '\\');
      const shareNameErr = validateShareName(sh.shareName);
      if (shareNameErr) {
        setActiveTab('shares');
        setValidationError(`호스트 공유폴더 #${i + 1}: ${shareNameErr}`);
        return;
      }
      const folderPathErr = validateFolderPath(normalizedFolder);
      if (folderPathErr) {
        setActiveTab('shares');
        setValidationError(`호스트 공유폴더 #${i + 1}: ${folderPathErr}`);
        return;
      }
      if (sh.authMode === 'account') {
        const shareUserErr = validateAccountUsername(sh.username || '');
        if (shareUserErr) {
          setActiveTab('shares');
          setValidationError(`호스트 공유폴더 '${sh.shareName}': ${shareUserErr}`);
          return;
        }
      }
      if (sh.authMode === 'account' && !(sh.password || '').trim() && !sh.encryptedCredentials) {
        setActiveTab('shares');
        setValidationError(
          `호스트 공유폴더 '${sh.shareName}'의 보안 계정 비밀번호를 입력하세요.`
        );
        return;
      }
    }

    const seenDrives = new Set<string>();
    for (let i = 0; i < clientTargets.length; i++) {
      const ct = clientTargets[i];
      const dl = (ct.driveLetter || '').trim().replace(/:?$/, ':').toUpperCase();
      const targetHostErr = validateTargetHost(ct.targetHost);
      if (targetHostErr) {
        setActiveTab('clients');
        setValidationError(`클라이언트 드라이브 #${i + 1}: ${targetHostErr}`);
        return;
      }
      const clientShareErr = validateShareName(ct.shareName);
      if (clientShareErr) {
        setActiveTab('clients');
        setValidationError(`클라이언트 드라이브 #${i + 1}: ${clientShareErr}`);
        return;
      }
      if (!/^[D-Z]:$/.test(dl)) {
        setActiveTab('clients');
        setValidationError(`클라이언트 드라이브 #${i + 1}의 드라이브 문자가 올바르지 않습니다 (D:~Z:).`);
        return;
      }
      if (seenDrives.has(dl)) {
        setActiveTab('clients');
        setValidationError(`클라이언트 드라이브에 '${dl}' 문자가 중복 지정되었습니다.`);
        return;
      }
      if (ct.authMode === 'account' && !(ct.username || '').trim()) {
        setActiveTab('clients');
        setValidationError(`클라이언트 드라이브 '${dl}'의 접속 계정 이름을 입력하세요.`);
        return;
      }
      if (ct.authMode === 'account' && !(ct.password || '').trim() && !ct.encryptedCredentials) {
        setActiveTab('clients');
        setValidationError(`클라이언트 드라이브 '${dl}'의 접속 비밀번호를 입력하세요.`);
        return;
      }
      seenDrives.add(dl);
    }

    if (hasHostPreset) {
      const presetFolder = hostPreset.folderPath.trim().replace(/\//g, '\\');
      const presetShareErr = validateShareName(hostPreset.shareName);
      if (presetShareErr) {
        setActiveTab('preset');
        setValidationError(`호스트 폼 프리셋: ${presetShareErr}`);
        return;
      }
      const presetFolderErr = validateFolderPath(presetFolder);
      if (presetFolderErr) {
        setActiveTab('preset');
        setValidationError(`호스트 폼 프리셋: ${presetFolderErr}`);
        return;
      }
      if (hostPreset.authMode === 'account') {
        const presetUserErr = validateAccountUsername(hostPreset.username || '');
        if (presetUserErr) {
          setActiveTab('preset');
          setValidationError(`호스트 폼 프리셋: ${presetUserErr}`);
          return;
        }
      }
      if (hostPreset.authMode === 'account' && !(hostPreset.password || '').trim() && !hostPreset.encryptedCredentials) {
        setActiveTab('preset');
        setValidationError('호스트 폼 프리셋의 보안 계정 비밀번호를 입력하세요.');
        return;
      }
    }

    setValidationError(null);
    const updatedProfile: LocationProfileFile = {
      ...profile,
      locationName: cleanName,
      description: description.trim(),
      networkHint: {
        subnetPrefix: subnetPrefix.trim(),
        primaryIp: primaryIp.trim(),
        hostname: hostname.trim(),
        ...(adapterName.trim() ? { adapterName: adapterName.trim() } : {}),
      },
      savedShares,
      clientTargets,
      ...(hasHostPreset ? { hostPreset } : { hostPreset: undefined }),
      ...(preferredPatchMode ? { preferredPatchMode } : { preferredPatchMode: undefined }),
    };

    await onSave(updatedProfile, applyToWorkspace);
  };

  return (
    <form onSubmit={(e) => void validateAndSubmit(e)} className="flex flex-col flex-1 min-h-0">
      <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="btn-back-location-list"
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            목록으로
          </button>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
              &lsquo;{profile.locationName}&rsquo; 프로필 파일 내용 수정
            </h3>
            <p className="tabular-data text-xs text-slate-500 dark:text-slate-400 truncate">
              {profile.profileId}.location.json · 최근 저장 {formatUpdatedDate(profile.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            기본 · 네트워크
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shares')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'shares'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span className="tabular-data">호스트 공유 ({savedShares.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'clients'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="tabular-data">클라이언트 ({clientTargets.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preset')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              activeTab === 'preset'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            호스트 프리셋
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {validationError && (
          <div
            role="alert"
            className="px-4 py-3 rounded-lg border border-red-300 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 text-xs font-medium text-red-700 dark:text-red-300"
          >
            {validationError}
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-loc-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  사용장소 이름
                </label>
                <input
                  id="edit-loc-name"
                  type="text"
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="예: 청운 본사 사무실, 자택"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 tabular-data text-[11px] text-slate-500 dark:text-slate-400">
                  이름을 변경해도 기존 파일 ID({profile.profileId}.location.json)에 그대로 덮어씁니다.
                </p>
              </div>

              <div>
                <label
                  htmlFor="edit-loc-desc"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  메모 (선택)
                </label>
                <input
                  id="edit-loc-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 디자인실 공유폴더 + NAS Z드라이브"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white">
                    참고 네트워크 대역 힌트
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    장소 검색·식별 및 기본 호스트 IP 참조에 활용됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFillCurrentNetwork}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  현재 PC 네트워크 정보 적용 ({netInfo.primaryIp})
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label
                    htmlFor="edit-loc-subnet"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    서브넷 접두사
                  </label>
                  <input
                    id="edit-loc-subnet"
                    type="text"
                    value={subnetPrefix}
                    onChange={(e) => setSubnetPrefix(e.target.value)}
                    placeholder="예: 192.168.0"
                    className="w-full px-3 py-2 tabular-data text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-loc-ip"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    주 IP 주소
                  </label>
                  <input
                    id="edit-loc-ip"
                    type="text"
                    value={primaryIp}
                    onChange={(e) => setPrimaryIp(e.target.value)}
                    placeholder="예: 192.168.0.10"
                    className="w-full px-3 py-2 tabular-data text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-loc-hostname"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    호스트 PC 이름
                  </label>
                  <input
                    id="edit-loc-hostname"
                    type="text"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder="예: OFFICE-MAIN-01"
                    className="w-full px-3 py-2 tabular-data text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-loc-adapter"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                  >
                    어댑터명 (선택)
                  </label>
                  <input
                    id="edit-loc-adapter"
                    type="text"
                    value={adapterName}
                    onChange={(e) => setAdapterName(e.target.value)}
                    placeholder="예: Ethernet, Wi-Fi"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <label
                htmlFor="edit-loc-patch-mode"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                선호 OS 네트워크 호환 모드 기록 (선택)
              </label>
              <select
                id="edit-loc-patch-mode"
                value={preferredPatchMode}
                onChange={(e) => setPreferredPatchMode(e.target.value as '' | PolicyPatchMode)}
                className="w-full sm:w-96 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PATCH_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'shares' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white">
                  일괄 적용 대상 호스트 공유폴더 ({savedShares.length}건)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  이 장소 일괄 적용 시 현재 PC에 순서대로 개설·재적용할 공유폴더 목록입니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeShares.length > 0 && (
                  <button
                    type="button"
                    onClick={handleImportActiveShares}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    현재 활성 공유({activeShares.length}) 추가
                  </button>
                )}
                <button
                  id="btn-edit-add-share"
                  type="button"
                  onClick={handleAddShare}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  공유폴더 추가
                </button>
              </div>
            </div>

            {savedShares.length === 0 ? (
              <div className="py-10 px-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl space-y-2">
                <Server className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  저장된 호스트 공유폴더가 없습니다.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  클라이언트 전용 장소라면 비워 두거나, 우측 상단의 &lsquo;공유폴더 추가&rsquo;를 눌러 추가하세요.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {savedShares.map((sh, idx) => {
                  const pwdKey = `share-${idx}`;
                  const showPwd = Boolean(visiblePasswords[pwdKey]);
                  return (
                    <div
                      key={`edit-share-${idx}`}
                      className="p-4 bg-white dark:bg-slate-900/50 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="tabular-data text-xs font-bold text-slate-800 dark:text-slate-200">
                          호스트 공유 #{idx + 1} · {sh.shareName || '(공유명 미입력)'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveShare(idx)}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          항목 삭제
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            공유 이름
                          </label>
                          <input
                            type="text"
                            value={sh.shareName}
                            onChange={(e) => handleUpdateShare(idx, { shareName: e.target.value })}
                            placeholder="예: AhBiShared"
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            로컬 폴더 경로
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={sh.folderPath}
                              onChange={(e) => handleUpdateShare(idx, { folderPath: e.target.value })}
                              placeholder="예: D:\SharedDocs"
                              className="flex-1 min-w-0 px-3 py-1.5 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {onSelectFolder && (
                              <button
                                type="button"
                                onClick={() => void handleBrowseShareFolder(idx)}
                                title="폴더 선택"
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                선택
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            인증 방식
                          </label>
                          <select
                            value={sh.authMode}
                            onChange={(e) => {
                              const mode = e.target.value as AuthMode;
                              handleUpdateShare(idx, {
                                authMode: mode,
                                ...(mode === 'account' && !sh.username ? { username: 'AhBiShare' } : {}),
                                ...(mode === 'guest' ? { password: '', encryptedCredentials: undefined } : {}),
                              });
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="guest">무비밀번호 (Guest / 간편)</option>
                            <option value="account">보안 계정 (Account)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            허용 권한
                          </label>
                          <select
                            value={sh.permission}
                            onChange={(e) =>
                              handleUpdateShare(idx, { permission: e.target.value as SharePermission })
                            }
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="full">모든 권한 (읽기/쓰기)</option>
                            <option value="read">읽기 전용</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            원본 호스트 / IP
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="text"
                              value={sh.sourceHostName}
                              onChange={(e) =>
                                handleUpdateShare(idx, { sourceHostName: e.target.value })
                              }
                              placeholder="PC명"
                              className="w-full px-2.5 py-1.5 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <input
                              type="text"
                              value={sh.sourceIp}
                              onChange={(e) => handleUpdateShare(idx, { sourceIp: e.target.value })}
                              placeholder="IP 주소"
                              className="w-full px-2.5 py-1.5 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {sh.authMode === 'account' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              공유 계정명
                            </label>
                            <input
                              type="text"
                              value={sh.username || ''}
                              onChange={(e) => handleUpdateShare(idx, { username: e.target.value })}
                              placeholder="예: AhBiShare"
                              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              공유 비밀번호
                            </label>
                            <div className="relative">
                              <input
                                type={showPwd ? 'text' : 'password'}
                                value={sh.password || ''}
                                onChange={(e) => handleUpdateShare(idx, { password: e.target.value })}
                                placeholder={
                                  sh.encryptedCredentials
                                    ? '기존 암호 유지 (변경 시에만 새 암호 입력)'
                                    : '새 비밀번호 입력'
                                }
                                className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => togglePasswordVisible(pwdKey)}
                                aria-label={showPwd ? '비밀번호 숨기기' : '비밀번호 보기'}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              >
                                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600 dark:text-slate-300">
                        <label className="inline-flex items-center gap-2">
                          <span>자동 만료 시간(분):</span>
                          <input
                            type="number"
                            min={0}
                            max={10080}
                            value={sh.ttlMinutes ?? ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              const nextTtl = Number.isFinite(val) && val > 0 ? val : undefined;
                              handleUpdateShare(idx, {
                                ttlMinutes: nextTtl,
                                expiresAt: undefined,
                                ...(nextTtl ? {} : { autoRevokeOnExpiry: false }),
                              });
                            }}
                            placeholder="무제한"
                            className="w-24 px-2.5 py-1 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </label>
                        {typeof sh.ttlMinutes === 'number' && sh.ttlMinutes > 0 && (
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(sh.autoRevokeOnExpiry)}
                              onChange={(e) =>
                                handleUpdateShare(idx, { autoRevokeOnExpiry: e.target.checked })
                              }
                              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>만료 시 자동 공유 해제</span>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white">
                  일괄 적용 대상 클라이언트 드라이브 ({clientTargets.length}건)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  이 장소 일괄 적용 시 자동으로 연결할 원격 공유폴더 및 드라이브 문자 목록입니다.
                </p>
              </div>
              <button
                id="btn-edit-add-client"
                type="button"
                onClick={handleAddClientTarget}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                드라이브 연결 추가
              </button>
            </div>

            {clientTargets.length === 0 ? (
              <div className="py-10 px-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl space-y-2">
                <HardDrive className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  저장된 클라이언트 네트워크 드라이브 대상이 없습니다.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  호스트 전용 장소라면 비워 두거나 &lsquo;드라이브 연결 추가&rsquo;로 원격 공유 경로를 등록하세요.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {clientTargets.map((ct, idx) => {
                  const pwdKey = `client-${idx}`;
                  const showPwd = Boolean(visiblePasswords[pwdKey]);
                  return (
                    <div
                      key={`edit-client-${idx}`}
                      className="p-4 bg-white dark:bg-slate-900/50 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="tabular-data text-xs font-bold text-slate-800 dark:text-slate-200">
                          드라이브 #{idx + 1} · {ct.driveLetter} → \\{ct.targetHost || '?'}\{ct.shareName || '?'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveClientTarget(idx)}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          항목 삭제
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            드라이브 문자
                          </label>
                          <select
                            value={ct.driveLetter.replace(/:?$/, ':').toUpperCase()}
                            onChange={(e) =>
                              handleUpdateClientTarget(idx, { driveLetter: e.target.value })
                            }
                            className="w-full px-3 py-1.5 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {DRIVE_LETTERS.map((dl) => (
                              <option key={dl} value={dl}>
                                {dl}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            대상 호스트 IP 또는 PC 이름
                          </label>
                          <input
                            type="text"
                            value={ct.targetHost}
                            onChange={(e) =>
                              handleUpdateClientTarget(idx, { targetHost: e.target.value })
                            }
                            placeholder="예: 192.168.0.10 또는 MAIN-PC"
                            className="w-full px-3 py-1.5 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            원격 공유 이름
                          </label>
                          <input
                            type="text"
                            value={ct.shareName}
                            onChange={(e) =>
                              handleUpdateClientTarget(idx, { shareName: e.target.value })
                            }
                            placeholder="예: AhBiShared"
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            접속 인증 방식
                          </label>
                          <select
                            value={ct.authMode}
                            onChange={(e) => {
                              const mode = e.target.value as AuthMode;
                              handleUpdateClientTarget(idx, {
                                authMode: mode,
                                ...(mode === 'guest' ? { password: '', encryptedCredentials: undefined } : {}),
                              });
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="guest">무비밀번호 (Guest / 익명)</option>
                            <option value="account">보안 계정 (아이디 · 비밀번호)</option>
                          </select>
                        </div>

                        <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 py-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ct.persistent !== false}
                            onChange={(e) =>
                              handleUpdateClientTarget(idx, { persistent: e.target.checked })
                            }
                            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Windows 재부팅 후에도 드라이브 자동 재연결</span>
                        </label>
                      </div>

                      {ct.authMode === 'account' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              접속 계정명
                            </label>
                            <input
                              type="text"
                              value={ct.username || ''}
                              onChange={(e) =>
                                handleUpdateClientTarget(idx, { username: e.target.value })
                              }
                              placeholder="예: AhBiShare"
                              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              접속 비밀번호
                            </label>
                            <div className="relative">
                              <input
                                type={showPwd ? 'text' : 'password'}
                                value={ct.password || ''}
                                onChange={(e) =>
                                  handleUpdateClientTarget(idx, { password: e.target.value })
                                }
                                placeholder={
                                  ct.encryptedCredentials
                                    ? '기존 암호 유지 (변경 시에만 입력)'
                                    : '접속 비밀번호 입력'
                                }
                                className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => togglePasswordVisible(pwdKey)}
                                aria-label={showPwd ? '비밀번호 숨기기' : '비밀번호 보기'}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              >
                                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'preset' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasHostPreset}
                  onChange={(e) => setHasHostPreset(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>프로필 &lsquo;불러오기&rsquo; 시 호스트 입력 폼에 자동 채울 기본 프리셋 포함</span>
              </label>

              {savedShares.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyFirstShareToPreset}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  첫 번째 공유폴더 값으로 채우기
                </button>
              )}
            </div>

            {!hasHostPreset ? (
              <div className="py-10 px-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400">
                호스트 폼 프리셋이 비활성화되어 있습니다. 위 체크박스를 켜면 프로필 불러오기 시 채울 호스트 폼 값을 직접 지정할 수 있습니다.
              </div>
            ) : (
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      기본 공유 폴더 경로
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={hostPreset.folderPath}
                        onChange={(e) =>
                          setHostPreset((prev) => ({ ...prev, folderPath: e.target.value }))
                        }
                        className="flex-1 min-w-0 px-3 py-1.5 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {onSelectFolder && (
                        <button
                          type="button"
                          onClick={() => void handleBrowsePresetFolder()}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          선택
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      기본 공유 이름
                    </label>
                    <input
                      type="text"
                      value={hostPreset.shareName}
                      onChange={(e) =>
                        setHostPreset((prev) => ({ ...prev, shareName: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      인증 방식
                    </label>
                    <select
                      value={hostPreset.authMode}
                      onChange={(e) => {
                        const mode = e.target.value as AuthMode;
                        setHostPreset((prev) => ({
                          ...prev,
                          authMode: mode,
                          username:
                            mode === 'account' && !prev.username
                              ? 'AhBiShare'
                              : prev.username,
                          ...(mode === 'guest' ? { password: '', encryptedCredentials: undefined } : {}),
                        }));
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="guest">무비밀번호 (Guest)</option>
                      <option value="account">보안 계정 (Account)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      공유 권한
                    </label>
                    <select
                      value={hostPreset.permission}
                      onChange={(e) =>
                        setHostPreset((prev) => ({
                          ...prev,
                          permission: e.target.value as SharePermission,
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="full">모든 권한 (읽기/쓰기)</option>
                      <option value="read">읽기 전용</option>
                    </select>
                  </div>
                </div>

                {hostPreset.authMode === 'account' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        계정명
                      </label>
                      <input
                        type="text"
                        value={hostPreset.username}
                        onChange={(e) =>
                          setHostPreset((prev) => ({ ...prev, username: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        비밀번호
                      </label>
                      <div className="relative">
                        <input
                          type={visiblePasswords['preset'] ? 'text' : 'password'}
                          value={hostPreset.password}
                          onChange={(e) =>
                            setHostPreset((prev) => ({ ...prev, password: e.target.value }))
                          }
                          placeholder={
                            hostPreset.encryptedCredentials
                              ? '기존 암호 유지 (변경 시에만 입력)'
                              : '비밀번호 입력'
                          }
                          className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisible('preset')}
                          aria-label={visiblePasswords['preset'] ? '비밀번호 숨기기' : '비밀번호 보기'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {visiblePasswords['preset'] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <label className="inline-flex items-center gap-2">
                    <span>기본 만료 시간(분):</span>
                    <input
                      type="number"
                      min={0}
                      max={10080}
                      value={hostPreset.ttlMinutes ?? ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const nextTtl = Number.isFinite(val) && val > 0 ? val : undefined;
                        setHostPreset((prev) => ({
                          ...prev,
                          ttlMinutes: nextTtl,
                          ...(nextTtl ? {} : { autoRevokeOnExpiry: false }),
                        }));
                      }}
                      placeholder="무제한"
                      className="w-24 px-2.5 py-1 tabular-data text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>
                  {typeof hostPreset.ttlMinutes === 'number' && hostPreset.ttlMinutes > 0 && (
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(hostPreset.autoRevokeOnExpiry)}
                        onChange={(e) =>
                          setHostPreset((prev) => ({
                            ...prev,
                            autoRevokeOnExpiry: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>만료 시 자동 공유 해제</span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={applyToWorkspace}
            onChange={(e) => setApplyToWorkspace(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
          />
          <span>저장 후 현재 선택 프로필 및 입력 폼에 즉시 반영</span>
        </label>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-cancel-location-edit"
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            취소
          </button>
          <button
            id="btn-save-location-edit"
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Check className="w-3.5 h-3.5" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                변경 내용 저장
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};
