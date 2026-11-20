import {
  HostConfig,
  ActiveShare,
  ClientTargetConfig,
  DiscoveredPeer,
  MountedDrive,
  PipelineStep,
  LocalNetworkInfo,
  DiagnosticCheck,
  PingHostResult,
  PortableShareDocument,
  PortableHostShareEntry,
  PortableStorageStatus,
  PortableLoadResult,
  PortableSaveResult,
  PortableEncryptedCredentials,
  OsNetworkPolicyStatus,
  HostPolicySnapshot,
  PendingHostPolicyTask,
  PolicyApplyResult,
  AutoAlignBatchResult,
  PolicyPatchMode,
  RebootJudgment,
  WindowsNetworkEra,
  LegacyRollbackSnapshot,
  LegacyScriptBundle,
  LocationClientTargetEntry,
  LocationHostPreset,
  LocationProfileFile,
  LocationProfileSummary,
  LocationBatchApplyResult,
  LocationBatchApplyItemResult,
} from '@/types/share';
import { decodeConnectionCode, encodeConnectionCode, validateTargetHost } from '@/utils/connectionCode';
import { APP_VERSION } from '@/version';
import {
  buildHostStepScripts,
  buildClientStepScripts,
  buildRollbackScript,
  buildNetworkDiagnosticScript,
  buildLiveStateScript,
  buildOsNetworkPolicyInspectScript,
  buildOsCompatibilityPatchScript,
  buildHostGuestUnlockPsScript,
} from '@/services/powershellEngine';
import {
  classifyOsEra,
  combineRebootJudgments,
  computeCompatibilityScoreAndIssues,
  evaluateRebootJudgment,
  formatSnapshotTimestamp,
  getPolicyPatchLabel,
  toHostPolicySnapshot,
} from '@/services/networkEvolution';

declare global {
  interface Window {
    ahbiShareElectron?: {
      isElectron: boolean;
      runPowerShell: (script: string) => Promise<{ success: boolean; output: string; error: string }>;
      selectFolder: () => Promise<{ canceled: boolean; path: string }>;
      openPath: (targetPath: string) => Promise<{ success: boolean; error: string }>;
      getLocalNetworkInfo: () => Promise<{
        hostname: string;
        primaryIp: string;
        adapterName: string;
        subnetPrefix: string;
        isAdmin?: boolean;
        osProductName?: string;
        osDisplayVersion?: string;
        osBuild?: number;
        osEra?: WindowsNetworkEra;
      }>;
      scanLanPeers: (subnetPrefix?: string) => Promise<{ success: boolean; peers: DiscoveredPeer[]; subnetPrefix: string }>;
      pingHost?: (target: string) => Promise<PingHostResult>;
      getPortableStatus?: () => Promise<PortableStorageStatus>;
      loadPortableData?: () => Promise<PortableLoadResult>;
      savePortableData?: (document: PortableShareDocument) => Promise<PortableSaveResult>;
      triggerSystemReboot?: () => Promise<{ success: boolean; message: string }>;
      saveLegacyScripts?: (payload: {
        folderName: string;
        files: Array<{ name: string; content: string }>;
      }) => Promise<{ success: boolean; directory: string; savedFiles: string[]; message: string }>;
      listLocationProfiles?: () => Promise<{
        success: boolean;
        directory: string;
        writable: boolean;
        profiles: LocationProfileSummary[];
      }>;
      saveLocationProfile?: (profile: LocationProfileFile) => Promise<{
        success: boolean;
        profile?: LocationProfileFile;
        summary?: LocationProfileSummary;
        filePath?: string;
        error?: string;
      }>;
      loadLocationProfile?: (profileId: string) => Promise<{
        success: boolean;
        profile?: LocationProfileFile;
        filePath?: string;
        error?: string;
      }>;
      deleteLocationProfile?: (profileId: string) => Promise<{
        success: boolean;
        error?: string;
      }>;
      exportLocationProfileFile?: (profile: LocationProfileFile) => Promise<{
        success: boolean;
        canceled?: boolean;
        filePath?: string;
        message: string;
      }>;
      importLocationProfileFile?: (payload?: { saveToCatalog?: boolean }) => Promise<{
        success: boolean;
        canceled?: boolean;
        profile?: LocationProfileFile;
        filePath?: string;
        savedToCatalog?: boolean;
        message: string;
      }>;
      checkGitHubUpdates?: () => Promise<{
        ok: boolean;
        release?: {
          tagName: string;
          name: string;
          body: string;
          htmlUrl: string;
          publishedAt: string;
          assets?: Array<{ name: string; browserDownloadUrl: string; size: number }>;
        };
        error?: string;
      }>;
      openExternalUrl?: (url: string) => Promise<{ success: boolean; error?: string }>;
      getUpdateRuntimeInfo?: () => Promise<{
        isPackaged: boolean;
        isPortable: boolean;
        canSelfReplace: boolean;
        edition: 'standard' | 'lite' | 'win7';
        currentVersion: string;
        portableExePath: string;
        portableDir: string;
        currentExeName: string;
        reason?: string;
      }>;
      installPortableUpdate?: (payload: {
        downloadUrl: string;
        assetName: string;
        expectedSize?: number;
      }) => Promise<{
        success: boolean;
        cancelled?: boolean;
        oldExePath?: string;
        targetExePath?: string;
        error?: string;
      }>;
      cancelPortableUpdate?: () => Promise<{ success: boolean; cancelled: boolean }>;
      onUpdateProgress?: (
        callback: (progress: {
          phase: 'downloading' | 'verifying' | 'replacing' | 'error' | 'cancelled';
          percent: number;
          downloadedBytes: number;
          totalBytes: number;
          message: string;
        }) => void
      ) => () => void;
    };
  }
}

const STORAGE_SHARES_KEY = 'ahbishare_oneclick_shares_v1';
const STORAGE_MOUNTS_KEY = 'ahbishare_oneclick_mounts_v1';
const STORAGE_PORTABLE_SIM_KEY = 'ahbishare_portable_json_sim_v1';
const STORAGE_LEGACY_ROLLBACK_KEY = 'ahbishare_legacy_rollback_snapshot_v1';
const STORAGE_LOCATIONS_SIM_KEY = 'ahbishare_location_profiles_sim_v1';
const PORTABLE_FILE_NAME = 'AhBiShare_OneClick.portable.json';

// Simulated Windows 11 24H2 baseline policy state used only in browser preview mode
let webSimPolicyBase: Omit<OsNetworkPolicyStatus, 'compatibilityScore' | 'detectedIssues' | 'checkedAt'> = {
  osProductName: 'Windows 11 Pro',
  osDisplayVersion: '24H2',
  osBuild: 26100,
  osEra: 'win11_24h2',
  osEditionId: 'Professional',
  osUbr: 2608,
  recentHotfixIds: ['KB5046617', 'KB5044284'],
  localAccountTokenFilterEnabled: false,
  smb1ClientFeatureState: 'Disabled',
  msaPinOnlyRisk: false,
  networkProfile: 'Private',
  smb1Enabled: false,
  smbServerSigningRequired: true,
  smbClientSigningRequired: true,
  allowInsecureGuestAuth: false,
  enableInsecureGuestLogons: false,
  guestNetworkLogonDenied: true,
  limitBlankPasswordUse: true,
  restrictNullSessAccess: true,
  restrictAnonymous: false,
  guestAccountEnabled: false,
  firewall445Allowed: true,
  lmCompatibilityLevel: 3,
  ntlmRestrictOutbound: 0,
  netbiosEnabled: true,
  smbEncryptData: false,
  smbRejectUnencryptedAccess: false,
  smb2Enabled: true,
  smb1ServerEnabled: false,
  lanmanServerRunning: true,
  lanmanWorkstationRunning: true,
  fdResPubRunning: true,
  rpcAuthnLevelPrivacyDisabled: false,
  rpcUseNamedPipeProtocol: false,
  rpcProtocols: null,
  pointAndPrintRelaxed: false,
  printSpoolerRunning: true,
  pendingRebootFlag: false,
};

// Runtime in-memory credential cache so passwords decrypted from USB or entered on Host PC
// are immediately available for 1-click auto-fill without persisting plaintext passwords to disk.
const runtimeSharePasswordCache = new Map<string, string>();
const runtimeLocationHostPasswordCache = new Map<string, string>();
const runtimeLocationTargetPasswordCache = new Map<string, string>();
let latestPortableDoc: PortableShareDocument = { schemaVersion: 1, updatedAt: '', shares: [] };
let latestPortableStatus: PortableStorageStatus = {
  supported: true,
  mode: 'web-preview',
  directory: '웹 브라우저 시뮬레이션 저장소',
  fileName: PORTABLE_FILE_NAME,
  filePath: PORTABLE_FILE_NAME,
  writable: true,
  hasExistingFile: false,
};

function cacheKeyForShare(hostName: string, shareName: string): string {
  return `${hostName.trim().toLowerCase()}::${shareName.trim().toLowerCase()}`;
}

function setCachedPassword(hostName: string, shareName: string, password?: string): void {
  if (!password) return;
  runtimeSharePasswordCache.set(cacheKeyForShare(hostName, shareName), password);
}

function getCachedPassword(hostName: string, shareName: string): string | undefined {
  return runtimeSharePasswordCache.get(cacheKeyForShare(hostName, shareName));
}

const DEFAULT_MOCK_PEERS: DiscoveredPeer[] = [
  {
    hostName: 'OFFICE-MAIN-01',
    ipAddress: '192.168.0.10',
    latencyMs: 2,
    smbPortOpen: true,
    availableShares: ['WorkDocs', 'MediaPool'],
    authModeHint: 'guest',
    lastSeen: '방금 전',
  },
  {
    hostName: 'DESIGN-WS-04',
    ipAddress: '192.168.0.24',
    latencyMs: 4,
    smbPortOpen: true,
    availableShares: ['RenderOutput'],
    authModeHint: 'account',
    lastSeen: '방금 전',
  },
];

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function parseLastJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const lines = trimmed.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          return JSON.parse(line) as T;
        } catch {}
      }
    }
    const lastEnd = trimmed.lastIndexOf('}');
    if (lastEnd > 0) {
      let pos = trimmed.indexOf('{');
      while (pos !== -1 && pos < lastEnd) {
        try {
          return JSON.parse(trimmed.slice(pos, lastEnd + 1)) as T;
        } catch {
          pos = trimmed.indexOf('{', pos + 1);
        }
      }
    }
    return null;
  }
}

function stripPasswordFromCode(rawCode: string, share: Pick<ActiveShare, 'shareName' | 'authMode' | 'username' | 'createdAt'> & { hostName?: string; ip?: string }): string {
  const decoded = decodeConnectionCode(rawCode);
  return encodeConnectionCode({
    v: decoded?.v || 1,
    hostName: decoded?.hostName || share.hostName || '',
    ip: decoded?.ip || share.ip || '',
    shareName: share.shareName,
    authMode: share.authMode,
    username: share.authMode === 'account' ? (share.username || decoded?.username) : undefined,
    createdAt: decoded?.createdAt || share.createdAt || new Date().toISOString(),
  });
}

function rehydrateCodeWithPassword(
  entry: Pick<PortableHostShareEntry, 'sourceHostName' | 'sourceIp' | 'shareName' | 'authMode' | 'username' | 'createdAt' | 'connectionCode'>,
  password?: string
): string {
  const decoded = decodeConnectionCode(entry.connectionCode);
  return encodeConnectionCode({
    v: decoded?.v || 1,
    hostName: decoded?.hostName || entry.sourceHostName,
    ip: decoded?.ip || entry.sourceIp,
    shareName: entry.shareName,
    authMode: entry.authMode,
    username: entry.authMode === 'account' ? (entry.username || decoded?.username) : undefined,
    password: entry.authMode === 'account' ? (password || decoded?.password) : undefined,
    createdAt: decoded?.createdAt || entry.createdAt || new Date().toISOString(),
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const WEB_SIM_SECRET_BYTES = new Uint8Array([
  0x41, 0x68, 0x42, 0x69, 0x53, 0x68, 0x61, 0x72,
  0x65, 0x55, 0x53, 0x42, 0x53, 0x69, 0x6d, 0x4b,
  0x65, 0x79, 0x32, 0x30, 0x32, 0x36, 0x2d, 0x41,
  0x45, 0x53, 0x47, 0x43, 0x4d, 0x32, 0x35, 0x36,
]);

async function getWebSimAesKey(): Promise<CryptoKey | null> {
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
    return await window.crypto.subtle.importKey('raw', WEB_SIM_SECRET_BYTES, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

async function encryptWebSimCredentials(username: string, password: string): Promise<PortableEncryptedCredentials | undefined> {
  const key = await getWebSimAesKey();
  if (!key) return undefined;
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(JSON.stringify({ username, password }));
  const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
  const allBytes = new Uint8Array(cipherBuf);
  const ciphertext = allBytes.slice(0, Math.max(0, allBytes.length - 16));
  const tag = allBytes.slice(Math.max(0, allBytes.length - 16));
  return {
    encVersion: 1,
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tag),
    ciphertext: bytesToBase64(ciphertext),
  };
}

async function decryptWebSimCredentials(enc?: PortableEncryptedCredentials): Promise<{ ok: boolean; username: string; password: string }> {
  if (!enc || enc.encVersion !== 1 || !enc.iv || !enc.tag || !enc.ciphertext) {
    return { ok: false, username: '', password: '' };
  }
  const key = await getWebSimAesKey();
  if (!key) return { ok: false, username: '', password: '' };
  try {
    const iv = base64ToBytes(enc.iv);
    const ct = base64ToBytes(enc.ciphertext);
    const tag = base64ToBytes(enc.tag);
    const combined = new Uint8Array(ct.length + tag.length);
    combined.set(ct, 0);
    combined.set(tag, ct.length);
    const ivBuf = new ArrayBuffer(iv.byteLength);
    new Uint8Array(ivBuf).set(iv);
    const combinedBuf = new ArrayBuffer(combined.byteLength);
    new Uint8Array(combinedBuf).set(combined);
    const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, combinedBuf);
    const parsed = JSON.parse(new TextDecoder().decode(plainBuf)) as { username?: string; password?: string };
    return {
      ok: true,
      username: parsed.username ? String(parsed.username) : '',
      password: parsed.password ? String(parsed.password) : '',
    };
  } catch {
    return { ok: false, username: '', password: '' };
  }
}

async function loadWebPreviewPortable(): Promise<PortableLoadResult> {
  const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_PORTABLE_SIM_KEY) : null;
  if (!raw) {
    const emptyDoc: PortableShareDocument = { schemaVersion: 1, updatedAt: '', shares: [] };
    return {
      success: true,
      document: emptyDoc,
      status: {
        supported: true,
        mode: 'web-preview',
        directory: '웹 프리뷰 시뮬레이션 USB 폴더',
        fileName: PORTABLE_FILE_NAME,
        filePath: PORTABLE_FILE_NAME,
        writable: true,
        hasExistingFile: false,
      },
    };
  }

  try {
    const parsed = JSON.parse(raw) as PortableShareDocument;
    const shares: PortableHostShareEntry[] = [];
    for (const item of Array.isArray(parsed.shares) ? parsed.shares : []) {
      let username = item.username || '';
      let password = item.password || '';
      let decryptionFailed = false;
      if (item.authMode === 'account' && item.encryptedCredentials) {
        const dec = await decryptWebSimCredentials(item.encryptedCredentials);
        if (dec.ok) {
          username = dec.username || username;
          password = dec.password;
        } else {
          decryptionFailed = true;
        }
      }
      shares.push({
        ...item,
        username: username || undefined,
        password: password || undefined,
        decryptionFailed: decryptionFailed || undefined,
        connectionCode: rehydrateCodeWithPassword(item, password),
      });
    }
    const doc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: parsed.updatedAt || '',
      shares,
      ...(parsed.hostPolicies ? { hostPolicies: parsed.hostPolicies } : {}),
      ...(parsed.pendingHostActions ? { pendingHostActions: parsed.pendingHostActions } : {}),
      ...(parsed.lastClientTarget ? { lastClientTarget: parsed.lastClientTarget } : {}),
    };
    return {
      success: true,
      document: doc,
      status: {
        supported: true,
        mode: 'web-preview',
        directory: '웹 프리뷰 시뮬레이션 USB 폴더',
        fileName: PORTABLE_FILE_NAME,
        filePath: PORTABLE_FILE_NAME,
        writable: true,
        hasExistingFile: true,
        lastSyncedAt: doc.updatedAt || undefined,
      },
    };
  } catch {
    return {
      success: false,
      document: { schemaVersion: 1, updatedAt: '', shares: [] },
      status: {
        supported: true,
        mode: 'web-preview',
        directory: '웹 프리뷰 시뮬레이션 USB 폴더',
        fileName: PORTABLE_FILE_NAME,
        filePath: PORTABLE_FILE_NAME,
        writable: true,
        hasExistingFile: false,
        corruptedRecovered: true,
      },
    };
  }
}

async function saveWebPreviewPortable(doc: PortableShareDocument): Promise<PortableSaveResult> {
  const nowIso = doc.updatedAt || new Date().toISOString();
  const diskShares: PortableHostShareEntry[] = [];
  const runtimeShares: PortableHostShareEntry[] = [];

  for (const item of doc.shares) {
    const plainPass = item.password || '';
    const plainUser = item.username || '';
    let enc = item.encryptedCredentials;
    if (item.authMode === 'account' && plainPass) {
      enc = await encryptWebSimCredentials(plainUser, plainPass);
    } else if (item.authMode !== 'account') {
      enc = undefined;
    }
    const sanitizedCode = stripPasswordFromCode(item.connectionCode, {
      shareName: item.shareName,
      authMode: item.authMode,
      username: plainUser,
      createdAt: item.createdAt,
      hostName: item.sourceHostName,
      ip: item.sourceIp,
    });
    diskShares.push({
      sourceHostName: item.sourceHostName,
      sourceIp: item.sourceIp,
      shareName: item.shareName,
      folderPath: item.folderPath,
      uncPath: item.uncPath,
      authMode: item.authMode,
      permission: item.permission,
      ...(plainUser ? { username: plainUser } : {}),
      ...(enc ? { encryptedCredentials: enc } : {}),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt || nowIso,
      ...(typeof item.ttlMinutes === 'number' && item.ttlMinutes > 0 ? { ttlMinutes: item.ttlMinutes } : {}),
      ...(item.expiresAt ? { expiresAt: item.expiresAt } : {}),
      ...(typeof item.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: item.autoRevokeOnExpiry } : {}),
      connectionCode: sanitizedCode,
    });
    runtimeShares.push({
      ...item,
      password: plainPass || undefined,
      ...(enc ? { encryptedCredentials: enc } : {}),
      updatedAt: item.updatedAt || nowIso,
      connectionCode: rehydrateCodeWithPassword(item, plainPass),
    });
  }

  const diskDoc: PortableShareDocument = {
    schemaVersion: 1,
    updatedAt: nowIso,
    shares: diskShares,
    ...(doc.hostPolicies ? { hostPolicies: doc.hostPolicies } : {}),
    ...(doc.pendingHostActions ? { pendingHostActions: doc.pendingHostActions } : {}),
    ...(doc.lastClientTarget ? { lastClientTarget: doc.lastClientTarget } : {}),
  };
  writeStore(STORAGE_PORTABLE_SIM_KEY, diskDoc);

  const runtimeDoc: PortableShareDocument = {
    schemaVersion: 1,
    updatedAt: nowIso,
    shares: runtimeShares,
    ...(doc.hostPolicies ? { hostPolicies: doc.hostPolicies } : {}),
    ...(doc.pendingHostActions ? { pendingHostActions: doc.pendingHostActions } : {}),
    ...(doc.lastClientTarget ? { lastClientTarget: doc.lastClientTarget } : {}),
  };
  return {
    success: true,
    document: runtimeDoc,
    status: {
      supported: true,
      mode: 'web-preview',
      directory: '웹 프리뷰 시뮬레이션 USB 폴더',
      fileName: PORTABLE_FILE_NAME,
      filePath: PORTABLE_FILE_NAME,
      writable: true,
      hasExistingFile: true,
      lastSyncedAt: nowIso,
    },
  };
}

/**
 * Merges the current machine's ActiveShare list into an existing portable USB document
 * WITHOUT removing or modifying shares saved by other host PCs.
 */
export function mergeHostSharesIntoPortable(
  existingPortableShares: PortableHostShareEntry[],
  currentHostShares: ActiveShare[],
  netInfo: LocalNetworkInfo
): PortableHostShareEntry[] {
  const hostLower = netInfo.hostname.trim().toLowerCase();
  const preservedRemoteShares = existingPortableShares.filter(
    (entry) => (entry.sourceHostName || '').trim().toLowerCase() !== hostLower
  );
  const prevSameHostMap = new Map<string, PortableHostShareEntry>(
    existingPortableShares
      .filter((entry) => (entry.sourceHostName || '').trim().toLowerCase() === hostLower)
      .map((entry) => [entry.shareName.trim().toLowerCase(), entry])
  );

  const nowIso = new Date().toISOString();
  const updatedCurrentEntries: PortableHostShareEntry[] = currentHostShares.map((sh) => {
    const prevPortable = prevSameHostMap.get(sh.shareName.trim().toLowerCase());
    const decodedToken = decodeConnectionCode(sh.connectionCode);
    const resolvedPassword =
      sh.restoredPassword ||
      getCachedPassword(netInfo.hostname, sh.shareName) ||
      prevPortable?.password ||
      decodedToken?.password ||
      '';
    if (resolvedPassword) {
      setCachedPassword(netInfo.hostname, sh.shareName, resolvedPassword);
    }

    const resolvedUsername = sh.username || prevPortable?.username || decodedToken?.username || '';
    const fullCode = encodeConnectionCode({
      v: decodedToken?.v || 1,
      hostName: netInfo.hostname,
      ip: netInfo.primaryIp,
      shareName: sh.shareName,
      authMode: sh.authMode,
      username: sh.authMode === 'account' ? resolvedUsername || undefined : undefined,
      password: sh.authMode === 'account' ? resolvedPassword || undefined : undefined,
      createdAt: decodedToken?.createdAt || sh.createdAt || nowIso,
    });

    return {
      sourceHostName: netInfo.hostname,
      sourceIp: netInfo.primaryIp,
      shareName: sh.shareName,
      folderPath: sh.folderPath,
      uncPath: sh.uncPath,
      authMode: sh.authMode,
      permission: sh.permission,
      username: sh.authMode === 'account' ? resolvedUsername || undefined : undefined,
      password: sh.authMode === 'account' ? resolvedPassword || undefined : undefined,
      createdAt: sh.createdAt,
      updatedAt: nowIso,
      ...(typeof sh.ttlMinutes === 'number' && sh.ttlMinutes > 0 ? { ttlMinutes: sh.ttlMinutes } : {}),
      ...(sh.expiresAt ? { expiresAt: sh.expiresAt } : {}),
      ...(typeof sh.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: sh.autoRevokeOnExpiry } : {}),
      connectionCode: fullCode,
    };
  });

  return [...updatedCurrentEntries, ...preservedRemoteShares];
}

export function sortPortableEntriesForClient(
  entries: PortableHostShareEntry[],
  currentHostname: string
): PortableHostShareEntry[] {
  const hostLower = currentHostname.trim().toLowerCase();
  const remote = entries.filter((e) => (e.sourceHostName || '').trim().toLowerCase() !== hostLower);
  const local = entries.filter((e) => (e.sourceHostName || '').trim().toLowerCase() === hostLower);
  return [...remote, ...local];
}

function sanitizeLocalShareForStorage(share: ActiveShare, netInfo: LocalNetworkInfo): ActiveShare {
  const cleanCode = stripPasswordFromCode(share.connectionCode, {
    shareName: share.shareName,
    authMode: share.authMode,
    username: share.username,
    createdAt: share.createdAt,
    hostName: share.sourceHostName || netInfo.hostname,
    ip: share.sourceIp || netInfo.primaryIp,
  });
  return {
    shareName: share.shareName,
    folderPath: share.folderPath,
    uncPath: share.uncPath,
    authMode: share.authMode,
    permission: share.permission,
    username: share.username,
    createdAt: share.createdAt,
    connectionCode: cleanCode,
    sourceHostName: share.sourceHostName || netInfo.hostname,
    sourceIp: share.sourceIp || netInfo.primaryIp,
    updatedAt: share.updatedAt,
    ...(typeof share.ttlMinutes === 'number' && share.ttlMinutes > 0 ? { ttlMinutes: share.ttlMinutes } : {}),
    ...(share.expiresAt ? { expiresAt: share.expiresAt } : {}),
    ...(typeof share.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: share.autoRevokeOnExpiry } : {}),
  };
}

function sanitizeLocationShareForSim(entry: PortableHostShareEntry): PortableHostShareEntry {
  const cleanCode = stripPasswordFromCode(entry.connectionCode, {
    shareName: entry.shareName,
    authMode: entry.authMode,
    username: entry.username,
    createdAt: entry.createdAt,
    hostName: entry.sourceHostName,
    ip: entry.sourceIp,
  });
  return {
    sourceHostName: entry.sourceHostName,
    sourceIp: entry.sourceIp,
    shareName: entry.shareName,
    folderPath: entry.folderPath,
    uncPath: entry.uncPath,
    authMode: entry.authMode,
    permission: entry.permission,
    ...(entry.username ? { username: entry.username } : {}),
    ...(entry.encryptedCredentials ? { encryptedCredentials: entry.encryptedCredentials } : {}),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    ...(typeof entry.ttlMinutes === 'number' && entry.ttlMinutes > 0 ? { ttlMinutes: entry.ttlMinutes } : {}),
    ...(entry.expiresAt ? { expiresAt: entry.expiresAt } : {}),
    ...(typeof entry.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: entry.autoRevokeOnExpiry } : {}),
    connectionCode: cleanCode,
  };
}

function normalizeLocationProfileId(rawId: string | undefined, locationName: string): string {
  const source = String(rawId || locationName || '').trim() || '새 사용장소';
  const fallbackSlug = source
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  if (!/[^\x00-\x7F]/.test(source) && fallbackSlug && /^[a-z0-9]/.test(fallbackSlug)) {
    return fallbackSlug;
  }
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return fallbackSlug
    ? `${fallbackSlug}-${hash.toString(16).padStart(8, '0')}`
    : `loc-${hash.toString(16).padStart(8, '0')}`;
}

export const isElectronRuntime = (): boolean => Boolean(window.ahbiShareElectron?.isElectron);

export const shareBridge = {
  async getLocalNetworkInfo(): Promise<LocalNetworkInfo> {
    if (window.ahbiShareElectron?.getLocalNetworkInfo) {
      const info = await window.ahbiShareElectron.getLocalNetworkInfo();
      const build = info.osBuild || 26100;
      const osEra = info.osEra || classifyOsEra(build, info.osDisplayVersion);
      return {
        hostname: info.hostname,
        primaryIp: info.primaryIp,
        adapterName: info.adapterName,
        subnetPrefix: info.subnetPrefix,
        isElectron: true,
        isAdmin: info.isAdmin ?? true,
        osProductName: info.osProductName || 'Windows',
        osDisplayVersion: info.osDisplayVersion || '',
        osBuild: build,
        osEra,
      };
    }
    return {
      hostname: 'MAIN-HOST-PC',
      primaryIp: '192.168.0.105',
      adapterName: 'Ethernet (Web Preview)',
      subnetPrefix: '192.168.0',
      isElectron: false,
      isAdmin: true,
      osProductName: webSimPolicyBase.osProductName,
      osDisplayVersion: webSimPolicyBase.osDisplayVersion,
      osBuild: webSimPolicyBase.osBuild,
      osEra: webSimPolicyBase.osEra,
    };
  },

  async loadPortableState(netInfo: LocalNetworkInfo): Promise<PortableLoadResult> {
    const res = window.ahbiShareElectron?.loadPortableData
      ? await window.ahbiShareElectron.loadPortableData()
      : await loadWebPreviewPortable();

    latestPortableDoc = res.document;
    latestPortableStatus = res.status;

    for (const entry of res.document.shares) {
      if (entry.password) {
        setCachedPassword(entry.sourceHostName || netInfo.hostname, entry.shareName, entry.password);
      }
    }

    // Rehydrate saved local shares if this PC matches entries from the USB portable file
    const hostLower = netInfo.hostname.trim().toLowerCase();
    const matchingCurrentHostEntries = res.document.shares.filter(
      (s) => (s.sourceHostName || '').trim().toLowerCase() === hostLower
    );
    if (matchingCurrentHostEntries.length > 0) {
      const existingLocal = readStore<ActiveShare[]>(STORAGE_SHARES_KEY, []);
      const existingMap = new Map(existingLocal.map((s) => [s.shareName.toLowerCase(), s]));
      for (const entry of matchingCurrentHostEntries) {
        const key = entry.shareName.toLowerCase();
        const sanitizedLocal: ActiveShare = {
          shareName: entry.shareName,
          folderPath: entry.folderPath,
          uncPath: entry.uncPath,
          authMode: entry.authMode,
          permission: entry.permission,
          username: entry.username,
          createdAt: entry.createdAt,
          connectionCode: entry.connectionCode,
          sourceHostName: entry.sourceHostName,
          sourceIp: entry.sourceIp,
          updatedAt: entry.updatedAt,
          ttlMinutes: entry.ttlMinutes,
          expiresAt: entry.expiresAt,
          autoRevokeOnExpiry: entry.autoRevokeOnExpiry,
          decryptionFailed: entry.decryptionFailed,
        };
        existingMap.set(key, sanitizeLocalShareForStorage(sanitizedLocal, netInfo));
      }
      writeStore(STORAGE_SHARES_KEY, Array.from(existingMap.values()));
    }

    return res;
  },

  getPortableSnapshot(): { document: PortableShareDocument; status: PortableStorageStatus } {
    return { document: latestPortableDoc, status: latestPortableStatus };
  },

  getHostPolicySnapshots(): Record<string, HostPolicySnapshot> {
    return latestPortableDoc.hostPolicies ? { ...latestPortableDoc.hostPolicies } : {};
  },

  getPendingHostActions(): Record<string, PendingHostPolicyTask> {
    return latestPortableDoc.pendingHostActions ? { ...latestPortableDoc.pendingHostActions } : {};
  },

  async savePendingHostPolicyTask(
    taskInput: Omit<PendingHostPolicyTask, 'taskId' | 'createdAt'>
  ): Promise<{ success: boolean; task: PendingHostPolicyTask; pendingHostActions: Record<string, PendingHostPolicyTask> }> {
    const cleanTarget = (taskInput.targetHostName || '').trim() || 'MAIN-HOST-PC';
    const nextTask: PendingHostPolicyTask = {
      taskId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      targetHostName: cleanTarget,
      ...(taskInput.targetIp ? { targetIp: taskInput.targetIp.trim() } : {}),
      requestedByHostName: (taskInput.requestedByHostName || 'CLIENT-PC').trim(),
      ...(taskInput.requestedByIp ? { requestedByIp: taskInput.requestedByIp.trim() } : {}),
      modes: Array.from(new Set(taskInput.modes || [])),
      includeGuestUnlock: Boolean(taskInput.includeGuestUnlock),
      conflictLabels: Array.from(new Set(taskInput.conflictLabels || [])),
      ...(taskInput.note ? { note: taskInput.note.trim() } : {}),
      createdAt: new Date().toISOString(),
    };
    const nextMap: Record<string, PendingHostPolicyTask> = {};
    for (const [k, v] of Object.entries(latestPortableDoc.pendingHostActions || {})) {
      if (k.trim().toLowerCase() !== cleanTarget.toLowerCase()) {
        nextMap[k] = v;
      }
    }
    nextMap[cleanTarget] = nextTask;

    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: latestPortableDoc.shares,
      ...(latestPortableDoc.hostPolicies ? { hostPolicies: latestPortableDoc.hostPolicies } : {}),
      pendingHostActions: nextMap,
      ...(latestPortableDoc.lastClientTarget ? { lastClientTarget: latestPortableDoc.lastClientTarget } : {}),
    };
    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);
    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return {
      success: res.success,
      task: nextTask,
      pendingHostActions: res.document.pendingHostActions || nextMap,
    };
  },

  async deletePendingHostPolicyTask(
    targetHostName: string
  ): Promise<Record<string, PendingHostPolicyTask>> {
    const cleanLower = (targetHostName || '').trim().toLowerCase();
    const nextMap: Record<string, PendingHostPolicyTask> = {};
    for (const [k, v] of Object.entries(latestPortableDoc.pendingHostActions || {})) {
      if (
        k.trim().toLowerCase() !== cleanLower &&
        (v.targetHostName || '').trim().toLowerCase() !== cleanLower
      ) {
        nextMap[k] = v;
      }
    }
    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: latestPortableDoc.shares,
      ...(latestPortableDoc.hostPolicies ? { hostPolicies: latestPortableDoc.hostPolicies } : {}),
      ...(Object.keys(nextMap).length > 0 ? { pendingHostActions: nextMap } : {}),
      ...(latestPortableDoc.lastClientTarget ? { lastClientTarget: latestPortableDoc.lastClientTarget } : {}),
    };
    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);
    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return res.document.pendingHostActions || {};
  },

  async persistHostPolicySnapshot(
    hostName: string,
    policy: OsNetworkPolicyStatus,
    sourceIp?: string
  ): Promise<Record<string, HostPolicySnapshot>> {
    const cleanHost = (hostName || 'MAIN-HOST-PC').trim();
    const snap = toHostPolicySnapshot(cleanHost, policy, sourceIp);
    const nextMap: Record<string, HostPolicySnapshot> = {
      ...(latestPortableDoc.hostPolicies || {}),
      [cleanHost]: snap,
    };
    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: latestPortableDoc.shares,
      hostPolicies: nextMap,
      ...(latestPortableDoc.pendingHostActions ? { pendingHostActions: latestPortableDoc.pendingHostActions } : {}),
      ...(latestPortableDoc.lastClientTarget ? { lastClientTarget: latestPortableDoc.lastClientTarget } : {}),
    };
    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);
    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return res.document.hostPolicies || nextMap;
  },

  async deleteHostPolicySnapshot(
    hostName: string
  ): Promise<Record<string, HostPolicySnapshot>> {
    const cleanLower = (hostName || '').trim().toLowerCase();
    const curMap: Record<string, HostPolicySnapshot> = {};
    for (const [k, v] of Object.entries(latestPortableDoc.hostPolicies || {})) {
      if (k.trim().toLowerCase() !== cleanLower && (v.hostName || '').trim().toLowerCase() !== cleanLower) {
        curMap[k] = v;
      }
    }
    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: latestPortableDoc.shares,
      hostPolicies: curMap,
      ...(latestPortableDoc.pendingHostActions ? { pendingHostActions: latestPortableDoc.pendingHostActions } : {}),
      ...(latestPortableDoc.lastClientTarget ? { lastClientTarget: latestPortableDoc.lastClientTarget } : {}),
    };
    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);
    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return res.document.hostPolicies || curMap;
  },

  async clearAllHostPolicySnapshots(): Promise<Record<string, HostPolicySnapshot>> {
    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: latestPortableDoc.shares,
      hostPolicies: {},
      ...(latestPortableDoc.pendingHostActions ? { pendingHostActions: latestPortableDoc.pendingHostActions } : {}),
      ...(latestPortableDoc.lastClientTarget ? { lastClientTarget: latestPortableDoc.lastClientTarget } : {}),
    };
    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);
    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return {};
  },

  async deletePortableHostShare(
    sourceHostName: string,
    shareName: string
  ): Promise<PortableSaveResult> {
    const hostLower = (sourceHostName || '').trim().toLowerCase();
    const shareLower = (shareName || '').trim().toLowerCase();
    const filteredShares = (latestPortableDoc.shares || []).filter((entry) => {
      const eHost = (entry.sourceHostName || '').trim().toLowerCase();
      const eShare = (entry.shareName || '').trim().toLowerCase();
      return !(eHost === hostLower && eShare === shareLower);
    });
    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: filteredShares,
      ...(latestPortableDoc.hostPolicies ? { hostPolicies: latestPortableDoc.hostPolicies } : {}),
      ...(latestPortableDoc.pendingHostActions ? { pendingHostActions: latestPortableDoc.pendingHostActions } : {}),
      ...(latestPortableDoc.lastClientTarget ? { lastClientTarget: latestPortableDoc.lastClientTarget } : {}),
    };
    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);
    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return res;
  },

  async persistPortableHostShares(
    currentHostShares: ActiveShare[],
    netInfo: LocalNetworkInfo
  ): Promise<PortableSaveResult> {
    const mergedShares = mergeHostSharesIntoPortable(latestPortableDoc.shares, currentHostShares, netInfo);
    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: mergedShares,
      ...(latestPortableDoc.hostPolicies ? { hostPolicies: latestPortableDoc.hostPolicies } : {}),
      ...(latestPortableDoc.pendingHostActions ? { pendingHostActions: latestPortableDoc.pendingHostActions } : {}),
      ...(latestPortableDoc.lastClientTarget ? { lastClientTarget: latestPortableDoc.lastClientTarget } : {}),
    };

    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);

    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return res;
  },

  async persistPortableLastClientTarget(config: ClientTargetConfig): Promise<PortableSaveResult> {
    const nextDoc: PortableShareDocument = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      shares: latestPortableDoc.shares,
      ...(latestPortableDoc.hostPolicies ? { hostPolicies: latestPortableDoc.hostPolicies } : {}),
      ...(latestPortableDoc.pendingHostActions ? { pendingHostActions: latestPortableDoc.pendingHostActions } : {}),
      lastClientTarget: {
        targetHost: config.targetHost.trim(),
        shareName: config.shareName.trim(),
        driveLetter: (config.driveLetter || 'Z:').replace(/:?$/, ':').toUpperCase(),
        authMode: config.authMode,
        updatedAt: new Date().toISOString(),
      },
    };
    const res = window.ahbiShareElectron?.savePortableData
      ? await window.ahbiShareElectron.savePortableData(nextDoc)
      : await saveWebPreviewPortable(nextDoc);
    latestPortableDoc = res.document;
    latestPortableStatus = res.status;
    return res;
  },

  async selectFolder(currentPath: string): Promise<string | null> {
    if (window.ahbiShareElectron?.selectFolder) {
      const res = await window.ahbiShareElectron.selectFolder();
      return res.canceled ? null : res.path;
    }
    return currentPath || 'D:\\SharedWork';
  },

  async openLocalOrUncPath(pathToOpen: string): Promise<{ success: boolean; message: string }> {
    if (window.ahbiShareElectron?.openPath) {
      const res = await window.ahbiShareElectron.openPath(pathToOpen);
      return { success: res.success, message: res.error || `Opened ${pathToOpen}` };
    }
    return {
      success: true,
      message: `웹 미리보기 모드: Windows 실행 환경에서는 탐색기(${pathToOpen})가 즉시 열립니다.`,
    };
  },

  getSavedShares(): ActiveShare[] {
    const shares = readStore<ActiveShare[]>(STORAGE_SHARES_KEY, []);
    return shares.map((s) => {
      const cachedPass = s.sourceHostName ? getCachedPassword(s.sourceHostName, s.shareName) : undefined;
      if (!cachedPass) return s;
      const decoded = decodeConnectionCode(s.connectionCode);
      const rehydrated = encodeConnectionCode({
        v: decoded?.v || 1,
        hostName: decoded?.hostName || s.sourceHostName || '',
        ip: decoded?.ip || s.sourceIp || '',
        shareName: s.shareName,
        authMode: s.authMode,
        username: s.username || decoded?.username,
        password: cachedPass,
        createdAt: decoded?.createdAt || s.createdAt,
      });
      return { ...s, restoredPassword: cachedPass, connectionCode: rehydrated };
    });
  },

  getSavedMounts(): MountedDrive[] {
    return readStore<MountedDrive[]>(STORAGE_MOUNTS_KEY, []);
  },

  async syncLiveState(
    netInfo: LocalNetworkInfo
  ): Promise<{ shares: ActiveShare[]; mounts: MountedDrive[]; portable: PortableLoadResult }> {
    const portable = await this.loadPortableState(netInfo);
    const savedShares = this.getSavedShares();
    const savedMounts = readStore<MountedDrive[]>(STORAGE_MOUNTS_KEY, []);
    if (!window.ahbiShareElectron?.runPowerShell) {
      return { shares: savedShares, mounts: savedMounts, portable };
    }

    try {
      const res = await window.ahbiShareElectron.runPowerShell(buildLiveStateScript());
      if (!res.success || !res.output) return { shares: savedShares, mounts: savedMounts, portable };
      const parsed = parseLastJsonObject<{
        shares?: Array<{ shareName: string; folderPath: string }>;
        mappings?: Array<{ driveLetter: string; uncPath: string; status?: string }>;
      }>(res.output);
      if (!parsed) return { shares: savedShares, mounts: savedMounts, portable };

      const liveSharesList = Array.isArray(parsed.shares) ? parsed.shares : [];
      const savedByName = new Map(savedShares.map((s) => [s.shareName.toLowerCase(), s]));
      const mergedShares: ActiveShare[] = liveSharesList.map((live) => {
        const prev = savedByName.get(live.shareName.toLowerCase());
        const expectedUnc = `\\\\${netInfo.primaryIp}\\${live.shareName}`;
        if (prev) {
          const cachedPass = prev.restoredPassword || getCachedPassword(netInfo.hostname, live.shareName);
          const nextFolderPath = live.folderPath || prev.folderPath;
          if (prev.uncPath === expectedUnc && prev.sourceIp === netInfo.primaryIp && prev.folderPath === nextFolderPath) {
            return prev;
          }
          return {
            ...prev,
            folderPath: nextFolderPath,
            uncPath: expectedUnc,
            sourceHostName: netInfo.hostname,
            sourceIp: netInfo.primaryIp,
            updatedAt: new Date().toISOString(),
            restoredPassword: cachedPass,
            connectionCode: encodeConnectionCode({
              v: 1,
              hostName: netInfo.hostname,
              ip: netInfo.primaryIp,
              shareName: live.shareName,
              authMode: prev.authMode,
              username: prev.username,
              password: prev.authMode === 'account' ? cachedPass : undefined,
              createdAt: prev.createdAt,
            }),
          };
        }
        const code = encodeConnectionCode({
          v: 1,
          hostName: netInfo.hostname,
          ip: netInfo.primaryIp,
          shareName: live.shareName,
          authMode: 'guest',
          createdAt: new Date().toISOString(),
        });
        return {
          shareName: live.shareName,
          folderPath: live.folderPath,
          uncPath: expectedUnc,
          authMode: 'guest',
          permission: 'full',
          createdAt: '기존 공유',
          sourceHostName: netInfo.hostname,
          sourceIp: netInfo.primaryIp,
          connectionCode: code,
        };
      });

      const liveMappingsList = Array.isArray(parsed.mappings) ? parsed.mappings : [];
      const savedByDrive = new Map(savedMounts.map((m) => [m.driveLetter.toUpperCase(), m]));
      const normalizeUnc = (u: string) => u.trim().replace(/[\\/]+$/, '').toLowerCase();
      const mergedMounts: MountedDrive[] = liveMappingsList.map((live) => {
        const dl = live.driveLetter.toUpperCase();
        const prev = savedByDrive.get(dl);
        const liveStatus: 'connected' | 'disconnected' = live.status === 'OK' ? 'connected' : 'disconnected';
        if (prev && normalizeUnc(prev.uncPath) === normalizeUnc(live.uncPath)) {
          return prev.status === liveStatus ? prev : { ...prev, status: liveStatus };
        }
        const uncParts = live.uncPath.replace(/^\\\\/, '').split('\\');
        return {
          driveLetter: dl,
          uncPath: live.uncPath,
          targetHost: uncParts[0] || '',
          shareName: uncParts[1] || '',
          authMode: 'guest',
          mountedAt: '기존 연결',
          status: liveStatus,
        };
      });

      writeStore(
        STORAGE_SHARES_KEY,
        mergedShares.map((s) => sanitizeLocalShareForStorage(s, netInfo))
      );
      writeStore(STORAGE_MOUNTS_KEY, mergedMounts);

      // Update portable JSON ONLY if this current PC has live shares OR previously stored shares for itself
      const hostLower = netInfo.hostname.trim().toLowerCase();
      const prevSameHostCount = latestPortableDoc.shares.filter(
        (entry) => (entry.sourceHostName || '').trim().toLowerCase() === hostLower
      ).length;
      if (mergedShares.length > 0 || prevSameHostCount > 0) {
        await this.persistPortableHostShares(mergedShares, netInfo);
      }

      return {
        shares: mergedShares,
        mounts: mergedMounts,
        portable: { success: true, document: latestPortableDoc, status: latestPortableStatus },
      };
    } catch {
      return { shares: savedShares, mounts: savedMounts, portable };
    }
  },

  async runHostOneClick(
    config: HostConfig,
    netInfo: LocalNetworkInfo,
    onProgress: (steps: PipelineStep[]) => void
  ): Promise<{ success: boolean; share?: ActiveShare; steps: PipelineStep[]; portableStatus?: PortableStorageStatus }> {
    const definitions = buildHostStepScripts(config, netInfo.osEra);
    const steps: PipelineStep[] = definitions.map((d) => ({
      id: d.id,
      title: d.title,
      detail: d.detail,
      status: 'idle',
    }));
    onProgress([...steps]);

    for (let i = 0; i < definitions.length; i++) {
      steps[i].status = 'running';
      onProgress([...steps]);
      const t0 = performance.now();

      if (window.ahbiShareElectron?.runPowerShell) {
        const res = await window.ahbiShareElectron.runPowerShell(definitions[i].script);
        steps[i].durationMs = Math.round(performance.now() - t0);
        if (!res.success) {
          steps[i].status = 'error';
          steps[i].error = res.error || 'PowerShell execution failed';
          steps[i].output = res.output;
          onProgress([...steps]);
          return { success: false, steps };
        }
        steps[i].status = 'success';
        steps[i].output = res.output || '완료';
      } else {
        await new Promise((r) => setTimeout(r, 170));
        steps[i].durationMs = Math.round(performance.now() - t0);
        steps[i].status = 'success';
        steps[i].output = `[시뮬레이션 완료] ${definitions[i].title}`;
      }
      onProgress([...steps]);
    }

    const cleanShareName = config.shareName.trim() || 'AhBiShared';
    const accountPass = config.authMode === 'account' ? config.password : undefined;
    if (accountPass) {
      setCachedPassword(netInfo.hostname, cleanShareName, accountPass);
    }

    const code = encodeConnectionCode({
      v: 1,
      hostName: netInfo.hostname,
      ip: netInfo.primaryIp,
      shareName: cleanShareName,
      authMode: config.authMode,
      username: config.authMode === 'account' ? config.username.trim() : undefined,
      password: accountPass,
      createdAt: new Date().toISOString(),
    });

    const ttlMinutes = typeof config.ttlMinutes === 'number' && config.ttlMinutes > 0 ? config.ttlMinutes : undefined;
    const expiresAt = ttlMinutes ? new Date(Date.now() + ttlMinutes * 60_000).toISOString() : undefined;
    const autoRevokeOnExpiry = ttlMinutes ? Boolean(config.autoRevokeOnExpiry) : undefined;

    const normalizedFolder = (config.folderPath.trim() || 'C:\\AhBiShared').replace(/\//g, '\\').replace(/\\+$/, '');
    const newShare: ActiveShare = {
      shareName: cleanShareName,
      folderPath: /^[A-Za-z]:$/.test(normalizedFolder) ? `${normalizedFolder}\\` : normalizedFolder,
      uncPath: `\\\\${netInfo.primaryIp}\\${cleanShareName}`,
      authMode: config.authMode,
      permission: config.permission,
      username: config.authMode === 'account' ? config.username.trim() : undefined,
      createdAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      connectionCode: code,
      sourceHostName: netInfo.hostname,
      sourceIp: netInfo.primaryIp,
      updatedAt: new Date().toISOString(),
      ...(ttlMinutes ? { ttlMinutes, expiresAt, autoRevokeOnExpiry } : {}),
      restoredPassword: accountPass,
    };

    const existing = this.getSavedShares();
    const updated = [newShare, ...existing.filter((s) => s.shareName.toLowerCase() !== newShare.shareName.toLowerCase())];
    writeStore(
      STORAGE_SHARES_KEY,
      updated.map((s) => sanitizeLocalShareForStorage(s, netInfo))
    );

    const portableSave = await this.persistPortableHostShares(updated, netInfo);

    return { success: true, share: newShare, steps, portableStatus: portableSave.status };
  },

  async removeHostShare(shareName: string, netInfo?: LocalNetworkInfo): Promise<ActiveShare[]> {
    if (window.ahbiShareElectron?.runPowerShell) {
      const safe = shareName.replace(/'/g, "''");
      const res = await window.ahbiShareElectron.runPowerShell(`
        $p_share = '${safe}'
        if (Get-Command Get-SmbShare -ErrorAction SilentlyContinue) {
          if (Get-SmbShare -Name $p_share -ErrorAction SilentlyContinue) {
            Remove-SmbShare -Name $p_share -Force -ErrorAction Stop
          }
        } else {
          try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
          $script:__rmOut = (& net.exe share $p_share /delete /y 2>&1) -join ' '
          $rmCode = $LASTEXITCODE
          try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
          if ($rmCode -ne 0) {
            $stillShared = (& net.exe share 2>$null | Where-Object { $_ -match ('^' + [regex]::Escape($p_share) + '\\s+') })
            if ($stillShared) { throw ("공유 해제 실패 (" + $p_share + "): " + $script:__rmOut) }
          }
        }
        Write-Output "Removed share"
      `.trim());
      if (!res.success) {
        throw new Error(res.error || `'${shareName}' 공유 해제 실패`);
      }
    }
    const targetLower = shareName.toLowerCase();
    const updated = this.getSavedShares().filter((s) => s.shareName.toLowerCase() !== targetLower);
    if (netInfo) {
      runtimeSharePasswordCache.delete(cacheKeyForShare(netInfo.hostname, shareName));
      writeStore(
        STORAGE_SHARES_KEY,
        updated.map((s) => sanitizeLocalShareForStorage(s, netInfo))
      );
      await this.persistPortableHostShares(updated, netInfo);
    } else {
      writeStore(STORAGE_SHARES_KEY, updated);
    }
    return updated;
  },

  async scanLanPeers(netInfo: LocalNetworkInfo): Promise<DiscoveredPeer[]> {
    if (window.ahbiShareElectron?.scanLanPeers) {
      const res = await window.ahbiShareElectron.scanLanPeers(netInfo.subnetPrefix);
      return res.peers || [];
    }

    await new Promise((r) => setTimeout(r, 450));
    const localShares = this.getSavedShares();
    const peers: DiscoveredPeer[] = [...DEFAULT_MOCK_PEERS];

    if (localShares.length > 0) {
      const shareCodes: Record<string, string> = {};
      for (const sh of localShares) {
        shareCodes[sh.shareName] = sh.connectionCode;
      }
      peers.unshift({
        hostName: netInfo.hostname,
        ipAddress: netInfo.primaryIp,
        latencyMs: 1,
        smbPortOpen: true,
        availableShares: localShares.map((s) => s.shareName),
        authModeHint: localShares[0].authMode,
        shareCodes,
        lastSeen: '방금 전',
      });
    }
    return peers;
  },

  async runClientOneClick(
    config: ClientTargetConfig,
    onProgress: (steps: PipelineStep[]) => void,
    osEra?: WindowsNetworkEra
  ): Promise<{ success: boolean; mount?: MountedDrive; steps: PipelineStep[] }> {
    const definitions = buildClientStepScripts(config, osEra);
    const steps: PipelineStep[] = definitions.map((d) => ({
      id: d.id,
      title: d.title,
      detail: d.detail,
      status: 'idle',
    }));
    onProgress([...steps]);

    for (let i = 0; i < definitions.length; i++) {
      steps[i].status = 'running';
      onProgress([...steps]);
      const t0 = performance.now();

      if (window.ahbiShareElectron?.runPowerShell) {
        const res = await window.ahbiShareElectron.runPowerShell(definitions[i].script);
        steps[i].durationMs = Math.round(performance.now() - t0);
        if (!res.success) {
          steps[i].status = 'error';
          steps[i].error = res.error || 'Client command failed';
          steps[i].output = res.output;
          onProgress([...steps]);
          return { success: false, steps };
        }
        steps[i].status = 'success';
        steps[i].output = res.output || '완료';
      } else {
        await new Promise((r) => setTimeout(r, 170));
        steps[i].durationMs = Math.round(performance.now() - t0);
        steps[i].status = 'success';
        steps[i].output = `[시뮬레이션 완료] ${definitions[i].title}`;
      }
      onProgress([...steps]);
    }

    const normalizedDrive = (config.driveLetter || 'Z:').replace(/:?$/, ':').toUpperCase();
    const trimmedHost = config.targetHost.trim();
    const trimmedShare = config.shareName.trim();
    const trimmedUser = config.authMode === 'account' ? config.username.trim() : '';
    if (config.authMode === 'account' && config.password) {
      setCachedPassword(trimmedHost, trimmedShare, config.password);
    }
    const mount: MountedDrive = {
      driveLetter: normalizedDrive,
      uncPath: `\\\\${trimmedHost}\\${trimmedShare}`,
      targetHost: trimmedHost,
      shareName: trimmedShare,
      authMode: config.authMode,
      ...(trimmedUser ? { username: trimmedUser } : {}),
      mountedAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      status: 'connected',
    };

    const existing = readStore<MountedDrive[]>(STORAGE_MOUNTS_KEY, []);
    const updated = [mount, ...existing.filter((m) => m.driveLetter !== normalizedDrive)];
    writeStore(STORAGE_MOUNTS_KEY, updated);

    await this.persistPortableLastClientTarget(config);

    return { success: true, mount, steps };
  },

  async unmountDrive(driveLetter: string): Promise<MountedDrive[]> {
    const clean = driveLetter.trim().replace(/:?$/, ':').toUpperCase();
    if (window.ahbiShareElectron?.runPowerShell) {
      const safeDrive = clean.replace(/'/g, "''");
      const res = await window.ahbiShareElectron.runPowerShell(`
        $p_drive = '${safeDrive}'
        if (Get-Command Remove-SmbMapping -ErrorAction SilentlyContinue) {
          Remove-SmbMapping -LocalPath $p_drive -Force -UpdateProfile -ErrorAction SilentlyContinue | Out-Null
        }
        try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
        $script:__netDelOut = (& net.exe use $p_drive /delete /y 2>&1) -join ' '
        $delCode = $LASTEXITCODE
        try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
        if ($delCode -ne 0) {
          $stillExists = $false
          if (Get-Command Get-SmbMapping -ErrorAction SilentlyContinue) {
            $stillExists = [bool](Get-SmbMapping -LocalPath $p_drive -ErrorAction SilentlyContinue)
          } else {
            $stillExists = Test-Path ($p_drive + '\\')
          }
          if ($stillExists) { throw ("드라이브 연결 해제 실패 (" + $p_drive + "): " + $script:__netDelOut) }
        }
        Write-Output "Disconnected drive"
      `.trim());
      if (!res.success) {
        throw new Error(res.error || `${clean} 드라이브 연결 해제 실패`);
      }
    }
    const updated = readStore<MountedDrive[]>(STORAGE_MOUNTS_KEY, []).filter((m) => m.driveLetter.toUpperCase() !== clean);
    writeStore(STORAGE_MOUNTS_KEY, updated);
    return updated;
  },

  async rollbackPolicies(scope: 'host' | 'client', netInfo?: LocalNetworkInfo): Promise<{ success: boolean; message: string }> {
    if (window.ahbiShareElectron?.runPowerShell) {
      const res = await window.ahbiShareElectron.runPowerShell(buildRollbackScript(scope));
      if (!res.success) return { success: false, message: res.error || '원복 명령 실행 실패' };
      if (scope === 'host') {
        writeStore(STORAGE_SHARES_KEY, []);
        if (netInfo) await this.persistPortableHostShares([], netInfo);
      } else {
        writeStore(STORAGE_MOUNTS_KEY, []);
      }
      return { success: true, message: res.output || '보안 기본값으로 원상복구되었습니다.' };
    }
    await new Promise((r) => setTimeout(r, 300));
    if (scope === 'host') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        smbServerSigningRequired: true,
        localAccountTokenFilterEnabled: false,
        limitBlankPasswordUse: true,
        restrictNullSessAccess: true,
        restrictAnonymous: true,
        guestNetworkLogonDenied: true,
        guestAccountEnabled: false,
      };
      writeStore(STORAGE_SHARES_KEY, []);
      if (netInfo) await this.persistPortableHostShares([], netInfo);
    } else {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        smbClientSigningRequired: true,
        allowInsecureGuestAuth: false,
        enableInsecureGuestLogons: false,
      };
      writeStore(STORAGE_MOUNTS_KEY, []);
    }
    return {
      success: true,
      message: scope === 'host'
        ? '호스트 공유폴더 해제, 방화벽 폐쇄 및 LSA 익명 차단 정책을 기본값으로 원복했습니다.'
        : '클라이언트 네트워크 드라이브 해제 및 비인증 게스트 접속 차단을 기본값으로 원복했습니다.',
    };
  },

  async runDiagnostics(): Promise<DiagnosticCheck[]> {
    if (window.ahbiShareElectron?.runPowerShell) {
      const res = await window.ahbiShareElectron.runPowerShell(buildNetworkDiagnosticScript());
      if (res.success && res.output) {
        const d = parseLastJsonObject<{ LanmanWorkstation?: string; LanmanServer?: string; FDResPub?: string }>(res.output);
        if (d) {
          return [
            { id: 'ws', label: 'LanmanWorkstation (클라이언트)', status: d.LanmanWorkstation === 'Running' ? 'pass' : 'warn', detail: `서비스 상태: ${d.LanmanWorkstation || 'Unknown'}` },
            { id: 'srv', label: 'LanmanServer (호스트)', status: d.LanmanServer === 'Running' ? 'pass' : 'warn', detail: `서비스 상태: ${d.LanmanServer || 'Unknown'}` },
            { id: 'fd', label: 'FDResPub (네트워크 탐색 게시)', status: d.FDResPub === 'Running' ? 'pass' : 'warn', detail: `서비스 상태: ${d.FDResPub || 'Unknown'}` },
            { id: 'dns', label: 'DNS & ARP 테이블 캐시 초기화', status: 'pass', detail: 'ipconfig /flushdns 및 arp -d * 완료' },
          ];
        }
      }
    }
    await new Promise((r) => setTimeout(r, 420));
    return [
      { id: 'ws', label: 'LanmanWorkstation (SMB 클라이언트)', status: 'pass', detail: 'Running · SMB 2.0/3.1.1 협상 활성' },
      { id: 'srv', label: 'LanmanServer (SMB 파일 서버)', status: 'pass', detail: 'Running · TCP 445 리스닝 정상' },
      { id: 'fd', label: 'FDResPub / fdPHost (네트워크 탐색)', status: 'pass', detail: 'Running · WS-Discovery 브로드캐스트 활성' },
      { id: 'dns', label: 'DNS & ARP 캐시 리프레시', status: 'pass', detail: '이름 해석 및 ARP 캐시 초기화 완료' },
    ];
  },

  async pingHost(
    target: string,
    peers: DiscoveredPeer[] = [],
    netInfo?: LocalNetworkInfo
  ): Promise<PingHostResult> {
    const cleanTarget = target.trim();
    const targetErr = validateTargetHost(cleanTarget);
    if (targetErr) {
      throw new Error(targetErr);
    }

    if (window.ahbiShareElectron?.pingHost) {
      return await window.ahbiShareElectron.pingHost(cleanTarget);
    }

    await new Promise((r) => setTimeout(r, 260));
    const lower = cleanTarget.toLowerCase();
    const matchedPeer = peers.find(
      (p) => p.ipAddress.toLowerCase() === lower || p.hostName.toLowerCase() === lower
    );
    const isSelf =
      netInfo &&
      (netInfo.primaryIp.toLowerCase() === lower ||
        netInfo.hostname.toLowerCase() === lower ||
        lower === '127.0.0.1' ||
        lower === 'localhost');

    const baseLatency = matchedPeer ? matchedPeer.latencyMs : isSelf ? 1 : 3;
    const resolvedIp = matchedPeer
      ? matchedPeer.ipAddress
      : isSelf
        ? netInfo?.primaryIp || '127.0.0.1'
        : /^\d+\.\d+\.\d+\.\d+$/.test(cleanTarget)
          ? cleanTarget
          : undefined;
    const sameSubnet =
      Boolean(resolvedIp && netInfo?.subnetPrefix && resolvedIp.startsWith(`${netInfo.subnetPrefix}.`)) ||
      Boolean(matchedPeer) ||
      Boolean(isSelf);

    return {
      target: cleanTarget,
      resolvedIp,
      reachable: sameSubnet,
      avgLatencyMs: sameSubnet ? baseLatency : null,
      minLatencyMs: sameSubnet ? Math.max(1, baseLatency - 1) : null,
      maxLatencyMs: sameSubnet ? baseLatency + 1 : null,
      packetLossPct: sameSubnet ? 0 : 100,
      smbPortOpen: sameSubnet && (matchedPeer ? matchedPeer.smbPortOpen : true),
      detail: sameSubnet
        ? `웹 프리뷰 시뮬레이션: ${cleanTarget} 응답(${baseLatency}ms) 및 SMB 포트 445 개방 확인.`
        : `웹 프리뷰 시뮬레이션: ${cleanTarget}은 현재 서브넷(${netInfo?.subnetPrefix || '192.168.0'}.x) 외부이거나 응답이 없습니다.`,
      checkedAt: formatSnapshotTimestamp(new Date().toISOString()),
    };
  },

  async inspectOsNetworkPolicy(netInfo?: LocalNetworkInfo): Promise<OsNetworkPolicyStatus> {
    if (window.ahbiShareElectron?.runPowerShell) {
      const res = await window.ahbiShareElectron.runPowerShell(buildOsNetworkPolicyInspectScript());
      if (res.success && res.output) {
        const parsed = parseLastJsonObject<Partial<OsNetworkPolicyStatus> & { recentHotfixIds?: string[] | string }>(res.output);
        if (parsed) {
          const build = Number(parsed.osBuild) || netInfo?.osBuild || 26100;
          const disp = parsed.osDisplayVersion || netInfo?.osDisplayVersion || '';
          const era = classifyOsEra(build, disp);
          const hotfixes = Array.isArray(parsed.recentHotfixIds)
            ? parsed.recentHotfixIds.map(String)
            : typeof parsed.recentHotfixIds === 'string' && parsed.recentHotfixIds
              ? [parsed.recentHotfixIds]
              : [];
          const smb1Feat: 'Enabled' | 'Disabled' | 'Unknown' =
            parsed.smb1ClientFeatureState === 'Enabled'
              ? 'Enabled'
              : parsed.smb1ClientFeatureState === 'Disabled'
                ? 'Disabled'
                : 'Unknown';
          const base = {
            osProductName: parsed.osProductName || netInfo?.osProductName || 'Windows',
            osDisplayVersion: disp || (era === 'win11_25_26h2' ? '25H2/26H2' : era === 'win11_24h2' ? '24H2' : '22H2'),
            osBuild: build,
            osEra: era,
            osEditionId: parsed.osEditionId || 'Professional',
            osUbr: typeof parsed.osUbr === 'number' ? parsed.osUbr : null,
            recentHotfixIds: hotfixes,
            localAccountTokenFilterEnabled: Boolean(parsed.localAccountTokenFilterEnabled),
            smb1ClientFeatureState: smb1Feat,
            msaPinOnlyRisk: Boolean(parsed.msaPinOnlyRisk),
            networkProfile: parsed.networkProfile || 'Unknown',
            smb1Enabled: Boolean(parsed.smb1Enabled),
            smbServerSigningRequired: Boolean(parsed.smbServerSigningRequired),
            smbClientSigningRequired: Boolean(parsed.smbClientSigningRequired),
            allowInsecureGuestAuth: Boolean(parsed.allowInsecureGuestAuth),
            enableInsecureGuestLogons: Boolean(parsed.enableInsecureGuestLogons),
            guestNetworkLogonDenied: Boolean(parsed.guestNetworkLogonDenied),
            limitBlankPasswordUse:
              typeof parsed.limitBlankPasswordUse === 'boolean' ? parsed.limitBlankPasswordUse : undefined,
            restrictNullSessAccess:
              typeof parsed.restrictNullSessAccess === 'boolean' ? parsed.restrictNullSessAccess : undefined,
            restrictAnonymous:
              typeof parsed.restrictAnonymous === 'boolean' ? parsed.restrictAnonymous : undefined,
            guestAccountEnabled:
              typeof parsed.guestAccountEnabled === 'boolean' ? parsed.guestAccountEnabled : undefined,
            firewall445Allowed:
              typeof parsed.firewall445Allowed === 'boolean' ? parsed.firewall445Allowed : undefined,
            lmCompatibilityLevel: parsed.lmCompatibilityLevel ?? null,
            ntlmRestrictOutbound: parsed.ntlmRestrictOutbound ?? null,
            netbiosEnabled: Boolean(parsed.netbiosEnabled),
            smbEncryptData: Boolean(parsed.smbEncryptData),
            smbRejectUnencryptedAccess: Boolean(parsed.smbRejectUnencryptedAccess),
            smb2Enabled: parsed.smb2Enabled !== undefined ? Boolean(parsed.smb2Enabled) : true,
            smb1ServerEnabled: Boolean(parsed.smb1ServerEnabled),
            lanmanServerRunning: Boolean(parsed.lanmanServerRunning),
            lanmanWorkstationRunning: Boolean(parsed.lanmanWorkstationRunning),
            fdResPubRunning: Boolean(parsed.fdResPubRunning),
            rpcAuthnLevelPrivacyDisabled: Boolean(parsed.rpcAuthnLevelPrivacyDisabled),
            rpcUseNamedPipeProtocol: Boolean(parsed.rpcUseNamedPipeProtocol),
            rpcProtocols: parsed.rpcProtocols ?? null,
            pointAndPrintRelaxed: Boolean(parsed.pointAndPrintRelaxed),
            printSpoolerRunning: parsed.printSpoolerRunning ?? true,
            pendingRebootFlag: Boolean(parsed.pendingRebootFlag),
            checkedAt: formatSnapshotTimestamp(new Date().toISOString()),
          };
          const { compatibilityScore, detectedIssues } = computeCompatibilityScoreAndIssues(base);
          const fullStatus = { ...base, compatibilityScore, detectedIssues };
          if (netInfo?.hostname) {
            await this.persistHostPolicySnapshot(netInfo.hostname, fullStatus, netInfo.primaryIp);
          }
          return fullStatus;
        }
      }
    }

    await new Promise((r) => setTimeout(r, 240));
    const baseWithTime = {
      ...webSimPolicyBase,
      checkedAt: formatSnapshotTimestamp(new Date().toISOString()),
    };
    const { compatibilityScore, detectedIssues } = computeCompatibilityScoreAndIssues(baseWithTime);
    const fullStatus = { ...baseWithTime, compatibilityScore, detectedIssues };
    if (netInfo?.hostname) {
      await this.persistHostPolicySnapshot(netInfo.hostname, fullStatus, netInfo.primaryIp);
    }
    return fullStatus;
  },

  async applyOsCompatibilityPatch(mode: PolicyPatchMode, netInfo?: LocalNetworkInfo): Promise<PolicyApplyResult> {
    if (mode === 'legacy_bridge_compat' || mode === 'legacy_smb1_enable') {
      const current = await this.inspectOsNetworkPolicy(netInfo);
      if (!this.getLegacyRollbackSnapshot()) {
        this.saveLegacyRollbackSnapshot({
          capturedAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          hostName: netInfo?.hostname || 'LOCAL-PC',
          smbServerSigningRequired: current.smbServerSigningRequired,
          smbClientSigningRequired: current.smbClientSigningRequired,
          allowInsecureGuestAuth: current.allowInsecureGuestAuth,
          enableInsecureGuestLogons: current.enableInsecureGuestLogons,
          guestNetworkLogonDenied: Boolean(current.guestNetworkLogonDenied),
          localAccountTokenFilterEnabled: Boolean(current.localAccountTokenFilterEnabled),
          smbEncryptData: current.smbEncryptData,
          smbRejectUnencryptedAccess: Boolean(current.smbRejectUnencryptedAccess),
          smb1Enabled: Boolean(current.smb1Enabled || current.smb1ServerEnabled),
          lmCompatibilityLevel: current.lmCompatibilityLevel,
        });
      }
    }

    const rollbackSnapshot = mode === 'legacy_bridge_rollback' ? this.getLegacyRollbackSnapshot() : null;

    if (window.ahbiShareElectron?.runPowerShell) {
      const res = await window.ahbiShareElectron.runPowerShell(
        buildOsCompatibilityPatchScript(mode, rollbackSnapshot)
      );
      let appliedActions: string[] = [];
      let restartedServices: string[] = [];
      let netbiosStateChanged = false;
      let smb1Changed = false;
      let spoolerRestartFailed = false;
      let priorPendingReboot = false;

      if (res.output) {
        const parsed = parseLastJsonObject<{
          appliedActions?: string[] | string;
          restartedServices?: string[] | string;
          netbiosStateChanged?: boolean;
          smb1Changed?: boolean;
          spoolerRestartFailed?: boolean;
          priorPendingReboot?: boolean;
        }>(res.output);
        if (parsed) {
          appliedActions = Array.isArray(parsed.appliedActions)
            ? parsed.appliedActions
            : parsed.appliedActions
              ? [parsed.appliedActions]
              : [];
          restartedServices = Array.isArray(parsed.restartedServices)
            ? parsed.restartedServices
            : parsed.restartedServices
              ? [parsed.restartedServices]
              : [];
          netbiosStateChanged = Boolean(parsed.netbiosStateChanged);
          smb1Changed = Boolean(parsed.smb1Changed);
          spoolerRestartFailed = Boolean(parsed.spoolerRestartFailed);
          priorPendingReboot = Boolean(parsed.priorPendingReboot);
        }
      }

      if (mode === 'legacy_bridge_rollback' && res.success) {
        this.clearLegacyRollbackSnapshot();
      }

      const updatedPolicy = await this.inspectOsNetworkPolicy(netInfo);
      const rebootJudgment = evaluateRebootJudgment({
        mode,
        netbiosStateChanged,
        smb1Changed: smb1Changed || mode === 'enable_smbv1_client' || mode === 'legacy_smb1_enable',
        spoolerRestartFailed,
        priorPendingReboot: priorPendingReboot || updatedPolicy.pendingRebootFlag,
        restartedServices,
      });

      const summary =
        mode === 'deep_stack_reset'
          ? 'Winsock · TCP/IP 네트워크 스택 초기화를 실행했습니다.'
          : mode === 'strict_26h2_default'
            ? 'Windows 11 24H2~26H2 표준 보안 정책(서명 강제 · 게스트 차단)으로 복원했습니다.'
            : mode === 'legacy_bridge_compat'
              ? 'Win 7(SMB 2.1)·Win 8(SMB 3.0) 호환 브릿지(비암호화 허용·서명 완화·NTLMv2)를 적용했습니다.'
              : mode === 'legacy_smb1_enable'
                ? '구형 Win 7·XP 호환용 SMB 1.0/CIFS 프로토콜 기능을 활성화했습니다.'
                : mode === 'legacy_bridge_rollback'
                  ? '구형 OS 공유 호환 설정을 표준 보안 상태로 원복했습니다.'
                  : mode === 'rpc_printer_compat'
                    ? 'Win 11 24H2~26H2 프린터 RPC · Named Pipe · PointAndPrint 호환 패치를 적용했습니다.'
                    : mode === 'rpc_printer_default'
                      ? '프린터 RPC 개인정보 인증 강제 및 PointAndPrint 기본 보안 정책으로 복원했습니다.'
                      : mode === 'enable_uac_token_filter'
                        ? 'UAC 원격 토큰 필터(LocalAccountTokenFilterPolicy=1)를 활성화했습니다.'
                        : mode === 'disable_uac_token_filter'
                          ? 'UAC 원격 토큰 필터를 기본 보안 상태로 복원했습니다.'
                          : mode === 'enable_smbv1_client'
                            ? '구형 NAS · 복합기용 SMB 1.0/CIFS 클라이언트 기능을 활성화했습니다.'
                            : 'OS 빌드 맞춤 안전 호환 패치 및 SMB 서비스 새로고침을 완료했습니다.';

      return {
        success: res.success,
        mode,
        summary: res.success ? summary : res.error || '정책 적용 중 오류가 발생했습니다.',
        appliedActions,
        rebootJudgment,
        updatedPolicy,
      };
    }

    await new Promise((r) => setTimeout(r, 320));
    let appliedActions: string[] = [];
    let restartedServices: string[] = [];
    let smb1Changed = false;

    if (mode === 'safe_compat') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        networkProfile: 'Private',
        smbServerSigningRequired: false,
        smbClientSigningRequired: false,
        allowInsecureGuestAuth: true,
        enableInsecureGuestLogons: true,
        guestNetworkLogonDenied: false,
        limitBlankPasswordUse: false,
        restrictNullSessAccess: false,
        restrictAnonymous: false,
        firewall445Allowed: true,
        lmCompatibilityLevel: 3,
        netbiosEnabled: true,
        lanmanServerRunning: true,
        lanmanWorkstationRunning: true,
        fdResPubRunning: true,
      };
      appliedActions = [
        'TCP 445 인바운드 및 파일 공유 방화벽 규칙 정렬',
        'Win 11 24H2~26H2 SMB 서명 강제 완화 및 게스트 로그온 호환 허용',
        'NTLMv2 인증 협상 수준(LmCompatibilityLevel=3) 정렬',
        'LanmanWorkstation · LanmanServer 즉시 재시작 및 DNS 캐시 플러시',
      ];
      restartedServices = ['LanmanWorkstation', 'LanmanServer'];
    } else if (mode === 'rpc_printer_compat') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        rpcAuthnLevelPrivacyDisabled: true,
        rpcUseNamedPipeProtocol: true,
        rpcProtocols: 7,
        pointAndPrintRelaxed: true,
        printSpoolerRunning: true,
      };
      appliedActions = [
        '프린터 RPC 개인정보 인증 완화 (RpcAuthnLevelPrivacyEnabled=0 · 0x0000011b 해결)',
        'RPC over Named Pipes 활성화 (RpcUseNamedPipeProtocol=1, RpcProtocols=7 · 0x00000709 해결)',
        'Point and Print LAN 공유 프린터 드라이버 자동 설치 허용 정렬',
        'Print Spooler(Spooler) 서비스 즉시 재시작 및 RPC 정책 반영 완료',
      ];
      restartedServices = ['Spooler'];
    } else if (mode === 'rpc_printer_default') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        rpcAuthnLevelPrivacyDisabled: false,
        rpcUseNamedPipeProtocol: false,
        rpcProtocols: null,
        pointAndPrintRelaxed: false,
        printSpoolerRunning: true,
      };
      appliedActions = [
        '프린터 RPC 개인정보 인증 강제(RpcAuthnLevelPrivacyEnabled=1) 복원',
        'RPC over TCP 기본 보안 전송 정책으로 복원',
        'Point and Print 관리자 드라이버 설치 제한 복원',
      ];
      restartedServices = ['Spooler'];
    } else if (mode === 'enable_uac_token_filter') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        localAccountTokenFilterEnabled: true,
      };
      appliedActions = [
        'UAC 원격 토큰 필터 완화 활성화 (LocalAccountTokenFilterPolicy=1 · 오류 5 방지)',
        '관리자/일반 토큰 간 네트워크 드라이브 공유(EnableLinkedConnections=1) 확인 완료',
      ];
    } else if (mode === 'disable_uac_token_filter') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        localAccountTokenFilterEnabled: false,
      };
      appliedActions = ['UAC 원격 토큰 필터 기본 보안 복원 (LocalAccountTokenFilterPolicy=0)'];
    } else if (mode === 'enable_smbv1_client') {
      smb1Changed = webSimPolicyBase.smb1ClientFeatureState !== 'Enabled';
      webSimPolicyBase = {
        ...webSimPolicyBase,
        smb1ClientFeatureState: 'Enabled',
        pendingRebootFlag: true,
      };
      appliedActions = [
        '구형 NAS·복합기용 SMB 1.0/CIFS 클라이언트 선택적 기능(SMB1Protocol-Client) 설치 완료',
      ];
    } else if (mode === 'legacy_bridge_compat') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        networkProfile: 'Private',
        smb2Enabled: true,
        smbEncryptData: false,
        smbRejectUnencryptedAccess: false,
        smbServerSigningRequired: false,
        smbClientSigningRequired: false,
        allowInsecureGuestAuth: true,
        enableInsecureGuestLogons: true,
        guestNetworkLogonDenied: false,
        limitBlankPasswordUse: false,
        restrictNullSessAccess: false,
        restrictAnonymous: false,
        guestAccountEnabled: true,
        firewall445Allowed: true,
        lmCompatibilityLevel: 3,
        netbiosEnabled: true,
        lanmanServerRunning: true,
        lanmanWorkstationRunning: true,
        fdResPubRunning: true,
      };
      appliedActions = [
        'TCP 445 및 파일·프린터 공유 방화벽 규칙 개방 정렬',
        'Win 7(SMB 2.1)·Win 8(SMB 3.0) 호환을 위해 SMB 암호화·서명 강제 해제 및 비암호화 접근 허용',
        'NTLM 인증 협상 수준 NTLMv2 고정(LmCompatibilityLevel=3) 정렬',
        'WS-Discovery 탐색 · LanmanServer · LanmanWorkstation 즉시 재시작 완료',
      ];
      restartedServices = ['LanmanWorkstation', 'LanmanServer'];
    } else if (mode === 'legacy_smb1_enable') {
      smb1Changed = !webSimPolicyBase.smb1Enabled || !webSimPolicyBase.smb1ServerEnabled;
      webSimPolicyBase = {
        ...webSimPolicyBase,
        smb1Enabled: true,
        smb1ServerEnabled: true,
        smb1ClientFeatureState: 'Enabled',
        smbEncryptData: false,
        smbRejectUnencryptedAccess: false,
        pendingRebootFlag: true,
      };
      appliedActions = [
        '구형 Win 7·XP 호환용 SMB 1.0/CIFS 서버·클라이언트 기능(SMB1Protocol) 활성화 완료',
        'SMB 1.0 레지스트리 활성화 및 서비스 갱신 (커널 적재를 위해 재부팅 필수)',
      ];
      restartedServices = ['LanmanWorkstation', 'LanmanServer'];
    } else if (mode === 'legacy_bridge_rollback') {
      const currentlyHasSmb1 = Boolean(webSimPolicyBase.smb1Enabled || webSimPolicyBase.smb1ServerEnabled);
      const restoreSmb1 = rollbackSnapshot ? Boolean(rollbackSnapshot.smb1Enabled) : false;
      smb1Changed = currentlyHasSmb1 && !restoreSmb1;
      webSimPolicyBase = {
        ...webSimPolicyBase,
        smbServerSigningRequired: rollbackSnapshot ? rollbackSnapshot.smbServerSigningRequired : true,
        smbClientSigningRequired: rollbackSnapshot ? rollbackSnapshot.smbClientSigningRequired : true,
        allowInsecureGuestAuth: rollbackSnapshot ? rollbackSnapshot.allowInsecureGuestAuth : false,
        enableInsecureGuestLogons: rollbackSnapshot
          ? Boolean(rollbackSnapshot.enableInsecureGuestLogons ?? rollbackSnapshot.allowInsecureGuestAuth)
          : false,
        guestNetworkLogonDenied: rollbackSnapshot
          ? Boolean(rollbackSnapshot.guestNetworkLogonDenied ?? !rollbackSnapshot.allowInsecureGuestAuth)
          : true,
        localAccountTokenFilterEnabled: rollbackSnapshot
          ? Boolean(rollbackSnapshot.localAccountTokenFilterEnabled)
          : false,
        smbEncryptData: rollbackSnapshot ? rollbackSnapshot.smbEncryptData : false,
        smbRejectUnencryptedAccess: rollbackSnapshot ? rollbackSnapshot.smbRejectUnencryptedAccess : false,
        lmCompatibilityLevel: rollbackSnapshot ? rollbackSnapshot.lmCompatibilityLevel : 3,
        smb1Enabled: restoreSmb1,
        smb1ServerEnabled: restoreSmb1,
        smb1ClientFeatureState: restoreSmb1 ? 'Enabled' : 'Disabled',
        pendingRebootFlag: smb1Changed,
      };
      this.clearLegacyRollbackSnapshot();
      appliedActions = [
        rollbackSnapshot
          ? `사전 캡처 스냅샷(${rollbackSnapshot.capturedAt}) 기준 SMB 서명·암호화·게스트·UAC 상태 복원 완료`
          : 'SMB 서명 강제 · 비인증 게스트 차단 · UAC 원격 토큰 보호 원복 완료',
        ...(smb1Changed ? ['레거시 SMB 1.0 프로토콜 비활성화(Disable-WindowsOptionalFeature SMB1Protocol) 완료'] : []),
      ];
      restartedServices = ['LanmanWorkstation', 'LanmanServer'];
    } else if (mode === 'strict_26h2_default') {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        smbServerSigningRequired: true,
        smbClientSigningRequired: true,
        allowInsecureGuestAuth: false,
        enableInsecureGuestLogons: false,
        guestNetworkLogonDenied: true,
        limitBlankPasswordUse: true,
        restrictNullSessAccess: true,
        restrictAnonymous: true,
        localAccountTokenFilterEnabled: false,
      };
      appliedActions = [
        'Server/Client SMB 보안 서명 강제(RequireSecuritySignature=$true) 복원',
        '비인증 게스트 로그온·UAC 원격 토큰 필터 차단 복원',
        'LSA 익명 접근 차단 및 빈 암호 제한 복원',
      ];
      restartedServices = ['LanmanWorkstation', 'LanmanServer'];
    } else {
      webSimPolicyBase = {
        ...webSimPolicyBase,
        pendingRebootFlag: true,
      };
      appliedActions = [
        'Winsock 카탈로그 초기화 (netsh winsock reset)',
        'TCP/IP 프로토콜 스택 초기화 (netsh int ip reset)',
        'DNS & ARP 테이블 캐시 플러시 완료',
      ];
      restartedServices = ['LanmanWorkstation', 'LanmanServer', 'FDResPub'];
    }

    const updatedPolicy = await this.inspectOsNetworkPolicy(netInfo);
    const rebootJudgment = evaluateRebootJudgment({
      mode,
      netbiosStateChanged: false,
      smb1Changed,
      spoolerRestartFailed: false,
      priorPendingReboot: updatedPolicy.pendingRebootFlag,
      restartedServices,
    });

    return {
      success: true,
      mode,
      summary:
        mode === 'deep_stack_reset'
          ? '[시뮬레이션] Winsock · TCP/IP 네트워크 스택 초기화 완료'
          : mode === 'strict_26h2_default'
            ? '[시뮬레이션] Win 11 26H2 표준 보안 정책 복원 완료'
            : mode === 'legacy_bridge_compat'
              ? '[시뮬레이션] Win 7·8.1 호환 SMB 2.1/3.0 브릿지 적용 완료 (원복 스냅샷 저장됨)'
              : mode === 'legacy_smb1_enable'
                ? '[시뮬레이션] 레거시 SMB 1.0 프로토콜 활성화 완료 (재부팅 필수)'
                : mode === 'legacy_bridge_rollback'
                  ? '[시뮬레이션] 구형 OS 호환 설정 표준 보안 원복 완료'
                  : mode === 'rpc_printer_compat'
                    ? '[시뮬레이션] Win 11 26H2 프린터 RPC·스풀러 호환 패치 완료'
                    : mode === 'rpc_printer_default'
                      ? '[시뮬레이션] 프린터 RPC 기본 보안 정책 복원 완료'
                      : mode === 'enable_uac_token_filter'
                        ? '[시뮬레이션] UAC 원격 토큰 필터(LocalAccountTokenFilterPolicy=1) 활성화 완료'
                        : mode === 'disable_uac_token_filter'
                          ? '[시뮬레이션] UAC 원격 토큰 필터 기본 보안 복원 완료'
                          : mode === 'enable_smbv1_client'
                            ? '[시뮬레이션] 구형 NAS·복합기용 SMBv1 클라이언트 선택적 기능 설치 완료'
                            : '[시뮬레이션] OS 빌드 맞춤 안전 호환 패치 및 SMB 서비스 새로고침 완료',
      appliedActions,
      rebootJudgment,
      updatedPolicy,
    };
  },

  async autoAlignHostClientPolicies(
    modes: PolicyPatchMode[],
    netInfo?: LocalNetworkInfo,
    onProgress?: (steps: PipelineStep[]) => void
  ): Promise<AutoAlignBatchResult> {
    const uniqueModes: PolicyPatchMode[] = [];
    for (const m of modes) {
      if (!uniqueModes.includes(m)) {
        uniqueModes.push(m);
      }
    }

    if (uniqueModes.length === 0) {
      const latestPolicy = await this.inspectOsNetworkPolicy(netInfo);
      return {
        success: true,
        appliedModes: [],
        failedModes: [],
        summary: '로컬 PC에서 추가로 적용할 불일치 정책이 없습니다.',
        appliedActions: [],
        rebootJudgment: combineRebootJudgments([]),
        updatedPolicy: latestPolicy,
      };
    }

    const alignSteps: PipelineStep[] = uniqueModes.map((m, idx) => ({
      id: `align-${idx}-${m}`,
      title: `${getPolicyPatchLabel(m)} 적용`,
      detail: '호스트·클라이언트 정책 정렬 및 SMB 서비스 새로고침',
      status: 'idle',
    }));
    onProgress?.([...alignSteps]);

    const appliedModes: PolicyPatchMode[] = [];
    const failedModes: PolicyPatchMode[] = [];
    const actionSet = new Set<string>();
    const judgments: RebootJudgment[] = [];
    let latestPolicy: OsNetworkPolicyStatus | null = null;

    for (let i = 0; i < uniqueModes.length; i++) {
      const mode = uniqueModes[i];
      alignSteps[i].status = 'running';
      onProgress?.([...alignSteps]);
      const t0 = performance.now();
      try {
        const res = await this.applyOsCompatibilityPatch(mode, netInfo);
        alignSteps[i].durationMs = Math.round(performance.now() - t0);
        latestPolicy = res.updatedPolicy;
        judgments.push(res.rebootJudgment);
        for (const act of res.appliedActions) {
          actionSet.add(act);
        }
        if (res.success) {
          appliedModes.push(mode);
          alignSteps[i].status = 'success';
          alignSteps[i].detail = res.rebootJudgment.title;
        } else {
          failedModes.push(mode);
          alignSteps[i].status = 'error';
          alignSteps[i].error = res.summary || `${getPolicyPatchLabel(mode)} 적용 실패`;
        }
      } catch (err) {
        alignSteps[i].durationMs = Math.round(performance.now() - t0);
        failedModes.push(mode);
        const reason = err instanceof Error ? err.message : '알 수 없는 오류';
        alignSteps[i].status = 'error';
        alignSteps[i].error = reason;
        actionSet.add(`${getPolicyPatchLabel(mode)} 적용 오류: ${reason}`);
      }
      onProgress?.([...alignSteps]);
    }

    if (!latestPolicy) {
      latestPolicy = await this.inspectOsNetworkPolicy(netInfo);
    }

    const rebootJudgment = combineRebootJudgments(judgments);
    const appliedLabels = appliedModes.map((m) => getPolicyPatchLabel(m)).join(' · ');
    const failedLabels = failedModes.map((m) => getPolicyPatchLabel(m)).join(' · ');

    const summary =
      failedModes.length === 0
        ? `호스트·클라이언트 불일치 정책 ${appliedModes.length}종(${appliedLabels}) 원클릭 자동 정렬 완료`
        : appliedModes.length > 0
          ? `일괄 자동 정렬 부분 완료 (적용: ${appliedLabels} / 실패: ${failedLabels})`
          : `호환성 정책 자동 정렬 실패 (${failedLabels})`;

    return {
      success: failedModes.length === 0 && appliedModes.length > 0,
      appliedModes,
      failedModes,
      summary,
      appliedActions: Array.from(actionSet),
      rebootJudgment,
      updatedPolicy: latestPolicy,
    };
  },

  async applyPendingHostPolicyTask(
    task: PendingHostPolicyTask,
    netInfo?: LocalNetworkInfo,
    onProgress?: (steps: PipelineStep[]) => void
  ): Promise<AutoAlignBatchResult> {
    const modeSteps: PipelineStep[] = task.modes.map((m, idx) => ({
      id: `pending-mode-${idx}-${m}`,
      title: `[호스트 예약] ${getPolicyPatchLabel(m)} 적용`,
      detail: '요청된 정책 패치 반영 및 SMB 서비스 갱신',
      status: 'idle',
    }));
    const steps: PipelineStep[] = [
      ...modeSteps,
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
        status: 'idle',
      },
    ];
    onProgress?.([...steps]);

    const appliedModes: PolicyPatchMode[] = [];
    const failedModes: PolicyPatchMode[] = [];
    const actionSet = new Set<string>();
    const judgments: RebootJudgment[] = [];
    let latestPolicy: OsNetworkPolicyStatus | null = null;
    let guestUnlockFailed = false;

    for (let i = 0; i < task.modes.length; i++) {
      const mode = task.modes[i];
      steps[i].status = 'running';
      onProgress?.([...steps]);
      const t0 = performance.now();
      try {
        const res = await this.applyOsCompatibilityPatch(mode, netInfo);
        steps[i].durationMs = Math.round(performance.now() - t0);
        latestPolicy = res.updatedPolicy;
        judgments.push(res.rebootJudgment);
        for (const a of res.appliedActions) actionSet.add(a);
        if (res.success) {
          appliedModes.push(mode);
          steps[i].status = 'success';
          steps[i].detail = res.rebootJudgment.title;
        } else {
          failedModes.push(mode);
          steps[i].status = 'error';
          steps[i].error = res.summary;
        }
      } catch (err) {
        steps[i].durationMs = Math.round(performance.now() - t0);
        failedModes.push(mode);
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        steps[i].status = 'error';
        steps[i].error = msg;
      }
      onProgress?.([...steps]);
    }

    if (task.includeGuestUnlock) {
      const gIdx = task.modes.length;
      steps[gIdx].status = 'running';
      onProgress?.([...steps]);
      const t0 = performance.now();
      const hostLower = (netInfo?.hostname || task.targetHostName || '').trim().toLowerCase();
      const localShareNames = Array.from(
        new Set([
          ...this.getSavedShares().map((s) => s.shareName),
          ...(latestPortableDoc.shares || [])
            .filter((s) => !hostLower || (s.sourceHostName || '').trim().toLowerCase() === hostLower)
            .map((s) => s.shareName),
          'AhBiShared',
        ].filter(Boolean))
      );
      if (window.ahbiShareElectron?.runPowerShell) {
        const res = await window.ahbiShareElectron.runPowerShell(
          buildHostGuestUnlockPsScript(localShareNames[0] || 'AhBiShared', localShareNames)
        );
        steps[gIdx].durationMs = Math.round(performance.now() - t0);
        if (res.success) {
          steps[gIdx].status = 'success';
          judgments.push(evaluateRebootJudgment({ mode: 'safe_compat', restartedServices: ['LanmanServer'] }));
          actionSet.add('호스트 Guest 계정(SID *-501) 무비밀번호 개방·LSA 빈 암호 해제·TCP 445 방화벽 정렬');
        } else {
          guestUnlockFailed = true;
          steps[gIdx].status = 'error';
          steps[gIdx].error = res.error || 'Guest 무비밀번호 정책 개방 실패 (관리자 권한 확인 필요)';
        }
      } else {
        await new Promise((r) => setTimeout(r, 220));
        steps[gIdx].durationMs = Math.round(performance.now() - t0);
        webSimPolicyBase = {
          ...webSimPolicyBase,
          networkProfile: 'Private',
          allowInsecureGuestAuth: true,
          enableInsecureGuestLogons: true,
          guestNetworkLogonDenied: false,
          limitBlankPasswordUse: false,
          restrictNullSessAccess: false,
          restrictAnonymous: false,
          guestAccountEnabled: true,
          firewall445Allowed: true,
        };
        steps[gIdx].status = 'success';
        judgments.push(evaluateRebootJudgment({ mode: 'safe_compat', restartedServices: ['LanmanServer'] }));
        actionSet.add('[시뮬레이션] 호스트 Guest 무비밀번호 정책·빈 암호 제한·445 방화벽 완전 개방 완료');
      }
      onProgress?.([...steps]);
    }

    const cleanIdx = steps.length - 1;
    steps[cleanIdx].status = 'running';
    onProgress?.([...steps]);
    const tClean = performance.now();
    latestPolicy = await this.inspectOsNetworkPolicy(netInfo);
    const allSucceeded = failedModes.length === 0 && !guestUnlockFailed;
    if (allSucceeded) {
      await this.deletePendingHostPolicyTask(task.targetHostName);
      steps[cleanIdx].status = 'success';
      steps[cleanIdx].detail = '호스트 스냅샷 갱신 및 USB 대기 작업 완료 제거';
    } else {
      steps[cleanIdx].status = 'error';
      steps[cleanIdx].error = '일부 단계 실패로 USB 대기 작업을 유지했습니다.';
    }
    steps[cleanIdx].durationMs = Math.round(performance.now() - tClean);
    onProgress?.([...steps]);

    const rebootJudgment = combineRebootJudgments(judgments);
    const summary = allSucceeded
      ? `${task.requestedByHostName}에서 예약한 호스트 호환 정책 자동 적용 완료`
      : '예약된 호스트 정책 적용 중 일부 오류가 발생했습니다.';

    return {
      success: allSucceeded,
      appliedModes,
      failedModes,
      summary,
      appliedActions: Array.from(actionSet),
      rebootJudgment,
      updatedPolicy: latestPolicy,
    };
  },

  async openWindowsUpdateSettings(): Promise<{ success: boolean; message: string }> {
    if (window.ahbiShareElectron?.openPath) {
      const res = await window.ahbiShareElectron.openPath('ms-settings:windowsupdate');
      return {
        success: res.success,
        message: res.success
          ? 'Windows Update 설정 창을 열었습니다.'
          : res.error || 'Windows Update 설정 창을 열지 못했습니다.',
      };
    }
    return {
      success: true,
      message: '웹 미리보기 모드: Windows 실행 환경에서는 Windows Update 설정(ms-settings:windowsupdate)이 열립니다.',
    };
  },

  getLegacyRollbackSnapshot(): LegacyRollbackSnapshot | null {
    return readStore<LegacyRollbackSnapshot | null>(STORAGE_LEGACY_ROLLBACK_KEY, null);
  },

  saveLegacyRollbackSnapshot(snap: LegacyRollbackSnapshot): void {
    writeStore(STORAGE_LEGACY_ROLLBACK_KEY, snap);
  },

  clearLegacyRollbackSnapshot(): void {
    try {
      window.localStorage.removeItem(STORAGE_LEGACY_ROLLBACK_KEY);
    } catch {}
  },

  async exportLegacyScriptBundle(
    bundle: LegacyScriptBundle
  ): Promise<{ success: boolean; mode: 'usb-folder' | 'web-download'; directory?: string; message: string }> {
    if (window.ahbiShareElectron?.saveLegacyScripts) {
      const res = await window.ahbiShareElectron.saveLegacyScripts({
        folderName: bundle.folderName,
        files: bundle.files.map((f) => ({ name: f.name, content: f.content })),
      });
      return {
        success: res.success,
        mode: 'usb-folder',
        directory: res.directory,
        message: res.message,
      };
    }

    // Web preview fallback: trigger browser downloads cleanly for the bundle files
    return {
      success: true,
      mode: 'web-download',
      message: `웹 미리보기 모드: 적용(.bat/.reg)과 원복(.bat/.reg) ${bundle.files.length}개 파일 다운로드를 준비했습니다.`,
    };
  },

  async requestSystemReboot(): Promise<{ success: boolean; message: string }> {
    if (window.ahbiShareElectron?.triggerSystemReboot) {
      return await window.ahbiShareElectron.triggerSystemReboot();
    }
    return {
      success: true,
      message: '웹 프리뷰 시뮬레이션: Windows 런타임에서는 5초 후 컴퓨터를 안전하게 재부팅(shutdown /r /t 5)합니다.',
    };
  },

  exportCrossOsBridgeBundle(): { success: boolean; jsonContent: string; fileName: string; message: string } {
    const shares = this.getSavedShares();
    const mounts = this.getSavedMounts();
    const snapshot = this.getPortableSnapshot();
    const bridgePayload = {
      app: 'AhBiShare OneClick',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      shares,
      mounts,
      portableSnapshot: snapshot,
    };
    const jsonContent = JSON.stringify(bridgePayload, null, 2);
    const fileName = 'AhBiShare_CrossOS_Sync_Bridge.json';
    return {
      success: true,
      jsonContent,
      fileName,
      message: 'Win 10/11과 Win 7/8 레거시 앱 간 양방향 데이터 공유 브릿지 파일이 생성되었습니다.',
    };
  },

  async importCrossOsBridgeData(
    jsonString: string,
    netInfo?: LocalNetworkInfo
  ): Promise<{ success: boolean; countShares: number; countMounts: number; countPolicies: number; message: string }> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return {
          success: false,
          countShares: 0,
          countMounts: 0,
          countPolicies: 0,
          message: '올바르지 않은 브릿지 JSON 형식입니다.',
        };
      }

      const hasShares = Array.isArray(parsed.shares);
      const hasMounts = Array.isArray(parsed.mounts);
      const snapDoc = parsed.portableSnapshot?.document;
      const hasSnapshot = Boolean(snapDoc && typeof snapDoc === 'object');

      if (!hasShares && !hasMounts && !hasSnapshot) {
        return {
          success: false,
          countShares: 0,
          countMounts: 0,
          countPolicies: 0,
          message: '가져올 공유/마운트/포터블 정책 데이터가 포함되어 있지 않습니다.',
        };
      }

      const resolvedNet = netInfo || (await this.getLocalNetworkInfo());
      const localHostLower = (resolvedNet.hostname || '').trim().toLowerCase();

      let countShares = 0;
      let countMounts = 0;
      let countPolicies = 0;

      const promotedPortableEntries: PortableHostShareEntry[] = [];

      if (hasShares) {
        const validShares = parsed.shares.filter(
          (item: unknown): item is ActiveShare =>
            Boolean(item && typeof item === 'object' && 'shareName' in item && 'uncPath' in item)
        );
        const existingShares = readStore<ActiveShare[]>(STORAGE_SHARES_KEY, []);
        const shareMap = new Map<string, ActiveShare>(
          existingShares.map((s) => [s.shareName.trim().toLowerCase(), sanitizeLocalShareForStorage(s, resolvedNet)])
        );

        for (const sh of validShares) {
          const decodedToken = sh.connectionCode ? decodeConnectionCode(sh.connectionCode) : null;
          const resolvedPassword = sh.restoredPassword || decodedToken?.password || '';
          const entryHost = (sh.sourceHostName || resolvedNet.hostname || 'REMOTE').trim();
          const entryHostLower = entryHost.toLowerCase();
          const isLocalShare = !sh.sourceHostName || entryHostLower === localHostLower;

          if (resolvedPassword) {
            setCachedPassword(entryHost, sh.shareName, resolvedPassword);
          }

          if (isLocalShare) {
            const sanitizedLocal = sanitizeLocalShareForStorage(
              {
                ...sh,
                sourceHostName: entryHost,
                sourceIp: sh.sourceIp || resolvedNet.primaryIp,
              },
              resolvedNet
            );
            shareMap.set(sanitizedLocal.shareName.trim().toLowerCase(), sanitizedLocal);
          }

          const fullCode = rehydrateCodeWithPassword(
            {
              sourceHostName: entryHost,
              sourceIp: sh.sourceIp || resolvedNet.primaryIp,
              shareName: sh.shareName,
              authMode: sh.authMode,
              username: sh.username,
              createdAt: sh.createdAt,
              connectionCode: sh.connectionCode || '',
            },
            resolvedPassword || undefined
          );

          promotedPortableEntries.push({
            sourceHostName: entryHost,
            sourceIp: sh.sourceIp || decodedToken?.ip || resolvedNet.primaryIp,
            shareName: sh.shareName,
            folderPath: sh.folderPath || '',
            uncPath: sh.uncPath,
            authMode: sh.authMode || 'guest',
            permission: sh.permission || 'read',
            username: sh.authMode === 'account' ? sh.username || decodedToken?.username : undefined,
            password: sh.authMode === 'account' ? resolvedPassword || undefined : undefined,
            createdAt: sh.createdAt || new Date().toLocaleTimeString('ko-KR', { hour12: false }),
            updatedAt: sh.updatedAt || new Date().toISOString(),
            ...(typeof sh.ttlMinutes === 'number' && sh.ttlMinutes > 0 ? { ttlMinutes: sh.ttlMinutes } : {}),
            ...(sh.expiresAt ? { expiresAt: sh.expiresAt } : {}),
            ...(typeof sh.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: sh.autoRevokeOnExpiry } : {}),
            connectionCode: fullCode,
          });
        }

        writeStore(STORAGE_SHARES_KEY, Array.from(shareMap.values()));
        countShares = validShares.length;
      }

      if (hasMounts) {
        const validMounts = parsed.mounts.filter(
          (item: unknown): item is MountedDrive =>
            Boolean(item && typeof item === 'object' && 'driveLetter' in item && 'uncPath' in item)
        );
        const existingMounts = readStore<MountedDrive[]>(STORAGE_MOUNTS_KEY, []);
        const mountMap = new Map<string, MountedDrive>(
          existingMounts.map((m) => [m.driveLetter.trim().toUpperCase(), m])
        );
        for (const m of validMounts) {
          mountMap.set(m.driveLetter.trim().toUpperCase(), m);
        }
        writeStore(STORAGE_MOUNTS_KEY, Array.from(mountMap.values()));
        countMounts = validMounts.length;
      }

      if (hasSnapshot || promotedPortableEntries.length > 0) {
        const existingPortable = latestPortableDoc.shares || [];
        const portableMap = new Map<string, PortableHostShareEntry>(
          existingPortable.map((e) => [
            `${(e.sourceHostName || '').trim().toLowerCase()}::${e.shareName.trim().toLowerCase()}`,
            e,
          ])
        );

        for (const entry of promotedPortableEntries) {
          const key = `${(entry.sourceHostName || '').trim().toLowerCase()}::${entry.shareName.trim().toLowerCase()}`;
          portableMap.set(key, entry);
        }

        const importedPortableShares: PortableHostShareEntry[] =
          hasSnapshot && Array.isArray(snapDoc.shares)
            ? snapDoc.shares.filter(
                (item: unknown): item is PortableHostShareEntry =>
                  Boolean(item && typeof item === 'object' && 'shareName' in item && 'sourceHostName' in item)
              )
            : [];
        for (const entry of importedPortableShares) {
          if (entry.password) {
            setCachedPassword(entry.sourceHostName, entry.shareName, entry.password);
          }
          const key = `${(entry.sourceHostName || '').trim().toLowerCase()}::${entry.shareName.trim().toLowerCase()}`;
          portableMap.set(key, entry);
        }

        const importedPolicies: Record<string, HostPolicySnapshot> =
          hasSnapshot && snapDoc.hostPolicies && typeof snapDoc.hostPolicies === 'object'
            ? (snapDoc.hostPolicies as Record<string, HostPolicySnapshot>)
            : {};
        countPolicies = Object.keys(importedPolicies).length;

        const mergedPolicies: Record<string, HostPolicySnapshot> = {
          ...(latestPortableDoc.hostPolicies || {}),
          ...importedPolicies,
        };

        const importedPendingActions: Record<string, PendingHostPolicyTask> =
          hasSnapshot && snapDoc.pendingHostActions && typeof snapDoc.pendingHostActions === 'object'
            ? (snapDoc.pendingHostActions as Record<string, PendingHostPolicyTask>)
            : {};
        const mergedPendingActions: Record<string, PendingHostPolicyTask> = {
          ...(latestPortableDoc.pendingHostActions || {}),
          ...importedPendingActions,
        };

        const nextDoc: PortableShareDocument = {
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          shares: Array.from(portableMap.values()),
          ...(Object.keys(mergedPolicies).length > 0 ? { hostPolicies: mergedPolicies } : {}),
          ...(Object.keys(mergedPendingActions).length > 0
            ? { pendingHostActions: mergedPendingActions }
            : {}),
          ...(snapDoc?.lastClientTarget
            ? { lastClientTarget: snapDoc.lastClientTarget }
            : latestPortableDoc.lastClientTarget
              ? { lastClientTarget: latestPortableDoc.lastClientTarget }
              : {}),
        };

        const saveRes = window.ahbiShareElectron?.savePortableData
          ? await window.ahbiShareElectron.savePortableData(nextDoc)
          : await saveWebPreviewPortable(nextDoc);
        latestPortableDoc = saveRes.document;
        latestPortableStatus = saveRes.status;
        if (countShares === 0 && importedPortableShares.length > 0) {
          countShares = importedPortableShares.length;
        }
      }

      return {
        success: true,
        countShares,
        countMounts,
        countPolicies,
        message: `브릿지 데이터 가져오기 성공 (공유 ${countShares}건, 마운트 ${countMounts}건, 호스트 정책 ${countPolicies}건 동기화됨)`,
      };
    } catch (err) {
      return {
        success: false,
        countShares: 0,
        countMounts: 0,
        countPolicies: 0,
        message: `브릿지 데이터 파싱 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      };
    }
  },

  buildLocationProfileSnapshot(params: {
    profileId?: string;
    locationName: string;
    description?: string;
    netInfo: LocalNetworkInfo;
    includeHost?: boolean;
    includeClient?: boolean;
    includeNetworkHint?: boolean;
    hostConfig?: HostConfig;
    activeShares?: ActiveShare[];
    clientConfig?: ClientTargetConfig;
    mountedDrives?: MountedDrive[];
    preferredPatchMode?: PolicyPatchMode;
    existingCreatedAt?: string;
  }): LocationProfileFile {
    const cleanName = params.locationName.trim() || '새 사용장소';
    const profileId = normalizeLocationProfileId(params.profileId, cleanName);
    const nowIso = new Date().toISOString();

    const includeHost = params.includeHost !== false;
    const includeClient = params.includeClient !== false;
    const includeNetworkHint = params.includeNetworkHint !== false;

    const hostPreset: LocationHostPreset | undefined =
      includeHost && params.hostConfig
        ? {
            folderPath: params.hostConfig.folderPath,
            shareName: params.hostConfig.shareName,
            authMode: params.hostConfig.authMode,
            permission: params.hostConfig.permission,
            username: params.hostConfig.username,
            password: params.hostConfig.authMode === 'account' ? params.hostConfig.password : '',
            ttlMinutes: params.hostConfig.ttlMinutes,
            autoRevokeOnExpiry: params.hostConfig.autoRevokeOnExpiry,
          }
        : undefined;

    const savedShares: PortableHostShareEntry[] = includeHost
      ? (params.activeShares || []).map((sh) => {
          const decoded = decodeConnectionCode(sh.connectionCode);
          const pwd =
            sh.restoredPassword ||
            decoded?.password ||
            getCachedPassword(sh.sourceHostName || params.netInfo.hostname, sh.shareName) ||
            '';
          return {
            sourceHostName: sh.sourceHostName || params.netInfo.hostname,
            sourceIp: sh.sourceIp || params.netInfo.primaryIp,
            shareName: sh.shareName,
            folderPath: sh.folderPath,
            uncPath: sh.uncPath,
            authMode: sh.authMode,
            permission: sh.permission,
            username: sh.username,
            ...(pwd ? { password: pwd } : {}),
            createdAt: sh.createdAt,
            updatedAt: sh.updatedAt || nowIso,
            ...(typeof sh.ttlMinutes === 'number' && sh.ttlMinutes > 0 ? { ttlMinutes: sh.ttlMinutes } : {}),
            ...(sh.expiresAt ? { expiresAt: sh.expiresAt } : {}),
            ...(typeof sh.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: sh.autoRevokeOnExpiry } : {}),
            connectionCode: rehydrateCodeWithPassword(
              {
                sourceHostName: sh.sourceHostName || params.netInfo.hostname,
                sourceIp: sh.sourceIp || params.netInfo.primaryIp,
                shareName: sh.shareName,
                authMode: sh.authMode,
                username: sh.username,
                createdAt: sh.createdAt,
                connectionCode: sh.connectionCode,
              },
              pwd || undefined
            ),
          };
        })
      : [];

    const clientMap = new Map<string, LocationClientTargetEntry>();
    if (includeClient) {
      for (const m of params.mountedDrives || []) {
        const dl = m.driveLetter.replace(/:?$/, ':').toUpperCase();
        const formMatch =
          params.clientConfig &&
          params.clientConfig.targetHost.trim().toLowerCase() === m.targetHost.trim().toLowerCase() &&
          params.clientConfig.shareName.trim().toLowerCase() === m.shareName.trim().toLowerCase();
        const resolvedClientUsername =
          formMatch && params.clientConfig?.username?.trim()
            ? params.clientConfig.username.trim()
            : m.username || '';
        const cachedClientPwd =
          m.authMode === 'account'
            ? (formMatch && params.clientConfig?.authMode === 'account' && params.clientConfig.password
                ? params.clientConfig.password
                : getCachedPassword(m.targetHost, m.shareName) || '')
            : '';
        clientMap.set(dl, {
          targetHost: m.targetHost,
          shareName: m.shareName,
          driveLetter: dl,
          authMode: m.authMode,
          ...(resolvedClientUsername ? { username: resolvedClientUsername } : {}),
          ...(cachedClientPwd ? { password: cachedClientPwd } : {}),
          persistent: formMatch ? params.clientConfig?.persistent !== false : true,
        });
      }
      if (params.clientConfig && params.clientConfig.targetHost.trim() && params.clientConfig.shareName.trim()) {
        const dl = (params.clientConfig.driveLetter || 'Z:').replace(/:?$/, ':').toUpperCase();
        if (!clientMap.has(dl)) {
          clientMap.set(dl, {
            targetHost: params.clientConfig.targetHost.trim(),
            shareName: params.clientConfig.shareName.trim(),
            driveLetter: dl,
            authMode: params.clientConfig.authMode,
            ...(params.clientConfig.username.trim() ? { username: params.clientConfig.username.trim() } : {}),
            ...(params.clientConfig.authMode === 'account' && params.clientConfig.password
              ? { password: params.clientConfig.password }
              : {}),
            persistent: params.clientConfig.persistent,
          });
        }
      }
    }

    return {
      schemaVersion: 1,
      profileId,
      locationName: cleanName,
      description: (params.description || '').trim(),
      networkHint: includeNetworkHint
        ? {
            subnetPrefix: params.netInfo.subnetPrefix,
            primaryIp: params.netInfo.primaryIp,
            hostname: params.netInfo.hostname,
            adapterName: params.netInfo.adapterName,
          }
        : { subnetPrefix: '', primaryIp: '', hostname: '' },
      createdAt: params.existingCreatedAt || nowIso,
      updatedAt: nowIso,
      ...(hostPreset ? { hostPreset } : {}),
      savedShares,
      clientTargets: Array.from(clientMap.values()),
      ...(params.preferredPatchMode ? { preferredPatchMode: params.preferredPatchMode } : {}),
    };
  },

  async listLocationProfiles(): Promise<{
    success: boolean;
    directory: string;
    writable: boolean;
    profiles: LocationProfileSummary[];
  }> {
    if (window.ahbiShareElectron?.listLocationProfiles) {
      return await window.ahbiShareElectron.listLocationProfiles();
    }
    const stored = readStore<LocationProfileFile[]>(STORAGE_LOCATIONS_SIM_KEY, []);
    const summaries: LocationProfileSummary[] = stored
      .map((p) => ({
        profileId: p.profileId,
        locationName: p.locationName,
        description: p.description || '',
        networkHint: p.networkHint || { subnetPrefix: '', primaryIp: '', hostname: '' },
        shareCount: Array.isArray(p.savedShares) ? p.savedShares.length : 0,
        clientTargetCount: Array.isArray(p.clientTargets) ? p.clientTargets.length : 0,
        ...(p.preferredPatchMode ? { preferredPatchMode: p.preferredPatchMode } : {}),
        createdAt: p.createdAt || '',
        updatedAt: p.updatedAt || '',
        fileName: `${p.profileId}.location.json`,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      success: true,
      directory: '웹 브라우저 사용장소 보관함',
      writable: true,
      profiles: summaries,
    };
  },

  cacheLocationProfileCredentials(profile: LocationProfileFile): void {
    if (profile.hostPreset?.authMode === 'account' && profile.hostPreset.password) {
      runtimeLocationHostPasswordCache.set(profile.profileId, profile.hostPreset.password);
    }
    for (const sh of profile.savedShares || []) {
      if (sh.password) {
        setCachedPassword(sh.sourceHostName || 'LOCATION', sh.shareName, sh.password);
      }
    }
    for (const ct of profile.clientTargets || []) {
      if (ct.authMode === 'account' && ct.password) {
        runtimeLocationTargetPasswordCache.set(
          `${profile.profileId}::${ct.driveLetter.toUpperCase()}`,
          ct.password
        );
        setCachedPassword(ct.targetHost, ct.shareName, ct.password);
      }
    }
  },

  async saveLocationProfile(profile: LocationProfileFile): Promise<{
    success: boolean;
    profile?: LocationProfileFile;
    summary?: LocationProfileSummary;
    filePath?: string;
    error?: string;
  }> {
    // Keep runtime secrets in memory cache and sanitize any browser localStorage copy
    this.cacheLocationProfileCredentials(profile);

    if (window.ahbiShareElectron?.saveLocationProfile) {
      return await window.ahbiShareElectron.saveLocationProfile(profile);
    }

    const existing = readStore<LocationProfileFile[]>(STORAGE_LOCATIONS_SIM_KEY, []);
    const sanitizedForSim: LocationProfileFile = {
      ...profile,
      ...(profile.hostPreset ? { hostPreset: { ...profile.hostPreset, password: '' } } : {}),
      savedShares: profile.savedShares.map((s) => sanitizeLocationShareForSim(s)),
      clientTargets: profile.clientTargets.map((t) => ({
        targetHost: t.targetHost,
        shareName: t.shareName,
        driveLetter: t.driveLetter,
        authMode: t.authMode,
        ...(t.username ? { username: t.username } : {}),
        ...(t.encryptedCredentials ? { encryptedCredentials: t.encryptedCredentials } : {}),
        persistent: t.persistent,
      })),
    };
    const nextList = [sanitizedForSim, ...existing.filter((p) => p.profileId !== profile.profileId)];
    writeStore(STORAGE_LOCATIONS_SIM_KEY, nextList);
    return {
      success: true,
      profile,
      summary: {
        profileId: profile.profileId,
        locationName: profile.locationName,
        description: profile.description || '',
        networkHint: profile.networkHint,
        shareCount: profile.savedShares.length,
        clientTargetCount: profile.clientTargets.length,
        ...(profile.preferredPatchMode ? { preferredPatchMode: profile.preferredPatchMode } : {}),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        fileName: `${profile.profileId}.location.json`,
      },
    };
  },

  async loadLocationProfile(profileId: string): Promise<{
    success: boolean;
    profile?: LocationProfileFile;
    filePath?: string;
    error?: string;
  }> {
    if (window.ahbiShareElectron?.loadLocationProfile) {
      const res = await window.ahbiShareElectron.loadLocationProfile(profileId);
      if (res.success && res.profile) {
        this.cacheLocationProfileCredentials(res.profile);
      }
      return res;
    }

    const stored = readStore<LocationProfileFile[]>(STORAGE_LOCATIONS_SIM_KEY, []);
    const found = stored.find((p) => p.profileId === profileId);
    if (!found) {
      return { success: false, error: '해당 사용장소 프로필을 찾을 수 없습니다.' };
    }

    const hostPwd = runtimeLocationHostPasswordCache.get(found.profileId) || '';
    const hydrated: LocationProfileFile = {
      ...found,
      ...(found.hostPreset
        ? {
            hostPreset: {
              ...found.hostPreset,
              password: found.hostPreset.authMode === 'account' ? hostPwd : '',
            },
          }
        : {}),
      savedShares: (found.savedShares || []).map((s) => {
        const cachedPass = getCachedPassword(s.sourceHostName || 'LOCATION', s.shareName);
        if (!cachedPass) return s;
        return {
          ...s,
          password: cachedPass,
          connectionCode: rehydrateCodeWithPassword(s, cachedPass),
        };
      }),
      clientTargets: (found.clientTargets || []).map((ct) => {
        const targetPass = runtimeLocationTargetPasswordCache.get(
          `${found.profileId}::${ct.driveLetter.toUpperCase()}`
        );
        return {
          ...ct,
          ...(ct.authMode === 'account' && targetPass ? { password: targetPass } : {}),
        };
      }),
    };
    return { success: true, profile: hydrated };
  },

  async deleteLocationProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    runtimeLocationHostPasswordCache.delete(profileId);
    const targetPrefix = `${profileId}::`;
    for (const key of Array.from(runtimeLocationTargetPasswordCache.keys())) {
      if (key.startsWith(targetPrefix)) {
        runtimeLocationTargetPasswordCache.delete(key);
      }
    }
    if (window.ahbiShareElectron?.deleteLocationProfile) {
      return await window.ahbiShareElectron.deleteLocationProfile(profileId);
    }
    const stored = readStore<LocationProfileFile[]>(STORAGE_LOCATIONS_SIM_KEY, []);
    writeStore(
      STORAGE_LOCATIONS_SIM_KEY,
      stored.filter((p) => p.profileId !== profileId)
    );
    return { success: true };
  },

  async exportLocationProfileFile(profile: LocationProfileFile): Promise<{
    success: boolean;
    canceled?: boolean;
    filePath?: string;
    message: string;
  }> {
    if (window.ahbiShareElectron?.exportLocationProfileFile) {
      return await window.ahbiShareElectron.exportLocationProfileFile(profile);
    }

    const sanitizedExport = {
      ...profile,
      schemaVersion: 1 as const,
      kind: 'ahbishare-location-profile',
      ...(profile.hostPreset ? { hostPreset: { ...profile.hostPreset, password: '' } } : {}),
      savedShares: profile.savedShares.map((s) => sanitizeLocationShareForSim(s)),
      clientTargets: profile.clientTargets.map((ct) => ({
        targetHost: ct.targetHost,
        shareName: ct.shareName,
        driveLetter: ct.driveLetter,
        authMode: ct.authMode,
        ...(ct.username ? { username: ct.username } : {}),
        ...(ct.encryptedCredentials ? { encryptedCredentials: ct.encryptedCredentials } : {}),
        persistent: ct.persistent,
      })),
    };
    const blob = new Blob([JSON.stringify(sanitizedExport, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.profileId}.location.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return {
      success: true,
      filePath: a.download,
      message: `사용장소 '${profile.locationName}' 프로필 파일(${a.download})을 다운로드했습니다.`,
    };
  },

  async importLocationProfileFile(saveToCatalog = true): Promise<{
    success: boolean;
    canceled?: boolean;
    profile?: LocationProfileFile;
    filePath?: string;
    savedToCatalog?: boolean;
    message: string;
  }> {
    if (window.ahbiShareElectron?.importLocationProfileFile) {
      const res = await window.ahbiShareElectron.importLocationProfileFile({ saveToCatalog });
      if (res.success && res.profile) {
        this.cacheLocationProfileCredentials(res.profile);
      }
      return res;
    }
    return {
      success: false,
      message: '브라우저 환경에서는 파일 업로드 input을 통해 JSON을 가져옵니다.',
    };
  },

  async importLocationProfileFromJson(
    jsonText: string,
    saveToCatalog = true
  ): Promise<{
    success: boolean;
    profile?: LocationProfileFile;
    message: string;
  }> {
    try {
      const cleanText = jsonText.replace(/^\uFEFF/, '');
      const parsed = JSON.parse(cleanText) as Partial<LocationProfileFile>;
      if (!parsed || typeof parsed !== 'object' || !parsed.locationName) {
        return { success: false, message: '사용장소 이름(locationName)이 포함된 올바른 프로필 JSON이 아닙니다.' };
      }
      const cleanName = String(parsed.locationName).trim();
      const normalized: LocationProfileFile = {
        schemaVersion: 1,
        profileId: normalizeLocationProfileId(parsed.profileId, cleanName),
        locationName: cleanName,
        description: String(parsed.description || ''),
        networkHint: parsed.networkHint || { subnetPrefix: '', primaryIp: '', hostname: '' },
        createdAt: String(parsed.createdAt || new Date().toISOString()),
        updatedAt: String(parsed.updatedAt || new Date().toISOString()),
        ...(parsed.hostPreset ? { hostPreset: parsed.hostPreset } : {}),
        savedShares: Array.isArray(parsed.savedShares) ? parsed.savedShares : [],
        clientTargets: Array.isArray(parsed.clientTargets) ? parsed.clientTargets : [],
        ...(parsed.preferredPatchMode ? { preferredPatchMode: parsed.preferredPatchMode } : {}),
      };
      if (saveToCatalog) {
        const saved = await this.saveLocationProfile(normalized);
        if (!saved.success) {
          return { success: false, message: saved.error || '사용장소 목록 등록 실패' };
        }
        return {
          success: true,
          profile: saved.profile || normalized,
          message: `사용장소 '${normalized.locationName}' 프로필을 가져와 저장했습니다.`,
        };
      }
      return {
        success: true,
        profile: normalized,
        message: `사용장소 '${normalized.locationName}' 프로필을 불러왔습니다.`,
      };
    } catch (err) {
      return {
        success: false,
        message: `JSON 파일 파싱 실패: ${err instanceof Error ? err.message : '형식 오류'}`,
      };
    }
  },

  async applyLocationProfileBatch(
    profile: LocationProfileFile,
    netInfo: LocalNetworkInfo,
    callbacks?: {
      onHostSteps?: (steps: PipelineStep[]) => void;
      onClientSteps?: (steps: PipelineStep[]) => void;
      onProgressText?: (text: string) => void;
    }
  ): Promise<LocationBatchApplyResult> {
    const details: LocationBatchApplyItemResult[] = [];
    let appliedShares = 0;
    let failedShares = 0;
    let appliedMounts = 0;
    let failedMounts = 0;

    // 1. Apply saved host shares if present (keep indexing synchronized with App.tsx validShares)
    const validShares = profile.savedShares.filter((s) => Boolean(s.folderPath && s.shareName));
    for (let i = 0; i < validShares.length; i++) {
      const sh = validShares[i];
      callbacks?.onProgressText?.(`호스트 공유폴더(${i + 1}/${validShares.length}): ${sh.shareName}`);
      const decodedCodePwd = sh.connectionCode ? decodeConnectionCode(sh.connectionCode)?.password || '' : '';
      const resolvedSharePwd =
        sh.password ||
        decodedCodePwd ||
        getCachedPassword(sh.sourceHostName || netInfo.hostname, sh.shareName) ||
        getCachedPassword(netInfo.hostname, sh.shareName) ||
        '';
      if (sh.authMode === 'account' && !resolvedSharePwd) {
        failedShares++;
        details.push({
          kind: 'share',
          label: `${sh.shareName} (${sh.folderPath})`,
          success: false,
          message: '보안 계정 모드의 공유 암호를 복원할 수 없습니다. 암호를 입력해 재개설하거나 장소 프로필을 다시 저장하세요.',
        });
        continue;
      }
      const hostCfg: HostConfig = {
        folderPath: sh.folderPath,
        shareName: sh.shareName,
        authMode: sh.authMode,
        permission: sh.permission,
        username: sh.username || 'AhBiShare',
        password: resolvedSharePwd,
        ttlMinutes: sh.ttlMinutes,
        autoRevokeOnExpiry: sh.autoRevokeOnExpiry,
      };
      try {
        const res = await this.runHostOneClick(hostCfg, netInfo, (steps) => callbacks?.onHostSteps?.(steps));
        if (res.success) {
          appliedShares++;
          details.push({
            kind: 'share',
            label: `${sh.shareName} (${sh.folderPath})`,
            success: true,
            message: '공유폴더 개설 및 방화벽 설정 완료',
          });
        } else {
          failedShares++;
          const failedErr = res.steps.find((s) => s.status === 'error' && s.error)?.error;
          details.push({
            kind: 'share',
            label: `${sh.shareName} (${sh.folderPath})`,
            success: false,
            message: failedErr || '공유폴더 개설 중 오류가 발생했습니다.',
          });
        }
      } catch (err) {
        failedShares++;
        details.push({
          kind: 'share',
          label: `${sh.shareName} (${sh.folderPath})`,
          success: false,
          message: err instanceof Error ? err.message : '알 수 없는 오류',
        });
      }
    }

    // 2. Apply saved client network drive targets
    for (let i = 0; i < profile.clientTargets.length; i++) {
      const ct = profile.clientTargets[i];
      callbacks?.onProgressText?.(`네트워크 드라이브(${i + 1}/${profile.clientTargets.length}): ${ct.driveLetter} → \\\\${ct.targetHost}\\${ct.shareName}`);
      const resolvedClientPwd =
        ct.password ||
        runtimeLocationTargetPasswordCache.get(`${profile.profileId}::${ct.driveLetter.toUpperCase()}`) ||
        getCachedPassword(ct.targetHost, ct.shareName) ||
        '';
      if (ct.authMode === 'account' && !resolvedClientPwd) {
        failedMounts++;
        details.push({
          kind: 'mount',
          label: `${ct.driveLetter} (\\\\${ct.targetHost}\\${ct.shareName})`,
          success: false,
          message: '보안 계정 모드의 접속 암호가 비어 있습니다. 암호가 저장된 PC에서 실행하거나 연결 폼에 암호를 입력하세요.',
        });
        continue;
      }
      const clientCfg: ClientTargetConfig = {
        targetHost: ct.targetHost,
        shareName: ct.shareName,
        driveLetter: ct.driveLetter,
        authMode: ct.authMode,
        username: ct.username || '',
        password: resolvedClientPwd,
        persistent: ct.persistent,
      };
      try {
        const res = await this.runClientOneClick(
          clientCfg,
          (steps) => callbacks?.onClientSteps?.(steps),
          netInfo.osEra
        );
        if (res.success) {
          appliedMounts++;
          details.push({
            kind: 'mount',
            label: `${ct.driveLetter} (\\\\${ct.targetHost}\\${ct.shareName})`,
            success: true,
            message: '네트워크 드라이브 연결 완료',
          });
        } else {
          failedMounts++;
          const failedErr = res.steps.find((s) => s.status === 'error' && s.error)?.error;
          details.push({
            kind: 'mount',
            label: `${ct.driveLetter} (\\\\${ct.targetHost}\\${ct.shareName})`,
            success: false,
            message: failedErr || '네트워크 드라이브 연결 실패 (대상 PC 전원·LAN·계정 확인 필요)',
          });
        }
      } catch (err) {
        failedMounts++;
        details.push({
          kind: 'mount',
          label: `${ct.driveLetter} (\\\\${ct.targetHost}\\${ct.shareName})`,
          success: false,
          message: err instanceof Error ? err.message : '알 수 없는 오류',
        });
      }
    }

    const totalAttempted = appliedShares + failedShares + appliedMounts + failedMounts;
    const totalSucceeded = appliedShares + appliedMounts;
    const totalFailed = failedShares + failedMounts;

    const summary =
      totalAttempted === 0
        ? `'${profile.locationName}'에 일괄 실행할 공유폴더나 드라이브 항목이 없습니다.`
        : totalFailed === 0
          ? `'${profile.locationName}' 일괄 적용 완료 (공유 ${appliedShares}건 · 드라이브 ${appliedMounts}건)`
          : `'${profile.locationName}' 부분 적용 완료 (성공 ${totalSucceeded}건 · 실패 ${totalFailed}건)`;

    return {
      success: totalAttempted > 0 && totalFailed === 0,
      appliedShares,
      failedShares,
      appliedMounts,
      failedMounts,
      summary,
      details,
    };
  },
};
