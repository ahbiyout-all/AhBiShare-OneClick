import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  LocationPreflightItemResult,
  LocationPreflightItemStatus,
  LocationPreflightReport,
  LocationProfileFile,
} from '@/types/share';
import { useI18n } from '@/i18n/I18nContext';

interface LocationPreflightModalProps {
  isOpen: boolean;
  isChecking: boolean;
  isExecuting: boolean;
  profile: LocationProfileFile | null;
  report: LocationPreflightReport | null;
  onClose: () => void;
  onRerun: () => void;
  onEditProfile: (profileId: string) => void;
  onConfirmExecute: () => void;
}

const STATUS_BADGE: Record<
  LocationPreflightItemStatus,
  { koLabel: string; enLabel: string; textClass: string; bgClass: string; borderClass: string }
> = {
  pass: {
    koLabel: '통과',
    enLabel: 'Pass',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/25',
  },
  warning: {
    koLabel: '주의',
    enLabel: 'Warning',
    textClass: 'text-amber-700 dark:text-amber-300',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/25',
  },
  fail: {
    koLabel: '오류',
    enLabel: 'Fail',
    textClass: 'text-red-700 dark:text-red-300',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/25',
  },
};

function StatusIcon({ status, className = 'w-4 h-4' }: { status: LocationPreflightItemStatus; className?: string }) {
  if (status === 'pass') {
    return <CheckCircle2 className={`${className} text-emerald-600 dark:text-emerald-400 shrink-0`} />;
  }
  if (status === 'warning') {
    return <AlertTriangle className={`${className} text-amber-600 dark:text-amber-400 shrink-0`} />;
  }
  return <XCircle className={`${className} text-red-600 dark:text-red-400 shrink-0`} />;
}

function ItemKindIcon({ kind }: { kind: LocationPreflightItemResult['kind'] }) {
  if (kind === 'share') return <FolderOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />;
  if (kind === 'mount') return <HardDrive className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />;
  return <ShieldCheck className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />;
}

export const LocationPreflightModal: React.FC<LocationPreflightModalProps> = ({
  isOpen,
  isChecking,
  isExecuting,
  profile,
  report,
  onClose,
  onRerun,
  onEditProfile,
  onConfirmExecute,
}) => {
  const { tx } = useI18n();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isChecking && !isExecuting) {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isChecking, isExecuting]);

  if (!isOpen || !profile) return null;

  const targetActionItems = report ? report.items.filter((it) => it.kind !== 'environment') : [];
  const envItem = report?.items.find((it) => it.kind === 'environment');
  const shareCount = profile.savedShares.length;
  const mountCount = profile.clientTargets.length;
  const hasApplicableTargets = shareCount > 0 || mountCount > 0;
  const eligibleTargetCount = targetActionItems.filter((it) => it.status !== 'fail').length;
  const envBlocksAllShares = Boolean(envItem?.status === 'fail' && mountCount === 0);
  const canProceed =
    Boolean(report) && !isChecking && !isExecuting && hasApplicableTargets && eligibleTargetCount > 0 && !envBlocksAllShares;

  const overallBadge = report ? STATUS_BADGE[report.overallStatus] : null;

  return (
    <div
      id="location-preflight-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preflight-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isChecking && !isExecuting) {
          onClose();
        }
      }}
    >
      <div
        id="location-preflight-modal"
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2
              id="preflight-modal-title"
              className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">
                {tx('일괄 적용 사전 검증 (Pre-flight Check)', 'Batch Apply Pre-flight Check')} — {profile.locationName}
              </span>
            </h2>
            <p className="mt-0.5 tabular-data text-xs text-slate-500 dark:text-slate-400">
              {tx(`공유폴더 ${shareCount}건 · 네트워크 드라이브 ${mountCount}건`, `${shareCount} shares · ${mountCount} network drives`)}
              {report ? ` · ${tx('검사 시각', 'Checked')} ${report.checkedAt}` : ` · ${tx('호스트 환경 검사 준비', 'Preparing host environment check')}`}
            </p>
          </div>

          <button
            type="button"
            disabled={isChecking || isExecuting}
            onClick={onClose}
            aria-label={tx('사전 검증 창 닫기', 'Close pre-flight check modal')}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isChecking ? (
            <div
              id="preflight-loading-state"
              className="py-12 px-4 flex flex-col items-center justify-center text-center gap-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/70 dark:bg-slate-900/40"
            >
              <Loader2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {tx('현재 호스트 환경에서 사용장소 설정을 사전 검증하고 있습니다...', 'Running pre-flight checks on your current host environment...')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tx(
                    '관리자 권한 · 로컬 폴더 존재 및 NTFS 접근 권한 · 드라이브 문자 충돌 · 대상 호스트 TCP 445 포트 · 계정 자격증명 검사 중',
                    'Checking admin privileges · local folder & NTFS permissions · drive letter conflicts · target TCP 445 port · account credentials'
                  )}
                </p>
              </div>
            </div>
          ) : !report ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
              {tx('사전 검증 결과를 불러오지 못했습니다. 다시 검사를 실행해 주세요.', 'Failed to load pre-flight results. Please re-run the check.')}
            </div>
          ) : (
            <>
              {/* Overall Summary Bar */}
              <div
                id="preflight-summary-banner"
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${overallBadge?.bgClass} ${overallBadge?.borderClass}`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <StatusIcon status={report.overallStatus} className="w-5 h-5 mt-0.5" />
                  <div className="space-y-0.5 min-w-0">
                    <p className={`text-sm font-bold ${overallBadge?.textClass}`}>
                      {report.overallStatus === 'pass'
                        ? tx('사전 검증 통과 — 모든 설정을 안전하게 일괄 적용할 수 있습니다', 'Pre-flight Passed — Ready to safely apply all settings')
                        : report.overallStatus === 'warning'
                          ? tx('주의 항목 확인 — 자동 생성/재연결 또는 네트워크 응답 경고를 확인하세요', 'Warnings Detected — Review auto-create/reconnect or network warnings')
                          : tx('차단 오류 감지 — 일부 항목의 경로·권한·자격증명 문제를 먼저 확인하세요', 'Blocking Errors Detected — Resolve path, permission, or credential issues first')}
                    </p>
                    <p className="tabular-data text-xs text-slate-600 dark:text-slate-300">
                      {tx(
                        `전체 ${report.totalItems}건 중 통과 ${report.passCount}건 · 주의 ${report.warningCount}건 · 오류 ${report.failCount}건`,
                        `Total ${report.totalItems}: ${report.passCount} passed · ${report.warningCount} warnings · ${report.failCount} failed`
                      )}
                    </p>
                  </div>
                </div>

                <button
                  id="btn-preflight-rerun"
                  type="button"
                  onClick={onRerun}
                  disabled={isExecuting}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 self-end sm:self-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {tx('다시 검사', 'Re-run Check')}
                </button>
              </div>

              {/* Detailed Inspection Items */}
              <div id="preflight-items-list" className="space-y-3">
                {report.items.map((item) => {
                  const badge = STATUS_BADGE[item.status];
                  return (
                    <section
                      key={`${item.kind}-${item.index}`}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemKindIcon kind={item.kind} />
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {item.label}
                            </h3>
                            <p className="tabular-data text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {item.targetDesc}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${badge.textClass} ${badge.bgClass} ${badge.borderClass}`}
                        >
                          <StatusIcon status={item.status} className="w-3.5 h-3.5" />
                          <span>{tx(badge.koLabel, badge.enLabel)}</span>
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {item.checks.map((sub) => {
                          const subBadge = STATUS_BADGE[sub.status];
                          return (
                            <div
                              key={sub.key}
                              className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 shrink-0 sm:w-44">
                                <StatusIcon status={sub.status} className="w-3.5 h-3.5" />
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {sub.label}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                                  {sub.detail}
                                </p>
                                <span
                                  className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${subBadge.textClass}`}
                                >
                                  {tx(subBadge.koLabel, subBadge.enLabel)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {report?.hasBlockingErrors
              ? tx(
                  '오류 항목은 [프로필 내용 수정]에서 경로·비밀번호·드라이브 문자를 바로 보완할 수 있습니다.',
                  'Fix failed paths, passwords, or drive letters directly via [Edit Profile].'
                )
              : tx(
                  '사전 검증은 시스템 설정을 변경하지 않고 현재 상태만 읽기 전용으로 확인합니다.',
                  'Pre-flight check inspects the current state read-only without modifying system settings.'
                )}
          </p>

          <div className="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
            <button
              id="btn-preflight-cancel"
              type="button"
              onClick={onClose}
              disabled={isChecking || isExecuting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {tx('취소', 'Cancel')}
            </button>
            <button
              id="btn-preflight-edit-profile"
              type="button"
              onClick={() => onEditProfile(profile.profileId)}
              disabled={isChecking || isExecuting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Pencil className="w-3.5 h-3.5" />
              {tx('프로필 내용 수정', 'Edit Profile')}
            </button>
            <button
              id="btn-preflight-confirm-apply"
              type="button"
              onClick={onConfirmExecute}
              disabled={!canProceed}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                report?.hasBlockingErrors || report?.overallStatus === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {!hasApplicableTargets
                ? tx('적용할 항목 없음', 'No Items to Apply')
                : report?.hasBlockingErrors && eligibleTargetCount === 0
                  ? tx('오류 해결 후 적용 가능', 'Resolve Errors First')
                  : report?.hasBlockingErrors
                    ? tx('경고·오류 확인 후 일괄 적용 실행', 'Acknowledge & Batch Apply')
                    : report?.overallStatus === 'warning'
                      ? tx('주의 확인 · 일괄 적용 실행', 'Confirm Warnings & Apply')
                      : tx('검증 완료 · 일괄 적용 실행', 'Verified · Batch Apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
