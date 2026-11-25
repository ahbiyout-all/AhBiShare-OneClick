import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, Laptop, Sun, Moon, ShieldAlert, Usb, AlertTriangle, Clock, RotateCcw, X, Zap, RefreshCw, FolderOpen } from 'lucide-react';
import {
  RoleMode,
  AppSection,
  HostConfig,
  ActiveShare,
  DiscoveredPeer,
  ClientTargetConfig,
  MountedDrive,
  PipelineStep,
  LocalNetworkInfo,
  DiagnosticCheck,
  PortableHostShareEntry,
  PortableStorageStatus,
  OsNetworkPolicyStatus,
  HostPolicySnapshot,
  PendingHostPolicyTask,
  PolicyApplyResult,
  AutoAlignBatchResult,
  PolicyPatchMode,
  LegacyRollbackSnapshot,
  LegacyScriptBundle,
  LegacyTargetOs,
  LocationClientTargetEntry,
  LocationProfileFile,
  LocationProfileSummary,
  LocationBatchApplyResult,
  LocationPreflightReport,
  SmartAuthDetectionResult,
  TroubleshootTicket,
  TroubleshootWizardStep,
  TroubleshootStepResolvedSource,
  AppLogStatusInfo,
} from '@/types/share';
import { isElectronRuntime, shareBridge, sortPortableEntriesForClient } from '@/services/shareBridge';
import { APP_VERSION } from '@/version';
import { generateSecureSharePassword, isValidIpv4Address } from '@/utils/connectionCode';
import {
  evaluateRebootJudgment,
  formatEraShortLabel,
  formatSnapshotTimestamp,
  getPolicyPatchLabel,
} from '@/services/networkEvolution';
import {
  evaluateTroubleshootTicketsForPc,
  reclassifyTroubleshootTicketOnRetryFailure,
  recomputeTroubleshootTicketStatus,
} from '@/services/troubleshootPlaybook';
import { TopBar } from '@/components/TopBar';
import { HostPanel } from '@/components/HostPanel';
import { ClientPanel } from '@/components/ClientPanel';
import { RollbackPanel } from '@/components/RollbackPanel';
import { NetworkMatrixPanel } from '@/components/NetworkMatrixPanel';
import { LegacySharingPanel } from '@/components/LegacySharingPanel';
import { LocationProfileBar } from '@/components/LocationProfileBar';
import { LocationManagerModal } from '@/components/LocationManagerModal';
import { LocationPreflightModal } from '@/components/LocationPreflightModal';
import { TroubleshootHandoffBanner } from '@/components/TroubleshootHandoffBanner';
import { TroubleshootWizardModal } from '@/components/TroubleshootWizardModal';
import { DiagnosticsModal, SuggestedPingTarget } from './components/DiagnosticsModal';
import { UpdateModal } from './components/UpdateModal';
import { WorkProgressModal, ProgressJobState } from './components/WorkProgressModal';
import {
  checkForUpdates,
  clearSkippedUpdateTag,
  ReleaseInfo,
  shouldAutoPromptUpdate,
  skipUpdateTag,
} from './services/updateChecker';

interface ActivityEntry {
  id: string;
  time: string;
  role: string;
  summary: string;
  status: 'success' | 'error';
}

const INITIAL_PROGRESS_JOB: ProgressJobState = {
  isOpen: false,
  jobKey: '',
  title: '',
  subtitle: '',
  status: 'running',
  steps: [],
  startedAtMs: 0,
  finishedAtMs: null,
};

export const App: React.FC = () => {
  const initialQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialThemeParam = initialQuery?.get('theme');
  const initialRoleParam = initialQuery?.get('role');
  const isEmbedded = initialQuery?.get('embedded') === '1';

  const [isDark, setIsDark] = useState(initialThemeParam !== 'light');
  const [roleMode, setRoleMode] = useState<RoleMode>(initialRoleParam === 'client' ? 'client' : 'host');
  const [activeSection, setActiveSection] = useState<AppSection>('workspace');

  const [netInfo, setNetInfo] = useState<LocalNetworkInfo>({
    hostname: 'MAIN-HOST-PC',
    primaryIp: '192.168.0.105',
    adapterName: 'Ethernet',
    subnetPrefix: '192.168.0',
    isElectron: false,
    isAdmin: true,
  });

  const [shares, setShares] = useState<ActiveShare[]>([]);
  const [hostSteps, setHostSteps] = useState<PipelineStep[]>([]);
  const [isHostExecuting, setIsHostExecuting] = useState(false);

  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [mounts, setMounts] = useState<MountedDrive[]>([]);
  const [clientSteps, setClientSteps] = useState<PipelineStep[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isClientConnecting, setIsClientConnecting] = useState(false);

  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [appLogInfo, setAppLogInfo] = useState<AppLogStatusInfo | null>(null);
  const netInfoRef = useRef(netInfo);
  netInfoRef.current = netInfo;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagChecks, setDiagChecks] = useState<DiagnosticCheck[]>([]);
  const [diagErrorText, setDiagErrorText] = useState<string | null>(null);
  const [activeTargetHost, setActiveTargetHost] = useState('');

  const [portableShares, setPortableShares] = useState<PortableHostShareEntry[]>([]);
  const [portableStatus, setPortableStatus] = useState<PortableStorageStatus>(() => shareBridge.getPortableSnapshot().status);
  const [hostPolicySnapshots, setHostPolicySnapshots] = useState<Record<string, HostPolicySnapshot>>({});
  const [pendingHostActions, setPendingHostActions] = useState<Record<string, PendingHostPolicyTask>>({});
  const [isApplyingPendingHostTask, setIsApplyingPendingHostTask] = useState(false);
  const [confirmingDismissPendingTask, setConfirmingDismissPendingTask] = useState(false);
  const [pendingAutoFillEntry, setPendingAutoFillEntry] = useState<PortableHostShareEntry | null>(null);
  const [troubleshootTickets, setTroubleshootTickets] = useState<TroubleshootTicket[]>([]);
  const [troubleshootWizardOpen, setTroubleshootWizardOpen] = useState(false);
  const [selectedTroubleshootTicketId, setSelectedTroubleshootTicketId] = useState<string | null>(null);
  const autoOpenedTroubleshootKeysRef = useRef<Set<string>>(new Set());
  const createdInSessionTicketIdsRef = useRef<Set<string>>(new Set());

  const [nowMs, setNowMs] = useState(() => Date.now());
  const warned5MinRef = useRef<Set<string>>(new Set());
  const expiredHandledRef = useRef<Set<string>>(new Set());
  const [expiryAlerts, setExpiryAlerts] = useState<
    Array<{ shareName: string; uncPath: string; autoRevoked: boolean; expiredAt: string }>
  >([]);

  const [policyStatus, setPolicyStatus] = useState<OsNetworkPolicyStatus | null>(null);
  const [lastPatchResult, setLastPatchResult] = useState<PolicyApplyResult | null>(null);
  const [lastAutoAlignResult, setLastAutoAlignResult] = useState<AutoAlignBatchResult | null>(null);
  const [legacyRollbackSnapshot, setLegacyRollbackSnapshot] = useState<LegacyRollbackSnapshot | null>(() =>
    shareBridge.getLegacyRollbackSnapshot()
  );
  const [isPolicyInspecting, setIsPolicyInspecting] = useState(false);
  const [isRefreshingTab, setIsRefreshingTab] = useState(false);
  const refreshTabInFlightRef = useRef(false);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [isTogglingEmptyPasswordPolicy, setIsTogglingEmptyPasswordPolicy] = useState(false);
  const [applyingPatchMode, setApplyingPatchMode] = useState<PolicyPatchMode | null>(null);
  const [legacyHostSteps, setLegacyHostSteps] = useState<PipelineStep[]>([]);
  const [legacyClientSteps, setLegacyClientSteps] = useState<PipelineStep[]>([]);

  const [locationProfiles, setLocationProfiles] = useState<LocationProfileSummary[]>([]);
  const [locationStorageDir, setLocationStorageDir] = useState<string>('locations');
  const [activeLocationProfile, setActiveLocationProfile] = useState<LocationProfileFile | null>(null);
  const activeLocationProfileRef = useRef<LocationProfileFile | null>(null);
  activeLocationProfileRef.current = activeLocationProfile;
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTab, setLocationModalTab] = useState<'save' | 'manage'>('manage');
  const [locationModalEditProfileId, setLocationModalEditProfileId] = useState<string | null>(null);
  const [isLocationBatchApplying, setIsLocationBatchApplying] = useState(false);
  const [locationBatchProgress, setLocationBatchProgress] = useState<string | null>(null);
  const [lastLocationBatchResult, setLastLocationBatchResult] = useState<LocationBatchApplyResult | null>(null);
  const [preflightModalOpen, setPreflightModalOpen] = useState(false);
  const [preflightChecking, setPreflightChecking] = useState(false);
  const [preflightTargetProfile, setPreflightTargetProfile] = useState<LocationProfileFile | null>(null);
  const [preflightReport, setPreflightReport] = useState<LocationPreflightReport | null>(null);
  const preflightSeqRef = useRef(0);
  const locationFileInputRef = useRef<HTMLInputElement | null>(null);

  const [hostDraft, setHostDraft] = useState<HostConfig>(() => ({
    folderPath: 'C:\\AhBiShared',
    shareName: 'AhBiShared',
    authMode: 'guest',
    permission: 'full',
    username: 'AhBiShare',
    password: generateSecureSharePassword(10),
    ttlMinutes: 0,
    autoRevokeOnExpiry: true,
  }));
  const [pendingHostPreset, setPendingHostPreset] = useState<{ key: string; config: Partial<HostConfig> } | null>(null);

  const [clientDraft, setClientDraft] = useState<ClientTargetConfig>({
    targetHost: '192.168.0.10',
    shareName: 'WorkDocs',
    driveLetter: 'Z:',
    authMode: 'guest',
    username: '',
    password: '',
    persistent: true,
  });
  const [pendingClientAuthMode, setPendingClientAuthMode] = useState<{
    key: string;
    authMode: 'guest' | 'account';
    switchedFrom?: 'guest' | 'account';
    targetHost?: string;
    shareName?: string;
    smartResult?: SmartAuthDetectionResult;
  } | null>(null);
  const [pendingLocationTarget, setPendingLocationTarget] = useState<{
    key: string;
    target: LocationClientTargetEntry;
  } | null>(null);
  const clientDraftRef = useRef(clientDraft);
  clientDraftRef.current = clientDraft;
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const sharesRef = useRef(shares);
  sharesRef.current = shares;
  const portableSharesRef = useRef(portableShares);
  portableSharesRef.current = portableShares;
  const initialClientHostRef = useRef(clientDraft.targetHost);
  const hasUserEditedClientHostRef = useRef(false);
  const hasValidAbshareTokenRef = useRef(false);
  const skipNextIpProbeHostRef = useRef<string | null>(null);
  const smbProbeSeqRef = useRef(0);
  const lastNotifiedSmbSwitchRef = useRef('');

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const autoPromptedTagRef = useRef<string | null>(null);
  const updateCheckInFlightRef = useRef(false);

  const [progressJob, setProgressJob] = useState<ProgressJobState>(INITIAL_PROGRESS_JOB);
  const progressLockRef = useRef(false);
  const activeJobKeyRef = useRef('');

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin && event.origin !== window.location.origin && event.origin !== 'null') return;
      const payload = event.data;
      if (payload && payload.type === 'AHBI_THEME_SYNC' && (payload.theme === 'light' || payload.theme === 'dark')) {
        setIsDark(payload.theme === 'dark');
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const probeSmbTarget = useCallback(
    async (targetIp: string) => {
      const cleanIp = String(targetIp || '').trim();
      if (!isValidIpv4Address(cleanIp)) return;

      const seq = (smbProbeSeqRef.current += 1);
      const latestDraft = clientDraftRef.current;
      const targetShare = latestDraft.shareName.trim() || 'WorkDocs';
      const activeLoc = activeLocationProfileRef.current;
      let autoSwitchPref = true;
      try {
        autoSwitchPref = window.localStorage.getItem('ahbishare_auto_probe_switch') !== 'false';
      } catch {}

      try {
        const detection = await shareBridge.probeSmbTarget(
          cleanIp,
          targetShare,
          {
            currentAuthMode: latestDraft.authMode,
            hasTypedPassword: Boolean(latestDraft.password),
            autoSwitchEnabled: autoSwitchPref,
            suppressed: shareBridge.isSmartAuthSuppressed(cleanIp, targetShare),
            hasValidAbshareToken: hasValidAbshareTokenRef.current,
            peers: peersRef.current,
            savedLocationTargets: activeLoc?.clientTargets || [],
            locationSavedShares: activeLoc?.savedShares || [],
            locationHostPreset: activeLoc?.hostPreset || null,
            portableShares: portableSharesRef.current,
            activeShares: sharesRef.current,
          }
        );
        if (seq !== smbProbeSeqRef.current) return;

        const currentAfterProbe = clientDraftRef.current;
        const currentShareAfterProbe = currentAfterProbe.shareName.trim() || 'WorkDocs';
        if (currentAfterProbe.targetHost.trim() !== cleanIp) return;

        const finalDecision = shareBridge.evaluateSmartAuthDecision(
          detection.probe,
          {
            currentAuthMode: currentAfterProbe.authMode,
            hasTypedPassword: Boolean(currentAfterProbe.password),
            autoSwitchEnabled: autoSwitchPref,
            suppressed: shareBridge.isSmartAuthSuppressed(cleanIp, currentShareAfterProbe),
            hasValidAbshareToken: hasValidAbshareTokenRef.current,
            peers: peersRef.current,
            savedLocationTargets: activeLoc?.clientTargets || [],
            locationSavedShares: activeLoc?.savedShares || [],
            locationHostPreset: activeLoc?.hostPreset || null,
            portableShares: portableSharesRef.current,
            activeShares: sharesRef.current,
          },
          detection.fromCache
        );

        if (finalDecision.action !== 'auto_switch' || !finalDecision.switchToMode) return;
        const detectedMode = finalDecision.switchToMode;
        if (detectedMode === currentAfterProbe.authMode) return;
        const previousMode = currentAfterProbe.authMode;

        setClientDraft((prev) => {
          if (prev.targetHost.trim() !== cleanIp || prev.authMode === detectedMode) {
            return prev;
          }
          if (detectedMode === 'account') {
            return {
              ...prev,
              authMode: 'account',
              username: prev.username.trim()
                ? prev.username
                : finalDecision.suggestedUsername || 'AhBiShare',
              password: prev.password ? prev.password : finalDecision.suggestedPassword || '',
            };
          }
          return {
            ...prev,
            authMode: 'guest',
          };
        });

        setPendingClientAuthMode({
          key: `probe-smb-${cleanIp}-${detectedMode}-${Date.now()}`,
          authMode: detectedMode,
          switchedFrom: previousMode,
          targetHost: cleanIp,
          shareName: currentShareAfterProbe,
          smartResult: finalDecision,
        });

        const notifyKey = `${cleanIp}:${previousMode}->${detectedMode}`;
        if (lastNotifiedSmbSwitchRef.current !== notifyKey) {
          lastNotifiedSmbSwitchRef.current = notifyKey;
          showToast(
            detectedMode === 'account'
              ? `스마트 인증 감지(${cleanIp}): 보안 계정 인증이 감지되어 '보안 계정' 모드로 자동 전환했습니다.`
              : `스마트 인증 감지(${cleanIp}): 무비밀번호(Guest) 접근이 허용되어 '무비밀번호' 모드로 자동 전환했습니다.`
          );
        }
      } catch {
        // Silent fallback: manual probe bar remains available in ClientPanel
      }
    },
    [showToast]
  );

  useEffect(() => {
    const cleanTargetIp = clientDraft.targetHost.trim();
    if (skipNextIpProbeHostRef.current && skipNextIpProbeHostRef.current === cleanTargetIp) {
      skipNextIpProbeHostRef.current = null;
      return;
    }
    if (cleanTargetIp !== initialClientHostRef.current) {
      hasUserEditedClientHostRef.current = true;
    }
    if (!hasUserEditedClientHostRef.current || !isValidIpv4Address(cleanTargetIp)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void probeSmbTarget(cleanTargetIp);
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clientDraft.targetHost, probeSmbTarget]);

  const refreshAppLogInfo = useCallback(async () => {
    try {
      const info = await shareBridge.getAppLogInfo();
      if (info.supported) {
        setAppLogInfo(info);
      }
    } catch {}
  }, []);

  const appendLog = useCallback((role: string, summary: string, status: 'success' | 'error') => {
    setActivityLog((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        role,
        summary,
        status,
      },
      ...prev,
    ]);
    void shareBridge
      .appendAppLog({
        role,
        summary,
        status,
        hostName: netInfoRef.current.hostname,
      })
      .then((res) => {
        if (res.success && res.directory) {
          setAppLogInfo((prev) =>
            prev
              ? {
                  ...prev,
                  directory: res.directory,
                  ...(res.fileName ? { currentFileName: res.fileName } : {}),
                  ...(res.filePath ? { currentFilePath: res.filePath } : {}),
                }
              : prev
          );
        }
      })
      .catch(() => {});
  }, []);

  const startProgressJob = useCallback(
    (title: string, subtitle?: string, initialSteps: PipelineStep[] = []): string | null => {
      if (progressLockRef.current) return null;
      const jobKey = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      progressLockRef.current = true;
      activeJobKeyRef.current = jobKey;
      setProgressJob({
        isOpen: true,
        jobKey,
        title,
        subtitle,
        status: 'running',
        steps: initialSteps,
        startedAtMs: Date.now(),
        finishedAtMs: null,
      });
      return jobKey;
    },
    []
  );

  const updateProgressSteps = useCallback((jobKey: string, steps: PipelineStep[]) => {
    if (activeJobKeyRef.current !== jobKey) return;
    setProgressJob((prev) => (prev.jobKey === jobKey ? { ...prev, steps } : prev));
  }, []);

  const completeProgressJob = useCallback((jobKey: string, summary: string, finalSteps?: PipelineStep[]) => {
    if (activeJobKeyRef.current !== jobKey) return;
    progressLockRef.current = false;
    setProgressJob((prev) =>
      prev.jobKey === jobKey
        ? {
            ...prev,
            status: 'success',
            finishedAtMs: Date.now(),
            summary,
            ...(finalSteps ? { steps: finalSteps } : {}),
          }
        : prev
    );
  }, []);

  const failProgressJob = useCallback((jobKey: string, errorDetail: string, finalSteps?: PipelineStep[]) => {
    if (activeJobKeyRef.current !== jobKey) return;
    progressLockRef.current = false;
    setProgressJob((prev) =>
      prev.jobKey === jobKey
        ? {
            ...prev,
            status: 'error',
            finishedAtMs: Date.now(),
            errorDetail,
            ...(finalSteps ? { steps: finalSteps } : {}),
          }
        : prev
    );
  }, []);

  const closeProgressModal = useCallback(() => {
    if (progressLockRef.current) return;
    setProgressJob((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const runUpdateCheck = useCallback(
    async (manual: boolean) => {
      if (updateCheckInFlightRef.current) return;
      updateCheckInFlightRef.current = true;
      setIsCheckingUpdates(true);
      try {
        const res = await checkForUpdates(APP_VERSION);
        if (res.hasUpdate && res.release) {
          setLatestRelease(res.release);
          if (manual) {
            clearSkippedUpdateTag();
            autoPromptedTagRef.current = res.release.tagName;
            setUpdateModalOpen(true);
            appendLog('GitHub 업데이트', `새 릴리즈 ${res.release.tagName} 확인창 열림`, 'success');
          } else if (
            shouldAutoPromptUpdate(res.release.tagName) &&
            autoPromptedTagRef.current !== res.release.tagName
          ) {
            autoPromptedTagRef.current = res.release.tagName;
            setUpdateModalOpen(true);
            appendLog('GitHub 업데이트', `GitHub 최신 버전(${res.release.tagName}) 자동 감지됨`, 'success');
          }
        } else if (manual) {
          if (res.error) {
            showToast(`업데이트 확인 실패: ${res.error}`);
            appendLog('GitHub 업데이트', `확인 실패: ${res.error}`, 'error');
          } else {
            showToast(`현재 최신 버전(v${APP_VERSION})을 사용 중입니다.`);
            appendLog('GitHub 업데이트', `최신 버전(v${APP_VERSION}) 확인 완료`, 'success');
          }
        }
      } finally {
        updateCheckInFlightRef.current = false;
        setIsCheckingUpdates(false);
      }
    },
    [appendLog, showToast]
  );

  useEffect(() => {
    void runUpdateCheck(false);
    const intervalId = window.setInterval(() => {
      void runUpdateCheck(false);
    }, 30 * 60_000);
    return () => window.clearInterval(intervalId);
  }, [runUpdateCheck]);

  const refreshPortableSnapshot = useCallback((hostname: string) => {
    const snap = shareBridge.getPortableSnapshot();
    setPortableShares(sortPortableEntriesForClient(snap.document.shares, hostname));
    setPortableStatus(snap.status);
    setHostPolicySnapshots(snap.document.hostPolicies ? { ...snap.document.hostPolicies } : {});
    setPendingHostActions(snap.document.pendingHostActions ? { ...snap.document.pendingHostActions } : {});
    setTroubleshootTickets(snap.document.troubleshootTickets ? [...snap.document.troubleshootTickets] : []);
  }, []);

  const refreshLocationProfiles = useCallback(async () => {
    try {
      const listRes = await shareBridge.listLocationProfiles();
      setLocationProfiles(listRes.profiles);
      if (listRes.directory) setLocationStorageDir(listRes.directory);
    } catch {}
  }, []);

  const syncAllMatrixAndWizardState = useCallback(
    async (params: {
      netInfoSnap: LocalNetworkInfo;
      policy: OsNetworkPolicyStatus | null;
      localShares?: ActiveShare[];
      localMounts?: MountedDrive[];
      source: TroubleshootStepResolvedSource;
      justCreatedShareNames?: string[];
      justMountedTargets?: Array<{ targetHost: string; shareName: string }>;
      silent?: boolean;
    }) => {
      try {
        const ticketSyncRes = await shareBridge.syncTroubleshootTicketsWithLocalState({
          netInfo: params.netInfoSnap,
          policyStatus: params.policy,
          localShares: params.localShares ?? shareBridge.getSavedShares(),
          localMounts: params.localMounts ?? shareBridge.getSavedMounts(),
          source: params.source,
          justCreatedShareNames: params.justCreatedShareNames,
          justMountedTargets: params.justMountedTargets,
        });
        const pendingSyncRes = await shareBridge.reconcilePendingHostActionsWithLocalPolicy(
          params.netInfoSnap,
          params.policy
        );

        if (ticketSyncRes.summary.changed) {
          setTroubleshootTickets(ticketSyncRes.tickets);
        }
        setPendingHostActions(pendingSyncRes.pendingHostActions);
        setHostPolicySnapshots(shareBridge.getHostPolicySnapshots());
        refreshPortableSnapshot(params.netInfoSnap.hostname);

        if (!params.silent) {
          const parts: string[] = [];
          if (ticketSyncRes.summary.autoCompletedSteps > 0) {
            parts.push(`마법사 정책 단계 ${ticketSyncRes.summary.autoCompletedSteps}건 자동 완료`);
          }
          if (ticketSyncRes.summary.reopenedSteps > 0) {
            parts.push(`정책 변경으로 ${ticketSyncRes.summary.reopenedSteps}단계 재적용 대기 전환`);
          }
          if (pendingSyncRes.resolvedTaskHosts.length > 0) {
            parts.push(`호스트 대기 작업(${pendingSyncRes.resolvedTaskHosts.join(', ')}) 충족 정리`);
          }
          if (parts.length > 0) {
            appendLog('양방향 동기화', parts.join(' · '), 'success');
          }
        }
      } catch {}
    },
    [appendLog, refreshPortableSnapshot]
  );

  const handleRefreshTab = useCallback(
    async (options?: { scanLan?: boolean; inspectPolicy?: boolean; tabLabel?: string }) => {
      if (refreshTabInFlightRef.current) return;
      refreshTabInFlightRef.current = true;
      setIsRefreshingTab(true);
      const label = options?.tabLabel || '화면';
      try {
        const freshNet = await shareBridge.getLocalNetworkInfo();
        setNetInfo(freshNet);
        const synced = await shareBridge.syncLiveState(freshNet);
        setShares(synced.shares);
        setMounts(synced.mounts);
        const sortedPortable = sortPortableEntriesForClient(synced.portable.document.shares, freshNet.hostname);
        setPortableShares(sortedPortable);
        setPortableStatus(synced.portable.status);
        setHostPolicySnapshots(synced.portable.document.hostPolicies || {});
        setPendingHostActions(synced.portable.document.pendingHostActions || {});
        setTroubleshootTickets(synced.portable.document.troubleshootTickets || []);
        if (options?.scanLan) {
          try {
            const found = await shareBridge.scanLanPeers(freshNet);
            setPeers(found);
          } catch {}
        }
        if (options?.inspectPolicy !== false) {
          try {
            const pol = await shareBridge.inspectOsNetworkPolicy(freshNet);
            setPolicyStatus(pol);
            await syncAllMatrixAndWizardState({
              netInfoSnap: freshNet,
              policy: pol,
              localShares: synced.shares,
              localMounts: synced.mounts,
              source: 'live_inspect',
              silent: true,
            });
          } catch {}
        }
        const listRes = await shareBridge.listLocationProfiles();
        setLocationProfiles(listRes.profiles);
        if (listRes.directory) setLocationStorageDir(listRes.directory);
        const currentActiveProfile = activeLocationProfileRef.current;
        if (currentActiveProfile) {
          const stillExists = listRes.profiles.some((p) => p.profileId === currentActiveProfile.profileId);
          if (!stillExists) {
            setActiveLocationProfile(null);
            setLastLocationBatchResult(null);
          } else {
            const reloaded = await shareBridge.loadLocationProfile(currentActiveProfile.profileId);
            if (reloaded.success && reloaded.profile) {
              setActiveLocationProfile(reloaded.profile);
            }
          }
        }
        await refreshAppLogInfo();
        appendLog(label, `${label} 상태(네트워크·공유·드라이브·USB 프로필) 새로고침 완료`, 'success');
        showToast(`${label} 상태를 최신 정보로 새로고침했습니다.`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog(label, `새로고침 실패: ${reason}`, 'error');
        showToast('새로고침 중 오류가 발생했습니다.');
      } finally {
        refreshTabInFlightRef.current = false;
        setIsRefreshingTab(false);
      }
    },
    [appendLog, refreshAppLogInfo, showToast, syncAllMatrixAndWizardState]
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const info = await shareBridge.getLocalNetworkInfo();
        setNetInfo(info);
        const synced = await shareBridge.syncLiveState(info);
        setShares(synced.shares);
        setMounts(synced.mounts);
        const sortedPortable = sortPortableEntriesForClient(synced.portable.document.shares, info.hostname);
        setPortableShares(sortedPortable);
        setPortableStatus(synced.portable.status);
        setHostPolicySnapshots(synced.portable.document.hostPolicies || {});
        setPendingHostActions(synced.portable.document.pendingHostActions || {});
        setTroubleshootTickets(synced.portable.document.troubleshootTickets || []);
        if (sortedPortable.length > 0) {
          appendLog(
            'USB 포터블',
            `${synced.portable.status.fileName}에서 저장된 공유 설정 ${sortedPortable.length}건 자동 로드 완료`,
            'success'
          );
        }
        const found = await shareBridge.scanLanPeers(info);
        setPeers(found);
        const pol = await shareBridge.inspectOsNetworkPolicy(info);
        setPolicyStatus(pol);
        await syncAllMatrixAndWizardState({
          netInfoSnap: info,
          policy: pol,
          localShares: synced.shares,
          localMounts: synced.mounts,
          source: 'live_inspect',
          silent: true,
        });
      } catch {
        setShares(shareBridge.getSavedShares());
        setMounts(shareBridge.getSavedMounts());
      }
      await refreshLocationProfiles();
      await refreshAppLogInfo();
    };
    void bootstrap();
  }, [appendLog, refreshLocationProfiles, refreshAppLogInfo, syncAllMatrixAndWizardState]);

  // 1-second timer tick for active timed shares
  useEffect(() => {
    if (!shares.some((s) => Boolean(s.expiresAt))) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [shares]);

  // Monitor share expiry warnings (<= 5 min) & expiry enforcement
  useEffect(() => {
    for (const sh of shares) {
      if (!sh.expiresAt) continue;
      const expMs = Date.parse(sh.expiresAt);
      if (Number.isNaN(expMs)) continue;
      const key = `${sh.shareName}::${sh.expiresAt}`;
      const diffMs = expMs - nowMs;

      if (diffMs > 0 && diffMs <= 5 * 60_000 && !warned5MinRef.current.has(key)) {
        warned5MinRef.current.add(key);
        const msg = `공유폴더 '${sh.shareName}'가 5분 이내에 만료됩니다.`;
        showToast(msg);
        appendLog('만료 타이머', msg, 'success');
      }

      if (diffMs <= 0 && !expiredHandledRef.current.has(key)) {
        expiredHandledRef.current.add(key);
        const expiredTime = new Date(expMs).toLocaleTimeString('ko-KR', { hour12: false });
        if (sh.autoRevokeOnExpiry) {
          void (async () => {
            let revoked = false;
            try {
              const updated = await shareBridge.removeHostShare(sh.shareName, netInfo);
              setShares(updated);
              refreshPortableSnapshot(netInfo.hostname);
              revoked = true;
              appendLog('만료 타이머', `공유폴더 '${sh.shareName}' 자동 만료로 공유 해제 완료`, 'success');
              showToast(`'${sh.shareName}' 만료 시간이 되어 공유를 자동 해제했습니다.`);
            } catch {
              appendLog('만료 타이머', `공유폴더 '${sh.shareName}' 자동 해제 실패`, 'error');
              showToast(`'${sh.shareName}' 자동 해제 실패: 만료 알림에서 직접 해제하세요.`);
            }
            setExpiryAlerts((prev) => [
              { shareName: sh.shareName, uncPath: sh.uncPath, autoRevoked: revoked, expiredAt: expiredTime },
              ...prev.filter((a) => a.shareName !== sh.shareName),
            ]);
          })();
        } else {
          appendLog('만료 타이머', `공유폴더 '${sh.shareName}' 만료 시각(${expiredTime}) 도래`, 'success');
          showToast(`'${sh.shareName}' 공유 만료: 1클릭 보안 원복 알림을 확인하세요.`);
          setExpiryAlerts((prev) => [
            { shareName: sh.shareName, uncPath: sh.uncPath, autoRevoked: false, expiredAt: expiredTime },
            ...prev.filter((a) => a.shareName !== sh.shareName),
          ]);
        }
      }
    }
  }, [shares, nowMs, netInfo, refreshPortableSnapshot, appendLog, showToast]);

  const handleInspectOsPolicy = useCallback(async () => {
    if (refreshTabInFlightRef.current) return;
    setIsPolicyInspecting(true);
    setLastAutoAlignResult(null);
    try {
      const pol = await shareBridge.inspectOsNetworkPolicy(netInfo);
      setPolicyStatus(pol);
      await syncAllMatrixAndWizardState({
        netInfoSnap: netInfo,
        policy: pol,
        source: 'live_inspect',
      });
      appendLog(
        'OS 정책 검사',
        `${formatEraShortLabel(pol.osEra, pol.osBuild, pol.osDisplayVersion)} 진단 완료 (호환 ${pol.compatibilityScore}점 · 감지 ${pol.detectedIssues.length}건)`,
        'success'
      );
    } catch {
      showToast('OS 네트워크 정책 점검 중 오류가 발생했습니다.');
    } finally {
      setIsPolicyInspecting(false);
    }
  }, [netInfo, appendLog, showToast, syncAllMatrixAndWizardState]);

  const handleToggleBlockEmptyPasswordAccounts = useCallback(
    async (block: boolean) => {
      if (isTogglingEmptyPasswordPolicy) return;
      setIsTogglingEmptyPasswordPolicy(true);
      try {
        const res = await shareBridge.toggleBlockEmptyPasswordAccounts(
          block,
          hostDraft.shareName,
          netInfo
        );
        let resolvedPol: OsNetworkPolicyStatus | null = res.updatedPolicy || null;
        if (!resolvedPol) {
          try {
            resolvedPol = await shareBridge.inspectOsNetworkPolicy(netInfo);
          } catch {}
        }
        if (resolvedPol) {
          setPolicyStatus(resolvedPol);
          setLastPatchResult({
            success: res.success,
            mode: 'safe_compat',
            summary: res.message,
            appliedActions: [res.message],
            rebootJudgment: evaluateRebootJudgment({
              mode: 'safe_compat',
              restartedServices: res.success && !block ? ['LanmanServer'] : [],
              priorPendingReboot: resolvedPol.pendingRebootFlag,
            }),
            updatedPolicy: resolvedPol,
          });
        }
        setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
        await syncAllMatrixAndWizardState({
          netInfoSnap: netInfo,
          policy: resolvedPol,
          source: block ? 'rollback' : 'host_panel',
        });
        appendLog('빈 암호 계정 정책', res.message, res.success ? 'success' : 'error');
        showToast(res.message);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('빈 암호 계정 정책', `정책 전환 예외: ${msg}`, 'error');
        showToast(`빈 암호 계정 정책 전환 실패: ${msg}`);
      } finally {
        setIsTogglingEmptyPasswordPolicy(false);
      }
    },
    [
      isTogglingEmptyPasswordPolicy,
      hostDraft.shareName,
      netInfo,
      syncAllMatrixAndWizardState,
      appendLog,
      showToast,
    ]
  );

  const handleApplyOsPatch = useCallback(
    async (mode: PolicyPatchMode) => {
      const modeLabel = getPolicyPatchLabel(mode);
      const initialSteps: PipelineStep[] = [
        {
          id: 'patch-prep',
          title: '사전 보안 상태 스냅샷 및 호환 환경 확인',
          detail: `${modeLabel} 적용 전 현재 SMB·LSA 상태를 점검합니다.`,
          status: 'running',
        },
        {
          id: 'patch-apply',
          title: `${modeLabel} 정책 및 서비스 반영`,
          detail: '레지스트리 정책 적용 및 관련 Windows 서비스 새로고침',
          status: 'idle',
        },
        {
          id: 'patch-verify',
          title: 'OS 네트워크 정책 재검사 및 USB 스냅샷 동기화',
          detail: '변경된 정책 점수와 재부팅 필요 여부를 최종 검증합니다.',
          status: 'idle',
        },
      ];
      const jobKey = startProgressJob('OS 네트워크·호환성 정책 적용', modeLabel, initialSteps);
      if (!jobKey) return;

      setApplyingPatchMode(mode);
      setLastAutoAlignResult(null);
      const t0 = performance.now();
      try {
        updateProgressSteps(jobKey, [
          { ...initialSteps[0], status: 'success', durationMs: 40 },
          { ...initialSteps[1], status: 'running' },
          initialSteps[2],
        ]);
        const res = await shareBridge.applyOsCompatibilityPatch(mode, netInfo);
        const applyDuration = Math.round(performance.now() - t0);

        setLastPatchResult(res);
        setPolicyStatus(res.updatedPolicy);
        setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
        const isRollbackMode =
          mode === 'strict_26h2_default' ||
          mode === 'legacy_bridge_rollback' ||
          mode === 'disable_uac_token_filter' ||
          mode === 'rpc_printer_default';
        await syncAllMatrixAndWizardState({
          netInfoSnap: netInfo,
          policy: res.updatedPolicy,
          source: isRollbackMode ? 'rollback' : 'matrix',
        });
        appendLog(
          'OS 정책 적용',
          `${res.summary} · ${res.rebootJudgment.title}`,
          res.success ? 'success' : 'error'
        );
        showToast(res.success ? res.rebootJudgment.title : res.summary);

        if (res.success) {
          completeProgressJob(jobKey, `${res.summary} · ${res.rebootJudgment.title}`, [
            { ...initialSteps[0], status: 'success', durationMs: 40 },
            {
              ...initialSteps[1],
              status: 'success',
              durationMs: applyDuration,
              detail: res.appliedActions.slice(0, 2).join(' · ') || res.summary,
            },
            {
              ...initialSteps[2],
              status: 'success',
              durationMs: 30,
              detail: `${res.rebootJudgment.title} (호환 점수 ${res.updatedPolicy.compatibilityScore}점)`,
            },
          ]);
        } else {
          failProgressJob(jobKey, res.summary, [
            { ...initialSteps[0], status: 'success', durationMs: 40 },
            {
              ...initialSteps[1],
              status: 'error',
              durationMs: applyDuration,
              error: res.summary,
            },
            initialSteps[2],
          ]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('OS 정책 적용', `정책 적용 예외: ${msg}`, 'error');
        showToast(`정책 적용 실패: ${msg}`);
        failProgressJob(jobKey, msg, [
          { ...initialSteps[0], status: 'success' },
          { ...initialSteps[1], status: 'error', error: msg },
          initialSteps[2],
        ]);
      } finally {
        setApplyingPatchMode(null);
      }
    },
    [netInfo, appendLog, showToast, syncAllMatrixAndWizardState, startProgressJob, updateProgressSteps, completeProgressJob, failProgressJob]
  );

  const handleSyncMatchedPolicies = useCallback(
    async (modes: PolicyPatchMode[]) => {
      if (modes.length === 0) return;
      const modeNames = modes.map((m) => getPolicyPatchLabel(m)).join(' · ');
      const jobKey = startProgressJob(
        '호스트·클라이언트 정책 일괄 자동 정렬',
        `${modes.length}종 정책 (${modeNames})`,
        modes.map((m, idx) => ({
          id: `align-${idx}-${m}`,
          title: `${getPolicyPatchLabel(m)} 적용`,
          detail: '호스트·클라이언트 정책 정렬 대기',
          status: 'idle',
        }))
      );
      if (!jobKey) return;

      setIsAutoAligning(true);
      let latestSteps: PipelineStep[] = [];
      try {
        const batch = await shareBridge.autoAlignHostClientPolicies(modes, netInfo, (steps) => {
          latestSteps = steps;
          updateProgressSteps(jobKey, steps);
        });
        setLastAutoAlignResult(batch);
        setLastPatchResult({
          success: batch.success,
          mode: batch.appliedModes[0] || modes[0],
          summary: batch.summary,
          appliedActions: batch.appliedActions,
          rebootJudgment: batch.rebootJudgment,
          updatedPolicy: batch.updatedPolicy,
        });
        setPolicyStatus(batch.updatedPolicy);
        setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
        await syncAllMatrixAndWizardState({
          netInfoSnap: netInfo,
          policy: batch.updatedPolicy,
          source: 'matrix',
        });
        appendLog(
          '자동 정렬',
          `${batch.summary} · ${batch.rebootJudgment.title}`,
          batch.success ? 'success' : 'error'
        );
        showToast(
          batch.success
            ? batch.summary
            : '일부 호환성 정책 자동 정렬에 실패했습니다. 아래 상세 내역을 확인하세요.'
        );
        if (batch.success) {
          completeProgressJob(jobKey, `${batch.summary} · ${batch.rebootJudgment.title}`, latestSteps);
        } else {
          failProgressJob(jobKey, batch.summary, latestSteps);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('자동 정렬', `정책 자동 정렬 예외: ${msg}`, 'error');
        showToast(`정책 자동 정렬 실패: ${msg}`);
        failProgressJob(jobKey, msg, latestSteps);
      } finally {
        setIsAutoAligning(false);
      }
    },
    [netInfo, appendLog, showToast, syncAllMatrixAndWizardState, startProgressJob, updateProgressSteps, completeProgressJob, failProgressJob]
  );

  const handleDeleteHostPolicySnapshot = useCallback(
    async (hostName: string) => {
      try {
        const updatedMap = await shareBridge.deleteHostPolicySnapshot(hostName);
        setHostPolicySnapshots(updatedMap);
        refreshPortableSnapshot(netInfo.hostname);
        appendLog('OS 정책 스냅샷', `'${hostName}' 호스트 정책 스냅샷을 목록에서 삭제했습니다.`, 'success');
        showToast(`'${hostName}' 정책 스냅샷을 삭제했습니다.`);
      } catch {
        showToast('호스트 정책 스냅샷 삭제 중 오류가 발생했습니다.');
      }
    },
    [netInfo.hostname, refreshPortableSnapshot, appendLog, showToast]
  );

  const handleClearAllHostPolicySnapshots = useCallback(async () => {
    try {
      const updatedMap = await shareBridge.clearAllHostPolicySnapshots();
      setHostPolicySnapshots(updatedMap);
      refreshPortableSnapshot(netInfo.hostname);
      appendLog('OS 정책 스냅샷', '저장된 모든 호스트 정책 스냅샷 목록을 초기화했습니다.', 'success');
      showToast('저장된 호스트 정책 스냅샷 목록을 모두 비웠습니다.');
    } catch {
      showToast('호스트 정책 스냅샷 목록 초기화 중 오류가 발생했습니다.');
    }
  }, [netInfo.hostname, refreshPortableSnapshot, appendLog, showToast]);

  const myPendingHostTask = React.useMemo(() => {
    const currentLower = netInfo.hostname.trim().toLowerCase();
    for (const [k, task] of Object.entries(pendingHostActions || {})) {
      if (
        k.trim().toLowerCase() === currentLower ||
        (task.targetHostName || '').trim().toLowerCase() === currentLower
      ) {
        return task;
      }
    }
    return null;
  }, [pendingHostActions, netInfo.hostname]);

  const handleSavePendingHostTask = useCallback(
    async (taskInput: Omit<PendingHostPolicyTask, 'taskId' | 'createdAt'>) => {
      try {
        const res = await shareBridge.savePendingHostPolicyTask(taskInput);
        setPendingHostActions(res.pendingHostActions);
        refreshPortableSnapshot(netInfo.hostname);
        const targetLabel = res.task.targetHostName;
        appendLog(
          '호스트 대기 작업',
          `'${targetLabel}' 호스트용 USB 자동 적용 작업 저장 완료 (${res.task.conflictLabels.join(' · ') || '정책 정렬'})`,
          'success'
        );
        showToast(
          `'${targetLabel}' 대상 USB 자동 적용 대기 작업을 저장했습니다. 해당 PC에서 앱을 열면 1클릭으로 적용됩니다.`
        );
      } catch {
        showToast('호스트 대기 작업 저장 중 오류가 발생했습니다.');
      }
    },
    [netInfo.hostname, refreshPortableSnapshot, appendLog, showToast]
  );

  const handleDeletePendingHostTask = useCallback(
    async (targetHostName: string) => {
      try {
        const updated = await shareBridge.deletePendingHostPolicyTask(targetHostName);
        setPendingHostActions(updated);
        setConfirmingDismissPendingTask(false);
        refreshPortableSnapshot(netInfo.hostname);
        appendLog('호스트 대기 작업', `'${targetHostName}' 대상 USB 대기 작업을 삭제했습니다.`, 'success');
        showToast(`'${targetHostName}' 호스트 대기 작업을 삭제했습니다.`);
      } catch {
        showToast('호스트 대기 작업 삭제 중 오류가 발생했습니다.');
      }
    },
    [netInfo.hostname, refreshPortableSnapshot, appendLog, showToast]
  );

  const handleApplyPendingHostTask = useCallback(
    async (task: PendingHostPolicyTask) => {
      const initialSteps: PipelineStep[] = [
        ...task.modes.map((m, idx) => ({
          id: `pending-mode-${idx}-${m}`,
          title: `[호스트 예약] ${getPolicyPatchLabel(m)} 적용`,
          detail: '요청된 정책 패치 반영 및 SMB 서비스 갱신',
          status: 'idle' as const,
        })),
        ...(task.includeGuestUnlock
          ? [
              {
                id: 'pending-guest-unlock',
                title: '[호스트 예약] Guest 무비밀번호 정책 완전 개방 (오류 86·1223·1385)',
                detail: 'LimitBlankPasswordUse=0 · Guest 활성화 · SeDenyNetworkLogonRight 정리 · 445 방화벽 개방',
                status: 'idle' as const,
              },
            ]
          : []),
        {
          id: 'pending-cleanup',
          title: '호스트 OS 정책 재검사 및 USB 대기 작업 완료 처리',
          detail: 'USB 포터블 저장소에서 완료된 대기 작업을 정리합니다.',
          status: 'idle' as const,
        },
      ];
      const jobKey = startProgressJob(
        `원격 요청 호스트 정책 자동 적용 (${task.targetHostName})`,
        `요청 PC: ${task.requestedByHostName} · ${task.conflictLabels.join(' · ') || '정책 정렬'}`,
        initialSteps
      );
      if (!jobKey) return;

      setIsApplyingPendingHostTask(true);
      let latestSteps: PipelineStep[] = initialSteps;
      try {
        const batch = await shareBridge.applyPendingHostPolicyTask(task, netInfo, (steps) => {
          latestSteps = steps;
          updateProgressSteps(jobKey, steps);
        });
        setLastAutoAlignResult(batch);
        setLastPatchResult({
          success: batch.success,
          mode: batch.appliedModes[0] || task.modes[0] || 'safe_compat',
          summary: batch.summary,
          appliedActions: batch.appliedActions,
          rebootJudgment: batch.rebootJudgment,
          updatedPolicy: batch.updatedPolicy,
        });
        setPolicyStatus(batch.updatedPolicy);
        setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
        setConfirmingDismissPendingTask(false);
        await syncAllMatrixAndWizardState({
          netInfoSnap: netInfo,
          policy: batch.updatedPolicy,
          source: 'matrix',
        });
        appendLog(
          '호스트 대기 작업',
          `${batch.summary} · ${batch.rebootJudgment.title}`,
          batch.success ? 'success' : 'error'
        );
        showToast(batch.success ? `${batch.summary} 완료` : batch.summary);
        if (batch.success) {
          completeProgressJob(jobKey, `${batch.summary} · ${batch.rebootJudgment.title}`, latestSteps);
        } else {
          failProgressJob(jobKey, batch.summary, latestSteps);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('호스트 대기 작업', `대기 작업 적용 예외: ${msg}`, 'error');
        showToast(`대기 작업 적용 실패: ${msg}`);
        failProgressJob(jobKey, msg, latestSteps);
      } finally {
        setIsApplyingPendingHostTask(false);
      }
    },
    [
      netInfo,
      syncAllMatrixAndWizardState,
      appendLog,
      showToast,
      startProgressJob,
      updateProgressSteps,
      completeProgressJob,
      failProgressJob,
    ]
  );

  const troubleshootMatch = React.useMemo(
    () => evaluateTroubleshootTicketsForPc(troubleshootTickets, netInfo, shares, mounts, portableShares),
    [troubleshootTickets, netInfo, shares, mounts, portableShares]
  );

  useEffect(() => {
    const primary = troubleshootMatch.primaryTicket;
    if (!primary || troubleshootWizardOpen) return;
    if (
      progressJob.isOpen ||
      diagOpen ||
      updateModalOpen ||
      locationModalOpen ||
      preflightModalOpen ||
      isRefreshingTab ||
      isHostExecuting ||
      isClientConnecting
    ) {
      return;
    }

    const fromOtherPc =
      (primary.originHostName || '').trim().toLowerCase() !== netInfo.hostname.trim().toLowerCase();
    const isResumingAfterOppositeFix =
      primary.status === 'host_fixed' || primary.status === 'client_fixed';
    const createdInsideThisSession = createdInSessionTicketIdsRef.current.has(primary.ticketId);
    if (createdInsideThisSession && !fromOtherPc && !isResumingAfterOppositeFix) {
      return;
    }

    const openKey = `${primary.ticketId}::${primary.status}::${netInfo.hostname}`;
    if (autoOpenedTroubleshootKeysRef.current.has(openKey)) return;
    autoOpenedTroubleshootKeysRef.current.add(openKey);
    setSelectedTroubleshootTicketId(primary.ticketId);
    setTroubleshootWizardOpen(true);
    appendLog(
      'USB 오류 마법사',
      `이 PC(${netInfo.hostname})와 일치하는 미해결 티켓(${primary.errorCode})을 감지해 해결 마법사를 자동 열었습니다.`,
      'success'
    );
  }, [
    troubleshootMatch.primaryTicket,
    troubleshootWizardOpen,
    progressJob.isOpen,
    diagOpen,
    updateModalOpen,
    locationModalOpen,
    preflightModalOpen,
    isRefreshingTab,
    isHostExecuting,
    isClientConnecting,
    netInfo.hostname,
    appendLog,
  ]);

  const captureTroubleshootFailure = useCallback(
    async (params: {
      originRole: RoleMode;
      netInfoSnap: LocalNetworkInfo;
      errorMessage: string;
      targetHost?: string;
      shareName?: string;
      folderPath?: string;
      driveLetter?: string;
      authMode: 'guest' | 'account';
      isLegacyOs?: boolean;
    }) => {
      try {
        const saved = await shareBridge.recordTroubleshootError({
          originRole: params.originRole,
          netInfo: params.netInfoSnap,
          errorMessage: params.errorMessage,
          targetHost: params.targetHost,
          shareName: params.shareName,
          folderPath: params.folderPath,
          driveLetter: params.driveLetter,
          authMode: params.authMode,
          isLegacyOs: params.isLegacyOs,
          portableShares: portableSharesRef.current,
          hostPolicySnapshots,
          peers: peersRef.current,
          activeShares: sharesRef.current,
          localMachineSidPrefix: policyStatus?.machineSidPrefix,
          duplicateSidEvent6167Detected: policyStatus?.duplicateSidEvent6167Detected,
        });
        createdInSessionTicketIdsRef.current.add(saved.ticket.ticketId);
        setTroubleshootTickets(saved.tickets);
        setSelectedTroubleshootTicketId(saved.ticket.ticketId);
        refreshPortableSnapshot(params.netInfoSnap.hostname);
        appendLog(
          'USB 오류 티켓',
          saved.portableStatus.writable
            ? `오류 티켓(${saved.ticket.errorCode} · ${saved.ticket.shareName})을 USB 포터블 파일에 저장했습니다.`
            : `오류 티켓(${saved.ticket.errorCode})을 세션에 기록했습니다 (USB 읽기 전용).`,
          'success'
        );
      } catch {}
    },
    [
      hostPolicySnapshots,
      policyStatus?.machineSidPrefix,
      policyStatus?.duplicateSidEvent6167Detected,
      refreshPortableSnapshot,
      appendLog,
    ]
  );

  const handleOpenTroubleshootWizard = useCallback(
    (ticketId?: string) => {
      const targetId =
        ticketId ||
        troubleshootMatch.primaryTicket?.ticketId ||
        troubleshootTickets[0]?.ticketId ||
        null;
      setSelectedTroubleshootTicketId(targetId);
      setTroubleshootWizardOpen(true);
    },
    [troubleshootMatch.primaryTicket, troubleshootTickets]
  );

  const handleExecuteTroubleshootStep = useCallback(
    async (
      ticket: TroubleshootTicket,
      step: TroubleshootWizardStep
    ): Promise<{ success: boolean; message: string }> => {
      let ok = false;
      let message = '';
      let resolvedImmediately = false;
      let nextDriveLetter = ticket.driveLetter;
      let nextAuthModeOverride: 'guest' | 'account' | undefined;
      let shouldReclassifyOnRetryFailure = false;
      let stepRequiresReboot = Boolean(step.requiresReboot);
      let latestPolicyForSync: OsNetworkPolicyStatus | null = null;

      try {
        if (
          step.executor === 'apply_safe_compat' ||
          step.executor === 'apply_legacy_bridge' ||
          step.executor === 'enable_smbv1_client'
        ) {
          const mode: PolicyPatchMode =
            step.patchMode ||
            (step.executor === 'apply_legacy_bridge'
              ? 'legacy_bridge_compat'
              : step.executor === 'enable_smbv1_client'
                ? 'enable_smbv1_client'
                : 'safe_compat');
          const res = await shareBridge.applyOsCompatibilityPatch(mode, netInfo);
          setLastPatchResult(res);
          setPolicyStatus(res.updatedPolicy);
          setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
          latestPolicyForSync = res.updatedPolicy;
          stepRequiresReboot = stepRequiresReboot || res.rebootJudgment.rebootRecommended;
          ok = res.success;
          message = `${res.summary} (${res.rebootJudgment.title})`;
        } else if (step.executor === 'host_guest_unlock_and_reopen') {
          const res = await shareBridge.runHostGuestUnlockDirect(ticket.shareName, netInfo);
          if (res.updatedPolicy) {
            latestPolicyForSync = res.updatedPolicy;
            setPolicyStatus(res.updatedPolicy);
            setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
            if (res.success) {
              setLastPatchResult({
                success: true,
                mode: 'safe_compat',
                summary: res.message,
                appliedActions: [res.message],
                rebootJudgment: evaluateRebootJudgment({
                  mode: 'safe_compat',
                  restartedServices: ['LanmanServer'],
                  priorPendingReboot: res.updatedPolicy.pendingRebootFlag,
                }),
                updatedPolicy: res.updatedPolicy,
              });
            }
          }
          ok = res.success;
          message = res.message;
        } else if (step.executor === 'clear_conflicting_sessions') {
          const res = await shareBridge.clearConflictingSmbSessions(ticket.targetIp || ticket.targetHostName);
          ok = res.success;
          message = res.message;
        } else if (step.executor === 'verify_port_445') {
          const pingTarget = ticket.targetIp || ticket.targetHostName || netInfo.primaryIp;
          const pingRes = await shareBridge.pingHost(pingTarget);
          ok = pingRes.reachable && pingRes.smbPortOpen;
          message = pingRes.detail;
        } else if (step.executor === 'switch_to_account_mode') {
          const targetHost = ticket.targetIp || ticket.targetHostName || clientDraftRef.current.targetHost;
          const shareLower = ticket.shareName.trim().toLowerCase();
          const targetLower = targetHost.trim().toLowerCase();
          const matchedPortable = portableSharesRef.current.find(
            (ps) =>
              ps.shareName.trim().toLowerCase() === shareLower &&
              (!targetLower ||
                (ps.sourceIp || '').trim().toLowerCase() === targetLower ||
                (ps.sourceHostName || '').trim().toLowerCase() === targetLower)
          );
          const recoveredUser =
            matchedPortable?.username || clientDraftRef.current.username.trim() || 'AhBiShare';
          const recoveredPass =
            clientDraftRef.current.password ||
            matchedPortable?.password ||
            shareBridge.getCachedSharePassword([targetHost, ticket.targetHostName || ''], ticket.shareName) ||
            '';
          setClientDraft((prev) => ({
            ...prev,
            targetHost,
            shareName: ticket.shareName || prev.shareName,
            authMode: 'account',
            username: recoveredUser,
            ...(recoveredPass ? { password: recoveredPass } : {}),
          }));
          setPendingClientAuthMode({
            key: `wizard-acc-${Date.now()}`,
            authMode: 'account',
            switchedFrom: ticket.authMode,
            targetHost,
            shareName: ticket.shareName,
          });
          nextAuthModeOverride = 'account';
          setRoleMode('client');
          setActiveSection('workspace');
          ok = true;
          message = recoveredPass
            ? '클라이언트 인증 모드를 보안 계정 모드로 전환하고 USB 저장 자격 증명을 불러왔습니다.'
            : '클라이언트 인증 모드를 보안 계정 모드로 전환했습니다. 계정·암호 확인 후 재연결하세요.';
        } else if (step.executor === 'reassign_free_drive') {
          const usedSet = new Set(mounts.map((m) => m.driveLetter.toUpperCase()));
          const currentDl = (ticket.driveLetter || clientDraftRef.current.driveLetter || 'Z:').toUpperCase();
          const candidates = ['Z:', 'Y:', 'X:', 'W:', 'V:', 'S:', 'M:', 'N:', 'P:'];
          const freeDrive = candidates.find((d) => !usedSet.has(d) && d !== currentDl) || candidates.find((d) => !usedSet.has(d)) || 'Y:';
          nextDriveLetter = freeDrive;
          setClientDraft((prev) => ({ ...prev, driveLetter: freeDrive }));
          ok = true;
          message = `사용 가능한 빈 드라이브 문자(${freeDrive})로 자동 변경했습니다.`;
        } else if (step.executor === 'retry_mount') {
          const latestDraft = clientDraftRef.current;
          const targetHost = ticket.targetIp || ticket.targetHostName || latestDraft.targetHost;
          const sameEndpoint =
            latestDraft.targetHost.trim().toLowerCase() === targetHost.trim().toLowerCase() &&
            latestDraft.shareName.trim().toLowerCase() === ticket.shareName.trim().toLowerCase();
          const shareLower = ticket.shareName.trim().toLowerCase();
          const targetLower = targetHost.trim().toLowerCase();
          const hostLower = (ticket.targetHostName || '').trim().toLowerCase();
          const matchedPortable = portableSharesRef.current.find(
            (ps) =>
              ps.shareName.trim().toLowerCase() === shareLower &&
              ((targetLower && (ps.sourceIp || '').trim().toLowerCase() === targetLower) ||
                (hostLower && (ps.sourceHostName || '').trim().toLowerCase() === hostLower) ||
                (!targetLower && !hostLower))
          );

          let authModeToUse = sameEndpoint ? latestDraft.authMode : ticket.authMode;
          let passToUse =
            (sameEndpoint ? latestDraft.password : '') ||
            matchedPortable?.password ||
            shareBridge.getCachedSharePassword([targetHost, ticket.targetHostName || ''], ticket.shareName) ||
            latestDraft.password ||
            '';
          let userToUse =
            (sameEndpoint ? latestDraft.username : '') ||
            matchedPortable?.username ||
            latestDraft.username ||
            'AhBiShare';

          const isHostUnlocked =
            ticket.hostSteps.some((s) => s.executor === 'host_guest_unlock_and_reopen' && s.status === 'completed');

          if (!isHostUnlocked && authModeToUse === 'guest' && matchedPortable?.authMode === 'account' && matchedPortable.password) {
            authModeToUse = 'account';
            passToUse = matchedPortable.password;
            userToUse = matchedPortable.username || userToUse;
            nextAuthModeOverride = 'account';
          } else if (isHostUnlocked && authModeToUse === 'account' && !passToUse) {
            authModeToUse = 'guest';
          }

          if (authModeToUse === 'account' && !passToUse) {
            ok = false;
            message = '보안 계정 모드에서는 비밀번호가 필수입니다. 암호를 입력하거나 Guest 모드로 전환하세요.';
          } else {
            const resolvedWizardAlias = (ticket.targetHostName || matchedPortable?.sourceHostName || '').trim();
            const mountCfg: ClientTargetConfig = {
              targetHost,
              ...(resolvedWizardAlias && resolvedWizardAlias.toLowerCase() !== targetHost.trim().toLowerCase()
                ? { targetHostName: resolvedWizardAlias }
                : {}),
              shareName: ticket.shareName,
              driveLetter: nextDriveLetter || (sameEndpoint ? latestDraft.driveLetter : 'Z:'),
              authMode: authModeToUse,
              username: authModeToUse === 'account' ? userToUse : '',
              password: authModeToUse === 'account' ? passToUse : '',
              persistent: latestDraft.persistent,
            };
            const mountRes = await shareBridge.runClientOneClick(
              mountCfg,
              (steps) => setClientSteps(steps),
              netInfo.osEra
            );
            if (mountRes.success && mountRes.mount) {
              setMounts(shareBridge.getSavedMounts());
              try {
                latestPolicyForSync = await shareBridge.inspectOsNetworkPolicy(netInfo);
                setPolicyStatus(latestPolicyForSync);
              } catch {}
              ok = true;
              resolvedImmediately = true;
              message = `${mountRes.mount.uncPath} → ${mountRes.mount.driveLetter} 재연결 성공`;
            } else {
              const failedStep = mountRes.steps.find((s) => s.status === 'error');
              ok = false;
              shouldReclassifyOnRetryFailure = true;
              message = failedStep?.error || '네트워크 드라이브 재연결에 실패했습니다.';
            }
          }
        } else if (step.executor === 'retry_host_share') {
          const shareLower = ticket.shareName.trim().toLowerCase();
          const matchedExistingShare = sharesRef.current.find((s) => s.shareName.trim().toLowerCase() === shareLower);
          const matchedPortable = portableSharesRef.current.find(
            (ps) =>
              ps.shareName.trim().toLowerCase() === shareLower &&
              ((ps.sourceHostName || '').trim().toLowerCase() === netInfo.hostname.trim().toLowerCase() ||
                (Boolean(netInfo.primaryIp) && (ps.sourceIp || '').trim() === netInfo.primaryIp.trim()))
          );
          const hostUnlockedByWizard = ticket.hostSteps.some(
            (s) => s.executor === 'host_guest_unlock_and_reopen' && s.status === 'completed'
          );
          const sameDraft = hostDraft.shareName.trim().toLowerCase() === shareLower;
          const effectiveAuthMode: 'guest' | 'account' = hostUnlockedByWizard
            ? 'guest'
            : matchedExistingShare?.authMode || ticket.authMode;
          const preservedPassword =
            (sameDraft ? hostDraft.password : '') ||
            matchedPortable?.password ||
            shareBridge.getCachedSharePassword(
              [netInfo.hostname, netInfo.primaryIp, ticket.targetHostName, ticket.targetIp || ''],
              ticket.shareName
            ) ||
            hostDraft.password ||
            generateSecureSharePassword(10);

          if (!hostUnlockedByWizard && effectiveAuthMode === 'account' && ticket.authMode === 'guest') {
            nextAuthModeOverride = 'account';
          }

          const hostCfg: HostConfig = {
            folderPath: ticket.folderPath || matchedExistingShare?.folderPath || (sameDraft ? hostDraft.folderPath : 'C:\\AhBiShared'),
            shareName: ticket.shareName,
            authMode: effectiveAuthMode,
            permission: matchedExistingShare?.permission || (sameDraft ? hostDraft.permission : 'full'),
            username: matchedExistingShare?.username || matchedPortable?.username || hostDraft.username || 'AhBiShare',
            password: preservedPassword,
            ttlMinutes: sameDraft ? hostDraft.ttlMinutes : 0,
            autoRevokeOnExpiry: sameDraft ? hostDraft.autoRevokeOnExpiry : true,
          };
          const shareRes = await shareBridge.runHostOneClick(
            hostCfg,
            netInfo,
            (steps) => setHostSteps(steps)
          );
          if (shareRes.success && shareRes.share) {
            setShares(shareBridge.getSavedShares());
            try {
              latestPolicyForSync = await shareBridge.inspectOsNetworkPolicy(netInfo);
              setPolicyStatus(latestPolicyForSync);
            } catch {}
            ok = true;
            if (ticket.originRole === 'host') resolvedImmediately = true;
            message =
              effectiveAuthMode === 'account' && ticket.authMode === 'guest'
                ? `'${shareRes.share.shareName}' 보안 계정(${hostCfg.username}) 공유 재확인 및 USB 암호화 자격 증명 동기화 완료`
                : `'${shareRes.share.shareName}' 공유폴더 재개설(${effectiveAuthMode === 'guest' ? 'Guest' : '보안 계정'}) 및 USB 동기화 완료`;
          } else {
            const failedStep = shareRes.steps.find((s) => s.status === 'error');
            ok = false;
            message = failedStep?.error || '호스트 공유폴더 재개설에 실패했습니다.';
          }
        } else {
          ok = true;
          message = '수동 확인 완료로 표시했습니다.';
        }
      } catch (err) {
        ok = false;
        message = err instanceof Error ? err.message : '단계 실행 중 예외가 발생했습니다.';
      }

      const nowIso = new Date().toISOString();
      const updateStepArr = (arr: TroubleshootWizardStep[]) =>
        arr.map((item) => {
          if (item.stepId === step.stepId) {
            return {
              ...item,
              status: ok ? ('completed' as const) : ('failed' as const),
              ...(ok ? { resolvedSource: 'wizard' as const } : { resolvedSource: undefined }),
              ...(stepRequiresReboot ? { requiresReboot: true } : {}),
              lastAttemptAt: nowIso,
              lastMessage: message,
            };
          }
          if (resolvedImmediately && item.status === 'pending') {
            return {
              ...item,
              status: 'skipped' as const,
              lastAttemptAt: nowIso,
              lastMessage: '재연결 성공으로 후속/대체 단계 건너뜀',
            };
          }
          return item;
        });

      const updatedBase: TroubleshootTicket = {
        ...ticket,
        ...(nextDriveLetter ? { driveLetter: nextDriveLetter } : {}),
        ...(nextAuthModeOverride ? { authMode: nextAuthModeOverride } : {}),
        hostSteps: updateStepArr(ticket.hostSteps),
        clientSteps: updateStepArr(ticket.clientSteps),
      };

      let recomputed = recomputeTroubleshootTicketStatus(updatedBase, netInfo.hostname);
      if (!ok && shouldReclassifyOnRetryFailure) {
        recomputed = reclassifyTroubleshootTicketOnRetryFailure(recomputed, message, {
          netInfo,
          portableShares: portableSharesRef.current,
          hostPolicySnapshots,
          effectiveAuthMode: nextAuthModeOverride,
          localMachineSidPrefix: policyStatus?.machineSidPrefix,
          duplicateSidEvent6167Detected: policyStatus?.duplicateSidEvent6167Detected,
        });
      }
      if (resolvedImmediately) {
        recomputed = {
          ...recomputed,
          status: 'resolved',
          resolvedAt: recomputed.resolvedAt || nowIso,
          resolvedByHostName: netInfo.hostname,
          updatedAt: nowIso,
        };
      }

      const saved = await shareBridge.updateTroubleshootTicket(recomputed);
      setTroubleshootTickets(saved.tickets);
      if (latestPolicyForSync) {
        try {
          const pendingSync = await shareBridge.reconcilePendingHostActionsWithLocalPolicy(
            netInfo,
            latestPolicyForSync
          );
          setPendingHostActions(pendingSync.pendingHostActions);
        } catch {}
      }
      setHostPolicySnapshots(shareBridge.getHostPolicySnapshots());
      refreshPortableSnapshot(netInfo.hostname);
      appendLog('USB 오류 마법사', `[${step.title}] ${message}`, ok ? 'success' : 'error');
      showToast(message);
      return { success: ok, message };
    },
    [
      netInfo,
      mounts,
      hostDraft,
      hostPolicySnapshots,
      policyStatus?.machineSidPrefix,
      policyStatus?.duplicateSidEvent6167Detected,
      refreshPortableSnapshot,
      appendLog,
      showToast,
    ]
  );

  const handleSkipTroubleshootStep = useCallback(
    async (ticket: TroubleshootTicket, step: TroubleshootWizardStep) => {
      const nowIso = new Date().toISOString();
      const skipArr = (arr: TroubleshootWizardStep[]) =>
        arr.map((item) =>
          item.stepId === step.stepId
            ? {
                ...item,
                status: 'skipped' as const,
                lastAttemptAt: nowIso,
                lastMessage: '사용자 건너뛰기 선택',
              }
            : item
        );
      const updated = recomputeTroubleshootTicketStatus(
        {
          ...ticket,
          hostSteps: skipArr(ticket.hostSteps),
          clientSteps: skipArr(ticket.clientSteps),
        },
        netInfo.hostname
      );
      const saved = await shareBridge.updateTroubleshootTicket(updated);
      setTroubleshootTickets(saved.tickets);
      refreshPortableSnapshot(netInfo.hostname);
    },
    [netInfo.hostname, refreshPortableSnapshot]
  );

  const handleVerifyTroubleshootTarget = useCallback(
    async (ticket: TroubleshootTicket) => {
      const target = ticket.targetIp || ticket.targetHostName || netInfo.primaryIp;
      const res = await shareBridge.pingHost(target);
      appendLog('USB 오류 마법사', `445 도달성 점검 (${target}): ${res.detail}`, res.reachable && res.smbPortOpen ? 'success' : 'error');
      return {
        reachable: res.reachable,
        smbPortOpen: res.smbPortOpen,
        detail: res.detail,
      };
    },
    [netInfo.primaryIp, appendLog]
  );

  const handleMarkTroubleshootResolved = useCallback(
    async (ticket: TroubleshootTicket) => {
      const nowIso = new Date().toISOString();
      const updated: TroubleshootTicket = {
        ...ticket,
        status: 'resolved',
        resolvedAt: nowIso,
        resolvedByHostName: netInfo.hostname,
        updatedAt: nowIso,
      };
      const saved = await shareBridge.updateTroubleshootTicket(updated);
      setTroubleshootTickets(saved.tickets);
      refreshPortableSnapshot(netInfo.hostname);
      appendLog('USB 오류 마법사', `티켓(${ticket.errorCode})을 해결 완료 상태로 표시했습니다.`, 'success');
      showToast('해결 완료로 표시했습니다. 이력 정리 전까지 USB에 안전하게 보존됩니다.');
    },
    [netInfo.hostname, refreshPortableSnapshot, appendLog, showToast]
  );

  const handleDeleteTroubleshootTicket = useCallback(
    async (ticketId: string) => {
      const res = await shareBridge.deleteTroubleshootTicket(ticketId);
      setTroubleshootTickets(res.tickets);
      refreshPortableSnapshot(netInfo.hostname);
      if (selectedTroubleshootTicketId === ticketId) {
        setSelectedTroubleshootTicketId(res.tickets[0]?.ticketId || null);
      }
      if (res.tickets.length === 0) {
        setTroubleshootWizardOpen(false);
      }
      appendLog('USB 오류 마법사', '선택한 USB 오류 티켓을 삭제했습니다.', 'success');
      showToast('USB 오류 티켓을 삭제했습니다.');
    },
    [netInfo.hostname, selectedTroubleshootTicketId, refreshPortableSnapshot, appendLog, showToast]
  );

  const handleClearResolvedTroubleshootTickets = useCallback(async () => {
    const res = await shareBridge.clearResolvedTroubleshootTickets();
    setTroubleshootTickets(res.tickets);
    refreshPortableSnapshot(netInfo.hostname);
    if (res.tickets.length === 0) {
      setTroubleshootWizardOpen(false);
      setSelectedTroubleshootTicketId(null);
    } else if (selectedTroubleshootTicketId && !res.tickets.some((t) => t.ticketId === selectedTroubleshootTicketId)) {
      setSelectedTroubleshootTicketId(res.tickets[0].ticketId);
    }
    appendLog('USB 오류 마법사', `해결 완료된 티켓 ${res.removedCount}건을 정리했습니다.`, 'success');
    showToast(`해결 완료된 티켓 ${res.removedCount}건을 정리했습니다.`);
  }, [netInfo.hostname, selectedTroubleshootTicketId, refreshPortableSnapshot, appendLog, showToast]);

  const handleDeletePortableHostShare = useCallback(
    async (sourceHostName: string, shareName: string) => {
      try {
        await shareBridge.deletePortableHostShare(sourceHostName, shareName);
        refreshPortableSnapshot(netInfo.hostname);
        appendLog('USB 포터블', `${sourceHostName} · \\\\...\\${shareName} 항목을 목록에서 삭제했습니다.`, 'success');
        showToast(`포터블 공유 항목(${shareName})을 삭제했습니다.`);
      } catch {
        showToast('포터블 공유 항목 삭제 중 오류가 발생했습니다.');
      }
    },
    [netInfo.hostname, refreshPortableSnapshot, appendLog, showToast]
  );

  const handleTriggerReboot = useCallback(async () => {
    const res = await shareBridge.requestSystemReboot();
    appendLog('시스템 제어', res.message, res.success ? 'success' : 'error');
    showToast(res.message);
    return res;
  }, [appendLog, showToast]);

  const handleOpenWindowsUpdate = useCallback(async () => {
    const res = await shareBridge.openWindowsUpdateSettings();
    appendLog('Windows Update', res.message, res.success ? 'success' : 'error');
    showToast(res.message);
  }, [appendLog, showToast]);

  const handleExportLegacyBundle = useCallback(
    async (bundle: LegacyScriptBundle) => {
      const res = await shareBridge.exportLegacyScriptBundle(bundle);
      appendLog('구형 OS 스크립트', res.message, res.success ? 'success' : 'error');
      return res;
    },
    [appendLog]
  );

  const handleBridgeImported = useCallback(async () => {
    setShares(shareBridge.getSavedShares());
    setMounts(shareBridge.getSavedMounts());
    refreshPortableSnapshot(netInfo.hostname);
    appendLog('교차 OS 브릿지', 'Win 10/11 ↔ Win 7/8 양방향 설정 데이터 동기화 완료', 'success');
  }, [appendLog, netInfo.hostname, refreshPortableSnapshot]);

  const handleNavigate = (section: AppSection, role?: RoleMode) => {
    setActiveSection(section);
    if (role) setRoleMode(role);
  };

  const handleCreateShare = async (config: HostConfig) => {
    const shareLabel = config.shareName.trim() || 'AhBiShared';
    const folderLabel = config.folderPath.trim() || 'C:\\AhBiShared';
    const jobKey = startProgressJob(
      '공유폴더 원클릭 개설',
      `${folderLabel} → ${shareLabel} (${config.authMode === 'guest' ? '무비밀번호 Guest' : '보안 계정'})`,
      [
        {
          id: 'host-prep',
          title: '로컬 네트워크·권한 확인 및 파이프라인 준비',
          detail: '현재 호스트 IP, 어댑터 및 관리자 권한 상태를 확인합니다.',
          status: 'running',
        },
      ]
    );
    if (!jobKey) return;

    setIsHostExecuting(true);
    let latestSteps: PipelineStep[] = [];
    try {
      const freshNet = await shareBridge.getLocalNetworkInfo();
      setNetInfo(freshNet);
      const res = await shareBridge.runHostOneClick(config, freshNet, (steps) => {
        latestSteps = steps;
        setHostSteps(steps);
        updateProgressSteps(jobKey, steps);
      });
      if (res.success && res.share) {
        const createdLower = res.share.shareName.toLowerCase();
        setExpiryAlerts((prev) => prev.filter((a) => a.shareName.toLowerCase() !== createdLower));
        const savedSharesNow = shareBridge.getSavedShares();
        setShares(savedSharesNow);
        let latestPol: OsNetworkPolicyStatus | null = policyStatus;
        try {
          latestPol = await shareBridge.inspectOsNetworkPolicy(freshNet);
          setPolicyStatus(latestPol);
        } catch {}
        await syncAllMatrixAndWizardState({
          netInfoSnap: freshNet,
          policy: latestPol,
          localShares: savedSharesNow,
          source: 'share_retry',
          justCreatedShareNames: [res.share.shareName],
        });
        try {
          const updatedPeers = await shareBridge.scanLanPeers(freshNet);
          setPeers(updatedPeers);
        } catch {}
        const syncNote =
          res.portableStatus && !res.portableStatus.writable
            ? ' (주의: USB 폴더가 읽기 전용이라 파일에 저장되지 않았습니다)'
            : ' · USB 포터블 파일 자동 동기화 완료';
        appendLog('메인 PC', `공유폴더(${res.share.shareName}) 개설 및 연결 코드 생성 완료${syncNote}`, 'success');
        showToast(
          res.portableStatus && !res.portableStatus.writable
            ? `'${res.share.shareName}' 개설 완료 (USB 읽기 전용으로 파일 동기화 건너뜀)`
            : `공유폴더 '${res.share.shareName}' 개설 및 USB 포터블 파일 저장이 완료되었습니다.`
        );
        completeProgressJob(jobKey, `공유폴더 '${res.share.shareName}' 개설 완료 (${res.share.uncPath})`, res.steps);
      } else {
        const failedStep = res.steps.find((s) => s.status === 'error');
        const errMsg = failedStep?.error || '공유폴더 구성 중 일부 단계에서 오류가 발생했습니다.';
        appendLog('메인 PC', `공유폴더(${config.shareName}) 구성 중 오류가 발생했습니다.`, 'error');
        showToast('공유폴더 구성 중 일부 단계에서 오류가 발생했습니다.');
        void captureTroubleshootFailure({
          originRole: 'host',
          netInfoSnap: freshNet,
          errorMessage: errMsg,
          shareName: config.shareName,
          folderPath: config.folderPath,
          authMode: config.authMode,
        });
        failProgressJob(jobKey, errMsg, res.steps);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      appendLog('메인 PC', `공유폴더 구성 예외: ${msg}`, 'error');
      showToast('공유폴더 구성 중 예외가 발생했습니다.');
      void captureTroubleshootFailure({
        originRole: 'host',
        netInfoSnap: netInfo,
        errorMessage: msg,
        shareName: config.shareName,
        folderPath: config.folderPath,
        authMode: config.authMode,
      });
      failProgressJob(jobKey, msg, latestSteps);
    } finally {
      setIsHostExecuting(false);
    }
  };

  const handleRemoveShare = async (shareName: string) => {
    const step1: PipelineStep = {
      id: 'rm-share',
      title: `SMB 공유 '${shareName}' 해제 실행`,
      detail: 'Windows 공유 목록에서 해당 공유 리소스를 제거합니다.',
      status: 'running',
    };
    const step2: PipelineStep = {
      id: 'rm-sync',
      title: 'USB 포터블 기록 및 LAN 피어 목록 갱신',
      detail: '활성 공유 목록과 포터블 설정 파일을 동기화합니다.',
      status: 'idle',
    };
    const jobKey = startProgressJob('공유폴더 공유 해제', shareName, [step1, step2]);
    if (!jobKey) return;

    const t0 = performance.now();
    try {
      const updated = await shareBridge.removeHostShare(shareName, netInfo);
      const rmDuration = Math.round(performance.now() - t0);
      updateProgressSteps(jobKey, [
        { ...step1, status: 'success', durationMs: rmDuration },
        { ...step2, status: 'running' },
      ]);

      const t1 = performance.now();
      const removedLower = shareName.toLowerCase();
      setExpiryAlerts((prev) => prev.filter((a) => a.shareName.toLowerCase() !== removedLower));
      setShares(updated);
      refreshPortableSnapshot(netInfo.hostname);
      try {
        const updatedPeers = await shareBridge.scanLanPeers(netInfo);
        setPeers(updatedPeers);
      } catch {}
      appendLog('메인 PC', `공유폴더 '${shareName}' 공유 해제 및 USB 포터블 기록 갱신`, 'success');
      showToast(`'${shareName}' 공유가 해제되었습니다.`);
      completeProgressJob(jobKey, `'${shareName}' 공유폴더가 정상적으로 해제되었습니다.`, [
        { ...step1, status: 'success', durationMs: rmDuration },
        { ...step2, status: 'success', durationMs: Math.round(performance.now() - t1) },
      ]);
    } catch (err) {
      const reason = err instanceof Error ? err.message : '알 수 없는 오류';
      appendLog('메인 PC', `공유폴더 '${shareName}' 해제 실패: ${reason}`, 'error');
      showToast(`'${shareName}' 공유 해제 실패: ${reason}`);
      failProgressJob(jobKey, reason, [
        { ...step1, status: 'error', durationMs: Math.round(performance.now() - t0), error: reason },
        step2,
      ]);
    }
  };

  const handleScanLan = async () => {
    if (refreshTabInFlightRef.current) return;
    setIsScanning(true);
    try {
      const freshNet = await shareBridge.getLocalNetworkInfo();
      setNetInfo(freshNet);
      const found = await shareBridge.scanLanPeers(freshNet);
      setPeers(found);
      appendLog('클라이언트 PC', `LAN 탐색 완료 (${found.length}대 호스트 발견)`, 'success');
    } catch (err) {
      const reason = err instanceof Error ? err.message : '알 수 없는 오류';
      appendLog('클라이언트 PC', `LAN 탐색 실패: ${reason}`, 'error');
      showToast('LAN 탐색 중 오류가 발생했습니다.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectClient = async (config: ClientTargetConfig) => {
    const jobKey = startProgressJob(
      '네트워크 드라이브 원클릭 연결',
      `\\\\${config.targetHost.trim()}\\${config.shareName.trim()} → ${config.driveLetter}`,
      [
        {
          id: 'cli-prep',
          title: '클라이언트 네트워크·자격 증명 파이프라인 초기화',
          detail: '대상 호스트 연결 단계 구성을 준비합니다.',
          status: 'running',
        },
      ]
    );
    if (!jobKey) return;

    setIsClientConnecting(true);
    let latestSteps: PipelineStep[] = [];
    try {
      const rawTgtLower = config.targetHost.trim().toLowerCase();
      const matchedPeerHost = peersRef.current.find(
        (p) => p.ipAddress.trim().toLowerCase() === rawTgtLower || p.hostName.trim().toLowerCase() === rawTgtLower
      )?.hostName;
      const matchedPortableHost = portableSharesRef.current.find(
        (s) =>
          (s.sourceIp || '').trim().toLowerCase() === rawTgtLower ||
          (s.sourceHostName || '').trim().toLowerCase() === rawTgtLower
      )?.sourceHostName;
      const matchedSnapHost = Object.values(hostPolicySnapshots).find(
        (h) =>
          (h.sourceIp || '').trim().toLowerCase() === rawTgtLower ||
          h.hostName.trim().toLowerCase() === rawTgtLower
      )?.hostName;
      const resolvedHostAlias = (
        config.targetHostName ||
        matchedPeerHost ||
        matchedPortableHost ||
        matchedSnapHost ||
        ''
      ).trim();
      const enrichedConfig: ClientTargetConfig =
        resolvedHostAlias && resolvedHostAlias.toLowerCase() !== rawTgtLower
          ? { ...config, targetHostName: resolvedHostAlias }
          : config;

      const res = await shareBridge.runClientOneClick(
        enrichedConfig,
        (steps) => {
          latestSteps = steps;
          setClientSteps(steps);
          updateProgressSteps(jobKey, steps);
        },
        netInfo.osEra
      );
      if (res.success && res.mount) {
        const savedMountsNow = shareBridge.getSavedMounts();
        setMounts(savedMountsNow);
        let latestPol: OsNetworkPolicyStatus | null = policyStatus;
        try {
          latestPol = await shareBridge.inspectOsNetworkPolicy(netInfo);
          setPolicyStatus(latestPol);
        } catch {}
        await syncAllMatrixAndWizardState({
          netInfoSnap: netInfo,
          policy: latestPol,
          localMounts: savedMountsNow,
          source: 'mount_retry',
          justMountedTargets: [{ targetHost: config.targetHost, shareName: config.shareName }],
        });
        appendLog('클라이언트 PC', `${res.mount.uncPath} → ${res.mount.driveLetter} 연결 완료`, 'success');
        showToast(`${res.mount.driveLetter} 드라이브가 성공적으로 연결되었습니다.`);
        completeProgressJob(
          jobKey,
          `${res.mount.uncPath} → ${res.mount.driveLetter} 드라이브 연결 완료`,
          res.steps
        );
      } else {
        const failedStep = res.steps.find((s) => s.status === 'error');
        const errMsg = failedStep?.error || '네트워크 드라이브 연결에 실패했습니다. 원인 안내를 확인하세요.';
        appendLog('클라이언트 PC', `\\\\${config.targetHost}\\${config.shareName} 연결 실패`, 'error');
        showToast('연결에 실패했습니다. 파이프라인 단계 오류를 확인하세요.');
        void captureTroubleshootFailure({
          originRole: 'client',
          netInfoSnap: netInfo,
          errorMessage: errMsg,
          targetHost: config.targetHost,
          shareName: config.shareName,
          driveLetter: config.driveLetter,
          authMode: config.authMode,
        });
        failProgressJob(jobKey, errMsg, res.steps);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      appendLog('클라이언트 PC', `연결 예외: ${msg}`, 'error');
      showToast('연결 실행 중 예외가 발생했습니다.');
      void captureTroubleshootFailure({
        originRole: 'client',
        netInfoSnap: netInfo,
        errorMessage: msg,
        targetHost: config.targetHost,
        shareName: config.shareName,
        driveLetter: config.driveLetter,
        authMode: config.authMode,
      });
      failProgressJob(jobKey, msg, latestSteps);
    } finally {
      setIsClientConnecting(false);
    }
  };

  const handleCreateLegacyHostShare = async (config: HostConfig, targetOs: LegacyTargetOs) => {
    const osTag = targetOs === 'win7' ? 'Win 7(SMB 2.1)' : 'Win 8/8.1(SMB 3.0)';
    const bridgeStepId = 'legacy-bridge-host';
    const initialBridgeStep: PipelineStep = {
      id: bridgeStepId,
      title: `${osTag} 호환 브릿지 정책 정렬 및 사전 스냅샷 백업`,
      detail: 'SMB 비암호화 접근 허용 · 서명 완화 · NTLMv2 고정 · 스냅샷 저장',
      status: 'running',
    };
    const jobKey = startProgressJob(
      `구형 OS 메인 공유 개설 (${osTag})`,
      `${config.folderPath || 'C:\\AhBiShared'} → ${config.shareName || 'AhBiShared'}`,
      [initialBridgeStep]
    );
    if (!jobKey) return;

    setIsHostExecuting(true);
    setLegacyHostSteps([initialBridgeStep]);
    let latestSteps: PipelineStep[] = [initialBridgeStep];

    try {
      const freshNet = await shareBridge.getLocalNetworkInfo();
      setNetInfo(freshNet);
      const t0 = performance.now();
      const bridgeRes = await shareBridge.applyOsCompatibilityPatch('legacy_bridge_compat', freshNet);
      const bridgeStep: PipelineStep = {
        id: bridgeStepId,
        title: `${osTag} 호환 브릿지 정책 정렬 및 사전 스냅샷 백업`,
        detail: bridgeRes.summary,
        status: bridgeRes.success ? 'success' : 'error',
        durationMs: Math.round(performance.now() - t0),
        output: bridgeRes.success ? bridgeRes.rebootJudgment.title : undefined,
        error: bridgeRes.success ? undefined : bridgeRes.summary,
      };
      setLastPatchResult(bridgeRes);
      setPolicyStatus(bridgeRes.updatedPolicy);
      setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
      latestSteps = [bridgeStep];
      setLegacyHostSteps(latestSteps);
      updateProgressSteps(jobKey, latestSteps);

      if (!bridgeRes.success) {
        appendLog('구형 OS 메인', `브릿지 정책 적용 실패: ${bridgeRes.summary}`, 'error');
        showToast('구형 OS 호환 브릿지 적용에 실패했습니다.');
        void captureTroubleshootFailure({
          originRole: 'host',
          netInfoSnap: freshNet,
          errorMessage: bridgeRes.summary,
          shareName: config.shareName,
          folderPath: config.folderPath,
          authMode: config.authMode,
          isLegacyOs: true,
        });
        failProgressJob(jobKey, bridgeRes.summary, latestSteps);
        return;
      }

      const shareRes = await shareBridge.runHostOneClick(config, freshNet, (steps) => {
        latestSteps = [bridgeStep, ...steps];
        setHostSteps(steps);
        setLegacyHostSteps(latestSteps);
        updateProgressSteps(jobKey, latestSteps);
      });

      if (shareRes.success && shareRes.share) {
        const createdLower = shareRes.share.shareName.toLowerCase();
        setExpiryAlerts((prev) => prev.filter((a) => a.shareName.toLowerCase() !== createdLower));
        const savedSharesNow = shareBridge.getSavedShares();
        setShares(savedSharesNow);
        let latestPol: OsNetworkPolicyStatus | null = bridgeRes.updatedPolicy;
        try {
          latestPol = await shareBridge.inspectOsNetworkPolicy(freshNet);
          setPolicyStatus(latestPol);
        } catch {}
        await syncAllMatrixAndWizardState({
          netInfoSnap: freshNet,
          policy: latestPol,
          localShares: savedSharesNow,
          source: 'share_retry',
          justCreatedShareNames: [shareRes.share.shareName],
        });
        try {
          const updatedPeers = await shareBridge.scanLanPeers(freshNet);
          setPeers(updatedPeers);
        } catch {}
        const syncNote =
          shareRes.portableStatus && !shareRes.portableStatus.writable
            ? ' (주의: USB 폴더가 읽기 전용이라 파일에 저장되지 않았습니다)'
            : ' · USB 포터블 파일 자동 동기화 완료';
        appendLog(
          '구형 OS 메인',
          `${osTag} 브릿지 + 공유폴더(${shareRes.share.shareName}) 통합 원클릭 개설 완료${syncNote}`,
          'success'
        );
        showToast(
          shareRes.portableStatus && !shareRes.portableStatus.writable
            ? `${osTag} 호환 공유폴더 '${shareRes.share.shareName}' 개설 완료 (USB 읽기 전용으로 파일 동기화 건너뜀)`
            : `${osTag} 호환 공유폴더 '${shareRes.share.shareName}' 개설을 완료했습니다.`
        );
        completeProgressJob(
          jobKey,
          `${osTag} 호환 공유폴더 '${shareRes.share.shareName}' 통합 개설 완료`,
          [bridgeStep, ...shareRes.steps]
        );
      } else {
        const failedStep = shareRes.steps.find((s) => s.status === 'error');
        const errMsg = failedStep?.error || '공유폴더 개설 단계에서 오류가 발생했습니다.';
        appendLog('구형 OS 메인', `공유폴더(${config.shareName}) 개설 중 오류 발생`, 'error');
        showToast('공유폴더 개설 단계에서 오류가 발생했습니다.');
        void captureTroubleshootFailure({
          originRole: 'host',
          netInfoSnap: freshNet,
          errorMessage: errMsg,
          shareName: config.shareName,
          folderPath: config.folderPath,
          authMode: config.authMode,
          isLegacyOs: true,
        });
        failProgressJob(jobKey, errMsg, [bridgeStep, ...shareRes.steps]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      const errSteps = latestSteps.map((s) => (s.status === 'running' ? { ...s, status: 'error' as const, error: msg } : s));
      setLegacyHostSteps(errSteps);
      appendLog('구형 OS 메인', `통합 개설 예외: ${msg}`, 'error');
      showToast(`구형 OS 메인 개설 실패: ${msg}`);
      void captureTroubleshootFailure({
        originRole: 'host',
        netInfoSnap: netInfo,
        errorMessage: msg,
        shareName: config.shareName,
        folderPath: config.folderPath,
        authMode: config.authMode,
        isLegacyOs: true,
      });
      failProgressJob(jobKey, msg, errSteps);
    } finally {
      setIsHostExecuting(false);
    }
  };

  const handleConnectLegacyClient = async (config: ClientTargetConfig, targetOs: LegacyTargetOs) => {
    const osTag = targetOs === 'win7' ? 'Win 7(SMB 2.1)' : 'Win 8/8.1(SMB 3.0)';
    const isGuestClientMode = config.authMode === 'guest';
    const bridgeStepId = 'legacy-bridge-client';
    const initialBridgeStep: PipelineStep = {
      id: bridgeStepId,
      title: isGuestClientMode
        ? `${osTag} 호환 브릿지 정렬 및 사전 스냅샷 백업`
        : `${osTag} 보안 계정 클라이언트 스냅샷 백업 및 정책 준비`,
      detail: isGuestClientMode
        ? '게스트 로그온 허용 · 서명 완화 · NTLMv2 고정 · 스냅샷 저장'
        : '사전 스냅샷 저장 · 보안 계정 모드(로컬 Guest 계정 개방 생략)',
      status: 'running',
    };
    const jobKey = startProgressJob(
      `구형 OS 클라이언트 연결 (${osTag})`,
      `\\\\${config.targetHost.trim()}\\${config.shareName.trim()} → ${config.driveLetter}`,
      [initialBridgeStep]
    );
    if (!jobKey) return;

    setIsClientConnecting(true);
    setLegacyClientSteps([initialBridgeStep]);
    let latestSteps: PipelineStep[] = [initialBridgeStep];

    try {
      const freshNet = await shareBridge.getLocalNetworkInfo();
      setNetInfo(freshNet);
      const t0 = performance.now();
      let bridgeStep: PipelineStep;

      if (isGuestClientMode) {
        const bridgeRes = await shareBridge.applyOsCompatibilityPatch('legacy_bridge_compat', freshNet);
        bridgeStep = {
          id: bridgeStepId,
          title: initialBridgeStep.title,
          detail: bridgeRes.summary,
          status: bridgeRes.success ? 'success' : 'error',
          durationMs: Math.round(performance.now() - t0),
          output: bridgeRes.success ? bridgeRes.rebootJudgment.title : undefined,
          error: bridgeRes.success ? undefined : bridgeRes.summary,
        };
        setLastPatchResult(bridgeRes);
        setPolicyStatus(bridgeRes.updatedPolicy);
        setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
        latestSteps = [bridgeStep];
        setLegacyClientSteps(latestSteps);
        updateProgressSteps(jobKey, latestSteps);

        if (!bridgeRes.success) {
          appendLog('구형 OS 클라이언트', `브릿지 정렬 실패: ${bridgeRes.summary}`, 'error');
          showToast('구형 OS 호환 브릿지 정렬에 실패했습니다.');
          void captureTroubleshootFailure({
            originRole: 'client',
            netInfoSnap: freshNet,
            errorMessage: bridgeRes.summary,
            targetHost: config.targetHost,
            shareName: config.shareName,
            driveLetter: config.driveLetter,
            authMode: config.authMode,
            isLegacyOs: true,
          });
          failProgressJob(jobKey, bridgeRes.summary, latestSteps);
          return;
        }
      } else {
        const snap = await shareBridge.ensureLegacyRollbackSnapshot(freshNet);
        setLegacyRollbackSnapshot(snap);
        bridgeStep = {
          id: bridgeStepId,
          title: initialBridgeStep.title,
          detail: '원복 스냅샷을 저장했으며, 로컬 Guest(*-501) 개방 없이 클라이언트 서명·NTLMv2 정책만 정렬합니다.',
          status: 'success',
          durationMs: Math.round(performance.now() - t0),
          output: snap ? `스냅샷 저장 완료 (${snap.capturedAt})` : '보안 계정 모드 준비 완료',
        };
        latestSteps = [bridgeStep];
        setLegacyClientSteps(latestSteps);
        updateProgressSteps(jobKey, latestSteps);
      }

      const mountRes = await shareBridge.runClientOneClick(
        config,
        (steps) => {
          latestSteps = [bridgeStep, ...steps];
          setClientSteps(steps);
          setLegacyClientSteps(latestSteps);
          updateProgressSteps(jobKey, latestSteps);
        },
        freshNet.osEra
      );

      if (mountRes.success && mountRes.mount) {
        const savedMountsNow = shareBridge.getSavedMounts();
        setMounts(savedMountsNow);
        let latestPol: OsNetworkPolicyStatus | null = policyStatus;
        try {
          latestPol = await shareBridge.inspectOsNetworkPolicy(freshNet);
          setPolicyStatus(latestPol);
        } catch {}
        await syncAllMatrixAndWizardState({
          netInfoSnap: freshNet,
          policy: latestPol,
          localMounts: savedMountsNow,
          source: 'mount_retry',
          justMountedTargets: [{ targetHost: config.targetHost, shareName: config.shareName }],
        });
        appendLog(
          '구형 OS 클라이언트',
          `${osTag} 브릿지 + ${mountRes.mount.uncPath} → ${mountRes.mount.driveLetter} 통합 연결 완료`,
          'success'
        );
        showToast(`${mountRes.mount.driveLetter} 드라이브가 구형 OS 호환 모드로 연결되었습니다.`);
        completeProgressJob(
          jobKey,
          `${osTag} 호환 모드 ${mountRes.mount.uncPath} → ${mountRes.mount.driveLetter} 연결 완료`,
          [bridgeStep, ...mountRes.steps]
        );
      } else {
        const failedStep = mountRes.steps.find((s) => s.status === 'error');
        const errMsg = failedStep?.error || '구형 OS 클라이언트 드라이브 연결에 실패했습니다.';
        appendLog('구형 OS 클라이언트', `\\\\${config.targetHost}\\${config.shareName} 연결 실패`, 'error');
        showToast('클라이언트 연결에 실패했습니다. 파이프라인 처방 가이드를 확인하세요.');
        void captureTroubleshootFailure({
          originRole: 'client',
          netInfoSnap: freshNet,
          errorMessage: errMsg,
          targetHost: config.targetHost,
          shareName: config.shareName,
          driveLetter: config.driveLetter,
          authMode: config.authMode,
          isLegacyOs: true,
        });
        failProgressJob(jobKey, errMsg, [bridgeStep, ...mountRes.steps]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      const errSteps = latestSteps.map((s) => (s.status === 'running' ? { ...s, status: 'error' as const, error: msg } : s));
      setLegacyClientSteps(errSteps);
      appendLog('구형 OS 클라이언트', `통합 연결 예외: ${msg}`, 'error');
      showToast(`구형 OS 클라이언트 연결 실패: ${msg}`);
      void captureTroubleshootFailure({
        originRole: 'client',
        netInfoSnap: netInfo,
        errorMessage: msg,
        targetHost: config.targetHost,
        shareName: config.shareName,
        driveLetter: config.driveLetter,
        authMode: config.authMode,
        isLegacyOs: true,
      });
      failProgressJob(jobKey, msg, errSteps);
    } finally {
      setIsClientConnecting(false);
    }
  };

  const handleUnmount = async (driveLetter: string) => {
    const step1: PipelineStep = {
      id: 'unmount-drive',
      title: `${driveLetter} 네트워크 드라이브 연결 해제`,
      detail: 'SMB 매핑 및 해당 드라이브 세션을 안전하게 종료합니다.',
      status: 'running',
    };
    const step2: PipelineStep = {
      id: 'unmount-sync',
      title: '연결 드라이브 목록 동기화',
      detail: '현재 로컬 드라이브 상태와 저장 목록을 갱신합니다.',
      status: 'idle',
    };
    const jobKey = startProgressJob('네트워크 드라이브 연결 해제', driveLetter, [step1, step2]);
    if (!jobKey) return;

    const t0 = performance.now();
    try {
      const updated = await shareBridge.unmountDrive(driveLetter);
      const umDuration = Math.round(performance.now() - t0);
      setMounts(updated);
      appendLog('클라이언트 PC', `${driveLetter} 드라이브 연결 해제`, 'success');
      showToast(`${driveLetter} 드라이브 연결이 해제되었습니다.`);
      completeProgressJob(jobKey, `${driveLetter} 드라이브 연결이 해제되었습니다.`, [
        { ...step1, status: 'success', durationMs: umDuration },
        { ...step2, status: 'success', durationMs: 20 },
      ]);
    } catch (err) {
      const reason = err instanceof Error ? err.message : '알 수 없는 오류';
      appendLog('클라이언트 PC', `${driveLetter} 드라이브 해제 실패: ${reason}`, 'error');
      showToast(`${driveLetter} 드라이브 해제 실패: ${reason}`);
      failProgressJob(jobKey, reason, [
        { ...step1, status: 'error', durationMs: Math.round(performance.now() - t0), error: reason },
        step2,
      ]);
    }
  };

  const handleOpenPath = async (targetPath: string) => {
    const res = await shareBridge.openLocalOrUncPath(targetPath);
    if (res.message) showToast(res.message);
  };

  const handleRollback = async (scope: 'host' | 'client') => {
    const isHost = scope === 'host';
    const step1: PipelineStep = {
      id: `rb-${scope}-exec`,
      title: isHost ? '호스트 공유 정리 및 보안 기본값 원복' : '클라이언트 연결 해제 및 보안 기본값 원복',
      detail: isHost
        ? '공유 제거, LSA/Guest 제한 복구, SMB 서명 강제 및 방화벽 규칙 정리'
        : '전체 네트워크 드라이브 해제, 비인증 게스트 차단 및 서명 강제 복원',
      status: 'running',
    };
    const step2: PipelineStep = {
      id: `rb-${scope}-sync`,
      title: 'OS 네트워크 정책 재검사 및 USB 스냅샷 갱신',
      detail: '원복된 보안 정책 상태와 공유·드라이브 목록을 재확인합니다.',
      status: 'idle',
    };
    const jobKey = startProgressJob(
      isHost ? '호스트 보안 원복' : '클라이언트 보안 원복',
      isHost ? '공유 및 LSA/SMB 호스트 보안 기본값 복원' : '네트워크 연결 및 클라이언트 보안 기본값 복원',
      [step1, step2]
    );
    if (!jobKey) {
      return { success: false, message: '다른 작업이 진행 중입니다.' };
    }

    const t0 = performance.now();
    try {
      const res = await shareBridge.rollbackPolicies(scope, netInfo);
      const rbDuration = Math.round(performance.now() - t0);
      updateProgressSteps(jobKey, [
        {
          ...step1,
          status: res.success ? 'success' : 'error',
          durationMs: rbDuration,
          ...(res.success ? {} : { error: res.message }),
        },
        { ...step2, status: res.success ? 'running' : 'idle' },
      ]);

      const t1 = performance.now();
      setShares(shareBridge.getSavedShares());
      setMounts(shareBridge.getSavedMounts());
      if (scope === 'host') {
        setExpiryAlerts([]);
        try {
          const updatedPeers = await shareBridge.scanLanPeers(netInfo);
          setPeers(updatedPeers);
        } catch {}
      }
      let latestPol: OsNetworkPolicyStatus | null = policyStatus;
      try {
        latestPol = await shareBridge.inspectOsNetworkPolicy(netInfo);
        setPolicyStatus(latestPol);
      } catch {}
      setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
      await syncAllMatrixAndWizardState({
        netInfoSnap: netInfo,
        policy: latestPol,
        localShares: shareBridge.getSavedShares(),
        localMounts: shareBridge.getSavedMounts(),
        source: 'rollback',
      });
      appendLog(isHost ? '메인 PC' : '클라이언트 PC', res.message, res.success ? 'success' : 'error');

      const syncDuration = Math.round(performance.now() - t1);
      if (res.success) {
        completeProgressJob(jobKey, res.message, [
          { ...step1, status: 'success', durationMs: rbDuration },
          { ...step2, status: 'success', durationMs: syncDuration },
        ]);
      } else {
        failProgressJob(jobKey, res.message, [
          { ...step1, status: 'error', durationMs: rbDuration, error: res.message },
          step2,
        ]);
      }
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '보안 원복 실행 중 예외가 발생했습니다.';
      appendLog(isHost ? '메인 PC' : '클라이언트 PC', msg, 'error');
      failProgressJob(jobKey, msg, [
        { ...step1, status: 'error', durationMs: Math.round(performance.now() - t0), error: msg },
        step2,
      ]);
      return { success: false, message: msg };
    }
  };

  const handleFullSecurityRollback = async () => {
    const s1: PipelineStep = {
      id: 'full-rb-host',
      title: '호스트 공유폴더 · 임시 방화벽(445) · Guest/LSA 보안 원복',
      detail: '모든 사용자 공유 해제 및 서버/LSA/Guest 제한 기본값을 복구합니다.',
      status: 'running',
    };
    const s2: PipelineStep = {
      id: 'full-rb-client',
      title: '클라이언트 네트워크 드라이브 해제 · 게스트 접속 차단',
      detail: '열린 드라이브 세션을 끊고 클라이언트 서명·게스트 차단을 복구합니다.',
      status: 'idle',
    };
    const s3: PipelineStep = {
      id: 'full-rb-strict',
      title: '26H2 표준 보안 · 프린터 RPC · UAC 원격 보호 최종 복원',
      detail: '10개 핵심 보안 기본값(SMB 서명, 게스트, LSA, NTLM, UAC, RPC)을 정렬합니다.',
      status: 'idle',
    };
    const jobKey = startProgressJob(
      '전체(호스트+클라이언트+표준보안) 원복',
      '10개 핵심 보안 기본값 일괄 복원 및 검증',
      [s1, s2, s3]
    );
    if (!jobKey) {
      return { success: false, message: '다른 작업이 진행 중입니다.' };
    }

    const t0 = performance.now();
    try {
      const hostRes = await shareBridge.rollbackPolicies('host', netInfo);
      const d1 = Math.round(performance.now() - t0);
      updateProgressSteps(jobKey, [
        { ...s1, status: hostRes.success ? 'success' : 'error', durationMs: d1, ...(hostRes.success ? {} : { error: hostRes.message }) },
        { ...s2, status: 'running' },
        s3,
      ]);

      const t1 = performance.now();
      const clientRes = await shareBridge.rollbackPolicies('client', netInfo);
      const d2 = Math.round(performance.now() - t1);
      updateProgressSteps(jobKey, [
        { ...s1, status: hostRes.success ? 'success' : 'error', durationMs: d1 },
        { ...s2, status: clientRes.success ? 'success' : 'error', durationMs: d2, ...(clientRes.success ? {} : { error: clientRes.message }) },
        { ...s3, status: 'running' },
      ]);

      const t2 = performance.now();
      const hardenBatch = await shareBridge.autoAlignHostClientPolicies(
        ['strict_26h2_default', 'rpc_printer_default', 'disable_uac_token_filter'],
        netInfo
      );
      const d3 = Math.round(performance.now() - t2);

      setShares(shareBridge.getSavedShares());
      setMounts(shareBridge.getSavedMounts());
      setExpiryAlerts([]);
      setPolicyStatus(hardenBatch.updatedPolicy);
      setLastPatchResult({
        success: hardenBatch.success,
        mode: 'strict_26h2_default',
        summary: hardenBatch.summary,
        appliedActions: hardenBatch.appliedActions,
        rebootJudgment: hardenBatch.rebootJudgment,
        updatedPolicy: hardenBatch.updatedPolicy,
      });
      setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
      await syncAllMatrixAndWizardState({
        netInfoSnap: netInfo,
        policy: hardenBatch.updatedPolicy,
        localShares: shareBridge.getSavedShares(),
        localMounts: shareBridge.getSavedMounts(),
        source: 'rollback',
      });
      try {
        const updatedPeers = await shareBridge.scanLanPeers(netInfo);
        setPeers(updatedPeers);
      } catch {}

      const allOk = hostRes.success && clientRes.success && hardenBatch.success;
      const msg = allOk
        ? '호스트·클라이언트 세션 정리 및 10개 핵심 보안 기본값 일괄 원복을 완료했습니다.'
        : '일부 보안 원복 단계에 확인이 필요합니다. 10개 핵심 항목 검증 보고서를 확인하세요.';
      appendLog('전체 보안 원복', msg, allOk ? 'success' : 'error');
      showToast(msg);
      const finalSteps: PipelineStep[] = [
        { ...s1, status: hostRes.success ? 'success' : 'error', durationMs: d1 },
        { ...s2, status: clientRes.success ? 'success' : 'error', durationMs: d2 },
        { ...s3, status: hardenBatch.success ? 'success' : 'error', durationMs: d3 },
      ];
      if (allOk) {
        completeProgressJob(jobKey, msg, finalSteps);
      } else {
        failProgressJob(jobKey, msg, finalSteps);
      }
      return { success: allOk, message: msg };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '전체 보안 원복 중 오류가 발생했습니다.';
      appendLog('전체 보안 원복', errMsg, 'error');
      showToast(errMsg);
      failProgressJob(jobKey, errMsg, [
        { ...s1, status: 'error', durationMs: Math.round(performance.now() - t0), error: errMsg },
        s2,
        s3,
      ]);
      return { success: false, message: errMsg };
    }
  };

  const handleExpirySecurityRollback = async () => {
    const s1: PipelineStep = {
      id: 'exp-cleanup',
      title: '만료된 임시 공유폴더 해제 정리',
      detail: '남아 있는 만료 공유 리소스를 제거합니다.',
      status: 'running',
    };
    const s2: PipelineStep = {
      id: 'exp-rollback',
      title: '호스트 보안 원복 및 Win 11 26H2 표준 보안 복구',
      detail: 'SMB 서명 강제 및 Guest·LSA 제한 기본값으로 복원합니다.',
      status: 'idle',
    };
    const s3: PipelineStep = {
      id: 'exp-sync',
      title: 'USB 포터블 기록 및 만료 알림 초기화',
      detail: '갱신된 정책 상태를 저장합니다.',
      status: 'idle',
    };
    const jobKey = startProgressJob('만료 공유 해제 & 보안 원복', `${expiryAlerts.length}건 만료 공유 정리`, [s1, s2, s3]);
    if (!jobKey) return;

    const t0 = performance.now();
    let d1 = 0;
    let d2 = 0;
    let phase: 1 | 2 | 3 = 1;
    try {
      for (const alert of expiryAlerts) {
        if (!alert.autoRevoked) {
          try {
            await shareBridge.removeHostShare(alert.shareName, netInfo);
          } catch {}
        }
      }
      d1 = Math.round(performance.now() - t0);
      phase = 2;
      updateProgressSteps(jobKey, [
        { ...s1, status: 'success', durationMs: d1 },
        { ...s2, status: 'running' },
        s3,
      ]);

      const t1 = performance.now();
      const rollbackRes = await shareBridge.rollbackPolicies('host', netInfo);
      const strictRes = await shareBridge.applyOsCompatibilityPatch('strict_26h2_default', netInfo);
      d2 = Math.round(performance.now() - t1);

      const allOk = rollbackRes.success && strictRes.success;
      const errMsg = [
        !rollbackRes.success ? rollbackRes.message : '',
        !strictRes.success ? strictRes.summary : '',
      ]
        .filter(Boolean)
        .join(' · ');

      phase = 3;
      const t2 = performance.now();
      updateProgressSteps(jobKey, [
        { ...s1, status: 'success', durationMs: d1 },
        {
          ...s2,
          status: allOk ? 'success' : 'error',
          durationMs: d2,
          ...(allOk ? {} : { error: errMsg }),
        },
        { ...s3, status: allOk ? 'running' : 'idle' },
      ]);

      setShares(shareBridge.getSavedShares());
      setPolicyStatus(strictRes.updatedPolicy);
      setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
      await syncAllMatrixAndWizardState({
        netInfoSnap: netInfo,
        policy: strictRes.updatedPolicy,
        localShares: shareBridge.getSavedShares(),
        source: 'rollback',
      });
      try {
        const updatedPeers = await shareBridge.scanLanPeers(netInfo);
        setPeers(updatedPeers);
      } catch {}

      if (allOk) {
        setExpiryAlerts([]);
        appendLog('만료 보안 원복', `${rollbackRes.message} · Win 11 26H2 표준 보안 복원 완료`, 'success');
        showToast('만료된 공유를 정리하고 Win 11 26H2 보안 기본값으로 원복했습니다.');
        completeProgressJob(jobKey, '만료된 공유 정리 및 Win 11 26H2 표준 보안 원복 완료', [
          { ...s1, status: 'success', durationMs: d1 },
          { ...s2, status: 'success', durationMs: d2 },
          { ...s3, status: 'success', durationMs: Math.round(performance.now() - t2) },
        ]);
      } else {
        appendLog('만료 보안 원복', errMsg || '보안 원복 일부 단계 실패', 'error');
        showToast(`만료 보안 원복 중 오류가 발생했습니다: ${errMsg}`);
        failProgressJob(jobKey, errMsg || '호스트 보안 원복 또는 26H2 표준 보안 복원에 실패했습니다.', [
          { ...s1, status: 'success', durationMs: d1 },
          { ...s2, status: 'error', durationMs: d2, error: errMsg },
          s3,
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '만료 보안 원복 중 오류가 발생했습니다.';
      appendLog('만료 보안 원복', msg, 'error');
      showToast(msg);
      const errSteps: PipelineStep[] =
        phase === 1
          ? [{ ...s1, status: 'error', durationMs: Math.round(performance.now() - t0), error: msg }, s2, s3]
          : [
              { ...s1, status: 'success', durationMs: d1 },
              { ...s2, status: 'error', durationMs: d2 || Math.round(performance.now() - t0), error: msg },
              s3,
            ];
      failProgressJob(jobKey, msg, errSteps);
    }
  };

  const handleOpenDiagnostics = async (errorText?: string) => {
    setDiagErrorText(errorText || null);
    setDiagOpen(true);
    setDiagLoading(true);
    try {
      const [checks, pol] = await Promise.all([
        shareBridge.runDiagnostics(),
        shareBridge.inspectOsNetworkPolicy(netInfo),
      ]);
      setDiagChecks(checks);
      setPolicyStatus(pol);
      appendLog('공통 진단', 'SMB 네트워크 스택 및 OS 정책 상태 점검 완료', 'success');
    } catch {
      setDiagChecks([
        { id: 'err', label: '진단 실행 오류', status: 'fail', detail: '진단 스크립트 실행 중 예외가 발생했습니다.' },
      ]);
    } finally {
      setDiagLoading(false);
    }
  };

  const handlePingHost = async (target: string) => {
    const result = await shareBridge.pingHost(target, peers, netInfo);
    appendLog(
      'Ping 진단',
      result.reachable
        ? `${result.target} 응답 확인 (평균 ${result.avgLatencyMs ?? '-'}ms · Port 445 ${result.smbPortOpen ? 'OPEN' : 'CLOSED'})`
        : `${result.target} 응답 없음 (패킷 손실 ${result.packetLossPct}%)`,
      result.reachable ? 'success' : 'error'
    );
    return result;
  };

  const suggestedTargets: SuggestedPingTarget[] = React.useMemo(() => {
    const seen = new Set<string>();
    const list: SuggestedPingTarget[] = [];
    for (const p of peers) {
      if (p.ipAddress && !seen.has(p.ipAddress)) {
        seen.add(p.ipAddress);
        list.push({ label: p.hostName, host: p.ipAddress });
      }
    }
    for (const ps of portableShares) {
      const host = ps.sourceIp || ps.sourceHostName;
      if (host && !seen.has(host)) {
        seen.add(host);
        list.push({ label: `${ps.sourceHostName || 'USB 호스트'} (${ps.shareName})`, host });
      }
    }
    for (const m of mounts) {
      if (m.targetHost && !seen.has(m.targetHost)) {
        seen.add(m.targetHost);
        list.push({ label: `${m.driveLetter} 호스트`, host: m.targetHost });
      }
    }
    return list;
  }, [peers, portableShares, mounts]);

  const remotePortableShares = React.useMemo(() => {
    const hostLower = netInfo.hostname.trim().toLowerCase();
    return portableShares.filter((s) => (s.sourceHostName || '').trim().toLowerCase() !== hostLower);
  }, [portableShares, netInfo.hostname]);

  const handlePortableAutoFillLog = useCallback(
    (entry: PortableHostShareEntry) => {
      const origin = entry.sourceHostName || entry.sourceIp || 'USB';
      appendLog(
        'USB 포터블',
        `원본 PC(${origin})의 공유 설정 '${entry.shareName}' 원클릭 자동 채우기 적용`,
        'success'
      );
      showToast(`USB에 저장된 '${origin} · ${entry.shareName}' 연결 정보를 불러왔습니다.`);
    },
    [appendLog, showToast]
  );

  const handleJumpToClientWithAutoFill = useCallback(
    (entry: PortableHostShareEntry) => {
      setPendingAutoFillEntry(entry);
      setActiveSection('workspace');
      setRoleMode('client');
      handlePortableAutoFillLog(entry);
    },
    [handlePortableAutoFillLog]
  );

  const applyLocationProfileToWorkspace = useCallback(
    (profile: LocationProfileFile, notify = true) => {
      setActiveLocationProfile(profile);
      setLastLocationBatchResult(null);
      const stamp = `${profile.profileId}-${Date.now()}`;

      if (profile.hostPreset) {
        const preset = profile.hostPreset;
        setHostDraft({
          folderPath: preset.folderPath,
          shareName: preset.shareName,
          authMode: preset.authMode,
          permission: preset.permission,
          username: preset.username,
          password: preset.authMode === 'account' ? preset.password || '' : '',
          ttlMinutes: preset.ttlMinutes,
          autoRevokeOnExpiry: preset.autoRevokeOnExpiry,
        });
        setPendingHostPreset({
          key: stamp,
          config: {
            folderPath: preset.folderPath,
            shareName: preset.shareName,
            authMode: preset.authMode,
            permission: preset.permission,
            username: preset.username,
            ...(preset.password ? { password: preset.password } : {}),
            ttlMinutes: preset.ttlMinutes,
            autoRevokeOnExpiry: preset.autoRevokeOnExpiry,
          },
        });
      } else if (profile.savedShares.length > 0) {
        const firstShare = profile.savedShares[0];
        setHostDraft({
          folderPath: firstShare.folderPath || 'C:\\AhBiShared',
          shareName: firstShare.shareName,
          authMode: firstShare.authMode,
          permission: firstShare.permission,
          username: firstShare.username || 'AhBiShare',
          password: firstShare.authMode === 'account' ? firstShare.password || '' : '',
          ttlMinutes: firstShare.ttlMinutes,
          autoRevokeOnExpiry: firstShare.autoRevokeOnExpiry,
        });
        setPendingHostPreset({
          key: stamp,
          config: {
            folderPath: firstShare.folderPath || 'C:\\AhBiShared',
            shareName: firstShare.shareName,
            authMode: firstShare.authMode,
            permission: firstShare.permission,
            username: firstShare.username || 'AhBiShare',
            ...(firstShare.password ? { password: firstShare.password } : {}),
            ttlMinutes: firstShare.ttlMinutes,
            autoRevokeOnExpiry: firstShare.autoRevokeOnExpiry,
          },
        });
      }

      if (profile.clientTargets.length > 0) {
        const firstTarget = profile.clientTargets[0];
        skipNextIpProbeHostRef.current = firstTarget.targetHost.trim();
        setClientDraft({
          targetHost: firstTarget.targetHost,
          shareName: firstTarget.shareName,
          driveLetter: firstTarget.driveLetter,
          authMode: firstTarget.authMode,
          username: firstTarget.username || '',
          password: firstTarget.password || '',
          persistent: firstTarget.persistent !== false,
        });
        setPendingLocationTarget({ key: stamp, target: firstTarget });
      } else if (profile.savedShares.length > 0 || profile.hostPreset) {
        const sourceShare = profile.savedShares[0] || profile.hostPreset;
        const hostIp = profile.networkHint?.primaryIp || profile.networkHint?.hostname || '192.168.0.10';
        const inferredTarget: LocationClientTargetEntry = {
          targetHost: hostIp,
          shareName: sourceShare?.shareName || 'AhBiShared',
          driveLetter: 'Z:',
          authMode: sourceShare?.authMode || 'guest',
          username: sourceShare?.username || '',
          password: sourceShare?.password || '',
          persistent: true,
        };
        skipNextIpProbeHostRef.current = inferredTarget.targetHost.trim();
        setClientDraft({
          targetHost: inferredTarget.targetHost,
          shareName: inferredTarget.shareName,
          driveLetter: inferredTarget.driveLetter,
          authMode: inferredTarget.authMode,
          username: inferredTarget.username || '',
          password: inferredTarget.password || '',
          persistent: true,
        });
        setPendingLocationTarget({ key: stamp, target: inferredTarget });
      }

      if (notify) {
        appendLog(
          '사용장소',
          `'${profile.locationName}' 프로필 불러오기 및 입력 폼 자동 채움 완료 (공유 ${profile.savedShares.length}건 · 드라이브 ${profile.clientTargets.length}건)`,
          'success'
        );
        showToast(
          `'${profile.locationName}' 설정을 불러왔습니다. 필요 시 [이 장소 일괄 적용]을 실행하세요.`
        );
      }
    },
    [appendLog, showToast]
  );

  const handleSelectLocationProfile = useCallback(
    async (profileId: string) => {
      if (!profileId) {
        setActiveLocationProfile(null);
        setLastLocationBatchResult(null);
        return;
      }
      const res = await shareBridge.loadLocationProfile(profileId);
      if (!res.success || !res.profile) {
        showToast(res.error || '사용장소 프로필 파일을 불러오지 못했습니다.');
        return;
      }
      applyLocationProfileToWorkspace(res.profile, true);
    },
    [applyLocationProfileToWorkspace, showToast]
  );

  const handleSaveLocationProfile = useCallback(
    async (options: {
      overwriteProfileId?: string;
      locationName: string;
      description: string;
      includeHost: boolean;
      includeClient: boolean;
      includeNetworkHint: boolean;
    }): Promise<boolean> => {
      const snapshot = shareBridge.buildLocationProfileSnapshot({
        profileId: options.overwriteProfileId,
        locationName: options.locationName,
        description: options.description,
        netInfo,
        includeHost: options.includeHost,
        includeClient: options.includeClient,
        includeNetworkHint: options.includeNetworkHint,
        hostConfig: hostDraft,
        activeShares: shares,
        clientConfig: clientDraft,
        mountedDrives: mounts,
        existingCreatedAt:
          options.overwriteProfileId && activeLocationProfile?.profileId === options.overwriteProfileId
            ? activeLocationProfile.createdAt
            : undefined,
      });

      const res = await shareBridge.saveLocationProfile(snapshot);
      if (!res.success || !res.profile) {
        const msg = res.error || '사용장소 파일 저장에 실패했습니다.';
        appendLog('사용장소', msg, 'error');
        showToast(msg);
        return false;
      }

      setActiveLocationProfile(res.profile);
      await refreshLocationProfiles();
      appendLog(
        '사용장소',
        `'${res.profile.locationName}' 프로필 저장 완료 (${res.profile.profileId}.location.json)`,
        'success'
      );
      showToast(`사용장소 '${res.profile.locationName}' 설정을 개별 파일로 저장했습니다.`);
      return true;
    },
    [netInfo, hostDraft, shares, clientDraft, mounts, activeLocationProfile, refreshLocationProfiles, appendLog, showToast]
  );

  const handleExportLocationProfile = useCallback(
    async (profileId: string) => {
      const loaded = await shareBridge.loadLocationProfile(profileId);
      if (!loaded.success || !loaded.profile) {
        showToast(loaded.error || '내보낼 사용장소 데이터를 찾지 못했습니다.');
        return;
      }
      const res = await shareBridge.exportLocationProfileFile(loaded.profile);
      if (res.canceled) return;
      appendLog('사용장소', res.message, res.success ? 'success' : 'error');
      showToast(res.message);
    },
    [appendLog, showToast]
  );

  const handleImportLocationJson = useCallback(async () => {
    if (isElectronRuntime()) {
      const res = await shareBridge.importLocationProfileFile(true);
      if (res.canceled) return;
      if (!res.success || !res.profile) {
        appendLog('사용장소', res.message, 'error');
        showToast(res.message);
        return;
      }
      await refreshLocationProfiles();
      applyLocationProfileToWorkspace(res.profile, false);
      appendLog('사용장소', res.message, 'success');
      showToast(res.message);
      return;
    }
    locationFileInputRef.current?.click();
  }, [refreshLocationProfiles, applyLocationProfileToWorkspace, appendLog, showToast]);

  const handleWebLocationFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const res = await shareBridge.importLocationProfileFromJson(text, true);
        if (!res.success || !res.profile) {
          appendLog('사용장소', res.message, 'error');
          showToast(res.message);
          return;
        }
        await refreshLocationProfiles();
        applyLocationProfileToWorkspace(res.profile, false);
        appendLog('사용장소', res.message, 'success');
        showToast(res.message);
      } catch {
        showToast('선택한 JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    },
    [refreshLocationProfiles, applyLocationProfileToWorkspace, appendLog, showToast]
  );

  const handleDeleteLocationProfile = useCallback(
    async (profileId: string, locationName: string) => {
      const res = await shareBridge.deleteLocationProfile(profileId);
      if (!res.success) {
        showToast(res.error || '사용장소 파일 삭제에 실패했습니다.');
        return;
      }
      if (activeLocationProfile?.profileId === profileId) {
        setActiveLocationProfile(null);
        setLastLocationBatchResult(null);
      }
      await refreshLocationProfiles();
      appendLog('사용장소', `'${locationName}' 프로필 파일 삭제 완료`, 'success');
      showToast(`'${locationName}' 사용장소 프로필을 삭제했습니다.`);
    },
    [activeLocationProfile, refreshLocationProfiles, appendLog, showToast]
  );

  const handleLoadLocationProfileForEdit = useCallback(
    async (profileId: string): Promise<LocationProfileFile | null> => {
      const res = await shareBridge.loadLocationProfile(profileId);
      if (!res.success || !res.profile) {
        const msg = res.error || '수정할 사용장소 프로필 파일을 불러오지 못했습니다.';
        appendLog('사용장소', msg, 'error');
        showToast(msg);
        return null;
      }
      return res.profile;
    },
    [appendLog, showToast]
  );

  const handleUpdateLocationProfile = useCallback(
    async (edited: LocationProfileFile, applyToWorkspace: boolean): Promise<boolean> => {
      const res = await shareBridge.saveEditedLocationProfile(edited);
      if (!res.success || !res.profile) {
        const msg = res.error || '사용장소 프로필 파일 수정 저장에 실패했습니다.';
        appendLog('사용장소', msg, 'error');
        showToast(msg);
        return false;
      }
      const saved = res.profile;
      await refreshLocationProfiles();
      if (applyToWorkspace) {
        applyLocationProfileToWorkspace(saved, false);
      } else if (activeLocationProfile?.profileId === saved.profileId) {
        setActiveLocationProfile(saved);
      }
      appendLog(
        '사용장소',
        `'${saved.locationName}' 프로필 파일 내용 수정 완료 (${saved.profileId}.location.json)`,
        'success'
      );
      showToast(`사용장소 '${saved.locationName}' 파일 내용을 저장했습니다.`);
      return true;
    },
    [
      activeLocationProfile,
      applyLocationProfileToWorkspace,
      refreshLocationProfiles,
      appendLog,
      showToast,
    ]
  );

  const executeBatchApplyLocation = useCallback(
    async (targetProfile: LocationProfileFile, report?: LocationPreflightReport | null) => {
      const validShares = targetProfile.savedShares.filter((s) => Boolean(s.folderPath && s.shareName));
      const preflightSummaryStep: PipelineStep | null = report
        ? {
            id: 'loc-preflight-summary',
            title: `[사전 검증] 환경·경로·권한·TCP 445 검사 완료`,
            detail: `전체 ${report.totalItems}건: 통과 ${report.passCount} · 주의 ${report.warningCount} · 오류 ${report.failCount}`,
            status: 'success',
          }
        : null;
      const stepOffset = preflightSummaryStep ? 1 : 0;

      const initialBatchSteps: PipelineStep[] = [
        ...(preflightSummaryStep ? [preflightSummaryStep] : []),
        ...validShares.map((sh, idx) => ({
          id: `loc-sh-${idx}`,
          title: `[호스트 공유] ${sh.shareName} (${sh.folderPath})`,
          detail: '대기 중',
          status: 'idle' as const,
        })),
        ...targetProfile.clientTargets.map((ct, idx) => ({
          id: `loc-ct-${idx}`,
          title: `[드라이브 연결] ${ct.driveLetter} → \\\\${ct.targetHost}\\${ct.shareName}`,
          detail: '대기 중',
          status: 'idle' as const,
        })),
        {
          id: 'loc-final-sync',
          title: 'OS 네트워크 정책 및 USB·LAN 피어 최종 동기화',
          detail: '일괄 적용 결과를 저장소에 반영합니다.',
          status: 'idle',
        },
      ];

      const jobKey = startProgressJob(
        `사용장소 '${targetProfile.locationName}' 일괄 적용`,
        `호스트 공유 ${validShares.length}건 · 네트워크 드라이브 ${targetProfile.clientTargets.length}건`,
        initialBatchSteps
      );
      if (!jobKey) return;

      setPreflightModalOpen(false);
      setLocationModalOpen(false);
      setIsLocationBatchApplying(true);
      setLocationBatchProgress(`'${targetProfile.locationName}' 설정 일괄 적용 준비 중...`);

      const batchSteps = initialBatchSteps.map((s) => ({ ...s }));
      let currentIdx = -1;
      let currentItemStartMs = performance.now();

      const advanceBatchItem = (nextIdx: number) => {
        if (currentIdx >= stepOffset && currentIdx < batchSteps.length && batchSteps[currentIdx].status === 'running') {
          batchSteps[currentIdx] = {
            ...batchSteps[currentIdx],
            status: 'success',
            durationMs: Math.round(performance.now() - currentItemStartMs),
          };
        }
        currentIdx = nextIdx;
        currentItemStartMs = performance.now();
        if (currentIdx >= stepOffset && currentIdx < batchSteps.length) {
          batchSteps[currentIdx] = {
            ...batchSteps[currentIdx],
            status: 'running',
            detail: '실행 준비 중...',
          };
        }
        updateProgressSteps(
          jobKey,
          batchSteps.map((s) => ({ ...s }))
        );
      };

      const updateCurrentSubStep = (subSteps: PipelineStep[]) => {
        if (currentIdx < stepOffset || currentIdx >= batchSteps.length) return;
        const activeSub = subSteps.find((s) => s.status === 'running') || subSteps[subSteps.length - 1];
        if (!activeSub) return;
        const doneCount = subSteps.filter((s) => s.status === 'success').length;
        batchSteps[currentIdx] = {
          ...batchSteps[currentIdx],
          detail: `${activeSub.title} (${doneCount}/${subSteps.length})`,
        };
        updateProgressSteps(
          jobKey,
          batchSteps.map((s) => ({ ...s }))
        );
      };

      try {
        const freshNet = await shareBridge.getLocalNetworkInfo();
        setNetInfo(freshNet);
        const batchRes = await shareBridge.applyLocationProfileBatch(targetProfile, freshNet, {
          onHostSteps: (steps) => {
            setHostSteps(steps);
            updateCurrentSubStep(steps);
          },
          onClientSteps: (steps) => {
            setClientSteps(steps);
            updateCurrentSubStep(steps);
          },
          onProgressText: (text) => {
            setLocationBatchProgress(text);
            const hostMatch = text.match(/^호스트 공유폴더\((\d+)\//);
            const clientMatch = text.match(/^네트워크 드라이브\((\d+)\//);
            if (hostMatch) {
              advanceBatchItem(stepOffset + Math.max(0, parseInt(hostMatch[1], 10) - 1));
            } else if (clientMatch) {
              advanceBatchItem(stepOffset + validShares.length + Math.max(0, parseInt(clientMatch[1], 10) - 1));
            }
          },
        });

        const finalSyncIdx = stepOffset + validShares.length + targetProfile.clientTargets.length;
        advanceBatchItem(finalSyncIdx);

        setShares(shareBridge.getSavedShares());
        setMounts(shareBridge.getSavedMounts());
        if (batchRes.appliedShares > 0 || batchRes.appliedMounts > 0) {
          try {
            const pol = await shareBridge.inspectOsNetworkPolicy(freshNet);
            setPolicyStatus(pol);
          } catch {}
        }
        refreshPortableSnapshot(freshNet.hostname);
        try {
          const updatedPeers = await shareBridge.scanLanPeers(freshNet);
          setPeers(updatedPeers);
        } catch {}
        setLastLocationBatchResult(batchRes);
        appendLog('장소 일괄 적용', batchRes.summary, batchRes.success ? 'success' : 'error');
        showToast(batchRes.summary);

        // Reconcile exact success/error status from batchRes.details
        const shareDetails = batchRes.details.filter((d) => d.kind === 'share');
        const mountDetails = batchRes.details.filter((d) => d.kind === 'mount');
        shareDetails.forEach((d, i) => {
          const targetIdx = stepOffset + i;
          if (batchSteps[targetIdx]) {
            batchSteps[targetIdx] = {
              ...batchSteps[targetIdx],
              status: d.success ? 'success' : 'error',
              detail: d.success ? d.message : batchSteps[targetIdx].detail,
              ...(d.success ? {} : { error: d.message }),
            };
          }
        });
        mountDetails.forEach((d, i) => {
          const targetIdx = stepOffset + validShares.length + i;
          if (batchSteps[targetIdx]) {
            batchSteps[targetIdx] = {
              ...batchSteps[targetIdx],
              status: d.success ? 'success' : 'error',
              detail: d.success ? d.message : batchSteps[targetIdx].detail,
              ...(d.success ? {} : { error: d.message }),
            };
          }
        });
        batchSteps[finalSyncIdx] = {
          ...batchSteps[finalSyncIdx],
          status: 'success',
          durationMs: Math.round(performance.now() - currentItemStartMs),
        };

        if (batchRes.success || (validShares.length === 0 && targetProfile.clientTargets.length === 0)) {
          completeProgressJob(jobKey, batchRes.summary, batchSteps);
        } else {
          const firstErr = batchRes.details.find((d) => !d.success)?.message || batchRes.summary;
          failProgressJob(jobKey, `${batchRes.summary} (${firstErr})`, batchSteps);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('장소 일괄 적용', `실행 예외: ${msg}`, 'error');
        showToast(`사용장소 일괄 적용 실패: ${msg}`);
        failProgressJob(jobKey, msg, batchSteps);
      } finally {
        setIsLocationBatchApplying(false);
        setLocationBatchProgress(null);
      }
    },
    [
      refreshPortableSnapshot,
      appendLog,
      showToast,
      startProgressJob,
      updateProgressSteps,
      completeProgressJob,
      failProgressJob,
    ]
  );

  const runPreflightCheckForProfile = useCallback(
    async (targetProfile: LocationProfileFile) => {
      const seq = ++preflightSeqRef.current;
      setPreflightTargetProfile(targetProfile);
      setPreflightReport(null);
      setPreflightChecking(true);
      setPreflightModalOpen(true);
      try {
        const freshNet = await shareBridge.getLocalNetworkInfo();
        if (seq !== preflightSeqRef.current) return;
        setNetInfo(freshNet);
        const report = await shareBridge.preflightLocationProfileBatch(targetProfile, freshNet);
        if (seq !== preflightSeqRef.current) return;
        setPreflightReport(report);
        appendLog(
          '사전 검증',
          `'${targetProfile.locationName}' Pre-flight Check: 통과 ${report.passCount} · 주의 ${report.warningCount} · 오류 ${report.failCount}`,
          report.hasBlockingErrors ? 'error' : 'success'
        );
      } catch (err) {
        if (seq !== preflightSeqRef.current) return;
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        showToast(`사전 검증 실행 실패: ${msg}`);
      } finally {
        if (seq === preflightSeqRef.current) {
          setPreflightChecking(false);
        }
      }
    },
    [appendLog, showToast]
  );

  const handleBatchApplyLocation = useCallback(
    async (profileIdOverride?: string) => {
      let targetProfile = activeLocationProfile;
      if (profileIdOverride) {
        const loaded = await shareBridge.loadLocationProfile(profileIdOverride);
        if (!loaded.success || !loaded.profile) {
          showToast(loaded.error || '적용할 사용장소 파일을 불러오지 못했습니다.');
          return;
        }
        targetProfile = loaded.profile;
        applyLocationProfileToWorkspace(loaded.profile, false);
      }
      if (!targetProfile) {
        showToast('먼저 적용할 사용장소 프로필을 선택하세요.');
        return;
      }

      setLocationModalOpen(false);
      await runPreflightCheckForProfile(targetProfile);
    },
    [activeLocationProfile, applyLocationProfileToWorkspace, runPreflightCheckForProfile, showToast]
  );

  return (
    <div className={`${isEmbedded ? 'min-h-full' : 'min-h-screen'} flex flex-col bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100`}>
      <TopBar
        activeSection={activeSection}
        roleMode={roleMode}
        availableUpdateTag={latestRelease?.tagName || null}
        onOpenUpdateModal={() => setUpdateModalOpen(true)}
        onNavigate={handleNavigate}
        onOpenDiagnostics={() => void handleOpenDiagnostics()}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <button
              id="role-switch-host"
              type="button"
              onClick={() => {
                setActiveSection('workspace');
                setRoleMode('host');
              }}
              className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors sm:whitespace-nowrap cursor-pointer ${
                activeSection === 'workspace' && roleMode === 'host'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5 shrink-0" />
              <span>메인 PC (개설)</span>
            </button>
            <button
              id="role-switch-client"
              type="button"
              onClick={() => {
                setActiveSection('workspace');
                setRoleMode('client');
              }}
              className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors sm:whitespace-nowrap cursor-pointer ${
                activeSection === 'workspace' && roleMode === 'client'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 shrink-0" />
              <span>클라이언트 PC (접속)</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="tabular-data text-xs text-slate-500 dark:text-slate-400">
              {netInfo.isElectron ? 'Windows 관리자 런타임' : '웹 프리뷰 시뮬레이션 모드'} ·{' '}
              {formatEraShortLabel(policyStatus?.osEra || netInfo.osEra, policyStatus?.osBuild || netInfo.osBuild, policyStatus?.osDisplayVersion || netInfo.osDisplayVersion)} ·{' '}
              {netInfo.primaryIp} · {portableStatus.writable ? 'USB 자동 동기화 활성' : 'USB 읽기 전용'}
            </span>
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="테마 전환"
              className="p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {netInfo.isElectron && !netInfo.isAdmin && (
          <div className="px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              현재 표준 사용자 권한으로 실행되었습니다. 방화벽 개방, 레지스트리 정책 변경 및 SMB 공유 생성을 위해 관리자 권한으로 실행해 주세요.
            </span>
          </div>
        )}

        {(!portableStatus.writable || portableStatus.corruptedRecovered) && (
          <div className="px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {!portableStatus.writable
                ? `실행 파일 폴더(${portableStatus.directory})가 ${portableStatus.writeProtected ? '쓰기 금지(읽기 전용)' : '쓰기 불가'} 상태이므로 변경 사항이 USB ${portableStatus.fileName}에 자동 저장되지 않습니다.${portableStatus.writeError ? ` (${portableStatus.writeError})` : ''}`
                : `손상된 USB 포터블 데이터 파일이 안전하게 백업 복구되었습니다. 공유를 다시 생성하면 새 설정 파일이 자동 기록됩니다.`}
            </span>
          </div>
        )}

        {expiryAlerts.length > 0 && (
          <div
            id="share-expiry-alert-banner"
            role="alert"
            className="px-5 py-4 rounded-xl border border-amber-500/45 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  임시 공유 만료 알림 ({expiryAlerts.length}건)
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {expiryAlerts
                    .map(
                      (a) =>
                        `'${a.shareName}' (${a.expiredAt} 만료 · ${a.autoRevoked ? '공유 자동 해제됨' : '수동 해제 대기'})`
                    )
                    .join(', ')}
                  . 보안을 위해 완화된 SMB·게스트·LSA 정책을 표준 보안으로 원복할 수 있습니다.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                id="btn-expiry-security-rollback"
                type="button"
                onClick={() => void handleExpirySecurityRollback()}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                만료 공유 해제 & 보안 원복
              </button>
              <button
                type="button"
                onClick={() => setExpiryAlerts([])}
                aria-label="만료 알림 닫기"
                className="p-1.5 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {myPendingHostTask && (
          <div
            id="my-pending-host-task-banner"
            role="status"
            className="px-5 py-4 rounded-xl border border-indigo-500/40 bg-indigo-500/8 dark:bg-indigo-500/12 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  USB에 이 PC({netInfo.hostname})용 호스트 정책 자동 적용 대기 작업이 있습니다
                </div>
                <p className="tabular-data text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  요청 PC: <span className="font-semibold">{myPendingHostTask.requestedByHostName}</span>
                  {myPendingHostTask.requestedByIp ? ` (${myPendingHostTask.requestedByIp})` : ''} · 저장 일시:{' '}
                  {formatSnapshotTimestamp(myPendingHostTask.createdAt)} · 해결 대상:{' '}
                  <span className="font-semibold">
                    {myPendingHostTask.conflictLabels.join(' · ') || 'SMB · 게스트 정책 정렬'}
                  </span>
                  {myPendingHostTask.includeGuestUnlock ? ' · Guest 무비밀번호 완전 개방 포함' : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
              <button
                id="btn-apply-my-pending-task"
                type="button"
                disabled={isApplyingPendingHostTask || isAutoAligning}
                onClick={() => void handleApplyPendingHostTask(myPendingHostTask)}
                className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                {isApplyingPendingHostTask ? '적용 중...' : '대기 작업 지금 적용'}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('matrix')}
                className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
              >
                매트릭스 상세
              </button>
              {confirmingDismissPendingTask ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDeletePendingHostTask(myPendingHostTask.targetHostName)}
                    className="px-2.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer"
                  >
                    삭제 확정
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDismissPendingTask(false)}
                    className="px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDismissPendingTask(true)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  대기 삭제
                </button>
              )}
            </div>
          </div>
        )}

        <TroubleshootHandoffBanner
          tickets={troubleshootTickets}
          matchResult={troubleshootMatch}
          currentHostname={netInfo.hostname}
          writeProtected={portableStatus.writeProtected}
          policyStatus={policyStatus}
          lastPatchResult={lastPatchResult}
          pendingHostTask={myPendingHostTask}
          onOpenWizard={handleOpenTroubleshootWizard}
          onOpenMatrix={() => setActiveSection('matrix')}
          onDeleteTicket={handleDeleteTroubleshootTicket}
          onClearResolved={handleClearResolvedTroubleshootTickets}
        />

        {activeSection === 'workspace' && (
          <LocationProfileBar
            profiles={locationProfiles}
            activeProfile={activeLocationProfile}
            isBatchApplying={isLocationBatchApplying}
            batchProgressText={locationBatchProgress}
            lastBatchResult={lastLocationBatchResult}
            onSelectProfile={(id) => void handleSelectLocationProfile(id)}
            onOpenSaveModal={() => {
              setLocationModalEditProfileId(null);
              setLocationModalTab('save');
              setLocationModalOpen(true);
            }}
            onOpenManagerModal={() => {
              setLocationModalEditProfileId(null);
              setLocationModalTab('manage');
              setLocationModalOpen(true);
            }}
            onEditActiveProfile={() => {
              if (!activeLocationProfile) return;
              setLocationModalTab('manage');
              setLocationModalEditProfileId(activeLocationProfile.profileId);
              setLocationModalOpen(true);
            }}
            onQuickImportJson={() => void handleImportLocationJson()}
            onBatchApply={() => void handleBatchApplyLocation()}
            onDismissBatchResult={() => setLastLocationBatchResult(null)}
          />
        )}

        {activeSection === 'workspace' && roleMode === 'host' && remotePortableShares.length > 0 && (
          <div className="px-5 py-4 rounded-xl border border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Usb className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs text-slate-700 dark:text-slate-200 min-w-0">
                USB에서 다른 메인 PC(<span className="tabular-data font-semibold">{remotePortableShares[0].sourceHostName} · {remotePortableShares[0].sourceIp}</span>)의 공유 설정 {remotePortableShares.length}건을 감지했습니다. 현재 클라이언트 PC라면 바로 연결할 수 있습니다.
              </p>
            </div>
            <button
              id="btn-jump-client-autofill"
              type="button"
              onClick={() => handleJumpToClientWithAutoFill(remotePortableShares[0])}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-end sm:self-center"
            >
              클라이언트 연결로 이동 · 자동 채우기
            </button>
          </div>
        )}

        {activeSection === 'workspace' && roleMode === 'host' && (
          <HostPanel
            netInfo={netInfo}
            shares={shares}
            steps={hostSteps}
            isExecuting={isHostExecuting || isLocationBatchApplying}
            isRefreshing={isRefreshingTab}
            nowMs={nowMs}
            policyStatus={policyStatus}
            isTogglingEmptyPasswordPolicy={isTogglingEmptyPasswordPolicy}
            initialConfig={hostDraft}
            pendingHostPreset={pendingHostPreset}
            onClearPendingHostPreset={() => setPendingHostPreset(null)}
            onConfigChange={setHostDraft}
            onSelectFolder={shareBridge.selectFolder}
            onCreateShare={handleCreateShare}
            onRemoveShare={handleRemoveShare}
            onOpenFolder={handleOpenPath}
            onRefresh={() => handleRefreshTab({ inspectPolicy: true, tabLabel: '공유 개설' })}
            onOpenTroubleshootWizard={() => handleOpenTroubleshootWizard()}
            onToggleBlockEmptyPasswordAccounts={handleToggleBlockEmptyPasswordAccounts}
          />
        )}

        {activeSection === 'workspace' && roleMode === 'client' && (
          <ClientPanel
            peers={peers}
            mounts={mounts}
            steps={clientSteps}
            isScanning={isScanning}
            isConnecting={isClientConnecting || isLocationBatchApplying}
            isRefreshing={isRefreshingTab}
            portableShares={portableShares}
            locationSavedShares={activeLocationProfile?.savedShares || []}
            locationHostPreset={activeLocationProfile?.hostPreset || null}
            activeShares={shares}
            portableStatus={portableStatus}
            currentHostname={netInfo.hostname}
            hostPolicySnapshots={hostPolicySnapshots}
            localPolicyStatus={policyStatus}
            pendingAutoFillEntry={pendingAutoFillEntry}
            onClearPendingAutoFill={() => setPendingAutoFillEntry(null)}
            onPortableAutoFill={handlePortableAutoFillLog}
            initialConfig={clientDraft}
            pendingClientAuthMode={pendingClientAuthMode}
            pendingLocationTarget={pendingLocationTarget}
            savedLocationTargets={activeLocationProfile?.clientTargets || []}
            activeLocationName={activeLocationProfile?.locationName}
            onClearPendingClientAuthMode={() => setPendingClientAuthMode(null)}
            onClearPendingLocationTarget={() => setPendingLocationTarget(null)}
            onConfigChange={setClientDraft}
            onOpenMatrix={() => setActiveSection('matrix')}
            onOpenDiagnostics={(errText) => {
              void handleOpenDiagnostics(errText);
            }}
            onOpenTroubleshootWizard={() => handleOpenTroubleshootWizard()}
            onScanLan={handleScanLan}
            onRefresh={() => handleRefreshTab({ scanLan: true, inspectPolicy: true, tabLabel: '클라이언트 연결' })}
            onConnect={handleConnectClient}
            onUnmount={handleUnmount}
            onOpenDrive={handleOpenPath}
            onTargetHostChange={setActiveTargetHost}
            onAbshareTokenValidityChange={(valid) => {
              hasValidAbshareTokenRef.current = valid;
            }}
            onDeleteHostPolicySnapshot={handleDeleteHostPolicySnapshot}
            onDeletePortableShare={handleDeletePortableHostShare}
          />
        )}

        {activeSection === 'matrix' && (
          <NetworkMatrixPanel
            netInfo={netInfo}
            policyStatus={policyStatus}
            hostPolicySnapshots={hostPolicySnapshots}
            pendingHostActions={pendingHostActions}
            portableShares={portableShares}
            mountedDrives={mounts}
            activeShareCount={shares.length}
            activeMountCount={mounts.length}
            lastPatchResult={lastPatchResult}
            lastAutoAlignResult={lastAutoAlignResult}
            isInspecting={isPolicyInspecting}
            isRefreshing={isRefreshingTab}
            isAutoAligning={isAutoAligning}
            isApplyingPendingHostTask={isApplyingPendingHostTask}
            isApplyingMode={applyingPatchMode}
            onInspectPolicy={handleInspectOsPolicy}
            onRefresh={() => handleRefreshTab({ inspectPolicy: true, tabLabel: 'OS 호환성 매트릭스' })}
            onApplyPatch={handleApplyOsPatch}
            onSyncMatchedPolicies={handleSyncMatchedPolicies}
            onFullSecurityRollback={handleFullSecurityRollback}
            onProbeRemoteHost={handlePingHost}
            onSavePendingHostTask={handleSavePendingHostTask}
            onDeletePendingHostTask={handleDeletePendingHostTask}
            onApplyPendingHostTask={handleApplyPendingHostTask}
            onTriggerReboot={handleTriggerReboot}
            onOpenWindowsUpdate={handleOpenWindowsUpdate}
            onNotify={showToast}
            onDeleteHostPolicySnapshot={handleDeleteHostPolicySnapshot}
            onClearAllHostPolicySnapshots={handleClearAllHostPolicySnapshots}
            troubleshootTickets={troubleshootTickets}
            troubleshootMatch={troubleshootMatch}
            onOpenTroubleshootWizard={handleOpenTroubleshootWizard}
          />
        )}

        {activeSection === 'legacy' && (
          <LegacySharingPanel
            netInfo={netInfo}
            policyStatus={policyStatus}
            lastPatchResult={lastPatchResult}
            rollbackSnapshot={legacyRollbackSnapshot}
            shares={shares}
            mounts={mounts}
            peers={peers}
            portableShares={portableShares}
            portableStatus={portableStatus}
            hostSteps={legacyHostSteps}
            clientSteps={legacyClientSteps}
            nowMs={nowMs}
            isInspecting={isPolicyInspecting}
            isRefreshing={isRefreshingTab}
            isScanning={isScanning}
            isHostExecuting={isHostExecuting}
            isClientConnecting={isClientConnecting}
            isApplyingMode={applyingPatchMode}
            onInspectPolicy={handleInspectOsPolicy}
            onRefresh={() => handleRefreshTab({ scanLan: true, inspectPolicy: true, tabLabel: '구형 OS 공유' })}
            onApplyPatch={handleApplyOsPatch}
            onSelectFolder={shareBridge.selectFolder}
            onCreateLegacyHostShare={handleCreateLegacyHostShare}
            onRemoveShare={handleRemoveShare}
            onScanLan={handleScanLan}
            onConnectLegacyClient={handleConnectLegacyClient}
            onUnmount={handleUnmount}
            onOpenPath={handleOpenPath}
            onExportBundle={handleExportLegacyBundle}
            onTriggerReboot={handleTriggerReboot}
            onBridgeImported={handleBridgeImported}
            onOpenMatrix={() => setActiveSection('matrix')}
            onOpenDiagnostics={(errText) => {
              void handleOpenDiagnostics(errText);
            }}
            onOpenTroubleshootWizard={() => handleOpenTroubleshootWizard()}
            onNotify={showToast}
          />
        )}

        {activeSection === 'logs' && (
          <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  작업 실행 이력 ({activityLog.length})
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono break-all">
                  {appLogInfo?.supported && appLogInfo.directory
                    ? `로그 파일 자동 저장: ${appLogInfo.currentFilePath || appLogInfo.directory}${
                        appLogInfo.writeProtected ? ' (쓰기 금지 감지됨)' : ''
                      }`
                    : '앱 실행 폴더 하위 log\\AhBiShare_YYYY-MM-DD.log 파일에 자동 기록됩니다.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {appLogInfo?.supported && appLogInfo.directory && (
                  <button
                    id="btn-open-log-folder"
                    type="button"
                    onClick={() => void handleOpenPath(appLogInfo.directory)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    로그 폴더 열기
                  </button>
                )}
                <button
                  id="btn-refresh-logs"
                  type="button"
                  disabled={isRefreshingTab}
                  onClick={() => void handleRefreshTab({ inspectPolicy: true, tabLabel: '실행 이력' })}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingTab ? 'animate-spin text-indigo-500' : ''}`} />
                  {isRefreshingTab ? '새로고침 중...' : '새로고침'}
                </button>
                {activityLog.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActivityLog([])}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    이력 비우기
                  </button>
                )}
              </div>
            </div>
            {activityLog.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                실행된 공유 개설 또는 클라이언트 연결 이력이 아직 없습니다.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {activityLog.map((entry) => (
                  <li key={entry.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="tabular-data text-xs text-slate-400 shrink-0">{entry.time}</span>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {entry.role}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 truncate">{entry.summary}</span>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        entry.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {entry.status === 'success' ? '성공' : '실패'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeSection === 'rollback' && (
          <RollbackPanel
            netInfo={netInfo}
            policyStatus={policyStatus}
            activeShareCount={shares.length}
            activeMountCount={mounts.length}
            isInspecting={isPolicyInspecting}
            isRefreshing={isRefreshingTab}
            onRollback={handleRollback}
            onFullSecurityRollback={handleFullSecurityRollback}
            onInspectPolicy={handleInspectOsPolicy}
            onRefresh={() => handleRefreshTab({ inspectPolicy: true, tabLabel: '보안 원복' })}
            onRestoreDefaults={handleSyncMatchedPolicies}
            onNotify={showToast}
          />
        )}
      </main>

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[60] max-w-md px-4 py-3 text-xs font-medium text-white bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-lg shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="tabular-data font-medium text-slate-700 dark:text-slate-300">
              AhBiShare OneClick v{APP_VERSION} · Copyright © 1998-2026 AhBiYout. All rights reserved.
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <button
                id="btn-footer-check-updates"
                type="button"
                disabled={isCheckingUpdates}
                onClick={() => void runUpdateCheck(true)}
                className="hover:text-slate-900 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer disabled:opacity-50"
              >
                {isCheckingUpdates ? '업데이트 확인 중...' : 'GitHub 업데이트 확인'}
              </button>
              <button
                type="button"
                onClick={() => void handleOpenDiagnostics()}
                className="hover:text-slate-900 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer"
              >
                SMB 서비스 및 포트 445 점검
              </button>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
            <span className="font-semibold text-slate-600 dark:text-slate-300">제작자 및 공식 채널 안내</span>
            <span>개발자 · 저작권: <strong className="text-slate-800 dark:text-slate-200">AhBiYout</strong></span>
            <span>
              소속회사:{' '}
              <a
                href="https://www.cisnet.co.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2 font-medium"
              >
                (주)청운정보시스템 (cisnet.co.kr)
              </a>
            </span>
            <span>
              GitHub 저장소:{' '}
              <a
                href="https://github.com/ahbiyout-all/AhBiShare-OneClick"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2"
              >
                github.com/ahbiyout-all/AhBiShare-OneClick
              </a>
            </span>
            <span>
              공식 구글 블로그:{' '}
              <a
                href="https://ahbiyoutvibe.blogspot.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2"
              >
                ahbiyoutvibe.blogspot.com
              </a>
            </span>
          </div>
        </div>
      </footer>

      <DiagnosticsModal
        isOpen={diagOpen}
        isLoading={diagLoading}
        checks={diagChecks}
        defaultTargetHost={activeTargetHost || clientDraft.targetHost || peers[0]?.ipAddress || ''}
        defaultShareName={clientDraft.shareName || 'AhBiShared'}
        activeErrorCode={diagErrorText}
        failedErrorText={diagErrorText}
        suggestedTargets={suggestedTargets}
        policyStatus={policyStatus}
        onOpenMatrix={() => setActiveSection('matrix')}
        onSwitchToAccountMode={() => {
          setClientDraft((prev) => ({ ...prev, authMode: 'account' }));
          setPendingClientAuthMode({ key: String(Date.now()), authMode: 'account' });
          setRoleMode('client');
          setActiveSection('workspace');
          showToast('보안 계정 모드로 전환되었습니다. 계정 정보를 확인하고 연결을 실행하세요.');
        }}
        onPingHost={handlePingHost}
        onClose={() => {
          setDiagOpen(false);
          setDiagErrorText(null);
        }}
        onRerun={() => void handleOpenDiagnostics(diagErrorText || undefined)}
      />

      <UpdateModal
        isOpen={updateModalOpen}
        currentVersion={APP_VERSION}
        release={latestRelease}
        osBuild={policyStatus?.osBuild || netInfo.osBuild}
        isRechecking={isCheckingUpdates}
        onRecheck={() => void runUpdateCheck(true)}
        onSkipVersion={(tag) => {
          skipUpdateTag(tag);
          showToast(`${tag} 버전 자동 알림을 건너뜁니다. 상단/하단 버튼에서 언제든 다시 확인할 수 있습니다.`);
        }}
        onClose={() => setUpdateModalOpen(false)}
      />

      <LocationManagerModal
        isOpen={locationModalOpen}
        initialTab={locationModalTab}
        initialEditProfileId={locationModalEditProfileId}
        netInfo={netInfo}
        profiles={locationProfiles}
        storageDirectory={locationStorageDir}
        activeProfile={activeLocationProfile}
        hostDraft={hostDraft}
        activeShares={shares}
        clientDraft={clientDraft}
        mountedDrives={mounts}
        isBatchApplying={isLocationBatchApplying}
        onClose={() => {
          setLocationModalOpen(false);
          setLocationModalEditProfileId(null);
        }}
        onSelectFolder={shareBridge.selectFolder}
        onSaveProfile={handleSaveLocationProfile}
        onLoadProfileForEdit={handleLoadLocationProfileForEdit}
        onUpdateProfile={handleUpdateLocationProfile}
        onSelectProfile={async (id) => {
          await handleSelectLocationProfile(id);
          setLocationModalOpen(false);
          setLocationModalEditProfileId(null);
        }}
        onBatchApplyProfile={handleBatchApplyLocation}
        onExportProfile={handleExportLocationProfile}
        onImportJsonFile={handleImportLocationJson}
        onDeleteProfile={handleDeleteLocationProfile}
      />

      <LocationPreflightModal
        isOpen={preflightModalOpen}
        isChecking={preflightChecking}
        isExecuting={isLocationBatchApplying}
        profile={preflightTargetProfile}
        report={preflightReport}
        onClose={() => {
          preflightSeqRef.current += 1;
          setPreflightChecking(false);
          setPreflightModalOpen(false);
        }}
        onRerun={() => {
          if (!preflightTargetProfile) return;
          void (async () => {
            const fresh = await shareBridge.loadLocationProfile(preflightTargetProfile.profileId);
            const target = fresh.success && fresh.profile ? fresh.profile : preflightTargetProfile;
            await runPreflightCheckForProfile(target);
          })();
        }}
        onEditProfile={(profileId) => {
          preflightSeqRef.current += 1;
          setPreflightChecking(false);
          setPreflightModalOpen(false);
          setLocationModalTab('manage');
          setLocationModalEditProfileId(profileId);
          setLocationModalOpen(true);
        }}
        onConfirmExecute={() => {
          if (!preflightTargetProfile) return;
          void executeBatchApplyLocation(preflightTargetProfile, preflightReport);
        }}
      />

      <TroubleshootWizardModal
        isOpen={troubleshootWizardOpen}
        tickets={troubleshootTickets}
        selectedTicketId={selectedTroubleshootTicketId}
        matchResult={troubleshootMatch}
        netInfo={netInfo}
        writeProtected={portableStatus.writeProtected}
        policyStatus={policyStatus}
        lastPatchResult={lastPatchResult}
        pendingHostTask={myPendingHostTask}
        onOpenMatrix={() => {
          setTroubleshootWizardOpen(false);
          setActiveSection('matrix');
        }}
        onTriggerReboot={handleTriggerReboot}
        onSelectTicket={setSelectedTroubleshootTicketId}
        onClose={() => setTroubleshootWizardOpen(false)}
        onExecuteStep={handleExecuteTroubleshootStep}
        onSkipStep={handleSkipTroubleshootStep}
        onVerifyTargetReachability={handleVerifyTroubleshootTarget}
        onMarkResolved={handleMarkTroubleshootResolved}
        onDeleteTicket={handleDeleteTroubleshootTicket}
        onClearResolved={handleClearResolvedTroubleshootTickets}
      />

      <WorkProgressModal
        job={progressJob}
        onClose={closeProgressModal}
        onOpenDiagnostics={(errText) => {
          void handleOpenDiagnostics(errText);
        }}
      />

      <input
        ref={locationFileInputRef}
        type="file"
        accept=".json,application/json"
        aria-label="사용장소 프로필 JSON 파일 선택"
        onChange={(e) => void handleWebLocationFileSelected(e)}
        className="hidden"
      />
    </div>
  );
};

export default App;
