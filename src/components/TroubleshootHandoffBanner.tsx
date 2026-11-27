import React, { useState } from 'react';
import {
  CheckCircle2,
  ListChecks,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Usb,
  Wrench,
} from 'lucide-react';
import {
  OsNetworkPolicyStatus,
  PendingHostPolicyTask,
  PolicyApplyResult,
  TroubleshootMatchResult,
  TroubleshootTicket,
} from '@/types/share';
import { formatSnapshotTimestamp } from '@/services/networkEvolution';
import { useI18n } from '@/i18n/I18nContext';
import { tx } from '@/i18n/localeState';

interface TroubleshootHandoffBannerProps {
  tickets: TroubleshootTicket[];
  matchResult: TroubleshootMatchResult;
  currentHostname: string;
  writeProtected?: boolean;
  policyStatus?: OsNetworkPolicyStatus | null;
  lastPatchResult?: PolicyApplyResult | null;
  pendingHostTask?: PendingHostPolicyTask | null;
  onOpenWizard: (ticketId?: string) => void;
  onOpenMatrix?: () => void;
  onDeleteTicket: (ticketId: string) => void | Promise<void>;
  onClearResolved: () => void | Promise<void>;
}

function getTicketStatusText(status: TroubleshootTicket['status']): string {
  switch (status) {
    case 'host_fixed':
      return tx('메인 PC 조치 완료 (클라이언트 확인 대기)', 'Host Fixed (Awaiting Client Verification)');
    case 'client_fixed':
      return tx('클라이언트 조치 완료 (호스트 확인 대기)', 'Client Fixed (Awaiting Host Check)');
    case 'resolved':
      return tx('양단 해결 완료', 'Resolved on Both Sides');
    default:
      return tx('조치 대기 중', 'Pending Action');
  }
}

export const TroubleshootHandoffBanner: React.FC<TroubleshootHandoffBannerProps> = ({
  tickets,
  matchResult,
  currentHostname,
  writeProtected,
  policyStatus,
  lastPatchResult,
  pendingHostTask,
  onOpenWizard,
  onOpenMatrix,
  onDeleteTicket,
  onClearResolved,
}) => {
  const { tx: txLocal } = useI18n();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!tickets || tickets.length === 0) return null;

  const { currentPcActionTickets, waitingOtherPcTickets, resolvedTickets, primaryTicket, matchedSideMap } =
    matchResult;

  const rebootAlertActive = Boolean(
    lastPatchResult?.rebootJudgment.rebootRecommended || policyStatus?.pendingRebootFlag
  );
  const rebootRequiredStrong = lastPatchResult?.rebootJudgment.level === 'reboot_required';

  if (primaryTicket) {
    const side = matchedSideMap[primaryTicket.ticketId] || 'none';
    const isHandoffBackToClient = primaryTicket.status === 'host_fixed';
    const isFromOtherPc =
      (primaryTicket.originHostName || '').trim().toLowerCase() !== currentHostname.trim().toLowerCase();
    const targetDisplay = primaryTicket.targetHostName || primaryTicket.targetIp || txLocal('대상 PC', 'Target PC');

    const headline = isHandoffBackToClient
      ? txLocal(
          `메인 PC(${targetDisplay}) 조치 완료 · 이 PC(${currentHostname})에서 재연결 마법사를 계속하세요`,
          `Main PC (${targetDisplay}) fixed · Continue the reconnection wizard on this PC (${currentHostname})`
        )
      : isFromOtherPc
        ? txLocal(
            `USB로 전달된 오류 티켓 감지 (${primaryTicket.errorCode}) · 이 PC(${currentHostname})에서 ${
              side === 'host' ? '메인 호스트 조치' : '단계별 해결'
            }를 진행하세요`,
            `USB error ticket detected (${primaryTicket.errorCode}) · Run ${
              side === 'host' ? 'host fixes' : 'step-by-step resolution'
            } on this PC (${currentHostname})`
          )
        : txLocal(
            `이 PC(${currentHostname})에서 해결이 필요한 연결·공유 오류 (${primaryTicket.errorCode})`,
            `Connection/share error requiring attention on ${currentHostname} (${primaryTicket.errorCode})`
          );

    const applicableSteps = [
      ...(side === 'host' || side === 'both' ? primaryTicket.hostSteps : []),
      ...(side === 'client' || side === 'both' ? primaryTicket.clientSteps : []),
    ];
    const pendingCount = applicableSteps.filter((s) => s.status === 'pending' || s.status === 'failed').length;
    const syncedPolicyCount = applicableSteps.filter(
      (s) =>
        s.status === 'completed' &&
        (s.resolvedSource === 'matrix' ||
          s.resolvedSource === 'host_panel' ||
          s.resolvedSource === 'live_inspect' ||
          s.resolvedSource === 'share_retry')
    ).length;

    return (
      <div
        id="troubleshoot-handoff-banner"
        role="status"
        className={`px-5 py-4 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          rebootRequiredStrong
            ? 'border-red-500/45 bg-red-500/8 dark:bg-red-500/12'
            : 'border-amber-500/45 bg-amber-500/8 dark:bg-amber-500/12'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {rebootRequiredStrong ? (
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          ) : (
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {headline}
              {currentPcActionTickets.length > 1
                ? txLocal(` (총 ${currentPcActionTickets.length}건)`, ` (${currentPcActionTickets.length} total)`)
                : ''}
            </div>
            <p className="tabular-data text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {primaryTicket.errorTitle} · {txLocal('발생:', 'Origin:')} {primaryTicket.originHostName}
              {primaryTicket.originIp ? ` (${primaryTicket.originIp})` : ''} → {txLocal('대상:', 'Target:')}{' '}
              <span className="font-semibold">
                \\{primaryTicket.targetIp || primaryTicket.targetHostName || 'HOST'}\{primaryTicket.shareName}
              </span>{' '}
              · {txLocal(`남은 단계 ${pendingCount}개`, `${pendingCount} step(s) remaining`)}
              {syncedPolicyCount > 0
                ? txLocal(` · 매트릭스 자동 반영 ${syncedPolicyCount}개`, ` · ${syncedPolicyCount} auto-synced`)
                : ''}{' '}
              · {txLocal('상태:', 'Status:')} {getTicketStatusText(primaryTicket.status)} ·{' '}
              {formatSnapshotTimestamp(primaryTicket.updatedAt || primaryTicket.createdAt)}
              {pendingHostTask ? txLocal(' · 호스트 대기 작업과 동기화됨', ' · Synced with pending host task') : ''}
              {writeProtected ? txLocal(' · USB 읽기 전용(세션 임시 보관)', ' · USB read-only (session-only)') : ''}
            </p>
            {rebootAlertActive && (
              <p
                className={`text-xs font-semibold ${
                  rebootRequiredStrong ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                }`}
              >
                {txLocal('재부팅 판정 동기화:', 'Reboot Notice:')}{' '}
                {lastPatchResult?.rebootJudgment.title ||
                  txLocal(
                    '커널·네트워크 정책 변경으로 시스템 재부팅 후 재연결해야 정상 적용됩니다.',
                    'Kernel/network policy changes require a system reboot before reconnecting.'
                  )}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
          <button
            id="btn-open-troubleshoot-wizard"
            type="button"
            onClick={() => onOpenWizard(primaryTicket.ticketId)}
            className="px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ListChecks className="w-3.5 h-3.5" />
            {txLocal('단계별 해결 마법사 열기', 'Open Troubleshoot Wizard')}
          </button>

          {onOpenMatrix && (
            <button
              id="btn-banner-open-matrix"
              type="button"
              onClick={onOpenMatrix}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {rebootAlertActive ? txLocal('OS 매트릭스 · 재부팅', 'OS Matrix · Reboot') : txLocal('OS 매트릭스 보기', 'Open OS Matrix')}
            </button>
          )}

          {resolvedTickets.length > 0 && (
            <button
              id="btn-clear-resolved-troubleshoot"
              type="button"
              onClick={() => void onClearResolved()}
              className="px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-500/35 rounded-lg whitespace-nowrap cursor-pointer"
            >
              {txLocal(`해결 완료 정리 (${resolvedTickets.length})`, `Clear Resolved (${resolvedTickets.length})`)}
            </button>
          )}

          {confirmDeleteId === primaryTicket.ticketId ? (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteId(null);
                  void onDeleteTicket(primaryTicket.ticketId);
                }}
                className="px-2.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
              >
                {txLocal('삭제 확정', 'Confirm Delete')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                {txLocal('취소', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(primaryTicket.ticketId)}
              className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {txLocal('티켓 삭제', 'Delete Ticket')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (waitingOtherPcTickets.length > 0) {
    const topWaiting = waitingOtherPcTickets[0];
    const targetDisplay = topWaiting.targetHostName || topWaiting.targetIp || txLocal('반대편 PC', 'Other PC');
    const awaitingSideLabel =
      topWaiting.status === 'host_fixed'
        ? txLocal(`클라이언트 PC(${topWaiting.originHostName})`, `Client PC (${topWaiting.originHostName})`)
        : txLocal(`메인 PC(${targetDisplay})`, `Main PC (${targetDisplay})`);

    return (
      <div
        id="troubleshoot-handoff-banner"
        role="status"
        className="px-5 py-3.5 rounded-xl border border-indigo-500/35 bg-indigo-500/8 dark:bg-indigo-500/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
      >
        <div className="flex items-start gap-3 min-w-0">
          <Usb className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {txLocal(
                `USB에 다른 PC 전달용 오류 티켓 ${waitingOtherPcTickets.length}건 저장됨 · 다음 대상: ${awaitingSideLabel}`,
                `${waitingOtherPcTickets.length} USB handoff ticket(s) saved for another PC · Next target: ${awaitingSideLabel}`
              )}
            </div>
            <p className="tabular-data text-xs text-slate-600 dark:text-slate-300">
              {topWaiting.errorCode} · {topWaiting.errorTitle} · \\{topWaiting.targetIp || topWaiting.targetHostName || 'HOST'}\
              {topWaiting.shareName} ·{' '}
              {txLocal(
                `USB를 ${awaitingSideLabel}로 이동하면 마법사가 자동 실행됩니다`,
                `Move the USB drive to ${awaitingSideLabel} to launch the wizard automatically`
              )}
              {rebootAlertActive ? txLocal(' · (현재 PC 재부팅 대기 상태 감지됨)', ' · (Pending reboot detected on this PC)') : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
          <button
            id="btn-open-troubleshoot-wizard"
            type="button"
            onClick={() => onOpenWizard(topWaiting.ticketId)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ListChecks className="w-3.5 h-3.5" />
            {txLocal('해결 마법사 확인', 'View Wizard')}
          </button>
          {resolvedTickets.length > 0 && (
            <button
              id="btn-clear-resolved-troubleshoot"
              type="button"
              onClick={() => void onClearResolved()}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-500/35 rounded-lg whitespace-nowrap cursor-pointer"
            >
              {txLocal(`해결 완료 정리 (${resolvedTickets.length})`, `Clear Resolved (${resolvedTickets.length})`)}
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDeleteTicket(topWaiting.ticketId)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
          >
            {txLocal('티켓 삭제', 'Delete Ticket')}
          </button>
        </div>
      </div>
    );
  }

  const topResolved = resolvedTickets[0];
  return (
    <div
      id="troubleshoot-handoff-banner"
      role="status"
      className="px-5 py-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/8 dark:bg-emerald-500/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            {txLocal(
              `USB 오류 해결 완료 이력 ${resolvedTickets.length}건 보존됨`,
              `${resolvedTickets.length} resolved USB ticket(s) archived`
            )}
          </div>
          <p className="tabular-data text-xs text-slate-600 dark:text-slate-300">
            {topResolved.errorCode} · {topResolved.errorTitle} · {txLocal('완료 PC:', 'Resolved on:')}{' '}
            {topResolved.resolvedByHostName || currentHostname} ·{' '}
            {formatSnapshotTimestamp(topResolved.resolvedAt || topResolved.updatedAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
        <button
          id="btn-open-troubleshoot-wizard"
          type="button"
          onClick={() => onOpenWizard(topResolved.ticketId)}
          className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <ListChecks className="w-3.5 h-3.5" />
          {txLocal('이력 보기', 'View History')}
        </button>
        <button
          id="btn-clear-resolved-troubleshoot"
          type="button"
          onClick={() => void onClearResolved()}
          className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {txLocal(`해결 티켓 정리 (${resolvedTickets.length})`, `Clear Resolved (${resolvedTickets.length})`)}
        </button>
      </div>
    </div>
  );
};

