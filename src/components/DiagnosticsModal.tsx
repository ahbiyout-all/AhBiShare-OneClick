import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity, KeyRound, Copy, Download, Shield, Check } from 'lucide-react';
import { DiagnosticCheck, OsNetworkPolicyStatus, PingHostResult } from '@/types/share';
import { validateTargetHost } from '@/utils/connectionCode';
import { classifyFailureDiagnostics, formatEraShortLabel } from '@/services/networkEvolution';
import { buildHostGuestUnlockBatchScript, buildHostGuestUnlockPsCommand } from '@/services/powershellEngine';
import { useI18n } from '@/i18n/I18nContext';

export interface SuggestedPingTarget {
  label: string;
  host: string;
}

interface DiagnosticsModalProps {
  isOpen: boolean;
  isLoading: boolean;
  checks: DiagnosticCheck[];
  defaultTargetHost?: string;
  defaultShareName?: string;
  activeErrorCode?: string | null;
  failedErrorText?: string | null;
  suggestedTargets?: SuggestedPingTarget[];
  policyStatus?: OsNetworkPolicyStatus | null;
  onOpenMatrix?: () => void;
  onSwitchToAccountMode?: () => void;
  onPingHost: (target: string) => Promise<PingHostResult>;
  onClose: () => void;
  onRerun: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  isLoading,
  checks,
  defaultTargetHost = '',
  defaultShareName = 'AhBiShared',
  activeErrorCode = null,
  failedErrorText = null,
  suggestedTargets = [],
  policyStatus = null,
  onOpenMatrix,
  onSwitchToAccountMode,
  onPingHost,
  onClose,
  onRerun,
}) => {
  const { tx } = useI18n();
  const [pingTarget, setPingTarget] = useState(defaultTargetHost);
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<PingHostResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);

  const isAuthOrGuestIssue = Boolean(
    classifyFailureDiagnostics(failedErrorText || activeErrorCode || undefined)?.isHostAuthOrGuestIssue
  );

  const [showHostUnlockTools, setShowHostUnlockTools] = useState(isAuthOrGuestIssue);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyText = async (text: string, key: string) => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {}
    if (!ok) {
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
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    if (ok) {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedKey(key);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedKey(null);
        copyTimerRef.current = null;
      }, 2000);
    }
  };

  const handleDownloadBat = () => {
    const batContent = buildHostGuestUnlockBatchScript(defaultShareName).replace(/\r?\n/g, '\r\n');
    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AhBiShare_Host_Unblock.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setShowHostUnlockTools(isAuthOrGuestIssue);
      setPingError(null);
      setPingResult(null);
      setCopiedKey(null);
      if (defaultTargetHost) {
        setPingTarget(defaultTargetHost);
      }
    } else if (isOpen && isAuthOrGuestIssue) {
      setShowHostUnlockTools(true);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, isAuthOrGuestIssue, defaultTargetHost]);

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
      setPingError(err instanceof Error ? err.message : tx('Ping 측정 중 오류가 발생했습니다.', 'Error occurred during Ping test.'));
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
            {tx('SMB 네트워크 스택 및 메인 PC 연결성 진단', 'SMB Network Stack & Host Connectivity Diagnostics')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-md cursor-pointer"
            aria-label={tx('닫기', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Emergency Solution Card for Error 86 / 1223 / 1385 / 5 / Host Auth Denied */}
          {(isAuthOrGuestIssue || showHostUnlockTools) ? (
            <section
              id="diag-auth-solution-card"
              className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 space-y-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {tx(
                        '호스트 자격증명 요구 · 오류 86 / 1223 해결 가이드',
                        'Host Credentials Required · Error 86 / 1223 Resolution Guide'
                      )}
                    </h4>
                    <span className="tabular-data text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      {tx('호스트 무비밀번호 개방 필요', 'Host Passwordless Unlock Needed')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tx(
                      `대상 호스트 PC(${defaultTargetHost || '메인 PC'})의 Windows에서 '암호로 보호된 공유'가 켜져 있거나 빈 암호 네트워크 로그온(LimitBlankPasswordUse=1)을 거부하고 있습니다. 아래 2가지 중 편한 방법으로 해결하세요.`,
                      `Target host PC (${defaultTargetHost || 'Host PC'}) has password-protected sharing enabled or blocks blank-password network logons (LimitBlankPasswordUse=1). Resolve using one of the two options below.`
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Solution 1: Host Unlock */}
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        {tx('호스트 PC 무비밀번호 완전 개방 (추천)', 'Unlock Host Passwordless Access (Recommended)')}
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {tx(
                        '호스트 PC에서 관리자 권한으로 실행하면 빈 암호 제한 해제, Guest 계정 초기화 및 SeDenyNetworkLogonRight 정리가 즉시 적용됩니다.',
                        'Run as Administrator on the host PC to remove blank-password limits, reset Guest, and clear SeDenyNetworkLogonRight.'
                      )}
                    </p>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyText(buildHostGuestUnlockPsCommand(defaultShareName), 'host-cmd')}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedKey === 'host-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'host-cmd'
                          ? tx('복구 명령 복사됨!', 'Recovery Command Copied!')
                          : tx('원클릭 복구 명령 복사', 'Copy Recovery Command')}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadBat}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {tx('.bat 파일 다운로드', 'Download .bat')}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {tx(
                        '※ 호스트 PC에서도 AhBiShare를 실행 중이라면 메인 PC 탭에서 [간편 무비밀번호] 모드로 공유를 개설하거나 [.bat 복구 파일 저장]을 실행해 주세요.',
                        'Tip: If AhBiShare is also running on the host PC, create the share in [Passwordless Guest] mode or run [Save .bat Recovery Script].'
                      )}
                    </p>
                  </div>
                </div>

                {/* Solution 2: Switch to Account Mode */}
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        {tx('보안 계정 모드로 즉시 전환', 'Switch to Secure Account Mode')}
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {tx(
                        '호스트 PC의 Windows 정책을 바꾸지 않고, 호스트의 전용 계정(또는 Windows 사용자 이름과 암호)을 입력하여 인증 연결합니다.',
                        'Connect using a dedicated host account (or Windows username & password) without modifying host Windows policies.'
                      )}
                    </p>
                  </div>
                  <div className="pt-2">
                    {onSwitchToAccountMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchToAccountMode();
                          onClose();
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {tx('보안 계정(ID/PW) 모드로 즉시 전환', 'Switch to Secure Account (ID/PW)')}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {tx('클라이언트 패널에서 [보안 계정]을 선택해 연결할 수 있습니다.', 'Select [Secure Account] in the Client panel to connect.')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                {tx('무비밀번호 연결 시 호스트에서 오류 86 / 1223이 발생하나요?', 'Seeing Error 86 / 1223 during passwordless connection?')}
              </span>
              <button
                type="button"
                onClick={() => setShowHostUnlockTools(true)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {tx('호스트 무비밀번호 개방 도구 열기', 'Open Host Unlock Tools')}
              </button>
            </div>
          )}

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {tx('대상 메인 PC Ping 지연 시간 및 포트 445 확인', 'Target Host Ping Latency & Port 445 Check')}
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
                placeholder={tx('메인 PC IP 또는 호스트 이름 (예: 192.168.0.10)', 'Host PC IP or hostname (e.g., 192.168.0.10)')}
                className="flex-1 min-w-0 px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                id="diag-ping-run-btn"
                type="submit"
                disabled={isPinging}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-pulse' : ''}`} />
                {isPinging ? tx('측정 중...', 'Testing...') : tx('Ping 테스트', 'Ping Test')}
              </button>
            </form>

            {suggestedTargets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">{tx('감지된 대상:', 'Detected targets:')}</span>
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
                    {pingResult.reachable ? tx('도달 가능', 'Reachable') : tx('응답 없음', 'No Response')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">{tx('평균 지연', 'Avg Latency')}</div>
                    <div className="mt-0.5 tabular-data font-bold text-slate-900 dark:text-white">
                      {pingResult.avgLatencyMs !== null ? `${pingResult.avgLatencyMs}ms` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">{tx('최소 / 최대', 'Min / Max')}</div>
                    <div className="mt-0.5 tabular-data font-semibold text-slate-900 dark:text-white">
                      {pingResult.minLatencyMs !== null && pingResult.maxLatencyMs !== null
                        ? `${pingResult.minLatencyMs} / ${pingResult.maxLatencyMs}ms`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">{tx('패킷 손실', 'Packet Loss')}</div>
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
              {tx('로컬 Windows SMB 서비스 및 캐시 상태', 'Local Windows SMB Services & Cache Status')}
            </h4>

            {isLoading ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {tx(
                  'DNS/ARP 캐시 초기화 및 SMB 핵심 서비스 상태를 점검하고 있습니다...',
                  'Flushing DNS/ARP caches and inspecting core SMB services...'
                )}
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
                    {tx('Windows OS 네트워크 정책 호환성', 'Windows OS Network Policy Compatibility')} ({formatEraShortLabel(policyStatus.osEra, policyStatus.osBuild, policyStatus.osDisplayVersion)})
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {tx('호환 지수', 'Compatibility Score')}{' '}
                    <strong className="tabular-data">
                      {tx(`${policyStatus.compatibilityScore}점`, `${policyStatus.compatibilityScore}/100`)}
                    </strong>{' '}
                    ·{' '}
                    {policyStatus.detectedIssues.length > 0
                      ? tx(
                          `공유 장애 요인 ${policyStatus.detectedIssues.length}건 감지됨 (24H2/26H2 안전 호환 패치 권장)`,
                          `${policyStatus.detectedIssues.length} compatibility issue(s) detected (24H2/26H2 safe patch recommended)`
                        )
                      : tx(
                          'SMB 서명 및 게스트 호환 정책이 정상 정렬되어 있습니다.',
                          'SMB signing and guest compatibility policies are properly aligned.'
                        )}
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
                    {tx('호환성 매트릭스 열기', 'Open Compatibility Matrix')}
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
            {tx('서비스 재점검', 'Re-run Checks')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer"
          >
            {tx('확인', 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
};
