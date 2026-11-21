import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Upload,
  Download,
  Trash2,
  Play,
  Check,
  Search,
  MapPin,
  FolderOpen,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { LocationProfileEditView } from '@/components/LocationProfileEditView';
import {
  ActiveShare,
  ClientTargetConfig,
  HostConfig,
  LocalNetworkInfo,
  LocationProfileFile,
  LocationProfileSummary,
  MountedDrive,
} from '@/types/share';

interface LocationManagerModalProps {
  isOpen: boolean;
  initialTab?: 'save' | 'manage';
  netInfo: LocalNetworkInfo;
  profiles: LocationProfileSummary[];
  storageDirectory: string;
  activeProfile: LocationProfileFile | null;
  hostDraft: HostConfig;
  activeShares: ActiveShare[];
  clientDraft: ClientTargetConfig;
  mountedDrives: MountedDrive[];
  isBatchApplying: boolean;
  initialEditProfileId?: string | null;
  onClose: () => void;
  onSelectFolder?: (currentPath: string) => Promise<string | null>;
  onSaveProfile: (options: {
    overwriteProfileId?: string;
    locationName: string;
    description: string;
    includeHost: boolean;
    includeClient: boolean;
    includeNetworkHint: boolean;
  }) => Promise<boolean>;
  onLoadProfileForEdit: (profileId: string) => Promise<LocationProfileFile | null>;
  onUpdateProfile: (edited: LocationProfileFile, applyToWorkspace: boolean) => Promise<boolean>;
  onSelectProfile: (profileId: string) => Promise<void>;
  onBatchApplyProfile: (profileId: string) => Promise<void>;
  onExportProfile: (profileId: string) => Promise<void>;
  onImportJsonFile: () => Promise<void>;
  onDeleteProfile: (profileId: string, locationName: string) => Promise<void>;
}

function formatUpdatedDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const LocationManagerModal: React.FC<LocationManagerModalProps> = ({
  isOpen,
  initialTab = 'manage',
  netInfo,
  profiles,
  storageDirectory,
  activeProfile,
  hostDraft,
  activeShares,
  clientDraft,
  mountedDrives,
  isBatchApplying,
  initialEditProfileId,
  onClose,
  onSelectFolder,
  onSaveProfile,
  onLoadProfileForEdit,
  onUpdateProfile,
  onSelectProfile,
  onBatchApplyProfile,
  onExportProfile,
  onImportJsonFile,
  onDeleteProfile,
}) => {
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [includeHost, setIncludeHost] = useState(true);
  const [includeClient, setIncludeClient] = useState(true);
  const [includeNetworkHint, setIncludeNetworkHint] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState<LocationProfileFile | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const loadProfileForEditRef = useRef(onLoadProfileForEdit);
  loadProfileForEditRef.current = onLoadProfileForEdit;

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setEditingProfile(null);
      setLoadingEditId(null);
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setSaveError(null);
    setEditingProfile(null);
    if (activeProfile && (initialTab === 'save' || initialTab === 'manage')) {
      setLocationName(activeProfile.locationName);
      setDescription(activeProfile.description || '');
    } else {
      setLocationName('');
      setDescription('');
    }
  }, [isOpen, initialTab, activeProfile]);

  useEffect(() => {
    if (!isOpen || !initialEditProfileId) return;
    let cancelled = false;
    setLoadingEditId(initialEditProfileId);
    void loadProfileForEditRef.current(initialEditProfileId).then((loaded) => {
      if (cancelled) return;
      setLoadingEditId(null);
      if (loaded) {
        setEditingProfile(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialEditProfileId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving && !isBatchApplying && !loadingEditId) {
        if (editingProfile) {
          setEditingProfile(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSaving, isBatchApplying, loadingEditId, editingProfile, onClose]);

  if (!isOpen) return null;

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.locationName.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.networkHint?.subnetPrefix || '').toLowerCase().includes(q) ||
      p.fileName.toLowerCase().includes(q)
    );
  });

  const handleSave = async (overwriteExisting: boolean) => {
    const clean = locationName.trim();
    if (!clean) {
      setSaveError('저장할 사용장소 이름(예: 사무실, 집, 고객사 A)을 입력하세요.');
      return;
    }
    if (!includeHost && !includeClient) {
      setSaveError('호스트 공유 설정 또는 클라이언트 연결 설정 중 최소 하나를 포함해야 합니다.');
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      const ok = await onSaveProfile({
        overwriteProfileId: overwriteExisting && activeProfile ? activeProfile.profileId : undefined,
        locationName: clean,
        description: description.trim(),
        includeHost,
        includeClient,
        includeNetworkHint,
      });
      if (ok && !overwriteExisting) {
        setLocationName('');
        setDescription('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const capturedClientCount = new Set([
    ...mountedDrives.map((m) => m.driveLetter.toUpperCase()),
    ...(clientDraft.targetHost.trim() && clientDraft.shareName.trim()
      ? [clientDraft.driveLetter.toUpperCase()]
      : []),
  ]).size;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving && !isBatchApplying) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2
              id="location-modal-title"
              className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              사용장소별 프로필 파일 관리 (.location.json)
            </h2>
            <p className="mt-0.5 tabular-data text-xs text-slate-500 dark:text-slate-400 truncate">
              보관 경로: {storageDirectory} · 저장된 장소 {profiles.length}곳
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!editingProfile && (
              <button
                id="btn-modal-import-json"
                type="button"
                onClick={() => void onImportJsonFile()}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                .json 가져오기
              </button>
            )}
            <button
              type="button"
              disabled={isSaving || isBatchApplying}
              onClick={onClose}
              aria-label="사용장소 관리 창 닫기"
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {editingProfile ? (
          <LocationProfileEditView
            key={`${editingProfile.profileId}-${editingProfile.updatedAt}`}
            profile={editingProfile}
            isCurrentlyActive={activeProfile?.profileId === editingProfile.profileId}
            netInfo={netInfo}
            activeShares={activeShares}
            isSaving={isSaving}
            onSelectFolder={onSelectFolder}
            onCancel={() => setEditingProfile(null)}
            onSave={async (edited, applyToWorkspace) => {
              setIsSaving(true);
              try {
                const ok = await onUpdateProfile(edited, applyToWorkspace);
                if (ok) {
                  setEditingProfile(null);
                }
                return ok;
              } finally {
                setIsSaving(false);
              }
            }}
          />
        ) : loadingEditId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-3">
            <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              사용장소 프로필(.location.json) 내용을 불러오는 중입니다...
            </p>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/70 dark:bg-slate-950/50 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                현재 작업 설정을 사용장소 파일로 저장
              </h3>
              <span className="tabular-data text-xs text-slate-500 dark:text-slate-400">
                현재 네트워크 {netInfo.primaryIp} ({netInfo.subnetPrefix}.x)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="location-name-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  사용장소 이름
                </label>
                <input
                  id="location-name-input"
                  type="text"
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    setSaveError(null);
                  }}
                  placeholder="예: 청운 본사 사무실, 자택, 고객사 A"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="location-desc-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  메모 (선택)
                </label>
                <input
                  id="location-desc-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 디자인실 공유폴더 + NAS Z드라이브"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700 dark:text-slate-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHost}
                  onChange={(e) => setIncludeHost(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  호스트 폼({hostDraft.shareName}) 및 활성 공유 {activeShares.length}건 포함
                </span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeClient}
                  onChange={(e) => setIncludeClient(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>클라이언트 연결 대상 {capturedClientCount}건 포함</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNetworkHint}
                  onChange={(e) => setIncludeNetworkHint(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>참고 네트워크 대역 ({netInfo.subnetPrefix}.x) 기록</span>
              </label>
            </div>

            {saveError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{saveError}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                id="btn-save-new-location"
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                새 장소 파일로 저장
              </button>

              {activeProfile && (
                <button
                  id="btn-update-active-location"
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave(true)}
                  className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  선택된 &lsquo;{activeProfile.locationName}&rsquo; 덮어쓰기 업데이트
                </button>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                저장된 사용장소 파일 목록 ({profiles.length})
              </h3>
              {profiles.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="location-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="저장된 사용장소 검색"
                    placeholder="장소명, 서브넷, 메모 검색..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {profiles.length === 0 ? (
              <div className="py-10 px-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl space-y-2">
                <FolderOpen className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  아직 저장된 사용장소 프로필 파일이 없습니다.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  위 입력란에서 첫 장소 이름을 입력해 저장하거나 기존 `.location.json` 파일을 가져오세요.
                </p>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                검색어와 일치하는 사용장소가 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {filteredProfiles.map((item) => {
                  const isActive = activeProfile?.profileId === item.profileId;
                  return (
                    <div
                      key={item.profileId}
                      className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isActive ? 'bg-indigo-500/5 dark:bg-indigo-500/10' : 'bg-white dark:bg-slate-900/40'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {item.locationName}
                          </span>
                          {isActive && (
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              · 현재 선택됨
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                        )}
                        <p className="tabular-data text-xs text-slate-500 dark:text-slate-400 break-all">
                          {item.networkHint?.subnetPrefix ? `대역 ${item.networkHint.subnetPrefix}.x · ` : ''}
                          공유 {item.shareCount}건 · 드라이브 {item.clientTargetCount}건 · {item.fileName} ·{' '}
                          {formatUpdatedDate(item.updatedAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void onSelectProfile(item.profileId)}
                          disabled={isBatchApplying || Boolean(loadingEditId)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          불러오기
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setLoadingEditId(item.profileId);
                            try {
                              const loaded = await onLoadProfileForEdit(item.profileId);
                              if (loaded) {
                                setEditingProfile(loaded);
                              }
                            } finally {
                              setLoadingEditId(null);
                            }
                          }}
                          disabled={isBatchApplying || Boolean(loadingEditId)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <Pencil className="w-3 h-3" />
                          {loadingEditId === item.profileId ? '열기 중...' : '수정'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onBatchApplyProfile(item.profileId)}
                          disabled={isBatchApplying || Boolean(loadingEditId) || (item.shareCount === 0 && item.clientTargetCount === 0)}
                          title="사전 검증(경로·권한·포트 445) 후 일괄 적용을 실행합니다"
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <Play className="w-3 h-3" />
                          일괄 적용
                        </button>
                        <button
                          type="button"
                          onClick={() => void onExportProfile(item.profileId)}
                          disabled={isBatchApplying || Boolean(loadingEditId)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3 h-3" />
                          내보내기
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteProfile(item.profileId, item.locationName)}
                          disabled={isBatchApplying || Boolean(loadingEditId)}
                          aria-label={`${item.locationName} 사용장소 파일 삭제`}
                          title="사용장소 파일 삭제"
                          className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        )}
      </div>
    </div>
  );
};
