import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Radar, Link2, ExternalLink, Unplug, Check, AlertCircle, Usb, X, ArrowLeftRight, MapPin, KeyRound, Copy, Shield, Trash2, Eye, EyeOff, RefreshCw, Wrench, Loader2 } from 'lucide-react';
import {
  ActiveShare,
  ClientTargetConfig,
  DiscoveredPeer,
  HostPolicySnapshot,
  LocationClientTargetEntry,
  MountedDrive,
  OfflineDriveRecoveryPlan,
  OsNetworkPolicyStatus,
  PipelineStep,
  PortableHostShareEntry,
  PortableStorageStatus,
  ShareAuthProbeResult,
  SmartAuthDetectionResult,
} from '@/types/share';
import { decodeConnectionCode, resolveClientAccountCredentials, validateShareName, validateTargetHost } from '@/utils/connectionCode';
import {
  classifyFailureDiagnostics,
  computeHostClientPolicyDiff,
  findHostPolicySnapshot,
  formatSnapshotTimestamp,
} from '@/services/networkEvolution';
import { buildHostGuestUnlockPsCommand } from '@/services/powershellEngine';
import { shareBridge } from '@/services/shareBridge';
import { PipelineTracker } from './PipelineTracker';
import { PresetPasswordGrid } from './PresetPasswordGrid';
import { ShareAuthProbeBar } from './ShareAuthProbeBar';
import { useI18n } from '@/i18n/I18nContext';

interface ClientPanelProps {
  peers: DiscoveredPeer[];
  mounts: MountedDrive[];
  steps: PipelineStep[];
  isScanning: boolean;
  isConnecting: boolean;
  isRefreshing?: boolean;
  portableShares?: PortableHostShareEntry[];
  locationSavedShares?: PortableHostShareEntry[];
  locationHostPreset?: any;
  activeShares?: ActiveShare[];
  portableStatus?: PortableStorageStatus;
  currentHostname?: string;
  hostPolicySnapshots?: Record<string, HostPolicySnapshot>;
  localPolicyStatus?: OsNetworkPolicyStatus | null;
  pendingAutoFillEntry?: PortableHostShareEntry | null;
  onClearPendingAutoFill?: () => void;
  onPortableAutoFill?: (entry: PortableHostShareEntry) => void;
  initialConfig?: ClientTargetConfig;
  pendingClientAuthMode?: {
    key: string;
    authMode: 'guest' | 'account';
    switchedFrom?: 'guest' | 'account';
    targetHost?: string;
    shareName?: string;
    smartResult?: SmartAuthDetectionResult;
  } | null;
  pendingLocationTarget?: { key: string; target: LocationClientTargetEntry } | null;
  savedLocationTargets?: LocationClientTargetEntry[];
  activeLocationName?: string;
  onClearPendingClientAuthMode?: () => void;
  onClearPendingLocationTarget?: () => void;
  onConfigChange?: (config: ClientTargetConfig) => void;
  onAbshareTokenValidityChange?: (valid: boolean) => void;
  onOpenMatrix?: () => void;
  onScanLan: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onConnect: (config: ClientTargetConfig) => Promise<void>;
  onUnmount: (driveLetter: string) => Promise<void>;
  onOpenDrive: (drivePath: string) => Promise<void>;
  onTargetHostChange?: (host: string) => void;
  onOpenDiagnostics?: (errorText?: string) => void;
  onOpenTroubleshootWizard?: () => void;
  onDeleteHostPolicySnapshot?: (hostName: string) => Promise<void>;
  onDeletePortableShare?: (sourceHostName: string, shareName: string) => Promise<void>;
  offlineRecoveryPlans?: OfflineDriveRecoveryPlan[];
  isRecoveringDrives?: boolean;
  recoveringDriveLetter?: string | null;
  onRecoverSingleDrive?: (driveLetter: string) => Promise<void>;
  onRecoverAllOfflineDrives?: () => Promise<void>;
  onCleanAllOfflineDrives?: () => Promise<void>;
  onFillDriveForPassword?: (plan: OfflineDriveRecoveryPlan) => void;
}

const DRIVE_LETTERS = ['Z:', 'Y:', 'X:', 'W:', 'V:', 'S:', 'M:'];
const AUTO_PROBE_SWITCH_KEY = 'ahbishare_auto_probe_switch';

function makeShareTargetKey(host: string, share: string): string {
  return `${String(host || '').trim().toLowerCase()}::${String(share || '').trim().toLowerCase()}`;
}

export const ClientPanel: React.FC<ClientPanelProps> = ({
  peers,
  mounts,
  steps,
  isScanning,
  isConnecting,
  isRefreshing = false,
  portableShares = [],
  locationSavedShares = [],
  locationHostPreset = null,
  activeShares = [],
  portableStatus,
  currentHostname = '',
  hostPolicySnapshots = {},
  localPolicyStatus = null,
  pendingAutoFillEntry = null,
  onClearPendingAutoFill,
  onPortableAutoFill,
  initialConfig,
  pendingClientAuthMode = null,
  pendingLocationTarget = null,
  savedLocationTargets = [],
  activeLocationName,
  onClearPendingClientAuthMode,
  onClearPendingLocationTarget,
  onConfigChange,
  onAbshareTokenValidityChange,
  onOpenMatrix,
  onScanLan,
  onRefresh,
  onConnect,
  onUnmount,
  onOpenDrive,
  onTargetHostChange,
  onOpenDiagnostics,
  onOpenTroubleshootWizard,
  onDeleteHostPolicySnapshot,
  onDeletePortableShare,
  offlineRecoveryPlans = [],
  isRecoveringDrives = false,
  recoveringDriveLetter = null,
  onRecoverSingleDrive,
  onRecoverAllOfflineDrives,
  onCleanAllOfflineDrives,
  onFillDriveForPassword,
}) => {
  const { tx } = useI18n();
  const [rawCodeInput, setRawCodeInput] = useState('');
  const [codeParseState, setCodeParseState] = useState<'empty' | 'valid' | 'invalid'>('empty');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedPortableIdx, setSelectedPortableIdx] = useState(0);
  const [portableAppliedKey, setPortableAppliedKey] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [hostCmdCopied, setHostCmdCopied] = useState(false);
  const [confirmingDeletePortable, setConfirmingDeletePortable] = useState(false);
  const [deletingPortable, setDeletingPortable] = useState(false);
  const [deletingPolicySnap, setDeletingPolicySnap] = useState(false);
  const [showClientPass, setShowClientPass] = useState(false);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(AUTO_PROBE_SWITCH_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [probeResult, setProbeResult] = useState<ShareAuthProbeResult | null>(null);
  const [smartResult, setSmartResult] = useState<SmartAuthDetectionResult | null>(null);
  const [isProbingAuth, setIsProbingAuth] = useState(false);
  const [autoSwitchedTo, setAutoSwitchedTo] = useState<'guest' | 'account' | null>(null);
  const [autoSwitchedFrom, setAutoSwitchedFrom] = useState<'guest' | 'account' | null>(null);

  const hostCmdTimerRef = useRef<number | null>(null);
  const lastAuthModeSwitchKeyRef = useRef<string | null>(null);
  const probeSeqRef = useRef(0);
  const probeTimerRef = useRef<number | null>(null);
  const inFlightProbeRef = useRef<{
    key: string;
    seq: number;
    promise: Promise<ShareAuthProbeResult | null>;
  } | null>(null);
  const completedProbeRef = useRef<{ key: string; result: ShareAuthProbeResult | null } | null>(null);
  const suppressedAutoSwitchKeysRef = useRef<Set<string>>(new Set());

  const mountedSet = new Set(mounts.map((m) => m.driveLetter.toUpperCase()));

  const [config, setConfig] = useState<ClientTargetConfig>(() =>
    initialConfig || {
      targetHost: '192.168.0.10',
      shareName: 'WorkDocs',
      driveLetter: 'Z:',
      authMode: 'guest',
      username: '',
      password: '',
      persistent: true,
    }
  );
  const configRef = useRef(config);
  configRef.current = config;
  const autoSwitchEnabledRef = useRef(autoSwitchEnabled);
  autoSwitchEnabledRef.current = autoSwitchEnabled;
  const rawCodeRef = useRef(rawCodeInput);
  rawCodeRef.current = rawCodeInput;
  const codeParseStateRef = useRef(codeParseState);
  codeParseStateRef.current = codeParseState;
  const lastLocationTargetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const onAutoSwitchSync = (ev: Event) => {
      const customEv = ev as CustomEvent<boolean>;
      if (typeof customEv.detail === 'boolean') {
        setAutoSwitchEnabled(customEv.detail);
      }
    };
    window.addEventListener('ahbishare:autoswitch-changed', onAutoSwitchSync);
    return () => {
      window.removeEventListener('ahbishare:autoswitch-changed', onAutoSwitchSync);
      if (hostCmdTimerRef.current !== null) {
        window.clearTimeout(hostCmdTimerRef.current);
      }
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
      }
      probeSeqRef.current += 1;
      inFlightProbeRef.current = null;
    };
  }, []);

  useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  useEffect(() => {
    const valid = rawCodeInput.trim().startsWith('ABSHARE://') && codeParseState === 'valid';
    onAbshareTokenValidityChange?.(valid);
  }, [rawCodeInput, codeParseState, onAbshareTokenValidityChange]);

  // Automatically pick an available drive letter if the currently selected letter becomes occupied
  useEffect(() => {
    const occupied = new Set(mounts.map((m) => m.driveLetter.toUpperCase()));
    setConfig((prev) => {
      if (!occupied.has(prev.driveLetter.toUpperCase())) return prev;
      const nextFree = DRIVE_LETTERS.find((dl) => !occupied.has(dl));
      if (!nextFree || nextFree === prev.driveLetter) return prev;
      return { ...prev, driveLetter: nextFree };
    });
  }, [mounts]);

  useEffect(() => {
    if (!pendingLocationTarget || pendingLocationTarget.key === lastLocationTargetKeyRef.current) return;
    lastLocationTargetKeyRef.current = pendingLocationTarget.key;
    const t = pendingLocationTarget.target;
    setValidationError(null);
    setRawCodeInput('');
    setCodeParseState('empty');
    setAutoSwitchedTo(null);
    setAutoSwitchedFrom(null);
    setConfig({
      targetHost: t.targetHost,
      shareName: t.shareName,
      driveLetter: (t.driveLetter || 'Z:').replace(/:?$/, ':').toUpperCase(),
      authMode: t.authMode,
      username: t.authMode === 'account' ? t.username || '' : '',
      password: t.authMode === 'account' ? t.password || '' : '',
      persistent: t.persistent !== false,
    });
    onClearPendingLocationTarget?.();
  }, [pendingLocationTarget, onClearPendingLocationTarget]);

  const getHostCandidates = useCallback(
    (hostInput?: string, extra: Array<string | undefined> = []): string[] => {
      const norm = (val?: string) => String(val || '').trim().toLowerCase();
      const targetNorm = norm(hostInput);
      const matchedPeer = targetNorm
        ? peers.find((p) => norm(p.ipAddress) === targetNorm || norm(p.hostName) === targetNorm)
        : undefined;
      return Array.from(
        new Set(
          [...extra, matchedPeer?.hostName, matchedPeer?.ipAddress]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
        )
      );
    },
    [peers]
  );

  const switchToAccountMode = useCallback(
    (hostOverride?: unknown, shareOverride?: unknown) => {
      const targetHost = typeof hostOverride === 'string' ? hostOverride : configRef.current.targetHost;
      const shareName = typeof shareOverride === 'string' ? shareOverride : configRef.current.shareName;
      setValidationError(null);
      const resolved = resolveClientAccountCredentials({
        targetHost,
        hostCandidates: getHostCandidates(targetHost),
        shareName,
        requireAccountOnly: true,
        savedLocationTargets,
        locationSavedShares,
        locationHostPreset,
        portableShares,
        activeShares,
      });
      setConfig((prev) => ({
        ...prev,
        authMode: 'account',
        username: prev.username.trim() ? prev.username : resolved?.username || 'AhBiShare',
        password: prev.password ? prev.password : resolved?.password || '',
      }));
    },
    [
      getHostCandidates,
      savedLocationTargets,
      locationSavedShares,
      locationHostPreset,
      portableShares,
      activeShares,
    ]
  );

  const handleToggleAutoSwitch = (next: boolean) => {
    setAutoSwitchEnabled(next);
    autoSwitchEnabledRef.current = next;
    try {
      window.localStorage.setItem(AUTO_PROBE_SWITCH_KEY, next ? 'true' : 'false');
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent<boolean>('ahbishare:autoswitch-changed', { detail: next }));
    } catch {}
  };

  const runShareAuthProbe = useCallback(
    async (
      hostArg?: string,
      shareArg?: string,
      options?: { manual?: boolean; allowAutoSwitch?: boolean }
    ): Promise<ShareAuthProbeResult | null> => {
      const host = String(hostArg ?? configRef.current.targetHost).trim();
      const share = String(shareArg ?? configRef.current.shareName).trim();
      if (!host || !share || validateTargetHost(host) || validateShareName(share)) {
        completedProbeRef.current = null;
        inFlightProbeRef.current = null;
        setProbeResult(null);
        setSmartResult(null);
        setAutoSwitchedTo(null);
        setAutoSwitchedFrom(null);
        return null;
      }

      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }

      const key = makeShareTargetKey(host, share);
      if (options?.manual) {
        suppressedAutoSwitchKeysRef.current.delete(key);
        shareBridge.setSmartAuthSuppressed(host, share, false);
        completedProbeRef.current = null;
      }

      const seq = (probeSeqRef.current += 1);
      setIsProbingAuth(true);

      const probeTask = (async (): Promise<ShareAuthProbeResult | null> => {
        try {
          const initialCfg = configRef.current;
          const initialValidAbshare =
            rawCodeRef.current.trim().startsWith('ABSHARE://') && codeParseStateRef.current === 'valid';
          const isSuppressed =
            suppressedAutoSwitchKeysRef.current.has(key) || shareBridge.isSmartAuthSuppressed(host, share);
          const initialDetection = await shareBridge.detectSmartShareAuth({
            targetHost: host,
            shareName: share,
            currentAuthMode: initialCfg.authMode,
            hasTypedPassword: Boolean(initialCfg.password),
            autoSwitchEnabled: options?.allowAutoSwitch !== false && autoSwitchEnabledRef.current,
            suppressed: isSuppressed,
            hasValidAbshareToken: initialValidAbshare,
            forceProbe: Boolean(options?.manual),
            peers,
            savedLocationTargets,
            locationSavedShares,
            locationHostPreset,
            portableShares,
            activeShares,
          });
          if (seq !== probeSeqRef.current) return null;

          const curCfg = configRef.current;
          const stillSameTarget = makeShareTargetKey(curCfg.targetHost, curCfg.shareName) === key;
          const hasValidAbshareToken =
            rawCodeRef.current.trim().startsWith('ABSHARE://') && codeParseStateRef.current === 'valid';
          const decision = stillSameTarget
            ? shareBridge.evaluateSmartAuthDecision(
                initialDetection.probe,
                {
                  currentAuthMode: curCfg.authMode,
                  hasTypedPassword: Boolean(curCfg.password),
                  autoSwitchEnabled: options?.allowAutoSwitch !== false && autoSwitchEnabledRef.current,
                  suppressed:
                    suppressedAutoSwitchKeysRef.current.has(key) || shareBridge.isSmartAuthSuppressed(host, share),
                  hasValidAbshareToken,
                  peers,
                  savedLocationTargets,
                  locationSavedShares,
                  locationHostPreset,
                  portableShares,
                  activeShares,
                },
                initialDetection.fromCache
              )
            : initialDetection;

          completedProbeRef.current = { key, result: decision.probe };
          setIsProbingAuth(false);
          setProbeResult(decision.probe);
          setSmartResult(decision);

          if (stillSameTarget && decision.action === 'auto_switch' && decision.switchToMode) {
            if (decision.switchToMode === 'account') {
              setValidationError(null);
              setConfig((prev) => ({
                ...prev,
                authMode: 'account',
                username: prev.username.trim() ? prev.username : decision.suggestedUsername || 'AhBiShare',
                password: prev.password ? prev.password : decision.suggestedPassword || '',
              }));
              setAutoSwitchedTo('account');
              setAutoSwitchedFrom(decision.switchedFromMode || 'guest');
            } else if (decision.switchToMode === 'guest') {
              setConfig((prev) => ({ ...prev, authMode: 'guest' }));
              setAutoSwitchedTo('guest');
              setAutoSwitchedFrom(decision.switchedFromMode || 'account');
            }
          } else {
            setAutoSwitchedTo(null);
            setAutoSwitchedFrom(null);
          }

          return decision.probe;
        } catch {
          if (seq === probeSeqRef.current) {
            setIsProbingAuth(false);
          }
          return null;
        } finally {
          if (inFlightProbeRef.current?.seq === seq) {
            inFlightProbeRef.current = null;
          }
        }
      })();

      inFlightProbeRef.current = { key, seq, promise: probeTask };
      return probeTask;
    },
    [
      peers,
      savedLocationTargets,
      locationSavedShares,
      locationHostPreset,
      portableShares,
      activeShares,
    ]
  );

  // Debounced auto-probe when user manually edits host or shareName
  useEffect(() => {
    const cleanHost = config.targetHost.trim();
    const cleanShare = config.shareName.trim();
    if (!cleanHost || !cleanShare || validateTargetHost(cleanHost) || validateShareName(cleanShare)) {
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
      probeSeqRef.current += 1;
      inFlightProbeRef.current = null;
      completedProbeRef.current = null;
      setIsProbingAuth(false);
      setProbeResult(null);
      setSmartResult(null);
      setAutoSwitchedTo(null);
      setAutoSwitchedFrom(null);
      return;
    }

    const key = makeShareTargetKey(cleanHost, cleanShare);
    if (inFlightProbeRef.current?.key === key || completedProbeRef.current?.key === key) {
      return;
    }

    setProbeResult(null);
    setSmartResult(null);
    setAutoSwitchedTo(null);
    setAutoSwitchedFrom(null);

    if (probeTimerRef.current !== null) {
      window.clearTimeout(probeTimerRef.current);
    }
    probeTimerRef.current = window.setTimeout(() => {
      probeTimerRef.current = null;
      void runShareAuthProbe(cleanHost, cleanShare);
    }, 650);

    return () => {
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
    };
  }, [config.targetHost, config.shareName, runShareAuthProbe]);

  useEffect(() => {
    if (!pendingClientAuthMode || pendingClientAuthMode.key === lastAuthModeSwitchKeyRef.current) return;
    lastAuthModeSwitchKeyRef.current = pendingClientAuthMode.key;
    if (pendingClientAuthMode.authMode === 'account') {
      switchToAccountMode(pendingClientAuthMode.targetHost, pendingClientAuthMode.shareName);
    } else {
      setValidationError(null);
      setConfig((prev) => ({ ...prev, authMode: 'guest' }));
    }
    if (pendingClientAuthMode.smartResult) {
      const hostKey = pendingClientAuthMode.targetHost || configRef.current.targetHost;
      const shareKey = pendingClientAuthMode.shareName || configRef.current.shareName;
      const targetKey = makeShareTargetKey(hostKey, shareKey);
      if (probeTimerRef.current !== null) {
        window.clearTimeout(probeTimerRef.current);
        probeTimerRef.current = null;
      }
      probeSeqRef.current += 1;
      inFlightProbeRef.current = null;
      completedProbeRef.current = { key: targetKey, result: pendingClientAuthMode.smartResult.probe };
      setIsProbingAuth(false);
      setProbeResult(pendingClientAuthMode.smartResult.probe);
      setSmartResult(pendingClientAuthMode.smartResult);
      setAutoSwitchedTo(pendingClientAuthMode.authMode);
      setAutoSwitchedFrom(
        pendingClientAuthMode.switchedFrom ||
          (pendingClientAuthMode.authMode === 'account' ? 'guest' : 'account')
      );
    }
    onClearPendingClientAuthMode?.();
  }, [pendingClientAuthMode, switchToAccountMode, onClearPendingClientAuthMode]);

  // Reset dismissal/index cleanly if portable share entries update
  useEffect(() => {
    if (portableShares.length > 0 && selectedPortableIdx >= portableShares.length) {
      setSelectedPortableIdx(0);
    }
    if (portableShares.length > 0) {
      setBannerDismissed(false);
    }
  }, [portableShares.length, selectedPortableIdx]);

  useEffect(() => {
    onTargetHostChange?.(config.targetHost);
  }, [config.targetHost, onTargetHostChange]);

  const applyPortableEntry = useCallback(
    (entry: PortableHostShareEntry, notify = true) => {
      setValidationError(null);
      const targetHost = entry.sourceIp || entry.sourceHostName;
      const decoded = entry.connectionCode ? decodeConnectionCode(entry.connectionCode) : null;
      const resolved = entry.authMode === 'account' ? resolveClientAccountCredentials({
        targetHost,
        hostCandidates: getHostCandidates(targetHost, [entry.sourceHostName, entry.sourceIp, decoded?.hostName, decoded?.ip]),
        shareName: entry.shareName,
        requireAccountOnly: true,
        savedLocationTargets,
        locationSavedShares,
        locationHostPreset,
        portableShares,
        activeShares,
      }) : null;
      const username = entry.authMode === 'account' ? entry.username || decoded?.username || resolved?.username || 'AhBiShare' : '';
      const password = entry.authMode === 'account' ? entry.password || decoded?.password || resolved?.password || '' : '';

      setAutoSwitchedTo(null);
      setAutoSwitchedFrom(null);
      setConfig((prev) => ({
        ...prev,
        targetHost,
        ...(entry.sourceHostName || decoded?.hostName
          ? { targetHostName: (entry.sourceHostName || decoded?.hostName || '').trim() }
          : {}),
        shareName: entry.shareName,
        authMode: entry.authMode,
        username,
        password,
      }));
      if (entry.connectionCode) {
        setRawCodeInput(entry.connectionCode);
        setCodeParseState(decodeConnectionCode(entry.connectionCode) ? 'valid' : 'empty');
      } else {
        setRawCodeInput('');
        setCodeParseState('empty');
      }
      setPortableAppliedKey(`${entry.sourceHostName}::${entry.shareName}::${entry.updatedAt}`);
      if (notify) {
        onPortableAutoFill?.(entry);
      }
    },
    [getHostCandidates, savedLocationTargets, locationSavedShares, locationHostPreset, portableShares, activeShares, onPortableAutoFill]
  );

  useEffect(() => {
    if (pendingAutoFillEntry) {
      const idx = portableShares.findIndex(
        (s) =>
          s.shareName === pendingAutoFillEntry.shareName &&
          s.sourceHostName === pendingAutoFillEntry.sourceHostName
      );
      if (idx >= 0) setSelectedPortableIdx(idx);
      setBannerDismissed(false);
      applyPortableEntry(pendingAutoFillEntry, false);
      onClearPendingAutoFill?.();
    }
  }, [pendingAutoFillEntry, portableShares, applyPortableEntry, onClearPendingAutoFill]);

  const handleCodeChange = (val: string) => {
    setRawCodeInput(val);
    setValidationError(null);
    if (!val.trim()) {
      setCodeParseState('empty');
      return;
    }
    const decoded = decodeConnectionCode(val);
    if (decoded) {
      setCodeParseState('valid');
      setAutoSwitchedTo(null);
      setAutoSwitchedFrom(null);
      const resolved = decoded.authMode === 'account' ? resolveClientAccountCredentials({
        targetHost: decoded.ip || decoded.hostName,
        hostCandidates: getHostCandidates(decoded.ip || decoded.hostName, [decoded.ip, decoded.hostName]),
        shareName: decoded.shareName,
        requireAccountOnly: true,
        savedLocationTargets,
        locationSavedShares,
        locationHostPreset,
        portableShares,
        activeShares,
      }) : null;
      setConfig((prev) => ({
        ...prev,
        targetHost: decoded.ip || decoded.hostName,
        ...(decoded.hostName ? { targetHostName: decoded.hostName.trim() } : {}),
        shareName: decoded.shareName,
        authMode: decoded.authMode,
        username: decoded.username || resolved?.username || '',
        password: decoded.password || resolved?.password || '',
      }));
    } else {
      setCodeParseState('invalid');
    }
  };

  const handleSelectPeerShare = (peer: DiscoveredPeer, shareName: string) => {
    setValidationError(null);
    setAutoSwitchedTo(null);
    setAutoSwitchedFrom(null);
    const exactCode = peer.shareCodes?.[shareName];
    if (exactCode) {
      handleCodeChange(exactCode);
      return;
    }
    setRawCodeInput('');
    setCodeParseState('empty');
    const targetHost = peer.ipAddress;
    const resolved = resolveClientAccountCredentials({
      targetHost,
      hostCandidates: getHostCandidates(targetHost, [peer.hostName]),
      shareName,
      requireAccountOnly: peer.authModeHint === 'account',
      savedLocationTargets,
      locationSavedShares,
      locationHostPreset,
      portableShares,
      activeShares,
    });
    const authMode = peer.authModeHint === 'account' || resolved?.authMode === 'account' ? 'account' : 'guest';
    const nextCfg: ClientTargetConfig = {
      ...configRef.current,
      targetHost,
      ...(peer.hostName ? { targetHostName: peer.hostName.trim() } : {}),
      shareName,
      authMode,
      username: authMode === 'account' ? resolved?.username || 'AhBiShare' : '',
      password: authMode === 'account' ? resolved?.password || '' : '',
    };
    configRef.current = nextCfg;
    setConfig(nextCfg);
    void runShareAuthProbe(targetHost, shareName);
  };

  const handleCopyHostGuestCmd = useCallback(async () => {
    const cmd = buildHostGuestUnlockPsCommand(configRef.current.shareName);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cmd);
        ok = true;
      }
    } catch {}
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = cmd;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    if (ok) {
      if (hostCmdTimerRef.current !== null) {
        window.clearTimeout(hostCmdTimerRef.current);
      }
      setHostCmdCopied(true);
      hostCmdTimerRef.current = window.setTimeout(() => {
        setHostCmdCopied(false);
        hostCmdTimerRef.current = null;
      }, 2000);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnecting || isRefreshing) return;
    const hostErr = validateTargetHost(config.targetHost);
    if (hostErr) {
      setValidationError(hostErr);
      return;
    }
    const shareErr = validateShareName(config.shareName);
    if (shareErr) {
      setValidationError(shareErr);
      return;
    }

    const targetKey = makeShareTargetKey(config.targetHost, config.shareName);
    const hasValidAbshareToken =
      rawCodeInput.trim().startsWith('ABSHARE://') && codeParseState === 'valid';
    if (
      config.authMode === 'guest' &&
      autoSwitchEnabled &&
      !suppressedAutoSwitchKeysRef.current.has(targetKey) &&
      !shareBridge.isSmartAuthSuppressed(config.targetHost, config.shareName) &&
      !hasValidAbshareToken
    ) {
      let preProbe: ShareAuthProbeResult | null = null;
      if (inFlightProbeRef.current?.key === targetKey) {
        preProbe = await inFlightProbeRef.current.promise;
      } else if (completedProbeRef.current?.key !== targetKey) {
        preProbe = await runShareAuthProbe(config.targetHost, config.shareName);
      }
      if (preProbe && (preProbe.verdict === 'account_required' || preProbe.verdict === 'host_guest_denied')) {
        setValidationError(
          tx(
            '대상 공유폴더가 보안 계정 인증을 요구해 보안 계정 모드로 자동 전환했습니다. 아이디·암호를 확인한 뒤 [원클릭 공유폴더 연결]을 다시 실행하세요.',
            'Target share requires account authentication, so auth mode switched to Secure Account. Verify username and password, then click [Connect Share (1-Click)] again.'
          )
        );
        return;
      }
    }

    if (config.authMode === 'account') {
      if (!config.username.trim()) {
        setValidationError(
          tx('보안 계정 연결 모드에서는 사용자 ID를 입력하세요.', 'Enter a username in Secure Account mode.')
        );
        return;
      }
      if (!config.password) {
        setValidationError(
          tx('보안 계정 연결 모드에서는 접속 암호를 입력하세요.', 'Enter a password in Secure Account mode.')
        );
        return;
      }
    }
    setValidationError(null);
    void onConnect(config);
  };

  const activePortableEntry =
    portableShares.length > 0
      ? portableShares[Math.min(selectedPortableIdx, portableShares.length - 1)]
      : null;
  const isRemotePortable =
    Boolean(activePortableEntry && currentHostname) &&
    (activePortableEntry?.sourceHostName || '').trim().toLowerCase() !== currentHostname.trim().toLowerCase();
  const currentEntryKey = activePortableEntry
    ? `${activePortableEntry.sourceHostName}::${activePortableEntry.shareName}::${activePortableEntry.updatedAt}`
    : null;
  const isPortableApplied = Boolean(currentEntryKey && portableAppliedKey === currentEntryKey);

  useEffect(() => {
    setConfirmingDeletePortable(false);
  }, [currentEntryKey]);

  const matchedHostPolicy = findHostPolicySnapshot(
    hostPolicySnapshots,
    activePortableEntry?.sourceHostName
  );
  const portablePolicyConflicts = React.useMemo(() => {
    if (!matchedHostPolicy || !localPolicyStatus) return [];
    return computeHostClientPolicyDiff(matchedHostPolicy, localPolicyStatus).filter(
      (item) => item.status === 'conflict'
    );
  }, [matchedHostPolicy, localPolicyStatus]);

  const driveLetterOptions = React.useMemo(() => {
    const seen = new Set<string>(DRIVE_LETTERS);
    const list = [...DRIVE_LETTERS];
    const extra = [
      config.driveLetter,
      ...savedLocationTargets.map((t) => t.driveLetter),
      ...mounts.map((m) => m.driveLetter),
    ];
    for (const raw of extra) {
      const normalized = String(raw || '').trim().replace(/:?$/, ':').toUpperCase();
      if (/^[A-Z]:$/.test(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        list.push(normalized);
      }
    }
    return list;
  }, [config.driveLetter, savedLocationTargets, mounts]);

  return (
    <div className="space-y-8">
      {activePortableEntry && !bannerDismissed && (
        <section
          id="portable-usb-banner"
          aria-label={tx('USB 포터블 공유 데이터 감지 알림', 'USB portable share data detection banner')}
          className="border border-indigo-500/35 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-2 rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <Usb className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  {isRemotePortable
                    ? tx('USB에서 메인 PC 공유 데이터가 감지되었습니다', 'Host PC Share Data Detected on USB')
                    : tx('USB 포터블 저장소의 공유 데이터가 감지되었습니다', 'Share Data Detected in USB Portable Storage')}
                </h3>
                {portableStatus?.fileName && (
                  <span className="tabular-data text-xs text-slate-500 dark:text-slate-400">
                    · {portableStatus.fileName}
                  </span>
                )}
              </div>

              <p className="tabular-data text-xs text-slate-700 dark:text-slate-300 break-all">
                {tx('원본 PC', 'Source PC')}: {activePortableEntry.sourceHostName || '-'} · {activePortableEntry.uncPath || `\\\\${activePortableEntry.sourceIp}\\${activePortableEntry.shareName}`} ·{' '}
                {activePortableEntry.authMode === 'account'
                  ? activePortableEntry.decryptionFailed
                    ? tx(
                        `보안 계정 (${activePortableEntry.username || '-'} · 암호 재입력 필요)`,
                        `Secure Account (${activePortableEntry.username || '-'} · Re-enter password)`
                      )
                    : tx(
                        `보안 계정 (${activePortableEntry.username || '-'} · 암호화 비밀번호 자동 복원)`,
                        `Secure Account (${activePortableEntry.username || '-'} · Encrypted password restored)`
                      )
                  : tx('간편 무비밀번호', 'Passwordless')}
                {activePortableEntry.updatedAt ? ` · ${tx('기록 일시', 'Recorded')}: ${formatSnapshotTimestamp(activePortableEntry.updatedAt)}` : ''}
              </p>

              {portableShares.length > 1 && (
                <div className="pt-1.5 flex flex-wrap items-center gap-2">
                  <label htmlFor="portable-share-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {tx(`저장된 공유 항목 (${portableShares.length}개):`, `Saved Shares (${portableShares.length}):`)}
                  </label>
                  <select
                    id="portable-share-select"
                    value={selectedPortableIdx}
                    onChange={(e) => {
                      setSelectedPortableIdx(Number(e.target.value));
                      setPortableAppliedKey(null);
                      setConfirmingDeletePortable(false);
                    }}
                    className="px-2.5 py-1 text-xs tabular-data bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {portableShares.map((entry, idx) => {
                      const ts = entry.updatedAt ? formatSnapshotTimestamp(entry.updatedAt) : '';
                      return (
                        <option key={`${entry.sourceHostName}-${entry.shareName}-${idx}`} value={idx}>
                          {entry.sourceHostName || entry.sourceIp} · \\{entry.sourceIp}\{entry.shareName} ({entry.authMode === 'account' ? tx('보안 계정', 'Secure Account') : tx('무비밀번호', 'Passwordless')}) {ts ? `[${ts}]` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {isPortableApplied && (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {tx(
                    '연결 정보가 아래 입력 폼에 자동 채워졌습니다. [원클릭 공유폴더 연결]을 실행하세요.',
                    'Connection info has been filled in below. Click [Connect Share (1-Click)] to connect.'
                  )}
                </p>
              )}

              {portablePolicyConflicts.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {tx(
                      `호스트(${matchedHostPolicy?.hostName || activePortableEntry.sourceHostName}${matchedHostPolicy?.capturedAt ? ` · ${formatSnapshotTimestamp(matchedHostPolicy.capturedAt)} 감지` : ''})와 OS/SMB/RPC 정책 불일치 ${portablePolicyConflicts.length}건 감지 (${portablePolicyConflicts.map((c) => c.label).join(', ')})`,
                      `${portablePolicyConflicts.length} OS/SMB/RPC policy conflict(s) with host (${matchedHostPolicy?.hostName || activePortableEntry.sourceHostName}${matchedHostPolicy?.capturedAt ? ` · captured ${formatSnapshotTimestamp(matchedHostPolicy.capturedAt)}` : ''}): ${portablePolicyConflicts.map((c) => c.label).join(', ')}`
                    )}
                  </span>
                  {onOpenMatrix && (
                    <button
                      id="btn-portable-policy-diff"
                      type="button"
                      onClick={onOpenMatrix}
                      className="font-semibold underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-200 cursor-pointer"
                    >
                      {tx('매트릭스에서 맞추기', 'Align in Matrix')}
                    </button>
                  )}
                  {onDeleteHostPolicySnapshot && (matchedHostPolicy?.hostName || activePortableEntry.sourceHostName) && (
                    <button
                      id="btn-portable-delete-policy-snap"
                      type="button"
                      disabled={deletingPolicySnap}
                      onClick={async () => {
                        setDeletingPolicySnap(true);
                        try {
                          await onDeleteHostPolicySnapshot(matchedHostPolicy?.hostName || activePortableEntry.sourceHostName);
                        } finally {
                          setDeletingPolicySnap(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      {deletingPolicySnap ? tx('삭제 중...', 'Deleting...') : tx('감지 스냅샷 삭제', 'Delete Snapshot')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              id="btn-portable-autofill"
              type="button"
              onClick={() => applyPortableEntry(activePortableEntry, true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {isPortableApplied ? tx('연결 정보 다시 채우기', 'Refill Connection Info') : tx('원클릭 자동 채우기', '1-Click Auto-Fill')}
            </button>
            {onDeletePortableShare && (
              confirmingDeletePortable ? (
                <div className="inline-flex items-center gap-1">
                  <button
                    id="btn-confirm-delete-portable"
                    type="button"
                    disabled={deletingPortable}
                    onClick={async () => {
                      setDeletingPortable(true);
                      try {
                        await onDeletePortableShare(activePortableEntry.sourceHostName, activePortableEntry.shareName);
                        setPortableAppliedKey(null);
                      } finally {
                        setDeletingPortable(false);
                        setConfirmingDeletePortable(false);
                      }
                    }}
                    className="px-2.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {tx('삭제 확인', 'Confirm Delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeletePortable(false)}
                    className="px-2 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    {tx('취소', 'Cancel')}
                  </button>
                </div>
              ) : (
                <button
                  id="btn-delete-portable-entry"
                  type="button"
                  onClick={() => setConfirmingDeletePortable(true)}
                  aria-label={tx('선택된 포터블 공유 항목 삭제', 'Delete selected portable share entry')}
                  title={tx('현재 선택된 포터블 공유 항목 삭제', 'Delete currently selected portable share entry')}
                  className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-500/10 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label={tx('USB 감지 배너 닫기', 'Close USB detection banner')}
              title={tx('배너 닫기', 'Close banner')}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {tx('클라이언트 PC 원클릭 연결', 'One-Click Client Share Connection')}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {tx(
                    '메인 PC에서 복사한 연결 코드를 붙여넣거나 같은 네트워크의 PC를 자동 탐색해 즉시 연결합니다.',
                    'Paste the connection code copied from the host PC or scan your LAN to connect immediately.'
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onRefresh && (
                  <button
                    id="btn-refresh-client"
                    type="button"
                    onClick={() => void onRefresh()}
                    disabled={isRefreshing || isConnecting || isScanning}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
                    {isRefreshing ? tx('새로고침 중...', 'Refreshing...') : tx('새로고침', 'Refresh')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onScanLan()}
                  disabled={isScanning || isRefreshing}
                  className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Radar className={`w-4 h-4 ${isScanning ? 'animate-spin text-indigo-500' : ''}`} />
                  {isScanning ? tx('LAN 스캔 중...', 'Scanning LAN...') : tx('LAN PC 자동 탐색', 'Auto-Scan LAN PCs')}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <label htmlFor="client-conn-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {tx('연결 코드 또는 UNC 경로 붙여넣기 (ABSHARE://... 또는 \\\\IP\\공유명)', 'Paste Connection Code or UNC Path (ABSHARE://... or \\\\IP\\Share)')}
              </label>
              <input
                id="client-conn-code"
                type="text"
                value={rawCodeInput}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder={tx(
                  'ABSHARE://... 코드를 붙여넣으면 서버 IP·공유명·계정 정보가 자동 입력됩니다',
                  'Paste ABSHARE://... code to auto-fill server IP, share name, and credentials'
                )}
                className="w-full px-3.5 py-2.5 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {codeParseState === 'valid' && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {tx('연결 코드 확인 완료 · 대상:', 'Connection code verified · Target:')} \\{config.targetHost}\{config.shareName} (
                  {rawCodeInput.trim().startsWith('ABSHARE://')
                    ? config.authMode === 'account'
                      ? tx('보안 계정 포함', 'Account Included')
                      : tx('무비밀번호 모드', 'Passwordless Mode')
                    : config.authMode === 'account'
                      ? tx('보안 계정 모드', 'Secure Account Mode')
                      : tx('무비밀번호 모드', 'Passwordless Mode')}
                  )
                </p>
              )}
              {codeParseState === 'invalid' && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {tx(
                    '유효한 ABSHARE:// 코드 또는 \\\\서버\\공유명 형식이 아닙니다. 아래에서 직접 입력할 수 있습니다.',
                    'Not a valid ABSHARE:// code or \\\\Server\\Share format. You can enter details manually below.'
                  )}
                </p>
              )}
            </div>

            {savedLocationTargets.length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {activeLocationName
                      ? tx(`'${activeLocationName}' 저장 연결 대상`, `Saved Targets for '${activeLocationName}'`)
                      : tx('저장된 장소 연결 대상', 'Saved Location Targets')}{' '}
                    ({savedLocationTargets.length})
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {tx('항목을 클릭하면 아래 입력란에 즉시 채워집니다', 'Click an item to fill the fields below')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedLocationTargets.map((target, idx) => (
                    <button
                      key={`${target.driveLetter}-${target.targetHost}-${target.shareName}-${idx}`}
                      type="button"
                      onClick={() => {
                        setValidationError(null);
                        setRawCodeInput('');
                        setCodeParseState('empty');
                        setAutoSwitchedTo(null);
                        setAutoSwitchedFrom(null);
                        const resolved = target.authMode === 'account' ? resolveClientAccountCredentials({
                          targetHost: target.targetHost,
                          hostCandidates: getHostCandidates(target.targetHost),
                          shareName: target.shareName,
                          requireAccountOnly: true,
                          savedLocationTargets,
                          locationSavedShares,
                          locationHostPreset,
                          portableShares,
                          activeShares,
                        }) : null;
                        setConfig({
                          targetHost: target.targetHost,
                          shareName: target.shareName,
                          driveLetter: target.driveLetter,
                          authMode: target.authMode,
                          username: target.authMode === 'account' ? target.username || resolved?.username || 'AhBiShare' : '',
                          password: target.authMode === 'account' ? target.password || resolved?.password || '' : '',
                          persistent: target.persistent !== false,
                        });
                      }}
                      className="px-3 py-1.5 text-xs tabular-data font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {target.driveLetter} · \\{target.targetHost}\{target.shareName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {tx('탐색된 로컬 네트워크 공유 PC', 'Discovered LAN Share PCs')} ({peers.length})
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {tx('공유 폴더를 클릭하면 연결 대상이 자동 선택됩니다', 'Click a share to auto-select the connection target')}
                </span>
              </div>

              {peers.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tx(
                      '감지된 SMB(445) 호스트가 없습니다. [LAN PC 자동 탐색]을 누르거나 아래에 IP를 직접 입력하세요.',
                      'No SMB (445) hosts detected. Click [Auto-Scan LAN PCs] or enter the host IP below.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">{tx('PC / IP 주소', 'PC / IP Address')}</th>
                        <th className="py-2.5 px-3">{tx('공유 폴더 선택', 'Select Shared Folder')}</th>
                        <th className="py-2.5 px-3 text-right">{tx('응답 시간', 'Latency')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {peers.map((peer) => (
                        <tr key={peer.ipAddress} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 align-top">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{peer.hostName}</div>
                            <div className="tabular-data text-slate-500 dark:text-slate-400">
                              {peer.ipAddress}
                              {peer.authModeHint === 'account' && (
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                  {' '}· {tx('계정 인증 추정', 'Account Auth Likely')}
                                </span>
                              )}
                              {peer.authModeHint === 'guest' && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {' '}· {tx('무비밀번호 응답', 'Passwordless Ready')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {peer.availableShares.length > 0 ? (
                                peer.availableShares.map((sh) => {
                                  const isSelected = config.targetHost === peer.ipAddress && config.shareName === sh;
                                  return (
                                    <button
                                      key={sh}
                                      type="button"
                                      onClick={() => handleSelectPeerShare(peer, sh)}
                                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-500'
                                      }`}
                                    >
                                      {sh}
                                    </button>
                                  );
                                })
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectPeerShare(peer, 'AhBiShared')}
                                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer"
                                >
                                  {tx('직접 지정 선택', 'Select Custom')}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-data text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {peer.latencyMs}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 p-6 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="client-target-host" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tx('메인 PC IP 또는 이름', 'Host PC IP or Name')}
                </label>
                <input
                  id="client-target-host"
                  type="text"
                  value={config.targetHost}
                  onChange={(e) => {
                    setValidationError(null);
                    if (rawCodeInput) {
                      setRawCodeInput('');
                      setCodeParseState('empty');
                    }
                    const rawVal = e.target.value;
                    const uncMatch = rawVal.trim().replace(/\//g, '\\').match(/^\\\\([^\\]+)\\([^\\]+)/);
                    if (uncMatch) {
                      setConfig({
                        ...config,
                        targetHost: uncMatch[1].trim(),
                        shareName: uncMatch[2].trim(),
                      });
                    } else {
                      setConfig({ ...config, targetHost: rawVal });
                    }
                  }}
                  onBlur={() => {
                    const key = makeShareTargetKey(config.targetHost, config.shareName);
                    if (inFlightProbeRef.current?.key !== key && completedProbeRef.current?.key !== key) {
                      void runShareAuthProbe(config.targetHost, config.shareName);
                    }
                  }}
                  className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="client-share-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tx('공유 폴더 이름', 'Shared Folder Name')}
                </label>
                <input
                  id="client-share-name"
                  type="text"
                  value={config.shareName}
                  onChange={(e) => {
                    setValidationError(null);
                    if (rawCodeInput) {
                      setRawCodeInput('');
                      setCodeParseState('empty');
                    }
                    setConfig({ ...config, shareName: e.target.value });
                  }}
                  onBlur={() => {
                    const key = makeShareTargetKey(config.targetHost, config.shareName);
                    if (inFlightProbeRef.current?.key !== key && completedProbeRef.current?.key !== key) {
                      void runShareAuthProbe(config.targetHost, config.shareName);
                    }
                  }}
                  className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="client-drive-letter" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {tx('연결 드라이브 문자', 'Drive Letter')}
                </label>
                <select
                  id="client-drive-letter"
                  value={config.driveLetter}
                  onChange={(e) => setConfig({ ...config, driveLetter: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {driveLetterOptions.map((dl) => (
                    <option key={dl} value={dl}>
                      {tx(`${dl} 드라이브${mountedSet.has(dl) ? ' (연결됨)' : ''}`, `${dl} Drive${mountedSet.has(dl) ? ' (Mounted)' : ''}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <ShareAuthProbeBar
                idPrefix="client"
                probeResult={probeResult}
                smartResult={smartResult}
                isProbing={isProbingAuth}
                autoSwitchEnabled={autoSwitchEnabled}
                autoSwitchedTo={autoSwitchedTo}
                currentAuthMode={config.authMode}
                targetHost={config.targetHost}
                shareName={config.shareName}
                disabled={isConnecting || isRefreshing}
                onToggleAutoSwitch={handleToggleAutoSwitch}
                onManualProbe={() => {
                  void runShareAuthProbe(config.targetHost, config.shareName, { manual: true });
                }}
                onSwitchToAccount={() => {
                  setAutoSwitchedTo(null);
                  setAutoSwitchedFrom(null);
                  switchToAccountMode(config.targetHost, config.shareName);
                }}
                onSwitchToGuest={() => {
                  setAutoSwitchedTo(null);
                  setAutoSwitchedFrom(null);
                  setValidationError(null);
                  setConfig((prev) => ({ ...prev, authMode: 'guest' }));
                }}
                onUndoAutoSwitch={() => {
                  const key = makeShareTargetKey(config.targetHost, config.shareName);
                  suppressedAutoSwitchKeysRef.current.add(key);
                  shareBridge.setSmartAuthSuppressed(config.targetHost, config.shareName, true);
                  if (autoSwitchedFrom) {
                    setConfig((prev) => ({ ...prev, authMode: autoSwitchedFrom }));
                  }
                  setAutoSwitchedTo(null);
                  setAutoSwitchedFrom(null);
                  setValidationError(null);
                }}
                onOpenMatrix={onOpenMatrix}
                onCopyHostGuestCmd={() => {
                  void handleCopyHostGuestCmd();
                }}
                hostCmdCopied={hostCmdCopied}
              />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    setAutoSwitchedTo(null);
                    setAutoSwitchedFrom(null);
                    setConfig({ ...config, authMode: 'guest' });
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                    config.authMode === 'guest'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tx('무비밀번호 (Win11 0x80070035 자동 해제)', 'Passwordless (Auto Win11 0x80070035 Fix)')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoSwitchedTo(null);
                    setAutoSwitchedFrom(null);
                    switchToAccountMode();
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors sm:whitespace-nowrap cursor-pointer ${
                    config.authMode === 'account'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tx('보안 계정 (cmdkey 자동 등록)', 'Secure Account (Auto cmdkey)')}
                </button>
              </div>

              {config.authMode === 'account' && (
                <div className="space-y-3 pt-1">
                  <PresetPasswordGrid
                    currentUsername={config.username}
                    currentPassword={config.password}
                    onSelectPreset={(username, password) => {
                      setValidationError(null);
                      setConfig((prev) => ({
                        ...prev,
                        username,
                        password,
                      }));
                    }}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="client-acc-user" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {tx('전용 계정 ID', 'Account Username')}
                    </label>
                    <input
                      id="client-acc-user"
                      type="text"
                      value={config.username}
                      onChange={(e) => {
                        setValidationError(null);
                        setConfig({ ...config, username: e.target.value });
                      }}
                      placeholder={tx('사용자 ID (예: AhBiShare)', 'Username (e.g., AhBiShare)')}
                      className="w-full px-3.5 py-2 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="client-acc-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {tx('공유 계정 암호', 'Account Password')}
                    </label>
                    <div className="relative">
                      <input
                        id="client-acc-pass"
                        type={showClientPass ? 'text' : 'password'}
                        value={config.password}
                        onChange={(e) => {
                          setValidationError(null);
                          setConfig({ ...config, password: e.target.value });
                        }}
                        placeholder={tx('공유 계정 암호', 'Account Password')}
                        className="w-full px-3.5 py-2 pr-10 text-sm tabular-data bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientPass(!showClientPass)}
                        aria-label={showClientPass ? tx('비밀번호 숨기기', 'Hide password') : tx('비밀번호 표시', 'Show password')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showClientPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>

            {validationError && (
              <div role="alert" className="px-4 py-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-xs font-medium text-red-700 dark:text-red-300">
                {validationError}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.persistent}
                  onChange={(e) => setConfig({ ...config, persistent: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                {tx('재부팅 후에도 드라이브 연결 유지', 'Reconnect at sign-in (persistent)')}
              </label>

              <button
                id="btn-client-oneclick"
                type="submit"
                disabled={isConnecting || isRefreshing}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Link2 className="w-4 h-4" />
                {isConnecting ? tx('드라이브 연결 중...', 'Connecting Drive...') : tx('원클릭 공유폴더 연결', 'Connect Share (1-Click)')}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <PipelineTracker
            title={tx('클라이언트 5단계 연결·복구 파이프라인', 'Client 5-Step Connect & Repair Pipeline')}
            steps={steps}
            isRunning={isConnecting}
          />

          {(() => {
            const failedStep = steps.find((st) => st.status === 'error' && st.error);
            const diag = failedStep ? classifyFailureDiagnostics(failedStep.error) : null;
            if (!diag) return null;
            return (
              <div
                id="client-failure-diagnostic-banner"
                role="alert"
                className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {tx('연결 실패 처방 가이드', 'Connection Failure Guide')} · {diag.title}
                  </span>
                  <span className="tabular-data text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    {diag.code}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {diag.detail}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {diag.isHostAuthOrGuestIssue ? (
                    <>
                      {onOpenDiagnostics && (
                        <button
                          id="btn-failure-open-diag"
                          type="button"
                          onClick={() => onOpenDiagnostics(failedStep?.error)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer shadow-sm"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {tx('통합 해결 가이드 & 도구 열기', 'Open Fix Guide & Tools')}
                        </button>
                      )}
                      <button
                        id="btn-failure-switch-account"
                        type="button"
                        onClick={switchToAccountMode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 rounded-lg cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {tx('보안 계정 모드로 즉시 전환', 'Switch to Secure Account Mode')}
                      </button>
                      <button
                        id="btn-failure-copy-host-cmd"
                        type="button"
                        onClick={() => void handleCopyHostGuestCmd()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg cursor-pointer"
                      >
                        {hostCmdCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {hostCmdCopied ? tx('복구 명령 복사됨!', 'Fix Command Copied!') : tx('호스트 원클릭 복구 명령 복사', 'Copy Host 1-Click Fix Command')}
                      </button>
                    </>
                  ) : (
                    onOpenMatrix && (
                      <button
                        id="btn-failure-open-matrix"
                        type="button"
                        onClick={onOpenMatrix}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        {diag.actionLabel}
                      </button>
                    )
                  )}
                  {onOpenTroubleshootWizard && (
                    <button
                      id="btn-failure-open-wizard"
                      type="button"
                      onClick={onOpenTroubleshootWizard}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer shadow-sm"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      {tx('단계별 해결 마법사 열기', 'Open Step-by-Step Troubleshoot Wizard')}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <section className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 overflow-hidden">
        {(() => {
          const disconnectedMounts = mounts.filter((m) => m.status === 'disconnected');
          const planByDrive = new Map(
            offlineRecoveryPlans.map((p) => [p.driveLetter.toUpperCase(), p])
          );
          const readyRecoveryCount = disconnectedMounts.filter(
            (m) => planByDrive.get(m.driveLetter.toUpperCase())?.readiness === 'ready'
          ).length;

          return (
            <>
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    {tx('연결된 네트워크 드라이브', 'Connected Network Drives')} ({mounts.length})
                  </h3>
                  {disconnectedMounts.length > 0 ? (
                    <span className="tabular-data text-xs font-medium text-amber-700 dark:text-amber-300">
                      · {tx(`오프라인 ${disconnectedMounts.length}건`, `${disconnectedMounts.length} offline`)}
                      {readyRecoveryCount > 0
                        ? tx(` · 즉시 복구 가능 ${readyRecoveryCount}건`, ` · ${readyRecoveryCount} ready to reconnect`)
                        : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {tx('연결 완료 즉시 Windows 탐색기에서 바로 사용할 수 있습니다', 'Available immediately in Windows Explorer once mounted')}
                    </span>
                  )}
                </div>

                {disconnectedMounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onRecoverAllOfflineDrives && readyRecoveryCount > 0 && (
                      <button
                        id="btn-recover-all-offline"
                        type="button"
                        onClick={() => void onRecoverAllOfflineDrives()}
                        disabled={isRecoveringDrives || isConnecting}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isRecoveringDrives && !recoveringDriveLetter ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {tx(
                          `끊긴 드라이브 일괄 복구 (${readyRecoveryCount})`,
                          `Reconnect All Offline (${readyRecoveryCount})`
                        )}
                      </button>
                    )}
                    {onCleanAllOfflineDrives && (
                      <button
                        id="btn-clean-offline-drives"
                        type="button"
                        onClick={() => void onCleanAllOfflineDrives()}
                        disabled={isRecoveringDrives || isConnecting}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        {tx(
                          `오프라인 정리 (${disconnectedMounts.length})`,
                          `Clean Offline (${disconnectedMounts.length})`
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {mounts.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {tx(
                      '연결된 네트워크 드라이브가 없습니다. 상단에서 메인 PC를 선택하거나 연결 코드를 입력해 연결하세요.',
                      'No network drives connected. Select a host PC or enter a connection code above.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-6">{tx('드라이브', 'Drive')}</th>
                        <th className="py-3 px-4">{tx('네트워크 UNC 경로', 'Network UNC Path')}</th>
                        <th className="py-3 px-4">{tx('인증 모드', 'Auth Mode')}</th>
                        <th className="py-3 px-4">{tx('연결 시각', 'Connected At')}</th>
                        <th className="py-3 px-6 text-right">{tx('작업', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {mounts.map((m) => {
                        const driveKey = m.driveLetter.toUpperCase();
                        const driveIdToken = m.driveLetter.replace(':', '').toUpperCase();
                        const plan = m.status === 'disconnected' ? planByDrive.get(driveKey) : undefined;
                        const isThisRecovering =
                          isRecoveringDrives &&
                          (!recoveringDriveLetter || recoveringDriveLetter.toUpperCase() === driveKey);

                        return (
                          <tr key={m.driveLetter} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-6 tabular-data font-bold whitespace-nowrap align-top">
                              <span className={m.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                                {m.driveLetter}
                              </span>
                              {m.status === 'disconnected' && (
                                <span className="ml-2 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                  {tx('(오프라인)', '(Offline)')}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 tabular-data text-xs text-slate-700 dark:text-slate-300 align-top">
                              <div>{m.uncPath}</div>
                              {plan?.reasonLabel && (
                                <div className="mt-1 font-sans text-[11px] text-amber-700 dark:text-amber-300">
                                  {plan.reasonLabel}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap align-top">
                              {m.authMode === 'guest' ? tx('간편 무비밀번호', 'Passwordless') : tx('보안 계정 (cmdkey)', 'Secure Account (cmdkey)')}
                            </td>
                            <td className="py-3 px-4 tabular-data text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap align-top">
                              {m.mountedAt}
                            </td>
                            <td className="py-3 px-6 text-right whitespace-nowrap align-top">
                              <div className="inline-flex items-center gap-2">
                                {m.status === 'disconnected' && plan?.readiness === 'ready' && onRecoverSingleDrive && (
                                  <button
                                    id={`btn-reconnect-drive-${driveIdToken}`}
                                    type="button"
                                    onClick={() => void onRecoverSingleDrive(m.driveLetter)}
                                    disabled={isRecoveringDrives || isConnecting}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    {isThisRecovering ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    )}
                                    {tx('재연결', 'Reconnect')}
                                  </button>
                                )}
                                {m.status === 'disconnected' && plan?.readiness === 'needs_password' && onFillDriveForPassword && (
                                  <button
                                    id={`btn-fill-drive-pass-${driveIdToken}`}
                                    type="button"
                                    onClick={() => onFillDriveForPassword(plan)}
                                    disabled={isRecoveringDrives || isConnecting}
                                    className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    {tx('암호 입력', 'Enter Password')}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void onOpenDrive(`${m.driveLetter}\\`)}
                                  className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-md inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  {tx('탐색기 열기', 'Open Explorer')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onUnmount(m.driveLetter)}
                                  disabled={isRecoveringDrives}
                                  className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Unplug className="w-3.5 h-3.5" />
                                  {tx('연결 해제', 'Disconnect')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}
      </section>
    </div>
  );
};
