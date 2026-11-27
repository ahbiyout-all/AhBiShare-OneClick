import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  FolderOpen,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  BackupSnapshotSummary,
  BackupStoreStatus,
  BackupTriggerType,
  CreateBackupResult,
  RestoreBackupResult,
} from '@/types/share';
import { useI18n } from '@/i18n/I18nContext';
import { tx } from '@/i18n/localeState';

interface BackupRestoreModalProps {
  isOpen: boolean;
  status: BackupStoreStatus | null;
  isLoading: boolean;
  currentHostname: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onCreateManualBackup: (reason?: string) => Promise<CreateBackupResult>;
  onRestoreBackup: (backupId: string) => Promise<RestoreBackupResult>;
  onDeleteBackup: (backupId: string) => Promise<boolean>;
  onOpenBackupFolder: () => Promise<void>;
}

type TriggerFilter = 'all' | 'auto' | 'manual';

function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatSnapshotTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function getTriggerLabel(trigger: BackupTriggerType): string {
  switch (trigger) {
    case 'auto_before_delete':
      return tx('삭제 전 자동', 'Auto Before Delete');
    case 'auto_before_modify':
      return tx('수정 전 자동', 'Auto Before Modify');
    case 'auto_before_reset':
      return tx('초기화 전 자동', 'Auto Before Reset');
    case 'auto_before_restore':
      return tx('복원 전 안전', 'Safety Before Restore');
    case 'manual':
    default:
      return tx('수동 백업', 'Manual Backup');
  }
}

function getTriggerTextClass(trigger: BackupTriggerType): string {
  switch (trigger) {
    case 'auto_before_delete':
    case 'auto_before_reset':
      return 'text-amber-700 dark:text-amber-300';
    case 'auto_before_modify':
      return 'text-indigo-700 dark:text-indigo-300';
    case 'auto_before_restore':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'manual':
    default:
      return 'text-slate-700 dark:text-slate-200';
  }
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  status,
  isLoading,
  currentHostname,
  onClose,
  onRefresh,
  onCreateManualBackup,
  onRestoreBackup,
  onDeleteBackup,
  onOpenBackupFolder,
}) => {
  const { tx: txLocal } = useI18n();
  const [manualReason, setManualReason] = useState('');
  const [filterMode, setFilterMode] = useState<TriggerFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyAction, setBusyAction] = useState<'create' | 'restore' | 'delete' | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isBusy = busyAction !== null;

  useEffect(() => {
    if (!isOpen) {
      setConfirmRestoreId(null);
      setConfirmDeleteId(null);
      setFeedback(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy]);

  const snapshots: BackupSnapshotSummary[] = useMemo(() => status?.snapshots || [], [status]);
  const maxSnapshots = status?.maxSnapshots || 20;

  const totalSizeBytes = useMemo(
    () => snapshots.reduce((sum, s) => sum + (Number(s.sizeBytes) || 0), 0),
    [snapshots]
  );

  const filteredSnapshots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshots.filter((snap) => {
      if (filterMode === 'manual' && snap.trigger !== 'manual') return false;
      if (filterMode === 'auto' && snap.trigger === 'manual') return false;
      if (!q) return true;
      const haystack = `${snap.reason} ${snap.fileName} ${snap.createdByHostName} ${getTriggerLabel(
        snap.trigger
      )}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [snapshots, filterMode, searchQuery]);

  if (!isOpen) return null;

  const isWriteProtected = Boolean(status?.writeProtected || status?.writable === false);

  const handleCreate = async () => {
    if (isBusy || isWriteProtected) return;
    setBusyAction('create');
    setFeedback(null);
    setConfirmRestoreId(null);
    setConfirmDeleteId(null);
    try {
      const res = await onCreateManualBackup(manualReason.trim() || undefined);
      if (res.success && res.snapshot) {
        setManualReason('');
        setFeedback({
          type: 'success',
          text: txLocal(
            `수동 백업을 생성했습니다: ${res.snapshot.fileName}`,
            `Manual backup created: ${res.snapshot.fileName}`
          ),
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.error || txLocal('백업 스냅샷을 생성하지 못했습니다.', 'Failed to create backup snapshot.'),
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmRestore = async (backupId: string) => {
    if (isBusy || isWriteProtected) return;
    setBusyAction('restore');
    setFeedback(null);
    try {
      const res = await onRestoreBackup(backupId);
      setConfirmRestoreId(null);
      if (res.success) {
        const safetyText = res.safetyBackup
          ? txLocal(' (복원 직전 안전 백업도 자동 저장됨)', ' (Pre-restore safety backup also saved)')
          : '';
        setFeedback({
          type: 'success',
          text: txLocal(
            `선택한 시점의 포터블 설정·사용장소·오류 티켓을 복원했습니다.${safetyText}`,
            `Restored portable settings, location profiles, and error tickets.${safetyText}`
          ),
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.error || txLocal('백업 복원에 실패했습니다.', 'Failed to restore backup.'),
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmDelete = async (backupId: string) => {
    if (isBusy || isWriteProtected) return;
    setBusyAction('delete');
    setFeedback(null);
    try {
      const ok = await onDeleteBackup(backupId);
      setConfirmDeleteId(null);
      if (ok) {
        setFeedback({
          type: 'success',
          text: txLocal('선택한 백업 스냅샷 파일을 삭제했습니다.', 'Selected backup snapshot deleted.'),
        });
      } else {
        setFeedback({
          type: 'error',
          text: txLocal('백업 스냅샷 삭제에 실패했습니다.', 'Failed to delete backup snapshot.'),
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      id="backup-restore-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-restore-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4"
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <h2
                id="backup-restore-modal-title"
                className="font-display text-base font-bold text-slate-900 dark:text-white"
              >
                {txLocal('자료 자동 백업 및 시점 복원', 'Auto Backup & Point-in-Time Restore')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {txLocal(
                '삭제·수정·초기화·복원 직전 앱 실행 폴더 하위 ',
                'Automatically stores AES-256-GCM encrypted backups in the '
              )}
              <span className="font-mono">backup</span>{' '}
              {txLocal(
                `폴더에 AES-256-GCM 암호화 상태로 자동 보관합니다. (최대 ${maxSnapshots}개 회전 유지)`,
                `subfolder before deletes, edits, resets, or restores. (Up to ${maxSnapshots} rotating snapshots)`
              )}
            </p>
          </div>
          <button
            id="btn-close-backup-modal"
            type="button"
            disabled={isBusy}
            onClick={onClose}
            aria-label={txLocal('백업 복원 창 닫기', 'Close backup restore modal')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Folder Path + Summary Metrics */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {txLocal('백업 저장 위치 (현재 PC:', 'Backup Directory (Current PC:')}{' '}
                <span className="font-mono text-slate-700 dark:text-slate-300">{currentHostname}</span>)
              </div>
              <div
                id="backup-directory-path"
                className="mt-0.5 text-xs font-mono text-slate-800 dark:text-slate-200 break-all"
              >
                {status?.directory || 'backup'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-open-backup-folder"
                type="button"
                disabled={isBusy}
                onClick={() => void onOpenBackupFolder()}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {txLocal('백업 폴더 열기', 'Open Backup Folder')}
              </button>
              <button
                id="btn-refresh-backups"
                type="button"
                disabled={isBusy || isLoading}
                onClick={() => void onRefresh()}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
                {txLocal('새로고침', 'Refresh')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {txLocal('보관 스냅샷', 'Stored Snapshots')}
              </div>
              <div className="mt-0.5 text-sm font-bold tabular-data text-slate-900 dark:text-white">
                {snapshots.length}{' '}
                <span className="text-xs font-normal text-slate-400">
                  / {txLocal(`${maxSnapshots}개`, `${maxSnapshots}`)}
                </span>
              </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {txLocal('최근 백업 시각', 'Latest Snapshot')}
              </div>
              <div className="mt-0.5 text-sm font-semibold tabular-data font-mono text-slate-900 dark:text-white">
                {snapshots[0] ? formatSnapshotTime(snapshots[0].createdAt) : txLocal('기록 없음', 'None')}
              </div>
            </div>
            <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {txLocal('총 백업 용량 · 암호화', 'Total Size · Encryption')}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-data text-slate-900 dark:text-white">
                <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{formatBytesCompact(totalSizeBytes)} · AES-256-GCM</span>
              </div>
            </div>
          </div>

          {isWriteProtected && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  {txLocal('읽기 전용 / 쓰기 금지 폴더 감지:', 'Read-Only / Write-Protected Folder:')}
                </span>{' '}
                {status?.writeError ||
                  txLocal(
                    '백업 파일 생성·복원·삭제를 수행할 수 없습니다. 쓰기 권한을 확인하세요.',
                    'Cannot create, restore, or delete backup files. Check write permissions.'
                  )}
              </div>
            </div>
          )}

          {feedback && (
            <div
              role="status"
              className={`px-3.5 py-2 rounded-lg border text-xs font-medium ${
                feedback.type === 'success'
                  ? 'border-emerald-300 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                  : 'border-red-300 dark:border-red-800/70 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        {/* Manual Backup + Filter Toolbar */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="input-backup-reason"
              type="text"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              disabled={isBusy || isWriteProtected}
              placeholder={txLocal(
                '수동 백업 메모 (선택 입력 — 예: 본사 사무실 설정 변경 전)',
                'Manual backup note (optional — e.g. before office settings update)'
              )}
              maxLength={80}
              className="flex-1 min-w-[220px] px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              id="btn-create-manual-backup"
              type="button"
              disabled={isBusy || isWriteProtected}
              onClick={() => void handleCreate()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {busyAction === 'create'
                ? txLocal('백업 생성 중...', 'Creating backup...')
                : txLocal('지금 백업 만들기', 'Create Backup Now')}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5 text-xs">
              {(
                [
                  { id: 'all', label: txLocal(`전체 (${snapshots.length})`, `All (${snapshots.length})`) },
                  {
                    id: 'auto',
                    label: txLocal(
                      `자동 보호 (${snapshots.filter((s) => s.trigger !== 'manual').length})`,
                      `Auto (${snapshots.filter((s) => s.trigger !== 'manual').length})`
                    ),
                  },
                  {
                    id: 'manual',
                    label: txLocal(
                      `수동 백업 (${snapshots.filter((s) => s.trigger === 'manual').length})`,
                      `Manual (${snapshots.filter((s) => s.trigger === 'manual').length})`
                    ),
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  id={`btn-filter-backup-${tab.id}`}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-3 py-1 rounded-md font-medium tabular-data transition-colors cursor-pointer ${
                    filterMode === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-backup-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={txLocal('사유·PC 이름·파일명 검색', 'Search reason, PC name, or filename')}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Snapshot List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && snapshots.length === 0 ? (
            <div className="px-6 py-14 text-center text-xs text-slate-500 dark:text-slate-400">
              {txLocal('백업 폴더 목록을 불러오는 중입니다...', 'Loading backup snapshots...')}
            </div>
          ) : filteredSnapshots.length === 0 ? (
            <div className="px-6 py-14 text-center space-y-2">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {snapshots.length === 0
                  ? txLocal('아직 저장된 백업 스냅샷이 없습니다.', 'No backup snapshots saved yet.')
                  : txLocal('검색 또는 필터 조건에 일치하는 백업이 없습니다.', 'No snapshots match the search or filter.')}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {txLocal(
                  '상단 [지금 백업 만들기]로 현재 설정을 즉시 저장하거나, 데이터 삭제·수정 시 자동으로 백업이 생성됩니다.',
                  'Use [Create Backup Now] above to save immediately, or backups are created automatically on edits/deletes.'
                )}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredSnapshots.map((snap) => {
                const isConfirmingRestore = confirmRestoreId === snap.backupId;
                const isConfirmingDelete = confirmDeleteId === snap.backupId;

                return (
                  <li key={snap.backupId} className="px-6 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${getTriggerTextClass(
                              snap.trigger
                            )}`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            {getTriggerLabel(snap.trigger)}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="tabular-data font-mono text-slate-700 dark:text-slate-300">
                            {formatSnapshotTime(snap.createdAt)}
                          </span>
                          {snap.createdByHostName && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">·</span>
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                {snap.createdByHostName}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                          {snap.reason}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-data">
                          <span>{txLocal(`공유 ${snap.counts.shareCount}`, `Shares ${snap.counts.shareCount}`)}</span>
                          <span>·</span>
                          <span>{txLocal(`장소 ${snap.counts.locationCount}`, `Locations ${snap.counts.locationCount}`)}</span>
                          <span>·</span>
                          <span>{txLocal(`오류 티켓 ${snap.counts.ticketCount}`, `Tickets ${snap.counts.ticketCount}`)}</span>
                          <span>·</span>
                          <span>{txLocal(`호스트 정책 ${snap.counts.hostPolicyCount}`, `Policies ${snap.counts.hostPolicyCount}`)}</span>
                          <span>·</span>
                          <span>{txLocal(`대기 작업 ${snap.counts.pendingTaskCount}`, `Tasks ${snap.counts.pendingTaskCount}`)}</span>
                          <span>·</span>
                          <span className="font-mono text-slate-400 dark:text-slate-500">
                            {snap.fileName} ({formatBytesCompact(snap.sizeBytes)})
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!isConfirmingRestore && !isConfirmingDelete && (
                          <>
                            <button
                              id={`btn-restore-backup-${snap.backupId}`}
                              type="button"
                              disabled={isBusy || isWriteProtected}
                              onClick={() => {
                                setConfirmDeleteId(null);
                                setConfirmRestoreId(snap.backupId);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {txLocal('이 시점으로 복원', 'Restore Point')}
                            </button>
                            <button
                              id={`btn-delete-backup-${snap.backupId}`}
                              type="button"
                              disabled={isBusy || isWriteProtected}
                              onClick={() => {
                                setConfirmRestoreId(null);
                                setConfirmDeleteId(snap.backupId);
                              }}
                              aria-label={txLocal(`${snap.fileName} 백업 삭제`, `Delete backup ${snap.fileName}`)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg border border-transparent hover:border-red-200 dark:hover:border-red-800/60 cursor-pointer disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isConfirmingRestore && (
                      <div className="mt-3 px-3.5 py-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-700 dark:text-slate-200">
                          {txLocal(
                            '현재 포터블 설정·사용장소·오류 티켓을 이 백업 시점으로 복원합니다. 복원 직전 현재 상태는 자동 안전 백업으로 별도 저장됩니다.',
                            'Restores current portable config, locations, and tickets to this snapshot. Current state is backed up first.'
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            id={`btn-confirm-restore-${snap.backupId}`}
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleConfirmRestore(snap.backupId)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            {busyAction === 'restore'
                              ? txLocal('복원 중...', 'Restoring...')
                              : txLocal('이 시점으로 복원 실행', 'Confirm Restore')}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmRestoreId(null)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            {txLocal('취소', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {isConfirmingDelete && (
                      <div className="mt-3 px-3.5 py-2.5 rounded-lg border border-red-200 dark:border-red-800/70 bg-red-50/70 dark:bg-red-950/30 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-red-800 dark:text-red-200">
                          {txLocal('이 백업 파일(', 'Permanently delete backup file (')}
                          <span className="font-mono">{snap.fileName}</span>
                          {txLocal(')을 영구 삭제합니다.', ').')}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            id={`btn-confirm-delete-${snap.backupId}`}
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleConfirmDelete(snap.backupId)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            {busyAction === 'delete'
                              ? txLocal('삭제 중...', 'Deleting...')
                              : txLocal('삭제 확정', 'Confirm Delete')}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            {txLocal('취소', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
