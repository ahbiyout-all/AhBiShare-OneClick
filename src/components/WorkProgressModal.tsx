import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  X,
  XCircle,
} from 'lucide-react';
import { PipelineStep } from '@/types/share';

export type ProgressJobStatus = 'running' | 'success' | 'error';

export interface ProgressJobState {
  isOpen: boolean;
  jobKey: string;
  title: string;
  subtitle?: string;
  status: ProgressJobStatus;
  steps: PipelineStep[];
  startedAtMs: number;
  finishedAtMs: number | null;
  summary?: string;
  errorDetail?: string;
}

interface WorkProgressModalProps {
  job: ProgressJobState;
  onClose: () => void;
  onOpenDiagnostics?: (errorDetail?: string) => void;
}

const AUTO_CLOSE_DELAY_MS = 1500;

function formatElapsedSeconds(ms: number): string {
  const safeMs = Math.max(0, ms);
  if (safeMs < 60_000) {
    return `${(safeMs / 1000).toFixed(1)}초`;
  }
  const totalSec = safeMs / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(1).padStart(4, '0');
  return `${mins}분 ${secs}초`;
}

function formatStepDuration(ms?: number): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '';
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export const WorkProgressModal: React.FC<WorkProgressModalProps> = ({ job, onClose, onOpenDiagnostics }) => {
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [remainingAutoCloseMs, setRemainingAutoCloseMs] = useState<number>(AUTO_CLOSE_DELAY_MS);
  const activeStepRef = useRef<HTMLLIElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isRunning = job.status === 'running';
  const isSuccess = job.status === 'success';
  const isError = job.status === 'error';

  // Live 100ms elapsed clock while running
  useEffect(() => {
    if (!job.isOpen || !isRunning) return;
    setNowTickMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [job.isOpen, isRunning, job.jobKey]);

  // 1.5s auto-close countdown when job finishes with success; hold open on error
  useEffect(() => {
    if (!job.isOpen || !isSuccess) {
      setRemainingAutoCloseMs(AUTO_CLOSE_DELAY_MS);
      return;
    }

    const closeAt = Date.now() + AUTO_CLOSE_DELAY_MS;
    setRemainingAutoCloseMs(AUTO_CLOSE_DELAY_MS);

    const countdownId = window.setInterval(() => {
      setRemainingAutoCloseMs(Math.max(0, closeAt - Date.now()));
    }, 100);

    const autoCloseTimerId = window.setTimeout(() => {
      onCloseRef.current();
    }, AUTO_CLOSE_DELAY_MS);

    return () => {
      window.clearInterval(countdownId);
      window.clearTimeout(autoCloseTimerId);
    };
  }, [job.isOpen, isSuccess, job.jobKey]);

  // Lock page scroll & isolate focus inside modal while open; restore focus on close
  useEffect(() => {
    if (!job.isOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    try {
      modalRef.current?.focus({ preventScroll: true });
    } catch {
      modalRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      const prevEl = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prevEl && prevEl.isConnected) {
        try {
          prevEl.focus({ preventScroll: true });
        } catch {
          prevEl.focus();
        }
      }
    };
  }, [job.isOpen, job.jobKey]);

  // Move focus to confirm button on error so keyboard users can review/dismiss cleanly
  useEffect(() => {
    if (!job.isOpen || !isError || !modalRef.current) return;
    const errBtn = modalRef.current.querySelector<HTMLButtonElement>('#btn-progress-confirm-error');
    if (errBtn) {
      try {
        errBtn.focus({ preventScroll: true });
      } catch {
        errBtn.focus();
      }
    }
  }, [job.isOpen, isError]);

  // Trap Tab & block Escape/background Enter/Space while running; allow Escape after completion/error
  useEffect(() => {
    if (!job.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRunning) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onCloseRef.current();
        return;
      }

      const modalEl = modalRef.current;
      if (!modalEl) return;

      if ((e.key === 'Enter' || e.key === ' ') && (!modalEl.contains(document.activeElement) || isRunning)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Tab') {
        if (isRunning) {
          e.preventDefault();
          modalEl.focus();
          return;
        }
        const focusables = Array.from(
          modalEl.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) {
          e.preventDefault();
          modalEl.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !modalEl.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (active === first || active === modalEl)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [job.isOpen, isRunning]);

  // Auto-scroll active or failed step into view
  useEffect(() => {
    if (!job.isOpen || !activeStepRef.current) return;
    try {
      activeStepRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch {}
  }, [job.isOpen, job.steps]);

  if (!job.isOpen) return null;

  const totalSteps = job.steps.length;
  const completedSteps = job.steps.filter((s) => s.status === 'success').length;
  const failedStep = job.steps.find((s) => s.status === 'error');
  const runningStep = job.steps.find((s) => s.status === 'running');
  const focusStepId = runningStep?.id || failedStep?.id || null;

  const elapsedMs =
    job.finishedAtMs !== null
      ? Math.max(0, job.finishedAtMs - job.startedAtMs)
      : Math.max(0, nowTickMs - job.startedAtMs);

  const outerStroke = isError ? '#DC2626' : isSuccess ? '#16A34A' : '#4F46E5';
  const innerStroke = isError ? '#EF4444' : isSuccess ? '#22C55E' : '#6366F1';

  return (
    <div
      id="work-progress-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-progress-modal-title"
      aria-describedby="work-progress-modal-status"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRunning) {
          onClose();
        }
      }}
    >
      <div
        id="work-progress-modal"
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#0F172A] shadow-2xl overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h3
              id="work-progress-modal-title"
              className="font-display text-base font-bold text-slate-900 dark:text-white truncate"
            >
              {job.title}
            </h3>
            {job.subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate tabular-data">
                {job.subtitle}
              </p>
            )}
          </div>

          {isRunning ? (
            <span
              id="work-progress-lock-indicator"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>실행 중 잠금</span>
            </span>
          ) : (
            <button
              id="btn-progress-header-close"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0"
              aria-label="진행 창 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dual-Ring Motion Showcase & Live Status Summary */}
        <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-4 shrink-0 bg-slate-50/70 dark:bg-slate-900/40">
          <div className="relative w-20 h-20 flex items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 80 80" className="w-20 h-20 overflow-visible">
              {/* Outer static subtle track */}
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-slate-200 dark:text-slate-800"
              />
              {/* Outer clockwise primary motion arc */}
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke={outerStroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={isRunning ? '76 138' : '214 0'}
                className={isRunning ? 'ahbi-motion-ring-cw' : 'transition-all duration-200'}
              />
              {/* Inner subtle track */}
              <circle
                cx="40"
                cy="40"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-slate-200/80 dark:text-slate-800/80"
              />
              {/* Inner counter-clockwise secondary motion ring */}
              <circle
                cx="40"
                cy="40"
                r="24"
                fill="none"
                stroke={innerStroke}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeDasharray={isRunning ? '46 105' : '151 0'}
                strokeOpacity={isRunning ? '0.85' : '0.45'}
                className={isRunning ? 'ahbi-motion-ring-ccw' : 'transition-all duration-200'}
              />
            </svg>

            <div className="absolute inset-0 flex items-center justify-center">
              {isRunning && (
                <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              )}
              {isSuccess && (
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              )}
              {isError && (
                <XCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>

          <div className="space-y-1.5 max-w-md">
            <p
              id="work-progress-modal-status"
              className={`text-sm font-semibold ${
                isError
                  ? 'text-red-600 dark:text-red-400'
                  : isSuccess
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-white'
              }`}
            >
              {isRunning
                ? runningStep?.title || 'Windows 네트워크 및 공유 구성을 처리하고 있습니다...'
                : isSuccess
                  ? job.summary || '모든 작업 단계가 정상적으로 완료되었습니다.'
                  : job.errorDetail || failedStep?.error || '작업 실행 중 오류가 발생했습니다.'}
            </p>

            {/* Unboxed Tabular Metadata Row */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-data">
              <span>경과 시간 {formatElapsedSeconds(elapsedMs)}</span>
              {totalSteps > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    진행 {isError ? `${completedSteps}/${totalSteps} (중단)` : `${completedSteps} / ${totalSteps} 단계`}
                  </span>
                </>
              )}
              {isSuccess && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {(remainingAutoCloseMs / 1000).toFixed(1)}초 후 자동 닫힘
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Step Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {job.steps.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              실행 단계를 준비하고 있습니다...
            </div>
          ) : (
            <ul
              id="work-progress-step-list"
              className="divide-y divide-slate-200 dark:divide-slate-800 text-xs"
            >
              {job.steps.map((step, index) => {
                const isFocus = focusStepId === step.id;
                const durationLabel = formatStepDuration(step.durationMs);
                return (
                  <li
                    key={step.id}
                    ref={isFocus ? activeStepRef : null}
                    className={`py-3 flex items-start gap-3 transition-colors ${
                      step.status === 'running'
                        ? 'text-slate-900 dark:text-white'
                        : step.status === 'error'
                          ? 'text-red-700 dark:text-red-300'
                          : step.status === 'success'
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0" aria-hidden="true">
                      {step.status === 'idle' && (
                        <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      )}
                      {step.status === 'running' && (
                        <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                      )}
                      {step.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                      {step.status === 'error' && (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold leading-snug">
                          {index + 1}. {step.title}
                        </span>
                        <span className="tabular-data text-[11px] shrink-0 text-slate-500 dark:text-slate-400">
                          {step.status === 'running'
                            ? '실행 중'
                            : step.status === 'success'
                              ? durationLabel || '완료'
                              : step.status === 'error'
                                ? '실패'
                                : '대기'}
                        </span>
                      </div>

                      {step.detail && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                          {step.detail}
                        </p>
                      )}

                      {step.status === 'error' && step.error && (
                        <p className="mt-1 px-2.5 py-2 rounded-md bg-red-500/10 border border-red-500/25 text-[11px] text-red-700 dark:text-red-300 leading-relaxed break-words">
                          {step.error}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-4 shrink-0">
          {isRunning ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              중복 실행 방지를 위해 작업이 완료될 때까지 창을 닫을 수 없습니다.
            </p>
          ) : isSuccess ? (
            <>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-data">
                완료됨 · {(remainingAutoCloseMs / 1000).toFixed(1)}초 후 자동 닫힘
              </span>
              <button
                id="btn-progress-close-now"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                바로 닫기
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                오류 내용을 확인한 뒤 조치해 주세요.
              </span>
              <div className="flex items-center gap-2">
                {onOpenDiagnostics && (
                  <button
                    id="btn-progress-open-diag"
                    type="button"
                    onClick={() => {
                      const err = job.errorDetail || job.summary || job.steps.find((s) => s.status === 'error')?.error;
                      onClose();
                      onOpenDiagnostics(err);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shadow-sm"
                  >
                    해결 가이드 & 진단 열기
                  </button>
                )}
                <button
                  id="btn-progress-confirm-error"
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  확인 및 닫기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
