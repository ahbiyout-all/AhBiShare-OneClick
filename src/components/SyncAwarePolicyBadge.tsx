import React from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  OsNetworkPolicyStatus,
  TroubleshootStepStatus,
  TroubleshootTicket,
  TroubleshootWizardStep,
} from '@/types/share';
import {
  formatStepResolvedSourceLabel,
  getPolicyStepMatchedExplanation,
  isPolicyStepSatisfiedOnLocalPc,
} from '@/services/troubleshootPlaybook';

export interface StepPolicyMatchEvaluation {
  isPolicyMatched: boolean;
  autoCompletedByPolicy: boolean;
  autoSkippedByPolicy: boolean;
  effectiveStatus: TroubleshootStepStatus;
  explanation: string;
  sourceLabel: string;
  effectiveSourceLabel: string;
}

export function evaluateStepPolicyMatch(
  step: TroubleshootWizardStep,
  ticket: TroubleshootTicket,
  policyStatus?: OsNetworkPolicyStatus | null,
  pcMatchesSide = true
): StepPolicyMatchEvaluation {
  const persistedSourceLabel =
    step.status === 'completed' ? formatStepResolvedSourceLabel(step.resolvedSource) : '';

  if (!pcMatchesSide || !policyStatus) {
    return {
      isPolicyMatched: false,
      autoCompletedByPolicy: false,
      autoSkippedByPolicy: false,
      effectiveStatus: step.status,
      explanation: '',
      sourceLabel: persistedSourceLabel,
      effectiveSourceLabel: persistedSourceLabel,
    };
  }

  const satisfied = isPolicyStepSatisfiedOnLocalPc(step, ticket, policyStatus) === true;
  if (!satisfied) {
    return {
      isPolicyMatched: false,
      autoCompletedByPolicy: false,
      autoSkippedByPolicy: false,
      effectiveStatus: step.status,
      explanation: '',
      sourceLabel: persistedSourceLabel,
      effectiveSourceLabel: persistedSourceLabel,
    };
  }

  const autoCompletedByPolicy = step.status !== 'completed';
  const autoSkippedByPolicy = step.resolvedSource !== 'wizard';
  const effectiveStatus: TroubleshootStepStatus = 'completed';
  const effectiveSourceLabel =
    persistedSourceLabel || formatStepResolvedSourceLabel('live_inspect');

  const criteriaText = getPolicyStepMatchedExplanation(step, ticket, policyStatus);
  const explanation = persistedSourceLabel
    ? `${criteriaText} (적용 출처: ${persistedSourceLabel})`
    : criteriaText;

  return {
    isPolicyMatched: true,
    autoCompletedByPolicy,
    autoSkippedByPolicy,
    effectiveStatus,
    explanation,
    sourceLabel: persistedSourceLabel,
    effectiveSourceLabel,
  };
}

interface SyncAwarePolicyBadgeProps {
  step: TroubleshootWizardStep;
  ticket: TroubleshootTicket;
  policyStatus?: OsNetworkPolicyStatus | null;
  pcMatchesSide?: boolean;
  mode?: 'badge' | 'explanation';
}

export const SyncAwarePolicyBadge: React.FC<SyncAwarePolicyBadgeProps> = ({
  step,
  ticket,
  policyStatus,
  pcMatchesSide = true,
  mode = 'badge',
}) => {
  const { isPolicyMatched, explanation } = evaluateStepPolicyMatch(
    step,
    ticket,
    policyStatus,
    pcMatchesSide
  );

  if (!isPolicyMatched) return null;

  if (mode === 'explanation') {
    return (
      <p
        id={`policy-matched-note-${step.stepId}`}
        role="status"
        className="text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5 pt-0.5 leading-relaxed"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <span>
          조건 이미 충족됨: {explanation}
        </span>
      </p>
    );
  }

  return (
    <span
      id={`badge-policy-matched-${step.stepId}`}
      data-sync-aware="policy-matched"
      title={explanation}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-500/35 bg-emerald-500/12 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0"
    >
      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span>Policy Matched</span>
    </span>
  );
};
