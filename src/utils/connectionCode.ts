import { ConnectionTokenPayload } from '@/types/share';

const TOKEN_PREFIX = 'ABSHARE://';
const INVALID_SHARE_CHARS = /[\\/:*?"<>|]/;

function encodeUtf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeUtf8Base64(b64: string): string {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (norm.length % 4)) % 4;
  const padded = norm + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function validateShareName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '공유 폴더 이름을 입력하세요.';
  if (INVALID_SHARE_CHARS.test(trimmed)) {
    return '공유 이름에는 \\ / : * ? " < > | 문자를 사용할 수 없습니다.';
  }
  if (trimmed.length > 80) {
    return '공유 이름은 80자 이하로 입력하세요.';
  }
  return null;
}

export function validateFolderPath(folderPath: string): string | null {
  const trimmed = folderPath.trim().replace(/\//g, '\\');
  if (!trimmed) return '공유할 로컬 폴더 경로를 입력하세요.';
  if (/^[A-Za-z]:\\*$/.test(trimmed)) {
    return '드라이브 루트 전체(예: C:\\)는 직접 공유할 수 없습니다. 하위 폴더(예: C:\\AhBiShared)를 지정하세요.';
  }
  if (!/^[A-Za-z]:\\/.test(trimmed)) {
    return '올바른 Windows 절대 경로를 입력하세요 (예: C:\\AhBiShared 또는 D:\\Work).';
  }
  const withoutDrive = trimmed.slice(2);
  if (/[*?"<>|:]/.test(withoutDrive)) {
    return '폴더 경로에 사용할 수 없는 특수문자(: * ? " < > |)가 포함되어 있습니다.';
  }
  return null;
}

export function validateTargetHost(host: string): string | null {
  const trimmed = host.trim();
  if (!trimmed) return '대상 메인 PC의 IP 주소 또는 호스트 이름을 입력하세요.';
  if (/^-/.test(trimmed) || /[\x00-\x1f\\/:*?"<>|\s;&$`'(){}[\]!]/.test(trimmed)) {
    return 'IP 주소 또는 호스트 이름에 공백이나 허용되지 않는 특수문자를 포함할 수 없습니다.';
  }
  return null;
}

export function encodeConnectionCode(payload: ConnectionTokenPayload): string {
  const json = JSON.stringify(payload);
  return `${TOKEN_PREFIX}${encodeUtf8Base64(json)}`;
}

export function decodeConnectionCode(rawCode: string): ConnectionTokenPayload | null {
  const trimmed = rawCode.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith(TOKEN_PREFIX)) {
      const encoded = trimmed.slice(TOKEN_PREFIX.length).trim();
      const parsed = JSON.parse(decodeUtf8Base64(encoded)) as ConnectionTokenPayload;
      if (parsed && (parsed.ip || parsed.hostName) && parsed.shareName) {
        const ip = String(parsed.ip || parsed.hostName).trim();
        const hostName = String(parsed.hostName || parsed.ip).trim();
        const shareName = String(parsed.shareName).trim();
        if (validateTargetHost(ip) || validateShareName(shareName)) {
          return null;
        }
        return {
          v: parsed.v || 1,
          hostName,
          ip,
          shareName,
          authMode: parsed.authMode === 'account' ? 'account' : 'guest',
          username: parsed.username ? String(parsed.username) : '',
          password: parsed.password ? String(parsed.password) : '',
          createdAt: parsed.createdAt || new Date().toISOString(),
        };
      }
    }

    // Support direct UNC paths like \\192.168.0.10\AhBiShared or \\192.168.0.10\AhBiShared\
    const cleanUnc = trimmed.replace(/[\\/]+$/, '');
    const uncMatch = cleanUnc.match(/^\\\\([^\\]+)\\([^\\]+)$/);
    if (uncMatch) {
      const hostVal = uncMatch[1].trim();
      const shareVal = uncMatch[2].trim();
      if (validateTargetHost(hostVal) || validateShareName(shareVal)) {
        return null;
      }
      return {
        v: 1,
        hostName: hostVal,
        ip: hostVal,
        shareName: shareVal,
        authMode: 'guest',
        createdAt: new Date().toISOString(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function generateSecureSharePassword(length = 12): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%&';
  const buf = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(buf[i] % charset.length);
  }
  return result;
}

export interface ResolvedClientCredentials {
  authMode: 'guest' | 'account';
  username: string;
  password: string;
  connectionCode?: string;
  source: 'location_target' | 'portable_share' | 'location_share' | 'active_share' | 'location_preset';
  decryptionFailed?: boolean;
}

export function resolveClientAccountCredentials(params: {
  targetHost?: string;
  hostCandidates?: string[];
  shareName?: string;
  requireAccountOnly?: boolean;
  savedLocationTargets?: Array<{
    targetHost: string;
    shareName: string;
    authMode: 'guest' | 'account';
    username?: string;
    password?: string;
  }>;
  locationSavedShares?: Array<{
    sourceHostName?: string;
    sourceIp?: string;
    shareName: string;
    authMode: 'guest' | 'account';
    username?: string;
    password?: string;
    connectionCode?: string;
    decryptionFailed?: boolean;
  }>;
  locationHostPreset?: {
    shareName?: string;
    authMode: 'guest' | 'account';
    username?: string;
    password?: string;
  } | null;
  portableShares?: Array<{
    sourceHostName?: string;
    sourceIp?: string;
    shareName: string;
    authMode: 'guest' | 'account';
    username?: string;
    password?: string;
    connectionCode?: string;
    decryptionFailed?: boolean;
  }>;
  activeShares?: Array<{
    sourceHostName?: string;
    sourceIp?: string;
    shareName: string;
    authMode: 'guest' | 'account';
    username?: string;
    restoredPassword?: string;
    connectionCode?: string;
    decryptionFailed?: boolean;
  }>;
}): ResolvedClientCredentials | null {
  const norm = (val?: string) => String(val || '').trim().toLowerCase();
  const hostSet = new Set(
    [params.targetHost, ...(params.hostCandidates || [])]
      .map((h) => norm(h))
      .filter(Boolean)
  );
  const targetShare = norm(params.shareName);
  const requireAccount = Boolean(params.requireAccountOnly);

  interface CandidateRecord extends ResolvedClientCredentials {
    hostKeys: string[];
    shareKey: string;
    priorityOrder: number;
  }

  const candidates: CandidateRecord[] = [];
  const collectHostKeys = (host?: string, ip?: string) =>
    [norm(host), norm(ip)].filter(Boolean);

  for (const t of params.savedLocationTargets || []) {
    const authMode = t.authMode === 'account' ? 'account' : 'guest';
    candidates.push({
      authMode,
      username: authMode === 'account' ? String(t.username || '').trim() : '',
      password: authMode === 'account' ? String(t.password || '') : '',
      source: 'location_target',
      hostKeys: collectHostKeys(t.targetHost),
      shareKey: norm(t.shareName),
      priorityOrder: 1,
    });
  }

  for (const s of params.portableShares || []) {
    const decoded = s.connectionCode ? decodeConnectionCode(s.connectionCode) : null;
    const authMode = s.authMode === 'account' ? 'account' : 'guest';
    const password = authMode === 'account' ? s.password || decoded?.password || '' : '';
    const username = authMode === 'account' ? String(s.username || decoded?.username || '').trim() : '';
    candidates.push({
      authMode,
      username,
      password,
      connectionCode: s.connectionCode,
      source: 'portable_share',
      decryptionFailed: s.decryptionFailed,
      hostKeys: collectHostKeys(s.sourceHostName || decoded?.hostName, s.sourceIp || decoded?.ip),
      shareKey: norm(s.shareName),
      priorityOrder: 2,
    });
  }

  for (const s of params.locationSavedShares || []) {
    const decoded = s.connectionCode ? decodeConnectionCode(s.connectionCode) : null;
    const authMode = s.authMode === 'account' ? 'account' : 'guest';
    const password = authMode === 'account' ? s.password || decoded?.password || '' : '';
    const username = authMode === 'account' ? String(s.username || decoded?.username || '').trim() : '';
    candidates.push({
      authMode,
      username,
      password,
      connectionCode: s.connectionCode,
      source: 'location_share',
      decryptionFailed: s.decryptionFailed,
      hostKeys: collectHostKeys(s.sourceHostName || decoded?.hostName, s.sourceIp || decoded?.ip),
      shareKey: norm(s.shareName),
      priorityOrder: 3,
    });
  }

  for (const s of params.activeShares || []) {
    const decoded = s.connectionCode ? decodeConnectionCode(s.connectionCode) : null;
    const authMode = s.authMode === 'account' ? 'account' : 'guest';
    const password = authMode === 'account' ? s.restoredPassword || decoded?.password || '' : '';
    const username = authMode === 'account' ? String(s.username || decoded?.username || '').trim() : '';
    candidates.push({
      authMode,
      username,
      password,
      connectionCode: s.connectionCode,
      source: 'active_share',
      decryptionFailed: s.decryptionFailed,
      hostKeys: collectHostKeys(s.sourceHostName || decoded?.hostName, s.sourceIp || decoded?.ip),
      shareKey: norm(s.shareName),
      priorityOrder: 4,
    });
  }

  if (params.locationHostPreset) {
    const hp = params.locationHostPreset;
    const authMode = hp.authMode === 'account' ? 'account' : 'guest';
    candidates.push({
      authMode,
      username: authMode === 'account' ? String(hp.username || '').trim() : '',
      password: authMode === 'account' ? String(hp.password || '') : '',
      source: 'location_preset',
      hostKeys: [],
      shareKey: norm(hp.shareName),
      priorityOrder: 5,
    });
  }

  const filtered = requireAccount ? candidates.filter((c) => c.authMode === 'account') : candidates;
  if (filtered.length === 0) return null;

  const hasHostMatch = (c: CandidateRecord) => c.hostKeys.some((hk) => hostSet.has(hk));
  const sortBest = (list: CandidateRecord[]) =>
    [...list].sort((a, b) => {
      const aPwd = a.password ? 1 : 0;
      const bPwd = b.password ? 1 : 0;
      if (aPwd !== bPwd) return bPwd - aPwd;
      const aUser = a.username ? 1 : 0;
      const bUser = b.username ? 1 : 0;
      if (aUser !== bUser) return bUser - aUser;
      return a.priorityOrder - b.priorityOrder;
    });

  // 1. Exact host + shareName match
  if (hostSet.size > 0 && targetShare) {
    const exactBoth = filtered.filter((c) => hasHostMatch(c) && c.shareKey === targetShare);
    if (exactBoth.length > 0) return sortBest(exactBoth)[0];
  }

  // When switching explicitly to account mode (requireAccount = true), allow safe fallback matching
  if (requireAccount) {
    // 2. Host matches any account entry
    if (hostSet.size > 0) {
      const hostOnly = filtered.filter((c) => hasHostMatch(c));
      if (hostOnly.length > 0) return sortBest(hostOnly)[0];
    }

    // 3. Exact shareName matches account entry
    if (targetShare) {
      const shareOnly = filtered.filter((c) => c.shareKey === targetShare);
      if (shareOnly.length > 0) return sortBest(shareOnly)[0];
    }

    // 4. Unambiguous single unique account credential with password
    const withPwd = sortBest(filtered.filter((c) => Boolean(c.password)));
    if (withPwd.length > 0) {
      const distinctCreds = new Set(withPwd.map((c) => `${c.username}\0${c.password}`));
      if (distinctCreds.size === 1) {
        return withPwd[0];
      }
    }
  }

  return null;
}
