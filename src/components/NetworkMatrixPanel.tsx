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
  ChevronUp,
  Trash2,
  Calendar,
  Clock,
  Activity,
  Usb,
  ListChecks,
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
  TroubleshootMatchResult,
  TroubleshootTicket,
  WindowsNetworkChangeItem,
  WindowsNetworkEra,
} from '@/types/share';
import {
  computeHostClientPolicyDiff,
  extractAutoAlignModes,
  extractHostPendingPlan,
  formatEraShortLabel,
  formatSnapshotTimestamp,
  getHostPolicyReferenceTargets,
  getPolicyPatchLabel,
  getWindowsEraSummaries,
  getWindowsNetworkMatrix,
} from '@/services/networkEvolution';
import { shareBridge } from '@/services/shareBridge';
import { SecurityRollbackReport } from '@/components/SecurityRollbackReport';
import { ExpertComparisonView } from '@/components/ExpertComparisonView';
import { useI18n } from '@/i18n/I18nContext';

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
  isRefreshing?: boolean;
  isAutoAligning?: boolean;
  isApplyingPendingHostTask?: boolean;
  isApplyingMode: PolicyPatchMode | null;
  onInspectPolicy: () => Promise<void>;
  onRefresh?: () => Promise<void>;
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
  troubleshootTickets?: TroubleshootTicket[];
  troubleshootMatch?: TroubleshootMatchResult;
  onOpenTroubleshootWizard?: (ticketId?: string) => void;
}

const CATEGORY_OPTIONS: Array<{
  id: 'all' | WindowsNetworkChangeItem['category'];
  koLabel: string;
  enLabel: string;
}> = [
  { id: 'all', koLabel: '전체 변경 항목', enLabel: 'All Changes' },
  { id: 'os_update_feature', koLabel: '별도 패치 · 기능', enLabel: 'Updates & Features' },
  { id: 'smb_signing', koLabel: 'SMB 서명', enLabel: 'SMB Signing' },
  { id: 'guest_auth', koLabel: '게스트 차단', enLabel: 'Guest Policy' },
  { id: 'ntlm', koLabel: 'NTLM 감축', enLabel: 'NTLM Hardening' },
  { id: 'name_resolution', koLabel: 'NetBIOS · WINS', enLabel: 'NetBIOS · WINS' },
  { id: 'quic_encryption', koLabel: 'QUIC · 암호화', enLabel: 'QUIC · Encryption' },
  { id: 'firewall_lsa', koLabel: 'LSA · 방화벽', enLabel: 'LSA · Firewall' },
  { id: 'rpc_printer', koLabel: 'RPC · 프린터 스풀러', enLabel: 'RPC · Print Spooler' },
];

function rebootLevelBadge(
  level: RebootRequirementLevel,
  tx: (ko: string, en: string) => string
): {
  label: string;
  badgeClass: string;
} {
  switch (level) {
    case 'none':
      return {
        label: tx('재부팅 불필요 (즉시 반영)', 'No Reboot Needed (Immediate)'),
        badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    case 'service_restart':
      return {
        label: tx('재부팅 불필요 (SMB 서비스 재시작)', 'No Reboot Needed (SMB Service Restart)'),
        badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    case 'reboot_recommended':
      return {
        label: tx('재부팅 권장', 'Reboot Recommended'),
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      };
    case 'reboot_required':
      return {
        label: tx('재부팅 필수', 'Reboot Required'),
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
  isRefreshing = false,
  isAutoAligning = false,
  isApplyingPendingHostTask = false,
  isApplyingMode,
  onInspectPolicy,
  onRefresh,
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
  troubleshootTickets = [],
  troubleshootMatch,
  onOpenTroubleshootWizard,
}) => {
  const { locale, tx } = useI18n();
  const hostPolicyReferenceTargets = useMemo(() => getHostPolicyReferenceTargets(), [locale]);
  const windowsEraSummaries = useMemo(() => getWindowsEraSummaries(), [locale]);
  const windowsNetworkMatrix = useMemo(() => getWindowsNetworkMatrix(), [locale]);
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
  const [expandedMenus, setExpandedMenus] = useState<{
    patchModes: boolean;
    securityAudit: boolean;
    osPatchFeature: boolean;
    crossPcDiff: boolean;
    expertComparison: boolean;
    eraTimeline: boolean;
    evolutionMatrix: boolean;
  }>({
    patchModes: true,
    securityAudit: false,
    osPatchFeature: false,
    crossPcDiff: false,
    expertComparison: false,
    eraTimeline: false,
    evolutionMatrix: false,
  });
  const [isFetchingRawRegistry, setIsFetchingRawRegistry] = useState(false);
  const [expertFetchResult, setExpertFetchResult] = useState<ExpertRegistryFetchResult | null>(null);
  const initializedPendingSourceRef = useRef<string | null>(null);

  const toggleMatrixMenu = (key: keyof typeof expandedMenus) => {
    setExpandedMenus((prev) => {
      const nextVal = !prev[key];
      if (key === 'expertComparison' && nextVal && !expertFetchResult) {
        void handleFetchRawRegistry();
      }
      return { ...prev, [key]: nextVal };
    });
  };

  const setAllMatrixMenus = (open: boolean) => {
    setExpandedMenus({
      patchModes: open,
      securityAudit: open,
      osPatchFeature: open,
      crossPcDiff: open,
      expertComparison: open,
      eraTimeline: open,
      evolutionMatrix: open,
    });
    if (open && !expertFetchResult) {
      void handleFetchRawRegistry();
    }
  };

  const expandedMenuCount = Object.values(expandedMenus).filter(Boolean).length;
  const totalMenuCount = 7;

  const isBusy = isInspecting || isRefreshing || isApplyingMode !== null || isAutoAligning || isApplyingPendingHostTask;
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
      if (hostPolicyReferenceTargets.some((p) => p.id === selectedHostKey)) return selectedHostKey;
    }
    if (remoteSnapshotKeys.length > 0) return remoteSnapshotKeys[0];
    return hostPolicyReferenceTargets[0].id;
  }, [selectedHostKey, hostPolicySnapshots, remoteSnapshotKeys, hostPolicyReferenceTargets]);

  const activePreset = useMemo(
    () => hostPolicyReferenceTargets.find((p) => p.id === effectiveSourceId) || null,
    [effectiveSourceId, hostPolicyReferenceTargets]
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
  }, [selectedHostSnap, policyStatus, locale]);

  const diffConflictModes = useMemo(() => extractAutoAlignModes(crossPcDiffs), [crossPcDiffs]);
  const conflictRows = useMemo(
    () => crossPcDiffs.filter((row) => row.status === 'conflict'),
    [crossPcDiffs]
  );
  const hostSideRows = useMemo(
    () => crossPcDiffs.filter((row) => (row.actionTarget === 'host' || row.actionTarget === 'both') && row.status !== 'match'),
    [crossPcDiffs]
  );
  const hostPendingPlan = useMemo(() => extractHostPendingPlan(crossPcDiffs), [crossPcDiffs, locale]);

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
          ? tx(
              `로컬 PC와 연결 호스트(${result.hostSnapshot.hostName})의 원시 레지스트리를 실시간 조회했습니다.`,
              `Queried live raw registry values for this PC and remote host (${result.hostSnapshot.hostName}).`
            )
          : tx(
              '로컬 및 대상 호스트의 10대 보안 정책 원시 레지스트리 비교표를 갱신했습니다.',
              'Updated the 10-point security policy raw registry comparison for local and target host.'
            )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : tx('알 수 없는 오류', 'Unknown error');
      onNotify?.(tx(`원시 레지스트리 조회 실패: ${msg}`, `Raw registry query failed: ${msg}`));
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
    return windowsNetworkMatrix.filter((item) => {
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
  }, [windowsNetworkMatrix, selectedEra, selectedCategory, searchQuery]);

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
    setExpandedMenus((prev) => (prev.crossPcDiff ? prev : { ...prev, crossPcDiff: true }));
    window.setTimeout(() => {
      const el = document.getElementById('cross-pc-policy-diff');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  const handleRunHostProbe = async () => {
    if (!onProbeRemoteHost) return;
    const target = probeTargetIp.trim() || selectedHostSnap?.sourceIp || selectedHostSnap?.hostName || '';
    if (!target) {
      const msg = tx(
        '진단할 호스트 IP 주소 또는 컴퓨터 이름을 입력하세요.',
        'Enter a host IP address or computer name to probe.'
      );
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
          ? tx(
              `${result.target} 응답 확인 (TCP 445 ${result.smbPortOpen ? 'OPEN' : 'CLOSED'})`,
              `${result.target} reachable (TCP 445 ${result.smbPortOpen ? 'OPEN' : 'CLOSED'})`
            )
          : tx(
              `${result.target} 응답 없음 — 방화벽·IP 대역을 확인하세요.`,
              `${result.target} unreachable — check firewall or IP subnet.`
            )
      );
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : tx('호스트 IP 진단 중 오류가 발생했습니다.', 'An error occurred while probing the host IP.');
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
      onNotify?.(
        tx(
          'USB 대기 작업을 저장할 대상 호스트 컴퓨터 이름을 입력하세요.',
          'Enter the target host computer name for the queued USB task.'
        )
      );
      return;
    }
    if (pendingModesDraft.length === 0 && !pendingIncludeGuestUnlock) {
      onNotify?.(
        tx(
          '최소 1개 이상의 호스트 적용 정책 항목을 선택하세요.',
          'Select at least one host policy item to apply.'
        )
      );
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
        : [
            tx(
              '- 감지된 호스트-클라이언트 정책 불일치가 없습니다. (양단 공유 정책 호환 상태)',
              '- No host-client policy conflicts detected. (Both endpoints are compatible.)'
            ),
          ];
    const guideText = [
      tx(
        `[AhBiShare OneClick 호스트 PC(${selectedHostSnap.hostName}) 정책 정렬 안내]`,
        `[AhBiShare OneClick Host PC (${selectedHostSnap.hostName}) Policy Alignment Guide]`
      ),
      ...guideBody,
      tx(
        '조치 방법: 호스트 PC에서 AhBiShare OneClick을 실행하면 USB에 예약된 대기 작업을 원클릭 적용하거나 [OS 호환성 매트릭스] 탭 > [안전 호환 원클릭 적용]으로 해결할 수 있습니다.',
        'Action: Run AhBiShare OneClick on the host PC to 1-click apply the queued USB task, or open [OS Compatibility Matrix] > [Apply Safe Compat (1-Click)].'
      ),
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
        ? tx(
            '호스트 PC 정책 조치 안내를 클립보드에 복사했습니다.',
            'Host PC policy action guide copied to clipboard.'
          )
        : tx(
            '클립보드 복사에 실패했습니다. 아래 비교표를 직접 확인하세요.',
            'Failed to copy to clipboard. Check the comparison table below.'
          )
    );
  };

  const judgment = lastPatchResult?.rebootJudgment;

  const activeMatrixTicket =
    troubleshootMatch?.primaryTicket ||
    troubleshootMatch?.waitingOtherPcTickets[0] ||
    troubleshootTickets.find((t) => t.status !== 'resolved') ||
    null;
  const activeTicketMatchedSide = activeMatrixTicket
    ? troubleshootMatch?.matchedSideMap[activeMatrixTicket.ticketId] || 'none'
    : 'none';
  const activeTicketAllSteps = activeMatrixTicket
    ? [...activeMatrixTicket.hostSteps, ...activeMatrixTicket.clientSteps]
    : [];
  const activeTicketMatrixSyncedCount = activeTicketAllSteps.filter(
    (s) => s.status === 'completed' && s.resolvedSource && s.resolvedSource !== 'wizard'
  ).length;
  const activeTicketRemainingRetryCount = activeTicketAllSteps.filter(
    (s) => s.status === 'pending' || s.status === 'failed'
  ).length;

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
                {tx('감지된 OS', 'Detected OS')}: {policyStatus?.osProductName || netInfo.osProductName || 'Windows'} · {formatEraShortLabel(currentEra, currentBuild, currentDisp)}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {tx(
                'Windows 세대별 네트워크 정책 변화 & 파일 공유 자동 호환 엔진',
                'Windows Generation Network Policy Changes & Auto File-Sharing Compatibility Engine'
              )}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {tx(
                'Windows 10부터 Windows 11 24H2·25H2·26H2까지 강화된 SMB 서명·게스트 차단·NTLM·NetBIOS 정책을 진단하고, 재부팅 필요 여부를 판정하여 안전하게 적용합니다.',
                'Diagnoses tightened SMB signing, guest blocks, NTLM, and NetBIOS policies from Windows 10 through Windows 11 24H2–26H2, evaluates reboot requirements, and applies patches safely.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                id="btn-refresh-matrix"
                type="button"
                disabled={isBusy}
                onClick={() => void onRefresh()}
                className="px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                {isRefreshing ? tx('새로고침 중...', 'Refreshing...') : tx('새로고침', 'Refresh')}
              </button>
            )}
            <button
              id="btn-inspect-os-policy"
              type="button"
              disabled={isBusy}
              onClick={() => void onInspectPolicy()}
              className="px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
              {isInspecting
                ? tx('OS 정책 분석 중...', 'Analyzing OS Policy...')
                : tx('현재 OS 네트워크 정책 재검사', 'Re-inspect OS Network Policy')}
            </button>
          </div>
        </div>

        {/* Live Telemetry Cards */}
        {policyStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('공유 호환 지수', 'Sharing Compatibility Score')}</div>
                <div
                  className={`mt-1 tabular-data text-base font-bold ${
                    policyStatus.compatibilityScore >= 85
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : policyStatus.compatibilityScore >= 60
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {policyStatus.compatibilityScore}{tx('점 / 100', ' / 100')}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('프로필 · TCP 445 방화벽', 'Profile · TCP 445 Firewall')}</div>
                <div
                  className={`mt-1 tabular-data font-bold ${
                    policyStatus.networkProfile === 'Public' || policyStatus.firewall445Allowed === false
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.networkProfile} ·{' '}
                  {policyStatus.firewall445Allowed === false ? tx('445 차단', '445 Blocked') : tx('445 허용', '445 Allowed')}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('SMB 클라이언트 서명', 'SMB Client Signing')}</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.smbClientSigningRequired
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.smbClientSigningRequired
                    ? tx('강제됨 (24H2 기본)', 'Required (24H2 Default)')
                    : tx('호환 완화', 'Compatible (Relaxed)')}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('게스트 로그온 · 계정(*-501)', 'Guest Logon · Account (*-501)')}</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.allowInsecureGuestAuth &&
                    !policyStatus.guestNetworkLogonDenied &&
                    policyStatus.guestAccountEnabled !== false
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {policyStatus.allowInsecureGuestAuth ? tx('허용', 'Allowed') : tx('차단', 'Blocked')} ·{' '}
                  {policyStatus.guestAccountEnabled === false ? tx('계정 OFF', 'Acct OFF') : tx('계정 ON', 'Acct ON')}
                  {policyStatus.guestNetworkLogonDenied ? tx(' · 거부(1385)', ' · Denied (1385)') : ''}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('LSA 빈 암호(86) · 익명(1223)', 'LSA Blank Pwd (86) · Anon (1223)')}</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.limitBlankPasswordUse ||
                    policyStatus.restrictNullSessAccess ||
                    policyStatus.restrictAnonymous
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.limitBlankPasswordUse ? tx('빈암호 제한(86)', 'Blank Pwd Restricted (86)') : tx('빈암호 허용', 'Blank Pwd Allowed')} ·{' '}
                  {policyStatus.restrictNullSessAccess || policyStatus.restrictAnonymous ? tx('익명 제한', 'Anon Restricted') : tx('익명 완화', 'Anon Relaxed')}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('NTLM 수준 / NetBT', 'NTLM Level / NetBT')}</div>
                <div className="mt-1 tabular-data font-bold text-slate-900 dark:text-slate-100">
                  Lm={policyStatus.lmCompatibilityLevel ?? tx('기본', 'Default')} · {policyStatus.netbiosEnabled ? 'NetBT ON' : 'OFF'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('프린터 RPC / 스풀러', 'Printer RPC / Spooler')}</div>
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
                    ? tx('Named Pipe 호환', 'Named Pipe Compat')
                    : tx('엄격 RPC', 'Strict RPC')} · {policyStatus.printSpoolerRunning ? 'Spooler ON' : 'OFF'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                <div className="text-slate-500 dark:text-slate-400">{tx('보류 재부팅 상태', 'Pending Reboot Status')}</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.pendingRebootFlag
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.pendingRebootFlag ? tx('재부팅 대기 중', 'Reboot Pending') : tx('없음 (정상)', 'None (OK)')}
                </div>
              </div>
            </div>

            {policyStatus.detectedIssues.length > 0 ? (
              <div className="p-4 rounded-lg border border-amber-500/35 bg-amber-500/10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {tx(
                      `현재 OS에서 감지된 파일 공유 장애 요인 (${policyStatus.detectedIssues.length}건)`,
                      `File-Sharing Blockers Detected on This OS (${policyStatus.detectedIssues.length})`
                    )}
                  </span>
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
                <span>
                  {tx(
                    `현재 OS 네트워크 정책이 Win 10~11 26H2 이기종 파일 공유 호환 상태(점검 시각 ${policyStatus.checkedAt})로 정렬되어 있습니다.`,
                    `OS network policies are aligned for Win 10–11 26H2 cross-version file sharing (checked at ${policyStatus.checkedAt}).`
                  )}
                </span>
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
                    {tx(
                      `호스트-클라이언트 정책 불일치 ${conflictRows.length}건 감지 · 원클릭 자동 정렬 대기`,
                      `${conflictRows.length} Host–Client Policy Conflicts Detected · Ready for 1-Click Auto-Align`
                    )}
                  </span>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {tx('비교 대상', 'Comparing against')}: {selectedHostSnap.hostName} ({formatEraShortLabel(selectedHostSnap.osEra, selectedHostSnap.osBuild, selectedHostSnap.osDisplayVersion)})
                    {selectedHostSnap.capturedAt ? ` · ${tx('감지 일시', 'Captured')}: ${formatSnapshotTimestamp(selectedHostSnap.capturedAt)}` : ''}
                    {isPresetTarget ? tx(' (권장 호환 기준)', ' (Recommended Baseline)') : tx(' (USB 포터블 호스트)', ' (USB Portable Host)')}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {tx('감지 항목', 'Detected')}: <span className="font-semibold">{conflictRows.map((r) => r.label).join(' · ')}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  {tx('적용 예정 패치', 'Planned Patches')}:{' '}
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
                      {tx('삭제 확정', 'Confirm Delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteKey(null)}
                      className="px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                    >
                      {tx('취소', 'Cancel')}
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
                    {tx('이 스냅샷 삭제', 'Delete Snapshot')}
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
                {tx(`불일치 상세 비교 (${crossPcDiffs.length})`, `View Diff Details (${crossPcDiffs.length})`)}
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
                  ? tx('불일치 정책 자동 정렬 중...', 'Auto-Aligning Policies...')
                  : tx(
                      `불일치 정책 원클릭 자동 정렬 (${diffConflictModes.length}종)`,
                      `1-Click Auto-Align Policies (${diffConflictModes.length})`
                    )}
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
              {tx('양단 비교표 확인', 'View Endpoint Comparison')}
            </button>
          </div>
        )}

        {activeMatrixTicket && (
          <div
            id="matrix-wizard-sync-banner"
            className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/8 dark:bg-amber-500/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {tx('USB 오류 티켓과 실시간 양방향 동기화 중', 'Live 2-Way Sync with USB Error Ticket')} ({activeMatrixTicket.errorCode} · \\
                  {activeMatrixTicket.targetIp || activeMatrixTicket.targetHostName || 'HOST'}\
                  {activeMatrixTicket.shareName})
                </div>
                <p className="tabular-data text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {tx('매칭 역할', 'Matched Role')}:{' '}
                  {activeTicketMatchedSide === 'both'
                    ? tx('호스트 · 클라이언트 모두', 'Both Host & Client')
                    : activeTicketMatchedSide === 'host'
                      ? tx('메인 호스트 PC', 'Main Host PC')
                      : activeTicketMatchedSide === 'client'
                        ? tx('클라이언트 PC', 'Client PC')
                        : tx('반대편 PC 대기', 'Waiting for Remote PC')}{' '}
                  · {tx(`정책 자동 반영 ${activeTicketMatrixSyncedCount}단계`, `Auto-synced ${activeTicketMatrixSyncedCount} steps`)} · {tx(`남은 실행/재시도 ${activeTicketRemainingRetryCount}단계`, `${activeTicketRemainingRetryCount} remaining`)}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {tx(
                    '이 화면에서 정책 패치를 적용하거나 보안 원복을 실행하면 USB 오류 마법사 단계와 호스트 대기 작업이 자동으로 함께 갱신됩니다.',
                    'Applying patches or rolling back security here automatically updates the USB troubleshooting wizard and pending host tasks.'
                  )}
                </p>
              </div>
            </div>
            {onOpenTroubleshootWizard && (
              <button
                id="btn-matrix-open-wizard"
                type="button"
                disabled={isBusy}
                onClick={() => onOpenTroubleshootWizard(activeMatrixTicket.ticketId)}
                className="px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 self-end lg:self-center"
              >
                <ListChecks className="w-3.5 h-3.5" />
                {tx('단계별 해결 마법사 열기', 'Open Step-by-Step Wizard')}
              </button>
            )}
          </div>
        )}

        {/* Menu Collapse / Expand Toolbar */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="tabular-data text-xs text-slate-600 dark:text-slate-400">
            {tx(
              `매트릭스 하위 메뉴 · ${expandedMenuCount} / ${totalMenuCount} 펼침`,
              `Matrix Sub-menus · ${expandedMenuCount} / ${totalMenuCount} expanded`
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-matrix-expand-all"
              type="button"
              disabled={expandedMenuCount === totalMenuCount}
              onClick={() => setAllMatrixMenus(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              {tx('전체 펼치기', 'Expand All')}
            </button>
            <button
              id="btn-matrix-collapse-all"
              type="button"
              disabled={expandedMenuCount === 0}
              onClick={() => setAllMatrixMenus(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              {tx('전체 접기', 'Collapse All')}
            </button>
          </div>
        </div>

        {/* 1-Click Patch Presets (Collapsible) */}
        <div id="matrix-patch-modes-section" className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button
            id="btn-toggle-matrix-patch-modes"
            type="button"
            aria-expanded={expandedMenus.patchModes}
            onClick={() => toggleMatrixMenu('patchModes')}
            className="w-full flex items-center justify-between gap-3 text-left cursor-pointer group"
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {tx('원클릭 정책 적용 모드 & 재부팅 판정 실행', '1-Click Policy Modes & Reboot Judgment')}
              </h3>
              <span className="tabular-data text-xs text-slate-500 dark:text-slate-400">
                · {tx('안전 호환 · TCP/IP 초기화 · 26H2 복원 · 프린터 RPC (5종)', 'Safe Compat · Stack Reset · 26H2 Restore · Printer RPC (5)')}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
              {expandedMenus.patchModes ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {tx('접기', 'Collapse')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {tx('펼치기', 'Expand')}
                </>
              )}
            </span>
          </button>

          {expandedMenus.patchModes && (
            <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border-2 border-indigo-500/40 bg-indigo-500/5 dark:bg-indigo-500/10 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    {tx('OS 빌드 맞춤 안전 호환 패치', 'OS Build-Tuned Safe Compat Patch')}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-600 text-white">
                    {tx('권장', 'Recommended')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {locale === 'en' ? (
                    <>Relaxes 24H2–26H2 SMB signing, guest auth, NTLMv2, and Private profile, then <strong className="font-semibold">restarts SMB services immediately</strong> without rebooting.</>
                  ) : (
                    <>24H2~26H2 SMB 서명 완화·게스트 호환·NTLMv2·개인 프로필 정렬 후 <strong className="font-semibold">SMB 서비스를 즉시 재시작</strong>해 재부팅 없이 바로 공유합니다.</>
                  )}
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
                {isApplyingMode === 'safe_compat'
                  ? tx('안전 호환 패치 적용 중...', 'Applying Safe Compat Patch...')
                  : tx('안전 호환 원클릭 적용 (즉시 반영)', 'Apply Safe Compat (Immediate)')}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    {tx('심층 TCP/IP · Winsock 초기화', 'Deep TCP/IP · Winsock Reset')}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
                    {tx('재부팅 필요', 'Reboot Needed')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {locale === 'en' ? (
                    <>Runs <code className="tabular-data">netsh winsock/int ip reset</code> for recurring 0x80070035 or socket errors. Flags a reboot for kernel-level changes.</>
                  ) : (
                    <>반복적인 0x80070035·소켓 오류 시 <code className="tabular-data">netsh winsock/int ip reset</code>을 수행합니다. 커널 적용을 위해 재부팅 판정이 내려집니다.</>
                  )}
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
                {isApplyingMode === 'deep_stack_reset'
                  ? tx('스택 초기화 중...', 'Resetting Stack...')
                  : tx('심층 네트워크 스택 초기화 실행', 'Run Deep Network Stack Reset')}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <Lock className="w-4 h-4 text-slate-500" />
                    {tx('Win 11 26H2 표준 보안 복원', 'Restore Win 11 26H2 Security Defaults')}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    {tx('재부팅 불필요', 'No Reboot')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {tx(
                    '공유 종료 후 SMB 서명 강제·게스트 차단·LSA 익명 차단 등 Microsoft 최신 SFI 기본 보안 정책으로 즉시 되돌립니다.',
                    'After sharing ends, immediately restores Microsoft SFI security defaults including SMB signing, guest block, and LSA anonymous restriction.'
                  )}
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
                {isApplyingMode === 'strict_26h2_default'
                  ? tx('보안 기본값 복원 중...', 'Restoring Security Defaults...')
                  : tx('26H2 표준 보안으로 복원', 'Restore 26H2 Standard Security')}
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
                    {tx(
                      'Win 11 26H2 프린터 RPC · 스풀러 호환 패치 (0x0000011b / 0x00000709)',
                      'Win 11 26H2 Printer RPC & Spooler Compat (0x0000011b / 0x00000709)'
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                    {tx('Spooler 재시작', 'Spooler Restart')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {tx(
                    'RpcAuthnLevelPrivacyEnabled=0, RPC Named Pipes 활성화, Point and Print 제한 완화 적용 후 Print Spooler를 즉시 재시작합니다.',
                    'Applies RpcAuthnLevelPrivacyEnabled=0, enables RPC Named Pipes, relaxes Point and Print restrictions, and restarts Print Spooler immediately.'
                  )}
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
                {isApplyingMode === 'rpc_printer_compat'
                  ? tx('프린터 RPC 패치 적용 중...', 'Applying Printer RPC Patch...')
                  : tx('프린터 RPC·스풀러 호환 원클릭 적용', 'Apply Printer RPC & Spooler Compat (1-Click)')}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    {tx('프린터 RPC 표준 보안 정책 복원', 'Restore Printer RPC Security Defaults')}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                    {tx('Spooler 재시작', 'Spooler Restart')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {tx(
                    '공유 프린터 작업 완료 후 RpcAuthnLevelPrivacyEnabled=1 및 RPC over TCP 기본 보안 설정으로 즉시 복원합니다.',
                    'Restores RpcAuthnLevelPrivacyEnabled=1 and default RPC over TCP security settings after shared printing finishes.'
                  )}
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
                {isApplyingMode === 'rpc_printer_default'
                  ? tx('프린터 보안 복원 중...', 'Restoring Printer Security...')
                  : tx('프린터 RPC 기본 보안으로 복원', 'Restore Printer RPC Security Defaults')}
              </button>
            </div>
          </div>
            </>
          )}
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
                      {tx('재부팅 판정', 'Reboot Judgment')}:{' '}
                      {judgment
                        ? judgment.title
                        : tx('Windows 보류 중인 시스템 재부팅 감지됨', 'Pending Windows System Reboot Detected')}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold rounded border ${
                        rebootLevelBadge(
                          judgment ? judgment.level : 'reboot_recommended',
                          tx
                        ).badgeClass
                      }`}
                    >
                      {rebootLevelBadge(judgment ? judgment.level : 'reboot_recommended', tx).label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {judgment
                      ? judgment.reason
                      : tx(
                          'Windows Update 또는 이전 드라이버/네트워크 변경으로 인해 대기 중인 재부팅 플래그가 감지되었습니다.',
                          'A pending reboot flag was detected due to Windows Update or a prior driver/network change.'
                        )}
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
                      {tx('지금 컴퓨터 재부팅', 'Reboot PC Now')}
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
                        {isRebooting ? tx('예약 중...', 'Scheduling...') : tx('5초 후 재부팅 확정', 'Confirm Reboot in 5s')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingReboot(false)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        {tx('취소', 'Cancel')}
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
        collapsible
        isExpanded={expandedMenus.securityAudit}
        onToggleExpanded={() => toggleMatrixMenu('securityAudit')}
      />

      {/* Separate Windows OS Patch & Optional Feature Diagnostic Panel */}
      <section
        id="os-patch-feature-diagnosis"
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
      >
        {(() => {
          const isHome = /core|home/i.test(policyStatus?.osEditionId || policyStatus?.osProductName || '');
          const isEarly24h2 =
            currentBuild === 26100 &&
            typeof policyStatus?.osUbr === 'number' &&
            policyStatus.osUbr > 0 &&
            policyStatus.osUbr < 2314;
          const hotfixList = policyStatus?.recentHotfixIds || [];
          const kirApplied = policyStatus?.kirOverride1517186191 === 0;
          const dupSidEvent = Boolean(policyStatus?.duplicateSidEvent6167Detected);
          const crossPcSameSid = Boolean(
            policyStatus?.machineSidPrefix &&
              selectedHostSnap?.machineSidPrefix &&
              selectedHostSnap.hostName.trim().toLowerCase() !== netInfo.hostname.trim().toLowerCase() &&
              policyStatus.machineSidPrefix === selectedHostSnap.machineSidPrefix
          );
          const dupSidRisk = (dupSidEvent || crossPcSameSid) && !kirApplied;
          const hasSpecialRisk = Boolean(isEarly24h2 || policyStatus?.msaPinOnlyRisk || dupSidRisk);
          const smb1State = policyStatus?.smb1ClientFeatureState || 'Disabled';
          const uacFilterEnabled = Boolean(policyStatus?.localAccountTokenFilterEnabled);

          return (
            <>
              <button
                id="btn-toggle-os-patch-feature"
                type="button"
                aria-expanded={expandedMenus.osPatchFeature}
                onClick={() => toggleMatrixMenu('osPatchFeature')}
                className={`w-full px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-left cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors ${
                  expandedMenus.osPatchFeature ? 'border-b border-slate-200 dark:border-slate-800' : ''
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {hasSpecialRisk ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    <span>{tx('별도 Windows 패치 · 선택적 기능 필요 여부 진단', 'Optional Windows Patch & Feature Diagnostics')}</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {dupSidRisk
                      ? tx(
                          '복제 OS 동일 Machine SID 차단(KB5065426 · Event 6167)이 감지되었습니다. 펼쳐서 KIR(1517186191=0) 적용 후 재부팅하세요.',
                          'Duplicate Machine SID block on cloned OS (KB5065426 · Event 6167) detected. Expand to apply KIR (1517186191=0) and reboot.'
                        )
                      : hasSpecialRisk
                        ? tx(
                            '초기 24H2 빌드 리비전 또는 MS 계정·PIN 환경이 감지되었습니다. 펼쳐서 해당 항목의 조치를 확인하세요.',
                            'Early 24H2 build revision or Microsoft Account/PIN environment detected. Expand to check the corresponding action.'
                          )
                        : tx(
                            '일반 Windows 10~11 PC 간 공유에는 별도 업데이트가 불필요하며, 구형 NAS·관리자 접속·PIN·OS 복제 SID 등 특수 환경 진단(4종)을 제공합니다.',
                            'Standard Win 10–11 PC sharing requires no extra updates; provides 4 diagnostics for legacy NAS, admin shares, PIN logins, or cloned OS SIDs.'
                          )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="tabular-data text-xs text-slate-600 dark:text-slate-300">
                    {tx('에디션', 'Edition')}: {policyStatus?.osEditionId || 'Pro'}
                    {isHome ? tx(' (No gpedit)', ' (No gpedit)') : ''} · {tx('빌드', 'Build')} {currentBuild}
                    {typeof policyStatus?.osUbr === 'number' ? `.${policyStatus.osUbr}` : ''}
                  </span>
                  <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    {expandedMenus.osPatchFeature ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        {tx('접기', 'Collapse')}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        {tx('펼치기', 'Expand')}
                      </>
                    )}
                  </span>
                </div>
              </button>

              {expandedMenus.osPatchFeature && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* 1. UAC LocalAccountTokenFilterPolicy */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        <KeyRound className="w-4 h-4 text-indigo-500 shrink-0" />
                        {tx('UAC 원격 토큰 필터', 'UAC Remote Token Filter')}
                      </span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          uacFilterEnabled
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {uacFilterEnabled ? tx('허용 (완화됨)', 'Allowed (Relaxed)') : tx('차단 (기본)', 'Blocked (Default)')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {locale === 'en' ? (
                        <>Applies <code className="tabular-data">LocalAccountTokenFilterPolicy=1</code> immediately if remote workgroup local-admin access triggers System Error 5 (Access Denied).</>
                      ) : (
                        <>워크그룹에서 로컬 관리자 계정 원격 접속 시 System Error 5(액세스 거부)가 발생할 때 <code className="tabular-data">LocalAccountTokenFilterPolicy=1</code>을 즉시 적용합니다.</>
                      )}
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
                      ? tx('정책 적용 중...', 'Applying Policy...')
                      : uacFilterEnabled
                        ? tx('기본 보안(차단)으로 되돌리기', 'Revert to Default (Blocked)')
                        : tx('UAC 원격 토큰 허용 적용 (즉시)', 'Allow UAC Remote Token (Immediate)')}
                  </button>
                </div>

                {/* 2. Legacy NAS / Copier SMBv1 Client */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        <HardDriveDownload className="w-4 h-4 text-amber-500 shrink-0" />
                        {tx('구형 NAS · 복합기 SMBv1', 'Legacy NAS · MFP SMBv1')}
                      </span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          smb1State === 'Enabled'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {smb1State === 'Enabled' ? tx('설치됨', 'Installed') : tx('미설치 (기본)', 'Not Installed')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {locale === 'en' ? (
                        <>Not needed for regular PC sharing; only for pre-2015 NAS/scanners. Installing requires a <strong>reboot</strong> to load kernel drivers.</>
                      ) : (
                        <>일반 PC 공유에는 불필요하며, 2015년 이전 구형 NAS·스캐너 전용입니다. 설치 시 커널 드라이버 로드를 위해 <strong>재부팅이 필수</strong>입니다.</>
                      )}
                    </p>
                  </div>

                  {smb1State === 'Enabled' ? (
                    <div className="w-full py-2.5 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                      {tx('SMB1Protocol-Client 기능 설치 완료', 'SMB1Protocol-Client Feature Installed')}
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
                      {tx('구형 장비용 SMBv1 클라이언트 설치', 'Install SMBv1 Client (Legacy)')}
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
                        {isApplyingMode === 'enable_smbv1_client'
                          ? tx('설치 중...', 'Installing...')
                          : tx('재부팅 감수 설치 확정', 'Confirm Install (Reboot Req.)')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingSmbv1(false)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        {tx('취소', 'Cancel')}
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
                        {tx('누적 패치(KB) · 계정 유형', 'Cumulative Updates (KB) · Account')}
                      </span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          isEarly24h2 || policyStatus?.msaPinOnlyRisk
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isEarly24h2
                          ? tx('업데이트 권고', 'Update Recommended')
                          : policyStatus?.msaPinOnlyRisk
                            ? tx('PIN 로그인 감지', 'PIN Login Detected')
                            : tx('정상', 'OK')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed tabular-data">
                      {tx('최근 KB', 'Recent KBs')}: {hotfixList.length > 0 ? hotfixList.slice(0, 3).join(' · ') : tx('조회된 HotFix 없음', 'No HotFix found')}
                      <br />
                      {policyStatus?.msaPinOnlyRisk
                        ? tx(
                            'MS 계정/PIN 전용 로그인 감지 — 호스트 개설 시 [전용 보안 공유 계정] 모드를 사용하세요.',
                            'Microsoft Account/PIN login detected — use [Dedicated Secure Share Account] mode when sharing.'
                          )
                        : tx(
                            '별도 OS 핫픽스 없이 즉시 공유 가능하며, 초기 24H2 장애 시 누적 업데이트만 확인하세요.',
                            'Ready to share without extra OS hotfixes; only check cumulative updates on early 24H2 builds.'
                          )}
                    </p>
                  </div>

                  <button
                    id="btn-open-windows-update"
                    type="button"
                    onClick={() => void onOpenWindowsUpdate()}
                    className="w-full py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {tx('Windows Update 설정 열기', 'Open Windows Update Settings')}
                  </button>
                </div>

                {/* 4. Cloned OS Duplicate Machine SID Block (KB5065426 / Event 6167 / KIR 1517186191=0) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                        {tx('OS 복제 중복 SID 차단', 'Cloned OS Duplicate SID Block')}
                      </span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          kirApplied
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : dupSidRisk
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {kirApplied
                          ? tx('KIR 해제 적용됨', 'KIR Bypass Applied')
                          : dupSidRisk
                            ? tx('차단 감지 (6167)', 'Block Detected (6167)')
                            : tx('미감지 (대기)', 'Not Detected (Standby)')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {locale === 'en' ? (
                        <>Bypasses Error 86 on cloned OS PCs with matching Machine SIDs (KB5065426) via <code className="tabular-data">1517186191=0</code> (<strong>Reboot Required</strong>).</>
                      ) : (
                        <>OS 복제 PC 간 동일 Machine SID로 Win 11 24H2/25H2(KB5065426)가 Error 86을 유발할 때 <code className="tabular-data">1517186191=0</code>으로 우회합니다 (<strong>재부팅 필수</strong>).</>
                      )}
                      {policyStatus?.machineSidPrefix && (
                        <>
                          <br />
                          <span className="tabular-data text-[11px] text-slate-500 dark:text-slate-400">
                            SID: {policyStatus.machineSidPrefix}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {kirApplied ? (
                    <div className="w-full py-2.5 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                      {tx('KIR(1517186191=0) 중복 SID 우회 적용됨', 'KIR (1517186191=0) Duplicate SID Bypass Active')}
                    </div>
                  ) : (
                    <button
                      id="btn-apply-kir-dup-sid"
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onApplyPatch('kir_duplicate_sid_compat')}
                      className={`w-full py-2.5 px-3 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        dupSidRisk
                          ? 'text-white bg-rose-600 hover:bg-rose-500'
                          : 'text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {isApplyingMode === 'kir_duplicate_sid_compat'
                        ? tx('KIR 정책 적용 중...', 'Applying KIR Policy...')
                        : tx('중복 SID 차단 해제(KIR) 적용', 'Apply Duplicate SID Bypass (KIR)')}
                    </button>
                  )}
                </div>
              </div>
              )}
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
        <div
          className={`px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
            expandedMenus.crossPcDiff ? 'border-b border-slate-200 dark:border-slate-800' : ''
          }`}
        >
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-indigo-500 shrink-0" />
              {tx(
                '메인 PC vs 클라이언트 PC 양단 정책 진단 & 3단계 원클릭 해결 마법사',
                'Host vs Client Endpoint Policy Diagnostics & 3-Step 1-Click Wizard'
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPresetTarget
                ? tx(
                    `원격 USB 호스트 스냅샷 대신 '${selectedHostSnap?.hostName}' 기준과 대조 중입니다. 호스트 PC에서 앱을 실행하면 실제 스냅샷이 자동 기록됩니다.`,
                    `Comparing against '${selectedHostSnap?.hostName}' baseline. Running the app on the host PC records its live snapshot automatically.`
                  )
                : isSelfComparison
                  ? tx(
                      `현재 PC(${netInfo.hostname})의 저장 스냅샷과 실시간 정책을 대조 중입니다.`,
                      `Comparing saved snapshot of this PC (${netInfo.hostname}) against its live policies.`
                    )
                  : tx(
                      `USB 포터블 설정(${selectedHostSnap?.hostName}${selectedHostSnap?.sourceIp ? ` · ${selectedHostSnap.sourceIp}` : ''})과 현재 PC 정책을 심층 대조합니다.`,
                      `Deep comparison between USB portable host snapshot (${selectedHostSnap?.hostName}${selectedHostSnap?.sourceIp ? ` · ${selectedHostSnap.sourceIp}` : ''}) and this PC.`
                    )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="tabular-data text-[11px] font-medium text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span className={selectedHostSnap ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''}>
                {tx('01 대상·IP 프로브', '01 Target · IP Probe')}
              </span>
              <span>→</span>
              <span className={diffConflictModes.length === 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'font-semibold text-slate-800 dark:text-slate-200'}>
                {tx(
                  `02 내 PC 정렬 (${diffConflictModes.length === 0 ? '완료' : `${diffConflictModes.length}종 대기`})`,
                  `02 Align Local PC (${diffConflictModes.length === 0 ? 'Done' : `${diffConflictModes.length} pending`})`
                )}
              </span>
              <span>→</span>
              <span className={pendingTaskList.length > 0 ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''}>
                {tx(`03 호스트 USB 예약 (${pendingTaskList.length}건)`, `03 Queue USB Task (${pendingTaskList.length})`)}
              </span>
            </div>

            <button
              id="btn-toggle-cross-pc-diff"
              type="button"
              aria-expanded={expandedMenus.crossPcDiff}
              onClick={() => toggleMatrixMenu('crossPcDiff')}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {expandedMenus.crossPcDiff ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  {tx('접기', 'Collapse')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  {tx(`진단·비교표 펼치기 (${diffCounts.issues})`, `Expand Diagnostics (${diffCounts.issues})`)}
                </>
              )}
            </button>
          </div>
        </div>

        {expandedMenus.crossPcDiff && (
        <>

        {/* 3-Step Resolution Wizard Cards (Single-elevation divided grid) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
          {/* STEP 01: Target Selection & Live IP Probe */}
          <div className="p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-data text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {tx('STEP 01 · 대상 선택 & 실시간 IP 프로브', 'STEP 01 · Target & Live IP Probe')}
                </span>
                {allSavedSnapshotKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSnapshotHistory((v) => !v)}
                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3" />
                    {tx(`스냅샷 목록 (${allSavedSnapshotKeys.length})`, `Snapshots (${allSavedSnapshotKeys.length})`)}
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
                        {tx('원격 호스트', 'Remote Host')}: {key}{snap?.sourceIp ? ` (${snap.sourceIp})` : ''}{eraText ? ` · ${eraText}` : ''}{ts ? ` · ${ts}` : ''}
                      </option>
                    );
                  })}
                  {hostPolicyReferenceTargets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {tx('기준', 'Baseline')}: {preset.label}
                    </option>
                  ))}
                  {localSnapshotKey && (
                    <option key={localSnapshotKey} value={localSnapshotKey}>
                      {tx('현재 PC 스냅샷', 'This PC Snapshot')}: {localSnapshotKey}
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
                          {tx('삭제 확정', 'Confirm Delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteKey(null)}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md cursor-pointer"
                        >
                          {tx('취소', 'Cancel')}
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
                        {tx('이 스냅샷 삭제', 'Delete Snapshot')}
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
                              setSelectedHostKey(hostPolicyReferenceTargets[0].id);
                            } finally {
                              setDeletingSnapKey(null);
                              setConfirmingClearAll(false);
                            }
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 rounded-md cursor-pointer disabled:opacity-50"
                        >
                          {tx('전체 비우기 확정', 'Confirm Clear All')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingClearAll(false)}
                          className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md cursor-pointer"
                        >
                          {tx('취소', 'Cancel')}
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
                        {tx('전체 목록 비우기', 'Clear All')}
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
                  {tx('실시간 호스트 IP · SMB(TCP 445) 도달성 진단', 'Live Host IP · SMB (TCP 445) Reachability Probe')}
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
                    placeholder={tx('예: 192.168.0.105 또는 호스트명', 'e.g. 192.168.0.105 or hostname')}
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
                    {isProbingHost ? tx('진단 중...', 'Probing...') : tx('실시간 IP 진단', 'Probe IP')}
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
                      {probeResult.reachable ? tx('도달 가능', 'Reachable') : tx('응답 없음', 'No Response')}
                    </span>
                    {' · '}
                    <span>{probeResult.resolvedIp || probeResult.target}</span>
                    {probeResult.avgLatencyMs !== null && ` · ${tx('평균', 'Avg')} ${probeResult.avgLatencyMs}ms`}
                    {' · '}
                    <span className="font-semibold">
                      TCP 445 {probeResult.smbPortOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                    {' · '}
                    <span>{tx('손실', 'Loss')} {probeResult.packetLossPct}%</span>
                  </div>
                )}
              </div>
            </div>

            {selectedHostSnap?.capturedAt && (
              <div className="tabular-data text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3 shrink-0" />
                <span>{tx('스냅샷 일시', 'Snapshot Time')}: {formatSnapshotTimestamp(selectedHostSnap.capturedAt)}</span>
              </div>
            )}
          </div>

          {/* STEP 02: Local PC 1-Click Auto-Align */}
          <div className="p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-data text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {tx(`STEP 02 · 내 PC(${netInfo.hostname}) 자동 정렬`, `STEP 02 · Align This PC (${netInfo.hostname})`)}
                </span>
                <span
                  className={`tabular-data text-[11px] font-bold ${
                    diffConflictModes.length > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {diffConflictModes.length > 0
                    ? tx(`${diffConflictModes.length}종 패치 대기`, `${diffConflictModes.length} patches pending`)
                    : tx('정렬 완료', 'Aligned')}
                </span>
              </div>

              {!selectedHostSnap || !policyStatus ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tx('OS 네트워크 정책을 먼저 분석해 주세요.', 'Analyze OS network policies first.')}
                </p>
              ) : diffConflictModes.length > 0 ? (
                <div className="space-y-2 text-xs">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {locale === 'en' ? (
                      <>Detected <strong className="font-bold text-slate-900 dark:text-white">{diffCounts.local}</strong> policy conflicts resolvable immediately on this PC.</>
                    ) : (
                      <>현재 PC에서 즉시 해결 가능한 정책 충돌 <strong className="font-bold text-slate-900 dark:text-white">{diffCounts.local}건</strong>이 감지되었습니다.</>
                    )}
                  </p>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {tx('실행 예정 패치', 'Planned Patches')}:{' '}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                      {diffConflictModes.map((m) => getPolicyPatchLabel(m)).join(' · ')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{tx('내 PC 로컬 적용 가능 정책이 모두 정렬되었습니다.', 'All local-PC policies are aligned.')}</span>
                  </div>
                  {lastAutoAlignResult && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {tx('최근 결과', 'Last Result')}: {lastAutoAlignResult.rebootJudgment.title}
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
                  ? tx('내 PC 정책 정렬 완료됨', 'This PC Policy Aligned')
                  : isAutoAligning
                    ? tx('내 PC 정책 자동 정렬 중...', 'Auto-Aligning This PC...')
                    : tx(`내 PC 불일치 정책 일괄 정렬 (${diffConflictModes.length}종)`, `Align This PC Policies (${diffConflictModes.length})`)}
              </button>
            </div>
          </div>

          {/* STEP 03: Remote Host USB Pending Task Reservation */}
          <div className="p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-data text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {tx('STEP 03 · 원격 호스트 USB 대기 작업 예약', 'STEP 03 · Queue Remote Host USB Task')}
                </span>
                <span className="tabular-data text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {tx(`호스트 조치 ${diffCounts.host}건`, `${diffCounts.host} host actions`)}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {tx(
                  '빈 암호 제한(86)·Guest(1385)·익명 차단(1223)·방화벽 445 등 호스트 측 정책은 USB에 대기 작업을 저장해 두면 호스트 PC에서 앱 실행 시 1클릭 적용됩니다.',
                  'Host-side settings (Blank Password 86, Guest 1385, Anonymous 1223, Firewall 445) can be queued to USB for 1-click apply when the app runs on the host PC.'
                )}
              </p>

              {isPresetTarget && (
                <div className="space-y-1">
                  <label
                    htmlFor="pending-target-host-input"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {tx('대상 호스트 컴퓨터 이름', 'Target Host Computer Name')}
                  </label>
                  <input
                    id="pending-target-host-input"
                    type="text"
                    value={pendingTargetHostOverride}
                    onChange={(e) => setPendingTargetHostOverride(e.target.value)}
                    placeholder={tx('예: MAIN-HOST-PC', 'e.g. MAIN-HOST-PC')}
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
                  <span>{tx('안전 호환 패치 (프로필 · 서명 · 게스트 · NTLM)', 'Safe Compat Patch (Profile · Signing · Guest · NTLM)')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingIncludeGuestUnlock}
                    onChange={(e) => setPendingIncludeGuestUnlock(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{tx('Guest 무비밀번호 완전 개방 (오류 86·1223·1385 · 445)', 'Full Guest Unlock (Error 86·1223·1385 · TCP 445)')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingModesDraft.includes('rpc_printer_compat')}
                    onChange={() => handleTogglePendingMode('rpc_printer_compat')}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{tx('프린터 RPC · 스풀러 호환 (0x11b·0x709)', 'Printer RPC · Spooler Compat (0x11b·0x709)')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingModesDraft.includes('enable_uac_token_filter')}
                    onChange={() => handleTogglePendingMode('enable_uac_token_filter')}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{tx('UAC 원격 토큰 필터 허용 (관리자 Error 5)', 'Allow UAC Remote Token Filter (Admin Error 5)')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingModesDraft.includes('kir_duplicate_sid_compat')}
                    onChange={() => handleTogglePendingMode('kir_duplicate_sid_compat')}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{tx('복제 OS 중복 Machine SID 차단 해제 KIR (1517186191=0)', 'Cloned OS Duplicate SID KIR Bypass (1517186191=0)')}</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {isSelfComparison && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  {tx(
                    '현재 PC 자체 스냅샷을 선택 중입니다. STEP 01에서 원격 호스트나 권장 기준을 선택하면 USB 대기 작업을 예약할 수 있습니다.',
                    'Currently viewing this PC snapshot. Select a remote host or baseline in STEP 01 to queue a USB host task.'
                  )}
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
                  ? tx('USB 대기 작업 저장 중...', 'Saving USB Task...')
                  : tx('USB에 호스트 자동 적용 대기 작업 저장', 'Save Host Auto-Apply Task to USB')}
              </button>
              <button
                id="btn-copy-host-guide"
                type="button"
                onClick={() => void handleCopyHostGuide()}
                className="w-full py-1.5 px-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                {tx('호스트 PC 조치 안내 텍스트 복사', 'Copy Host PC Action Guide')}
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
                {tx(
                  `저장된 호스트 정책 스냅샷 (${allSavedSnapshotKeys.length}건 · 날짜/시간 표기)`,
                  `Saved Host Policy Snapshots (${allSavedSnapshotKeys.length} · Timestamped)`
                )}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {tx('항목을 클릭하면 비교 대상으로 즉시 전환됩니다.', 'Click an item to switch comparison target.')}
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
              {allSavedSnapshotKeys.map((key) => {
                const snap = hostPolicySnapshots[key];
                if (!snap) return null;
                const isLocal = key === localSnapshotKey;
                const isSelected = effectiveSourceId === key;
                const ts = snap.capturedAt ? formatSnapshotTimestamp(snap.capturedAt) : tx('일시 미기록', 'No timestamp');
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
                        {isLocal ? tx('현재 PC', 'This PC') : tx('원격 호스트', 'Remote Host')}
                        {snap.sourceIp ? ` · ${snap.sourceIp}` : ''} · {eraLabel} · {ts}
                      </span>
                      {isSelected && (
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          · {tx('선택됨', 'Selected')}
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
                              {tx('삭제 확정', 'Confirm')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteKey(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                            >
                              {tx('취소', 'Cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingClearAll(false);
                              setConfirmingDeleteKey(rowConfirmKey);
                            }}
                            title={tx(`'${snap.hostName || key}' 스냅샷 삭제`, `Delete snapshot '${snap.hostName || key}'`)}
                            aria-label={tx(`${snap.hostName || key} 스냅샷 삭제`, `Delete snapshot ${snap.hostName || key}`)}
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
              <span>
                {tx(
                  `USB 포터블에 예약된 호스트 자동 적용 대기 작업 (${pendingTaskList.length}건)`,
                  `Queued Host Auto-Apply Tasks on USB (${pendingTaskList.length})`
                )}
              </span>
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
                        {tx('대상 호스트', 'Target Host')}: {task.targetHostName}
                        {task.targetIp ? ` (${task.targetIp})` : ''}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          {' · '}{tx('요청 PC', 'Requested By')}: {task.requestedByHostName} · {formatSnapshotTimestamp(task.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {tx('예약 패치', 'Queued Patches')}: {task.modes.map((m) => getPolicyPatchLabel(m)).join(' · ')}
                        {task.includeGuestUnlock ? tx(' · Guest 무비밀번호 개방 포함', ' · Includes Guest Unlock') : ''}
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
                          {tx('지금 이 PC에 적용', 'Apply to This PC Now')}
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
                              {tx('삭제 확정', 'Confirm')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeletePendingKey(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
                            >
                              {tx('취소', 'Cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingDeletePendingKey(task.targetHostName)}
                            className="px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-300 dark:border-slate-700 rounded-md whitespace-nowrap cursor-pointer"
                          >
                            {tx('예약 취소', 'Cancel Task')}
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
            {tx('OS 네트워크 정책을 먼저 분석해 주세요.', 'Analyze OS network policies first.')}
          </div>
        ) : (
          <div>
            <div className="px-6 py-3 bg-slate-50/70 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                {(
                  [
                    { id: 'all', label: tx(`전체 항목 (${diffCounts.all})`, `All (${diffCounts.all})`) },
                    { id: 'issues', label: tx(`불일치·경고 (${diffCounts.issues})`, `Conflicts · Warnings (${diffCounts.issues})`) },
                    { id: 'local', label: tx(`내 PC 조치 (${diffCounts.local})`, `This PC (${diffCounts.local})`) },
                    { id: 'host', label: tx(`호스트 조치 (${diffCounts.host})`, `Host Actions (${diffCounts.host})`) },
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
                {tx(
                  `심층 비교 ${filteredCrossPcDiffs.length}건 표시 중 · 호스트(${selectedHostSnap.hostName}) ↔ 내 PC(${netInfo.hostname})`,
                  `Showing ${filteredCrossPcDiffs.length} items · Host (${selectedHostSnap.hostName}) ↔ This PC (${netInfo.hostname})`
                )}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-3 px-6">{tx('비교 항목', 'Policy Item')}</th>
                    <th className="py-3 px-4 tabular-data">
                      <div className="font-bold">
                        {tx('호스트', 'Host')} ({selectedHostSnap.hostName})
                        {selectedHostSnap.sourceIp ? ` · ${selectedHostSnap.sourceIp}` : ''}
                      </div>
                      {selectedHostSnap.capturedAt ? (
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{formatSnapshotTimestamp(selectedHostSnap.capturedAt)}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                          {tx('기준 프로필', 'Reference Baseline')}
                        </div>
                      )}
                    </th>
                    <th className="py-3 px-4 tabular-data">
                      <div className="font-bold">{tx('현재 PC', 'This PC')} ({netInfo.hostname})</div>
                      {policyStatus.checkedAt && (
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{policyStatus.checkedAt}</span>
                        </div>
                      )}
                    </th>
                    <th className="py-3 px-4">{tx('판정', 'Status')}</th>
                    <th className="py-3 px-6">{tx('해결 방향 · 영향', 'Resolution & Impact')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCrossPcDiffs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        {tx('선택한 필터 조건에 해당하는 정책 항목이 없습니다.', 'No policy items match the selected filter.')}
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
                                ? tx('내 PC 1클릭 정렬 대상', '1-Click Local Align')
                                : row.actionTarget === 'host'
                                  ? tx('호스트 PC USB 예약 대상', 'Queue USB Host Task')
                                  : tx('양단 호환 정렬 권장', 'Align Both Endpoints')}
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
                            {row.status === 'conflict'
                              ? tx('충돌 감지', 'Conflict')
                              : row.status === 'warning'
                                ? tx('주의 · 차이', 'Warning')
                                : tx('일치', 'Match')}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-slate-600 dark:text-slate-400">
                          {row.recommendedPatchLabel && (
                            <div className="mb-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                              {tx('권장 조치', 'Recommended')}: {row.recommendedPatchLabel}
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
        </>
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
        isExpanded={expandedMenus.expertComparison}
        onToggleExpanded={() => toggleMatrixMenu('expertComparison')}
        onFetchRawRegistry={handleFetchRawRegistry}
        onNotify={onNotify}
      />

      {/* Era Summary Timeline (Collapsible) */}
      <section
        id="era-timeline-section"
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
      >
        <div
          className={`px-6 py-4 flex flex-wrap items-center justify-between gap-3 ${
            expandedMenus.eraTimeline ? 'border-b border-slate-200 dark:border-slate-800' : ''
          }`}
        >
          <div className="space-y-0.5 min-w-0">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                {tx(
                  'Windows 10 → Windows 11 26H2 네트워크 아키텍처 변천 타임라인',
                  'Windows 10 → Windows 11 26H2 Network Architecture Timeline'
                )}
              </span>
            </h3>
            <p className="tabular-data text-xs text-slate-500 dark:text-slate-400">
              {tx(
                `${windowsEraSummaries.length}개 세대 타임라인 · 현재 OS: ${formatEraShortLabel(currentEra, currentBuild, currentDisp)}`,
                `${windowsEraSummaries.length} OS generations · Current OS: ${formatEraShortLabel(currentEra, currentBuild, currentDisp)}`
              )}
              {selectedEra !== 'all' ? ` · ${tx('세대 필터 적용 중', 'Filtered')}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedEra !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedEra('all')}
                className="px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {tx('전체 세대 보기', 'Show All Eras')}
              </button>
            )}
            <button
              id="btn-toggle-era-timeline"
              type="button"
              aria-expanded={expandedMenus.eraTimeline}
              onClick={() => toggleMatrixMenu('eraTimeline')}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {expandedMenus.eraTimeline ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  {tx('접기', 'Collapse')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  {tx('타임라인 펼치기', 'Expand Timeline')}
                </>
              )}
            </button>
          </div>
        </div>

        {expandedMenus.eraTimeline && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {windowsEraSummaries.map((card) => {
              const isCurrent = card.era === currentEra;
              const isSelected = selectedEra === card.era;
              return (
                <button
                  key={card.era}
                  type="button"
                  onClick={() => {
                    setSelectedEra((prev) => (prev === card.era ? 'all' : card.era));
                    setExpandedMenus((prev) => ({ ...prev, evolutionMatrix: true }));
                  }}
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
                          {tx('현재 내 PC', 'This PC')}
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
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{tx('재부팅 특성', 'Reboot Trait')}:</span>{' '}
                    {card.rebootTrait}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Searchable Network Evolution Matrix (Collapsible) */}
      <section
        id="evolution-matrix-section"
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
      >
        <div
          className={`px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            expandedMenus.evolutionMatrix ? 'border-b border-slate-200 dark:border-slate-800' : ''
          }`}
        >
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {tx(
                `세부 변경 이력 & 파일 공유 적용 매트릭스 (${filteredItems.length})`,
                `Detailed Change History & File-Sharing Matrix (${filteredItems.length})`
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tx(
                '각 정책 변화가 실제 LAN 공유 시 일으키는 증상과 AhBiShare OneClick의 자동 적용·재부팅 판단 기준입니다.',
                'Symptoms caused by each policy change on LAN sharing and AhBiShare OneClick auto-remediation / reboot criteria.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {expandedMenus.evolutionMatrix && (
              <div className="relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={tx('네트워크 변경 이력 및 적용 매트릭스 검색', 'Search network change history and matrix')}
                  placeholder={tx('SMB 서명, 게스트, NTLM, 26H2 검색...', 'Search SMB signing, guest, NTLM, 26H2...')}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <button
              id="btn-toggle-evolution-matrix"
              type="button"
              aria-expanded={expandedMenus.evolutionMatrix}
              onClick={() => toggleMatrixMenu('evolutionMatrix')}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {expandedMenus.evolutionMatrix ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  {tx('접기', 'Collapse')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  {tx(`변경 이력 펼치기 (${filteredItems.length})`, `Expand Matrix (${filteredItems.length})`)}
                </>
              )}
            </button>
          </div>
        </div>

        {expandedMenus.evolutionMatrix && (
          <>
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
                  {locale === 'en' ? cat.enLabel : cat.koLabel}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {tx('검색 조건에 맞는 네트워크 변경 이력이 없습니다.', 'No network policy changes match your search criteria.')}
                </div>
              ) : (
            filteredItems.map((item) => {
              const rb = rebootLevelBadge(item.rebootLevel, tx);
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
                      <div className="font-semibold text-slate-700 dark:text-slate-300">{tx('OS 기본 동작 변화', 'OS Default Behavior Change')}</div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.defaultBehavior}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
                      <div className="font-semibold text-amber-800 dark:text-amber-300">{tx('파일 공유 장애 영향', 'File-Sharing Impact')}</div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{item.sharingImpact}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-300">{tx('AhBiShare OneClick 적용 해법', 'AhBiShare OneClick Remediation')}</div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{item.mitigationStrategy}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="tabular-data truncate max-w-full">
                      {tx('적용 대상', 'Affected Target')}: <code className="text-slate-700 dark:text-slate-300">{item.affectedRegistryOrCmdlet}</code>
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">{item.rebootNote}</span>
                  </div>
                </article>
              );
            })
          )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
