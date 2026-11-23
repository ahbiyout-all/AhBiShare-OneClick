import React from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { AuthMode, ShareAuthProbeResult, ShareAuthProbeVerdict, SmartAuthDetectionResult } from '@/types/share';

export interface ShareAuthProbeBarProps {
  idPrefix?: string;
  probeResult: ShareAuthProbeResult | null;
  smartResult?: SmartAuthDetectionResult | null;
  isProbing: boolean;
  autoSwitchEnabled: boolean;
  autoSwitchedTo: AuthMode | null;
  currentAuthMode: AuthMode;
  targetHost: string;
  shareName: string;
  disabled?: boolean;
  onToggleAutoSwitch: (next: boolean) => void;
  onManualProbe: () => void;
  onSwitchToAccount: () => void;
  onSwitchToGuest: () => void;
  onUndoAutoSwitch: () => void;
  onOpenMatrix?: () => void;
  onCopyHostGuestCmd?: () => void;
  hostCmdCopied?: boolean;
}

function getVerdictTone(verdict: ShareAuthProbeVerdict): {
  boxClass: string;
  titleClass: string;
  detailClass: string;
  icon: React.ReactNode;
} {
  switch (verdict) {
    case 'guest_allowed':
      return {
        boxClass: 'border-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-500/10',
        titleClass: 'text-emerald-800 dark:text-emerald-300',
        detailClass: 'text-emerald-700 dark:text-emerald-300/90',
        icon: <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      };
    case 'account_required':
      return {
        boxClass: 'border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10',
        titleClass: 'text-indigo-900 dark:text-indigo-200',
        detailClass: 'text-indigo-800 dark:text-indigo-300',
        icon: <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />,
      };
    case 'client_guest_blocked':
    case 'host_guest_denied':
    case 'existing_session_conflict':
    case 'smb_protocol_mismatch':
      return {
        boxClass: 'border-amber-500/35 bg-amber-500/5 dark:bg-amber-500/10',
        titleClass: 'text-amber-900 dark:text-amber-200',
        detailClass: 'text-amber-800 dark:text-amber-300',
        icon: <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
      };
    case 'share_not_found':
    case 'unreachable':
      return {
        boxClass: 'border-red-500/35 bg-red-500/5 dark:bg-red-500/10',
        titleClass: 'text-red-900 dark:text-red-200',
        detailClass: 'text-red-800 dark:text-red-300',
        icon: <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />,
      };
    default:
      return {
        boxClass: 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60',
        titleClass: 'text-slate-800 dark:text-slate-200',
        detailClass: 'text-slate-600 dark:text-slate-400',
        icon: <AlertCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />,
      };
  }
}

export const ShareAuthProbeBar: React.FC<ShareAuthProbeBarProps> = ({
  idPrefix = 'client',
  probeResult,
  smartResult = null,
  isProbing,
  autoSwitchEnabled,
  autoSwitchedTo,
  currentAuthMode,
  targetHost,
  shareName,
  disabled = false,
  onToggleAutoSwitch,
  onManualProbe,
  onSwitchToAccount,
  onSwitchToGuest,
  onUndoAutoSwitch,
  onOpenMatrix,
  onCopyHostGuestCmd,
  hostCmdCopied = false,
}) => {
  const cleanHost = targetHost.trim();
  const cleanShare = shareName.trim();
  const canProbe = Boolean(cleanHost && cleanShare) && !disabled;

  const tone = probeResult ? getVerdictTone(probeResult.verdict) : null;
  const isHintRecommendation = Boolean(
    smartResult &&
      smartResult.confidence === 'hint' &&
      smartResult.action === 'recommend' &&
      smartResult.recommendedAuthMode
  );
  const canAlignSession = Boolean(
    probeResult?.verdict === 'existing_session_conflict' &&
      probeResult.existingSessionMode &&
      probeResult.existingSessionMode !== currentAuthMode
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            인증 방식 사전 판별
          </span>
          <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            수동 입력 시 게스트 허용 / 보안 계정 여부를 자동 확인합니다
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <label
            htmlFor={`${idPrefix}-auto-switch-toggle`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap"
          >
            <input
              id={`${idPrefix}-auto-switch-toggle`}
              type="checkbox"
              checked={autoSwitchEnabled}
              onChange={(e) => onToggleAutoSwitch(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            탐지 시 자동 전환
          </label>

          <button
            id={`${idPrefix}-btn-probe-auth`}
            type="button"
            disabled={!canProbe || isProbing}
            onClick={onManualProbe}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-indigo-500' : ''}`} />
            {isProbing ? '확인 중...' : '인증 방식 확인'}
          </button>
        </div>
      </div>

      {isProbing && (
        <div
          id={`${idPrefix}-probe-loading`}
          role="status"
          aria-live="polite"
          className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />
          <span className="tabular-nums truncate">
            \\{cleanHost || '-'}\{cleanShare || '-'} 공유폴더의 무비밀번호·보안 계정 여부를 확인하고 있습니다...
          </span>
        </div>
      )}

      {!isProbing && probeResult && tone && (
        <div
          id={`${idPrefix}-probe-banner`}
          role="status"
          aria-live="polite"
          className={`px-4 py-3 rounded-lg border space-y-1.5 ${tone.boxClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold min-w-0">
              {tone.icon}
              <span className={tone.titleClass}>{probeResult.summary}</span>
              {probeResult.win32Code !== null && (
                <>
                  <span className="text-slate-400 dark:text-slate-500 font-normal" aria-hidden="true">
                    ·
                  </span>
                  <span className={`tabular-nums font-semibold ${tone.detailClass}`}>
                    {probeResult.win32Code === 0 ? '응답 0' : `Win32 오류 ${probeResult.win32Code}`}
                  </span>
                </>
              )}
              {autoSwitchedTo && (
                <>
                  <span className="text-slate-400 dark:text-slate-500 font-normal" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {autoSwitchedTo === 'account' ? '보안 계정으로 자동 전환됨' : '무비밀번호로 자동 전환됨'}
                  </span>
                </>
              )}
            </div>
            <span className="tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              {probeResult.targetUnc} · {probeResult.checkedAt}
            </span>
          </div>

          <p className={`text-xs leading-relaxed ${tone.detailClass}`}>{probeResult.detail}</p>
          {isHintRecommendation && smartResult?.reason && (
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              스마트 인증 추천: {smartResult.reason}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {autoSwitchedTo === 'account' && (
              <button
                id={`${idPrefix}-btn-undo-autoswitch`}
                type="button"
                onClick={onUndoAutoSwitch}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                무비밀번호로 유지
              </button>
            )}

            {autoSwitchedTo === 'guest' && (
              <button
                id={`${idPrefix}-btn-undo-autoswitch`}
                type="button"
                onClick={onUndoAutoSwitch}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                보안 계정으로 유지
              </button>
            )}

            {probeResult.verdict === 'account_required' && currentAuthMode === 'guest' && (
              <button
                id={`${idPrefix}-btn-probe-to-account`}
                type="button"
                onClick={onSwitchToAccount}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <KeyRound className="w-3.5 h-3.5" />
                보안 계정 모드로 전환
              </button>
            )}

            {probeResult.verdict === 'guest_allowed' && currentAuthMode === 'account' && (
              <button
                id={`${idPrefix}-btn-probe-to-guest`}
                type="button"
                onClick={onSwitchToGuest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-400/60 dark:border-emerald-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Check className="w-3.5 h-3.5" />
                무비밀번호 모드로 전환
              </button>
            )}

            {((probeResult.verdict === 'client_guest_blocked' || probeResult.verdict === 'host_guest_denied') ||
              (canAlignSession && probeResult.existingSessionMode === 'account') ||
              (isHintRecommendation && smartResult?.recommendedAuthMode === 'account')) &&
              currentAuthMode === 'guest' && (
                <button
                  id={`${idPrefix}-btn-probe-to-account`}
                  type="button"
                  onClick={onSwitchToAccount}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <Shield className="w-3.5 h-3.5" />
                  보안 계정 모드로 전환
                </button>
              )}

            {((canAlignSession && probeResult.existingSessionMode === 'guest') ||
              (isHintRecommendation && smartResult?.recommendedAuthMode === 'guest')) &&
              currentAuthMode === 'account' && (
                <button
                  id={`${idPrefix}-btn-probe-to-guest`}
                  type="button"
                  onClick={onSwitchToGuest}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-400/60 dark:border-emerald-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Check className="w-3.5 h-3.5" />
                  무비밀번호 모드로 전환
                </button>
              )}

            {(probeResult.verdict === 'client_guest_blocked' || probeResult.verdict === 'smb_protocol_mismatch') &&
              onOpenMatrix && (
                <button
                  id={`${idPrefix}-btn-probe-open-matrix`}
                  type="button"
                  onClick={onOpenMatrix}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-400/60 dark:border-amber-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  호환성 매트릭스 열기
                </button>
              )}

            {probeResult.verdict === 'host_guest_denied' && onCopyHostGuestCmd && (
              <button
                id={`${idPrefix}-btn-probe-copy-host-cmd`}
                type="button"
                onClick={onCopyHostGuestCmd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {hostCmdCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {hostCmdCopied ? '복구 명령 복사됨!' : '호스트 복구 명령 복사'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
