import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import {
  AutoAlignBatchResult,
  HostPolicySnapshot,
  LocalNetworkInfo,
  OsNetworkPolicyStatus,
  PolicyApplyResult,
  PolicyPatchMode,
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
  formatEraShortLabel,
  getPolicyPatchLabel,
} from '@/services/networkEvolution';

interface NetworkMatrixPanelProps {
  netInfo: LocalNetworkInfo;
  policyStatus: OsNetworkPolicyStatus | null;
  hostPolicySnapshots: Record<string, HostPolicySnapshot>;
  lastPatchResult: PolicyApplyResult | null;
  lastAutoAlignResult?: AutoAlignBatchResult | null;
  isInspecting: boolean;
  isAutoAligning?: boolean;
  isApplyingMode: PolicyPatchMode | null;
  onInspectPolicy: () => Promise<void>;
  onApplyPatch: (mode: PolicyPatchMode) => Promise<void>;
  onSyncMatchedPolicies: (modes: PolicyPatchMode[]) => Promise<void>;
  onTriggerReboot: () => Promise<{ success: boolean; message: string }>;
  onOpenWindowsUpdate: () => Promise<void>;
  onNotify?: (message: string) => void;
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
  lastPatchResult,
  lastAutoAlignResult = null,
  isInspecting,
  isAutoAligning = false,
  isApplyingMode,
  onInspectPolicy,
  onApplyPatch,
  onSyncMatchedPolicies,
  onTriggerReboot,
  onOpenWindowsUpdate,
  onNotify,
}) => {
  const [selectedEra, setSelectedEra] = useState<'all' | WindowsNetworkEra>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | WindowsNetworkChangeItem['category']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingReboot, setConfirmingReboot] = useState(false);
  const [confirmingSmbv1, setConfirmingSmbv1] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootFeedback, setRebootFeedback] = useState<string | null>(null);
  const [selectedHostKey, setSelectedHostKey] = useState<string>('');

  const isBusy = isInspecting || isApplyingMode !== null || isAutoAligning;
  const currentEra: WindowsNetworkEra = policyStatus?.osEra || netInfo.osEra || 'win11_24h2';
  const currentBuild = policyStatus?.osBuild || netInfo.osBuild || 26100;
  const currentDisp = policyStatus?.osDisplayVersion || netInfo.osDisplayVersion || '24H2';

  const { remoteSnapshotKeys, localSnapshotKey } = useMemo(() => {
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
    remote.sort((a, b) => a.localeCompare(b));
    return { remoteSnapshotKeys: remote, localSnapshotKey: local };
  }, [hostPolicySnapshots, netInfo.hostname]);

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
    () => crossPcDiffs.filter((row) => row.actionTarget === 'host' && row.status !== 'match'),
    [crossPcDiffs]
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

  const handleCopyHostGuide = async () => {
    if (!selectedHostSnap || hostSideRows.length === 0) return;
    const guideText = [
      `[AhBiShare OneClick 호스트 PC(${selectedHostSnap.hostName}) 정책 정렬 안내]`,
      ...hostSideRows.map((row) => `- ${row.label}: ${row.impact}`),
      '조치 방법: 호스트 PC에서 AhBiShare OneClick > [OS 호환성 매트릭스] 탭 > [안전 호환 원클릭 적용] 또는 [프린터 RPC·스풀러 호환]을 실행하세요.',
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
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
                <div className="text-slate-500 dark:text-slate-400">네트워크 프로필</div>
                <div
                  className={`mt-1 tabular-data font-bold ${
                    policyStatus.networkProfile === 'Public'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {policyStatus.networkProfile}
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
                <div className="text-slate-500 dark:text-slate-400">게스트 로그온</div>
                <div
                  className={`mt-1 font-bold ${
                    policyStatus.allowInsecureGuestAuth && !policyStatus.guestNetworkLogonDenied
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {policyStatus.allowInsecureGuestAuth ? '허용 (클라이언트)' : '차단됨 (기본)'}
                  {policyStatus.guestNetworkLogonDenied ? ' · 정책거부(1385)' : ''}
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
                    비교 대상: {selectedHostSnap.hostName}
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

      {/* Cross-PC Policy Diff Diagnostics & Batch Auto-Align */}
      <section
        id="cross-pc-policy-diff"
        className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-indigo-500 shrink-0" />
              메인 PC vs 클라이언트 PC 양단 정책 차이 비교 및 일괄 자동 정렬
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPresetTarget
                ? `원격 USB 호스트 스냅샷이 없어 '${selectedHostSnap?.hostName}' 기준으로 즉시 비교 중입니다. 호스트 PC에서 공유를 개설하면 실제 호스트 스냅샷이 우선 비교됩니다.`
                : isSelfComparison
                  ? `현재 PC(${netInfo.hostname})의 저장 스냅샷과 실시간 정책을 대조 중입니다. 다른 호스트와 비교하려면 위 드롭다운에서 권장 기준 프로필을 선택하세요.`
                  : `USB 포터블 설정(AhBiShare_OneClick.portable.json)에 기록된 원격 호스트(${selectedHostSnap?.hostName})와 현재 PC 정책을 대조합니다.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              id="cross-pc-host-select"
              value={effectiveSourceId}
              onChange={(e) => setSelectedHostKey(e.target.value)}
              className="px-3 py-2 text-xs tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {remoteSnapshotKeys.map((key) => (
                <option key={key} value={key}>
                  원격 호스트: {key}
                </option>
              ))}
              {HOST_POLICY_REFERENCE_TARGETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  기준: {preset.label}
                </option>
              ))}
              {localSnapshotKey && (
                <option key={localSnapshotKey} value={localSnapshotKey}>
                  현재 PC 스냅샷: {localSnapshotKey}
                </option>
              )}
            </select>

            {diffConflictModes.length > 0 && (
              <button
                id="btn-sync-cross-pc-policy"
                type="button"
                disabled={isBusy}
                onClick={() => void onSyncMatchedPolicies(diffConflictModes)}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isAutoAligning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {isAutoAligning
                  ? '일괄 자동 정렬 적용 중...'
                  : `불일치 정책 일괄 자동 정렬 (${diffConflictModes.length}종)`}
              </button>
            )}
          </div>
        </div>

        {!selectedHostSnap || !policyStatus ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            OS 네트워크 정책을 먼저 분석해 주세요.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {diffConflictModes.length === 0 && (
              <div className="px-6 py-3 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    현재 PC와 선택된 비교 대상({selectedHostSnap.hostName}) 간의 로컬 적용 가능 네트워크 정책이 모두 호환 상태로 정렬되었습니다.
                  </span>
                </div>
                {lastAutoAlignResult && (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-200">
                    최근 정렬: {lastAutoAlignResult.rebootJudgment.title}
                  </span>
                )}
              </div>
            )}

            {hostSideRows.length > 0 && (
              <div className="px-6 py-3 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start sm:items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
                  <span>
                    원격 호스트({selectedHostSnap.hostName}) 조치 필요 항목 ({hostSideRows.map((r) => r.label).join(' · ')}): 호스트 PC에서도 호환 패치를 실행해야 연결이 완료됩니다.
                  </span>
                </div>
                <button
                  id="btn-copy-host-guide"
                  type="button"
                  onClick={() => void handleCopyHostGuide()}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 border border-amber-500/40 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-end sm:self-center"
                >
                  <Copy className="w-3.5 h-3.5" />
                  호스트 PC 조치 안내 복사
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-3 px-6">비교 항목</th>
                    <th className="py-3 px-4 tabular-data">호스트 ({selectedHostSnap.hostName})</th>
                    <th className="py-3 px-4 tabular-data">현재 PC ({netInfo.hostname})</th>
                    <th className="py-3 px-4">판정</th>
                    <th className="py-3 px-6">자동 정렬 패치 · 영향</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {crossPcDiffs.map((row) => (
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
                              ? '로컬 원클릭 정렬 대상'
                              : row.actionTarget === 'host'
                                ? '호스트 PC 조치 필요'
                                : '프린터 공유 시 양단 권장'}
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
                          {row.status === 'conflict' ? '충돌 감지' : row.status === 'warning' ? '세대 차이' : '일치'}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-slate-600 dark:text-slate-400">
                        {row.recommendedPatchLabel && (
                          <div className="mb-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                            원클릭 적용 예정: {row.recommendedPatchLabel}
                          </div>
                        )}
                        <div>{row.impact}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

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
