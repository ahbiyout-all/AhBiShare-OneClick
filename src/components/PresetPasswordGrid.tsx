import React from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

export interface PresetAccount {
  label: string;
  username: string;
  password: string;
}

export const EASY_ACCOUNT_PRESETS: PresetAccount[] = [
  { label: '기본 (AhBiShare / 123456)', username: 'AhBiShare', password: '123456' },
  { label: '관리자 (Admin / 789012)', username: 'Admin', password: '789012' },
  { label: '매니저 (Manager / 202620)', username: 'Manager', password: '202620' },
  { label: '직원 (Staff / 555555)', username: 'Staff', password: '555555' },
  { label: '게스트 (Guest / 111111)', username: 'Guest', password: '111111' },
];

interface PresetPasswordGridProps {
  onSelectPreset: (username: string, password: string) => void;
  currentUsername?: string;
  currentPassword?: string;
}

export const PresetPasswordGrid: React.FC<PresetPasswordGridProps> = ({
  onSelectPreset,
  currentUsername,
  currentPassword,
}) => {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          쉬운 계정 및 숫자 암호 프리셋 (클릭 시 즉시 적용)
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          5개 표준 프리셋
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EASY_ACCOUNT_PRESETS.map((preset) => {
          const isSelected =
            currentUsername === preset.username && currentPassword === preset.password;
          return (
            <button
              key={preset.username}
              type="button"
              onClick={() => onSelectPreset(preset.username, preset.password)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/50'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              <KeyRound className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
