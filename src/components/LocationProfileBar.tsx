import React from 'react';
import { MapPin, Save, FolderCog, Play, CheckCircle2, AlertCircle, Loader2, Upload, X } from 'lucide-react';
import {
  LocationBatchApplyResult,
  LocationProfileFile,
  LocationProfileSummary,
} from '@/types/share';

interface LocationProfileBarProps {
  profiles: LocationProfileSummary[];
  activeProfile: LocationProfileFile | null;
  isBatchApplying: boolean;
  batchProgressText: string | null;
  lastBatchResult: LocationBatchApplyResult | null;
  onSelectProfile: (profileId: string) => void;
  onOpenSaveModal: () => void;
  onOpenManagerModal: () => void;
  onQuickImportJson: () => void;
  onBatchApply: () => void;
  onDismissBatchResult: () => void;
}

function formatIsoShort(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const LocationProfileBar: React.FC<LocationProfileBarProps> = ({
  profiles,
  activeProfile,
  isBatchApplying,
  batchProgressText,
  lastBatchResult,
  onSelectProfile,
  onOpenSaveModal,
  onOpenManagerModal,
  onQuickImportJson,
  onBatchApply,
  onDismissBatchResult,
}) => {
  const activeShareCount = activeProfile?.savedShares.length || 0;
  const activeClientCount = activeProfile?.clientTargets.length || 0;
  const hasApplicableItems = Boolean(activeProfile && (activeShareCount > 0 || activeClientCount > 0));

  return (
    <section
      id="location-profile-bar"
      aria-label="사용장소별 데이터 프로필"
      className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 px-5 py-4 space-y-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <label
              htmlFor="select-location-profile"
              className="text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap"
            >
              사용장소 프로필
            </label>
          </div>

          <select
            id="select-location-profile"
            aria-label="저장된 사용장소 프로필 선택"
            value={activeProfile?.profileId || ''}
            onChange={(e) => onSelectProfile(e.target.value)}
            disabled={isBatchApplying}
            className="w-full sm:w-64 px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">
              {profiles.length > 0 ? `장소 선택 안 함 (저장됨 ${profiles.length}곳)` : '저장된 사용장소 없음'}
            </option>
            {profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.locationName} (공유 {p.shareCount} · 드라이브 {p.clientTargetCount})
              </option>
            ))}
          </select>

          <div className="tabular-data text-xs text-slate-500 dark:text-slate-400 truncate">
            {activeProfile ? (
              <span>
                {activeProfile.networkHint?.subnetPrefix ? `대역 ${activeProfile.networkHint.subnetPrefix}.x · ` : ''}
                공유 {activeShareCount}건 · 드라이브 {activeClientCount}건 · 저장 {formatIsoShort(activeProfile.updatedAt)}
                {activeProfile.description ? ` · ${activeProfile.description}` : ''}
              </span>
            ) : (
              <span>
                사무실·집·현장별로 공유·연결 설정을 개별 .json 파일로 저장하고 선택 시 자동 채웁니다
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="btn-open-save-location"
            type="button"
            onClick={onOpenSaveModal}
            disabled={isBatchApplying}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            현재 장소 저장
          </button>

          <button
            id="btn-quick-import-location"
            type="button"
            onClick={onQuickImportJson}
            disabled={isBatchApplying}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            .json 불러오기
          </button>

          <button
            id="btn-open-location-manager"
            type="button"
            onClick={onOpenManagerModal}
            disabled={isBatchApplying}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <FolderCog className="w-3.5 h-3.5" />
            장소 관리 ({profiles.length})
          </button>

          {activeProfile && (
            <button
              id="btn-batch-apply-location"
              type="button"
              onClick={onBatchApply}
              disabled={isBatchApplying || !hasApplicableItems}
              title={
                hasApplicableItems
                  ? '저장된 공유폴더 개설 및 네트워크 드라이브 연결을 한 번에 실행합니다'
                  : '이 장소에는 실행할 공유폴더 또는 드라이브 연결 항목이 없습니다 (입력 폼은 자동 채워짐)'
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isBatchApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  일괄 적용 중...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  이 장소 일괄 적용
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isBatchApplying && batchProgressText && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="tabular-data">{batchProgressText}</span>
        </div>
      )}

      {lastBatchResult && !isBatchApplying && (
        <div
          id="location-batch-result"
          className={`pt-3 border-t border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs ${
            lastBatchResult.success
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="font-semibold flex items-center gap-1.5">
              {lastBatchResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{lastBatchResult.summary}</span>
            </div>
            {lastBatchResult.details.length > 0 && (
              <div className="tabular-data text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                {lastBatchResult.details.map((d, idx) => (
                  <span key={`${d.kind}-${d.label}-${idx}`} title={d.message}>
                    {d.success ? '성공' : '실패'}: {d.label}
                    {!d.success && d.message ? ` — ${d.message}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onDismissBatchResult}
            aria-label="일괄 적용 결과 닫기"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
};
