import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Copy,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  HostDiscrepancyLevel,
  HostPolicySnapshot,
  LocalNetworkInfo,
  OsNetworkPolicyStatus,
  PolicyPatchMode,
  SecurityRollbackAuditItem,
} from '@/types/share';
import {
  evaluateSecurityRollbackAudit,
  formatEraShortLabel,
  formatSecurityRollbackReportText,
} from '@/services/networkEvolution';
import { useI18n } from '@/i18n/I18nContext';
import { tx } from '@/i18n/localeState';

interface SecurityRollbackReportProps {
  netInfo: LocalNetworkInfo;
  policyStatus: OsNetworkPolicyStatus | null;
  targetHostSnapshot?: HostPolicySnapshot | null;
  targetHostIsPreset?: boolean;
  activeShareCount?: number;
  activeMountCount?: number;
  isBusy?: boolean;
  isInspecting?: boolean;
  onInspectPolicy: () => Promise<void>;
  onRestoreDefaults?: (modes: PolicyPatchMode[]) => Promise<void>;
  onFullSecurityRollback?: () => Promise<{ success: boolean; message: string } | void>;
  onNotify?: (message: string) => void;
}

type AuditFilter = 'all' | 'restored' | 'attention' | 'host_diff';

function statusMeta(status: SecurityRollbackAuditItem['status']): {
  label: string;
  textClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case 'restored':
      return {
        label: tx('복구 완료', 'Restored'),
        textClass: 'text-emerald-700 dark:text-emerald-300',
        Icon: CheckCircle2,
      };
    case 'partial':
      return {
        label: tx('세부 확인', 'Review'),
        textClass: 'text-amber-700 dark:text-amber-300',
        Icon: AlertTriangle,
      };
    case 'unknown':
      return {
        label: tx('미측정', 'Not Measured'),
        textClass: 'text-slate-500 dark:text-slate-400',
        Icon: HelpCircle,
      };
    case 'relaxed':
      return {
        label: tx('완화 상태', 'Relaxed'),
        textClass: 'text-red-700 dark:text-red-300',
        Icon: ShieldAlert,
      };
  }
}

function hostDiscrepancyBadgeMeta(level: HostDiscrepancyLevel): {
  badgeClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (level) {
    case 'conflict':
      return {
        badgeClass:
          'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/35',
        Icon: ShieldAlert,
      };
    case 'warning':
      return {
        badgeClass:
          'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/35',
        Icon: AlertTriangle,
      };
    case 'aligned':
      return {
        badgeClass:
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        Icon: CheckCircle2,
      };
    case 'unmeasured':
    default:
      return {
        badgeClass:
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
        Icon: HelpCircle,
      };
  }
}

export const SecurityRollbackReport: React.FC<SecurityRollbackReportProps> = ({
  netInfo,
  policyStatus,
  targetHostSnapshot = null,
  targetHostIsPreset = false,
  activeShareCount = 0,
  activeMountCount = 0,
  isBusy = false,
  isInspecting = false,
  onInspectPolicy,
  onRestoreDefaults,
  onFullSecurityRollback,
  onNotify,
}) => {
  const { locale, tx: txLocal } = useI18n();
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [isApplyingHardening, setIsApplyingHardening] = useState(false);

  const report = useMemo(() => {
    if (!policyStatus) return null;
    return evaluateSecurityRollbackAudit(policyStatus, {
      activeShareCount,
      activeMountCount,
      targetHostSnapshot,
    });
  }, [policyStatus, activeShareCount, activeMountCount, targetHostSnapshot, locale]);

  const effectiveFilter: AuditFilter =
    filter === 'host_diff' && !targetHostSnapshot ? 'all' : filter;

  const filteredItems = useMemo(() => {
    if (!report) return [];
    if (effectiveFilter === 'restored') return report.items.filter((i) => i.status === 'restored');
    if (effectiveFilter === 'attention') return report.items.filter((i) => i.status !== 'restored');
    if (effectiveFilter === 'host_diff') {
      return report.items.filter(
        (i) => i.hostComparison?.status === 'conflict' || i.hostComparison?.status === 'warning'
      );
    }
    return report.items;
  }, [report, effectiveFilter]);

  const osLabel = policyStatus
    ? `${policyStatus.osProductName} · ${formatEraShortLabel(
        policyStatus.osEra,
        policyStatus.osBuild,
        policyStatus.osDisplayVersion
      )}`
    : formatEraShortLabel(netInfo.osEra, netInfo.osBuild, netInfo.osDisplayVersion);

  const handleCopyReport = async () => {
    if (!report) return;
    const text = formatSecurityRollbackReportText(report, netInfo.hostname, osLabel);
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
    onNotify?.(
      copied
        ? txLocal(
            '보안 원복 10개 핵심 항목 검증 보고서를 클립보드에 복사했습니다.',
            'Copied 10-point security rollback verification report to clipboard.'
          )
        : txLocal(
            '클립보드 복사에 실패했습니다. 화면의 10개 항목표를 확인해 주세요.',
            'Failed to copy to clipboard. Please review the 10-point table on screen.'
          )
    );
  };

  const handleHardenRemaining = async () => {
    if (!report || isBusy || isApplyingHardening) return;
    setIsApplyingHardening(true);
    try {
      if (onFullSecurityRollback && (report.hasAhbiFirewallRule || activeShareCount > 0 || activeMountCount > 0)) {
        await onFullSecurityRollback();
      } else if (onRestoreDefaults && report.recommendedModes.length > 0) {
        await onRestoreDefaults(report.recommendedModes);
      } else if (onFullSecurityRollback) {
        await onFullSecurityRollback();
      }
    } finally {
      setIsApplyingHardening(false);
    }
  };

  const canRunRemediation =
    Boolean(report) &&
    (report!.failedCount > 0 ||
      report!.recommendedModes.length > 0 ||
      report!.hasAhbiFirewallRule ||
      activeShareCount > 0 ||
      activeMountCount > 0) &&
    Boolean(onRestoreDefaults || onFullSecurityRollback);

  const hasHostComparison = Boolean(targetHostSnapshot && report?.targetHostName);

  return (
    <section
      id="security-rollback-report"
      className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
    >
      {/* Header & Overall Verdict */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {txLocal('보안 원복 정밀 검증 보고서', 'Security Rollback Audit Report')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-data">{txLocal('10개 핵심 정책 감사', '10-Point Policy Audit')}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-data">{netInfo.hostname}</span>
            {hasHostComparison && report?.targetHostName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-data font-medium text-slate-700 dark:text-slate-300">
                  {txLocal('호스트 비교:', 'Host Compare:')} {report.targetHostName}
                  {targetHostIsPreset ? txLocal(' (권장 기준)', ' (Baseline)') : ''}
                </span>
              </>
            )}
            {report && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-data">{txLocal(`점검 ${report.evaluatedAt}`, `Checked ${report.evaluatedAt}`)}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {report?.verdict === 'fully_restored' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : report?.verdict === 'incomplete' ? (
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {report ? report.headline : txLocal('보안 원복 상태 검사 대기 중', 'Awaiting Security Rollback Inspection')}
            </h3>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {report
              ? report.summary
              : txLocal(
                  '현재 PC의 SMB 서명·게스트 차단·LSA 빈 암호/익명 제한·NTLM·UAC 원격 토큰·프린터 RPC 및 임시 방화벽 정리 여부를 10개 항목으로 검증합니다.',
                  'Audits 10 items on this PC: SMB signing, guest block, LSA blank-password/anonymous limits, NTLM, UAC remote token, printer RPC, and firewall cleanup.'
                )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canRunRemediation && (
            <button
              id="btn-harden-remaining-policies"
              type="button"
              disabled={isBusy || isApplyingHardening}
              onClick={() => void handleHardenRemaining()}
              className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isApplyingHardening ? 'animate-spin' : ''}`} />
              {isApplyingHardening
                ? txLocal('표준 보안 복원 중...', 'Restoring defaults...')
                : txLocal('미복구 항목 표준 보안 복원', 'Harden Remaining Policies')}
            </button>
          )}
          {report && (
            <button
              id="btn-copy-security-audit"
              type="button"
              onClick={() => void handleCopyReport()}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {txLocal('보고서 복사', 'Copy Report')}
            </button>
          )}
          <button
            id="btn-reverify-security-audit"
            type="button"
            disabled={isBusy || isInspecting}
            onClick={() => void onInspectPolicy()}
            className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
            {isInspecting
              ? txLocal('10개 항목 검사 중...', 'Inspecting 10 items...')
              : txLocal('10개 항목 재검사', 'Re-Audit 10 Items')}
          </button>
        </div>
      </div>

      {!report ? (
        <div className="px-6 py-8 text-center space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {txLocal(
              '아직 OS 네트워크 정책 검사 결과가 로드되지 않았습니다. 아래 버튼을 눌러 10개 보안 항목을 즉시 검증하세요.',
              'OS network policy inspection results are not loaded yet. Click below to audit all 10 security items.'
            )}
          </p>
          <button
            type="button"
            disabled={isBusy || isInspecting}
            onClick={() => void onInspectPolicy()}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
            {txLocal('지금 10개 핵심 항목 검사', 'Inspect 10 Security Items Now')}
          </button>
        </div>
      ) : (
        <>
          {/* Summary Strip + Segmented Filter */}
          <div className="px-6 py-3 bg-slate-50/70 dark:bg-slate-950/35 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="tabular-data font-bold text-emerald-700 dark:text-emerald-300">
                {txLocal(`보안 기본값 ${report.passedCount} / ${report.totalCount}`, `Secure Defaults ${report.passedCount} / ${report.totalCount}`)}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                |
              </span>
              <span
                className={`tabular-data font-semibold ${
                  report.failedCount > 0
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {txLocal(`완화(미복구) ${report.failedCount}건`, `Relaxed ${report.failedCount}`)}
              </span>
              <span
                className={`tabular-data font-semibold ${
                  report.partialCount > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {txLocal(`세부 확인 ${report.partialCount}건`, `Review ${report.partialCount}`)}
              </span>
              {hasHostComparison && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    |
                  </span>
                  <span
                    className={`tabular-data font-semibold ${
                      (report.targetConflictCount ?? 0) > 0
                        ? 'text-red-700 dark:text-red-300'
                        : (report.targetDiscrepancyCount ?? 0) > 0
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {txLocal(`호스트 기대 정책 차이 ${report.targetDiscrepancyCount ?? 0}건`, `Host Diffs ${report.targetDiscrepancyCount ?? 0}`)}
                    {(report.targetConflictCount ?? 0) > 0
                      ? txLocal(` (충돌 ${report.targetConflictCount}건)`, ` (${report.targetConflictCount} conflict)`)
                      : ''}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                |
              </span>
              <span className="tabular-data text-slate-600 dark:text-slate-400">
                {txLocal(
                  `활성 공유 ${report.activeShareCount}건 · 연결 드라이브 ${report.activeMountCount}건 · 445 임시규칙 ${report.hasAhbiFirewallRule ? '잔존' : '삭제됨'}`,
                  `Shares ${report.activeShareCount} · Drives ${report.activeMountCount} · Temp 445 Rule: ${report.hasAhbiFirewallRule ? 'Present' : 'Removed'}`
                )}
              </span>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              {(
                [
                  { id: 'all', domId: 'security-audit-filter-all', label: txLocal(`전체 (${report.totalCount})`, `All (${report.totalCount})`) },
                  ...(hasHostComparison
                    ? [
                        {
                          id: 'host_diff' as const,
                          domId: 'security-audit-filter-host-diff',
                          label: txLocal(`호스트 불일치 (${report.targetDiscrepancyCount ?? 0})`, `Host Diff (${report.targetDiscrepancyCount ?? 0})`),
                        },
                      ]
                    : []),
                  { id: 'restored', domId: 'security-audit-filter-restored', label: txLocal(`복구 완료 (${report.passedCount})`, `Restored (${report.passedCount})`) },
                  {
                    id: 'attention',
                    domId: 'security-audit-filter-attention',
                    label: txLocal(`미복구·확인 (${report.failedCount + report.partialCount})`, `Attention (${report.failedCount + report.partialCount})`),
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  id={tab.domId}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                    effectiveFilter === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 10-Point Verification Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-2.5 pl-6 pr-3 w-12 tabular-data">#</th>
                  <th className="py-2.5 px-3">{txLocal('핵심 보안 항목 · 대상 호스트 불일치 배지', 'Security Control · Host Match Badge')}</th>
                  <th className="py-2.5 px-3">{txLocal('현재 측정값', 'Current Value')}</th>
                  <th className="py-2.5 px-3">
                    {hasHostComparison ? txLocal('보안 기본값 / 호스트 기대', 'Default / Host Expected') : txLocal('의도한 보안 기본값', 'Security Default')}
                  </th>
                  <th className="py-2.5 px-3">{txLocal('보안 복구 판정', 'Status')}</th>
                  <th className="py-2.5 pl-3 pr-6">{txLocal('상세 검증 결과', 'Audit Details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      {txLocal('선택한 필터 조건에 해당하는 항목이 없습니다.', 'No items match the selected filter.')}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const meta = statusMeta(item.status);
                    const StatusIcon = meta.Icon;
                    const hc = item.hostComparison;
                    const hcMeta = hc ? hostDiscrepancyBadgeMeta(hc.status) : null;
                    const HcIcon = hcMeta?.Icon;

                    const rowHighlightClass =
                      item.status === 'relaxed' || hc?.status === 'conflict'
                        ? 'bg-red-500/4 hover:bg-red-500/8'
                        : hc?.status === 'warning'
                          ? 'bg-amber-500/4 hover:bg-amber-500/8'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30';

                    return (
                      <tr key={item.id} className={rowHighlightClass}>
                        <td className="py-2.5 pl-6 pr-3 tabular-data font-bold text-slate-400 dark:text-slate-500 align-top">
                          {String(item.index).padStart(2, '0')}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {item.label}
                            </span>
                            {hc && hcMeta && HcIcon && (
                              <span
                                data-discrepancy={hc.status}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded border whitespace-nowrap ${hcMeta.badgeClass}`}
                              >
                                <HcIcon className="w-3 h-3 shrink-0" />
                                {hc.badgeLabel}
                              </span>
                            )}
                          </div>
                          <div className="tabular-data text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.category} · {item.registryOrPolicy}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 tabular-data font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap align-top">
                          {item.currentValue}
                        </td>
                        <td className="py-2.5 px-3 tabular-data text-slate-600 dark:text-slate-400 whitespace-nowrap align-top">
                          <div>{item.expectedDefault}</div>
                          {hc && (
                            <div className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {txLocal('호스트 기대:', 'Host expects:')} {hc.expectedHostValue}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap align-top">
                          <span className={`inline-flex items-center gap-1 font-bold ${meta.textClass}`}>
                            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 pr-6 text-slate-600 dark:text-slate-400 leading-relaxed align-top">
                          <div>{item.detail}</div>
                          {hc && hc.status !== 'aligned' && hc.status !== 'unmeasured' && (
                            <div
                              className={`mt-1 text-[11px] font-medium ${
                                hc.status === 'conflict'
                                  ? 'text-red-700 dark:text-red-300'
                                  : 'text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {hc.discrepancyDetail}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

