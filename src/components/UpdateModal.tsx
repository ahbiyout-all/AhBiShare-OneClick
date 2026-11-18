import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  X,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  cancelPortableUpdate,
  getUpdateRuntimeInfo,
  installPortableUpdate,
  isPortableExeAsset,
  openExternalReleaseUrl,
  PortableUpdateProgress,
  PortableUpdateRuntimeInfo,
  ReleaseAsset,
  ReleaseInfo,
  selectRecommendedPortableAsset,
  subscribeUpdateProgress,
} from '../services/updateChecker';

interface UpdateModalProps {
  isOpen: boolean;
  currentVersion: string;
  release: ReleaseInfo | null;
  osBuild?: number;
  onSkipVersion?: (tagName: string) => void;
  onRecheck?: () => void;
  isRechecking?: boolean;
  onClose: () => void;
}

function formatPublishedDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatBytesMb(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAssetFriendlyLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('win7')) return 'Win 7/8/8.1 전용 포터블';
  if (lower.includes('lite')) return '경량 포터블 (Lite)';
  if (lower.includes('setup')) return '설치형 인스톨러 (Setup)';
  return '표준 포터블 (Win 10/11)';
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  currentVersion,
  release,
  osBuild,
  onSkipVersion,
  onRecheck,
  isRechecking = false,
  onClose,
}) => {
  const [runtimeInfo, setRuntimeInfo] = useState<PortableUpdateRuntimeInfo | null>(null);
  const [selectedAssetName, setSelectedAssetName] = useState<string>('');
  const hasUserSelectedAssetRef = useRef(false);
  const [progress, setProgress] = useState<PortableUpdateProgress | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string>('');

  const exeAssets = useMemo(
    () => (release?.assets || []).filter((a) => a.name.toLowerCase().endsWith('.exe')),
    [release]
  );

  const recommendedPortableAsset = useMemo(
    () => selectRecommendedPortableAsset(exeAssets, runtimeInfo?.edition, osBuild),
    [exeAssets, runtimeInfo?.edition, osBuild]
  );

  const fallbackRecommendedAsset = useMemo(
    () =>
      recommendedPortableAsset ||
      exeAssets.find((a) => {
        const l = a.name.toLowerCase();
        const isLegacyWin = typeof osBuild === 'number' && osBuild > 0 && osBuild < 10240;
        return isLegacyWin ? l.includes('win7') : !l.includes('win7') && !l.includes('lite') && !l.includes('setup');
      }),
    [recommendedPortableAsset, exeAssets, osBuild]
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    hasUserSelectedAssetRef.current = false;
    setUpdateError('');
    setProgress(null);
    setIsUpdating(false);

    void getUpdateRuntimeInfo().then((info) => {
      if (active) setRuntimeInfo(info);
    });

    const unsub = subscribeUpdateProgress((p) => {
      if (!active) return;
      setProgress(p);
      if (p.phase === 'error') {
        setIsUpdating(false);
        setUpdateError(p.message || '포터블 업데이트 중 오류가 발생했습니다.');
      } else if (p.phase === 'cancelled') {
        setIsUpdating(false);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [isOpen, release?.tagName]);

  useEffect(() => {
    if (hasUserSelectedAssetRef.current) return;
    if (recommendedPortableAsset) {
      setSelectedAssetName(recommendedPortableAsset.name);
    } else if (exeAssets.length > 0) {
      setSelectedAssetName(exeAssets[0].name);
    } else {
      setSelectedAssetName('');
    }
  }, [recommendedPortableAsset, exeAssets]);

  const isReplacingNow = isUpdating && progress?.phase === 'replacing';

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isReplacingNow && !isUpdating) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isReplacingNow, isUpdating, onClose]);

  if (!isOpen || !release) return null;

  const publishedStr = formatPublishedDate(release.publishedAt);
  const activeTargetAsset: ReleaseAsset | undefined =
    exeAssets.find((a) => a.name === selectedAssetName) || fallbackRecommendedAsset;
  const canAutoReplaceTarget =
    Boolean(runtimeInfo?.canSelfReplace) &&
    Boolean(activeTargetAsset) &&
    Boolean(activeTargetAsset && isPortableExeAsset(activeTargetAsset));

  const handleStartAutoReplace = async () => {
    if (!activeTargetAsset || !canAutoReplaceTarget || isUpdating) return;
    setUpdateError('');
    setIsUpdating(true);
    setProgress({
      phase: 'downloading',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: activeTargetAsset.size || 0,
      message: `${activeTargetAsset.name} 다운로드 준비 중...`,
    });

    try {
      const res = await installPortableUpdate(activeTargetAsset);
      if (!res.success) {
        setIsUpdating(false);
        if (!res.cancelled) {
          setUpdateError(res.error || '포터블 자동 업데이트에 실패했습니다.');
        } else {
          setProgress(null);
        }
      }
    } catch (err) {
      setIsUpdating(false);
      setUpdateError(err instanceof Error ? err.message : '포터블 자동 업데이트 호출 오류');
    }
  };

  const handleCancelDownload = async () => {
    if (!isUpdating || isReplacingNow) return;
    await cancelPortableUpdate();
    setIsUpdating(false);
    setProgress(null);
  };

  return (
    <div
      id="github-update-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUpdating && !isReplacingNow) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
        className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-indigo-600 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="w-5 h-5 text-indigo-100 shrink-0" />
            <div className="min-w-0">
              <h3 id="update-modal-title" className="font-display text-base font-bold truncate">
                새로운 업데이트 확인 (GitHub Releases)
              </h3>
              {release.name && release.name !== release.tagName && (
                <p className="text-xs text-indigo-100 truncate">{release.name}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={isUpdating || isReplacingNow}
            onClick={onClose}
            aria-label="업데이트 확인창 닫기"
            className="p-1.5 rounded-lg hover:bg-indigo-700 text-indigo-100 hover:text-white transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">현재 실행 버전</span>
              <span className="tabular-data text-sm font-semibold text-slate-700 dark:text-slate-300">
                v{currentVersion}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold block">
                GitHub 최신 버전{publishedStr ? ` · ${publishedStr}` : ''}
              </span>
              <span className="tabular-data text-base font-bold text-indigo-600 dark:text-indigo-400">
                {release.tagName}
              </span>
            </div>
          </div>

          {runtimeInfo && (
            <div
              className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                runtimeInfo.canSelfReplace
                  ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300'
              }`}
            >
              {runtimeInfo.canSelfReplace ? (
                <div className="flex items-start gap-2.5">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                      포터블 원클릭 자동 교체 지원
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-90 break-all">
                      현재 포터블(<span className="font-semibold">{runtimeInfo.currentExeName}</span>)을 안전하게
                      종료 및 제거한 뒤{' '}
                      <span className="font-semibold">
                        {activeTargetAsset && isPortableExeAsset(activeTargetAsset)
                          ? activeTargetAsset.name
                          : '새 포터블 EXE'}
                      </span>
                      로 교체해 자동 실행합니다. 기존 공유 설정 및 사용장소 프로필(.json)은 그대로 유지됩니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{runtimeInfo.reason || '포터블 단일 실행 파일 모드에서만 자동 교체를 지원합니다.'}</span>
                </div>
              )}
            </div>
          )}

          {progress && (
            <div
              id="portable-update-progress"
              className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-500/10 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300 min-w-0">
                  {progress.phase === 'replacing' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  )}
                  <span className="truncate">{progress.message}</span>
                </div>
                <span className="tabular-data font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                  {progress.percent}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-150"
                  style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }}
                />
              </div>
              {(progress.totalBytes > 0 || (isUpdating && !isReplacingNow)) && (
                <div className="flex items-center justify-between text-[11px] tabular-data text-slate-500 dark:text-slate-400">
                  <span>
                    {progress.totalBytes > 0
                      ? `${formatBytesMb(progress.downloadedBytes)} / ${formatBytesMb(progress.totalBytes)}`
                      : progress.downloadedBytes > 0
                        ? `${formatBytesMb(progress.downloadedBytes)} 받음`
                        : '연결 중...'}
                  </span>
                  {isUpdating && !isReplacingNow && (
                    <button
                      id="btn-cancel-portable-update"
                      type="button"
                      onClick={() => void handleCancelDownload()}
                      className="text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      다운로드 취소
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {updateError && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{updateError}</span>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              릴리즈 노트 &amp; 변경 사항
            </h4>
            <div className="max-h-36 overflow-y-auto p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {release.body}
            </div>
          </div>

          {exeAssets.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {runtimeInfo?.canSelfReplace
                  ? `교체할 버전 선택 / 내려받기 (${exeAssets.length})`
                  : `실행 파일 바로 내려받기 (${exeAssets.length})`}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {exeAssets.map((asset) => {
                  const rec = recommendedPortableAsset?.name === asset.name || fallbackRecommendedAsset?.name === asset.name;
                  const isSelected = activeTargetAsset?.name === asset.name;
                  const portableAsset = isPortableExeAsset(asset);
                  return (
                    <button
                      key={asset.name}
                      type="button"
                      disabled={isUpdating}
                      onClick={() => {
                        if (runtimeInfo?.canSelfReplace && portableAsset) {
                          hasUserSelectedAssetRef.current = true;
                          setSelectedAssetName(asset.name);
                        } else {
                          void openExternalReleaseUrl(asset.browserDownloadUrl);
                        }
                      }}
                      className={`p-2.5 text-left rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:opacity-60 ${
                        isSelected && runtimeInfo?.canSelfReplace && portableAsset
                          ? 'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 ring-1 ring-indigo-500/40'
                          : rec
                            ? 'border-indigo-500/50 bg-indigo-500/5 dark:bg-indigo-500/10 hover:bg-indigo-500/15'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-indigo-400'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {getAssetFriendlyLabel(asset.name)}
                          {rec ? ' (권장)' : ''}
                        </div>
                        <div className="tabular-data text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {asset.name}
                          {asset.size > 0 ? ` · ${formatBytesMb(asset.size)}` : ''}
                        </div>
                      </div>
                      {runtimeInfo?.canSelfReplace && portableAsset ? (
                        <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void openExternalReleaseUrl('https://github.com/ahbiyout-all/AhBiShare-OneClick')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                GitHub 저장소
              </button>
              {onRecheck && (
                <button
                  type="button"
                  disabled={isRechecking || isUpdating}
                  onClick={onRecheck}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRechecking ? 'animate-spin' : ''}`} />
                  다시 확인
                </button>
              )}
              {onSkipVersion && (
                <button
                  id="btn-skip-update-version"
                  type="button"
                  disabled={isUpdating}
                  onClick={() => {
                    onSkipVersion(release.tagName);
                    onClose();
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-2 cursor-pointer disabled:opacity-50"
                >
                  이 버전 건너뛰기
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-update-later"
                type="button"
                disabled={isUpdating}
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                나중에 하기
              </button>
              <button
                id="btn-update-download"
                type="button"
                onClick={() =>
                  void openExternalReleaseUrl(activeTargetAsset?.browserDownloadUrl || release.htmlUrl)
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  canAutoReplaceTarget
                    ? 'text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                {canAutoReplaceTarget
                  ? '직접 다운로드'
                  : activeTargetAsset
                    ? '권장 버전 바로 다운로드'
                    : 'GitHub에서 다운로드'}
              </button>
              {canAutoReplaceTarget && (
                <button
                  id="btn-auto-replace-portable"
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void handleStartAutoReplace()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4" />
                  )}
                  {isUpdating ? '포터블 교체 진행 중...' : '기존 파일 제거 후 자동 교체'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

