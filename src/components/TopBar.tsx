import React from 'react';
import { Archive, Languages } from 'lucide-react';
import { AppSection, RoleMode } from '@/types/share';
import { useI18n } from '@/i18n/I18nContext';

interface TopBarProps {
  activeSection: AppSection;
  roleMode: RoleMode;
  availableUpdateTag?: string | null;
  backupCount?: number;
  onOpenUpdateModal?: () => void;
  onOpenBackupModal?: () => void;
  onNavigate: (section: AppSection, role?: RoleMode) => void;
  onOpenDiagnostics: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  roleMode,
  availableUpdateTag = null,
  backupCount = 0,
  onOpenUpdateModal,
  onOpenBackupModal,
  onNavigate,
  onOpenDiagnostics,
}) => {
  const { locale, setLocale, t, tx } = useI18n();
  const isHostActive = activeSection === 'workspace' && roleMode === 'host';
  const isClientActive = activeSection === 'workspace' && roleMode === 'client';

  const navItems: Array<{ id: string; label: string; active: boolean; onClick: () => void }> = [
    { id: 'nav-host', label: tx('공유 개설', 'Host Share'), active: isHostActive, onClick: () => onNavigate('workspace', 'host') },
    { id: 'nav-client', label: tx('클라이언트 연결', 'Client Mount'), active: isClientActive, onClick: () => onNavigate('workspace', 'client') },
    { id: 'nav-matrix', label: tx('OS 호환성 매트릭스', 'OS Matrix'), active: activeSection === 'matrix', onClick: () => onNavigate('matrix') },
    { id: 'nav-legacy', label: tx('구형 OS 공유', 'Legacy OS'), active: activeSection === 'legacy', onClick: () => onNavigate('legacy') },
    { id: 'nav-logs', label: tx('실행 이력', 'Activity Logs'), active: activeSection === 'logs', onClick: () => onNavigate('logs') },
    { id: 'nav-rollback', label: tx('보안 원복', 'Security Rollback'), active: activeSection === 'rollback', onClick: () => onNavigate('rollback') },
  ];

  return (
    <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A]">
      <div className="max-w-6xl mx-auto px-6 min-h-16 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 md:py-0">
        <button
          type="button"
          onClick={() => onNavigate('workspace', 'host')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
        >
          {t('topbar.brand')}
        </button>

        <nav className="order-3 md:order-2 w-full md:w-auto flex items-center gap-4 lg:gap-5 text-sm font-medium overflow-x-auto pb-1 md:pb-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              id={item.id}
              type="button"
              onClick={item.onClick}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                item.active
                  ? 'border-indigo-600 text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="order-2 md:order-3 shrink-0 flex items-center gap-2">
          {availableUpdateTag && onOpenUpdateModal && (
            <button
              id="btn-topbar-update-available"
              type="button"
              onClick={onOpenUpdateModal}
              className="px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-data"
            >
              {t('topbar.btn.update', { tag: availableUpdateTag })}
            </button>
          )}
          {onOpenBackupModal && (
            <button
              id="btn-topbar-backup-restore"
              type="button"
              onClick={onOpenBackupModal}
              title={t('topbar.btn.backupTitle')}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-data focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Archive className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{t('topbar.btn.backup')}</span>
              {backupCount > 0 && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">({backupCount})</span>
              )}
            </button>
          )}
          <div
            id="lang-switcher"
            role="group"
            aria-label={t('topbar.lang.label')}
            title={t('topbar.lang.label')}
            className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0"
          >
            <Languages className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-1.5 mr-1 shrink-0" />
            <button
              id="btn-lang-ko"
              type="button"
              onClick={() => setLocale('ko')}
              aria-pressed={locale === 'ko'}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                locale === 'ko'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              KO
            </button>
            <button
              id="btn-lang-en"
              type="button"
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                locale === 'en'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {t('topbar.btn.diagnostics')}
          </button>
        </div>
      </div>
    </header>
  );
};
