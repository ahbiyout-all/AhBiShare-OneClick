import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';
import { DiagnosticCheck, OsNetworkPolicyStatus, PingHostResult } from '@/types/share';
import { validateTargetHost } from '@/utils/connectionCode';
import { formatEraShortLabel } from '@/services/networkEvolution';

export interface SuggestedPingTarget {
  label: string;
  host: string;
}

interface DiagnosticsModalProps {
  isOpen: boolean;
  isLoading: boolean;
  checks: DiagnosticCheck[];
  defaultTargetHost?: string;
  suggestedTargets?: SuggestedPingTarget[];
  policyStatus?: OsNetworkPolicyStatus | null;
  onOpenMatrix?: () => void;
  onPingHost: (target: string) => Promise<PingHostResult>;
  onClose: () => void;
  onRerun: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  isLoading,
  checks,
  defaultTargetHost = '',
  suggestedTargets = [],
  policyStatus = null,
  onOpenMatrix,
  onPingHost,
  onClose,
  onRerun,
}) => {
  const [pingTarget, setPingTarget] = useState(defaultTargetHost);
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<PingHostResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPingError(null);
    if (defaultTargetHost) {
      setPingTarget(defaultTargetHost);
    }
  }, [isOpen, defaultTargetHost]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const executePing = async (targetToProbe: string) => {
    const clean = targetToProbe.trim();
    const validationErr = validateTargetHost(clean);
    if (validationErr) {
      setPingError(validationErr);
      return;
    }

    setPingError(null);
    setIsPinging(true);
    try {
      const res = await onPingHost(clean);
      setPingResult(res);
    } catch (err) {
      setPingError(err instanceof Error ? err.message : 'Ping 측정 중 오류가 발생했습니다.');
    } finally {
      setIsPinging(false);
    }
  };

  const handlePingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executePing(pingTarget);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diag-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0F172A] shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <h3 id="diag-modal-title" className="font-display text-base font-bold text-slate-900 dark:text-white">
            SMB 네트워크 스택 및 메인 PC 연결성 진단
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              대상 메인 PC Ping 지연 시간 및 포트 445 확인
            </h4>

            <form onSubmit={handlePingSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                id="diag-ping-target-input"
                type="text"
                value={pingTarget}
                onChange={(e) => {
                  setPingError(null);
                  setPingTarget(e.target.value);
                }}
                placeholder="메인 PC IP 또는 호스트 이름 (예: 192.168.0.10)"
                className="flex-1 min-w-0 px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                id="diag-ping-run-btn"
                type="submit"
                disabled={isPinging}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-pulse' : ''}`} />
                {isPinging ? '측정 중...' : 'Ping 테스트'}
              </button>
            </form>

            {suggestedTargets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">감지된 대상:</span>
                {suggestedTargets.slice(0, 4).map((item) => (
                  <button
                    key={`${item.label}-${item.host}`}
                    type="button"
                    onClick={() => {
                      setPingTarget(item.host);
                      void executePing(item.host);
                    }}
                    className="px-2 py-0.5 tabular-data text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
                  >
                    {item.label} ({item.host})
                  </button>
                ))}
              </div>
            )}

            {pingError && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {pingError}
              </p>
            )}

            {pingResult && (
              <div
                id="diag-ping-result-card"
                className={`p-4 rounded-lg border space-y-3 ${
                  pingResult.reachable
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {pingResult.reachable ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {pingResult.target}
                      {pingResult.resolvedIp && pingResult.resolvedIp !== pingResult.target
                        ? ` (${pingResult.resolvedIp})`
                        : ''}
                    </span>
                  </div>
                  <span
                    className={`tabular-data text-xs font-bold shrink-0 ${
                      pingResult.reachable
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {pingResult.reachable ? '도달 가능' : '응답 없음'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">평균 지연</div>
                    <div className="mt-0.5 tabular-data font-bold text-slate-900 dark:text-white">
                      {pingResult.avgLatencyMs !== null ? `${pingResult.avgLatencyMs}ms` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">최소 / 최대</div>
                    <div className="mt-0.5 tabular-data font-semibold text-slate-900 dark:text-white">
                      {pingResult.minLatencyMs !== null && pingResult.maxLatencyMs !== null
                        ? `${pingResult.minLatencyMs} / ${pingResult.maxLatencyMs}ms`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">패킷 손실</div>
                    <div className="mt-0.5 tabular-data font-semibold text-slate-900 dark:text-white">
                      {pingResult.packetLossPct}%
                    </div>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">SMB 445</div>
                    <div
                      className={`mt-0.5 tabular-data font-bold ${
                        pingResult.smbPortOpen
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {pingResult.smbPortOpen ? 'OPEN' : 'CLOSED'}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {pingResult.detail}
                </p>
              </div>
            )}
          </section>

          <section className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              로컬 Windows SMB 서비스 및 캐시 상태
            </h4>

            {isLoading ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                DNS/ARP 캐시 초기화 및 SMB 핵심 서비스 상태를 점검하고 있습니다...
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {checks.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {item.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {item.status === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {item.status === 'fail' && <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                      <p className="mt-0.5 tabular-data text-xs text-slate-600 dark:text-slate-400">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {policyStatus && (
            <section className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Windows OS 네트워크 정책 호환성 ({formatEraShortLabel(policyStatus.osEra, policyStatus.osBuild, policyStatus.osDisplayVersion)})
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    호환 지수 <strong className="tabular-data">{policyStatus.compatibilityScore}점</strong> ·{' '}
                    {policyStatus.detectedIssues.length > 0
                      ? `공유 장애 요인 ${policyStatus.detectedIssues.length}건 감지됨 (24H2/26H2 안전 호환 패치 권장)`
                      : 'SMB 서명 및 게스트 호환 정책이 정상 정렬되어 있습니다.'}
                  </p>
                </div>
                {onOpenMatrix && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMatrix();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    호환성 매트릭스 열기
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onRerun}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            서비스 재점검
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
