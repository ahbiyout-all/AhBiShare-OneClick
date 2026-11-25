import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  HardDrive,
  Laptop,
  Loader2,
  Play,
  Power,
  RotateCcw,
  Server,
  ShieldAlert,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Usb,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  LocalNetworkInfo,
  OsNetworkPolicyStatus,
  PendingHostPolicyTask,
  PolicyApplyResult,
  TroubleshootMatchResult,
  TroubleshootStepStatus,
  TroubleshootTicket,
  TroubleshootWizardStep,
} from '@/types/share';
import { formatSnapshotTimestamp } from '@/services/networkEvolution';
import {
  SyncAwarePolicyBadge,
  evaluateStepPolicyMatch,
} from '@/components/SyncAwarePolicyBadge';

interface TroubleshootWizardModalProps {
  isOpen: boolean;
  tickets: TroubleshootTicket[];
  selectedTicketId: string | null;
  matchResult: TroubleshootMatchResult;
  netInfo: LocalNetworkInfo;
  writeProtected?: boolean;
  policyStatus?: OsNetworkPolicyStatus | null;
  lastPatchResult?: PolicyApplyResult | null;
  pendingHostTask?: PendingHostPolicyTask | null;
  onOpenMatrix?: () => void;
  onTriggerReboot?: () => Promise<{ success: boolean; message: string }>;
  onSelectTicket: (ticketId: string) => void;
  onClose: () => void;
  onExecuteStep: (
    ticket: TroubleshootTicket,
    step: TroubleshootWizardStep
  ) => Promise<{ success: boolean; message: string }>;
  onSkipStep: (ticket: TroubleshootTicket, step: TroubleshootWizardStep) => Promise<void>;
  onVerifyTargetReachability: (ticket: TroubleshootTicket) => Promise<{
    reachable: boolean;
    smbPortOpen: boolean;
    detail: string;
  }>;
  onMarkResolved: (ticket: TroubleshootTicket) => Promise<void>;
  onDeleteTicket: (ticketId: string) => Promise<void>;
  onClearResolved: () => Promise<void>;
}

const STEP_STATUS_META: Record<
  TroubleshootStepStatus,
  { label: string; textClass: string }
> = {
  pending: { label: '대기', textClass: 'text-slate-500 dark:text-slate-400' },
  completed: { label: '완료', textClass: 'text-emerald-600 dark:text-emerald-400' },
  skipped: { label: '건너뜀', textClass: 'text-slate-400 dark:text-slate-500' },
  failed: { label: '실패', textClass: 'text-red-600 dark:text-red-400' },
};

function StepStatusIcon({ status }: { status: TroubleshootStepStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }
  if (status === 'failed') {
    return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />;
  }
  if (status === 'skipped') {
    return <SkipForward className="w-4 h-4 text-slate-400 shrink-0" />;
  }
  return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
}

export const TroubleshootWizardModal: React.FC<TroubleshootWizardModalProps> = ({
  isOpen,
  tickets,
  selectedTicketId,
  matchResult,
  netInfo,
  writeProtected,
  policyStatus,
  lastPatchResult,
  pendingHostTask,
  onOpenMatrix,
  onTriggerReboot,
  onSelectTicket,
  onClose,
  onExecuteStep,
  onSkipStep,
  onVerifyTargetReachability,
  onMarkResolved,
  onDeleteTicket,
  onClearResolved,
}) => {
  const [wizardStage, setWizardStage] = useState<1 | 2 | 3>(1);
  const [activeSide, setActiveSide] = useState<'host' | 'client'>('host');
  const [executingStepId, setExecutingStepId] = useState<string | null>(null);
  const [verifyingNet, setVerifyingNet] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{ ok: boolean; detail: string } | null>(null);
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReboot, setConfirmReboot] = useState(false);
  const [rebooting, setRebooting] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const copyTimerRef = useRef<number | null>(null);

  const activeTicket = useMemo(() => {
    if (!tickets || tickets.length === 0) return null;
    if (selectedTicketId) {
      const found = tickets.find((t) => t.ticketId === selectedTicketId);
      if (found) return found;
    }
    return matchResult.primaryTicket || tickets[0] || null;
  }, [tickets, selectedTicketId, matchResult.primaryTicket]);

  const matchedSide = activeTicket ? matchResult.matchedSideMap[activeTicket.ticketId] || 'none' : 'none';
  const isBusy = executingStepId !== null || verifyingNet || rebooting;

  const { effectiveHostSteps, effectiveClientSteps, effectiveTicketStatus } = useMemo(() => {
    if (!activeTicket) {
      return {
        effectiveHostSteps: [],
        effectiveClientSteps: [],
        effectiveTicketStatus: 'open' as TroubleshootTicket['status'],
      };
    }

    const hostMatchesPc = matchedSide === 'host' || matchedSide === 'both';
    const clientMatchesPc = matchedSide === 'client' || matchedSide === 'both';

    const nextHost = activeTicket.hostSteps.map((step) => ({
      step,
      ...evaluateStepPolicyMatch(step, activeTicket, policyStatus, hostMatchesPc),
    }));
    const nextClient = activeTicket.clientSteps.map((step) => ({
      step,
      ...evaluateStepPolicyMatch(step, activeTicket, policyStatus, clientMatchesPc),
    }));

    let nextTicketStatus: TroubleshootTicket['status'] = activeTicket.status;
    if (activeTicket.status !== 'resolved') {
      const isDone = (s: TroubleshootStepStatus) => s === 'completed' || s === 'skipped';
      const hostHas = nextHost.length > 0;
      const clientHas = nextClient.length > 0;
      const hostAllDone = !hostHas || nextHost.every((e) => isDone(e.effectiveStatus));
      const clientAllDone = !clientHas || nextClient.every((e) => isDone(e.effectiveStatus));
      const hostAnyCompleted = nextHost.some((e) => e.effectiveStatus === 'completed');
      const clientAnyCompleted = nextClient.some((e) => e.effectiveStatus === 'completed');

      if (hostAllDone && clientAllDone && (hostAnyCompleted || clientAnyCompleted)) {
        nextTicketStatus = 'resolved';
      } else if (hostHas && hostAllDone && hostAnyCompleted) {
        nextTicketStatus = 'host_fixed';
      } else if (clientHas && clientAllDone && clientAnyCompleted) {
        nextTicketStatus = 'client_fixed';
      }
    }

    return {
      effectiveHostSteps: nextHost,
      effectiveClientSteps: nextClient,
      effectiveTicketStatus: nextTicketStatus,
    };
  }, [activeTicket, matchedSide, policyStatus]);

  // Reset stage & default side only when modal opens or ticket switches
  useEffect(() => {
    if (!isOpen || !activeTicket) return;
    const nextMatch = matchResult.matchedSideMap[activeTicket.ticketId] || 'none';
    if (nextMatch === 'host') {
      setActiveSide(activeTicket.hostSteps.length > 0 ? 'host' : 'client');
    } else if (nextMatch === 'client') {
      setActiveSide(activeTicket.clientSteps.length > 0 ? 'client' : 'host');
    } else if (activeTicket.recommendedSide === 'client' && activeTicket.clientSteps.length > 0) {
      setActiveSide('client');
    } else {
      setActiveSide(activeTicket.hostSteps.length > 0 ? 'host' : 'client');
    }
    setWizardStage(
      activeTicket.status === 'host_fixed' || activeTicket.status === 'client_fixed' ? 2 : 1
    );
    setVerifyFeedback(null);
    setConfirmDelete(false);
    setConfirmReboot(false);
  }, [isOpen, activeTicket?.ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isBusy]);

  if (!isOpen) return null;

  const handleCopyCommand = async (stepId: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedStepId(stepId);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedStepId(null);
        copyTimerRef.current = null;
      }, 2200);
    } catch {}
  };

  const handleRunStep = async (step: TroubleshootWizardStep) => {
    if (!activeTicket || isBusy) return;
    setExecutingStepId(step.stepId);
    try {
      await onExecuteStep(activeTicket, step);
    } finally {
      setExecutingStepId(null);
    }
  };

  const handleRunVerify = async () => {
    if (!activeTicket || isBusy) return;
    setVerifyingNet(true);
    try {
      const res = await onVerifyTargetReachability(activeTicket);
      setVerifyFeedback({ ok: res.reachable && res.smbPortOpen, detail: res.detail });
    } finally {
      setVerifyingNet(false);
    }
  };

  const hostSteps = activeTicket?.hostSteps || [];
  const clientSteps = activeTicket?.clientSteps || [];
  const hostDoneCount = effectiveHostSteps.filter(
    (e) => e.effectiveStatus === 'completed' || e.effectiveStatus === 'skipped'
  ).length;
  const clientDoneCount = effectiveClientSteps.filter(
    (e) => e.effectiveStatus === 'completed' || e.effectiveStatus === 'skipped'
  ).length;
  const visibleEffectiveSteps = activeSide === 'host' ? effectiveHostSteps : effectiveClientSteps;
  const resolvedCount = matchResult.resolvedTickets.length;

  const pcMatchesSelectedSide =
    matchedSide === 'both' || matchedSide === activeSide;

  const matchedApplicableEffectiveSteps = activeTicket
    ? [
        ...(matchedSide === 'host' || matchedSide === 'both' ? effectiveHostSteps : []),
        ...(matchedSide === 'client' || matchedSide === 'both' ? effectiveClientSteps : []),
      ]
    : [];
  const matrixSyncedStepsCount = matchedApplicableEffectiveSteps.filter(
    (e) =>
      e.effectiveStatus === 'completed' &&
      (e.autoCompletedByPolicy || (e.step.resolvedSource && e.step.resolvedSource !== 'wizard'))
  ).length;
  const remainingActionStepsCount = matchedApplicableEffectiveSteps.filter(
    (e) => e.effectiveStatus === 'pending' || e.effectiveStatus === 'failed'
  ).length;
  const completedStepNeedsReboot = activeTicket
    ? [...effectiveHostSteps, ...effectiveClientSteps].some(
        (e) => e.effectiveStatus === 'completed' && e.step.requiresReboot
      )
    : false;
  const showRebootBanner = Boolean(
    activeTicket &&
      (lastPatchResult?.rebootJudgment.rebootRecommended ||
        policyStatus?.pendingRebootFlag ||
        completedStepNeedsReboot)
  );
  const rebootStrong = Boolean(
    lastPatchResult?.rebootJudgment.level === 'reboot_required' || completedStepNeedsReboot
  );
  const rebootBannerTitle =
    lastPatchResult?.rebootJudgment.title ||
    (completedStepNeedsReboot
      ? '컴퓨터 재부팅 필수 (KIR 중복 SID · SMB 1.0 · 네트워크 스택 변경 반영)'
      : 'Windows 보류 중인 재부팅 플래그 감지됨');
  const rebootBannerReason =
    lastPatchResult?.rebootJudgment.reason ||
    '커널·네트워크 정책 변경 또는 Windows 업데이트 보류 상태가 감지되었습니다. 호스트·클라이언트 모두 재부팅 후 재연결해야 정상 반영됩니다.';

  const handleConfirmRebootClick = async () => {
    if (!onTriggerReboot || isBusy) return;
    setRebooting(true);
    try {
      await onTriggerReboot();
      setConfirmReboot(false);
    } finally {
      setRebooting(false);
    }
  };

  return (
    <div
      id="troubleshoot-wizard-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="troubleshoot-wizard-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2
                id="troubleshoot-wizard-title"
                className="font-display text-base font-bold text-slate-900 dark:text-white"
              >
                USB 양방향 오류 해결 마법사
              </h2>
              {activeTicket ? (
                <p className="tabular-data text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {activeTicket.errorCode} · {activeTicket.originHostName} →{' '}
                  {activeTicket.targetHostName || activeTicket.targetIp || '대상 PC'} ·{' '}
                  \\{activeTicket.targetIp || activeTicket.targetHostName || 'HOST'}\{activeTicket.shareName} · 현재 PC:{' '}
                  {netInfo.hostname} ({netInfo.primaryIp})
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  현재 USB에 저장된 오류 티켓이 없습니다.
                </p>
              )}
            </div>
          </div>

          <button
            id="btn-close-troubleshoot-wizard"
            type="button"
            disabled={isBusy}
            onClick={onClose}
            aria-label="오류 해결 마법사 닫기"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket switcher bar when multiple tickets exist */}
        {tickets.length > 1 && activeTicket && (
          <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              저장된 티켓 ({tickets.length}):
            </span>
            {tickets.map((t) => {
              const selected = t.ticketId === activeTicket.ticketId;
              const resolved = t.status === 'resolved';
              return (
                <button
                  key={t.ticketId}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onSelectTicket(t.ticketId)}
                  className={`px-2.5 py-1 text-xs rounded-md border whitespace-nowrap cursor-pointer tabular-data ${
                    selected
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold'
                      : resolved
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t.errorCode} · {t.shareName} ({resolved ? '완료' : '대기'})
                </button>
              );
            })}
          </div>
        )}

        {/* 3-Step Wizard Stepper */}
        {activeTicket && (
          <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 bg-slate-50/70 dark:bg-slate-950/40">
            {[
              { id: 1 as const, btnId: 'btn-wizard-stage-1', num: '01', label: '원인 및 양단 현황' },
              { id: 2 as const, btnId: 'btn-wizard-stage-2', num: '02', label: '단계별 해결 실행' },
              { id: 3 as const, btnId: 'btn-wizard-stage-3', num: '03', label: '검증 및 전달 · 완료' },
            ].map((stage) => {
              const isCurrent = wizardStage === stage.id;
              return (
                <button
                  key={stage.id}
                  id={stage.btnId}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setWizardStage(stage.id)}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-50 ${
                    isCurrent
                      ? 'bg-white dark:bg-slate-900 border-indigo-500/60 text-slate-900 dark:text-white shadow-xs'
                      : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-900/50'
                  }`}
                >
                  <div className="tabular-data text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    STEP {stage.num}
                  </div>
                  <div className="text-xs font-semibold truncate">{stage.label}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {activeTicket && (policyStatus || matrixSyncedStepsCount > 0 || pendingHostTask) && (
            <div
              id="wizard-matrix-sync-summary"
              className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  OS 호환성 매트릭스 · 호스트 대기 작업 양방향 동기화됨
                </div>
                <p className="tabular-data text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {policyStatus
                    ? `현재 OS 호환 지수 ${policyStatus.compatibilityScore}점/100 · 감지 이슈 ${policyStatus.detectedIssues.length}건 · `
                    : ''}
                  정책 자동 반영 {matrixSyncedStepsCount}단계 · 남은 실행/재시도 {remainingActionStepsCount}단계
                  {pendingHostTask
                    ? ` · 호스트 대기 작업(${pendingHostTask.targetHostName}) 연계됨`
                    : ''}
                </p>
              </div>
              {onOpenMatrix && (
                <button
                  id="btn-wizard-open-matrix"
                  type="button"
                  disabled={isBusy}
                  onClick={onOpenMatrix}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 self-end sm:self-center"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  OS 호환성 매트릭스 열기
                </button>
              )}
            </div>
          )}

          {showRebootBanner && (
            <div
              id="wizard-reboot-judgment-banner"
              className={`px-4 py-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                rebootStrong
                  ? 'border-red-500/45 bg-red-500/8 dark:bg-red-500/12'
                  : 'border-amber-500/45 bg-amber-500/8 dark:bg-amber-500/12'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {rebootStrong ? (
                  <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5 min-w-0 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">{rebootBannerTitle}</div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{rebootBannerReason}</p>
                </div>
              </div>

              {onTriggerReboot && (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {confirmReboot ? (
                    <>
                      <button
                        id="btn-wizard-confirm-reboot"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleConfirmRebootClick()}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        <Power className="w-3.5 h-3.5" />
                        {rebooting ? '재부팅 예약 중...' : '재부팅 실행 확정'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmReboot(false)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      id="btn-wizard-confirm-reboot"
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmReboot(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Power className="w-3.5 h-3.5" />
                      지금 컴퓨터 재부팅
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!activeTicket ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              모든 USB 오류 티켓이 정리되었습니다.
            </div>
          ) : wizardStage === 1 ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {activeTicket.errorCode} · {activeTicket.errorTitle}
                  </div>
                  <span className="tabular-data text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {effectiveTicketStatus === 'resolved'
                      ? '해결 완료됨'
                      : effectiveTicketStatus === 'host_fixed'
                        ? '메인 PC 조치 완료 → 클라이언트 확인 단계'
                        : effectiveTicketStatus === 'client_fixed'
                          ? '클라이언트 조치 완료 → 호스트 확인 단계'
                          : '미해결 (조치 대기)'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                  {activeTicket.rawErrorSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    발생 · 클라이언트 측 정보
                  </div>
                  <dl className="tabular-data text-xs space-y-1 text-slate-600 dark:text-slate-300">
                    <div>발생 역할: {activeTicket.originRole === 'host' ? '메인 호스트 개설' : '클라이언트 연결'}</div>
                    <div>
                      발생 PC: {activeTicket.originHostName}
                      {activeTicket.originIp ? ` (${activeTicket.originIp})` : ''}
                    </div>
                    <div>인증 모드: {activeTicket.authMode === 'guest' ? '무비밀번호 (Guest)' : '보안 계정'}</div>
                    {activeTicket.driveLetter && <div>대상 드라이브: {activeTicket.driveLetter}</div>}
                    <div>
                      클라이언트 단계: {clientDoneCount}/{clientSteps.length} 완료
                    </div>
                  </dl>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    대상 · 메인 호스트 측 정보
                  </div>
                  <dl className="tabular-data text-xs space-y-1 text-slate-600 dark:text-slate-300">
                    <div>
                      대상 호스트: {activeTicket.targetHostName || '(미지정)'}
                      {activeTicket.targetIp ? ` (${activeTicket.targetIp})` : ''}
                    </div>
                    <div>공유 이름: {activeTicket.shareName}</div>
                    {activeTicket.folderPath && <div>로컬 폴더: {activeTicket.folderPath}</div>}
                    <div>발생 시각: {formatSnapshotTimestamp(activeTicket.createdAt)}</div>
                    <div>
                      호스트 단계: {hostDoneCount}/{hostSteps.length} 완료
                    </div>
                  </dl>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/8 dark:bg-indigo-500/10 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-200">
                <Usb className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    현재 PC({netInfo.hostname}) 매칭 판정:{' '}
                    {matchedSide === 'both'
                      ? '호스트 · 클라이언트 양측 단계 실행 가능'
                      : matchedSide === 'host'
                        ? '대상 메인 호스트 PC와 일치 (호스트 조치 권장)'
                        : matchedSide === 'client'
                          ? '발생 클라이언트 PC와 일치 (클라이언트 조치 및 재연결 권장)'
                          : '현재 PC는 반대편 PC용 티켓을 열람 중입니다'}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {writeProtected
                      ? '주의: USB 폴더가 읽기 전용이므로 단계 진행 상태는 파일에 기록되지 않을 수 있습니다.'
                      : '각 단계를 완료할 때마다 USB AhBiShare_OneClick.portable.json에 자동 저장되어 반대편 PC로 USB를 옮겨 그대로 이어갈 수 있습니다.'}
                  </p>
                </div>
              </div>
            </div>
          ) : wizardStage === 2 ? (
            <div className="space-y-4">
              {/* Role side selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  id="btn-wizard-side-host"
                  type="button"
                  disabled={isBusy}
                  onClick={() => setActiveSide('host')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                    activeSide === 'host'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>
                    호스트 PC 단계 ({hostDoneCount}/{hostSteps.length})
                  </span>
                </button>
                <button
                  id="btn-wizard-side-client"
                  type="button"
                  disabled={isBusy}
                  onClick={() => setActiveSide('client')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                    activeSide === 'client'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>
                    클라이언트 PC 단계 ({clientDoneCount}/{clientSteps.length})
                  </span>
                </button>
              </div>

              {!pcMatchesSelectedSide && visibleEffectiveSteps.length > 0 && (
                <div className="px-4 py-2.5 rounded-lg border border-amber-500/35 bg-amber-500/8 text-xs text-amber-800 dark:text-amber-300">
                  현재 실행 중인 PC({netInfo.hostname})는{' '}
                  {activeSide === 'host' ? '호스트 대상 PC' : '원본 클라이언트 PC'}와 직접 일치하지 않습니다.{' '}
                  {activeSide === 'host'
                    ? 'USB를 메인 PC로 이동해 실행하거나, 아래 명령을 복사해 전달하세요.'
                    : 'USB를 클라이언트 PC로 이동해 실행하는 것을 권장합니다.'}
                </div>
              )}

              {visibleEffectiveSteps.length === 0 ? (
                <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                  이 오류 코드({activeTicket.errorCode})는{' '}
                  {activeSide === 'host' ? '호스트 PC 측 추가 조치가 필요하지 않습니다.' : '클라이언트 PC 측 추가 조치가 필요하지 않습니다.'}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                  {visibleEffectiveSteps.map((item, idx) => {
                    const {
                      step,
                      isPolicyMatched,
                      autoCompletedByPolicy,
                      autoSkippedByPolicy,
                      effectiveStatus,
                      explanation: policyMatchedExplanation,
                      effectiveSourceLabel,
                    } = item;
                    const meta = STEP_STATUS_META[effectiveStatus];
                    const isRunningThis = executingStepId === step.stepId;
                    const stepDone = effectiveStatus === 'completed';
                    const isExecuteDisabled = isBusy || isPolicyMatched;
                    const isMarkedSkipped = autoSkippedByPolicy || effectiveStatus === 'skipped';
                    return (
                      <div
                        key={step.stepId}
                        data-step-status={effectiveStatus}
                        data-step-skipped={isMarkedSkipped ? 'true' : 'false'}
                        className="p-4 space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 flex items-center gap-2 shrink-0">
                              <span className="tabular-data text-xs font-bold text-slate-400 dark:text-slate-500 w-5">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <StepStatusIcon status={effectiveStatus} />
                              {autoSkippedByPolicy && (
                                <SkipForward
                                  className="w-3.5 h-3.5 text-slate-400 shrink-0"
                                  aria-label="정책 충족으로 실행 건너뜀"
                                />
                              )}
                            </div>
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {step.title}
                                </span>
                                <SyncAwarePolicyBadge
                                  step={step}
                                  ticket={activeTicket}
                                  policyStatus={policyStatus}
                                  pcMatchesSide={pcMatchesSelectedSide}
                                  mode="badge"
                                />
                                <span className={`text-[11px] font-semibold ${meta.textClass}`}>
                                  · {meta.label}
                                </span>
                                {autoSkippedByPolicy && (
                                  <span className={`text-[11px] font-semibold ${STEP_STATUS_META.skipped.textClass}`}>
                                    · {STEP_STATUS_META.skipped.label} (자동 건너뜀)
                                  </span>
                                )}
                                {effectiveSourceLabel && (
                                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                    · {effectiveSourceLabel}
                                  </span>
                                )}
                                {autoCompletedByPolicy && (
                                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                    · OS 정책 자동 완료
                                  </span>
                                )}
                                {step.requiresReboot && (
                                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                    · {stepDone && policyStatus?.pendingRebootFlag ? '재부팅 대기 중' : '재부팅 필요'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                {step.description}
                              </p>
                              <SyncAwarePolicyBadge
                                step={step}
                                ticket={activeTicket}
                                policyStatus={policyStatus}
                                pcMatchesSide={pcMatchesSelectedSide}
                                mode="explanation"
                              />
                              {step.lastMessage && (
                                <p className="tabular-data text-xs text-slate-700 dark:text-slate-300 pt-0.5">
                                  최근 결과: {step.lastMessage}
                                  {step.lastAttemptAt ? ` (${formatSnapshotTimestamp(step.lastAttemptAt)})` : ''}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-start">
                            <button
                              id={`btn-exec-step-${step.stepId}`}
                              type="button"
                              disabled={isExecuteDisabled}
                              title={isPolicyMatched ? policyMatchedExplanation : undefined}
                              onClick={() => void handleRunStep(step)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap ${
                                isPolicyMatched
                                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 cursor-not-allowed opacity-85'
                                  : isBusy
                                    ? 'cursor-not-allowed opacity-50 text-white bg-indigo-600'
                                    : stepDone
                                      ? 'cursor-pointer text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                                      : 'cursor-pointer text-white bg-indigo-600 hover:bg-indigo-500'
                              }`}
                            >
                              {isRunningThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isPolicyMatched ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : stepDone ? (
                                <RotateCcw className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                              {isRunningThis
                                ? '실행 중...'
                                : isPolicyMatched
                                  ? '조건 이미 충족됨 (건너뜀)'
                                  : stepDone
                                    ? '다시 실행'
                                    : '지금 적용'}
                            </button>

                            {!isPolicyMatched && effectiveStatus !== 'completed' && effectiveStatus !== 'skipped' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void onSkipStep(activeTicket, step)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
                              >
                                건너뛰기
                              </button>
                            )}
                          </div>
                        </div>

                        {step.commandPreview && (
                          <div className="pl-8 pt-1 flex items-center justify-between gap-3">
                            <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate block">
                              {step.commandPreview}
                            </code>
                            <button
                              type="button"
                              onClick={() => void handleCopyCommand(step.stepId, step.commandPreview || '')}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              {copiedStepId === step.stepId ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  복사됨
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  명령 복사
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 3: Verification, opposite-PC handoff, manual resolve & delete */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      네트워크 도달성 · TCP 445 실시간 검증
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      대상 호스트({activeTicket.targetIp || activeTicket.targetHostName || '로컬'})의 ICMP 응답과 SMB 포트 445 연결 가능 여부를 확인합니다.
                    </p>
                  </div>
                  <button
                    id="btn-wizard-verify-445"
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleRunVerify()}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {verifyingNet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                    {verifyingNet ? '점검 중...' : '445 도달성 점검 실행'}
                  </button>
                </div>

                {verifyFeedback && (
                  <div
                    className={`px-3.5 py-2.5 rounded-lg border text-xs ${
                      verifyFeedback.ok
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                        : 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {verifyFeedback.detail}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  현재 해결 상태: {effectiveTicketStatus === 'resolved'
                    ? '양단 해결 완료됨'
                    : effectiveTicketStatus === 'host_fixed'
                      ? '메인 PC 조치 완료 → USB를 클라이언트 PC로 이동해 재연결하세요'
                      : effectiveTicketStatus === 'client_fixed'
                        ? '클라이언트 조치 완료 → 필요 시 메인 PC에서 확인하세요'
                        : '진행 중 (양단 단계 실행 후 상태가 자동 갱신됩니다)'}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  해결이 완료된 티켓은 정책상 USB 파일에 이력으로 보존되며, 확인 후 아래 버튼 또는 상단 배너에서 직접 정리할 수 있습니다.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {activeTicket.status !== 'resolved' && (
                    <button
                      id="btn-wizard-mark-resolved"
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onMarkResolved(activeTicket)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      해결 완료로 표시
                    </button>
                  )}

                  {resolvedCount > 0 && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onClearResolved()}
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-500/35 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      완료된 티켓 일괄 정리 ({resolvedCount})
                    </button>
                  )}

                  {confirmDelete ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setConfirmDelete(false);
                          void onDeleteTicket(activeTicket.ticketId);
                        }}
                        className="px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
                      >
                        현재 티켓 삭제 확정
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      id="btn-wizard-delete-ticket"
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDelete(true)}
                      className="px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-500/35 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      이 티켓 삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {activeTicket && wizardStage > 1 && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setWizardStage((prev) => (prev === 3 ? 2 : 1))}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                이전 단계
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTicket && wizardStage < 3 && (
              <button
                id="btn-wizard-next-stage"
                type="button"
                disabled={isBusy}
                onClick={() => setWizardStage((prev) => (prev === 1 ? 2 : 3))}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{wizardStage === 1 ? '2단계: 해결 조치 실행' : '3단계: 검증 및 완료'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
