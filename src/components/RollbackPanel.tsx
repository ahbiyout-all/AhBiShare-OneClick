import React, { useState } from 'react';
import { ShieldCheck, RotateCcw } from 'lucide-react';

interface RollbackPanelProps {
  onRollback: (scope: 'host' | 'client') => Promise<{ success: boolean; message: string }>;
}

export const RollbackPanel: React.FC<RollbackPanelProps> = ({ onRollback }) => {
  const [busyScope, setBusyScope] = useState<'host' | 'client' | null>(null);
  const [feedback, setFeedback] = useState<{ scope: 'host' | 'client'; success: boolean; message: string } | null>(null);

  const handleRun = async (scope: 'host' | 'client') => {
    setBusyScope(scope);
    const res = await onRollback(scope);
    setFeedback({ scope, ...res });
    setBusyScope(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          공유 정책 보안 원복 (Rollback)
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          파일 공유 작업이 끝난 후 열려 있던 공유폴더·방화벽 포트·무인증 게스트 정책을 Windows 기본 보안 상태로 되돌립니다.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            feedback.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
              <h3 className="font-display text-base font-semibold">메인 PC (호스트) 보안 원복</h3>
            </div>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 pt-2">
              <li>• C$, ADMIN$, IPC$를 제외한 모든 사용자 공유폴더 즉시 해제</li>
              <li>• 방화벽 TCP 445 인바운드 예외 규칙 삭제</li>
              <li>• LSA 익명 허용 차단(restrictanonymous=1) 및 SMB 서명 복구</li>
            </ul>
          </div>
          <button
            type="button"
            disabled={busyScope !== null}
            onClick={() => void handleRun('host')}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {busyScope === 'host' ? '원복 중...' : '호스트 공유 종료 및 원복'}
          </button>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <ShieldCheck className="w-5 h-5 text-indigo-500" />
              <h3 className="font-display text-base font-semibold">클라이언트 PC (접속자) 보안 원복</h3>
            </div>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 pt-2">
              <li>• 연결된 모든 네트워크 드라이브 세션 일괄 해제</li>
              <li>• 비인증 게스트 접속(AllowInsecureGuestAuth=0) 차단 복원</li>
              <li>• Windows 11 SMB 클라이언트 서명 검증 정책 활성화</li>
            </ul>
          </div>
          <button
            type="button"
            disabled={busyScope !== null}
            onClick={() => void handleRun('client')}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {busyScope === 'client' ? '원복 중...' : '클라이언트 연결 해제 및 원복'}
          </button>
        </div>
      </div>
    </div>
  );
};
