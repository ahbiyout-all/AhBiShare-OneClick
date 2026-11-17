import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, Laptop, Sun, Moon, ShieldAlert, Usb, AlertTriangle, Clock, RotateCcw, X } from 'lucide-react';
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
} from '@/types/share';
import { isElectronRuntime, shareBridge, sortPortableEntriesForClient } from '@/services/shareBridge';
import { generateSecureSharePassword } from '@/utils/connectionCode';
import { formatEraShortLabel } from '@/services/networkEvolution';
import { TopBar } from '@/components/TopBar';
import { HostPanel } from '@/components/HostPanel';
import { ClientPanel } from '@/components/ClientPanel';
import { RollbackPanel } from '@/components/RollbackPanel';
import { NetworkMatrixPanel } from '@/components/NetworkMatrixPanel';
import { LegacySharingPanel } from '@/components/LegacySharingPanel';
import { LocationProfileBar } from '@/components/LocationProfileBar';
import { LocationManagerModal } from '@/components/LocationManagerModal';
import { DiagnosticsModal, SuggestedPingTarget } from './components/DiagnosticsModal';
import { UpdateModal } from './components/UpdateModal';
import { checkForUpdates, ReleaseInfo } from './services/updateChecker';

interface ActivityEntry {
  id: string;
  time: string;
  role: string;
  summary: string;
  status: 'success' | 'error';
}

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagChecks, setDiagChecks] = useState<DiagnosticCheck[]>([]);
  const [activeTargetHost, setActiveTargetHost] = useState('');

  const [portableShares, setPortableShares] = useState<PortableHostShareEntry[]>([]);
  const [portableStatus, setPortableStatus] = useState<PortableStorageStatus>(() => shareBridge.getPortableSnapshot().status);
  const [hostPolicySnapshots, setHostPolicySnapshots] = useState<Record<string, HostPolicySnapshot>>({});
  const [pendingAutoFillEntry, setPendingAutoFillEntry] = useState<PortableHostShareEntry | null>(null);

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
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [applyingPatchMode, setApplyingPatchMode] = useState<PolicyPatchMode | null>(null);
  const [legacyHostSteps, setLegacyHostSteps] = useState<PipelineStep[]>([]);
  const [legacyClientSteps, setLegacyClientSteps] = useState<PipelineStep[]>([]);

  const [locationProfiles, setLocationProfiles] = useState<LocationProfileSummary[]>([]);
  const [locationStorageDir, setLocationStorageDir] = useState<string>('locations');
  const [activeLocationProfile, setActiveLocationProfile] = useState<LocationProfileFile | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTab, setLocationModalTab] = useState<'save' | 'manage'>('manage');
  const [isLocationBatchApplying, setIsLocationBatchApplying] = useState(false);
  const [locationBatchProgress, setLocationBatchProgress] = useState<string | null>(null);
  const [lastLocationBatchResult, setLastLocationBatchResult] = useState<LocationBatchApplyResult | null>(null);
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
  const [pendingLocationTarget, setPendingLocationTarget] = useState<{
    key: string;
    target: LocationClientTargetEntry;
  } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    checkForUpdates('1.0.0').then((res: { hasUpdate: boolean; release?: ReleaseInfo }) => {
      if (res.hasUpdate && res.release) {
        setLatestRelease(res.release);
        setUpdateModalOpen(true);
      }
    });
  }, []);

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
  }, []);

  const refreshPortableSnapshot = useCallback((hostname: string) => {
    const snap = shareBridge.getPortableSnapshot();
    setPortableShares(sortPortableEntriesForClient(snap.document.shares, hostname));
    setPortableStatus(snap.status);
    setHostPolicySnapshots(snap.document.hostPolicies ? { ...snap.document.hostPolicies } : {});
  }, []);

  const refreshLocationProfiles = useCallback(async () => {
    try {
      const listRes = await shareBridge.listLocationProfiles();
      setLocationProfiles(listRes.profiles);
      if (listRes.directory) setLocationStorageDir(listRes.directory);
    } catch {}
  }, []);

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
        refreshPortableSnapshot(info.hostname);
      } catch {
        setShares(shareBridge.getSavedShares());
        setMounts(shareBridge.getSavedMounts());
      }
      await refreshLocationProfiles();
    };
    void bootstrap();
  }, [appendLog, refreshPortableSnapshot, refreshLocationProfiles]);

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
    setIsPolicyInspecting(true);
    setLastAutoAlignResult(null);
    try {
      const pol = await shareBridge.inspectOsNetworkPolicy(netInfo);
      setPolicyStatus(pol);
      refreshPortableSnapshot(netInfo.hostname);
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
  }, [netInfo, appendLog, showToast, refreshPortableSnapshot]);

  const handleApplyOsPatch = useCallback(
    async (mode: PolicyPatchMode) => {
      setApplyingPatchMode(mode);
      setLastAutoAlignResult(null);
      try {
        const res = await shareBridge.applyOsCompatibilityPatch(mode, netInfo);
        setLastPatchResult(res);
        setPolicyStatus(res.updatedPolicy);
        setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
        refreshPortableSnapshot(netInfo.hostname);
        appendLog(
          'OS 정책 적용',
          `${res.summary} · ${res.rebootJudgment.title}`,
          res.success ? 'success' : 'error'
        );
        showToast(`${res.rebootJudgment.title}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('OS 정책 적용', `정책 적용 예외: ${msg}`, 'error');
        showToast(`정책 적용 실패: ${msg}`);
      } finally {
        setApplyingPatchMode(null);
      }
    },
    [netInfo, appendLog, showToast, refreshPortableSnapshot]
  );

  const handleSyncMatchedPolicies = useCallback(
    async (modes: PolicyPatchMode[]) => {
      if (modes.length === 0) return;
      setIsAutoAligning(true);
      try {
        const batch = await shareBridge.autoAlignHostClientPolicies(modes, netInfo);
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
        refreshPortableSnapshot(netInfo.hostname);
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('자동 정렬', `정책 자동 정렬 예외: ${msg}`, 'error');
        showToast(`정책 자동 정렬 실패: ${msg}`);
      } finally {
        setIsAutoAligning(false);
      }
    },
    [netInfo, appendLog, showToast, refreshPortableSnapshot]
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
    setIsHostExecuting(true);
    try {
      const freshNet = await shareBridge.getLocalNetworkInfo();
      setNetInfo(freshNet);
      const res = await shareBridge.runHostOneClick(config, freshNet, (steps) => setHostSteps(steps));
      if (res.success && res.share) {
        const createdLower = res.share.shareName.toLowerCase();
        setExpiryAlerts((prev) => prev.filter((a) => a.shareName.toLowerCase() !== createdLower));
        setShares(shareBridge.getSavedShares());
        refreshPortableSnapshot(freshNet.hostname);
        const updatedPeers = await shareBridge.scanLanPeers(freshNet);
        setPeers(updatedPeers);
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
      } else {
        appendLog('메인 PC', `공유폴더(${config.shareName}) 구성 중 오류가 발생했습니다.`, 'error');
        showToast('공유폴더 구성 중 일부 단계에서 오류가 발생했습니다.');
      }
    } catch (err) {
      appendLog('메인 PC', `공유폴더 구성 예외: ${err instanceof Error ? err.message : '알 수 없는 오류'}`, 'error');
      showToast('공유폴더 구성 중 예외가 발생했습니다.');
    } finally {
      setIsHostExecuting(false);
    }
  };

  const handleRemoveShare = async (shareName: string) => {
    try {
      const updated = await shareBridge.removeHostShare(shareName, netInfo);
      const removedLower = shareName.toLowerCase();
      setExpiryAlerts((prev) => prev.filter((a) => a.shareName.toLowerCase() !== removedLower));
      setShares(updated);
      refreshPortableSnapshot(netInfo.hostname);
      const updatedPeers = await shareBridge.scanLanPeers(netInfo);
      setPeers(updatedPeers);
      appendLog('메인 PC', `공유폴더 '${shareName}' 공유 해제 및 USB 포터블 기록 갱신`, 'success');
      showToast(`'${shareName}' 공유가 해제되었습니다.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : '알 수 없는 오류';
      appendLog('메인 PC', `공유폴더 '${shareName}' 해제 실패: ${reason}`, 'error');
      showToast(`'${shareName}' 공유 해제 실패: ${reason}`);
    }
  };

  const handleScanLan = async () => {
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
    setIsClientConnecting(true);
    try {
      const res = await shareBridge.runClientOneClick(config, (steps) => setClientSteps(steps), netInfo.osEra);
      if (res.success && res.mount) {
        setMounts(shareBridge.getSavedMounts());
        refreshPortableSnapshot(netInfo.hostname);
        appendLog('클라이언트 PC', `${res.mount.uncPath} → ${res.mount.driveLetter} 연결 완료`, 'success');
        showToast(`${res.mount.driveLetter} 드라이브가 성공적으로 연결되었습니다.`);
      } else {
        appendLog('클라이언트 PC', `\\\\${config.targetHost}\\${config.shareName} 연결 실패`, 'error');
        showToast('연결에 실패했습니다. 파이프라인 단계 오류를 확인하세요.');
      }
    } catch (err) {
      appendLog('클라이언트 PC', `연결 예외: ${err instanceof Error ? err.message : '알 수 없는 오류'}`, 'error');
      showToast('연결 실행 중 예외가 발생했습니다.');
    } finally {
      setIsClientConnecting(false);
    }
  };

  const handleCreateLegacyHostShare = async (config: HostConfig, targetOs: LegacyTargetOs) => {
    const osTag = targetOs === 'win7' ? 'Win 7(SMB 2.1)' : 'Win 8/8.1(SMB 3.0)';
    const bridgeStepId = 'legacy-bridge-host';
    setIsHostExecuting(true);
    setLegacyHostSteps([
      {
        id: bridgeStepId,
        title: `${osTag} 호환 브릿지 정책 정렬 및 사전 스냅샷 백업`,
        detail: 'SMB 비암호화 접근 허용 · 서명 완화 · NTLMv2 고정 · 스냅샷 저장',
        status: 'running',
      },
    ]);

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
      setLegacyHostSteps([bridgeStep]);

      if (!bridgeRes.success) {
        appendLog('구형 OS 메인', `브릿지 정책 적용 실패: ${bridgeRes.summary}`, 'error');
        showToast('구형 OS 호환 브릿지 적용에 실패했습니다.');
        return;
      }

      const shareRes = await shareBridge.runHostOneClick(config, freshNet, (steps) => {
        setHostSteps(steps);
        setLegacyHostSteps([bridgeStep, ...steps]);
      });

      if (shareRes.success && shareRes.share) {
        const createdLower = shareRes.share.shareName.toLowerCase();
        setExpiryAlerts((prev) => prev.filter((a) => a.shareName.toLowerCase() !== createdLower));
        setShares(shareBridge.getSavedShares());
        refreshPortableSnapshot(freshNet.hostname);
        const updatedPeers = await shareBridge.scanLanPeers(freshNet);
        setPeers(updatedPeers);
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
      } else {
        appendLog('구형 OS 메인', `공유폴더(${config.shareName}) 개설 중 오류 발생`, 'error');
        showToast('공유폴더 개설 단계에서 오류가 발생했습니다.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setLegacyHostSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'error', error: msg } : s))
      );
      appendLog('구형 OS 메인', `통합 개설 예외: ${msg}`, 'error');
      showToast(`구형 OS 메인 개설 실패: ${msg}`);
    } finally {
      setIsHostExecuting(false);
    }
  };

  const handleConnectLegacyClient = async (config: ClientTargetConfig, targetOs: LegacyTargetOs) => {
    const osTag = targetOs === 'win7' ? 'Win 7(SMB 2.1)' : 'Win 8/8.1(SMB 3.0)';
    const bridgeStepId = 'legacy-bridge-client';
    setIsClientConnecting(true);
    setLegacyClientSteps([
      {
        id: bridgeStepId,
        title: `${osTag} 호환 브릿지 정렬 및 사전 스냅샷 백업`,
        detail: '게스트 로그온 허용 · 서명 완화 · NTLMv2 고정 · 스냅샷 저장',
        status: 'running',
      },
    ]);

    try {
      const freshNet = await shareBridge.getLocalNetworkInfo();
      setNetInfo(freshNet);
      const t0 = performance.now();
      const bridgeRes = await shareBridge.applyOsCompatibilityPatch('legacy_bridge_compat', freshNet);
      const bridgeStep: PipelineStep = {
        id: bridgeStepId,
        title: `${osTag} 호환 브릿지 정렬 및 사전 스냅샷 백업`,
        detail: bridgeRes.summary,
        status: bridgeRes.success ? 'success' : 'error',
        durationMs: Math.round(performance.now() - t0),
        output: bridgeRes.success ? bridgeRes.rebootJudgment.title : undefined,
        error: bridgeRes.success ? undefined : bridgeRes.summary,
      };
      setLastPatchResult(bridgeRes);
      setPolicyStatus(bridgeRes.updatedPolicy);
      setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
      setLegacyClientSteps([bridgeStep]);

      if (!bridgeRes.success) {
        appendLog('구형 OS 클라이언트', `브릿지 정렬 실패: ${bridgeRes.summary}`, 'error');
        showToast('구형 OS 호환 브릿지 정렬에 실패했습니다.');
        return;
      }

      const mountRes = await shareBridge.runClientOneClick(
        config,
        (steps) => {
          setClientSteps(steps);
          setLegacyClientSteps([bridgeStep, ...steps]);
        },
        freshNet.osEra
      );

      if (mountRes.success && mountRes.mount) {
        setMounts(shareBridge.getSavedMounts());
        refreshPortableSnapshot(freshNet.hostname);
        appendLog(
          '구형 OS 클라이언트',
          `${osTag} 브릿지 + ${mountRes.mount.uncPath} → ${mountRes.mount.driveLetter} 통합 연결 완료`,
          'success'
        );
        showToast(`${mountRes.mount.driveLetter} 드라이브가 구형 OS 호환 모드로 연결되었습니다.`);
      } else {
        appendLog('구형 OS 클라이언트', `\\\\${config.targetHost}\\${config.shareName} 연결 실패`, 'error');
        showToast('클라이언트 연결에 실패했습니다. 파이프라인 처방 가이드를 확인하세요.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setLegacyClientSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'error', error: msg } : s))
      );
      appendLog('구형 OS 클라이언트', `통합 연결 예외: ${msg}`, 'error');
      showToast(`구형 OS 클라이언트 연결 실패: ${msg}`);
    } finally {
      setIsClientConnecting(false);
    }
  };

  const handleUnmount = async (driveLetter: string) => {
    try {
      const updated = await shareBridge.unmountDrive(driveLetter);
      setMounts(updated);
      appendLog('클라이언트 PC', `${driveLetter} 드라이브 연결 해제`, 'success');
      showToast(`${driveLetter} 드라이브 연결이 해제되었습니다.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : '알 수 없는 오류';
      appendLog('클라이언트 PC', `${driveLetter} 드라이브 해제 실패: ${reason}`, 'error');
      showToast(`${driveLetter} 드라이브 해제 실패: ${reason}`);
    }
  };

  const handleOpenPath = async (targetPath: string) => {
    const res = await shareBridge.openLocalOrUncPath(targetPath);
    if (res.message) showToast(res.message);
  };

  const handleRollback = async (scope: 'host' | 'client') => {
    const res = await shareBridge.rollbackPolicies(scope, netInfo);
    setShares(shareBridge.getSavedShares());
    setMounts(shareBridge.getSavedMounts());
    if (scope === 'host') {
      setExpiryAlerts([]);
      const updatedPeers = await shareBridge.scanLanPeers(netInfo);
      setPeers(updatedPeers);
    }
    try {
      const pol = await shareBridge.inspectOsNetworkPolicy(netInfo);
      setPolicyStatus(pol);
    } catch {}
    setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
    refreshPortableSnapshot(netInfo.hostname);
    appendLog(scope === 'host' ? '메인 PC' : '클라이언트 PC', res.message, res.success ? 'success' : 'error');
    return res;
  };

  const handleExpirySecurityRollback = async () => {
    for (const alert of expiryAlerts) {
      if (!alert.autoRevoked) {
        try {
          await shareBridge.removeHostShare(alert.shareName, netInfo);
        } catch {}
      }
    }
    const rollbackRes = await shareBridge.rollbackPolicies('host', netInfo);
    const strictRes = await shareBridge.applyOsCompatibilityPatch('strict_26h2_default', netInfo);
    setShares(shareBridge.getSavedShares());
    setPolicyStatus(strictRes.updatedPolicy);
    setLegacyRollbackSnapshot(shareBridge.getLegacyRollbackSnapshot());
    refreshPortableSnapshot(netInfo.hostname);
    setExpiryAlerts([]);
    appendLog('만료 보안 원복', `${rollbackRes.message} · Win 11 26H2 표준 보안 복원 완료`, 'success');
    showToast('만료된 공유를 정리하고 Win 11 26H2 보안 기본값으로 원복했습니다.');
  };

  const handleOpenDiagnostics = async () => {
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
        const nextHost: HostConfig = {
          folderPath: profile.hostPreset.folderPath,
          shareName: profile.hostPreset.shareName,
          authMode: profile.hostPreset.authMode,
          permission: profile.hostPreset.permission,
          username: profile.hostPreset.username,
          password: profile.hostPreset.password || hostDraft.password,
          ttlMinutes: profile.hostPreset.ttlMinutes,
          autoRevokeOnExpiry: profile.hostPreset.autoRevokeOnExpiry,
        };
        setHostDraft(nextHost);
        setPendingHostPreset({ key: stamp, config: nextHost });
      } else if (profile.savedShares.length > 0) {
        const firstShare = profile.savedShares[0];
        const nextHost: HostConfig = {
          folderPath: firstShare.folderPath || 'C:\\AhBiShared',
          shareName: firstShare.shareName,
          authMode: firstShare.authMode,
          permission: firstShare.permission,
          username: firstShare.username || 'AhBiShare',
          password: firstShare.password || hostDraft.password,
          ttlMinutes: firstShare.ttlMinutes,
          autoRevokeOnExpiry: firstShare.autoRevokeOnExpiry,
        };
        setHostDraft(nextHost);
        setPendingHostPreset({ key: stamp, config: nextHost });
      }

      if (profile.clientTargets.length > 0) {
        const firstTarget = profile.clientTargets[0];
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
    [hostDraft.password, appendLog, showToast]
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
      setIsLocationBatchApplying(true);
      setLocationBatchProgress(`'${targetProfile.locationName}' 설정 일괄 적용 준비 중...`);
      try {
        const freshNet = await shareBridge.getLocalNetworkInfo();
        setNetInfo(freshNet);
        const batchRes = await shareBridge.applyLocationProfileBatch(targetProfile, freshNet, {
          onHostSteps: (steps) => setHostSteps(steps),
          onClientSteps: (steps) => setClientSteps(steps),
          onProgressText: (text) => setLocationBatchProgress(text),
        });
        setShares(shareBridge.getSavedShares());
        setMounts(shareBridge.getSavedMounts());
        refreshPortableSnapshot(freshNet.hostname);
        const updatedPeers = await shareBridge.scanLanPeers(freshNet);
        setPeers(updatedPeers);
        setLastLocationBatchResult(batchRes);
        appendLog('장소 일괄 적용', batchRes.summary, batchRes.success ? 'success' : 'error');
        showToast(batchRes.summary);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        appendLog('장소 일괄 적용', `실행 예외: ${msg}`, 'error');
        showToast(`사용장소 일괄 적용 실패: ${msg}`);
      } finally {
        setIsLocationBatchApplying(false);
        setLocationBatchProgress(null);
      }
    },
    [activeLocationProfile, applyLocationProfileToWorkspace, refreshPortableSnapshot, appendLog, showToast]
  );

  return (
    <div className={`${isEmbedded ? 'min-h-full' : 'min-h-screen'} flex flex-col bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100`}>
      <TopBar
        activeSection={activeSection}
        roleMode={roleMode}
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
                ? `실행 파일 폴더(${portableStatus.directory})가 쓰기 금지 상태이므로 변경 사항이 USB ${portableStatus.fileName}에 자동 저장되지 않습니다.`
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

        {activeSection === 'workspace' && (
          <LocationProfileBar
            profiles={locationProfiles}
            activeProfile={activeLocationProfile}
            isBatchApplying={isLocationBatchApplying}
            batchProgressText={locationBatchProgress}
            lastBatchResult={lastLocationBatchResult}
            onSelectProfile={(id) => void handleSelectLocationProfile(id)}
            onOpenSaveModal={() => {
              setLocationModalTab('save');
              setLocationModalOpen(true);
            }}
            onOpenManagerModal={() => {
              setLocationModalTab('manage');
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
            nowMs={nowMs}
            initialConfig={hostDraft}
            pendingHostPreset={pendingHostPreset}
            onClearPendingHostPreset={() => setPendingHostPreset(null)}
            onConfigChange={setHostDraft}
            onSelectFolder={shareBridge.selectFolder}
            onCreateShare={handleCreateShare}
            onRemoveShare={handleRemoveShare}
            onOpenFolder={handleOpenPath}
          />
        )}

        {activeSection === 'workspace' && roleMode === 'client' && (
          <ClientPanel
            peers={peers}
            mounts={mounts}
            steps={clientSteps}
            isScanning={isScanning}
            isConnecting={isClientConnecting || isLocationBatchApplying}
            portableShares={portableShares}
            portableStatus={portableStatus}
            currentHostname={netInfo.hostname}
            hostPolicySnapshots={hostPolicySnapshots}
            localPolicyStatus={policyStatus}
            pendingAutoFillEntry={pendingAutoFillEntry}
            onClearPendingAutoFill={() => setPendingAutoFillEntry(null)}
            onPortableAutoFill={handlePortableAutoFillLog}
            initialConfig={clientDraft}
            pendingLocationTarget={pendingLocationTarget}
            savedLocationTargets={activeLocationProfile?.clientTargets || []}
            activeLocationName={activeLocationProfile?.locationName}
            onClearPendingLocationTarget={() => setPendingLocationTarget(null)}
            onConfigChange={setClientDraft}
            onOpenMatrix={() => setActiveSection('matrix')}
            onScanLan={handleScanLan}
            onConnect={handleConnectClient}
            onUnmount={handleUnmount}
            onOpenDrive={handleOpenPath}
            onTargetHostChange={setActiveTargetHost}
          />
        )}

        {activeSection === 'matrix' && (
          <NetworkMatrixPanel
            netInfo={netInfo}
            policyStatus={policyStatus}
            hostPolicySnapshots={hostPolicySnapshots}
            lastPatchResult={lastPatchResult}
            lastAutoAlignResult={lastAutoAlignResult}
            isInspecting={isPolicyInspecting}
            isAutoAligning={isAutoAligning}
            isApplyingMode={applyingPatchMode}
            onInspectPolicy={handleInspectOsPolicy}
            onApplyPatch={handleApplyOsPatch}
            onSyncMatchedPolicies={handleSyncMatchedPolicies}
            onTriggerReboot={handleTriggerReboot}
            onOpenWindowsUpdate={handleOpenWindowsUpdate}
            onNotify={showToast}
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
            isScanning={isScanning}
            isHostExecuting={isHostExecuting}
            isClientConnecting={isClientConnecting}
            isApplyingMode={applyingPatchMode}
            onInspectPolicy={handleInspectOsPolicy}
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
            onNotify={showToast}
          />
        )}

        {activeSection === 'logs' && (
          <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                작업 실행 이력 ({activityLog.length})
              </h2>
              {activityLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActivityLog([])}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  이력 비우기
                </button>
              )}
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

        {activeSection === 'rollback' && <RollbackPanel onRollback={handleRollback} />}
      </main>

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-40 px-4 py-3 text-xs font-medium text-white bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-lg shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="tabular-data font-medium text-slate-700 dark:text-slate-300">
              AhBiShare OneClick v1.0.0 · Copyright © 1998-2026 AhBiYout. All rights reserved.
            </span>
            <button
              type="button"
              onClick={() => void handleOpenDiagnostics()}
              className="hover:text-slate-900 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer"
            >
              SMB 서비스 및 포트 445 점검
            </button>
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
        defaultTargetHost={activeTargetHost || peers[0]?.ipAddress || ''}
        suggestedTargets={suggestedTargets}
        policyStatus={policyStatus}
        onOpenMatrix={() => setActiveSection('matrix')}
        onPingHost={handlePingHost}
        onClose={() => setDiagOpen(false)}
        onRerun={() => void handleOpenDiagnostics()}
      />

      <UpdateModal
        isOpen={updateModalOpen}
        currentVersion="1.0.0"
        release={latestRelease}
        onClose={() => setUpdateModalOpen(false)}
      />

      <LocationManagerModal
        isOpen={locationModalOpen}
        initialTab={locationModalTab}
        netInfo={netInfo}
        profiles={locationProfiles}
        storageDirectory={locationStorageDir}
        activeProfile={activeLocationProfile}
        hostDraft={hostDraft}
        activeShares={shares}
        clientDraft={clientDraft}
        mountedDrives={mounts}
        isBatchApplying={isLocationBatchApplying}
        onClose={() => setLocationModalOpen(false)}
        onSaveProfile={handleSaveLocationProfile}
        onSelectProfile={async (id) => {
          await handleSelectLocationProfile(id);
          setLocationModalOpen(false);
        }}
        onBatchApplyProfile={handleBatchApplyLocation}
        onExportProfile={handleExportLocationProfile}
        onImportJsonFile={handleImportLocationJson}
        onDeleteProfile={handleDeleteLocationProfile}
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
