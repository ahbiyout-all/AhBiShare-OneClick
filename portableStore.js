const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORTABLE_FILE_NAME = 'AhBiShare_OneClick.portable.json';
const TOKEN_PREFIX = 'ABSHARE://';
const AAD = Buffer.from('AhBiShare-OneClick-Portable-v1', 'utf8');
const KEY_PASSPHRASE = 'AhBiYout-AhBiShare-USB-CrossPC-KeyMaterial-2026';
const KEY_SALT = Buffer.from('ahbishare-portable-salt-v1', 'utf8');

let cachedKey = null;
function getPortableAesKey() {
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(KEY_PASSPHRASE, KEY_SALT, 32);
  }
  return cachedKey;
}

function encryptCredentials(creds) {
  const key = getPortableAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const plain = JSON.stringify({
    username: creds.username ? String(creds.username) : '',
    password: creds.password ? String(creds.password) : '',
  });
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encVersion: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

function decryptCredentials(enc) {
  if (!enc || enc.encVersion !== 1 || !enc.iv || !enc.tag || !enc.ciphertext) {
    return { ok: false, username: '', password: '' };
  }
  try {
    const key = getPortableAesKey();
    const iv = Buffer.from(enc.iv, 'base64');
    const tag = Buffer.from(enc.tag, 'base64');
    const ciphertext = Buffer.from(enc.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted);
    return {
      ok: true,
      username: parsed.username ? String(parsed.username) : '',
      password: parsed.password ? String(parsed.password) : '',
    };
  } catch {
    return { ok: false, username: '', password: '' };
  }
}

function encodeTokenPayload(payload) {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${TOKEN_PREFIX}${b64}`;
}

function decodeTokenPayload(rawCode) {
  const raw = String(rawCode || '').trim();
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  try {
    const encoded = raw.slice(TOKEN_PREFIX.length).trim();
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function buildSanitizedConnectionCode(entry) {
  const decoded = decodeTokenPayload(entry.connectionCode);
  const payload = {
    v: decoded?.v || 1,
    hostName: decoded?.hostName || entry.sourceHostName || '',
    ip: decoded?.ip || entry.sourceIp || '',
    shareName: entry.shareName || decoded?.shareName || '',
    authMode: entry.authMode === 'account' ? 'account' : 'guest',
    ...(entry.authMode === 'account' && entry.username ? { username: entry.username } : {}),
    createdAt: decoded?.createdAt || entry.createdAt || new Date().toISOString(),
  };
  return encodeTokenPayload(payload);
}

function buildRehydratedConnectionCode(entry, username, password) {
  const decoded = decodeTokenPayload(entry.connectionCode);
  const payload = {
    v: decoded?.v || 1,
    hostName: decoded?.hostName || entry.sourceHostName || '',
    ip: decoded?.ip || entry.sourceIp || '',
    shareName: entry.shareName || decoded?.shareName || '',
    authMode: entry.authMode === 'account' ? 'account' : 'guest',
    ...(entry.authMode === 'account' && username ? { username } : {}),
    ...(entry.authMode === 'account' && password ? { password } : {}),
    createdAt: decoded?.createdAt || entry.createdAt || new Date().toISOString(),
  };
  return encodeTokenPayload(payload);
}

function checkDirectoryWritable(dirPath) {
  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
    return { writable: true };
  } catch (err) {
    return { writable: false, writeError: err && err.message ? err.message : '쓰기 권한 없음' };
  }
}

function resolvePortableLocation({ env = process.env, app = null, baseDir = __dirname } = {}) {
  let mode = 'dev-fs';
  let directory = path.resolve(baseDir || __dirname);

  if (env && typeof env.PORTABLE_EXECUTABLE_DIR === 'string' && env.PORTABLE_EXECUTABLE_DIR.trim()) {
    mode = 'portable-exe';
    directory = path.resolve(env.PORTABLE_EXECUTABLE_DIR.trim());
  } else if (app && app.isPackaged) {
    mode = 'packaged-exe';
    directory = path.dirname(app.getPath('exe'));
  }

  const filePath = path.join(directory, PORTABLE_FILE_NAME);
  const writeCheck = checkDirectoryWritable(directory);

  return {
    supported: true,
    mode,
    directory,
    fileName: PORTABLE_FILE_NAME,
    filePath,
    writable: writeCheck.writable,
    ...(writeCheck.writeError ? { writeError: writeCheck.writeError } : {}),
  };
}

function emptyDocument() {
  return {
    schemaVersion: 1,
    updatedAt: '',
    shares: [],
  };
}

function sanitizeHostPolicySnapshot(snap) {
  if (!snap || typeof snap !== 'object' || !snap.hostName) return null;
  const out = {
    hostName: String(snap.hostName),
    osProductName: String(snap.osProductName || 'Windows'),
    osDisplayVersion: String(snap.osDisplayVersion || ''),
    osBuild: Number(snap.osBuild) || 26100,
    osEra: String(snap.osEra || 'win11_24h2'),
    networkProfile: String(snap.networkProfile || 'Unknown'),
    smbServerSigningRequired: Boolean(snap.smbServerSigningRequired),
    allowInsecureGuestAuth: Boolean(snap.allowInsecureGuestAuth),
    rpcAuthnLevelPrivacyDisabled: Boolean(snap.rpcAuthnLevelPrivacyDisabled),
    rpcUseNamedPipeProtocol: Boolean(snap.rpcUseNamedPipeProtocol),
    pointAndPrintRelaxed: Boolean(snap.pointAndPrintRelaxed),
    capturedAt: String(snap.capturedAt || new Date().toISOString()),
  };
  if (snap.lmCompatibilityLevel === null || typeof snap.lmCompatibilityLevel === 'number') {
    out.lmCompatibilityLevel = snap.lmCompatibilityLevel;
  }
  if (typeof snap.localAccountTokenFilterEnabled === 'boolean') {
    out.localAccountTokenFilterEnabled = snap.localAccountTokenFilterEnabled;
  }
  return out;
}

function sanitizeHostPoliciesMap(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return undefined;
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(rawMap)) {
    const clean = sanitizeHostPolicySnapshot(v);
    if (clean) {
      out[String(k || clean.hostName)] = clean;
      count++;
    }
  }
  return count > 0 ? out : undefined;
}

function prepareDiskDocument(doc) {
  const nowIso = new Date().toISOString();
  const inputShares = Array.isArray(doc?.shares) ? doc.shares : [];
  const serializedShares = [];

  for (const item of inputShares) {
    if (!item || !item.shareName) continue;
    const authMode = item.authMode === 'account' ? 'account' : 'guest';
    const tokenDecoded = decodeTokenPayload(item.connectionCode);
    const plainUsername = item.username || tokenDecoded?.username || '';
    const plainPassword = item.password || item.restoredPassword || tokenDecoded?.password || '';

    let encryptedCredentials = item.encryptedCredentials;
    if (authMode === 'account' && plainPassword) {
      encryptedCredentials = encryptCredentials({
        username: plainUsername,
        password: plainPassword,
      });
    } else if (authMode !== 'account') {
      encryptedCredentials = undefined;
    }

    const diskEntry = {
      sourceHostName: String(item.sourceHostName || tokenDecoded?.hostName || ''),
      sourceIp: String(item.sourceIp || tokenDecoded?.ip || ''),
      shareName: String(item.shareName),
      folderPath: String(item.folderPath || ''),
      uncPath: String(item.uncPath || ''),
      authMode,
      permission: item.permission === 'read' ? 'read' : 'full',
      ...(plainUsername ? { username: String(plainUsername) } : {}),
      ...(encryptedCredentials ? { encryptedCredentials } : {}),
      createdAt: String(item.createdAt || ''),
      updatedAt: String(item.updatedAt || nowIso),
      ...(typeof item.ttlMinutes === 'number' && item.ttlMinutes > 0 ? { ttlMinutes: item.ttlMinutes } : {}),
      ...(item.expiresAt ? { expiresAt: String(item.expiresAt) } : {}),
      ...(typeof item.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: item.autoRevokeOnExpiry } : {}),
      connectionCode: buildSanitizedConnectionCode({
        ...item,
        username: plainUsername,
        authMode,
      }),
    };
    serializedShares.push(diskEntry);
  }

  const hostPolicies = sanitizeHostPoliciesMap(doc?.hostPolicies);
  const out = {
    schemaVersion: 1,
    updatedAt: doc?.updatedAt || nowIso,
    shares: serializedShares,
    ...(hostPolicies ? { hostPolicies } : {}),
  };
  if (doc?.lastClientTarget && doc.lastClientTarget.targetHost && doc.lastClientTarget.shareName) {
    out.lastClientTarget = {
      targetHost: String(doc.lastClientTarget.targetHost),
      shareName: String(doc.lastClientTarget.shareName),
      driveLetter: String(doc.lastClientTarget.driveLetter || 'Z:'),
      authMode: doc.lastClientTarget.authMode === 'account' ? 'account' : 'guest',
      updatedAt: String(doc.lastClientTarget.updatedAt || nowIso),
    };
  }
  return out;
}

function hydrateRuntimeDocument(diskDoc) {
  const shares = [];
  const inputShares = Array.isArray(diskDoc?.shares) ? diskDoc.shares : [];

  for (const raw of inputShares) {
    if (!raw || !raw.shareName) continue;
    const authMode = raw.authMode === 'account' ? 'account' : 'guest';
    let username = raw.username ? String(raw.username) : '';
    let password = '';
    let decryptionFailed = false;

    if (authMode === 'account') {
      if (raw.encryptedCredentials) {
        const dec = decryptCredentials(raw.encryptedCredentials);
        if (dec.ok) {
          username = dec.username || username;
          password = dec.password;
        } else {
          decryptionFailed = true;
        }
      } else if (raw.password) {
        password = String(raw.password);
      }
    }

    shares.push({
      sourceHostName: String(raw.sourceHostName || ''),
      sourceIp: String(raw.sourceIp || ''),
      shareName: String(raw.shareName),
      folderPath: String(raw.folderPath || ''),
      uncPath: String(raw.uncPath || ''),
      authMode,
      permission: raw.permission === 'read' ? 'read' : 'full',
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      ...(raw.encryptedCredentials ? { encryptedCredentials: raw.encryptedCredentials } : {}),
      createdAt: String(raw.createdAt || ''),
      updatedAt: String(raw.updatedAt || diskDoc.updatedAt || ''),
      ...(typeof raw.ttlMinutes === 'number' && raw.ttlMinutes > 0 ? { ttlMinutes: raw.ttlMinutes } : {}),
      ...(raw.expiresAt ? { expiresAt: String(raw.expiresAt) } : {}),
      ...(typeof raw.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: raw.autoRevokeOnExpiry } : {}),
      connectionCode: buildRehydratedConnectionCode(raw, username, password),
      ...(decryptionFailed ? { decryptionFailed: true } : {}),
    });
  }

  const hostPolicies = sanitizeHostPoliciesMap(diskDoc?.hostPolicies);
  const runtimeDoc = {
    schemaVersion: 1,
    updatedAt: String(diskDoc?.updatedAt || ''),
    shares,
    ...(hostPolicies ? { hostPolicies } : {}),
  };
  if (diskDoc?.lastClientTarget) {
    runtimeDoc.lastClientTarget = diskDoc.lastClientTarget;
  }
  return runtimeDoc;
}

function atomicWriteJson(filePath, payloadObj) {
  const content = JSON.stringify(payloadObj, null, 2);
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${PORTABLE_FILE_NAME}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmpPath, content, { encoding: 'utf8', mode: 0o600 });
    try {
      fs.renameSync(tmpPath, filePath);
    } catch {
      fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600 });
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
    }
    return { success: true };
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    return {
      success: false,
      error: err && err.message ? err.message : 'USB 파일 쓰기에 실패했습니다.',
    };
  }
}

function createPortableStore(options = {}) {
  const getLocation = () => resolvePortableLocation(options);

  const loadPortableData = () => {
    const loc = getLocation();
    const exists = fs.existsSync(loc.filePath);
    if (!exists) {
      return {
        success: true,
        document: emptyDocument(),
        status: { ...loc, hasExistingFile: false },
      };
    }

    try {
      const raw = fs.readFileSync(loc.filePath, 'utf8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      const doc = hydrateRuntimeDocument(parsed);
      return {
        success: true,
        document: doc,
        status: {
          ...loc,
          hasExistingFile: true,
          lastSyncedAt: doc.updatedAt || undefined,
        },
      };
    } catch {
      let backupPath;
      try {
        backupPath = path.join(loc.directory, `AhBiShare_OneClick.portable.corrupt-${Date.now()}.json`);
        fs.renameSync(loc.filePath, backupPath);
      } catch {
        backupPath = undefined;
      }
      return {
        success: false,
        document: emptyDocument(),
        status: {
          ...loc,
          hasExistingFile: false,
          corruptedRecovered: true,
          ...(backupPath ? { corruptedBackupPath: backupPath } : {}),
        },
      };
    }
  };

  const savePortableData = (doc) => {
    const loc = getLocation();
    const diskDoc = prepareDiskDocument(doc);
    const writeRes = atomicWriteJson(loc.filePath, diskDoc);
    const hydrated = hydrateRuntimeDocument(diskDoc);

    if (!writeRes.success) {
      return {
        success: false,
        document: hydrated,
        status: {
          ...loc,
          writable: false,
          hasExistingFile: fs.existsSync(loc.filePath),
          writeError: writeRes.error,
        },
      };
    }

    return {
      success: true,
      document: hydrated,
      status: {
        ...loc,
        writable: true,
        hasExistingFile: true,
        lastSyncedAt: diskDoc.updatedAt,
      },
    };
  };

  return {
    getStatus: () => {
      const loc = getLocation();
      const exists = fs.existsSync(loc.filePath);
      let lastSyncedAt;
      if (exists) {
        try {
          const parsed = JSON.parse(fs.readFileSync(loc.filePath, 'utf8'));
          if (parsed && parsed.updatedAt) lastSyncedAt = String(parsed.updatedAt);
        } catch {}
      }
      return {
        ...loc,
        hasExistingFile: exists,
        ...(lastSyncedAt ? { lastSyncedAt } : {}),
      };
    },
    loadPortableData,
    savePortableData,
  };
}

module.exports = {
  PORTABLE_FILE_NAME,
  encryptCredentials,
  decryptCredentials,
  resolvePortableLocation,
  prepareDiskDocument,
  hydrateRuntimeDocument,
  createPortableStore,
};
