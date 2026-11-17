import React from 'react';
import { ReleaseInfo } from '../services/updateChecker';
import { Download, ExternalLink, X, ShieldAlert } from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  currentVersion: string;
  release: ReleaseInfo | null;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, currentVersion, release, onClose }) => {
  if (!isOpen || !release) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-indigo-600 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-indigo-200 animate-pulse" />
            <h3 className="text-base font-bold">새로운 업데이트 안내 (GitHub Releases)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-indigo-700 text-indigo-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">설치된 현재 버전</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">v{currentVersion}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold block">최신 릴리즈 버전</span>
              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{release.tagName}</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">패치 노트 &amp; 변경 사항</h4>
            <div className="max-h-40 overflow-y-auto p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {release.body}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <a
              href="https://github.com/ahbiyout-all/AhBiShare-OneClick"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              GitHub 저장소 방문
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                나중에 하기
              </button>
              <a
                href={release.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                지금 다운로드 및 업데이트
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
