import React, { useState } from 'react';
import { ShieldCheck, RotateCcw, Lock, RefreshCw } from 'lucide-react';
import { LocalNetworkInfo, OsNetworkPolicyStatus, PolicyPatchMode } from '@/types/share';
import { SecurityRollbackReport } from '@/components/SecurityRollbackReport';

interface RollbackPanelProps {
  netInfo: LocalNetworkInfo;
  policyStatus: OsNetworkPolicyStatus | null;
  activeShareCount: number;
  activeMountCount: number;
  isInspecting: boolean;
  isRefreshing?: boolean;
  onRollback: (scope: 'host' | 'client') => Promise<{ success: boolean; message: string }>;
  onFullSecurityRollback: () => Promise<{ success: boolean; message: string }>;
  onInspectPolicy: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onRestoreDefaults: (modes: PolicyPatchMode[]) => Promise<void>;
  onNotify?: (message: string) => void;
}

export const RollbackPanel: React.FC<RollbackPanelProps> = ({
  netInfo,
  policyStatus,
  activeShareCount,
  activeMountCount,
  isInspecting,
  isRefreshing = false,
  onRollback,
  onFullSecurityRollback,
  onInspectPolicy,
  onRefresh,
  onRestoreDefaults,
  onNotify,
}) => {
  const [busyScope, setBusyScope] = useState<'host' | 'client' | 'full' | null>(null);
  const [feedback, setFeedback] = useState<{
    scope: 'host' | 'client' | 'full';
    success: boolean;
    message: string;
  } | null>(null);

  const handleRun = async (scope: 'host' | 'client') => {
    setBusyScope(scope);
    try {
      const res = await onRollback(scope);
      setFeedback({ scope, ...res });
    } finally {
      setBusyScope(null);
    }
  };

  const handleRunFull = async () => {
    setBusyScope('full');
    try {
      const res = await onFullSecurityRollback();
      setFeedback({ scope: 'full', ...res });
    } finally {
      setBusyScope(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            공유 정책 보안 원복 (Rollback)
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            파일 공유 작업이 끝난 후 열려 있던 공유폴더·방화벽 포트·무인증 게스트 정책을 Windows 기본 보안 상태로 되돌리고 10개 핵심 항목을 검증합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              id="btn-refresh-rollback"
              type="button"
              disabled={busyScope !== null || isInspecting || isRefreshing}
              onClick={() => void onRefresh()}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
              {isRefreshing ? '새로고침 중...' : '새로고침'}
            </button>
          )}
          <button
            id="btn-full-security-rollback"
            type="button"
            disabled={busyScope !== null || isInspecting || isRefreshing}
            onClick={() => void handleRunFull()}
            className="px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5" />
            {busyScope === 'full' ? '전체 보안 원복 중...' : '전체(호스트+클라이언트+표준보안) 원복'}
          </button>
        </div>
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
              <li>• 방화벽 TCP 445 임시 규칙(AhBiShare-SMB-445) 삭제</li>
              <li>• Guest 계정(*-501) OFF, LSA 빈 암호·익명 차단 및 SMB 서버 서명 복구</li>
            </ul>
          </div>
          <button
            id="btn-rollback-host"
            type="button"
            disabled={busyScope !== null || isInspecting || isRefreshing}
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
            id="btn-rollback-client"
            type="button"
            disabled={busyScope !== null || isInspecting || isRefreshing}
            onClick={() => void handleRun('client')}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {busyScope === 'client' ? '원복 중...' : '클라이언트 연결 해제 및 원복'}
          </button>
        </div>
      </div>

      {/* Live 10-Point Security Rollback Verification Report */}
      <SecurityRollbackReport
        netInfo={netInfo}
        policyStatus={policyStatus}
        activeShareCount={activeShareCount}
        activeMountCount={activeMountCount}
        isBusy={busyScope !== null || isRefreshing}
        isInspecting={isInspecting}
        onInspectPolicy={onInspectPolicy}
        onRestoreDefaults={onRestoreDefaults}
        onFullSecurityRollback={handleRunFull}
        onNotify={onNotify}
      />
    </div>
  );
};

