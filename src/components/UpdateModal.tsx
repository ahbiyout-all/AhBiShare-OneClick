import React, { useEffect } from 'react';
import { Download, ExternalLink, X, RefreshCw, Sparkles } from 'lucide-react';
import { openExternalReleaseUrl, ReleaseAsset, ReleaseInfo } from '../services/updateChecker';

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

function isRecommendedAsset(asset: ReleaseAsset, osBuild?: number): boolean {
  const lower = asset.name.toLowerCase();
  const isLegacyWin7Or8 = typeof osBuild === 'number' && osBuild > 0 && osBuild < 10240;
  if (isLegacyWin7Or8) {
    return lower.includes('win7');
  }
  return !lower.includes('win7') && !lower.includes('lite') && !lower.includes('setup');
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
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !release) return null;

  const exeAssets = (release.assets || []).filter((a) => a.name.toLowerCase().endsWith('.exe'));
  const publishedStr = formatPublishedDate(release.publishedAt);
  const recommendedAsset = exeAssets.find((a) => isRecommendedAsset(a, osBuild));

  return (
    <div
      id="github-update-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            onClick={onClose}
            aria-label="업데이트 확인창 닫기"
            className="p-1.5 rounded-lg hover:bg-indigo-700 text-indigo-100 hover:text-white transition-colors cursor-pointer shrink-0"
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

          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              릴리즈 노트 &amp; 변경 사항
            </h4>
            <div className="max-h-40 overflow-y-auto p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {release.body}
            </div>
          </div>

          {exeAssets.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                실행 파일 바로 내려받기 ({exeAssets.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {exeAssets.map((asset) => {
                  const rec = isRecommendedAsset(asset, osBuild);
                  return (
                    <button
                      key={asset.name}
                      type="button"
                      onClick={() => void openExternalReleaseUrl(asset.browserDownloadUrl)}
                      className={`p-2.5 text-left rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        rec
                          ? 'border-indigo-500/60 bg-indigo-500/5 dark:bg-indigo-500/10 hover:bg-indigo-500/15'
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
                      <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
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
                  disabled={isRechecking}
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
                  onClick={() => {
                    onSkipVersion(release.tagName);
                    onClose();
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-2 cursor-pointer"
                >
                  이 버전 건너뛰기
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-update-later"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                나중에 하기
              </button>
              <button
                id="btn-update-download"
                type="button"
                onClick={() =>
                  void openExternalReleaseUrl(recommendedAsset?.browserDownloadUrl || release.htmlUrl)
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {recommendedAsset ? '권장 버전 바로 다운로드' : 'GitHub에서 다운로드'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
