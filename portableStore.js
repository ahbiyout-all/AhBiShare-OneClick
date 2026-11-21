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
  if (snap.sourceIp) {
    out.sourceIp = String(snap.sourceIp);
  }
  if (snap.lmCompatibilityLevel === null || typeof snap.lmCompatibilityLevel === 'number') {
    out.lmCompatibilityLevel = snap.lmCompatibilityLevel;
  }
  if (typeof snap.localAccountTokenFilterEnabled === 'boolean') {
    out.localAccountTokenFilterEnabled = snap.localAccountTokenFilterEnabled;
  }
  if (typeof snap.guestNetworkLogonDenied === 'boolean') {
    out.guestNetworkLogonDenied = snap.guestNetworkLogonDenied;
  }
  if (typeof snap.limitBlankPasswordUse === 'boolean') {
    out.limitBlankPasswordUse = snap.limitBlankPasswordUse;
  }
  if (typeof snap.restrictNullSessAccess === 'boolean') {
    out.restrictNullSessAccess = snap.restrictNullSessAccess;
  }
  if (typeof snap.restrictAnonymous === 'boolean') {
    out.restrictAnonymous = snap.restrictAnonymous;
  }
  if (typeof snap.guestAccountEnabled === 'boolean') {
    out.guestAccountEnabled = snap.guestAccountEnabled;
  }
  if (typeof snap.firewall445Allowed === 'boolean') {
    out.firewall445Allowed = snap.firewall445Allowed;
  }
  if (snap.rawRegistrySnapshot && typeof snap.rawRegistrySnapshot === 'object') {
    const rawEntries = snap.rawRegistrySnapshot.entries;
    if (rawEntries && typeof rawEntries === 'object') {
      const cleanEntries = {};
      for (const [policyId, arr] of Object.entries(rawEntries)) {
        if (!Array.isArray(arr)) continue;
        cleanEntries[String(policyId)] = arr
          .filter((item) => item && typeof item === 'object' && item.registryPath && item.valueName)
          .slice(0, 8)
          .map((item) => ({
            policyId: String(item.policyId || policyId),
            registryPath: String(item.registryPath),
            valueName: String(item.valueName),
            valueType: String(item.valueType || 'REG_DWORD'),
            rawValue:
              item.rawValue === null ||
              typeof item.rawValue === 'number' ||
              typeof item.rawValue === 'boolean' ||
              typeof item.rawValue === 'string'
                ? item.rawValue
                : null,
            displayValue: String(item.displayValue || ''),
            expectedDefaultDisplay: String(item.expectedDefaultDisplay || ''),
          }));
      }
      out.rawRegistrySnapshot = {
        hostName: String(snap.rawRegistrySnapshot.hostName || out.hostName),
        ...(snap.rawRegistrySnapshot.targetIp ? { targetIp: String(snap.rawRegistrySnapshot.targetIp) } : {}),
        sourceType: String(snap.rawRegistrySnapshot.sourceType || 'usb_live_capture'),
        sourceLabel: String(snap.rawRegistrySnapshot.sourceLabel || 'USB 호스트 실측 레지스트리'),
        fetchedAt: String(snap.rawRegistrySnapshot.fetchedAt || out.capturedAt),
        ...(snap.rawRegistrySnapshot.remoteRpcNote
          ? { remoteRpcNote: String(snap.rawRegistrySnapshot.remoteRpcNote) }
          : {}),
        entries: cleanEntries,
      };
    }
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

function sanitizePendingHostPolicyTask(task) {
  if (!task || typeof task !== 'object' || !task.targetHostName) return null;
  const modes = Array.isArray(task.modes)
    ? task.modes.map((m) => String(m)).filter(Boolean)
    : [];
  const includeGuestUnlock = Boolean(task.includeGuestUnlock);
  if (modes.length === 0 && !includeGuestUnlock) return null;
  return {
    taskId: String(task.taskId || `task-${Date.now()}`),
    targetHostName: String(task.targetHostName).trim(),
    ...(task.targetIp ? { targetIp: String(task.targetIp).trim() } : {}),
    requestedByHostName: String(task.requestedByHostName || 'CLIENT-PC').trim(),
    ...(task.requestedByIp ? { requestedByIp: String(task.requestedByIp).trim() } : {}),
    modes,
    includeGuestUnlock,
    conflictLabels: Array.isArray(task.conflictLabels)
      ? task.conflictLabels.map((l) => String(l)).filter(Boolean)
      : [],
    ...(task.note ? { note: String(task.note).trim() } : {}),
    createdAt: String(task.createdAt || new Date().toISOString()),
  };
}

function sanitizePendingHostActionsMap(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return undefined;
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(rawMap)) {
    const clean = sanitizePendingHostPolicyTask(v);
    if (clean) {
      out[String(k || clean.targetHostName)] = clean;
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
  const pendingHostActions = sanitizePendingHostActionsMap(doc?.pendingHostActions);
  const out = {
    schemaVersion: 1,
    updatedAt: doc?.updatedAt || nowIso,
    shares: serializedShares,
    ...(hostPolicies ? { hostPolicies } : {}),
    ...(pendingHostActions ? { pendingHostActions } : {}),
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
  const pendingHostActions = sanitizePendingHostActionsMap(diskDoc?.pendingHostActions);
  const runtimeDoc = {
    schemaVersion: 1,
    updatedAt: String(diskDoc?.updatedAt || ''),
    shares,
    ...(hostPolicies ? { hostPolicies } : {}),
    ...(pendingHostActions ? { pendingHostActions } : {}),
  };
  if (diskDoc?.lastClientTarget) {
    runtimeDoc.lastClientTarget = diskDoc.lastClientTarget;
  }
  return runtimeDoc;
}

function atomicWriteJson(filePath, payloadObj) {
  const content = JSON.stringify(payloadObj, null, 2);
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tmpPath = path.join(dir, `.${baseName}.${process.pid}.${Date.now()}.tmp`);
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

const LOCATIONS_DIR_NAME = 'locations';
const LOCATION_FILE_EXT = '.location.json';

function sanitizeLocationId(rawId, fallbackName) {
  const source = String(rawId || fallbackName || '').trim();
  const hash6 = crypto
    .createHash('sha1')
    .update(String(fallbackName || rawId || Date.now()))
    .digest('hex')
    .slice(0, 8);
  const candidate = source
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const hadNonAscii = /[^\x00-\x7F]/.test(source);
  if (!hadNonAscii && candidate && /^[a-z0-9]/.test(candidate)) {
    return candidate;
  }
  return candidate ? `${candidate}-${hash6}` : `loc-${hash6}`;
}

function getLocationFileName(profileId, locationName) {
  return `${sanitizeLocationId(profileId, locationName)}${LOCATION_FILE_EXT}`;
}

function resolveSafeLocationFilePath(baseDir, profileId, locationName) {
  const locDir = path.resolve(baseDir, LOCATIONS_DIR_NAME);
  const fileName = getLocationFileName(profileId, locationName);
  const filePath = path.resolve(locDir, fileName);
  if (!filePath.startsWith(locDir + path.sep)) {
    throw new Error('허용되지 않은 사용장소 파일 경로입니다.');
  }
  return { locDir, fileName, filePath };
}

function prepareLocationClientTargetsForDisk(targets) {
  if (!Array.isArray(targets)) return [];
  const out = [];
  for (const item of targets) {
    if (!item || !item.targetHost || !item.shareName) continue;
    const authMode = item.authMode === 'account' ? 'account' : 'guest';
    const plainUsername = item.username ? String(item.username) : '';
    const plainPassword = item.password ? String(item.password) : '';
    let encryptedCredentials = item.encryptedCredentials;
    if (authMode === 'account' && plainPassword) {
      encryptedCredentials = encryptCredentials({
        username: plainUsername,
        password: plainPassword,
      });
    } else if (authMode !== 'account') {
      encryptedCredentials = undefined;
    }
    out.push({
      targetHost: String(item.targetHost).trim(),
      shareName: String(item.shareName).trim(),
      driveLetter: String(item.driveLetter || 'Z:').trim().replace(/:?$/, ':').toUpperCase(),
      authMode,
      ...(plainUsername ? { username: plainUsername } : {}),
      ...(encryptedCredentials ? { encryptedCredentials } : {}),
      persistent: item.persistent !== false,
    });
  }
  return out;
}

function hydrateLocationClientTargets(rawTargets) {
  if (!Array.isArray(rawTargets)) return [];
  const out = [];
  for (const item of rawTargets) {
    if (!item || !item.targetHost || !item.shareName) continue;
    const authMode = item.authMode === 'account' ? 'account' : 'guest';
    let username = item.username ? String(item.username) : '';
    let password = '';
    if (authMode === 'account') {
      if (item.encryptedCredentials) {
        const dec = decryptCredentials(item.encryptedCredentials);
        if (dec.ok) {
          username = dec.username || username;
          password = dec.password;
        }
      } else if (item.password) {
        password = String(item.password);
      }
    }
    out.push({
      targetHost: String(item.targetHost),
      shareName: String(item.shareName),
      driveLetter: String(item.driveLetter || 'Z:').replace(/:?$/, ':').toUpperCase(),
      authMode,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      ...(item.encryptedCredentials ? { encryptedCredentials: item.encryptedCredentials } : {}),
      persistent: item.persistent !== false,
    });
  }
  return out;
}

function prepareLocationHostPresetForDisk(preset) {
  if (!preset || typeof preset !== 'object') return undefined;
  const authMode = preset.authMode === 'account' ? 'account' : 'guest';
  const plainUsername = preset.username ? String(preset.username) : '';
  const plainPassword = preset.password ? String(preset.password) : '';
  let encryptedCredentials = preset.encryptedCredentials;
  if (authMode === 'account' && plainPassword) {
    encryptedCredentials = encryptCredentials({
      username: plainUsername,
      password: plainPassword,
    });
  } else if (authMode !== 'account') {
    encryptedCredentials = undefined;
  }
  return {
    folderPath: String(preset.folderPath || 'C:\\AhBiShared'),
    shareName: String(preset.shareName || 'AhBiShared'),
    authMode,
    permission: preset.permission === 'read' ? 'read' : 'full',
    username: plainUsername,
    ...(encryptedCredentials ? { encryptedCredentials } : {}),
    ...(typeof preset.ttlMinutes === 'number' ? { ttlMinutes: preset.ttlMinutes } : {}),
    ...(typeof preset.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: preset.autoRevokeOnExpiry } : {}),
  };
}

function hydrateLocationHostPreset(rawPreset) {
  if (!rawPreset || typeof rawPreset !== 'object') return undefined;
  const authMode = rawPreset.authMode === 'account' ? 'account' : 'guest';
  let username = rawPreset.username ? String(rawPreset.username) : '';
  let password = '';
  if (authMode === 'account') {
    if (rawPreset.encryptedCredentials) {
      const dec = decryptCredentials(rawPreset.encryptedCredentials);
      if (dec.ok) {
        username = dec.username || username;
        password = dec.password;
      }
    } else if (rawPreset.password) {
      password = String(rawPreset.password);
    }
  }
  return {
    folderPath: String(rawPreset.folderPath || 'C:\\AhBiShared'),
    shareName: String(rawPreset.shareName || 'AhBiShared'),
    authMode,
    permission: rawPreset.permission === 'read' ? 'read' : 'full',
    username,
    password,
    ...(rawPreset.encryptedCredentials ? { encryptedCredentials: rawPreset.encryptedCredentials } : {}),
    ...(typeof rawPreset.ttlMinutes === 'number' ? { ttlMinutes: rawPreset.ttlMinutes } : {}),
    ...(typeof rawPreset.autoRevokeOnExpiry === 'boolean' ? { autoRevokeOnExpiry: rawPreset.autoRevokeOnExpiry } : {}),
  };
}

function prepareLocationProfileForDisk(rawProfile) {
  const nowIso = new Date().toISOString();
  const locationName = String(rawProfile?.locationName || '이름 없는 장소').trim() || '이름 없는 장소';
  const profileId = sanitizeLocationId(rawProfile?.profileId, locationName);
  const preparedSharesDoc = prepareDiskDocument({
    updatedAt: nowIso,
    shares: Array.isArray(rawProfile?.savedShares) ? rawProfile.savedShares : [],
  });
  const hostPreset = prepareLocationHostPresetForDisk(rawProfile?.hostPreset);
  const clientTargets = prepareLocationClientTargetsForDisk(rawProfile?.clientTargets);
  const netHint = rawProfile?.networkHint && typeof rawProfile.networkHint === 'object'
    ? {
        subnetPrefix: String(rawProfile.networkHint.subnetPrefix || ''),
        primaryIp: String(rawProfile.networkHint.primaryIp || ''),
        hostname: String(rawProfile.networkHint.hostname || ''),
        ...(rawProfile.networkHint.adapterName ? { adapterName: String(rawProfile.networkHint.adapterName) } : {}),
      }
    : { subnetPrefix: '', primaryIp: '', hostname: '' };

  return {
    schemaVersion: 1,
    kind: 'ahbishare-location-profile',
    profileId,
    locationName,
    description: String(rawProfile?.description || '').trim(),
    networkHint: netHint,
    createdAt: String(rawProfile?.createdAt || nowIso),
    updatedAt: nowIso,
    ...(hostPreset ? { hostPreset } : {}),
    savedShares: preparedSharesDoc.shares,
    clientTargets,
    ...(rawProfile?.preferredPatchMode ? { preferredPatchMode: String(rawProfile.preferredPatchMode) } : {}),
  };
}

function hydrateLocationProfile(diskProfile) {
  if (!diskProfile || typeof diskProfile !== 'object') {
    throw new Error('올바르지 않은 사용장소 프로필 형식입니다.');
  }
  const locationName = String(diskProfile.locationName || '').trim();
  if (!locationName) {
    throw new Error('사용장소 이름(locationName)이 누락된 파일입니다.');
  }
  const profileId = sanitizeLocationId(diskProfile.profileId, locationName);
  const hydratedSharesDoc = hydrateRuntimeDocument({
    updatedAt: diskProfile.updatedAt || '',
    shares: Array.isArray(diskProfile.savedShares) ? diskProfile.savedShares : [],
  });
  const hostPreset = hydrateLocationHostPreset(diskProfile.hostPreset);
  const clientTargets = hydrateLocationClientTargets(diskProfile.clientTargets);
  const netHint = diskProfile.networkHint && typeof diskProfile.networkHint === 'object'
    ? {
        subnetPrefix: String(diskProfile.networkHint.subnetPrefix || ''),
        primaryIp: String(diskProfile.networkHint.primaryIp || ''),
        hostname: String(diskProfile.networkHint.hostname || ''),
        ...(diskProfile.networkHint.adapterName ? { adapterName: String(diskProfile.networkHint.adapterName) } : {}),
      }
    : { subnetPrefix: '', primaryIp: '', hostname: '' };

  return {
    schemaVersion: 1,
    profileId,
    locationName,
    description: String(diskProfile.description || ''),
    networkHint: netHint,
    createdAt: String(diskProfile.createdAt || ''),
    updatedAt: String(diskProfile.updatedAt || ''),
    ...(hostPreset ? { hostPreset } : {}),
    savedShares: hydratedSharesDoc.shares,
    clientTargets,
    ...(diskProfile.preferredPatchMode ? { preferredPatchMode: String(diskProfile.preferredPatchMode) } : {}),
  };
}

function toLocationProfileSummary(profile, fileName) {
  return {
    profileId: profile.profileId,
    locationName: profile.locationName,
    description: profile.description || '',
    networkHint: profile.networkHint || { subnetPrefix: '', primaryIp: '', hostname: '' },
    shareCount: Array.isArray(profile.savedShares) ? profile.savedShares.length : 0,
    clientTargetCount: Array.isArray(profile.clientTargets) ? profile.clientTargets.length : 0,
    ...(profile.preferredPatchMode ? { preferredPatchMode: profile.preferredPatchMode } : {}),
    createdAt: profile.createdAt || '',
    updatedAt: profile.updatedAt || '',
    fileName: fileName || getLocationFileName(profile.profileId, profile.locationName),
  };
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

  const listLocationProfiles = () => {
    const loc = getLocation();
    const locDir = path.resolve(loc.directory, LOCATIONS_DIR_NAME);
    const profiles = [];
    if (fs.existsSync(locDir)) {
      try {
        for (const entry of fs.readdirSync(locDir)) {
          if (!entry.toLowerCase().endsWith(LOCATION_FILE_EXT)) continue;
          const fullPath = path.resolve(locDir, entry);
          if (!fullPath.startsWith(locDir + path.sep)) continue;
          try {
            const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
            const parsed = JSON.parse(raw);
            const hydrated = hydrateLocationProfile(parsed);
            profiles.push(toLocationProfileSummary(hydrated, entry));
          } catch {}
        }
      } catch {}
    }
    profiles.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return {
      success: true,
      directory: locDir,
      writable: loc.writable,
      profiles,
    };
  };

  const saveLocationProfile = (rawProfile) => {
    const loc = getLocation();
    const diskProfile = prepareLocationProfileForDisk(rawProfile);
    const { locDir, fileName, filePath } = resolveSafeLocationFilePath(
      loc.directory,
      diskProfile.profileId,
      diskProfile.locationName
    );
    try {
      fs.mkdirSync(locDir, { recursive: true });
    } catch (err) {
      return {
        success: false,
        error: `사용장소 보관 폴더 생성 실패: ${err && err.message ? err.message : '권한 없음'}`,
      };
    }
    const writeRes = atomicWriteJson(filePath, diskProfile);
    if (!writeRes.success) {
      return {
        success: false,
        error: writeRes.error || '사용장소 프로필 저장에 실패했습니다.',
      };
    }
    const hydrated = hydrateLocationProfile(diskProfile);
    return {
      success: true,
      profile: hydrated,
      summary: toLocationProfileSummary(hydrated, fileName),
      filePath,
    };
  };

  const findLocationFileByProfileId = (directory, profileId) => {
    const { locDir, filePath: exactPath } = resolveSafeLocationFilePath(directory, profileId, profileId);
    if (fs.existsSync(exactPath)) {
      return exactPath;
    }
    const targetRaw = String(profileId || '').trim();
    const targetSanitized = sanitizeLocationId(targetRaw, '');
    if (fs.existsSync(locDir)) {
      try {
        for (const entry of fs.readdirSync(locDir)) {
          if (!entry.toLowerCase().endsWith(LOCATION_FILE_EXT)) continue;
          const candidatePath = path.resolve(locDir, entry);
          if (!candidatePath.startsWith(locDir + path.sep)) continue;
          try {
            const raw = fs.readFileSync(candidatePath, 'utf8').replace(/^\uFEFF/, '');
            const parsed = JSON.parse(raw);
            const hydrated = hydrateLocationProfile(parsed);
            if (
              hydrated.profileId === targetRaw ||
              (targetSanitized && sanitizeLocationId(hydrated.profileId, '') === targetSanitized)
            ) {
              return candidatePath;
            }
          } catch {}
        }
      } catch {}
    }
    return '';
  };

  const loadLocationProfile = (profileId) => {
    const loc = getLocation();
    const filePath = findLocationFileByProfileId(loc.directory, profileId);
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: '해당 사용장소 프로필 파일을 찾을 수 없습니다.' };
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      const hydrated = hydrateLocationProfile(parsed);
      return { success: true, profile: hydrated, filePath };
    } catch (err) {
      return {
        success: false,
        error: `사용장소 프로필 읽기 실패: ${err && err.message ? err.message : '파일 손상'}`,
      };
    }
  };

  const deleteLocationProfile = (profileId) => {
    const loc = getLocation();
    const filePath = findLocationFileByProfileId(loc.directory, profileId);
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: '삭제할 사용장소 파일이 존재하지 않습니다.' };
    }
    try {
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `사용장소 파일 삭제 실패: ${err && err.message ? err.message : '권한 오류'}`,
      };
    }
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
    listLocationProfiles,
    saveLocationProfile,
    loadLocationProfile,
    deleteLocationProfile,
  };
}

module.exports = {
  PORTABLE_FILE_NAME,
  LOCATIONS_DIR_NAME,
  LOCATION_FILE_EXT,
  sanitizeLocationId,
  encryptCredentials,
  decryptCredentials,
  resolvePortableLocation,
  prepareDiskDocument,
  hydrateRuntimeDocument,
  prepareLocationProfileForDisk,
  hydrateLocationProfile,
  toLocationProfileSummary,
  atomicWriteJson,
  createPortableStore,
};
