import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  FolderOpen,
  FolderOutput,
  HardDrive,
  KeyRound,
  Laptop,
  Link2,
  Lock,
  Play,
  Power,
  QrCode,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  Unplug,
  Usb,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ActiveShare,
  ClientTargetConfig,
  DiscoveredPeer,
  HostConfig,
  LegacyDirection,
  LegacyRollbackSnapshot,
  LegacyScriptBundle,
  LegacyScriptOptions,
  LegacyTargetOs,
  LocalNetworkInfo,
  MountedDrive,
  OsNetworkPolicyStatus,
  PipelineStep,
  PolicyApplyResult,
  PolicyPatchMode,
  PortableHostShareEntry,
  PortableStorageStatus,
  RoleMode,
  ShareAuthProbeResult,
  SmartAuthDetectionResult,
} from '@/types/share';
import { LEGACY_COMPARISON_MATRIX, buildLegacyScriptBundle } from '@/services/legacyScriptEngine';
import { classifyFailureDiagnostics, formatEraShortLabel } from '@/services/networkEvolution';
import { buildHostGuestUnlockPsCommand } from '@/services/powershellEngine';
import {
  decodeConnectionCode,
  generateSecureSharePassword,
  resolveActiveShareUncPath,
  resolveClientAccountCredentials,
  validateAccountUsername,
  validateFolderPath,
  validateShareName,
  validateTargetHost,
} from '@/utils/connectionCode';
import { shareBridge } from '@/services/shareBridge';
import { PipelineTracker } from './PipelineTracker';
import { PresetPasswordGrid } from './PresetPasswordGrid';
import { ShareAuthProbeBar } from './ShareAuthProbeBar';

interface LegacySharingPanelProps {
  netInfo: LocalNetworkInfo;
  policyStatus: OsNetworkPolicyStatus | null;
  lastPatchResult: PolicyApplyResult | null;
  rollbackSnapshot: LegacyRollbackSnapshot | null;
  shares: ActiveShare[];
  mounts: MountedDrive[];
  peers: DiscoveredPeer[];
  portableShares?: PortableHostShareEntry[];
  portableStatus?: PortableStorageStatus;
  hostSteps: PipelineStep[];
  clientSteps: PipelineStep[];
  nowMs?: number;
  isInspecting: boolean;
  isRefreshing?: boolean;
  isScanning: boolean;
  isHostExecuting: boolean;
  isClientConnecting: boolean;
  isApplyingMode: PolicyPatchMode | null;
  onInspectPolicy: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onApplyPatch: (mode: PolicyPatchMode) => Promise<void>;
  onSelectFolder: (currentPath: string) => Promise<string | null>;
  onCreateLegacyHostShare: (config: HostConfig, targetOs: LegacyTargetOs) => Promise<void>;
  onRemoveShare: (shareName: string) => Promise<void>;
  onScanLan: () => Promise<void>;
  onConnectLegacyClient: (config: ClientTargetConfig, targetOs: LegacyTargetOs) => Promise<void>;
  onUnmount: (driveLetter: string) => Promise<void>;
  onOpenPath: (targetPath: string) => Promise<void>;
  onExportBundle: (bundle: LegacyScriptBundle) => Promise<{
    success: boolean;
    mode: 'usb-folder' | 'web-download';
    directory?: string;
    message: string;
  }>;
  onTriggerReboot: () => Promise<{ success: boolean; message: string }>;
  onBridgeImported?: () => Promise<void> | void;
  onOpenMatrix?: () => void;
  onOpenDiagnostics?: (errorText?: string) => void;
  onOpenTroubleshootWizard?: () => void;
  onNotify?: (msg: string) => void;
}

const DRIVE_LETTERS = ['Z:', 'Y:', 'X:', 'W:', 'V:', 'S:', 'M:'];

const TTL_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '무제한', minutes: 0 },
  { label: '30분', minutes: 30 },
  { label: '1시간', minutes: 60 },
  { label: '3시간', minutes: 180 },
];

const MATRIX_FILTERS: Array<{
  id: 'all' | 'protocol' | 'encryption' | 'auth' | 'discovery' | 'errors';
  label: string;
}> = [
  { id: 'all', label: '전체 항목' },
  { id: 'protocol', label: 'SMB 세대 · 서명' },
  { id: 'encryption', label: 'SMB 암호화' },
  { id: 'auth', label: '인증 · NTLM' },
  { id: 'discovery', label: '탐색 · 검색' },
  { id: 'errors', label: '오류 코드 해법' },
];

function encodeUtf16LeWithBom(content: string): ArrayBuffer {
  const buffer = new ArrayBuffer(2 + content.length * 2);
  const bytes = new Uint8Array(buffer);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < content.length; i += 1) {
    const code = content.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return buffer;
}

function triggerSingleDownload(filename: string, content: string): void {
  const isRegFile = filename.toLowerCase().endsWith('.reg');
  const blob = isRegFile
    ? new Blob([encodeUtf16LeWithBom(content)], { type: 'text/plain;charset=utf-16le' })
    : new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
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
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function formatRemainingTime(
  expiresAt: string | undefined,
  nowMs: number
): { text: string; expired: boolean; soon: boolean } {
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

export const LegacySharingPanel: React.FC<LegacySharingPanelProps> = ({
  netInfo,
  policyStatus,
  lastPatchResult,
  rollbackSnapshot,
  shares,
  mounts,
  peers,
  portableShares = [],
  portableStatus,
  hostSteps,
  clientSteps,
  nowMs = Date.now(),
  isInspecting,
  isRefreshing = false,
  isScanning,
  isHostExecuting,
  isClientConnecting,
  isApplyingMode,
  onInspectPolicy,
  onRefresh,
  onApplyPatch,
  onSelectFolder,
  onCreateLegacyHostShare,
  onRemoveShare,
  onScanLan,
  onConnectLegacyClient,
  onUnmount,
  onOpenPath,
  onExportBundle,
  onTriggerReboot,
  onBridgeImported,
  onOpenMatrix,
  onOpenDiagnostics,
  onOpenTroubleshootWizard,
  onNotify,
}) => {
  // Topology & 2-Step Role Tab
  const [targetOs, setTargetOs] = useState<LegacyTargetOs>('win7');
  const [direction, setDirection] = useState<LegacyDirection>('bidirectional');
  const [legacyStep, setLegacyStep] = useState<RoleMode>('host');

  const handleExportBridgeJson = () => {
    const res = shareBridge.exportCrossOsBridgeBundle();
    const blob = new Blob([res.jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    if (onNotify) onNotify(res.message);
  };

  const handleImportBridgeJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (content) {
          const res = await shareBridge.importCrossOsBridgeData(content, netInfo);
          if (onNotify) onNotify(res.message);
          if (res.success && onBridgeImported) {
            await onBridgeImported();
          }
        }
      } finally {
        inputEl.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Step 1 (Host) Form State
  const [hostConfig, setHostConfig] = useState<HostConfig>({
    folderPath: 'C:\\AhBiShared',
    shareName: 'AhBiShared',
    authMode: 'guest',
    permission: 'full',
    username: 'AhBiShare',
    password: generateSecureSharePassword(10),
    ttlMinutes: 0,
    autoRevokeOnExpiry: true,
  });
  const [shareNameCustomized, setShareNameCustomized] = useState(false);
  const [hostValidationError, setHostValidationError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<ActiveShare | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Step 2 (Client) Form State
  const [rawCodeInput, setRawCodeInput] = useState('');
  const [codeParseState, setCodeParseState] = useState<'empty' | 'valid' | 'invalid'>('empty');
  const [clientValidationError, setClientValidationError] = useState<string | null>(null);
  const [selectedPortableIdx, setSelectedPortableIdx] = useState(0);
  const [portableAppliedKey, setPortableAppliedKey] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showLegacyClientPass, setShowLegacyClientPass] = useState(false);
  const [hostCmdCopied, setHostCmdCopied] = useState(false);
  const hostCmdTimerRef = useRef<number | null>(null);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('ahbishare_auto_probe_switch') !== 'false';
    } catch {
      return true;
    }
  });
  const [probeResult, setProbeResult] = useState<ShareAuthProbeResult | null>(null);
  const [smartResult, setSmartResult] = useState<SmartAuthDetectionResult | null>(null);
  const [isProbingAuth, setIsProbingAuth] = useState(false);
  const [autoSwitchedTo, setAutoSwitchedTo] = useState<'guest' | 'account' | null>(null);
  const [autoSwitchedFrom, setAutoSwitchedFrom] = useState<'guest' | 'account' | null>(null);
  const probeSeqRef = useRef(0);
  const probeTimerRef = useRef<number | null>(null);
  const inFlightProbeRef = useRef<{
    key: string;
    seq: number;
    promise: Promise<ShareAuthProbeResult | null>;
  } | null>(null);
  const completedProbeRef = useRef<{ key: string; result: ShareAuthProbeResult | null } | null>(null);
  const suppressedAutoSwitchKeysRef = useRef<Set<string>>(new Set());

  const [clientConfig, setClientConfig] = useState<ClientTargetConfig>({
    targetHost: '192.168.0.10',
    shareName: 'WorkDocs',
    driveLetter: 'Z:',
    authMode: 'guest',
    username: '',
    password: '',
    persistent: true,
  });
  const clientConfigRef = useRef(clientConfig);
  clientConfigRef.current = clientConfig;
  const autoSwitchEnabledRef = useRef(autoSwitchEnabled);
  autoSwitchEnabledRef.current = autoSwitchEnabled;
  const rawCodeRef = useRef(rawCodeInput);
  rawCodeRef.current = rawCodeInput;
  const codeParseStateRef = useRef(codeParseState);
  codeParseStateRef.current = codeParseState;

  // 2-step risk confirmation states (SMB 1.0 & Reboot)
  const [smb1StepOpen, setSmb1StepOpen] = useState(false);
  const [smb1RiskAccepted, setSmb1RiskAccepted] = useState(false);
  const [confirmingReboot, setConfirmingReboot] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootFeedback, setRebootFeedback] = useState<string | null>(null);

  // USB Script Generator options
  const [includeGuestLogon, setIncludeGuestLogon] = useState(true);
  const [includeUacTokenFilter, setIncludeUacTokenFilter] = useState(true);
  const [includeDiscoveryServices, setIncludeDiscoveryServices] = useState(true);
  const [includeSmb1Script, setIncludeSmb1Script] = useState(false);
  const [scriptSmb1GateOpen, setScriptSmb1GateOpen] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Comparison Matrix filter/search
  const [matrixFilter, setMatrixFilter] = useState<
    'all' | 'protocol' | 'encryption' | 'auth' | 'discovery' | 'errors'
  >('all');
  const [matrixSearch, setMatrixSearch] = useState('');

  useEffect(() => {
    const onAutoSwitchSync = (ev: Event) => {
      const customEv = ev as CustomEvent<boolean>;
      if (typeof customEv.detail === 'boolean') {
        setAutoSwitchEnabled(customEv.detail);
      }
    };
    window.addEventListener('ahbishare:autoswitch-changed', onAutoSwitchSync);
    return () => {
      window.removeEventListener('ahbishare:autoswitch-changed', onAutoSwitchSync);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (hostCmdTimerRef.current !== null) {
        window.clearTimeout(hostCmdTimerRef.current);
      }
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
      }
      probeSeqRef.current += 1;
      inFlightProbeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (portableShares.length > 0 && selectedPortableIdx >= portableShares.length) {
      setSelectedPortableIdx(0);
    }
    if (portableShares.length > 0) {
      setBannerDismissed(false);
    }
  }, [portableShares.length, selectedPortableIdx]);

  const mountedSet = useMemo(() => new Set(mounts.map((m) => m.driveLetter.toUpperCase())), [mounts]);

  const driveLetterOptions = useMemo(() => {
    const seen = new Set<string>(DRIVE_LETTERS);
    const list = [...DRIVE_LETTERS];
    const currentDrive = String(clientConfig.driveLetter || '').trim().toUpperCase();
    if (currentDrive && !seen.has(currentDrive)) {
      seen.add(currentDrive);
      list.unshift(currentDrive);
    }
    for (const m of mounts) {
      const dl = String(m.driveLetter || '').trim().toUpperCase();
      if (dl && !seen.has(dl)) {
        seen.add(dl);
        list.push(dl);
      }
    }
    return list;
  }, [clientConfig.driveLetter, mounts]);

  useEffect(() => {
    setClientConfig((prev) => {
      if (!mountedSet.has(prev.driveLetter.toUpperCase())) return prev;
      const nextFree = DRIVE_LETTERS.find((dl) => !mountedSet.has(dl));
      if (!nextFree || nextFree === prev.driveLetter) return prev;
      return { ...prev, driveLetter: nextFree };
    });
  }, [mountedSet]);

  const isBusy =
    isInspecting || isRefreshing || isApplyingMode !== null || isHostExecuting || isClientConnecting;

  const currentEra = policyStatus?.osEra || netInfo.osEra || 'win11_24h2';
  const currentBuild = policyStatus?.osBuild || netInfo.osBuild || 26100;
  const currentDisp = policyStatus?.osDisplayVersion || netInfo.osDisplayVersion || '24H2';
  const legacyOsLabel =
    targetOs === 'win7' ? 'Windows 7 SP1 (SMB 2.1)' : 'Windows 8 / 8.1 (SMB 3.0)';
  const legacyOsShort = targetOs === 'win7' ? 'Win 7' : 'Win 8/8.1';

  const legacyBlockingIssues = useMemo(() => {
    if (!policyStatus) return [];
    const list: string[] = [];
    // modern_to_legacy: 현재 Win 10·11 PC가 메인(호스트), 구형 OS가 클라이언트
    // legacy_to_modern: 구형 OS가 메인(호스트), 현재 Win 10·11 PC가 클라이언트
    const checkServerHostSide = direction === 'bidirectional' || direction === 'modern_to_legacy';
    const checkClientSide = direction === 'bidirectional' || direction === 'legacy_to_modern';

    if (checkServerHostSide && policyStatus.networkProfile === 'Public') {
      list.push(
        `네트워크 프로필이 공용(Public) 상태여서 ${legacyOsShort} PC의 TCP 445·탐색 인바운드 접근이 차단됩니다.`
      );
    }
    if (checkServerHostSide && policyStatus.firewall445Allowed === false) {
      list.push(
        `TCP 445 인바운드 방화벽 규칙이 닫혀 있어 ${legacyOsShort} PC가 공유 폴더에 접근할 수 없습니다 (Error 53).`
      );
    }
    if (checkServerHostSide && policyStatus.smb2Enabled === false) {
      list.push(
        `SMB 2.x/3.x 프로토콜이 비활성화되어 있어 ${targetOs === 'win7' ? 'Win 7(SMB 2.1)' : 'Win 8.1(SMB 3.0)'} 고속 공유가 불가능합니다.`
      );
    }
    if (checkServerHostSide && (policyStatus.smbEncryptData || policyStatus.smbRejectUnencryptedAccess)) {
      list.push(
        targetOs === 'win7'
          ? 'SMB 전송 암호화 또는 비암호화 접근 거부가 켜져 있어 암호화를 미지원하는 Win 7에서 Error 58/0x80070035가 발생합니다.'
          : 'SMB 전송 암호화 강제가 켜져 있어 Win 8/8.1 구형 암호(AES-256-GCM 미지원) 협상 시 Error 58/0x80070035가 발생할 수 있습니다.'
      );
    }
    if (checkServerHostSide && policyStatus.smbServerSigningRequired) {
      list.push(`SMB 서버 보안 서명 강제가 켜져 있어 ${legacyOsShort} 비서명 연결 협상이 거부될 수 있습니다.`);
    }
    if (checkServerHostSide && policyStatus.guestNetworkLogonDenied) {
      list.push(
        `로컬 보안 정책(SeDenyNetworkLogonRight)에 Guest 네트워크 로그온이 차단되어 있어 무비밀번호 접속 시 Error 1385가 발생합니다.`
      );
    }
    if (checkClientSide && policyStatus.smbClientSigningRequired) {
      list.push(
        `SMB 클라이언트 서명 강제(Win 11 24H2 기본)가 켜져 있어 ${legacyOsShort} 공유폴더 접속이 차단됩니다.`
      );
    }
    if (checkClientSide && !policyStatus.allowInsecureGuestAuth) {
      list.push(
        `비인증 게스트 로그온 차단이 활성화되어 ${legacyOsShort} 무비밀번호 공유 접속 시 오류 1272가 발생합니다.`
      );
    }
    if (policyStatus.lmCompatibilityLevel !== null && policyStatus.lmCompatibilityLevel < 3) {
      list.push(
        `현재 NTLM 호환 수준(Lm=${policyStatus.lmCompatibilityLevel})이 낮아 양단 NTLMv2 인증 협상에 실패할 수 있습니다.`
      );
    }
    if (!policyStatus.fdResPubRunning) {
      list.push('FDResPub(WS-Discovery) 서비스가 중지되어 구형 PC와 LAN 목록 탐색이 원활하지 않을 수 있습니다.');
    }
    return list;
  }, [policyStatus, direction, targetOs, legacyOsShort]);

  const directionSummaryText = useMemo(() => {
    if (direction === 'modern_to_legacy') {
      return `최신 PC(Win 10·11)에서 공유를 개설하거나 구형 ${legacyOsLabel} PC가 클라이언트로 연결합니다. [1단계 메인]에서 브릿지+공유 개설을 실행한 뒤, 구형 PC에는 USB 스크립트 키트를 실행하고 UNC/연결 코드로 접속하세요.`;
    }
    if (direction === 'legacy_to_modern') {
      return `구형 ${legacyOsLabel} PC가 공유폴더(메인)를 열고 현재 Win 10·11 PC가 클라이언트로 접속합니다. 구형 PC에서 USB Apply 스크립트와 공유 설정을 완료한 뒤, [2단계 클라이언트]에서 통합 원클릭 연결을 실행하세요.`;
    }
    return `현재 PC와 ${legacyOsLabel} 간 양방향 공유 토폴로지입니다. [1단계 메인]에서 브릿지 정렬 + 공유폴더 개설을, [2단계 클라이언트]에서 브릿지 정렬 + 네트워크 드라이브 연결을 각각 원클릭으로 실행할 수 있습니다.`;
  }, [direction, legacyOsLabel]);

  const scriptOptions: LegacyScriptOptions = useMemo(
    () => ({
      targetOs,
      direction,
      includeGuestLogon,
      includeUacTokenFilter,
      includeDiscoveryServices,
      includeSmb1Protocol: includeSmb1Script,
    }),
    [targetOs, direction, includeGuestLogon, includeUacTokenFilter, includeDiscoveryServices, includeSmb1Script]
  );

  const scriptBundle = useMemo(() => buildLegacyScriptBundle(scriptOptions), [scriptOptions]);
  const selectedFile = scriptBundle.files[activeFileIndex] || scriptBundle.files[0];

  const filteredComparisonRows = useMemo(() => {
    const q = matrixSearch.trim().toLowerCase();
    return LEGACY_COMPARISON_MATRIX.filter((row) => {
      if (matrixFilter !== 'all' && row.category !== matrixFilter) return false;
      if (!q) return true;
      return (
        row.topic.toLowerCase().includes(q) ||
        row.win7Behavior.toLowerCase().includes(q) ||
        row.win8Behavior.toLowerCase().includes(q) ||
        row.win10_11Behavior.toLowerCase().includes(q) ||
        row.resolutionSummary.toLowerCase().includes(q)
      );
    });
  }, [matrixFilter, matrixSearch]);

  const handleCopyText = async (text: string, id: string, successNotice: string) => {
    const copied = await copyTextWithFallback(text);
    if (copied) {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedId(id);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId(null);
        copyTimerRef.current = null;
      }, 1800);
      onNotify?.(successNotice);
    } else {
      onNotify?.('클립보드 복사에 실패했습니다. 텍스트를 직접 선택해 복사하세요.');
    }
  };

  // Step 1 Host handlers
  const handleBrowseFolder = async () => {
    const picked = await onSelectFolder(hostConfig.folderPath);
    if (picked) {
      const folderLeaf = picked.split(/[\\/]/).filter(Boolean).pop() || 'AhBiShared';
      const sanitizedLeaf = folderLeaf.replace(/[\\/:*?"<>|]/g, '_') || 'AhBiShared';
      setHostValidationError(null);
      setHostConfig((prev) => ({
        ...prev,
        folderPath: picked,
        shareName: !shareNameCustomized ? sanitizedLeaf : prev.shareName,
      }));
    }
  };

  const handleHostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    const folderErr = validateFolderPath(hostConfig.folderPath);
    if (folderErr) {
      setHostValidationError(folderErr);
      return;
    }
    const shareErr = validateShareName(hostConfig.shareName);
    if (shareErr) {
      setHostValidationError(shareErr);
      return;
    }
    if (hostConfig.authMode === 'account') {
      const userErr = validateAccountUsername(hostConfig.username);
      if (userErr) {
        setHostValidationError(userErr);
        return;
      }
      if (!hostConfig.password || hostConfig.password.length < 4) {
        setHostValidationError('보안 계정 접속 암호는 최소 4자 이상 입력하세요.');
        return;
      }
    }
    setHostValidationError(null);
    setRebootFeedback(null);
    setConfirmingReboot(false);
    void onCreateLegacyHostShare(hostConfig, targetOs);
  };

  const getHostCandidates = useCallback(
    (hostInput?: string, extra: Array<string | undefined> = []): string[] => {
      const norm = (val?: string) => String(val || '').trim().toLowerCase();
      const targetNorm = norm(hostInput);
      const matchedPeer = targetNorm
        ? peers.find((p) => norm(p.ipAddress) === targetNorm || norm(p.hostName) === targetNorm)
        : undefined;
      return Array.from(
        new Set(
          [...extra, matchedPeer?.hostName, matchedPeer?.ipAddress]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
        )
      );
    },
    [peers]
  );

  // Step 2 Client handlers
  const applyPortableEntry = useCallback(
    (entry: PortableHostShareEntry) => {
      setClientValidationError(null);
      const targetHost = entry.sourceIp || entry.sourceHostName;
      const decoded = entry.connectionCode ? decodeConnectionCode(entry.connectionCode) : null;
      const resolved = entry.authMode === 'account' ? resolveClientAccountCredentials({
        targetHost,
        hostCandidates: getHostCandidates(targetHost, [entry.sourceHostName, entry.sourceIp, decoded?.hostName, decoded?.ip]),
        shareName: entry.shareName,
        requireAccountOnly: true,
        portableShares,
        activeShares: shares,
      }) : null;
      const username = entry.authMode === 'account' ? entry.username || decoded?.username || resolved?.username || 'AhBiShare' : '';
      const password = entry.authMode === 'account' ? entry.password || decoded?.password || resolved?.password || '' : '';

      setAutoSwitchedTo(null);
      setAutoSwitchedFrom(null);
      setClientConfig((prev) => ({
        ...prev,
        targetHost,
        shareName: entry.shareName,
        authMode: entry.authMode,
        username,
        password,
      }));
      if (entry.connectionCode) {
        setRawCodeInput(entry.connectionCode);
        setCodeParseState(decodeConnectionCode(entry.connectionCode) ? 'valid' : 'empty');
      } else {
        setRawCodeInput('');
        setCodeParseState('empty');
      }
      setPortableAppliedKey(`${entry.sourceHostName}::${entry.shareName}::${entry.updatedAt}`);
      onNotify?.(`USB에 저장된 '${entry.sourceHostName || entry.sourceIp} · ${entry.shareName}' 연결 정보를 불러왔습니다.`);
    },
    [getHostCandidates, portableShares, shares, onNotify]
  );

  const handleCodeChange = (val: string) => {
    setRawCodeInput(val);
    setClientValidationError(null);
    if (!val.trim()) {
      setCodeParseState('empty');
      return;
    }
    const decoded = decodeConnectionCode(val);
    if (decoded) {
      setCodeParseState('valid');
      setAutoSwitchedTo(null);
      setAutoSwitchedFrom(null);
      const resolved = decoded.authMode === 'account' ? resolveClientAccountCredentials({
        targetHost: decoded.ip || decoded.hostName,
        hostCandidates: getHostCandidates(decoded.ip || decoded.hostName, [decoded.ip, decoded.hostName]),
        shareName: decoded.shareName,
        requireAccountOnly: true,
        portableShares,
        activeShares: shares,
      }) : null;
      setClientConfig((prev) => ({
        ...prev,
        targetHost: decoded.ip || decoded.hostName,
        shareName: decoded.shareName,
        authMode: decoded.authMode,
        username: decoded.username || resolved?.username || '',
        password: decoded.password || resolved?.password || '',
      }));
    } else {
      setCodeParseState('invalid');
    }
  };

  const makeLegacyTargetKey = (host: string, share: string) =>
    `${String(host || '').trim().toLowerCase()}::${String(share || '').trim().toLowerCase()}`;

  const switchToAccountMode = useCallback(
    (hostOverride?: unknown, shareOverride?: unknown) => {
      const targetHost = typeof hostOverride === 'string' ? hostOverride : clientConfigRef.current.targetHost;
      const shareName = typeof shareOverride === 'string' ? shareOverride : clientConfigRef.current.shareName;
      setClientValidationError(null);
      const resolved = resolveClientAccountCredentials({
        targetHost,
        hostCandidates: getHostCandidates(targetHost),
        shareName,
        requireAccountOnly: true,
        portableShares,
        activeShares: shares,
      });
      setClientConfig((prev) => ({
        ...prev,
        authMode: 'account',
        username: prev.username.trim() ? prev.username : resolved?.username || 'AhBiShare',
        password: prev.password ? prev.password : resolved?.password || '',
      }));
    },
    [getHostCandidates, portableShares, shares]
  );

  const handleToggleAutoSwitch = (next: boolean) => {
    setAutoSwitchEnabled(next);
    autoSwitchEnabledRef.current = next;
    try {
      window.localStorage.setItem('ahbishare_auto_probe_switch', next ? 'true' : 'false');
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent<boolean>('ahbishare:autoswitch-changed', { detail: next }));
    } catch {}
  };

  const runLegacyShareAuthProbe = useCallback(
    async (
      hostArg?: string,
      shareArg?: string,
      options?: { manual?: boolean; allowAutoSwitch?: boolean }
    ): Promise<ShareAuthProbeResult | null> => {
      const host = String(hostArg ?? clientConfigRef.current.targetHost).trim();
      const share = String(shareArg ?? clientConfigRef.current.shareName).trim();
      if (!host || !share || validateTargetHost(host) || validateShareName(share)) {
        completedProbeRef.current = null;
        inFlightProbeRef.current = null;
        setProbeResult(null);
        setSmartResult(null);
        setAutoSwitchedTo(null);
        setAutoSwitchedFrom(null);
        return null;
      }

      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }

      const key = makeLegacyTargetKey(host, share);
      if (options?.manual) {
        suppressedAutoSwitchKeysRef.current.delete(key);
        shareBridge.setSmartAuthSuppressed(host, share, false);
        completedProbeRef.current = null;
      }

      const seq = (probeSeqRef.current += 1);
      setIsProbingAuth(true);

      const probeTask = (async (): Promise<ShareAuthProbeResult | null> => {
        try {
          const initialCfg = clientConfigRef.current;
          const initialValidAbshare =
            rawCodeRef.current.trim().startsWith('ABSHARE://') && codeParseStateRef.current === 'valid';
          const isSuppressed =
            suppressedAutoSwitchKeysRef.current.has(key) || shareBridge.isSmartAuthSuppressed(host, share);
          const initialDetection = await shareBridge.detectSmartShareAuth({
            targetHost: host,
            shareName: share,
            currentAuthMode: initialCfg.authMode,
            hasTypedPassword: Boolean(initialCfg.password),
            autoSwitchEnabled: options?.allowAutoSwitch !== false && autoSwitchEnabledRef.current,
            suppressed: isSuppressed,
            hasValidAbshareToken: initialValidAbshare,
            forceProbe: Boolean(options?.manual),
            peers,
            portableShares,
            activeShares: shares,
          });
          if (seq !== probeSeqRef.current) return null;

          const curCfg = clientConfigRef.current;
          const stillSameTarget = makeLegacyTargetKey(curCfg.targetHost, curCfg.shareName) === key;
          const hasValidAbshareToken =
            rawCodeRef.current.trim().startsWith('ABSHARE://') && codeParseStateRef.current === 'valid';
          const decision = stillSameTarget
            ? shareBridge.evaluateSmartAuthDecision(
                initialDetection.probe,
                {
                  currentAuthMode: curCfg.authMode,
                  hasTypedPassword: Boolean(curCfg.password),
                  autoSwitchEnabled: options?.allowAutoSwitch !== false && autoSwitchEnabledRef.current,
                  suppressed:
                    suppressedAutoSwitchKeysRef.current.has(key) || shareBridge.isSmartAuthSuppressed(host, share),
                  hasValidAbshareToken,
                  peers,
                  portableShares,
                  activeShares: shares,
                },
                initialDetection.fromCache
              )
            : initialDetection;

          completedProbeRef.current = { key, result: decision.probe };
          setIsProbingAuth(false);
          setProbeResult(decision.probe);
          setSmartResult(decision);

          if (stillSameTarget && decision.action === 'auto_switch' && decision.switchToMode) {
            if (decision.switchToMode === 'account') {
              setClientValidationError(null);
              setClientConfig((prev) => ({
                ...prev,
                authMode: 'account',
                username: prev.username.trim() ? prev.username : decision.suggestedUsername || 'AhBiShare',
                password: prev.password ? prev.password : decision.suggestedPassword || '',
              }));
              setAutoSwitchedTo('account');
              setAutoSwitchedFrom(decision.switchedFromMode || 'guest');
            } else if (decision.switchToMode === 'guest') {
              setClientConfig((prev) => ({ ...prev, authMode: 'guest' }));
              setAutoSwitchedTo('guest');
              setAutoSwitchedFrom(decision.switchedFromMode || 'account');
            }
          } else {
            setAutoSwitchedTo(null);
            setAutoSwitchedFrom(null);
          }

          return decision.probe;
        } catch {
          if (seq === probeSeqRef.current) {
            setIsProbingAuth(false);
          }
          return null;
        } finally {
          if (inFlightProbeRef.current?.seq === seq) {
            inFlightProbeRef.current = null;
          }
        }
      })();

      inFlightProbeRef.current = { key, seq, promise: probeTask };
      return probeTask;
    },
    [peers, portableShares, shares]
  );

  useEffect(() => {
    if (legacyStep !== 'client') {
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
      probeSeqRef.current += 1;
      inFlightProbeRef.current = null;
      setIsProbingAuth(false);
      return;
    }
    const cleanHost = clientConfig.targetHost.trim();
    const cleanShare = clientConfig.shareName.trim();
    if (!cleanHost || !cleanShare || validateTargetHost(cleanHost) || validateShareName(cleanShare)) {
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
      probeSeqRef.current += 1;
      inFlightProbeRef.current = null;
      completedProbeRef.current = null;
      setIsProbingAuth(false);
      setProbeResult(null);
      setSmartResult(null);
      setAutoSwitchedTo(null);
      setAutoSwitchedFrom(null);
      return;
    }

    const key = makeLegacyTargetKey(cleanHost, cleanShare);
    if (inFlightProbeRef.current?.key === key || completedProbeRef.current?.key === key) {
      return;
    }

    setProbeResult(null);
    setSmartResult(null);
    setAutoSwitchedTo(null);
    setAutoSwitchedFrom(null);

    if (probeTimerRef.current !== null) {
      window.clearTimeout(probeTimerRef.current);
    }
    probeTimerRef.current = window.setTimeout(() => {
      probeTimerRef.current = null;
      void runLegacyShareAuthProbe(cleanHost, cleanShare);
    }, 650);

    return () => {
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
    };
  }, [legacyStep, clientConfig.targetHost, clientConfig.shareName, runLegacyShareAuthProbe]);

  const handleSelectPeerShare = (peer: DiscoveredPeer, shareName: string) => {
    setClientValidationError(null);
    setAutoSwitchedTo(null);
    setAutoSwitchedFrom(null);
    const exactCode = peer.shareCodes?.[shareName];
    if (exactCode) {
      handleCodeChange(exactCode);
      return;
    }
    setRawCodeInput('');
    setCodeParseState('empty');
    const targetHost = peer.ipAddress;
    const resolved = resolveClientAccountCredentials({
      targetHost,
      hostCandidates: getHostCandidates(targetHost, [peer.hostName]),
      shareName,
      requireAccountOnly: peer.authModeHint === 'account',
      portableShares,
      activeShares: shares,
    });
    const authMode = peer.authModeHint === 'account' || resolved?.authMode === 'account' ? 'account' : 'guest';
    const nextCfg: ClientTargetConfig = {
      ...clientConfigRef.current,
      targetHost,
      shareName,
      authMode,
      username: authMode === 'account' ? resolved?.username || 'AhBiShare' : '',
      password: authMode === 'account' ? resolved?.password || '' : '',
    };
    clientConfigRef.current = nextCfg;
    setClientConfig(nextCfg);
    void runLegacyShareAuthProbe(targetHost, shareName);
  };

  const handleCopyHostGuestCmd = useCallback(async () => {
    const cmd = buildHostGuestUnlockPsCommand(clientConfigRef.current.shareName);
    const ok = await copyTextWithFallback(cmd);
    if (ok) {
      if (hostCmdTimerRef.current !== null) {
        window.clearTimeout(hostCmdTimerRef.current);
      }
      setHostCmdCopied(true);
      hostCmdTimerRef.current = window.setTimeout(() => {
        setHostCmdCopied(false);
        hostCmdTimerRef.current = null;
      }, 2000);
      onNotify?.('호스트 원클릭 복구 명령을 클립보드에 복사했습니다.');
    } else {
      onNotify?.('클립보드 복사에 실패했습니다. 통합 해결 가이드를 열어 복사하세요.');
    }
  }, [onNotify]);

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    const hostErr = validateTargetHost(clientConfig.targetHost);
    if (hostErr) {
      setClientValidationError(hostErr);
      return;
    }
    const shareErr = validateShareName(clientConfig.shareName);
    if (shareErr) {
      setClientValidationError(shareErr);
      return;
    }

    const targetKey = makeLegacyTargetKey(clientConfig.targetHost, clientConfig.shareName);
    const hasValidAbshareToken =
      rawCodeInput.trim().startsWith('ABSHARE://') && codeParseState === 'valid';
    if (
      clientConfig.authMode === 'guest' &&
      autoSwitchEnabled &&
      !suppressedAutoSwitchKeysRef.current.has(targetKey) &&
      !shareBridge.isSmartAuthSuppressed(clientConfig.targetHost, clientConfig.shareName) &&
      !hasValidAbshareToken
    ) {
      let preProbe: ShareAuthProbeResult | null = null;
      if (inFlightProbeRef.current?.key === targetKey) {
        preProbe = await inFlightProbeRef.current.promise;
      } else if (completedProbeRef.current?.key !== targetKey) {
        preProbe = await runLegacyShareAuthProbe(clientConfig.targetHost, clientConfig.shareName);
      }
      if (preProbe && (preProbe.verdict === 'account_required' || preProbe.verdict === 'host_guest_denied')) {
        setClientValidationError(
          '대상 공유폴더가 보안 계정 인증을 요구해 보안 계정 모드로 자동 전환했습니다. 아이디·암호를 확인한 뒤 다시 연결하세요.'
        );
        return;
      }
    }

    if (clientConfig.authMode === 'account') {
      if (!clientConfig.username.trim()) {
        setClientValidationError('보안 계정 연결 모드에서는 사용자 ID를 입력하세요.');
        return;
      }
      if (!clientConfig.password) {
        setClientValidationError('보안 계정 연결 모드에서는 접속 암호를 입력하세요.');
        return;
      }
    }
    setClientValidationError(null);
    setRebootFeedback(null);
    setConfirmingReboot(false);
    void onConnectLegacyClient(clientConfig, targetOs);
  };

  // Preserved legacy patch / script / reboot handlers
  const handleToggleScriptSmb1 = () => {
    if (includeSmb1Script) {
      setIncludeSmb1Script(false);
      setScriptSmb1GateOpen(false);
    } else {
      setScriptSmb1GateOpen((prev) => !prev);
    }
  };

  const handleRunPatch = async (mode: PolicyPatchMode) => {
    setRebootFeedback(null);
    setConfirmingReboot(false);
    await onApplyPatch(mode);
  };

  const handleRunInspect = async () => {
    setRebootFeedback(null);
    setConfirmingReboot(false);
    await onInspectPolicy();
  };

  const handleConfirmLegacySmb1Patch = async () => {
    if (!smb1RiskAccepted) return;
    setSmb1StepOpen(false);
    setSmb1RiskAccepted(false);
    await handleRunPatch('legacy_smb1_enable');
  };

  const handleExportKit = async () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      const res = await onExportBundle(scriptBundle);
      setExportStatus({ success: res.success, message: res.message });
      if (res.mode === 'web-download') {
        scriptBundle.files.forEach((file, idx) => {
          window.setTimeout(() => {
            triggerSingleDownload(file.name, file.content);
          }, idx * 160);
        });
        onNotify?.(`웹 미리보기: 적용·원복 .bat/.reg ${scriptBundle.files.length}종 파일 다운로드를 시작했습니다.`);
      } else {
        onNotify?.(res.message);
      }
    } catch {
      const fallbackMsg = '스크립트 패키지 저장 중 오류가 발생했습니다.';
      setExportStatus({ success: false, message: fallbackMsg });
      onNotify?.(fallbackMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmReboot = async () => {
    setIsRebooting(true);
    setRebootFeedback(null);
    try {
      const res = await onTriggerReboot();
      setRebootFeedback(res.message);
    } finally {
      setIsRebooting(false);
      setConfirmingReboot(false);
    }
  };

  const scrollToUsbKit = () => {
    document.getElementById('legacy-script-generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const latestShare = shares[0] || null;
  const activePortableEntry =
    portableShares.length > 0
      ? portableShares[Math.min(selectedPortableIdx, portableShares.length - 1)]
      : null;
  const isRemotePortable =
    Boolean(activePortableEntry && netInfo.hostname) &&
    (activePortableEntry?.sourceHostName || '').trim().toLowerCase() !== netInfo.hostname.trim().toLowerCase();
  const currentEntryKey = activePortableEntry
    ? `${activePortableEntry.sourceHostName}::${activePortableEntry.shareName}::${activePortableEntry.updatedAt}`
    : null;
  const isPortableApplied = Boolean(currentEntryKey && portableAppliedKey === currentEntryKey);

  const judgment = lastPatchResult?.rebootJudgment;
  const smb1ActiveOnLocal = Boolean(policyStatus?.smb1Enabled || policyStatus?.smb1ServerEnabled);
  const smbEncryptionBlocking = Boolean(policyStatus?.smbEncryptData || policyStatus?.smbRejectUnencryptedAccess);

  return (
    <div className="space-y-8">
      {/* Top Control Frame: Topology & Target OS Switcher + 2-Step Main/Client Role Switcher + Telemetry */}
      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">구형 OS 호환 공유 센터</span>
              <span aria-hidden="true">·</span>
              <span>Windows 7 · 8 · 8.1 ⇄ Windows 10 · 11</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                현재 PC: {policyStatus?.osProductName || netInfo.osProductName || 'Windows'} (
                {formatEraShortLabel(currentEra, currentBuild, currentDisp)})
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              구형 Windows(7·8·8.1) ↔ 최신 Windows(10·11) 2단계 원클릭 공유
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
              상단에서 연결 토폴로지를 선택한 뒤 <strong>1단계 메인 PC(개설)</strong>와 <strong>2단계 클라이언트 PC(접속)</strong> 탭에서 각각 브릿지 패치와 실제 공유·연결을 원클릭으로 한 번에 실행하세요.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                id="btn-refresh-legacy"
                type="button"
                disabled={isBusy || isScanning}
                onClick={() => void onRefresh()}
                className="px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                {isRefreshing ? '새로고침 중...' : '새로고침'}
              </button>
            )}
            <button
              id="btn-inspect-legacy-bridge"
              type="button"
              disabled={isBusy}
              onClick={() => void handleRunInspect()}
              className="px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
              {isInspecting ? '브릿지 상태 점검 중...' : '현재 PC 호환 상태 재검사'}
            </button>
          </div>
        </div>

        {/* Target OS + Bidirectional Topology Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">상대 구형 OS 선택</div>
            <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <button
                id="btn-legacy-os-win7"
                type="button"
                onClick={() => setTargetOs('win7')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  targetOs === 'win7'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Windows 7 SP1 (NT 6.1 · SMB 2.1)
              </button>
              <button
                id="btn-legacy-os-win8"
                type="button"
                onClick={() => setTargetOs('win8_81')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  targetOs === 'win8_81'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Windows 8 / 8.1 (NT 6.2/6.3 · SMB 3.0)
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">공유 토폴로지 (메인 ➔ 클라이언트 방향)</div>
            <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {[
                { id: 'bidirectional' as LegacyDirection, label: '양방향 공유 (권장)' },
                { id: 'modern_to_legacy' as LegacyDirection, label: 'Win 10·11(메인) ➔ Win 7·8.1(클라)' },
                { id: 'legacy_to_modern' as LegacyDirection, label: 'Win 7·8.1(메인) ➔ Win 10·11(클라)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  id={`btn-legacy-dir-${opt.id}`}
                  type="button"
                  onClick={() => setDirection(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    direction === opt.id
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2-Step Main / Client Tab Switcher (Workspace parity) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
            <button
              id="btn-legacy-step-host"
              type="button"
              onClick={() => setLegacyStep('host')}
              className={`px-4 py-2 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                legacyStep === 'host'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5 shrink-0" />
              <span>1단계 · 메인 PC (개설)</span>
            </button>
            <button
              id="btn-legacy-step-client"
              type="button"
              onClick={() => setLegacyStep('client')}
              className={`px-4 py-2 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                legacyStep === 'client'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 shrink-0" />
              <span>2단계 · 클라이언트 PC (접속)</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {legacyStep === 'host'
              ? `1단계 역할: ${direction === 'legacy_to_modern' ? `${legacyOsShort} 측 공유 개설 + USB 4종 키트 전달` : '현재 PC 브릿지 정렬 + 공유폴더 개설'}`
              : `2단계 역할: ${direction === 'modern_to_legacy' ? `${legacyOsShort} 측 USB 키트 실행 + UNC 접속` : '현재 PC 브릿지 정렬 + 드라이브 연결'}`}
          </div>
        </div>

        {/* Live Telemetry Cards */}
        {policyStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">SMB 2.x/3.x</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.smb2Enabled === false
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.smb2Enabled === false ? '비활성 (오류 위험)' : '활성 (SMB 2.1+ 호환)'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">SMB 전송 암호화</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.smbEncryptData
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.smbEncryptData ? '강제됨 (Win 7 거부)' : '선택적 (Win 7 호환)'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">비암호화 접근 허용</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.smbRejectUnencryptedAccess
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.smbRejectUnencryptedAccess ? '차단됨 (0x80070035)' : '허용됨 (정상)'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">SMB 서명 · 게스트</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.smbServerSigningRequired ||
                    policyStatus.smbClientSigningRequired ||
                    !policyStatus.allowInsecureGuestAuth
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.smbClientSigningRequired ? '서명 강제' : '서명 완화'} ·{' '}
                  {policyStatus.allowInsecureGuestAuth ? '게스트 허용' : '차단'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">NTLM 협상 수준</div>
                <div
                  className={`mt-1 tabular-nums font-bold ${
                    policyStatus.lmCompatibilityLevel !== null && policyStatus.lmCompatibilityLevel < 3
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.lmCompatibilityLevel !== null ? `Lm=${policyStatus.lmCompatibilityLevel}` : 'NTLMv2 기본'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">SMB 1.0 (레거시)</div>
                <div
                  className={`mt-1 font-bold ${
                    smb1ActiveOnLocal
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {smb1ActiveOnLocal ? '활성됨 (원복 권장)' : '비활성 (안전)'}
                </div>
              </div>
            </div>

            <p
              id="legacy-direction-guidance"
              className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5 leading-relaxed"
            >
              <strong className="text-indigo-700 dark:text-indigo-300">토폴로지 맞춤 안내:</strong> {directionSummaryText}
            </p>

            {legacyBlockingIssues.length > 0 ? (
              <div className="p-4 rounded-xl border border-amber-500/35 bg-amber-500/10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    현재 PC와 {targetOs === 'win7' ? 'Windows 7' : 'Windows 8 / 8.1'} 공유 시 차단 요인 ({legacyBlockingIssues.length}건 · 아래 통합 원클릭 시 자동 해소)
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200 pl-6 list-disc">
                  {legacyBlockingIssues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  선택된 토폴로지에서 현재 PC는 SMB 1.0 없이도 {legacyOsLabel}과 즉시 파일 공유가 가능한 브릿지 상태입니다.
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ==================== STEP 1: MAIN HOST WORKFLOW ==================== */}
      {legacyStep === 'host' && (
        <div className="space-y-8">
          {direction === 'legacy_to_modern' && (
            <div className="p-4 rounded-xl border border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-700 dark:text-slate-200 space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  현재 선택된 토폴로지: {legacyOsShort} PC가 메인(폴더 제공) · 현재 Win 10·11 PC가 클라이언트입니다
                </div>
                <p>
                  구형 PC에서 공유폴더를 열려면 아래 USB 4종 키트의 <code className="font-mono">AhBiShare_Legacy_Apply.bat</code>를 먼저 실행한 뒤, [2단계 · 클라이언트 PC] 탭에서 연결하세요.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={scrollToUsbKit}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  USB 4종 키트 보기
                </button>
                <button
                  type="button"
                  onClick={() => setLegacyStep('client')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  2단계 클라이언트로 이동
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={handleHostSubmit}
              className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-6"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">1단계 · 메인 PC (개설)</span>
                  <span aria-hidden="true">·</span>
                  <span>대상: {legacyOsLabel}</span>
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  구형 OS 호환 브릿지 + 메인 PC 공유폴더 통합 원클릭 개설
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  사전 보안 스냅샷 백업 → SMB 2.1/3.0 비암호화 호환 브릿지 정렬 → 방화벽 TCP 445·139 개방 → 폴더 공유 및 <code className="font-mono">ABSHARE://</code> 코드 발급을 한 번에 완료합니다.
                </p>
                <p className="tabular-nums text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  현재 호스트: {netInfo.hostname} · LAN IP: {netInfo.primaryIp} · {netInfo.adapterName}
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label htmlFor="legacy-host-folder" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    공유할 로컬 폴더 경로
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="legacy-host-folder"
                      type="text"
                      value={hostConfig.folderPath}
                      onChange={(e) => setHostConfig({ ...hostConfig, folderPath: e.target.value })}
                      placeholder="C:\AhBiShared"
                      className="flex-1 min-w-0 px-3.5 py-2.5 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleBrowseFolder()}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4" />
                      폴더 선택
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="legacy-host-share-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      네트워크 공유 이름
                    </label>
                    <input
                      id="legacy-host-share-name"
                      type="text"
                      value={hostConfig.shareName}
                      onChange={(e) => {
                        setShareNameCustomized(Boolean(e.target.value.trim()));
                        setHostValidationError(null);
                        setHostConfig({ ...hostConfig, shareName: e.target.value });
                      }}
                      placeholder="AhBiShared"
                      className="w-full px-3.5 py-2.5 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      폴더 접근 권한
                    </span>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setHostConfig({ ...hostConfig, permission: 'full' })}
                        className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          hostConfig.permission === 'full'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        전체 권한 (쓰기)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHostConfig({ ...hostConfig, permission: 'read' })}
                        className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          hostConfig.permission === 'read'
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
                        setHostValidationError(null);
                        setHostConfig({ ...hostConfig, authMode: 'guest' });
                      }}
                      className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                        hostConfig.authMode === 'guest'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      간편 무비밀번호 (Guest / Everyone)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHostValidationError(null);
                        setHostConfig({ ...hostConfig, authMode: 'account' });
                      }}
                      className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                        hostConfig.authMode === 'account'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      보안 계정 (전용 ID · PW + cmdkey)
                    </button>
                  </div>
                </div>

                {hostConfig.authMode === 'account' && (
                  <div className="space-y-3 pt-1">
                    <PresetPasswordGrid
                      currentUsername={hostConfig.username}
                      currentPassword={hostConfig.password}
                      onSelectPreset={(username, password) => {
                        setHostValidationError(null);
                        setHostConfig((prev) => ({
                          ...prev,
                          username,
                          password,
                        }));
                      }}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label htmlFor="legacy-host-acc-user" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          전용 계정 ID
                        </label>
                        <input
                          id="legacy-host-acc-user"
                          type="text"
                          value={hostConfig.username}
                          onChange={(e) => {
                            setHostValidationError(null);
                            setHostConfig({ ...hostConfig, username: e.target.value });
                          }}
                          className="w-full px-3.5 py-2 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="legacy-host-acc-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          접속 암호
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            id="legacy-host-acc-pass"
                            type="text"
                            value={hostConfig.password}
                            onChange={(e) => {
                              setHostValidationError(null);
                              setHostConfig({ ...hostConfig, password: e.target.value });
                            }}
                            className="flex-1 min-w-0 px-3.5 py-2 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setHostValidationError(null);
                              setHostConfig({ ...hostConfig, password: generateSecureSharePassword(10) });
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
                      공유 자동 만료 타이머
                    </span>
                    {(hostConfig.ttlMinutes || 0) > 0 && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(hostConfig.autoRevokeOnExpiry)}
                          onChange={(e) => setHostConfig({ ...hostConfig, autoRevokeOnExpiry: e.target.checked })}
                          className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        만료 시 공유폴더 자동 해제
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                    {TTL_PRESETS.map((preset) => {
                      const active = (hostConfig.ttlMinutes || 0) === preset.minutes;
                      return (
                        <button
                          key={preset.minutes}
                          type="button"
                          onClick={() => setHostConfig({ ...hostConfig, ttlMinutes: preset.minutes })}
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
                </div>
              </div>

              {hostValidationError && (
                <div
                  role="alert"
                  className="px-4 py-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-xs font-medium text-red-700 dark:text-red-300"
                >
                  {hostValidationError}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400 truncate">
                  UNC 경로: \\{netInfo.primaryIp}\{hostConfig.shareName.trim() || 'AhBiShared'}
                </span>
                <button
                  id="btn-legacy-host-oneclick"
                  type="submit"
                  disabled={isBusy}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  {isHostExecuting ? '브릿지·공유 통합 개설 중...' : '구형 호환 브릿지 + 공유폴더 통합 원클릭 개설'}
                </button>
              </div>
            </form>

            {/* Right Column: Latest Share Code / QR + Integrated Host Pipeline Tracker */}
            <div className="lg:col-span-5 space-y-6">
              {latestShare && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                        2단계 연결 전달용 코드 ({latestShare.shareName})
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {legacyOsShort} 또는 2단계 클라이언트 PC에서 아래 UNC 경로·연결 코드를 사용해 즉시 접속합니다.
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

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-24 overflow-y-auto space-y-1">
                    <div className="tabular-nums text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      {latestShare.uncPath}
                    </div>
                    <p className="tabular-nums text-xs text-slate-700 dark:text-slate-300 break-all select-all">
                      {latestShare.connectionCode}
                    </p>
                  </div>

                  {qrTarget && qrTarget.shareName === latestShare.shareName && (
                    <div className="flex flex-col items-center py-3 bg-white rounded-lg border border-slate-200">
                      <QRCodeSVG value={latestShare.connectionCode} size={148} />
                      <span className="mt-2 tabular-nums text-xs text-slate-600">{latestShare.uncPath}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleCodeChange(latestShare.connectionCode);
                        setLegacyStep('client');
                      }}
                      className="px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg whitespace-nowrap cursor-pointer"
                    >
                      2단계 클라이언트로 전달 →
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyText(
                          latestShare.connectionCode,
                          latestShare.shareName,
                          `'${latestShare.shareName}' 연결 코드를 복사했습니다.`
                        )
                      }
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedId === latestShare.shareName ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedId === latestShare.shareName ? '복사됨' : '연결 코드 복사'}
                    </button>
                  </div>
                </div>
              )}

              <PipelineTracker
                title="1단계 구형 호환 메인 통합 파이프라인"
                steps={hostSteps}
                isRunning={isHostExecuting}
              />

              {(() => {
                const failedLegacyHost = hostSteps.find((st) => st.status === 'error' && st.error);
                if (!failedLegacyHost || !onOpenTroubleshootWizard) return null;
                return (
                  <div
                    id="legacy-host-failure-wizard-banner"
                    role="alert"
                    className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2"
                  >
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      구형 OS 공유 개설 오류 · 단계별 해결 마법사 준비됨
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      {failedLegacyHost.error}
                    </p>
                    <button
                      id="btn-legacy-host-failure-open-wizard"
                      type="button"
                      onClick={onOpenTroubleshootWizard}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      단계별 해결 마법사 열기
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Active Shared Folders Table */}
          <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                활성 공유폴더 목록 ({shares.length})
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                개설된 공유폴더는 기본 워크스페이스와 실시간 연동됩니다
              </span>
            </div>

            {shares.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  개설된 공유폴더가 없습니다. 위에서 폴더를 지정하고 [구형 호환 브릿지 + 공유폴더 통합 원클릭 개설]을 실행하세요.
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
                      return (
                        <tr key={share.shareName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-6 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {share.shareName}
                          </td>
                          <td className="py-3 px-4 tabular-nums text-xs text-slate-600 dark:text-slate-300">
                            <div>{share.folderPath}</div>
                            <div className="text-slate-400">{share.uncPath}</div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {share.authMode === 'guest' ? '무비밀번호' : `보안(${share.username})`} ·{' '}
                            {share.permission === 'full' ? '전체 권한' : '읽기 전용'}
                          </td>
                          <td className="py-3 px-4 tabular-nums text-xs whitespace-nowrap">
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
                                onClick={() =>
                                  void handleCopyText(
                                    share.connectionCode,
                                    `row-${share.shareName}`,
                                    `'${share.shareName}' 연결 코드를 복사했습니다.`
                                  )
                                }
                                className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-md cursor-pointer"
                              >
                                {copiedId === `row-${share.shareName}` ? '복사 완료' : '코드 복사'}
                              </button>
                              <button
                                type="button"
                                disabled={!uncTarget}
                                onClick={() => {
                                  if (uncTarget) void onOpenPath(uncTarget);
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
                                onClick={() => void onOpenPath(share.folderPath)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer"
                                title="로컬 폴더 열기"
                                aria-label={`${share.shareName} 로컬 폴더 열기`}
                              >
                                <FolderOpen className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void onRemoveShare(share.shareName)}
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
      )}

      {/* ==================== STEP 2: CLIENT CONNECT WORKFLOW ==================== */}
      {legacyStep === 'client' && (
        <div className="space-y-8">
          {direction === 'modern_to_legacy' && (
            <div className="p-4 rounded-xl border border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-700 dark:text-slate-200 space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  현재 선택된 토폴로지: 최신 PC(메인) ➔ 구형 {legacyOsShort} PC(클라이언트)
                </div>
                <p>
                  {latestShare
                    ? `1단계에서 개설한 '${latestShare.uncPath}'에 구형 PC가 접속할 수 있도록, 구형 PC에서 USB 4종 키트(AhBiShare_Legacy_Apply.bat)를 실행한 뒤 위 경로로 연결하세요.`
                    : `먼저 [1단계 · 메인 PC]에서 공유폴더를 개설하고, 구형 ${legacyOsShort} 클라이언트 PC에서는 아래 USB 4종 키트를 실행하세요.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {latestShare && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyText(
                        latestShare.uncPath,
                        'unc-step2',
                        `${latestShare.uncPath} 경로를 복사했습니다.`
                      )
                    }
                    className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    {copiedId === 'unc-step2' ? '경로 복사됨' : `${latestShare.uncPath} 복사`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={scrollToUsbKit}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  USB 4종 키트 저장
                </button>
              </div>
            </div>
          )}

          {activePortableEntry && !bannerDismissed && (
            <section
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
                        ? 'USB에서 다른 PC의 공유 데이터가 감지되었습니다'
                        : 'USB 포터블 저장소의 공유 데이터가 감지되었습니다'}
                    </h3>
                    {portableStatus?.fileName && (
                      <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
                        · {portableStatus.fileName}
                      </span>
                    )}
                  </div>
                  <p className="tabular-nums text-xs text-slate-700 dark:text-slate-300 break-all">
                    원본 PC: {activePortableEntry.sourceHostName || '-'} ·{' '}
                    {activePortableEntry.uncPath || `\\\\${activePortableEntry.sourceIp}\\${activePortableEntry.shareName}`}
                  </p>
                  {portableShares.length > 1 && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <select
                        aria-label="USB 저장 공유 항목 선택"
                        value={selectedPortableIdx}
                        onChange={(e) => {
                          setSelectedPortableIdx(Number(e.target.value));
                          setPortableAppliedKey(null);
                        }}
                        className="px-2.5 py-1 text-xs tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {portableShares.map((entry, idx) => (
                          <option key={`${entry.sourceHostName}-${entry.shareName}-${idx}`} value={idx}>
                            {entry.sourceHostName || entry.sourceIp} · \\{entry.sourceIp}\{entry.shareName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {isPortableApplied && (
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      연결 정보가 아래 입력 폼에 채워졌습니다.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => applyPortableEntry(activePortableEntry)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isPortableApplied ? '다시 채우기' : '원클릭 자동 채우기'}
                </button>
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  aria-label="USB 감지 배너 닫기"
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              {/* Connection Code + LAN Auto Discovery */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">2단계 · 클라이언트 PC (접속)</span>
                      <span aria-hidden="true">·</span>
                      <span>연결 코드 / LAN 탐색</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      대상 PC 선택 및 구형 호환 원클릭 드라이브 연결
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onScanLan()}
                    disabled={isScanning || isRefreshing}
                    className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Radar className={`w-4 h-4 ${isScanning ? 'animate-spin text-indigo-500' : ''}`} />
                    {isScanning ? 'LAN 스캔 중...' : 'LAN PC 자동 탐색'}
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label htmlFor="legacy-client-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    연결 코드 또는 UNC 경로 붙여넣기 (ABSHARE://... 또는 \\IP\공유명)
                  </label>
                  <input
                    id="legacy-client-code"
                    type="text"
                    value={rawCodeInput}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="ABSHARE://... 또는 \\192.168.0.x\공유폴더"
                    className="w-full px-3.5 py-2.5 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {codeParseState === 'valid' && (
                    <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      확인 완료 · \\{clientConfig.targetHost}\{clientConfig.shareName} (
                      {rawCodeInput.trim().startsWith('ABSHARE://')
                        ? clientConfig.authMode === 'account'
                          ? '보안 계정 포함'
                          : '무비밀번호 모드'
                        : clientConfig.authMode === 'account'
                          ? '보안 계정 모드'
                          : '무비밀번호 모드'}
                      )
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
                      공유 폴더 클릭 시 자동 입력
                    </span>
                  </div>

                  {peers.length === 0 ? (
                    <div className="py-5 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        감지된 SMB(445) 호스트가 없습니다. [LAN PC 자동 탐색]을 누르거나 아래에 {legacyOsShort} IP를 직접 입력하세요.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                            <th className="py-2.5 px-3">PC / IP 주소</th>
                            <th className="py-2.5 px-3">공유 폴더 선택</th>
                            <th className="py-2.5 px-3 text-right">응답</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {peers.map((peer) => (
                            <tr key={peer.ipAddress} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 align-top">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{peer.hostName}</div>
                                <div className="tabular-nums text-slate-500 dark:text-slate-400">
                                  {peer.ipAddress}
                                  {peer.authModeHint === 'account' && (
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                      {' '}· 계정 인증 추정
                                    </span>
                                  )}
                                  {peer.authModeHint === 'guest' && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                      {' '}· 무비밀번호 응답
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {peer.availableShares.length > 0 ? (
                                    peer.availableShares.map((sh) => {
                                      const isSelected =
                                        clientConfig.targetHost === peer.ipAddress && clientConfig.shareName === sh;
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
                              <td className="py-2.5 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
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

              {/* Client Connect Form */}
              <form
                onSubmit={handleClientSubmit}
                className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="legacy-client-host" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      대상 메인 PC IP 또는 이름
                    </label>
                    <input
                      id="legacy-client-host"
                      type="text"
                      value={clientConfig.targetHost}
                      onChange={(e) => {
                        setClientValidationError(null);
                        if (rawCodeInput) {
                          setRawCodeInput('');
                          setCodeParseState('empty');
                        }
                        const rawVal = e.target.value;
                        const uncMatch = rawVal.trim().replace(/\//g, '\\').match(/^\\\\([^\\]+)\\([^\\]+)/);
                        if (uncMatch) {
                          setClientConfig({
                            ...clientConfig,
                            targetHost: uncMatch[1].trim(),
                            shareName: uncMatch[2].trim(),
                          });
                        } else {
                          setClientConfig({ ...clientConfig, targetHost: rawVal });
                        }
                      }}
                      onBlur={() => {
                        const key = makeLegacyTargetKey(clientConfig.targetHost, clientConfig.shareName);
                        if (inFlightProbeRef.current?.key !== key && completedProbeRef.current?.key !== key) {
                          void runLegacyShareAuthProbe(clientConfig.targetHost, clientConfig.shareName);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="legacy-client-share" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      공유 폴더 이름
                    </label>
                    <input
                      id="legacy-client-share"
                      type="text"
                      value={clientConfig.shareName}
                      onChange={(e) => {
                        setClientValidationError(null);
                        if (rawCodeInput) {
                          setRawCodeInput('');
                          setCodeParseState('empty');
                        }
                        setClientConfig({ ...clientConfig, shareName: e.target.value });
                      }}
                      onBlur={() => {
                        const key = makeLegacyTargetKey(clientConfig.targetHost, clientConfig.shareName);
                        if (inFlightProbeRef.current?.key !== key && completedProbeRef.current?.key !== key) {
                          void runLegacyShareAuthProbe(clientConfig.targetHost, clientConfig.shareName);
                        }
                      }}
                      className="w-full px-3.5 py-2 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="legacy-client-drive" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      연결 드라이브 문자
                    </label>
                    <select
                      id="legacy-client-drive"
                      value={clientConfig.driveLetter}
                      onChange={(e) => setClientConfig({ ...clientConfig, driveLetter: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {driveLetterOptions.map((dl) => (
                        <option key={dl} value={dl}>
                          {dl} 드라이브{mountedSet.has(dl) ? ' (연결됨)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <ShareAuthProbeBar
                    idPrefix="legacy-client"
                    probeResult={probeResult}
                    smartResult={smartResult}
                    isProbing={isProbingAuth}
                    autoSwitchEnabled={autoSwitchEnabled}
                    autoSwitchedTo={autoSwitchedTo}
                    currentAuthMode={clientConfig.authMode}
                    targetHost={clientConfig.targetHost}
                    shareName={clientConfig.shareName}
                    disabled={isBusy}
                    onToggleAutoSwitch={handleToggleAutoSwitch}
                    onManualProbe={() => {
                      void runLegacyShareAuthProbe(clientConfig.targetHost, clientConfig.shareName, { manual: true });
                    }}
                    onSwitchToAccount={() => {
                      setAutoSwitchedTo(null);
                      setAutoSwitchedFrom(null);
                      switchToAccountMode(clientConfig.targetHost, clientConfig.shareName);
                    }}
                    onSwitchToGuest={() => {
                      setAutoSwitchedTo(null);
                      setAutoSwitchedFrom(null);
                      setClientValidationError(null);
                      setClientConfig((prev) => ({ ...prev, authMode: 'guest' }));
                    }}
                    onUndoAutoSwitch={() => {
                      const key = makeLegacyTargetKey(clientConfig.targetHost, clientConfig.shareName);
                      suppressedAutoSwitchKeysRef.current.add(key);
                      shareBridge.setSmartAuthSuppressed(clientConfig.targetHost, clientConfig.shareName, true);
                      if (autoSwitchedFrom) {
                        setClientConfig((prev) => ({ ...prev, authMode: autoSwitchedFrom }));
                      }
                      setAutoSwitchedTo(null);
                      setAutoSwitchedFrom(null);
                      setClientValidationError(null);
                    }}
                    onOpenMatrix={onOpenMatrix}
                    onCopyHostGuestCmd={() => {
                      void handleCopyHostGuestCmd();
                    }}
                    hostCmdCopied={hostCmdCopied}
                  />
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setClientValidationError(null);
                        setAutoSwitchedTo(null);
                        setAutoSwitchedFrom(null);
                        setClientConfig({ ...clientConfig, authMode: 'guest' });
                      }}
                      className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                        clientConfig.authMode === 'guest'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      무비밀번호 (Win7·11 게스트/서명 자동 정렬)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoSwitchedTo(null);
                        setAutoSwitchedFrom(null);
                        switchToAccountMode();
                      }}
                      className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                        clientConfig.authMode === 'account'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      보안 계정 (cmdkey 자동 등록)
                    </button>
                  </div>

                  {clientConfig.authMode === 'account' && (
                    <div className="space-y-3 pt-1">
                      <PresetPasswordGrid
                        currentUsername={clientConfig.username}
                        currentPassword={clientConfig.password}
                        onSelectPreset={(username, password) => {
                          setClientValidationError(null);
                          setClientConfig((prev) => ({
                            ...prev,
                            username,
                            password,
                          }));
                        }}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                          id="legacy-client-acc-user"
                          aria-label="공유 접속 계정 ID"
                          type="text"
                          value={clientConfig.username}
                          onChange={(e) => {
                            setClientValidationError(null);
                            setClientConfig({ ...clientConfig, username: e.target.value });
                          }}
                          placeholder="사용자 ID (예: AhBiShare)"
                          className="w-full px-3.5 py-2 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="relative">
                          <input
                            id="legacy-client-acc-pass"
                            aria-label="공유 계정 암호"
                            type={showLegacyClientPass ? 'text' : 'password'}
                            value={clientConfig.password}
                            onChange={(e) => {
                              setClientValidationError(null);
                              setClientConfig({ ...clientConfig, password: e.target.value });
                            }}
                            placeholder="공유 계정 암호"
                            className="w-full px-3.5 py-2 pr-10 text-sm tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLegacyClientPass(!showLegacyClientPass)}
                            aria-label={showLegacyClientPass ? '비밀번호 숨기기' : '비밀번호 표시'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showLegacyClientPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {clientValidationError && (
                  <div
                    role="alert"
                    className="px-4 py-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-xs font-medium text-red-700 dark:text-red-300"
                  >
                    {clientValidationError}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientConfig.persistent}
                      onChange={(e) => setClientConfig({ ...clientConfig, persistent: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    재부팅 후에도 드라이브 연결 유지
                  </label>

                  <button
                    id="btn-legacy-client-oneclick"
                    type="submit"
                    disabled={isBusy}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    <Link2 className="w-4 h-4 shrink-0" />
                    {isClientConnecting ? '브릿지·드라이브 연결 중...' : '구형 호환 브릿지 + 드라이브 통합 원클릭 연결'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Integrated Client Pipeline + Diagnostics */}
            <div className="lg:col-span-5 space-y-4">
              <PipelineTracker
                title="2단계 구형 호환 클라이언트 통합 파이프라인"
                steps={clientSteps}
                isRunning={isClientConnecting}
              />

              {(() => {
                const failedStep = clientSteps.find((st) => st.status === 'error' && st.error);
                const diag = failedStep ? classifyFailureDiagnostics(failedStep.error) : null;
                if (!diag) return null;
                return (
                  <div
                    role="alert"
                    className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        연결 실패 처방 가이드 · {diag.title}
                      </span>
                      <span className="tabular-nums text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        {diag.code}
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{diag.detail}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {diag.isHostAuthOrGuestIssue ? (
                        <>
                          {onOpenDiagnostics && (
                            <button
                              id="btn-legacy-failure-open-diag"
                              type="button"
                              onClick={() => onOpenDiagnostics(failedStep?.error)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer shadow-sm"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              통합 해결 가이드 & 도구 열기
                            </button>
                          )}
                          <button
                            id="btn-legacy-failure-switch-account"
                            type="button"
                            onClick={switchToAccountMode}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 rounded-lg cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            보안 계정 모드로 즉시 전환
                          </button>
                          <button
                            id="btn-legacy-failure-copy-host-cmd"
                            type="button"
                            onClick={() => void handleCopyHostGuestCmd()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg cursor-pointer"
                          >
                            {hostCmdCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {hostCmdCopied ? '복구 명령 복사됨!' : '호스트 원클릭 복구 명령 복사'}
                          </button>
                        </>
                      ) : (
                        onOpenMatrix && (
                          <button
                            id="btn-legacy-failure-open-matrix"
                            type="button"
                            onClick={onOpenMatrix}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            {diag.actionLabel}
                          </button>
                        )
                      )}
                      {onOpenTroubleshootWizard && (
                        <button
                          id="btn-legacy-failure-open-wizard"
                          type="button"
                          onClick={onOpenTroubleshootWizard}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer shadow-sm"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          단계별 해결 마법사 열기
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Connected Network Drives Table */}
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
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  연결된 네트워크 드라이브가 없습니다. 대상 호스트를 지정하고 [구형 호환 브릿지 + 드라이브 통합 원클릭 연결]을 실행하세요.
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
                        <td className="py-3 px-6 tabular-nums font-bold whitespace-nowrap">
                          <span
                            className={
                              m.status === 'connected'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {m.driveLetter}
                          </span>
                          {m.status === 'disconnected' && (
                            <span className="ml-2 text-[10px] font-medium text-amber-600 dark:text-amber-400">(오프라인)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-xs text-slate-700 dark:text-slate-300">{m.uncPath}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {m.authMode === 'guest' ? '간편 무비밀번호' : '보안 계정 (cmdkey)'}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {m.mountedAt}
                        </td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void onOpenPath(`${m.driveLetter}\\`)}
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
      )}

      {/* ==================== PRESERVED BRIDGE / SMB1 2-STEP / ROLLBACK GUARDRAILS ==================== */}
      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              보조 제어: 브릿지 단독 정렬 · SMB 1.0 2단계 안전장치 · 스냅샷 일괄 원복
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              상단 1·2단계 통합 원클릭에 이미 포함되는 호환 브릿지를 개별 재정렬하거나, 작업 완료 후 사전 스냅샷 기준으로 원복합니다.
            </p>
          </div>
          {rollbackSnapshot && (
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">
              원복 스냅샷 저장됨 ({rollbackSnapshot.capturedAt})
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  SMB 2.1/3.0 브릿지 단독 정렬
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                  즉시 반영
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                공유 개설/연결 없이 현재 PC의 비암호화 접근·서명 완화·NTLMv2·탐색 서비스(FDResPub) 정책만 단독으로 점검 및 정렬합니다.
              </p>
            </div>
            <button
              id="btn-apply-legacy-bridge"
              type="button"
              disabled={isBusy}
              onClick={() => void handleRunPatch('legacy_bridge_compat')}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {isApplyingMode === 'legacy_bridge_compat'
                ? 'SMB 2.1/3.0 브릿지 적용 중...'
                : smbEncryptionBlocking || legacyBlockingIssues.length > 0
                  ? '브릿지 호환 정책만 먼저 정렬'
                  : '브릿지 호환 상태 다시 정렬'}
            </button>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/35 bg-amber-500/5 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  최후 수단 · SMB 1.0 프로토콜 개방
                </span>
                <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                  2단계 확인 · 재부팅 필수
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                1·2단계 통합 실행 후에도 구형 Win 7(SMB2 비활성 환경)이나 레거시 장비가 연결되지 않을 때만 사용하세요. 작업 후 원복이 필수입니다.
              </p>
            </div>

            {smb1ActiveOnLocal ? (
              <div className="w-full py-2.5 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/35 rounded-lg text-center">
                SMB 1.0 프로토콜 활성 상태 (작업 후 우측 원복 권장)
              </div>
            ) : !smb1StepOpen ? (
              <button
                id="btn-request-legacy-smb1-step1"
                type="button"
                disabled={isBusy}
                onClick={() => setSmb1StepOpen(true)}
                className="w-full py-2.5 px-4 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 border border-amber-500/40 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                SMB 1.0 위험 확인 후 활성화
              </button>
            ) : (
              <div id="legacy-smb1-confirm-gate" className="space-y-2.5 pt-2 border-t border-amber-500/30 text-xs">
                <label className="flex items-start gap-2 text-amber-900 dark:text-amber-200 cursor-pointer leading-snug">
                  <input
                    id="chk-legacy-smb1-ack"
                    type="checkbox"
                    checked={smb1RiskAccepted}
                    onChange={(e) => setSmb1RiskAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-amber-500 text-red-600 focus:ring-red-500"
                  />
                  <span>
                    랜섬웨어(SMBv1) 취약점 및 시스템 재부팅 필요성을 확인했으며, 아래 USB 원복 스크립트를 보관했습니다.
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-confirm-legacy-smb1"
                    type="button"
                    disabled={!smb1RiskAccepted || isBusy}
                    onClick={() => void handleConfirmLegacySmb1Patch()}
                    className="flex-1 py-2 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    {isApplyingMode === 'legacy_smb1_enable' ? '설치 중...' : '재부팅 감수 SMB 1.0 활성화'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSmb1StepOpen(false);
                      setSmb1RiskAccepted(false);
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  작업 완료 · 표준 보안 원복
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                  SMB1 해제 포함
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                파일 전송 완료 후 SMB 서명 강제·게스트 차단·UAC 토큰 보호를 스냅샷 기준으로 되돌리고, SMB 1.0이 켜져 있다면 함께 비활성화합니다.
              </p>
            </div>
            <button
              id="btn-apply-legacy-rollback"
              type="button"
              disabled={isBusy}
              onClick={() => void handleRunPatch('legacy_bridge_rollback')}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              {isApplyingMode === 'legacy_bridge_rollback' ? '보안 정책 원복 중...' : '구형 OS 공유 설정 일괄 원복'}
            </button>
          </div>
        </div>

        {(judgment || policyStatus?.pendingRebootFlag) && (
          <div
            id="legacy-reboot-banner"
            className={`p-5 rounded-xl border space-y-3 ${
              judgment?.level === 'reboot_required'
                ? 'border-red-500/40 bg-red-500/10'
                : judgment?.level === 'reboot_recommended' || (!judgment && policyStatus?.pendingRebootFlag)
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-emerald-500/40 bg-emerald-500/10'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                {judgment?.rebootRecommended || (!judgment && policyStatus?.pendingRebootFlag) ? (
                  <ShieldAlert
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      judgment?.level === 'reboot_required'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    재부팅 판정: {judgment ? judgment.title : 'Windows 보류 중인 시스템 재부팅 감지됨'}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {judgment
                      ? judgment.reason
                      : '이전 기능 변경 또는 Windows Update로 인한 재부팅 대기 상태입니다.'}
                  </p>
                </div>
              </div>

              {(judgment?.canRebootNow || (!judgment && policyStatus?.pendingRebootFlag)) && (
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!confirmingReboot ? (
                    <button
                      id="btn-legacy-reboot-step1"
                      type="button"
                      onClick={() => setConfirmingReboot(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      지금 컴퓨터 재부팅
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-legacy-reboot-confirm"
                        type="button"
                        disabled={isRebooting}
                        onClick={() => void handleConfirmReboot()}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-600 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        {isRebooting ? '예약 중...' : '5초 후 재부팅 확정'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingReboot(false)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {lastPatchResult && lastPatchResult.appliedActions.length > 0 && (
              <div className="pt-2 border-t border-black/10 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                {lastPatchResult.appliedActions.map((act, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            )}

            {rebootFeedback && (
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{rebootFeedback}</p>
            )}
          </div>
        )}
      </section>

      {/* ==================== PRESERVED USB OFFLINE .BAT/.REG 4-FILE KIT GENERATOR ==================== */}
      <section
        id="legacy-script-generator"
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderOutput className="w-4 h-4 text-indigo-500 shrink-0" />
              USB 저장용 Win 7·8·8.1 적용·원복 스크립트(.bat + .reg 4종) 생성기
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PowerShell 2.0 순정 Win 7에서도 바로 실행되는 <code>reg.exe</code> · <code>netsh</code> 기반 배치 파일과 사전 백업·원복 파일 4종을 선택된 토폴로지에 맞춰 생성합니다.
            </p>
          </div>

          <button
            id="btn-export-legacy-usb"
            type="button"
            disabled={isExporting}
            onClick={() => void handleExportKit()}
            className="px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <HardDrive className="w-3.5 h-3.5" />
            {isExporting ? 'USB 패키지 저장 중...' : 'USB 폴더에 적용·원복 4종 세트 저장'}
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-2.5 cursor-not-allowed opacity-90">
              <input type="checkbox" checked readOnly className="mt-0.5 rounded border-slate-400 text-indigo-600" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  SMB 2.1/3.0 강제 활성 + NTLMv2 고정 + 방화벽 TCP 445·NetBIOS (기본 포함)
                </div>
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  한글·영문 Windows 방화벽 로케일에 상관없이 포트를 개방하고 실행 전 기존 레지스트리를 자동 백업합니다.
                </div>
              </div>
            </label>

            <label className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-2.5 cursor-pointer hover:border-indigo-400">
              <input
                type="checkbox"
                checked={includeGuestLogon}
                onChange={(e) => setIncludeGuestLogon(e.target.checked)}
                className="mt-0.5 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">무비밀번호 게스트 로그온 호환 허용</div>
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  <code>AllowInsecureGuestAuth=1</code> 및 익명 접근을 허용해 간편 공유 연결을 지원합니다.
                </div>
              </div>
            </label>

            <label className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start gap-2.5 cursor-pointer hover:border-indigo-400">
              <input
                type="checkbox"
                checked={includeUacTokenFilter}
                onChange={(e) => setIncludeUacTokenFilter(e.target.checked)}
                className="mt-0.5 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  워크그룹 관리자 원격 접속 허용 (Error 5 해결)
                </div>
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  <code>LocalAccountTokenFilterPolicy=1</code> 및 <code>EnableLinkedConnections=1</code>을 적용합니다.
                </div>
              </div>
            </label>

            <div className="p-3 rounded-lg border border-amber-500/35 bg-amber-500/5 space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  id="chk-script-smb1-state"
                  type="checkbox"
                  checked={includeSmb1Script}
                  onChange={handleToggleScriptSmb1}
                  className="mt-0.5 rounded border-amber-500 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    스크립트에 SMB 1.0 (MRxSmb10) 활성화 포함 [2단계 확인]
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                    Win 7에서 SMB2가 꺼진 특수 장비 연결 시에만 사용하세요. 원복 스크립트에도 SMB 1.0 해제가 함께 포함됩니다.
                  </div>
                </div>
              </div>

              {scriptSmb1GateOpen && !includeSmb1Script && (
                <div className="pt-2 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-amber-900 dark:text-amber-200 font-medium">
                    보안 취약점 및 Win 7 재부팅이 필요합니다. 원복 파일과 함께 포함할까요?
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      id="btn-confirm-script-smb1"
                      type="button"
                      onClick={() => {
                        setIncludeSmb1Script(true);
                        setScriptSmb1GateOpen(false);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 rounded cursor-pointer whitespace-nowrap"
                    >
                      위험 인지 · SMB 1.0 포함
                    </button>
                    <button
                      type="button"
                      onClick={() => setScriptSmb1GateOpen(false)}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDiscoveryServices}
                onChange={(e) => setIncludeDiscoveryServices(e.target.checked)}
                className="rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
              />
              <span>구형 PC 탐색용 FDResPub · fdPHost · SSDPSrv 서비스 자동 시작 포함</span>
            </label>

            {exportStatus && (
              <span
                className={`font-semibold tabular-nums ${
                  exportStatus.success
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {exportStatus.message}
              </span>
            )}
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                {scriptBundle.files.map((file, idx) => (
                  <button
                    key={file.name}
                    type="button"
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeFileIndex === idx
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    {file.format === 'bat' ? (
                      <Terminal className="w-3.5 h-3.5" />
                    ) : (
                      <FileCode2 className="w-3.5 h-3.5" />
                    )}
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyText(
                      selectedFile.content,
                      `script-${selectedFile.name}`,
                      `${selectedFile.name} 내용을 클립보드에 복사했습니다.`
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {copiedId === `script-${selectedFile.name}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedId === `script-${selectedFile.name}` ? '복사됨' : '복사'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerSingleDownload(selectedFile.name, selectedFile.content);
                    onNotify?.(`${selectedFile.name} 파일을 다운로드했습니다.`);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  이 파일 받기
                </button>
              </div>
            </div>

            <div className="bg-slate-950 text-slate-100 p-4 overflow-x-auto max-h-72">
              <pre className="font-mono text-xs leading-relaxed whitespace-pre tabular-nums">
                {selectedFile.content}
              </pre>
            </div>

            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span>
                구형 {targetOs === 'win7' ? 'Windows 7' : 'Windows 8/8.1'} PC에서{' '}
                <strong className="text-slate-900 dark:text-slate-200">AhBiShare_Legacy_Apply.bat</strong> 우클릭 → [관리자 권한으로 실행] 후 공유를 연결하고, 작업 완료 시{' '}
                <strong className="text-slate-900 dark:text-slate-200">AhBiShare_Legacy_Rollback.bat</strong>로 복원하세요.
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                사전 백업 · 원복 스크립트 자동 동반 생성
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CROSS-OS BIDIRECTIONAL DATA SYNC ==================== */}
      <section className="border border-indigo-500/30 dark:border-indigo-500/30 rounded-xl bg-indigo-500/5 dark:bg-indigo-500/5 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              Windows 10·11 ⇄ Windows 7·8 양방향 데이터 공유 브릿지
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              최신 PC(Win 10/11)에서 설정한 공유 및 드라이브 연결 데이터를 브릿지 파일(JSON)로 내보내어 레거시 앱(Win 7/8)에서 불러와서 그대로 사용하거나 양방향으로 동기화할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportBridgeJson}
              className="px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              공유 설정 브릿지 내보내기 (.json)
            </button>
            <label className="px-4 py-2.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" />
              브릿지 가져오기 및 동기화
              <input type="file" accept=".json" onChange={handleImportBridgeJson} className="hidden" />
            </label>
          </div>
        </div>
      </section>

      {/* ==================== PRESERVED CROSS-GENERATION COMPARISON MATRIX ==================== */}
      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Windows 7 · 8 · 8.1 ↔ Windows 10 · 11 공유 호환 비교 & 장애 해결 가이드 ({filteredComparisonRows.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              운영체제 세대 간 프로토콜·암호화·인증·탐색 동작 차이 및 대표 오류 코드(0x80070035, 58, 1272, 5) 해결 방법입니다.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              aria-label="호환 비교 및 장애 해결 가이드 검색"
              placeholder="암호화, 0x80070035, 58, NTLM 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 flex flex-wrap items-center gap-1.5">
          {MATRIX_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setMatrixFilter(f.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                matrixFilter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-6">비교 항목</th>
                <th className="py-3 px-4">Windows 7 (NT 6.1)</th>
                <th className="py-3 px-4">Windows 8 / 8.1 (NT 6.2/6.3)</th>
                <th className="py-3 px-4">Windows 10 · 11 (NT 10.0)</th>
                <th className="py-3 px-6">AhBiShare 해결 전략</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredComparisonRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    검색 조건에 맞는 호환 비교 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredComparisonRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 align-top">
                    <td className="py-3.5 px-6">
                      <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {row.categoryLabel}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5">{row.topic}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {row.win7Behavior}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {row.win8Behavior}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {row.win10_11Behavior}
                    </td>
                    <td className="py-3.5 px-6 text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                      {row.resolutionSummary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
