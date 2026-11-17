import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { PipelineStep } from '@/types/share';

interface PipelineTrackerProps {
  title: string;
  steps: PipelineStep[];
  isRunning: boolean;
}

export const PipelineTracker: React.FC<PipelineTrackerProps> = ({ title, steps, isRunning }) => {
  if (steps.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6">
        <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          원클릭 버튼을 실행하면 방화벽, SMB 서비스, 보안 정책, 권한 설정 단계가 순서대로 진행됩니다.
        </p>
      </div>
    );
  }

  const completedCount = steps.filter((s) => s.status === 'success').length;
  const hasError = steps.some((s) => s.status === 'error');

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <span className="tabular-data text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0">
          {completedCount} / {steps.length} 단계 · {isRunning ? '실행 중' : hasError ? '오류 중단' : completedCount === steps.length ? '완료' : '대기'}
        </span>
      </div>

      <ol className="divide-y divide-slate-200 dark:divide-slate-800">
        {steps.map((step, index) => (
          <li key={step.id} className="py-3.5 first:pt-4 last:pb-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {step.status === 'running' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                  {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />}
                  {step.status === 'error' && <XCircle className="w-4 h-4 text-red-600 dark:text-red-500" />}
                  {step.status === 'idle' && <Circle className="w-4 h-4 text-slate-300 dark:text-slate-700" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    <span className="tabular-data text-slate-400 mr-1.5">{String(index + 1).padStart(2, '0')}.</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{step.detail}</p>
                  {step.output && (
                    <p className="mt-1.5 tabular-data text-xs text-emerald-700 dark:text-emerald-400 break-all">
                      {step.output}
                    </p>
                  )}
                  {step.error && (
                    <p className="mt-1.5 tabular-data text-xs text-red-600 dark:text-red-400 break-all">
                      {step.error}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span className="tabular-data text-xs text-slate-500 dark:text-slate-400">
                  {step.durationMs !== undefined ? `${step.durationMs}ms` : '—'}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
