import React, { useState } from 'react';
import {
  CheckCircle2,
  ListChecks,
  Trash2,
  Usb,
  Wrench,
} from 'lucide-react';
import { TroubleshootMatchResult, TroubleshootTicket } from '@/types/share';
import { formatSnapshotTimestamp } from '@/services/networkEvolution';

interface TroubleshootHandoffBannerProps {
  tickets: TroubleshootTicket[];
  matchResult: TroubleshootMatchResult;
  currentHostname: string;
  writeProtected?: boolean;
  onOpenWizard: (ticketId?: string) => void;
  onDeleteTicket: (ticketId: string) => void | Promise<void>;
  onClearResolved: () => void | Promise<void>;
}

function getTicketStatusText(status: TroubleshootTicket['status']): string {
  switch (status) {
    case 'host_fixed':
      return '메인 PC 조치 완료 (클라이언트 확인 대기)';
    case 'client_fixed':
      return '클라이언트 조치 완료 (호스트 확인 대기)';
    case 'resolved':
      return '양단 해결 완료';
    default:
      return '조치 대기 중';
  }
}

export const TroubleshootHandoffBanner: React.FC<TroubleshootHandoffBannerProps> = ({
  tickets,
  matchResult,
  currentHostname,
  writeProtected,
  onOpenWizard,
  onDeleteTicket,
  onClearResolved,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!tickets || tickets.length === 0) return null;

  const { currentPcActionTickets, waitingOtherPcTickets, resolvedTickets, primaryTicket, matchedSideMap } =
    matchResult;

  if (primaryTicket) {
    const side = matchedSideMap[primaryTicket.ticketId] || 'none';
    const isHandoffBackToClient = primaryTicket.status === 'host_fixed';
    const isFromOtherPc =
      (primaryTicket.originHostName || '').trim().toLowerCase() !== currentHostname.trim().toLowerCase();
    const targetDisplay = primaryTicket.targetHostName || primaryTicket.targetIp || '대상 PC';

    const headline = isHandoffBackToClient
      ? `메인 PC(${targetDisplay}) 조치 완료 · 이 PC(${currentHostname})에서 재연결 마법사를 계속하세요`
      : isFromOtherPc
        ? `USB로 전달된 오류 티켓 감지 (${primaryTicket.errorCode}) · 이 PC(${currentHostname})에서 ${
            side === 'host' ? '메인 호스트 조치' : '단계별 해결'
          }를 진행하세요`
        : `이 PC(${currentHostname})에서 해결이 필요한 연결·공유 오류 (${primaryTicket.errorCode})`;

    const pendingCount =
      (side === 'host' || side === 'both'
        ? primaryTicket.hostSteps.filter((s) => s.status === 'pending' || s.status === 'failed').length
        : 0) +
      (side === 'client' || side === 'both'
        ? primaryTicket.clientSteps.filter((s) => s.status === 'pending' || s.status === 'failed').length
        : 0);

    return (
      <div
        id="troubleshoot-handoff-banner"
        role="status"
        className="px-5 py-4 rounded-xl border border-amber-500/45 bg-amber-500/8 dark:bg-amber-500/12 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3 min-w-0">
          <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {headline}
              {currentPcActionTickets.length > 1 ? ` (총 ${currentPcActionTickets.length}건)` : ''}
            </div>
            <p className="tabular-data text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {primaryTicket.errorTitle} · 발생: {primaryTicket.originHostName}
              {primaryTicket.originIp ? ` (${primaryTicket.originIp})` : ''} → 대상:{' '}
              <span className="font-semibold">
                \\{primaryTicket.targetIp || primaryTicket.targetHostName || 'HOST'}\{primaryTicket.shareName}
              </span>{' '}
              · 남은 단계 {pendingCount}개 · 상태: {getTicketStatusText(primaryTicket.status)} ·{' '}
              {formatSnapshotTimestamp(primaryTicket.updatedAt || primaryTicket.createdAt)}
              {writeProtected ? ' · USB 읽기 전용(세션 임시 보관)' : ''}
            </p>
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
            단계별 해결 마법사 열기
          </button>

          {resolvedTickets.length > 0 && (
            <button
              id="btn-clear-resolved-troubleshoot"
              type="button"
              onClick={() => void onClearResolved()}
              className="px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-500/35 rounded-lg whitespace-nowrap cursor-pointer"
            >
              해결 완료 정리 ({resolvedTickets.length})
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
                삭제 확정
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(primaryTicket.ticketId)}
              className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              티켓 삭제
            </button>
          )}
        </div>
      </div>
    );
  }

  if (waitingOtherPcTickets.length > 0) {
    const topWaiting = waitingOtherPcTickets[0];
    const targetDisplay = topWaiting.targetHostName || topWaiting.targetIp || '반대편 PC';
    const awaitingSideLabel =
      topWaiting.status === 'host_fixed'
        ? `클라이언트 PC(${topWaiting.originHostName})`
        : `메인 PC(${targetDisplay})`;

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
              USB에 다른 PC 전달용 오류 티켓 {waitingOtherPcTickets.length}건 저장됨 · 다음 대상: {awaitingSideLabel}
            </div>
            <p className="tabular-data text-xs text-slate-600 dark:text-slate-300">
              {topWaiting.errorCode} · {topWaiting.errorTitle} · \\{topWaiting.targetIp || topWaiting.targetHostName || 'HOST'}\
              {topWaiting.shareName} · USB를 {awaitingSideLabel}로 이동하면 마법사가 자동 실행됩니다
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
            해결 마법사 확인
          </button>
          {resolvedTickets.length > 0 && (
            <button
              id="btn-clear-resolved-troubleshoot"
              type="button"
              onClick={() => void onClearResolved()}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-500/35 rounded-lg whitespace-nowrap cursor-pointer"
            >
              해결 완료 정리 ({resolvedTickets.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDeleteTicket(topWaiting.ticketId)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
          >
            티켓 삭제
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
            USB 오류 해결 완료 이력 {resolvedTickets.length}건 보존됨
          </div>
          <p className="tabular-data text-xs text-slate-600 dark:text-slate-300">
            {topResolved.errorCode} · {topResolved.errorTitle} · 완료 PC:{' '}
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
          이력 보기
        </button>
        <button
          id="btn-clear-resolved-troubleshoot"
          type="button"
          onClick={() => void onClearResolved()}
          className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          해결 티켓 정리 ({resolvedTickets.length})
        </button>
      </div>
    </div>
  );
};
