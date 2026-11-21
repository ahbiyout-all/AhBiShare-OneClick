import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Power,
  Cpu,
  Search,
  Lock,
  Sparkles,
  Wrench,
  Printer,
  ArrowLeftRight,
  KeyRound,
  HardDriveDownload,
  ExternalLink,
  Zap,
  Copy,
  ChevronDown,
  Trash2,
  Calendar,
  Clock,
  Activity,
  Usb,
} from 'lucide-react';
import {
  AutoAlignBatchResult,
  ExpertRegistryFetchResult,
  HostPolicySnapshot,
  LocalNetworkInfo,
  MountedDrive,
  OsNetworkPolicyStatus,
  PendingHostPolicyTask,
  PingHostResult,
  PolicyApplyResult,
  PolicyPatchMode,
  PortableHostShareEntry,
  RebootRequirementLevel,
  WindowsNetworkChangeItem,
  WindowsNetworkEra,
} from '@/types/share';
import {
  HOST_POLICY_REFERENCE_TARGETS,
  WINDOWS_ERA_SUMMARIES,
  WINDOWS_NETWORK_MATRIX,
  computeHostClientPolicyDiff,
  extractAutoAlignModes,
  extractHostPendingPlan,
  formatEraShortLabel,
  formatSnapshotTimestamp,
  getPolicyPatchLabel,
} from '@/services/networkEvolution';
import { shareBridge } from '@/services/shareBridge';
import { SecurityRollbackReport } from '@/components/SecurityRollbackReport';
import { ExpertComparisonView } from '@/components/ExpertComparisonView';

interface NetworkMatrixPanelProps {
  netInfo: LocalNetworkInfo;
  policyStatus: OsNetworkPolicyStatus | null;
  hostPolicySnapshots: Record<string, HostPolicySnapshot>;
  pendingHostActions?: Record<string, PendingHostPolicyTask>;
  portableShares?: PortableHostShareEntry[];
  mountedDrives?: MountedDrive[];
  activeShareCount?: number;
  activeMountCount?: number;
  lastPatchResult: PolicyApplyResult | null;
  lastAutoAlignResult?: AutoAlignBatchResult | null;
  isInspecting: boolean;
  isAutoAligning?: boolean;
  isApplyingPendingHostTask?: boolean;
  isApplyingMode: PolicyPatchMode | null;
  onInspectPolicy: () => Promise<void>;
  onApplyPatch: (mode: PolicyPatchMode) => Promise<void>;
  onSyncMatchedPolicies: (modes: PolicyPatchMode[]) => Promise<void>;
  onFullSecurityRollback?: () => Promise<{ success: boolean; message: string } | void>;
  onProbeRemoteHost?: (target: string) => Promise<PingHostResult>;
  onSavePendingHostTask?: (task: Omit<PendingHostPolicyTask, 'taskId' | 'createdAt'>) => Promise<void>;
  onDeletePendingHostTask?: (targetHostName: string) => Promise<void>;
  onApplyPendingHostTask?: (task: PendingHostPolicyTask) => Promise<void>;
  onTriggerReboot: () => Promise<{ success: boolean; message: string }>;
  onOpenWindowsUpdate: () => Promise<void>;
  onNotify?: (message: string) => void;
  onDeleteHostPolicySnapshot?: (hostName: string) => Promise<void>;
  onClearAllHostPolicySnapshots?: () => Promise<void>;
}

const CATEGORY_OPTIONS: Array<{ id: 'all' | WindowsNetworkChangeItem['category']; label: string }> = [
  { id: 'all', label: '전체 변경 항목' },
  { id: 'os_update_feature', label: '별도 패치 · 기능' },
  { id: 'smb_signing', label: 'SMB 서명' },
  { id: 'guest_auth', label: '게스트 차단' },
  { id: 'ntlm', label: 'NTLM 감축' },
  { id: 'name_resolution', label: 'NetBIOS · WINS' },
  { id: 'quic_encryption', label: 'QUIC · 암호화' },
  { id: 'firewall_lsa', label: 'LSA · 방화벽' },
  { id: 'rpc_printer', label: 'RPC · 프린터 스풀러' },
];

function rebootLevelBadge(level: RebootRequirementLevel): {
  label: string;
  badgeClass: string;
} {
  switch (level) {
    case 'none':
      return {
        label: '재부팅 불필요 (즉시 반영)',
        badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    case 'service_restart':
      return {
        label: '재부팅 불필요 (SMB 서비스 재시작)',
        badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    case 'reboot_recommended':
      return {
        label: '재부팅 권장',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      };
    case 'reboot_required':
      return {
        label: '재부팅 필수',
        badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
      };
  }
}

export const NetworkMatrixPanel: React.FC<NetworkMatrixPanelProps> = ({
  netInfo,
  policyStatus,
  hostPolicySnapshots,
  pendingHostActions = {},
  portableShares = [],
  mountedDrives = [],
  activeShareCount = 0,
  activeMountCount = 0,
  lastPatchResult,
  lastAutoAlignResult = null,
  isInspecting,
  isAutoAligning = false,
  isApplyingPendingHostTask = false,
  isApplyingMode,
  onInspectPolicy,
  onApplyPatch,
  onSyncMatchedPolicies,
  onFullSecurityRollback,
  onProbeRemoteHost,
  onSavePendingHostTask,
  onDeletePendingHostTask,
  onApplyPendingHostTask,
  onTriggerReboot,
  onOpenWindowsUpdate,
  onNotify,
  onDeleteHostPolicySnapshot,
  onClearAllHostPolicySnapshots,
}) => {
  const [selectedEra, setSelectedEra] = useState<'all' | WindowsNetworkEra>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | WindowsNetworkChangeItem['category']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingReboot, setConfirmingReboot] = useState(false);
  const [confirmingSmbv1, setConfirmingSmbv1] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootFeedback, setRebootFeedback] = useState<string | null>(null);
  const [selectedHostKey, setSelectedHostKey] = useState<string>('');
  const [confirmingDeleteKey, setConfirmingDeleteKey] = useState<string | null>(null);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const [deletingSnapKey, setDeletingSnapKey] = useState<string | null>(null);
  const [probeTargetIp, setProbeTargetIp] = useState('');
  const [isProbingHost, setIsProbingHost] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<PingHostResult | null>(null);
  const [diffFilter, setDiffFilter] = useState<'all' | 'issues' | 'local' | 'host'>('all');
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [pendingTargetHostOverride, setPendingTargetHostOverride] = useState('');
  const [pendingModesDraft, setPendingModesDraft] = useState<PolicyPatchMode[]>(['safe_compat']);
  const [pendingIncludeGuestUnlock, setPendingIncludeGuestUnlock] = useState(true);
  const [isSavingPendingTask, setIsSavingPendingTask] = useState(false);
  const [confirmingDeletePendingKey, setConfirmingDeletePendingKey] = useState<string | null>(null);
  const [isExpertExpanded, setIsExpertExpanded] = useState(true);
  const [isFetchingRawRegistry, setIsFetchingRawRegistry] = useState(false);
  const [expertFetchResult, setExpertFetchResult] = useState<ExpertRegistryFetchResult | null>(null);
  const initializedPendingSourceRef = useRef<string | null>(null);

  const isBusy = isInspecting || isApplyingMode !== null || isAutoAligning || isApplyingPendingHostTask;
  const currentEra: WindowsNetworkEra = policyStatus?.osEra || netInfo.osEra || 'win11_24h2';
  const currentBuild = policyStatus?.osBuild || netInfo.osBuild || 26100;
  const currentDisp = policyStatus?.osDisplayVersion || netInfo.osDisplayVersion || '24H2';

  const { remoteSnapshotKeys, localSnapshotKey, allSavedSnapshotKeys } = useMemo(() => {
    const keys = Object.keys(hostPolicySnapshots || {});
    const currentLower = netInfo.hostname.trim().toLowerCase();
    const remote: string[] = [];
    let local = '';
    for (const k of keys) {
      if (k.trim().toLowerCase() === currentLower) {
        local = k;
      } else {
        remote.push(k);
      }
    }
    remote.sort((a, b) => {
      const ta = Date.parse(hostPolicySnapshots[a]?.capturedAt || '') || 0;
      const tb = Date.parse(hostPolicySnapshots[b]?.capturedAt || '') || 0;
      if (tb !== ta) return tb - ta;
      return a.localeCompare(b);
    });
    const all = local ? [...remote, local] : [...remote];
    return { remoteSnapshotKeys: remote, localSnapshotKey: local, allSavedSnapshotKeys: all };
  }, [hostPolicySnapshots, netInfo.hostname]);

  useEffect(() => {
    setConfirmingDeleteKey(null);
    setConfirmingClearAll(false);
  }, [allSavedSnapshotKeys.length]);

  const effectiveSourceId = useMemo(() => {
    if (selectedHostKey) {
      if (hostPolicySnapshots[selectedHostKey]) return selectedHostKey;
      if (HOST_POLICY_REFERENCE_TARGETS.some((p) => p.id === selectedHostKey)) return selectedHostKey;
    }
    if (remoteSnapshotKeys.length > 0) return remoteSnapshotKeys[0];
    return HOST_POLICY_REFERENCE_TARGETS[0].id;
  }, [selectedHostKey, hostPolicySnapshots, remoteSnapshotKeys]);

  const activePreset = useMemo(
    () => HOST_POLICY_REFERENCE_TARGETS.find((p) => p.id === effectiveSourceId) || null,
    [effectiveSourceId]
  );

  const selectedHostSnap = activePreset
    ? activePreset.snapshot
    : effectiveSourceId
      ? hostPolicySnapshots[effectiveSourceId] || null
      : null;

  const isPresetTarget = Boolean(activePreset);
  const isSelfComparison = Boolean(localSnapshotKey) && effectiveSourceId === localSnapshotKey;

  const crossPcDiffs = useMemo(() => {
    if (!selectedHostSnap || !policyStatus) return [];
    return computeHostClientPolicyDiff(selectedHostSnap, policyStatus);
  }, [selectedHostSnap, policyStatus]);

  const diffConflictModes = useMemo(() => extractAutoAlignModes(crossPcDiffs), [crossPcDiffs]);
  const conflictRows = useMemo(
    () => crossPcDiffs.filter((row) => row.status === 'conflict'),
    [crossPcDiffs]
  );
  const hostSideRows = useMemo(
    () => crossPcDiffs.filter((row) => (row.actionTarget === 'host' || row.actionTarget === 'both') && row.status !== 'match'),
    [crossPcDiffs]
  );
  const hostPendingPlan = useMemo(() => extractHostPendingPlan(crossPcDiffs), [crossPcDiffs]);

  const matchingPortableEntry = useMemo(() => {
    if (!selectedHostSnap || isPresetTarget) return null;
    const hostLower = selectedHostSnap.hostName.trim().toLowerCase();
    return (
      portableShares.find((s) => (s.sourceHostName || '').trim().toLowerCase() === hostLower) || null
    );
  }, [selectedHostSnap, isPresetTarget, portableShares]);

  const activeConnectedDrive = useMemo(() => {
    if (!mountedDrives.length) return null;
    return mountedDrives.find((m) => m.status === 'connected') || mountedDrives[0] || null;
  }, [mountedDrives]);

  const connectedHostLabel = useMemo(() => {
    if (!activeConnectedDrive) return undefined;
    return `${activeConnectedDrive.driveLetter} (${activeConnectedDrive.targetHost})`;
  }, [activeConnectedDrive]);

  const resolvedHostIpHint = useMemo(() => {
    if (selectedHostSnap?.sourceIp) return selectedHostSnap.sourceIp;
    if (matchingPortableEntry?.sourceIp) return matchingPortableEntry.sourceIp;
    if (!isPresetTarget && selectedHostSnap?.hostName) return selectedHostSnap.hostName;
    if (activeConnectedDrive?.targetHost) return activeConnectedDrive.targetHost;
    const remoteShare = portableShares.find(
      (s) => (s.sourceHostName || '').trim().toLowerCase() !== netInfo.hostname.trim().toLowerCase()
    );
    return remoteShare?.sourceIp || '';
  }, [selectedHostSnap, matchingPortableEntry, isPresetTarget, activeConnectedDrive, portableShares, netInfo.hostname]);

  useEffect(() => {
    setProbeTargetIp(resolvedHostIpHint);
    setProbeError(null);
    setProbeResult(null);
  }, [effectiveSourceId, resolvedHostIpHint]);

  useEffect(() => {
    setExpertFetchResult(null);
  }, [effectiveSourceId, policyStatus?.checkedAt]);

  const handleFetchRawRegistry = async () => {
    if (isFetchingRawRegistry) return;
    setIsFetchingRawRegistry(true);
    try {
      const targetForRpc =
        probeTargetIp.trim() ||
        (!isPresetTarget ? selectedHostSnap?.sourceIp || selectedHostSnap?.hostName : '') ||
        activeConnectedDrive?.targetHost ||
        '';
      const result = await shareBridge.fetchExpertRawRegistryComparison({
        netInfo,
        localPolicy: policyStatus,
        targetHostSnapshot: selectedHostSnap,
        connectedHostTarget: targetForRpc,
        isPresetTarget,
      });
      setExpertFetchResult(result);
      onNotify?.(
        result.remoteRpcSucceeded
          ? `로컬 PC와 연결 호스트(${result.hostSnapshot.hostName})의 원시 레지스트리를 실시간 조회했습니다.`
          : '로컬 및 대상 호스트의 10대 보안 정책 원시 레지스트리 비교표를 갱신했습니다.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      onNotify?.(`원시 레지스트리 조회 실패: ${msg}`);
    } finally {
      setIsFetchingRawRegistry(false);
    }
  };

  const pendingInitKey = `${effectiveSourceId}::${Boolean(policyStatus)}`;
  useEffect(() => {
    if (initializedPendingSourceRef.current === pendingInitKey) return;
    initializedPendingSourceRef.current = pendingInitKey;
    if (hostPendingPlan.modes.length > 0) {
      setPendingModesDraft(hostPendingPlan.modes);
    } else {
      setPendingModesDraft(['safe_compat']);
    }
    setPendingIncludeGuestUnlock(
      hostPendingPlan.includeGuestUnlock || (isPresetTarget && hostSideRows.length === 0)
    );
  }, [pendingInitKey, hostPendingPlan.modes, hostPendingPlan.includeGuestUnlock, isPresetTarget, hostSideRows.length]);

  useEffect(() => {
    if (isPresetTarget) {
      const remoteShare = portableShares.find(
        (s) => (s.sourceHostName || '').trim().toLowerCase() !== netInfo.hostname.trim().toLowerCase()
      );
      setPendingTargetHostOverride(remoteShare?.sourceHostName || 'MAIN-HOST-PC');
    } else if (selectedHostSnap) {
      setPendingTargetHostOverride(selectedHostSnap.hostName);
    }
  }, [isPresetTarget, selectedHostSnap, portableShares, netInfo.hostname]);

  const filteredCrossPcDiffs = useMemo(() => {
    if (diffFilter === 'issues') return crossPcDiffs.filter((r) => r.status !== 'match');
    if (diffFilter === 'local') {
      return crossPcDiffs.filter(
        (r) => r.status !== 'match' && (r.actionTarget === 'local' || r.actionTarget === 'both')
      );
    }
    if (diffFilter === 'host') {
      return crossPcDiffs.filter(
        (r) => r.status !== 'match' && (r.actionTarget === 'host' || r.actionTarget === 'both')
      );
    }
    return crossPcDiffs;
  }, [crossPcDiffs, diffFilter]);

  const diffCounts = useMemo(
    () => ({
      all: crossPcDiffs.length,
      issues: crossPcDiffs.filter((r) => r.status !== 'match').length,
      local: crossPcDiffs.filter(
        (r) => r.status !== 'match' && (r.actionTarget === 'local' || r.actionTarget === 'both')
      ).length,
      host: crossPcDiffs.filter(
        (r) => r.status !== 'match' && (r.actionTarget === 'host' || r.actionTarget === 'both')
      ).length,
    }),
    [crossPcDiffs]
  );

  const pendingTaskList = useMemo(
    () =>
      Object.values(pendingHostActions || {}).sort((a, b) => {
        const ta = Date.parse(a.createdAt || '') || 0;
        const tb = Date.parse(b.createdAt || '') || 0;
        return tb - ta;
      }),
    [pendingHostActions]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return WINDOWS_NETWORK_MATRIX.filter((item) => {
      if (selectedEra !== 'all' && item.era !== selectedEra) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.defaultBehavior.toLowerCase().includes(q) ||
        item.sharingImpact.toLowerCase().includes(q) ||
        item.mitigationStrategy.toLowerCase().includes(q) ||
        item.affectedRegistryOrCmdlet.toLowerCase().includes(q) ||
        item.versionLabel.toLowerCase().includes(q)
      );
    });
  }, [selectedEra, selectedCategory, searchQuery]);

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

  const handleScrollToDiff = () => {
    const el = document.getElementById('cross-pc-policy-diff');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleRunHostProbe = async () => {
    if (!onProbeRemoteHost) return;
    const target = probeTargetIp.trim() || selectedHostSnap?.sourceIp || selectedHostSnap?.hostName || '';
    if (!target) {
      const msg = '진단할 호스트 IP 주소 또는 컴퓨터 이름을 입력하세요.';
      setProbeError(msg);
      onNotify?.(msg);
      return;
    }
    setProbeError(null);
    setIsProbingHost(true);
    try {
      const result = await onProbeRemoteHost(target);
      setProbeResult(result);
      onNotify?.(
        result.reachable
          ? `${result.target} 응답 확인 (TCP 445 ${result.smbPortOpen ? 'OPEN' : 'CLOSED'})`
          : `${result.target} 응답 없음 — 방화벽·IP 대역을 확인하세요.`
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '호스트 IP 진단 중 오류가 발생했습니다.';
      setProbeResult(null);
      setProbeError(errMsg);
      onNotify?.(errMsg);
    } finally {
      setIsProbingHost(false);
    }
  };

  const handleTogglePendingMode = (mode: PolicyPatchMode) => {
    setPendingModesDraft((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleSavePendingTask = async () => {
    if (!onSavePendingHostTask) return;
    const cleanTargetHost = (
      isPresetTarget ? pendingTargetHostOverride : selectedHostSnap?.hostName || pendingTargetHostOverride
    ).trim();
    if (!cleanTargetHost) {
      onNotify?.('USB 대기 작업을 저장할 대상 호스트 컴퓨터 이름을 입력하세요.');
      return;
    }
    if (pendingModesDraft.length === 0 && !pendingIncludeGuestUnlock) {
      onNotify?.('최소 1개 이상의 호스트 적용 정책 항목을 선택하세요.');
      return;
    }
    setIsSavingPendingTask(true);
    try {
      await onSavePendingHostTask({
        targetHostName: cleanTargetHost,
        ...(probeTargetIp.trim() ? { targetIp: probeTargetIp.trim() } : {}),
        requestedByHostName: netInfo.hostname,
        ...(netInfo.primaryIp ? { requestedByIp: netInfo.primaryIp } : {}),
        modes: pendingModesDraft,
        includeGuestUnlock: pendingIncludeGuestUnlock,
        conflictLabels:
          hostPendingPlan.conflictLabels.length > 0
            ? hostPendingPlan.conflictLabels
            : pendingModesDraft.map((m) => getPolicyPatchLabel(m)),
      });
    } finally {
      setIsSavingPendingTask(false);
    }
  };

  const handleCopyHostGuide = async () => {
    if (!selectedHostSnap) return;
    const guideItems = hostSideRows.length > 0 ? hostSideRows : conflictRows;
    const guideBody =
      guideItems.length > 0
        ? guideItems.map((row) => `- ${row.label}: ${row.impact}`)
        : ['- 감지된 호스트-클라이언트 정책 불일치가 없습니다. (양단 공유 정책 호환 상태)'];
    const guideText = [
      `[AhBiShare OneClick 호스트 PC(${selectedHostSnap.hostName}) 정책 정렬 안내]`,
      ...guideBody,
      '조치 방법: 호스트 PC에서 AhBiShare OneClick을 실행하면 USB에 예약된 대기 작업을 원클릭 적용하거나 [OS 호환성 매트릭스] 탭 > [안전 호환 원클릭 적용]으로 해결할 수 있습니다.',
    ].join('\n');
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(guideText);
        copied = true;
      }
    } catch {}
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = guideText;
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
    onNotify?.(
      copied
        ? '호스트 PC 정책 조치 안내를 클립보드에 복사했습니다.'
        : '클립보드 복사에 실패했습니다. 아래 비교표를 직접 확인하세요.'
    );
  };

  const judgment = lastPatchResult?.rebootJudgment;

  return (
    <div className="space-y-8">
      {/* Header & Live OS Detection Banner */}
      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                Win 10 ~ Win 11 26H2 Network Matrix
              </span>
              <span className="tabular-data px-2.5 py-0.5 text-[11px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                감지된 OS: {policyStatus?.osProductName || netInfo.osProductName || 'Windows'} · {formatEraShortLabel(currentEra, currentBuild, currentDisp)}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Windows 세대별 네트워크 정책 변화 & 파일 공유 자동 호환 엔진
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Windows 10부터 Windows 11 24H2·25H2·26H2까지 강화된 SMB 서명·게스트 차단·NTLM·NetBIOS 정책을 진단하고, 재부팅 필요 여부를 판정하여 안전하게 적용합니다.
            </p>
          </div>

          <button
            id="btn-inspect-os-policy"
            type="button"
            disabled={isBusy}
            onClick={() => void onInspectPolicy()}
            className="px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
            {isInspecting ? 'OS 정책 분석 중...' : '현재 OS 네트워크 정책 재검사'}
          </button>
        </div>

        {/* Live Telemetry Cards */}
        {policyStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">공유 호환 지수</div>
                <div
                  className={`mt-1 tabular-data text-base font-bold ${
                    policyStatus.compatibilityScore >= 85
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : policyStatus.compatibilityScore >= 60
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {policyStatus.compatibilityScore}점 / 100
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">프로필 · TCP 445 방화벽</div>
                <div
                  className={`mt-1 tabular-data font-bold ${
                    policyStatus.networkProfile === 'Public' || policyStatus.firewall445Allowed === false
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.networkProfile} ·{' '}
                  {policyStatus.firewall445Allowed === false ? '445 차단' : '445 허용'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">SMB 클라이언트 서명</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.smbClientSigningRequired
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.smbClientSigningRequired ? '강제됨 (24H2 기본)' : '호환 완화'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">게스트 로그온 · 계정(*-501)</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.allowInsecureGuestAuth &&
                    !policyStatus.guestNetworkLogonDenied &&
                    policyStatus.guestAccountEnabled !== false
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {policyStatus.allowInsecureGuestAuth ? '허용' : '차단'} ·{' '}
                  {policyStatus.guestAccountEnabled === false ? '계정 OFF' : '계정 ON'}
                  {policyStatus.guestNetworkLogonDenied ? ' · 거부(1385)' : ''}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">LSA 빈 암호(86) · 익명(1223)</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.limitBlankPasswordUse ||
                    policyStatus.restrictNullSessAccess ||
                    policyStatus.restrictAnonymous
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.limitBlankPasswordUse ? '빈암호 제한(86)' : '빈암호 허용'} ·{' '}
                  {policyStatus.restrictNullSessAccess || policyStatus.restrictAnonymous ? '익명 제한' : '익명 완화'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">NTLM 수준 / NetBT</div>
                <div className="mt-1 tabular-data font-bold text-slate-900 dark:text-slate-100">
                  Lm={policyStatus.lmCompatibilityLevel ?? '기본'} · {policyStatus.netbiosEnabled ? 'NetBT ON' : 'OFF'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">프린터 RPC / 스풀러</div>
                <div
                  className={`mt-1 tabular-data font-bold ${
                    !policyStatus.printSpoolerRunning
                      ? 'text-red-600 dark:text-red-400'
                      : policyStatus.rpcAuthnLevelPrivacyDisabled && policyStatus.rpcUseNamedPipeProtocol
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {policyStatus.rpcAuthnLevelPrivacyDisabled && policyStatus.rpcUseNamedPipeProtocol
                    ? 'Named Pipe 호환'
                    : '엄격 RPC'} · {policyStatus.printSpoolerRunning ? 'Spooler ON' : 'OFF'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">보류 재부팅 상태</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.pendingRebootFlag
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.pendingRebootFlag ? '재부팅 대기 중' : '없음 (정상)'}
                </div>
              </div>
            </div>

            {policyStatus.detectedIssues.length > 0 ? (
              <div className="p-4 rounded-lg border border-amber-500/35 bg-amber-500/10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>현재 OS에서 감지된 파일 공유 장애 요인 ({policyStatus.detectedIssues.length}건)</span>
                </div>
                <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200 pl-6 list-disc">
                  {policyStatus.detectedIssues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>현재 OS 네트워크 정책이 Win 10~11 26H2 이기종 파일 공유 호환 상태(점검 시각 {policyStatus.checkedAt})로 정렬되어 있습니다.</span>
              </div>
            )}
          </div>
        )}

        {/* Instant Mismatch Detection & 1-Click Auto-Align Banner */}
        {policyStatus && selectedHostSnap && diffConflictModes.length > 0 && (
          <div
            id="matrix-auto-align-banner"
            className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-500/8 dark:bg-indigo-500/12 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    호스트-클라이언트 정책 불일치 {conflictRows.length}건 감지 · 원클릭 자동 정렬 대기
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    비교 대상: {selectedHostSnap.hostName} ({formatEraShortLabel(selectedHostSnap.osEra, selectedHostSnap.osBuild, selectedHostSnap.osDisplayVersion)})
                    {selectedHostSnap.capturedAt ? ` · 감지 일시: ${formatSnapshotTimestamp(selectedHostSnap.capturedAt)}` : ''}
                    {isPresetTarget ? ' (권장 호환 기준)' : ' (USB 포터블 호스트)'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  감지 항목: <span className="font-semibold">{conflictRows.map((r) => r.label).join(' · ')}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  적용 예정 패치:{' '}
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {diffConflictModes.map((m) => getPolicyPatchLabel(m)).join(' + ')}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isPresetTarget && onDeleteHostPolicySnapshot && (
                confirmingDeleteKey === `banner:${effectiveSourceId}` ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={deletingSnapKey === effectiveSourceId}
                      onClick={async () => {
                        setDeletingSnapKey(effectiveSourceId);
                        try {
                          await onDeleteHostPolicySnapshot(effectiveSourceId);
                          setSelectedHostKey('');
                        } finally {
                          setDeletingSnapKey(null);
                          setConfirmingDeleteKey(null);
                        }
                      }}
                      className="px-2.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      삭제 확정
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteKey(null)}
                      className="px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    id="btn-banner-delete-snap"
                    type="button"
                    onClick={() => {
                      setConfirmingClearAll(false);
                      setConfirmingDeleteKey(`banner:${effectiveSourceId}`);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    이 스냅샷 삭제
                  </button>
                )
              )}
              <button
                id="btn-scroll-diff-detail"
                type="button"
                onClick={handleScrollToDiff}
                className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                불일치 상세 비교 ({crossPcDiffs.length})
              </button>
              <button
                id="btn-auto-align-top"
                type="button"
                disabled={isBusy}
                onClick={() => void onSyncMatchedPolicies(diffConflictModes)}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isAutoAligning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {isAutoAligning
                  ? '불일치 정책 자동 정렬 중...'
                  : `불일치 정책 원클릭 자동 정렬 (${diffConflictModes.length}종)`}
              </button>
            </div>
          </div>
        )}

        {policyStatus && diffConflictModes.length === 0 && lastAutoAlignResult && (
          <div
            id="matrix-auto-align-complete"
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              lastAutoAlignResult.success
                ? 'border-emerald-500/35 bg-emerald-500/10'
                : 'border-amber-500/35 bg-amber-500/10'
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              {lastAutoAlignResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">{lastAutoAlignResult.summary}</div>
                <div className="text-slate-700 dark:text-slate-300">
                  {lastAutoAlignResult.rebootJudgment.title}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleScrollToDiff}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-end sm:self-center"
            >
              양단 비교표 확인
            </button>
          </div>
        )}

        {/* 1-Click Patch Presets */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            원클릭 정책 적용 모드 & 재부팅 판정 실행
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border-2 border-indigo-500/40 bg-indigo-500/5 dark:bg-indigo-500/10 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    OS 빌드 맞춤 안전 호환 패치
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-600 text-white">권장</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  24H2~26H2 SMB 서명 완화·게스트 호환·NTLMv2·개인 프로필 정렬 후 <strong className="font-semibold">SMB 서비스를 즉시 재시작</strong>해 재부팅 없이 바로 공유합니다.
                </p>
              </div>
              <button
                id="btn-apply-safe-compat"
                type="button"
                disabled={isBusy}
                onClick={() => void onApplyPatch('safe_compat')}
                className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {isApplyingMode === 'safe_compat' ? '안전 호환 패치 적용 중...' : '안전 호환 원클릭 적용 (즉시 반영)'}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    심층 TCP/IP · Winsock 초기화
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
                    재부팅 필요
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  반복적인 0x80070035·소켓 오류 시 <code className="tabular-data">netsh winsock/int ip reset</code>을 수행합니다. 커널 적용을 위해 재부팅 판정이 내려집니다.
                </p>
              </div>
              <button
                id="btn-apply-deep-reset"
                type="button"
                disabled={isBusy}
                onClick={() => void onApplyPatch('deep_stack_reset')}
                className="w-full py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                {isApplyingMode === 'deep_stack_reset' ? '스택 초기화 중...' : '심층 네트워크 스택 초기화 실행'}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Lock className="w-4 h-4 text-slate-500" />
                    Win 11 26H2 표준 보안 복원
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    재부팅 불필요
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  공유 종료 후 SMB 서명 강제·게스트 차단·LSA 익명 차단 등 Microsoft 최신 SFI 기본 보안 정책으로 즉시 되돌립니다.
                </p>
              </div>
              <button
                id="btn-apply-strict-default"
                type="button"
                disabled={isBusy}
                onClick={() => void onApplyPatch('strict_26h2_default')}
                className="w-full py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {isApplyingMode === 'strict_26h2_default' ? '보안 기본값 복원 중...' : '26H2 표준 보안으로 복원'}
              </button>
            </div>
          </div>

          {/* Printer RPC & Spooler Compatibility Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl border border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Printer className="w-4 h-4 text-indigo-500" />
                    Win 11 26H2 프린터 RPC · 스풀러 호환 패치 (0x0000011b / 0x00000709)
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                    Spooler 재시작
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  RpcAuthnLevelPrivacyEnabled=0, RPC Named Pipes 활성화, Point and Print 제한 완화 적용 후 Print Spooler를 즉시 재시작합니다.
                </p>
              </div>
              <button
                id="btn-apply-rpc-printer-compat"
                type="button"
                disabled={isBusy}
                onClick={() => void onApplyPatch('rpc_printer_compat')}
                className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                {isApplyingMode === 'rpc_printer_compat' ? '프린터 RPC 패치 적용 중...' : '프린터 RPC·스풀러 호환 원클릭 적용'}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    프린터 RPC 표준 보안 정책 복원
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                    Spooler 재시작
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  공유 프린터 작업 완료 후 RpcAuthnLevelPrivacyEnabled=1 및 RPC over TCP 기본 보안 설정으로 즉시 복원합니다.
                </p>
              </div>
              <button
                id="btn-apply-rpc-printer-default"
                type="button"
                disabled={isBusy}
                onClick={() => void onApplyPatch('rpc_printer_default')}
                className="w-full py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {isApplyingMode === 'rpc_printer_default' ? '프린터 보안 복원 중...' : '프린터 RPC 기본 보안으로 복원'}
              </button>
            </div>
          </div>
        </div>

        {/* Smart Reboot Judgment Result Card */}
        {(judgment || policyStatus?.pendingRebootFlag) && (
          <div
            id="reboot-judgment-banner"
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      재부팅 판정: {judgment ? judgment.title : 'Windows 보류 중인 시스템 재부팅 감지됨'}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded border ${
                        rebootLevelBadge(
                          judgment ? judgment.level : 'reboot_recommended'
                        ).badgeClass
                      }`}
                    >
                      {rebootLevelBadge(judgment ? judgment.level : 'reboot_recommended').label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {judgment
                      ? judgment.reason
                      : 'Windows Update 또는 이전 드라이버/네트워크 변경으로 인해 대기 중인 재부팅 플래그가 감지되었습니다.'}
                  </p>
                </div>
              </div>

              {(judgment?.canRebootNow || (!judgment && policyStatus?.pendingRebootFlag)) && (
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!confirmingReboot ? (
                    <button
                      id="btn-request-reboot-step1"
                      type="button"
                      onClick={() => setConfirmingReboot(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      지금 컴퓨터 재부팅
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-confirm-reboot-now"
                        type="button"
                        disabled={isRebooting}
                        onClick={() => void handleConfirmReboot()}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-600 rounded-lg cursor-pointer disabled:opacity-50"
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
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {rebootFeedback}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 10-Point Security Rollback Verification Report */}
      <SecurityRollbackReport
        netInfo={netInfo}
        policyStatus={policyStatus}
        targetHostSnapshot={selectedHostSnap}
        targetHostIsPreset={isPresetTarget}
        activeShareCount={activeShareCount}
        activeMountCount={activeMountCount}
        isBusy={isBusy}
        isInspecting={isInspecting}
        onInspectPolicy={onInspectPolicy}
        onRestoreDefaults={onSyncMatchedPolicies}
        onFullSecurityRollback={onFullSecurityRollback}
        onNotify={onNotify}
      />

      {/* Separate Windows OS Patch & Optional Feature Diagnostic Panel */}
      <section
        id="os-patch-feature-diagnosis"
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-5"
      >
        {(() => {
          const isHome = /core|home/i.test(policyStatus?.osEditionId || policyStatus?.osProductName || '');
          const isEarly24h2 =
            currentBuild === 26100 &&
            typeof policyStatus?.osUbr === 'number' &&
            policyStatus.osUbr > 0 &&
            policyStatus.osUbr < 2314;
          const hotfixList = policyStatus?.recentHotfixIds || [];
          const hasSpecialRisk = Boolean(isEarly24h2 || policyStatus?.msaPinOnlyRisk);
          const smb1State = policyStatus?.smb1ClientFeatureState || 'Disabled';
          const uacFilterEnabled = Boolean(policyStatus?.localAccountTokenFilterEnabled);

          return (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {hasSpecialRisk ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    <span>별도 Windows 패치 · 선택적 기능 필요 여부 진단</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {hasSpecialRisk
                      ? '초기 24H2 빌드 리비전 또는 MS 계정·PIN 환경이 감지되었습니다. 아래 해당 항목의 조치를 확인하세요.'
                      : '일반 Windows 10~11 PC 간 공유에는 별도 OS 업데이트·추가 기능 설치가 필요 없으며, 아래 특수 환경(구형 NAS·워크그룹 관리자 접속·PIN 로그인)에 해당하는 경우에만 적용합니다.'}
                  </p>
                </div>
                <div className="tabular-data text-xs text-slate-600 dark:text-slate-300 shrink-0">
                  에디션: {policyStatus?.osEditionId || 'Pro'}
                  {isHome ? ' (gpedit 미지원 · 레지스트리 자동 우회)' : ''} · 빌드 {currentBuild}
                  {typeof policyStatus?.osUbr === 'number' ? `.${policyStatus.osUbr}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. UAC LocalAccountTokenFilterPolicy */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        <KeyRound className="w-4 h-4 text-indigo-500 shrink-0" />
                        UAC 원격 토큰 필터
                      </span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          uacFilterEnabled
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {uacFilterEnabled ? '허용 (완화됨)' : '차단 (기본)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      워크그룹에서 로컬 관리자 계정 원격 접속 시 System Error 5(액세스 거부)가 발생할 때 <code className="tabular-data">LocalAccountTokenFilterPolicy=1</code>을 즉시 적용합니다.
                    </p>
                  </div>

                  <button
                    id="btn-toggle-uac-token-filter"
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void onApplyPatch(
                        uacFilterEnabled ? 'disable_uac_token_filter' : 'enable_uac_token_filter'
                      )
                    }
                    className={`w-full py-2.5 px-3 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      uacFilterEnabled
                        ? 'text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                        : 'text-white bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {isApplyingMode === 'enable_uac_token_filter' || isApplyingMode === 'disable_uac_token_filter'
                      ? '정책 적용 중...'
                      : uacFilterEnabled
                        ? '기본 보안(차단)으로 되돌리기'
                        : 'UAC 원격 토큰 허용 적용 (즉시)'}
                  </button>
                </div>

                {/* 2. Legacy NAS / Copier SMBv1 Client */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        <HardDriveDownload className="w-4 h-4 text-amber-500 shrink-0" />
                        구형 NAS · 복합기 SMBv1
                      </span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          smb1State === 'Enabled'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {smb1State === 'Enabled' ? '설치됨' : '미설치 (기본)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      일반 PC 공유에는 불필요하며, 2015년 이전 구형 NAS·스캐너 전용입니다. 설치 시 커널 드라이버 로드를 위해 <strong>재부팅이 필수</strong>입니다.
                    </p>
                  </div>

                  {smb1State === 'Enabled' ? (
                    <div className="w-full py-2.5 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                      SMB1Protocol-Client 기능 설치 완료
                    </div>
                  ) : !confirmingSmbv1 ? (
                    <button
                      id="btn-request-smbv1-step1"
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmingSmbv1(true)}
                      className="w-full py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <HardDriveDownload className="w-3.5 h-3.5" />
                      구형 장비용 SMBv1 클라이언트 설치
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-confirm-enable-smbv1"
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setConfirmingSmbv1(false);
                          void onApplyPatch('enable_smbv1_client');
                        }}
                        className="flex-1 py-2 px-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {isApplyingMode === 'enable_smbv1_client' ? '설치 중...' : '재부팅 감수 설치 확정'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingSmbv1(false)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Windows Cumulative Updates (KB) & MSA/PIN Status */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        누적 패치(KB) · 계정 유형
                      </span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          isEarly24h2 || policyStatus?.msaPinOnlyRisk
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isEarly24h2 ? '업데이트 권고' : policyStatus?.msaPinOnlyRisk ? 'PIN 로그인 감지' : '정상'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed tabular-data">
                      최근 KB: {hotfixList.length > 0 ? hotfixList.slice(0, 3).join(' · ') : '조회된 HotFix 없음'}
                      <br />
                      {policyStatus?.msaPinOnlyRisk
                        ? 'MS 계정/PIN 전용 로그인 감지 — 호스트 개설 시 [전용 보안 공유 계정] 모드를 사용하세요.'
                        : '별도 OS 핫픽스 없이 즉시 공유 가능하며, 초기 24H2 장애 시 누적 업데이트만 확인하세요.'}
                    </p>
                  </div>

                  <button
                    id="btn-open-windows-update"
                    type="button"
                    onClick={() => void onOpenWindowsUpdate()}
                    className="w-full py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Windows Update 설정 열기
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </section>

      {/* Cross-PC Policy Diff Diagnostics: 3-Step One-Click Resolution Wizard */}
      <section
        id="cross-pc-policy-diff"
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
      >
        {/* Top Wizard Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-indigo-500 shrink-0" />
              메인 PC vs 클라이언트 PC 양단 정책 진단 & 3단계 원클릭 해결 마법사
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPresetTarget
                ? `원격 USB 호스트 스냅샷 대신 '${selectedHostSnap?.hostName}' 기준과 대조 중입니다. 호스트 PC에서 앱을 실행하면 실제 스냅샷이 자동 기록됩니다.`
                : isSelfComparison
                  ? `현재 PC(${netInfo.hostname})의 저장 스냅샷과 실시간 정책을 대조 중입니다.`
                  : `USB 포터블 설정(${selectedHostSnap?.hostName}${selectedHostSnap?.sourceIp ? ` · ${selectedHostSnap.sourceIp}` : ''})과 현재 PC 정책을 심층 대조합니다.`}
            </p>
          </div>

          <div className="tabular-data text-[11px] font-medium text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 shrink-0">
            <span className={selectedHostSnap ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''}>
              01 대상·IP 프로브
            </span>
            <span>→</span>
            <span className={diffConflictModes.length === 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'font-semibold text-slate-800 dark:text-slate-200'}>
              02 내 PC 정렬 ({diffConflictModes.length === 0 ? '완료' : `${diffConflictModes.length}종 대기`})
            </span>
            <span>→</span>
            <span className={pendingTaskList.length > 0 ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''}>
              03 호스트 USB 예약 ({pendingTaskList.length}건)
            </span>
          </div>
        </div>

        {/* 3-Step Resolution Wizard Cards (Single-elevation divided grid) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
          {/* STEP 01: Target Selection & Live IP Probe */}
          <div className="p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-data text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  STEP 01 · 대상 선택 & 실시간 IP 프로브
                </span>
                {allSavedSnapshotKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSnapshotHistory((v) => !v)}
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3" />
                    스냅샷 목록 ({allSavedSnapshotKeys.length})
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <select
                  id="cross-pc-host-select"
                  value={effectiveSourceId}
                  onChange={(e) => {
                    setConfirmingDeleteKey(null);
                    setConfirmingClearAll(false);
                    setSelectedHostKey(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {remoteSnapshotKeys.map((key) => {
                    const snap = hostPolicySnapshots[key];
                    const ts = snap?.capturedAt ? formatSnapshotTimestamp(snap.capturedAt) : '';
                    const eraText = snap ? formatEraShortLabel(snap.osEra, snap.osBuild, snap.osDisplayVersion) : '';
                    return (
                      <option key={key} value={key}>
                        원격 호스트: {key}{snap?.sourceIp ? ` (${snap.sourceIp})` : ''}{eraText ? ` · ${eraText}` : ''}{ts ? ` · ${ts}` : ''}
                      </option>
                    );
                  })}
                  {HOST_POLICY_REFERENCE_TARGETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      기준: {preset.label}
                    </option>
                  ))}
                  {localSnapshotKey && (
                    <option key={localSnapshotKey} value={localSnapshotKey}>
                      현재 PC 스냅샷: {localSnapshotKey}
                      {hostPolicySnapshots[localSnapshotKey]?.capturedAt
                        ? ` · ${formatSnapshotTimestamp(hostPolicySnapshots[localSnapshotKey]?.capturedAt)}`
                        : ''}
                    </option>
                  )}
                </select>

                <div className="flex flex-wrap items-center gap-2">
                  {!isPresetTarget && onDeleteHostPolicySnapshot && (
                    confirmingDeleteKey === `select:${effectiveSourceId}` ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          id="btn-confirm-delete-host-snap"
                          type="button"
                          disabled={deletingSnapKey === effectiveSourceId}
                          onClick={async () => {
                            setDeletingSnapKey(effectiveSourceId);
                            try {
                              await onDeleteHostPolicySnapshot(effectiveSourceId);
                              setSelectedHostKey('');
                            } finally {
                              setDeletingSnapKey(null);
                              setConfirmingDeleteKey(null);
                            }
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 rounded-md cursor-pointer disabled:opacity-50"
                        >
                          삭제 확정
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteKey(null)}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        id="btn-delete-host-snap"
                        type="button"
                        onClick={() => {
                          setConfirmingClearAll(false);
                          setConfirmingDeleteKey(`select:${effectiveSourceId}`);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        이 스냅샷 삭제
                      </button>
                    )
                  )}

                  {allSavedSnapshotKeys.length > 0 && onClearAllHostPolicySnapshots && (
                    confirmingClearAll ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          id="btn-confirm-clear-all-snaps"
                          type="button"
                          disabled={deletingSnapKey === '__ALL__'}
                          onClick={async () => {
                            setDeletingSnapKey('__ALL__');
                            try {
                              await onClearAllHostPolicySnapshots();
                              setSelectedHostKey(HOST_POLICY_REFERENCE_TARGETS[0].id);
                            } finally {
                              setDeletingSnapKey(null);
                              setConfirmingClearAll(false);
                            }
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 rounded-md cursor-pointer disabled:opacity-50"
                        >
                          전체 비우기 확정
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingClearAll(false)}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        id="btn-clear-all-snaps"
                        type="button"
                        onClick={() => {
                          setConfirmingDeleteKey(null);
                          setConfirmingClearAll(true);
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-md inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        전체 목록 비우기
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Live IP & SMB TCP 445 Probe */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
                <label
                  htmlFor="probe-host-ip-input"
                  className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                >
                  실시간 호스트 IP · SMB(TCP 445) 도달성 진단
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="probe-host-ip-input"
                    type="text"
                    value={probeTargetIp}
                    onChange={(e) => {
                      setProbeError(null);
                      setProbeTargetIp(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!isProbingHost && onProbeRemoteHost) {
                          void handleRunHostProbe();
                        }
                      }
                    }}
                    placeholder="예: 192.168.0.105 또는 호스트명"
                    className="flex-1 min-w-0 px-3 py-1.5 text-xs tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    id="btn-probe-host-ip"
                    type="button"
                    disabled={isProbingHost || !onProbeRemoteHost}
                    onClick={() => void handleRunHostProbe()}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isProbingHost ? 'animate-pulse text-indigo-500' : ''}`} />
                    {isProbingHost ? '진단 중...' : '실시간 IP 진단'}
                  </button>
                </div>

                {probeError && (
                  <p role="alert" className="text-[11px] font-medium text-red-600 dark:text-red-400">
                    {probeError}
                  </p>
                )}

                {probeResult && (
                  <div
                    id="live-host-probe-result"
                    className={`tabular-data text-[11px] leading-relaxed ${
                      probeResult.reachable && probeResult.smbPortOpen
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : probeResult.reachable
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    <span className="font-bold">
                      {probeResult.reachable ? '도달 가능' : '응답 없음'}
                    </span>
                    {' · '}
                    <span>{probeResult.resolvedIp || probeResult.target}</span>
                    {probeResult.avgLatencyMs !== null && ` · 평균 ${probeResult.avgLatencyMs}ms`}
                    {' · '}
                    <span className="font-semibold">
                      TCP 445 {probeResult.smbPortOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                    {' · '}
                    <span>손실 {probeResult.packetLossPct}%</span>
                  </div>
                )}
              </div>
            </div>

            {selectedHostSnap?.capturedAt && (
              <div className="tabular-data text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3 shrink-0" />
                <span>스냅샷 일시: {formatSnapshotTimestamp(selectedHostSnap.capturedAt)}</span>
              </div>
            )}
          </div>

          {/* STEP 02: Local PC 1-Click Auto-Align */}
          <div className="p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-data text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  STEP 02 · 내 PC({netInfo.hostname}) 자동 정렬
                </span>
                <span
                  className={`tabular-data text-[11px] font-bold ${
                    diffConflictModes.length > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {diffConflictModes.length > 0 ? `${diffConflictModes.length}종 패치 대기` : '정렬 완료'}
                </span>
              </div>

              {!selectedHostSnap || !policyStatus ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  OS 네트워크 정책을 먼저 분석해 주세요.
                </p>
              ) : diffConflictModes.length > 0 ? (
                <div className="space-y-2 text-xs">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    현재 PC에서 즉시 해결 가능한 정책 충돌{' '}
                    <strong className="font-bold text-slate-900 dark:text-white">
                      {diffCounts.local}건
                    </strong>
                    이 감지되었습니다.
                  </p>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    실행 예정 패치:{' '}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                      {diffConflictModes.map((m) => getPolicyPatchLabel(m)).join(' · ')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>내 PC 로컬 적용 가능 정책이 모두 정렬되었습니다.</span>
                  </div>
                  {lastAutoAlignResult && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      최근 결과: {lastAutoAlignResult.rebootJudgment.title}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                id="btn-sync-cross-pc-policy"
                type="button"
                disabled={isBusy || diffConflictModes.length === 0}
                onClick={() => void onSyncMatchedPolicies(diffConflictModes)}
                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-45"
              >
                {isAutoAligning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {diffConflictModes.length === 0
                  ? '내 PC 정책 정렬 완료됨'
                  : isAutoAligning
                    ? '내 PC 정책 자동 정렬 중...'
                    : `내 PC 불일치 정책 일괄 정렬 (${diffConflictModes.length}종)`}
              </button>
            </div>
          </div>

          {/* STEP 03: Remote Host USB Pending Task Reservation */}
          <div className="p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-data text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  STEP 03 · 원격 호스트 USB 대기 작업 예약
                </span>
                <span className="tabular-data text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  호스트 조치 {diffCounts.host}건
                </span>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                빈 암호 제한(86)·Guest(1385)·익명 차단(1223)·방화벽 445 등 호스트 측 정책은 USB에 대기 작업을 저장해 두면 호스트 PC에서 앱 실행 시 1클릭 적용됩니다.
              </p>

              {isPresetTarget && (
                <div className="space-y-1">
                  <label
                    htmlFor="pending-target-host-input"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                  >
                    대상 호스트 컴퓨터 이름
                  </label>
                  <input
                    id="pending-target-host-input"
                    type="text"
                    value={pendingTargetHostOverride}
                    onChange={(e) => setPendingTargetHostOverride(e.target.value)}
                    placeholder="예: MAIN-HOST-PC"
                    className="w-full px-2.5 py-1.5 text-xs tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingModesDraft.includes('safe_compat')}
                    onChange={() => handleTogglePendingMode('safe_compat')}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>안전 호환 패치 (프로필 · 서명 · 게스트 · NTLM)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingIncludeGuestUnlock}
                    onChange={(e) => setPendingIncludeGuestUnlock(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Guest 무비밀번호 완전 개방 (오류 86·1223·1385 · 445)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingModesDraft.includes('rpc_printer_compat')}
                    onChange={() => handleTogglePendingMode('rpc_printer_compat')}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>프린터 RPC · 스풀러 호환 (0x11b·0x709)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingModesDraft.includes('enable_uac_token_filter')}
                    onChange={() => handleTogglePendingMode('enable_uac_token_filter')}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>UAC 원격 토큰 필터 허용 (관리자 Error 5)</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {isSelfComparison && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  현재 PC 자체 스냅샷을 선택 중입니다. STEP 01에서 원격 호스트나 권장 기준을 선택하면 USB 대기 작업을 예약할 수 있습니다.
                </p>
              )}
              <button
                id="btn-save-pending-host-task"
                type="button"
                disabled={isSavingPendingTask || !onSavePendingHostTask || isSelfComparison}
                onClick={() => void handleSavePendingTask()}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-45"
              >
                <Usb className="w-3.5 h-3.5" />
                {isSavingPendingTask
                  ? 'USB 대기 작업 저장 중...'
                  : 'USB에 호스트 자동 적용 대기 작업 저장'}
              </button>
              <button
                id="btn-copy-host-guide"
                type="button"
                onClick={() => void handleCopyHostGuide()}
                className="w-full py-1.5 px-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                호스트 PC 조치 안내 텍스트 복사
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Snapshot History List */}
        {showSnapshotHistory && allSavedSnapshotKeys.length > 0 && (
          <div
            id="detected-host-snapshots-list"
            className="px-6 py-4 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                저장된 호스트 정책 스냅샷 ({allSavedSnapshotKeys.length}건 · 날짜/시간 표기)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                항목을 클릭하면 비교 대상으로 즉시 전환됩니다.
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
              {allSavedSnapshotKeys.map((key) => {
                const snap = hostPolicySnapshots[key];
                if (!snap) return null;
                const isLocal = key === localSnapshotKey;
                const isSelected = effectiveSourceId === key;
                const ts = snap.capturedAt ? formatSnapshotTimestamp(snap.capturedAt) : '일시 미기록';
                const eraLabel = formatEraShortLabel(snap.osEra, snap.osBuild, snap.osDisplayVersion);
                const rowConfirmKey = `list:${key}`;

                return (
                  <div
                    key={key}
                    className={`py-2.5 flex items-center justify-between gap-3 text-xs ${
                      isSelected ? 'text-indigo-700 dark:text-indigo-300' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDeleteKey(null);
                        setConfirmingClearAll(false);
                        setSelectedHostKey(key);
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer flex flex-wrap items-center gap-x-2 gap-y-0.5"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">
                        {snap.hostName || key}
                      </span>
                      <span className="tabular-data text-[11px] text-slate-500 dark:text-slate-400">
                        {isLocal ? '현재 PC' : '원격 호스트'}
                        {snap.sourceIp ? ` · ${snap.sourceIp}` : ''} · {eraLabel} · {ts}
                      </span>
                      {isSelected && (
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          · 선택됨
                        </span>
                      )}
                    </button>

                    {onDeleteHostPolicySnapshot && (
                      <div className="shrink-0">
                        {confirmingDeleteKey === rowConfirmKey ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={deletingSnapKey === key}
                              onClick={async () => {
                                setDeletingSnapKey(key);
                                try {
                                  await onDeleteHostPolicySnapshot(key);
                                  if (isSelected) {
                                    setSelectedHostKey('');
                                  }
                                } finally {
                                  setDeletingSnapKey(null);
                                  setConfirmingDeleteKey(null);
                                }
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 rounded cursor-pointer disabled:opacity-50"
                            >
                              삭제 확정
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteKey(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingClearAll(false);
                              setConfirmingDeleteKey(rowConfirmKey);
                            }}
                            title={`'${snap.hostName || key}' 스냅샷 삭제`}
                            aria-label={`${snap.hostName || key} 스냅샷 삭제`}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Saved USB Pending Host Tasks Queue */}
        {pendingTaskList.length > 0 && (
          <div
            id="pending-host-tasks-queue"
            className="px-6 py-3.5 bg-indigo-500/5 dark:bg-indigo-500/8 border-b border-slate-200 dark:border-slate-800 space-y-2"
          >
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Usb className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>USB 포터블에 예약된 호스트 자동 적용 대기 작업 ({pendingTaskList.length}건)</span>
            </div>
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {pendingTaskList.map((task) => {
                const isForCurrentPc =
                  task.targetHostName.trim().toLowerCase() === netInfo.hostname.trim().toLowerCase();
                return (
                  <div
                    key={task.taskId}
                    className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="tabular-data font-semibold text-slate-900 dark:text-white">
                        대상 호스트: {task.targetHostName}
                        {task.targetIp ? ` (${task.targetIp})` : ''}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          {' · '}요청 PC: {task.requestedByHostName} · {formatSnapshotTimestamp(task.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        예약 패치: {task.modes.map((m) => getPolicyPatchLabel(m)).join(' · ')}
                        {task.includeGuestUnlock ? ' · Guest 무비밀번호 개방 포함' : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onApplyPendingHostTask && isForCurrentPc && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void onApplyPendingHostTask(task)}
                          className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <Zap className="w-3 h-3" />
                          지금 이 PC에 적용
                        </button>
                      )}
                      {onDeletePendingHostTask && (
                        confirmingDeletePendingKey === task.targetHostName ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeletePendingHostTask(task.targetHostName);
                                setConfirmingDeletePendingKey(null);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 rounded cursor-pointer"
                            >
                              삭제 확정
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeletePendingKey(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingDeletePendingKey(task.targetHostName)}
                            className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-300 dark:border-slate-700 rounded-md whitespace-nowrap cursor-pointer"
                          >
                            예약 취소
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Segmented Filter Tabs + Deep Comparison Table */}
        {!selectedHostSnap || !policyStatus ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            OS 네트워크 정책을 먼저 분석해 주세요.
          </div>
        ) : (
          <div>
            <div className="px-6 py-3 bg-slate-50/70 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                {(
                  [
                    { id: 'all', label: `전체 항목 (${diffCounts.all})` },
                    { id: 'issues', label: `불일치·경고 (${diffCounts.issues})` },
                    { id: 'local', label: `내 PC 조치 (${diffCounts.local})` },
                    { id: 'host', label: `호스트 조치 (${diffCounts.host})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    id={`diff-filter-${tab.id}`}
                    type="button"
                    onClick={() => setDiffFilter(tab.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                      diffFilter === tab.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <span className="tabular-data text-[11px] text-slate-500 dark:text-slate-400">
                심층 비교 {filteredCrossPcDiffs.length}건 표시 중 · 호스트({selectedHostSnap.hostName}) ↔ 내 PC({netInfo.hostname})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-3 px-6">비교 항목</th>
                    <th className="py-3 px-4 tabular-data">
                      <div className="font-bold">
                        호스트 ({selectedHostSnap.hostName})
                        {selectedHostSnap.sourceIp ? ` · ${selectedHostSnap.sourceIp}` : ''}
                      </div>
                      {selectedHostSnap.capturedAt ? (
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{formatSnapshotTimestamp(selectedHostSnap.capturedAt)}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                          기준 프로필
                        </div>
                      )}
                    </th>
                    <th className="py-3 px-4 tabular-data">
                      <div className="font-bold">현재 PC ({netInfo.hostname})</div>
                      {policyStatus.checkedAt && (
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{policyStatus.checkedAt}</span>
                        </div>
                      )}
                    </th>
                    <th className="py-3 px-4">판정</th>
                    <th className="py-3 px-6">해결 방향 · 영향</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCrossPcDiffs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        선택한 필터 조건에 해당하는 정책 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredCrossPcDiffs.map((row) => (
                      <tr
                        key={row.id}
                        className={
                          row.status === 'conflict'
                            ? 'bg-red-500/3 hover:bg-red-500/6 dark:hover:bg-red-500/10'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                        }
                      >
                        <td className="py-3 px-6 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <div>{row.label}</div>
                          {row.actionTarget && row.actionTarget !== 'none' && (
                            <div className="mt-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                              {row.actionTarget === 'local'
                                ? '내 PC 1클릭 정렬 대상'
                                : row.actionTarget === 'host'
                                  ? '호스트 PC USB 예약 대상'
                                  : '양단 호환 정렬 권장'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 tabular-data text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.hostValue}
                        </td>
                        <td className="py-3 px-4 tabular-data text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.clientValue}
                        </td>
                        <td className="py-3 px-4 font-bold whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              row.status === 'conflict'
                                ? 'text-red-600 dark:text-red-400'
                                : row.status === 'warning'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {row.status === 'conflict' ? (
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            ) : row.status === 'warning' ? (
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            )}
                            {row.status === 'conflict' ? '충돌 감지' : row.status === 'warning' ? '주의 · 차이' : '일치'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-slate-600 dark:text-slate-400">
                          {row.recommendedPatchLabel && (
                            <div className="mb-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                              권장 조치: {row.recommendedPatchLabel}
                            </div>
                          )}
                          <div>{row.impact}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Expert Comparison View: 10-Policy Raw Registry Side-by-Side Comparison */}
      <ExpertComparisonView
        netInfo={netInfo}
        policyStatus={policyStatus}
        targetHostSnapshot={selectedHostSnap}
        isPresetTarget={isPresetTarget}
        connectedHostLabel={connectedHostLabel}
        fetchResult={expertFetchResult}
        isFetching={isFetchingRawRegistry}
        isExpanded={isExpertExpanded}
        onToggleExpanded={() => {
          const next = !isExpertExpanded;
          setIsExpertExpanded(next);
          if (next && !expertFetchResult) {
            void handleFetchRawRegistry();
          }
        }}
        onFetchRawRegistry={handleFetchRawRegistry}
        onNotify={onNotify}
      />

      {/* Era Summary Timeline */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            Windows 10 → Windows 11 26H2 네트워크 아키텍처 변천 타임라인
          </h3>
          {selectedEra !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedEra('all')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              전체 세대 보기
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {WINDOWS_ERA_SUMMARIES.map((card) => {
            const isCurrent = card.era === currentEra;
            const isSelected = selectedEra === card.era;
            return (
              <button
                key={card.era}
                type="button"
                onClick={() => setSelectedEra((prev) => (prev === card.era ? 'all' : card.era))}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40'
                    : isCurrent
                      ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-data text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {card.buildRange}
                    </span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white">
                        현재 내 PC
                      </span>
                    )}
                  </div>
                  <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {card.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">재부팅 특성:</span>{' '}
                  {card.rebootTrait}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Searchable Network Evolution Matrix */}
      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              세부 변경 이력 & 파일 공유 적용 매트릭스 ({filteredItems.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              각 정책 변화가 실제 LAN 공유 시 일으키는 증상과 AhBiShare OneClick의 자동 적용·재부팅 판단 기준입니다.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="네트워크 변경 이력 및 적용 매트릭스 검색"
              placeholder="SMB 서명, 게스트, NTLM, 26H2 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 flex flex-wrap items-center gap-1.5">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredItems.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              검색 조건에 맞는 네트워크 변경 이력이 없습니다.
            </div>
          ) : (
            filteredItems.map((item) => {
              const rb = rebootLevelBadge(item.rebootLevel);
              return (
                <article key={item.id} className="p-6 space-y-3 hover:bg-slate-50/60 dark:hover:bg-slate-900/80 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {item.versionLabel} ({item.buildRange})
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                        {item.categoryLabel}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h4>
                    </div>
                    <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded border ${rb.badgeClass}`}>
                      {rb.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">OS 기본 동작 변화</div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.defaultBehavior}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
                      <div className="font-semibold text-amber-800 dark:text-amber-300">파일 공유 장애 영향</div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{item.sharingImpact}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-300">AhBiShare OneClick 적용 해법</div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{item.mitigationStrategy}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="tabular-data truncate max-w-full">
                      적용 대상: <code className="text-slate-700 dark:text-slate-300">{item.affectedRegistryOrCmdlet}</code>
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">{item.rebootNote}</span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
