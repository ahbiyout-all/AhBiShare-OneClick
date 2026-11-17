import React from 'react';
import { AppSection, RoleMode } from '@/types/share';

interface TopBarProps {
  activeSection: AppSection;
  roleMode: RoleMode;
  onNavigate: (section: AppSection, role?: RoleMode) => void;
  onOpenDiagnostics: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  roleMode,
  onNavigate,
  onOpenDiagnostics,
}) => {
  const isHostActive = activeSection === 'workspace' && roleMode === 'host';
  const isClientActive = activeSection === 'workspace' && roleMode === 'client';

  const navItems: Array<{ id: string; label: string; active: boolean; onClick: () => void }> = [
    { id: 'nav-host', label: '공유 개설', active: isHostActive, onClick: () => onNavigate('workspace', 'host') },
    { id: 'nav-client', label: '클라이언트 연결', active: isClientActive, onClick: () => onNavigate('workspace', 'client') },
    { id: 'nav-matrix', label: 'OS 호환성 매트릭스', active: activeSection === 'matrix', onClick: () => onNavigate('matrix') },
    { id: 'nav-legacy', label: '구형 OS 공유', active: activeSection === 'legacy', onClick: () => onNavigate('legacy') },
    { id: 'nav-logs', label: '실행 이력', active: activeSection === 'logs', onClick: () => onNavigate('logs') },
    { id: 'nav-rollback', label: '보안 원복', active: activeSection === 'rollback', onClick: () => onNavigate('rollback') },
  ];

  return (
    <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A]">
      <div className="max-w-6xl mx-auto px-6 min-h-16 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2 md:py-0">
        <button
          type="button"
          onClick={() => onNavigate('workspace', 'host')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
        >
          AhBiShare OneClick
        </button>

        <nav className="order-3 md:order-2 w-full md:w-auto flex items-center gap-4 lg:gap-6 text-sm font-medium overflow-x-auto pb-1 md:pb-0">
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

        <div className="order-2 md:order-3 shrink-0">
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            네트워크 진단
          </button>
        </div>
      </div>
    </header>
  );
};
