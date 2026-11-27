import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Save,
  FolderCog,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  X,
  Pencil,
  Radio,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import {
  LocalNetworkInfo,
  LocationBatchApplyResult,
  LocationProfileFile,
  LocationProfileSummary,
  NetworkChangeEvent,
} from '@/types/share';
import { useI18n } from '@/i18n/I18nContext';

interface LocationProfileBarProps {
  profiles: LocationProfileSummary[];
  activeProfile: LocationProfileFile | null;
  isBatchApplying: boolean;
  batchProgressText: string | null;
  lastBatchResult: LocationBatchApplyResult | null;
  currentNetwork?: LocalNetworkInfo;
  networkChange?: NetworkChangeEvent | null;
  autoWatchEnabled?: boolean;
  onToggleAutoWatch?: () => void;
  onSwitchAndPreflightMatchedProfile?: (profileId: string) => void;
  onDismissNetworkChange?: () => void;
  onSelectProfile: (profileId: string) => void;
  onOpenSaveModal: () => void;
  onOpenManagerModal: () => void;
  onEditActiveProfile: () => void;
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
  currentNetwork,
  networkChange = null,
  autoWatchEnabled = true,
  onToggleAutoWatch,
  onSwitchAndPreflightMatchedProfile,
  onDismissNetworkChange,
  onSelectProfile,
  onOpenSaveModal,
  onOpenManagerModal,
  onEditActiveProfile,
  onQuickImportJson,
  onBatchApply,
  onDismissBatchResult,
}) => {
  const { tx } = useI18n();
  const activeShareCount = activeProfile?.savedShares.length || 0;
  const activeClientCount = activeProfile?.clientTargets.length || 0;
  const hasApplicableItems = Boolean(activeProfile && (activeShareCount > 0 || activeClientCount > 0));

  const matchedProfiles = networkChange?.matchedProfiles || [];
  const [selectedMatchedProfileId, setSelectedMatchedProfileId] = useState<string>(
    () => matchedProfiles[0]?.profileId || ''
  );

  useEffect(() => {
    setSelectedMatchedProfileId(matchedProfiles[0]?.profileId || '');
  }, [networkChange]);

  const effectiveMatchedId =
    matchedProfiles.find((p) => p.profileId === selectedMatchedProfileId)?.profileId ||
    matchedProfiles[0]?.profileId ||
    '';
  const effectiveMatchedProfile = matchedProfiles.find((p) => p.profileId === effectiveMatchedId) || null;

  return (
    <section
      id="location-profile-bar"
      aria-label={tx('사용장소별 데이터 프로필', 'Location Data Profiles')}
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
              {tx('사용장소 프로필', 'Location Profile')}
            </label>
          </div>

          <select
            id="select-location-profile"
            aria-label={tx('저장된 사용장소 프로필 선택', 'Select saved location profile')}
            value={activeProfile?.profileId || ''}
            onChange={(e) => onSelectProfile(e.target.value)}
            disabled={isBatchApplying}
            className="w-full sm:w-64 px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">
              {profiles.length > 0
                ? tx(`장소 선택 안 함 (저장됨 ${profiles.length}곳)`, `None selected (${profiles.length} saved)`)
                : tx('저장된 사용장소 없음', 'No saved locations')}
            </option>
            {profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {tx(
                  `${p.locationName} (공유 ${p.shareCount} · 드라이브 ${p.clientTargetCount})`,
                  `${p.locationName} (${p.shareCount} shares · ${p.clientTargetCount} drives)`
                )}
              </option>
            ))}
          </select>

          <div className="tabular-data text-xs text-slate-500 dark:text-slate-400 truncate">
            {activeProfile ? (
              <span>
                {activeProfile.networkHint?.subnetPrefix
                  ? tx(`대역 ${activeProfile.networkHint.subnetPrefix}.x · `, `Subnet ${activeProfile.networkHint.subnetPrefix}.x · `)
                  : ''}
                {tx(
                  `공유 ${activeShareCount}건 · 드라이브 ${activeClientCount}건 · 저장 ${formatIsoShort(activeProfile.updatedAt)}`,
                  `${activeShareCount} share(s) · ${activeClientCount} drive(s) · Saved ${formatIsoShort(activeProfile.updatedAt)}`
                )}
                {activeProfile.description ? ` · ${activeProfile.description}` : ''}
              </span>
            ) : (
              <span>
                {currentNetwork?.subnetPrefix && currentNetwork.subnetPrefix !== '127.0.0'
                  ? tx(
                      `현재 대역 ${currentNetwork.subnetPrefix}.x · 사무실·집·현장별 .json 프로필 자동 매칭`,
                      `Current subnet ${currentNetwork.subnetPrefix}.x · Auto-matches .json site profiles`
                    )
                  : tx(
                      '사무실·집·현장별로 공유·연결 설정을 개별 .json 파일로 저장하고 선택 시 자동 채웁니다',
                      'Save share & drive settings per office, home, or site as .json files and auto-fill on selection'
                    )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onToggleAutoWatch && (
            <button
              id="btn-toggle-network-watch"
              type="button"
              onClick={onToggleAutoWatch}
              aria-pressed={autoWatchEnabled}
              title={tx(
                'LAN/Wi-Fi 네트워크 대역 변경 시 USB 사용장소 프로필을 자동 감지하고 끊긴 드라이브 상태를 점검합니다',
                'Automatically detect USB location profiles and check disconnected drives on LAN/Wi-Fi subnet changes'
              )}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                autoWatchEnabled
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/35'
                  : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {autoWatchEnabled ? tx('대역 자동감지', 'Auto Watch') : tx('감지 일시정지', 'Watch Paused')}
            </button>
          )}

          <button
            id="btn-open-save-location"
            type="button"
            onClick={onOpenSaveModal}
            disabled={isBatchApplying}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {tx('현재 장소 저장', 'Save Location')}
          </button>

          <button
            id="btn-quick-import-location"
            type="button"
            onClick={onQuickImportJson}
            disabled={isBatchApplying}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {tx('.json 불러오기', 'Import .json')}
          </button>

          <button
            id="btn-open-location-manager"
            type="button"
            onClick={onOpenManagerModal}
            disabled={isBatchApplying}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <FolderCog className="w-3.5 h-3.5" />
            {tx(`장소 관리 (${profiles.length})`, `Manage (${profiles.length})`)}
          </button>

          {activeProfile && (
            <>
              <button
                id="btn-edit-active-location"
                type="button"
                onClick={onEditActiveProfile}
                disabled={isBatchApplying}
                title={tx(
                  '선택된 사용장소 프로필 파일의 세부 내용을 직접 수정합니다',
                  'Edit details of the selected location profile file'
                )}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                {tx('내용 수정', 'Edit Details')}
              </button>
              <button
                id="btn-batch-apply-location"
                type="button"
                onClick={onBatchApply}
                disabled={isBatchApplying || !hasApplicableItems}
                title={
                  hasApplicableItems
                    ? tx(
                        '사전 검증(경로·권한·TCP 445·자격증명) 후 공유폴더 개설 및 네트워크 드라이브 연결을 일괄 실행합니다',
                        'Run pre-flight checks (path, ACL, TCP 445, credentials) and batch-apply shares & drives'
                      )
                    : tx(
                        '이 장소에는 실행할 공유폴더 또는 드라이브 연결 항목이 없습니다 (입력 폼은 자동 채워짐)',
                        'No share folders or drives configured to apply in this location (forms remain pre-filled)'
                      )
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isBatchApplying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {tx('일괄 적용 중...', 'Applying batch...')}
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    {tx('이 장소 일괄 적용', 'Apply Location')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {networkChange && !isBatchApplying && (
        <div
          id="network-change-banner"
          role="status"
          className="rounded-lg border border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Wifi className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  {networkChange.kind === 'subnet_changed'
                    ? tx('네트워크 대역 변경 감지', 'Network Subnet Change Detected')
                    : tx('현재 현장 대역과 일치하는 USB 프로필 발견', 'Matching USB Location Profile Detected')}
                </span>
                <span className="tabular-data text-indigo-700 dark:text-indigo-300">
                  {networkChange.kind === 'subnet_changed' && networkChange.fromSubnet
                    ? `${networkChange.fromSubnet}.x → ${networkChange.toSubnet}.x`
                    : `${networkChange.toSubnet}.x`}
                </span>
                <span className="tabular-data font-normal text-slate-500 dark:text-slate-400">
                  · {networkChange.toIp} ({networkChange.adapterName})
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {effectiveMatchedProfile
                  ? tx(
                      `USB 저장 프로필 '${effectiveMatchedProfile.locationName}' (공유 ${effectiveMatchedProfile.shareCount}건 · 드라이브 ${effectiveMatchedProfile.clientTargetCount}건)과 일치합니다. 전환 후 사전 검증으로 연결 가능 여부를 바로 확인하세요.`,
                      `Matches USB profile '${effectiveMatchedProfile.locationName}' (${effectiveMatchedProfile.shareCount} share(s) · ${effectiveMatchedProfile.clientTargetCount} drive(s)). Switch and run pre-flight verification now.`
                    )
                  : tx(
                      `현재 대역(${networkChange.toSubnet}.x)에 등록된 USB 사용장소 프로필이 없습니다. 현장 공유·드라이브 구성을 새 프로필로 저장할 수 있습니다.`,
                      `No USB location profile saved for subnet ${networkChange.toSubnet}.x yet. Save this site's setup as a new profile for future visits.`
                    )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            {matchedProfiles.length > 1 && (
              <select
                id="select-network-matched-profile"
                aria-label={tx('일치하는 현장 프로필 선택', 'Select matched site profile')}
                value={effectiveMatchedId}
                onChange={(e) => setSelectedMatchedProfileId(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {matchedProfiles.map((mp) => (
                  <option key={mp.profileId} value={mp.profileId}>
                    {tx(
                      `${mp.locationName} (${mp.shareCount}/${mp.clientTargetCount})`,
                      `${mp.locationName} (${mp.shareCount}/${mp.clientTargetCount})`
                    )}
                  </option>
                ))}
              </select>
            )}

            {effectiveMatchedProfile && onSwitchAndPreflightMatchedProfile ? (
              <button
                id="btn-network-match-switch"
                type="button"
                onClick={() => onSwitchAndPreflightMatchedProfile(effectiveMatchedProfile.profileId)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {tx('전환 후 사전 검증', 'Switch & Pre-flight Check')}
              </button>
            ) : (
              <button
                id="btn-network-save-site"
                type="button"
                onClick={onOpenSaveModal}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {tx('새 현장 프로필로 저장', 'Save as New Site')}
              </button>
            )}

            {onDismissNetworkChange && (
              <button
                id="btn-dismiss-network-change"
                type="button"
                onClick={onDismissNetworkChange}
                aria-label={tx('네트워크 변경 알림 닫기', 'Dismiss network change notice')}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

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
                    {d.success ? tx('성공', 'OK') : tx('실패', 'Failed')}: {d.label}
                    {!d.success && d.message ? ` — ${d.message}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onDismissBatchResult}
            aria-label={tx('일괄 적용 결과 닫기', 'Dismiss batch apply result')}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
};

