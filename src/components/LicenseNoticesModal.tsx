import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  FolderOpen,
  Scale,
  Search,
  X,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import {
  formatCombinedNoticesText,
  LicenseFamily,
  PROJECT_LICENSE_INFO,
  THIRD_PARTY_NOTICES,
} from '@/data/licenseNotices';

export type LicenseModalTab = 'mit' | 'notices';
type NoticeFilterFamily = 'all' | LicenseFamily;

interface LicenseNoticesModalProps {
  isOpen: boolean;
  initialTab?: LicenseModalTab;
  onClose: () => void;
  onOpenPackagedFolder?: () => Promise<{ success: boolean; message: string }>;
  onNotify?: (msg: string) => void;
}

export const LicenseNoticesModal: React.FC<LicenseNoticesModalProps> = ({
  isOpen,
  initialTab = 'mit',
  onClose,
  onOpenPackagedFolder,
  onNotify,
}) => {
  const { locale, tx } = useI18n();
  const [activeTab, setActiveTab] = useState<LicenseModalTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<NoticeFilterFamily>('all');
  const [expandedId, setExpandedId] = useState<string | null>('electron');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [folderFeedback, setFolderFeedback] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setFolderFeedback(null);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      modalRef.current?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const filteredNotices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return THIRD_PARTY_NOTICES.filter((item) => {
      if (familyFilter !== 'all' && item.license !== familyFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.copyrightHolder.toLowerCase().includes(q) ||
        item.license.toLowerCase().includes(q) ||
        item.categoryKo.toLowerCase().includes(q) ||
        item.categoryEn.toLowerCase().includes(q) ||
        item.summaryKo.toLowerCase().includes(q) ||
        item.summaryEn.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, familyFilter]);

  const handleCopy = async (id: string, text: string, notifyText: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId(null);
      }, 2000);
      onNotify?.(notifyText);
    } catch {
      onNotify?.(tx('클립보드 복사에 실패했습니다.', 'Failed to copy to clipboard.'));
    }
  };

  const handleOpenFolder = async () => {
    if (!onOpenPackagedFolder) return;
    const res = await onOpenPackagedFolder();
    setFolderFeedback(res.message);
    onNotify?.(res.message);
  };

  if (!isOpen) return null;

  const familyOptions: Array<{ id: NoticeFilterFamily; label: string }> = [
    { id: 'all', label: tx('전체', 'All') },
    { id: 'MIT', label: 'MIT' },
    { id: 'ISC', label: 'ISC' },
    { id: 'BSD-3-Clause', label: 'BSD' },
    { id: 'Apache-2.0', label: 'Apache-2.0' },
  ];

  return (
    <div
      id="license-notices-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl text-slate-900 dark:text-slate-100 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h2
                id="license-modal-title"
                className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-white"
              >
                {tx('라이선스 및 오픈소스 고지', 'License & Open-Source Notices')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-data">
              <span>{PROJECT_LICENSE_INFO.productName} v{PROJECT_LICENSE_INFO.version}</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span>SPDX: {PROJECT_LICENSE_INFO.spdx}</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span>{PROJECT_LICENSE_INFO.copyrightLine}</span>
            </p>
          </div>
          <button
            id="btn-close-license-modal"
            type="button"
            onClick={onClose}
            aria-label={tx('라이선스 창 닫기', 'Close license dialog')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Tab Bar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60">
          <div
            role="tablist"
            aria-label={tx('라이선스 문서 분류', 'License document sections')}
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800"
          >
            <button
              id="tab-license-mit"
              role="tab"
              type="button"
              aria-selected={activeTab === 'mit'}
              onClick={() => setActiveTab('mit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                activeTab === 'mit'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tx('MIT 라이선스', 'MIT License')}
            </button>
            <button
              id="tab-license-third-party"
              role="tab"
              type="button"
              aria-selected={activeTab === 'notices'}
              onClick={() => setActiveTab('notices')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-data focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                activeTab === 'notices'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tx(
                `오픈소스 고지 (${THIRD_PARTY_NOTICES.length})`,
                `Open-Source Notices (${THIRD_PARTY_NOTICES.length})`
              )}
            </button>
          </div>

          {onOpenPackagedFolder && (
            <button
              id="btn-open-license-folder"
              type="button"
              onClick={() => void handleOpenFolder()}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{tx('패키징 문서 폴더 열기', 'Open Packaged Docs')}</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {folderFeedback && (
            <div className="px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg">
              {folderFeedback}
            </div>
          )}

          {activeTab === 'mit' ? (
            <div className="space-y-5">
              {/* Structured Summary */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>{tx('적용 라이선스 요약', 'License Declaration Summary')}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-data">
                    MIT · AhBiYout · v{PROJECT_LICENSE_INFO.version}
                  </span>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {tx('허용 사항', 'Permissions')}
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {tx(
                        '상업적 이용, 수정, 재배포 및 사내·개인 환경 자유 사용 허용',
                        'Commercial use, modification, distribution, and private use permitted.'
                      )}
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {tx('준수 조건', 'Conditions')}
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {tx(
                        '복제 및 배포 시 LICENSE와 저작권 고지(AhBiYout) 유지 필수',
                        'License and copyright notice (AhBiYout) must be retained in copies.'
                      )}
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {tx('책임 제한', 'Limitations')}
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                      {tx(
                        '소프트웨어는 있는 그대로 제공되며 보증 및 손해배상 책임 없음',
                        'Provided "AS IS" without warranty or liability for damages.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verbatim MIT License Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {tx('공식 LICENSE 전문 (영문 정본)', 'Official LICENSE Full Text')}
                  </span>
                  <button
                    id="btn-copy-mit-license"
                    type="button"
                    onClick={() =>
                      void handleCopy(
                        'mit-full',
                        PROJECT_LICENSE_INFO.mitFullText,
                        tx('MIT 라이선스 전문을 복사했습니다.', 'Copied MIT License text.')
                      )
                    }
                    className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {copiedId === 'mit-full' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {tx('복사됨', 'Copied')}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{tx('LICENSE 복사', 'Copy LICENSE')}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {PROJECT_LICENSE_INFO.mitFullText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter & Copy All Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-search-notices"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tx(
                      '패키지명, 저작권자, 라이선스 검색...',
                      'Search package, copyright holder, or license...'
                    )}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  id="btn-copy-all-notices"
                  type="button"
                  onClick={() =>
                    void handleCopy(
                      'all-notices',
                      formatCombinedNoticesText(locale),
                      tx(
                        '전체 서드파티 오픈소스 고지를 복사했습니다.',
                        'Copied complete Third-Party Open-Source Notices.'
                      )
                    )
                  }
                  className="px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {copiedId === 'all-notices' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {tx('전체 복사됨', 'All Copied')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{tx('전체 고지 복사', 'Copy All Notices')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* License Family Filter Segmented Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {familyOptions.map((opt) => {
                    const active = familyFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        id={`filter-notice-${opt.id}`}
                        type="button"
                        onClick={() => setFamilyFilter(opt.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-data">
                  {tx(
                    `표시 중: ${filteredNotices.length} / ${THIRD_PARTY_NOTICES.length}개`,
                    `Showing ${filteredNotices.length} of ${THIRD_PARTY_NOTICES.length}`
                  )}
                </span>
              </div>

              {/* Notices List */}
              {filteredNotices.length === 0 ? (
                <div className="py-10 px-4 text-center border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {tx(
                      '검색 조건과 일치하는 오픈소스 고지 항목이 없습니다.',
                      'No open-source notice entries match your current filter.'
                    )}
                  </p>
                  <button
                    id="btn-reset-notice-filters"
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFamilyFilter('all');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 cursor-pointer"
                  >
                    {tx('필터 초기화', 'Reset Filters')}
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredNotices.map((item) => {
                    const isExpanded = expandedId === item.id;
                    return (
                      <div key={item.id} className="p-4 space-y-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {item.name}
                              </span>
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-data">
                                {item.version}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              <span>{locale === 'en' ? item.categoryEn : item.categoryKo}</span>
                              <span aria-hidden="true" className="mx-1.5">·</span>
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {item.license}
                              </span>
                              <span aria-hidden="true" className="mx-1.5">·</span>
                              <span>{item.copyrightHolder}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              {locale === 'en' ? item.summaryEn : item.summaryKo}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              id={`btn-copy-notice-${item.id}`}
                              type="button"
                              onClick={() =>
                                void handleCopy(
                                  item.id,
                                  `${item.name} (${item.version}) — ${item.license}\nCopyright: ${item.copyrightHolder}\n\n${item.licenseText}`,
                                  tx(
                                    `${item.name} 라이선스 고지를 복사했습니다.`,
                                    `Copied ${item.name} license notice.`
                                  )
                                )
                              }
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedId === item.id ? tx('복사됨', 'Copied') : tx('복사', 'Copy')}
                              </span>
                            </button>
                            <button
                              id={`btn-toggle-notice-${item.id}`}
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-md inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              <span>
                                {isExpanded ? tx('접기', 'Hide') : tx('전문', 'Text')}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <pre className="p-3.5 text-[11px] font-mono leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto whitespace-pre-wrap">
                            {item.licenseText}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {tx(
              '오프라인 포터블/설치형 환경에서도 패키지 문서와 동일하게 열람할 수 있습니다.',
              'Available offline across portable and installed distributions.'
            )}
          </span>
          <button
            id="btn-license-modal-done"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {tx('닫기', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
