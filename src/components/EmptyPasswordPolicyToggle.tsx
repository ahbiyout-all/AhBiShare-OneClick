import React from 'react';
import { ShieldAlert, ShieldCheck, KeyRound, Download, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';

interface EmptyPasswordPolicyToggleProps {
  isBlocked: boolean;
  isKnown: boolean;
  guestAccountEnabled?: boolean;
  guestNetworkLogonDenied?: boolean;
  isBusy: boolean;
  isDisabled?: boolean;
  authMode: 'guest' | 'account';
  onToggle: (nextBlock: boolean) => Promise<void>;
  onDownloadBat: () => void;
}

export const EmptyPasswordPolicyToggle: React.FC<EmptyPasswordPolicyToggleProps> = ({
  isBlocked,
  isKnown,
  guestAccountEnabled,
  guestNetworkLogonDenied,
  isBusy,
  isDisabled = false,
  authMode,
  onToggle,
  onDownloadBat,
}) => {
  const { tx } = useI18n();
  const switchDisabled = isBusy || isDisabled;
  const needsGuestUnlockHint = authMode === 'guest' && isBlocked;

  return (
    <div
      id="host-empty-password-policy-toggle"
      className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            {isBlocked ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span>
              {tx(
                '빈 암호 계정 차단 (Block Empty-Password Accounts)',
                'Block Empty-Password Accounts (LimitBlankPasswordUse)'
              )}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {tx(
              'Guest 계정(SID *-501) 및 빈 암호 로컬 사용자 계정의 네트워크(SMB) 로그온 허용 여부를 전환합니다. 차단을 해제하면 ',
              'Toggles network (SMB) logon permission for Guest (SID *-501) and empty-password local accounts. Disabling the block runs '
            )}
            <code className="tabular-data text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              upgradedHostGuestUnblock.bat
            </code>{' '}
            {tx(
              '로직(LimitBlankPasswordUse=0 · Guest 활성화 · SeDenyNetworkLogonRight 정리 · TCP 445 개방)이 비블로킹으로 즉시 실행됩니다.',
              'logic (LimitBlankPasswordUse=0, enable Guest, clear SeDenyNetworkLogonRight, open TCP 445) immediately without blocking.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
          <button
            id="btn-toggle-block-empty-password"
            type="button"
            role="switch"
            aria-checked={isBlocked}
            aria-label={tx(
              '빈 암호 계정 차단 (Block Empty-Password Accounts)',
              'Block Empty-Password Accounts'
            )}
            disabled={switchDisabled}
            onClick={() => void onToggle(!isBlocked)}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50 inline-flex items-center gap-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span
              aria-hidden="true"
              className={`relative inline-flex h-5 w-8 shrink-0 items-center rounded-md transition-colors ${
                isBlocked
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : 'bg-amber-600 dark:bg-amber-500'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-sm bg-white shadow-sm transition-transform ${
                  isBlocked ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap inline-flex items-center gap-1.5">
              {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
              {isBusy
                ? tx('정책 적용 중...', 'Applying policy...')
                : isBlocked
                  ? tx('차단됨 (ON · 보안)', 'Blocked (ON · Secure)')
                  : tx('허용됨 (OFF · Guest 개방)', 'Allowed (OFF · Guest Open)')}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-data">
          <span
            className={`font-semibold ${
              isBlocked
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            LimitBlankPasswordUse={isBlocked ? tx('1 (차단)', '1 (Blocked)') : tx('0 (허용)', '0 (Allowed)')}
            {!isKnown ? tx(' (기본값)', ' (Default)') : ''}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Guest(SID *-501):{' '}
            {guestAccountEnabled === true
              ? tx('활성', 'Active')
              : guestAccountEnabled === false
                ? tx('비활성', 'Disabled')
                : tx('확인 대기', 'Pending check')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            SeDenyNetworkLogonRight:{' '}
            {guestNetworkLogonDenied === false
              ? tx('해제됨', 'Cleared')
              : guestNetworkLogonDenied === true
                ? tx('차단됨', 'Blocked')
                : tx('확인 대기', 'Pending check')}
          </span>
        </div>

        <button
          id="btn-host-download-unblock-bat"
          type="button"
          onClick={onDownloadBat}
          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          {tx('.bat 복구 파일 저장', 'Save .bat Recovery Script')}
        </button>
      </div>

      {needsGuestUnlockHint && (
        <div className="px-3.5 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>
            {tx(
              '현재 빈 암호 계정이 차단되어 있어 타 PC가 무비밀번호(Guest) 연결 시 오류 86이 발생할 수 있습니다. 위 스위치를 끄거나 ',
              'Empty-password accounts are currently blocked, which may trigger Error 86 on passwordless Guest connections. Turn off the switch above or run '
            )}
            <strong>{tx('원클릭 공유폴더 개설', 'One-Click Share Setup')}</strong>
            {tx('을 실행하면 자동으로 개방됩니다.', ' to unlock it automatically.')}
          </span>
        </div>
      )}
    </div>
  );
};
