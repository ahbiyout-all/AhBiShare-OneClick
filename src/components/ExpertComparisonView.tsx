import React, { useMemo, useState } from 'react';
import {
  Terminal,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  HardDrive,
} from 'lucide-react';
import {
  ExpertRegistryFetchResult,
  HostDiscrepancyLevel,
  HostPolicySnapshot,
  LocalNetworkInfo,
  OsNetworkPolicyStatus,
  SecurityRollbackAuditReport,
} from '@/types/share';
import {
  buildExpertRegistryComparisonRows,
  deriveRawRegistrySnapshotFromHostSnap,
  deriveRawRegistrySnapshotFromStatus,
  evaluateSecurityRollbackAudit,
  formatExpertRegistryComparisonText,
} from '@/services/networkEvolution';
import { useI18n } from '@/i18n/I18nContext';
import { tx } from '@/i18n/localeState';

interface ExpertComparisonViewProps {
  netInfo: LocalNetworkInfo;
  policyStatus: OsNetworkPolicyStatus | null;
  targetHostSnapshot: HostPolicySnapshot | null;
  isPresetTarget: boolean;
  connectedHostLabel?: string;
  fetchResult: ExpertRegistryFetchResult | null;
  isFetching: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onFetchRawRegistry: () => Promise<void>;
  onNotify?: (message: string) => void;
}

function discrepancyStyle(status: HostDiscrepancyLevel): {
  label: string;
  badgeClass: string;
  valueClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case 'conflict':
      return {
        label: tx('충돌', 'Conflict'),
        badgeClass: 'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/35',
        valueClass: 'text-red-700 dark:text-red-300 font-bold',
        Icon: ShieldAlert,
      };
    case 'warning':
      return {
        label: tx('차이', 'Diff'),
        badgeClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/35',
        valueClass: 'text-amber-700 dark:text-amber-300 font-bold',
        Icon: AlertTriangle,
      };
    case 'aligned':
      return {
        label: tx('일치', 'Match'),
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        valueClass: 'text-slate-800 dark:text-slate-200',
        Icon: CheckCircle2,
      };
    case 'unmeasured':
    default:
      return {
        label: tx('미측정', 'Unmeasured'),
        badgeClass:
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
        valueClass: 'text-slate-500 dark:text-slate-400',
        Icon: HelpCircle,
      };
  }
}

export const ExpertComparisonView: React.FC<ExpertComparisonViewProps> = ({
  netInfo,
  policyStatus,
  targetHostSnapshot,
  isPresetTarget,
  connectedHostLabel,
  fetchResult,
  isFetching,
  isExpanded,
  onToggleExpanded,
  onFetchRawRegistry,
  onNotify,
}) => {
  const { locale, tx: txLocal } = useI18n();
  const [filterMode, setFilterMode] = useState<'all' | 'diff'>('all');

  const localRaw = useMemo(() => {
    if (fetchResult?.localSnapshot) return fetchResult.localSnapshot;
    if (policyStatus) return deriveRawRegistrySnapshotFromStatus(netInfo.hostname, policyStatus);
    return null;
  }, [fetchResult, policyStatus, netInfo.hostname, locale]);

  const hostRaw = useMemo(() => {
    if (
      fetchResult?.hostSnapshot &&
      (!targetHostSnapshot ||
        fetchResult.hostSnapshot.hostName.trim().toLowerCase() ===
          targetHostSnapshot.hostName.trim().toLowerCase())
    ) {
      return fetchResult.hostSnapshot;
    }
    if (targetHostSnapshot) {
      return deriveRawRegistrySnapshotFromHostSnap(targetHostSnapshot, isPresetTarget);
    }
    return null;
  }, [fetchResult, targetHostSnapshot, isPresetTarget, locale]);

  const auditReport: SecurityRollbackAuditReport | null = useMemo(() => {
    if (!policyStatus) return null;
    return evaluateSecurityRollbackAudit(policyStatus, {
      targetHostSnapshot,
    });
  }, [policyStatus, targetHostSnapshot, locale]);

  const rows = useMemo(() => {
    if (!localRaw || !hostRaw) return [];
    return buildExpertRegistryComparisonRows(localRaw, hostRaw, auditReport);
  }, [localRaw, hostRaw, auditReport, locale]);

  const diffPolicyRows = useMemo(
    () => rows.filter((r) => r.overallStatus === 'conflict' || r.overallStatus === 'warning'),
    [rows]
  );

  const visibleRows = filterMode === 'diff' ? diffPolicyRows : rows;

  const stats = useMemo(() => {
    let totalSubKeys = 0;
    let alignedSubKeys = 0;
    let diffSubKeys = 0;
    for (const r of rows) {
      for (const s of r.subRows) {
        totalSubKeys++;
        if (s.status === 'aligned') alignedSubKeys++;
        else if (s.status === 'conflict' || s.status === 'warning') diffSubKeys++;
      }
    }
    return { totalSubKeys, alignedSubKeys, diffSubKeys };
  }, [rows]);

  const handleCopyExpertText = async () => {
    if (!localRaw || !hostRaw || rows.length === 0) return;
    const txt = formatExpertRegistryComparisonText(rows, localRaw, hostRaw);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(txt);
        copied = true;
      }
    } catch {}
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt;
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
            '전문가 비교 보기(10대 보안 정책 원시 레지스트리 대조표)를 클립보드에 복사했습니다.',
            'Copied Expert Raw Registry Comparison table to clipboard.'
          )
        : txLocal(
            '클립보드 복사에 실패했습니다. 화면의 레지스트리 대조표를 확인하세요.',
            'Failed to copy to clipboard. Review the registry table on screen.'
          )
    );
  };

  return (
    <section
      id="expert-comparison-view"
      className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden"
    >
      {/* Top Bar */}
      <div
        className={`px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          isExpanded ? 'border-b border-slate-200 dark:border-slate-800' : ''
        }`}
      >
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Expert Comparison View
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="tabular-data text-slate-600 dark:text-slate-400">
              {txLocal(
                '10대 핵심 보안 정책 원시 레지스트리 나란히 대조',
                'Side-by-side raw registry comparison across 10 core security policies'
              )}
            </span>
            {connectedHostLabel && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="tabular-data inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                  <HardDrive className="w-3 h-3 shrink-0" />
                  {txLocal('연결 호스트', 'Connected host')}: {connectedHostLabel}
                </span>
              </>
            )}
          </div>

          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              {txLocal(
                '전문가 비교 보기 · 로컬 PC vs 연결 호스트 원시 레지스트리 비교',
                'Expert Comparison View · Local PC vs Connected Host Raw Registry'
              )}
            </span>
          </h3>

          {localRaw && hostRaw && (
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-data">
              {txLocal('로컬', 'Local')}(<strong className="text-slate-700 dark:text-slate-200">{localRaw.hostName}</strong>:{' '}
              {localRaw.sourceLabel}) ↔ {txLocal('호스트', 'Host')}(
              <strong className="text-slate-700 dark:text-slate-200">{hostRaw.hostName}</strong>
              {hostRaw.targetIp ? ` · ${hostRaw.targetIp}` : ''}: {hostRaw.sourceLabel})
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="btn-fetch-raw-registry"
            type="button"
            disabled={isFetching}
            onClick={() => void onFetchRawRegistry()}
            className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching
              ? txLocal('원시 레지스트리 조회 중...', 'Querying raw registry...')
              : txLocal('원시 레지스트리 실시간 조회', 'Query Live Raw Registry')}
          </button>

          {rows.length > 0 && (
            <button
              id="btn-copy-expert-registry"
              type="button"
              onClick={() => void handleCopyExpertText()}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {txLocal('대조표 복사', 'Copy Table')}
            </button>
          )}

          <button
            id="btn-toggle-expert-comparison"
            type="button"
            aria-expanded={isExpanded}
            onClick={onToggleExpanded}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                {txLocal('접기', 'Collapse')}
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                {txLocal('원시 비교표 펼치기', 'Expand Raw Table')}
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {!localRaw || !hostRaw ? (
            <div className="px-6 py-8 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {txLocal(
                  '로컬 OS 정책 또는 대상 호스트 정보가 아직 로드되지 않았습니다. 아래 버튼을 눌러 원시 레지스트리를 조회하세요.',
                  'Local OS policies or target host data have not been loaded yet. Click below to query the raw registry.'
                )}
              </p>
              <button
                type="button"
                disabled={isFetching}
                onClick={() => void onFetchRawRegistry()}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                {txLocal('지금 10대 정책 원시 레지스트리 조회', 'Query 10-Policy Raw Registry Now')}
              </button>
            </div>
          ) : (
            <>
              {/* Filter + Telemetry Summary Bar */}
              <div className="px-6 py-3 bg-slate-50/70 dark:bg-slate-950/35 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-data">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {txLocal(
                      `정책 ${rows.length}개 · 세부 키 ${stats.totalSubKeys}개`,
                      `${rows.length} policies · ${stats.totalSubKeys} sub-keys`
                    )}
                  </span>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    |
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {txLocal(`원시값 일치 ${stats.alignedSubKeys}개`, `Matched ${stats.alignedSubKeys}`)}
                  </span>
                  <span
                    className={`font-semibold ${
                      stats.diffSubKeys > 0
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {txLocal(`불일치·차이 ${stats.diffSubKeys}개`, `Mismatched ${stats.diffSubKeys}`)}
                  </span>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    |
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {txLocal('조회 시각', 'Queried')}: {localRaw.fetchedAt}
                  </span>
                </div>

                <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <button
                    id="expert-filter-all"
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                      filterMode === 'all'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {txLocal(`전체 10대 정책 (${rows.length})`, `All 10 Policies (${rows.length})`)}
                  </button>
                  <button
                    id="expert-filter-diff"
                    type="button"
                    onClick={() => setFilterMode('diff')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                      filterMode === 'diff'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {txLocal(`원시값 불일치 (${diffPolicyRows.length})`, `Mismatched (${diffPolicyRows.length})`)}
                  </button>
                </div>
              </div>

              {(fetchResult?.remoteRpcNote || hostRaw.remoteRpcNote) && (
                <div className="px-6 py-2.5 bg-indigo-500/5 dark:bg-indigo-500/8 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {fetchResult?.remoteRpcNote || hostRaw.remoteRpcNote}
                </div>
              )}

              {/* Side-by-Side Raw Registry Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="py-2.5 pl-6 pr-2 w-10 tabular-data">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">{txLocal('핵심 보안 정책', 'Core Security Policy')}</th>
                      <th className="py-2.5 px-3 min-w-[250px]">{txLocal('레지스트리 경로 · 값 이름', 'Registry Path · Value Name')}</th>
                      <th className="py-2.5 px-3 min-w-[165px] tabular-data">
                        <div>{txLocal('로컬 PC', 'Local PC')} ({localRaw.hostName})</div>
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          {localRaw.sourceLabel}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 min-w-[165px] tabular-data">
                        <div>{txLocal('연결 호스트', 'Connected Host')} ({hostRaw.hostName})</div>
                        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          {hostRaw.sourceLabel}
                        </div>
                      </th>
                      <th className="py-2.5 pl-3 pr-6 min-w-[155px]">{txLocal('SFI 기본값 · 판정', 'SFI Default · Verdict')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
                          {txLocal(
                            '원시 레지스트리 값이 불일치하는 정책이 없습니다. 양단 레지스트리가 일치합니다.',
                            'No mismatched raw registry policies found. Both endpoints match.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((policy) => {
                        const polMeta = discrepancyStyle(policy.overallStatus);
                        const PolIcon = polMeta.Icon;

                        return policy.subRows.map((sub, subIdx) => {
                          const subMeta = discrepancyStyle(sub.status);
                          const SubIcon = subMeta.Icon;
                          const isFirstSub = subIdx === 0;
                          const rowTint =
                            sub.status === 'conflict'
                              ? 'bg-red-500/4 hover:bg-red-500/8'
                              : sub.status === 'warning'
                                ? 'bg-amber-500/4 hover:bg-amber-500/8'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30';

                          return (
                            <tr
                              key={sub.id}
                              data-expert-policy={policy.policyId}
                              data-expert-status={sub.status}
                              className={rowTint}
                            >
                              {isFirstSub && (
                                <td
                                  rowSpan={policy.subRows.length}
                                  className="py-2.5 pl-6 pr-2 tabular-data font-bold text-slate-400 dark:text-slate-500 align-top border-r border-slate-100 dark:border-slate-800/70"
                                >
                                  {String(policy.index).padStart(2, '0')}
                                </td>
                              )}

                              {isFirstSub && (
                                <td
                                  rowSpan={policy.subRows.length}
                                  className="py-2.5 px-3 align-top border-r border-slate-100 dark:border-slate-800/70"
                                >
                                  <div className="space-y-1">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                                      {policy.label}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {policy.category}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border whitespace-nowrap ${polMeta.badgeClass}`}
                                      >
                                        <PolIcon className="w-2.5 h-2.5 shrink-0" />
                                        {policy.statusBadgeLabel}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              )}

                              <td className="py-2.5 px-3 align-top">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <code className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                                    {sub.valueName}
                                  </code>
                                  <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {sub.valueType}
                                  </span>
                                </div>
                                <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 break-all">
                                  {sub.registryPath}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 align-top font-mono tabular-data text-[11px]">
                                <span
                                  data-raw-side="local"
                                  className={`break-all ${
                                    sub.status === 'aligned'
                                      ? 'text-slate-800 dark:text-slate-200'
                                      : subMeta.valueClass
                                  }`}
                                >
                                  {sub.localDisplayValue}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 align-top font-mono tabular-data text-[11px]">
                                <span
                                  data-raw-side="host"
                                  className={`break-all ${
                                    sub.status === 'aligned'
                                      ? 'text-slate-800 dark:text-slate-200'
                                      : subMeta.valueClass
                                  }`}
                                >
                                  {sub.hostDisplayValue}
                                </span>
                              </td>

                              <td className="py-2.5 pl-3 pr-6 align-top">
                                <div className="inline-flex items-center gap-1 font-bold whitespace-nowrap">
                                  <SubIcon
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      sub.status === 'conflict'
                                        ? 'text-red-600 dark:text-red-400'
                                        : sub.status === 'warning'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : sub.status === 'aligned'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-slate-400'
                                    }`}
                                  />
                                  <span
                                    className={
                                      sub.status === 'conflict'
                                        ? 'text-red-700 dark:text-red-300'
                                        : sub.status === 'warning'
                                          ? 'text-amber-700 dark:text-amber-300'
                                          : sub.status === 'aligned'
                                            ? 'text-emerald-700 dark:text-emerald-300'
                                            : 'text-slate-500 dark:text-slate-400'
                                    }
                                  >
                                    {subMeta.label}
                                  </span>
                                </div>
                                <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-data">
                                  {txLocal('기본', 'Default')}: {sub.expectedDefaultDisplay}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
};
