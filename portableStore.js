const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pickLocaleText } = require('./localeHelper');

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
    if (iv.length !== 12 || tag.length !== 16) {
      return { ok: false, username: '', password: '' };
    }
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

function resolveEncryptedCredentialsForDisk(authMode, plainUsername, plainPassword, existingEnc) {
  if (authMode !== 'account') {
    return undefined;
  }
  if (plainPassword) {
    return encryptCredentials({
      username: plainUsername,
      password: plainPassword,
    });
  }
  if (existingEnc) {
    const dec = decryptCredentials(existingEnc);
    if (dec.ok && dec.password && plainUsername && plainUsername !== dec.username) {
      return encryptCredentials({
        username: plainUsername,
        password: dec.password,
      });
    }
    return existingEnc;
  }
  return undefined;
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

function classifyUsbWriteError(err, contextLabel = '', locale = 'ko') {
  const effectiveContext = contextLabel || pickLocaleText(locale, 'USB 파일 쓰기', 'USB file write');
  const code = String(err?.code || '').toUpperCase();
  const rawMsg = String(err?.message || '');
  const lowerMsg = rawMsg.toLowerCase();

  if (code === 'EROFS' || lowerMsg.includes('read-only file system')) {
    return {
      code: code || 'EROFS',
      writeProtected: true,
      message: pickLocaleText(
        locale,
        'USB 또는 저장 장치가 쓰기 금지(읽기 전용) 상태입니다. USB 물리 쓰기 금지 스위치 또는 Windows 쓰기 금지(WriteProtect) 정책을 확인하세요.',
        'The USB drive or storage device is write-protected (read-only). Check the physical write-protect switch or Windows WriteProtect policy.'
      ),
    };
  }
  if (code === 'EPERM' || code === 'EACCES') {
    return {
      code,
      writeProtected: true,
      message: pickLocaleText(
        locale,
        'USB 폴더 쓰기 권한이 차단되었거나 쓰기 금지(읽기 전용·보안 프로그램 차단) 상태입니다. 쓰기 금지 해제 또는 다른 폴더를 선택하세요.',
        'Write access to the USB folder is blocked or read-only (security software or policy). Remove write protection or choose another folder.'
      ),
    };
  }
  if (code === 'ENOSPC') {
    return {
      code,
      writeProtected: false,
      message: pickLocaleText(
        locale,
        'USB 저장 공간(디스크 용량)이 부족하여 안전하게 기록할 수 없습니다. 여유 공간을 확보한 뒤 다시 시도하세요.',
        'Insufficient disk space on the USB drive. Free up space and try again.'
      ),
    };
  }
  if (code === 'EBUSY' || code === 'EMFILE' || code === 'ENFILE') {
    return {
      code,
      writeProtected: false,
      message: pickLocaleText(
        locale,
        'USB 파일이 다른 프로그램이나 백신에 의해 사용 중(잠금)입니다. 잠시 후 다시 시도하세요.',
        'The USB file is locked or in use by another program or antivirus. Try again shortly.'
      ),
    };
  }
  if (code === 'EIO') {
    return {
      code,
      writeProtected: false,
      message: pickLocaleText(
        locale,
        'USB 입출력(I/O) 오류가 발생했습니다. USB 연결 상태를 확인한 뒤 다시 시도하세요.',
        'A USB I/O error occurred. Check the USB connection and try again.'
      ),
    };
  }
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return {
      code,
      writeProtected: false,
      message: pickLocaleText(
        locale,
        '대상 USB 폴더 경로를 찾을 수 없습니다. 장치 연결 상태를 확인하세요.',
        'Target USB folder path not found. Check the device connection.'
      ),
    };
  }
  return {
    code: code || 'UNKNOWN',
    writeProtected: false,
    message: rawMsg
      ? pickLocaleText(locale, `${effectiveContext} 실패: ${rawMsg}`, `${effectiveContext} failed: ${rawMsg}`)
      : pickLocaleText(locale, `${effectiveContext}에 실패했습니다.`, `${effectiveContext} failed.`),
  };
}

function probeDirectoryWriteSafety(dirPath, locale = 'ko') {
  if (!dirPath) {
    return {
      writable: false,
      writeProtected: false,
      errorCode: 'ENOENT',
      writeError: pickLocaleText(locale, '대상 폴더 경로가 비어 있습니다.', 'Target folder path is empty.'),
    };
  }

  let probePath = '';
  try {
    const dirStat = fs.statSync(dirPath);
    if (!dirStat.isDirectory()) {
      return {
        writable: false,
        writeProtected: false,
        errorCode: 'ENOTDIR',
        writeError: pickLocaleText(locale, '대상 경로가 유효한 폴더가 아닙니다.', 'Target path is not a valid folder.'),
      };
    }

    fs.accessSync(dirPath, fs.constants.W_OK);

    // Non-destructive atomic file create+unlink probe:
    // Windows FAT32/exFAT/NTFS drives with hardware/policy WriteProtect often pass accessSync(W_OK),
    // so opening an exclusive 0-byte temp file reliably detects real hardware/filter write locks
    // without touching any registry keys or modifying USB attributes.
    tmpWriteSequence = (tmpWriteSequence + 1) % 1000000;
    const nonce = crypto.randomBytes(4).toString('hex');
    probePath = path.join(dirPath, `.ahbishare-write-probe-${process.pid}-${Date.now()}-${tmpWriteSequence}-${nonce}.tmp`);
    const probeFd = fs.openSync(probePath, 'wx', 0o600);
    try {
      fs.closeSync(probeFd);
    } finally {
      try {
        if (fs.existsSync(probePath)) fs.unlinkSync(probePath);
      } catch {}
    }

    return { writable: true, writeProtected: false };
  } catch (err) {
    try {
      if (probePath && fs.existsSync(probePath)) fs.unlinkSync(probePath);
    } catch {}
    const classified = classifyUsbWriteError(err, pickLocaleText(locale, 'USB 쓰기 안전 점검', 'USB write safety probe'), locale);
    return {
      writable: false,
      writeProtected: classified.writeProtected,
      errorCode: classified.code,
      writeError: classified.message,
    };
  }
}

function checkDirectoryWritable(dirPath, locale = 'ko') {
  return probeDirectoryWriteSafety(dirPath, locale);
}

function resolvePortableLocation({ env = process.env, app = null, baseDir = __dirname, locale = 'ko' } = {}) {
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
  const writeCheck = checkDirectoryWritable(directory, locale);

  return {
    supported: true,
    mode,
    directory,
    fileName: PORTABLE_FILE_NAME,
    filePath,
    writable: writeCheck.writable,
    writeProtected: Boolean(writeCheck.writeProtected),
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

function sanitizeHostPolicySnapshot(snap, locale = 'ko') {
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
        sourceLabel: String(
          snap.rawRegistrySnapshot.sourceLabel ||
            pickLocaleText(locale, 'USB 호스트 실측 레지스트리', 'USB Host Live Registry')
        ),
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

function sanitizeHostPoliciesMap(rawMap, locale = 'ko') {
  if (!rawMap || typeof rawMap !== 'object') return undefined;
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(rawMap)) {
    const clean = sanitizeHostPolicySnapshot(v, locale);
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

const VALID_TICKET_STATUSES = new Set(['open', 'host_fixed', 'client_fixed', 'resolved']);
const VALID_STEP_STATUSES = new Set(['pending', 'completed', 'skipped', 'failed']);
const VALID_RECOMMENDED_SIDES = new Set(['host', 'client', 'both']);

function stripSensitiveCredentialText(rawText, maxLength = 500) {
  if (rawText === undefined || rawText === null) return '';
  let text = String(rawText).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  text = text
    .replace(/ABSHARE:\/\/[A-Za-z0-9+/=_-]+/gi, 'ABSHARE://[REDACTED]')
    .replace(/(cmdkey(?:\.exe)?\s+\/add:\S+\s+\/user:\S+\s+\/pass:)\S+/gi, '$1[REDACTED]')
    .replace(/(\/pass(?:word)?\s*:\s*)\S+/gi, '$1[REDACTED]')
    .replace(/(\/user(?:name)?\s*:\s*\S+\s+)([^\s\/"']+|"[^"]*"|'[^']*')/gi, '$1[REDACTED]')
    .replace(/(ConvertTo-SecureString\s+)(?:-String\s+)?(['"])[^'"]*\2/gi, "$1'[REDACTED]'")
    .replace(/\b(password|passwd|pwd|pw|암호|비밀번호)\s*([:=])\s*(?!\[REDACTED\])(['"]?)[^\s,;'"|\)]+\3/gi, '$1$2[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLength > 0 && text.length > maxLength) {
    text = text.slice(0, maxLength - 3).trimEnd() + '...';
  }
  return text;
}

function sanitizeTroubleshootWizardSteps(rawSteps, defaultSide) {
  if (!Array.isArray(rawSteps)) return [];
  const clean = [];
  for (let i = 0; i < rawSteps.length && clean.length < 16; i++) {
    const s = rawSteps[i];
    if (!s || typeof s !== 'object' || !s.title) continue;
    const side = s.side === 'host' || s.side === 'client' ? s.side : defaultSide;
    const status = VALID_STEP_STATUSES.has(s.status) ? s.status : 'pending';
    const commandPreview = s.commandPreview ? stripSensitiveCredentialText(s.commandPreview, 600) : '';
    const lastMessage = s.lastMessage ? stripSensitiveCredentialText(s.lastMessage, 320) : '';
    clean.push({
      stepId: String(s.stepId || `${side}-step-${i + 1}`),
      side,
      order: Number.isFinite(Number(s.order)) && Number(s.order) > 0 ? Math.floor(Number(s.order)) : clean.length + 1,
      title: String(s.title).slice(0, 160),
      description: stripSensitiveCredentialText(s.description || '', 420),
      ...(commandPreview ? { commandPreview } : {}),
      executor: String(s.executor || 'manual_check'),
      ...(s.patchMode ? { patchMode: String(s.patchMode) } : {}),
      status,
      ...(s.lastAttemptAt ? { lastAttemptAt: String(s.lastAttemptAt) } : {}),
      ...(lastMessage ? { lastMessage } : {}),
    });
  }
  return clean;
}

function sanitizeTroubleshootTickets(rawList, locale = 'ko') {
  if (!Array.isArray(rawList)) return undefined;
  const out = [];
  const seenIds = new Set();
  for (const item of rawList) {
    if (!item || typeof item !== 'object' || !item.ticketId) continue;
    const ticketId = String(item.ticketId).trim();
    if (!ticketId || seenIds.has(ticketId)) continue;
    seenIds.add(ticketId);
    const originRole = item.originRole === 'host' ? 'host' : 'client';
    const authMode = item.authMode === 'account' ? 'account' : 'guest';
    const recommendedSide = VALID_RECOMMENDED_SIDES.has(item.recommendedSide) ? item.recommendedSide : 'both';
    const status = VALID_TICKET_STATUSES.has(item.status) ? item.status : 'open';
    const nowIso = new Date().toISOString();
    out.push({
      ticketId,
      schemaVersion: 1,
      originRole,
      originHostName: String(item.originHostName || '').trim(),
      originIp: String(item.originIp || '').trim(),
      targetHostName: String(item.targetHostName || '').trim(),
      targetIp: String(item.targetIp || '').trim(),
      shareName: String(item.shareName || 'AhBiShared').trim(),
      ...(item.folderPath ? { folderPath: String(item.folderPath).trim() } : {}),
      ...(item.driveLetter ? { driveLetter: String(item.driveLetter).trim() } : {}),
      authMode,
      ...(typeof item.isLegacyOs === 'boolean' ? { isLegacyOs: item.isLegacyOs } : {}),
      errorCode: String(item.errorCode || 'Mount Diagnostic').trim().slice(0, 64),
      errorTitle: stripSensitiveCredentialText(
        item.errorTitle || pickLocaleText(locale, '연결/공유 오류', 'Connection/Share Error'),
        180
      ),
      rawErrorSummary: stripSensitiveCredentialText(item.rawErrorSummary || '', 500),
      recommendedSide,
      hostSteps: sanitizeTroubleshootWizardSteps(item.hostSteps, 'host'),
      clientSteps: sanitizeTroubleshootWizardSteps(item.clientSteps, 'client'),
      status,
      createdAt: String(item.createdAt || nowIso),
      updatedAt: String(item.updatedAt || item.createdAt || nowIso),
      ...(item.resolvedAt ? { resolvedAt: String(item.resolvedAt) } : {}),
      ...(item.resolvedByHostName ? { resolvedByHostName: String(item.resolvedByHostName).trim() } : {}),
    });
    if (out.length >= 30) break;
  }
  return out.length > 0 ? out : undefined;
}

function prepareDiskDocument(doc, locale = 'ko') {
  const nowIso = new Date().toISOString();
  const inputShares = Array.isArray(doc?.shares) ? doc.shares : [];
  const serializedShares = [];

  for (const item of inputShares) {
    if (!item || !item.shareName) continue;
    const authMode = item.authMode === 'account' ? 'account' : 'guest';
    const tokenDecoded = decodeTokenPayload(item.connectionCode);
    const plainUsername = item.username || tokenDecoded?.username || '';
    const plainPassword = item.password || item.restoredPassword || tokenDecoded?.password || '';

    const encryptedCredentials = resolveEncryptedCredentialsForDisk(
      authMode,
      plainUsername,
      plainPassword,
      item.encryptedCredentials
    );

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

  const hostPolicies = sanitizeHostPoliciesMap(doc?.hostPolicies, locale);
  const pendingHostActions = sanitizePendingHostActionsMap(doc?.pendingHostActions);
  const troubleshootTickets = sanitizeTroubleshootTickets(doc?.troubleshootTickets, locale);
  const out = {
    schemaVersion: 1,
    updatedAt: doc?.updatedAt || nowIso,
    shares: serializedShares,
    ...(hostPolicies ? { hostPolicies } : {}),
    ...(pendingHostActions ? { pendingHostActions } : {}),
    ...(troubleshootTickets ? { troubleshootTickets } : {}),
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

function hydrateRuntimeDocument(diskDoc, locale = 'ko') {
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
          username = username || dec.username;
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

  const hostPolicies = sanitizeHostPoliciesMap(diskDoc?.hostPolicies, locale);
  const pendingHostActions = sanitizePendingHostActionsMap(diskDoc?.pendingHostActions);
  const troubleshootTickets = sanitizeTroubleshootTickets(diskDoc?.troubleshootTickets, locale);
  const runtimeDoc = {
    schemaVersion: 1,
    updatedAt: String(diskDoc?.updatedAt || ''),
    shares,
    ...(hostPolicies ? { hostPolicies } : {}),
    ...(pendingHostActions ? { pendingHostActions } : {}),
    ...(troubleshootTickets ? { troubleshootTickets } : {}),
  };
  if (diskDoc?.lastClientTarget) {
    runtimeDoc.lastClientTarget = diskDoc.lastClientTarget;
  }
  return runtimeDoc;
}

let tmpWriteSequence = 0;

function sleepSyncMs(ms) {
  const duration = Math.max(1, Math.min(200, Number(ms) || 1));
  try {
    const sab = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(sab), 0, 0, duration);
  } catch {
    const end = Date.now() + duration;
    while (Date.now() < end) {
      // fallback wait only if SharedArrayBuffer is unavailable
    }
  }
}

function isTransientWinLockError(err) {
  const code = err && err.code;
  return code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
}

function withFileLockSync(lockPath, fn, locale = 'ko') {
  const maxWaitMs = 400;
  const retryDelayMs = 10;
  const staleThresholdMs = 10000;
  const start = Date.now();
  let lockFd = null;
  let staleCleared = false;

  while (true) {
    try {
      lockFd = fs.openSync(lockPath, 'wx', 0o600);
      try {
        fs.writeSync(lockFd, `${process.pid}:${Date.now()}`);
      } catch {}
      break;
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        if (!staleCleared) {
          try {
            const st = fs.statSync(lockPath);
            if (Date.now() - st.mtimeMs > staleThresholdMs) {
              fs.unlinkSync(lockPath);
              staleCleared = true;
              continue;
            }
          } catch {}
        }
        if (Date.now() - start >= maxWaitMs) {
          return {
            __lockTimeout: true,
            success: false,
            error: pickLocaleText(
              locale,
              '다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도하세요.',
              'Another save operation is in progress. Please try again shortly.'
            ),
          };
        }
        sleepSyncMs(retryDelayMs);
        continue;
      }
      // Directory read-only / inaccessible: run fn() without holding a lock so normal error reporting runs cleanly
      return fn();
    }
  }

  try {
    return fn();
  } finally {
    try {
      if (lockFd !== null) fs.closeSync(lockFd);
    } catch {}
    try {
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    } catch {}
  }
}

function fsyncDirectoryBestEffort(dirPath) {
  try {
    const dirFd = fs.openSync(dirPath, 'r');
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }
  } catch {
    // Windows NTFS/exFAT does not allow opening a directory fd for fsync
  }
}

function writeBufferFsyncSync(targetPath, buf, flags = 'wx', locale = 'ko') {
  const fd = fs.openSync(targetPath, flags, 0o600);
  try {
    let offset = 0;
    while (offset < buf.length) {
      const written = fs.writeSync(fd, buf, offset, buf.length - offset);
      if (written <= 0) {
        throw new Error(
          pickLocaleText(locale, '파일 바이트 기록이 완료되지 않았습니다.', 'File byte write did not complete.')
        );
      }
      offset += written;
    }
    fs.fsyncSync(fd);
    const stat = fs.fstatSync(fd);
    if (stat.size !== buf.length) {
      throw new Error(
        pickLocaleText(
          locale,
          `임시 파일 크기 불일치 (${stat.size} !== ${buf.length})`,
          `Temporary file size mismatch (${stat.size} !== ${buf.length})`
        )
      );
    }
  } finally {
    fs.closeSync(fd);
  }
}

function renameWithRetrySync(srcPath, destPath) {
  const delays = [0, 8, 16, 28];
  let lastErr;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) sleepSyncMs(delays[i]);
    try {
      fs.renameSync(srcPath, destPath);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientWinLockError(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

function readUtf8WithRetrySync(filePath) {
  const delays = [0, 12, 28];
  let lastErr;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) sleepSyncMs(delays[i]);
    try {
      return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    } catch (err) {
      lastErr = err;
      if (!isTransientWinLockError(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

function atomicWriteBuffer(filePath, rawBuf, locale = 'ko') {
  const buf = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(String(rawBuf || ''), 'utf8');
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath);
  tmpWriteSequence = (tmpWriteSequence + 1) % 1000000;
  const nonce = crypto.randomBytes(4).toString('hex');
  const tmpPath = path.join(dir, `.${baseName}.${process.pid}.${Date.now()}.${tmpWriteSequence}.${nonce}.tmp`);

  try {
    writeBufferFsyncSync(tmpPath, buf, 'wx', locale);
    try {
      renameWithRetrySync(tmpPath, filePath);
    } catch (renameErr) {
      if (renameErr && renameErr.code === 'EXDEV') {
        // Rare cross-device fallback with rollback backup instead of bare truncate
        const hadExisting = fs.existsSync(filePath);
        const backupPath = `${tmpPath}.bak`;
        if (hadExisting) {
          fs.copyFileSync(filePath, backupPath);
        }
        try {
          writeBufferFsyncSync(filePath, buf, 'w', locale);
        } catch (fallbackErr) {
          if (hadExisting && fs.existsSync(backupPath)) {
            try {
              fs.copyFileSync(backupPath, filePath);
            } catch {}
          }
          throw fallbackErr;
        } finally {
          try {
            if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
          } catch {}
        }
      } else {
        throw renameErr;
      }
    }
    fsyncDirectoryBestEffort(dir);
    const committedStat = fs.statSync(filePath);
    if (committedStat.size !== buf.length) {
      throw new Error(`File size verification mismatch (${committedStat.size} !== ${buf.length})`);
    }
    return { success: true, writeProtected: false };
  } catch (err) {
    const classified = classifyUsbWriteError(err, pickLocaleText(locale, 'USB 파일 쓰기', 'USB file write'), locale);
    return {
      success: false,
      writeProtected: classified.writeProtected,
      errorCode: classified.code,
      error: classified.message,
    };
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
  }
}

function atomicWriteJson(filePath, payloadObj, locale = 'ko') {
  const content = JSON.stringify(payloadObj, null, 2);
  return atomicWriteBuffer(filePath, Buffer.from(content, 'utf8'), locale);
}

const LOCATIONS_DIR_NAME = 'locations';
const LOCATION_FILE_EXT = '.location.json';
const BACKUP_DIR_NAME = 'backup';
const BACKUP_FILE_EXT = '.backup.json';
const BACKUP_MAX_SNAPSHOTS = 20;

function resolveSafeBackupDir(baseDir) {
  return path.resolve(baseDir, BACKUP_DIR_NAME);
}

function resolveSafeBackupFilePath(baseDir, fileName, locale = 'ko') {
  const backupDir = resolveSafeBackupDir(baseDir);
  const rawName = String(fileName || '').trim();
  if (
    !rawName ||
    rawName !== path.basename(rawName) ||
    rawName.includes('..') ||
    !rawName.toLowerCase().endsWith(BACKUP_FILE_EXT) ||
    /[\0\r\n/\\]/.test(rawName)
  ) {
    throw new Error(pickLocaleText(locale, '허용되지 않은 백업 파일 이름입니다.', 'Invalid backup file name.'));
  }
  const filePath = path.resolve(backupDir, rawName);
  if (!filePath.startsWith(backupDir + path.sep)) {
    throw new Error(pickLocaleText(locale, '허용되지 않은 백업 파일 경로입니다.', 'Disallowed backup file path.'));
  }
  return { backupDir, fileName: rawName, filePath };
}

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

function resolveSafeLocationFilePath(baseDir, profileId, locationName, locale = 'ko') {
  const locDir = path.resolve(baseDir, LOCATIONS_DIR_NAME);
  const fileName = getLocationFileName(profileId, locationName);
  const filePath = path.resolve(locDir, fileName);
  if (!filePath.startsWith(locDir + path.sep)) {
    throw new Error(pickLocaleText(locale, '허용되지 않은 사용장소 파일 경로입니다.', 'Disallowed location profile file path.'));
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
    const encryptedCredentials = resolveEncryptedCredentialsForDisk(
      authMode,
      plainUsername,
      plainPassword,
      item.encryptedCredentials
    );
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
    let decryptionFailed = false;
    if (authMode === 'account') {
      if (item.encryptedCredentials) {
        const dec = decryptCredentials(item.encryptedCredentials);
        if (dec.ok) {
          username = username || dec.username;
          password = dec.password;
        } else {
          decryptionFailed = true;
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
      ...(decryptionFailed ? { decryptionFailed: true } : {}),
    });
  }
  return out;
}

function prepareLocationHostPresetForDisk(preset) {
  if (!preset || typeof preset !== 'object') return undefined;
  const authMode = preset.authMode === 'account' ? 'account' : 'guest';
  const plainUsername = preset.username ? String(preset.username) : '';
  const plainPassword = preset.password ? String(preset.password) : '';
  const encryptedCredentials = resolveEncryptedCredentialsForDisk(
    authMode,
    plainUsername,
    plainPassword,
    preset.encryptedCredentials
  );
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
  let decryptionFailed = false;
  if (authMode === 'account') {
    if (rawPreset.encryptedCredentials) {
      const dec = decryptCredentials(rawPreset.encryptedCredentials);
      if (dec.ok) {
        username = username || dec.username;
        password = dec.password;
      } else {
        decryptionFailed = true;
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
    ...(decryptionFailed ? { decryptionFailed: true } : {}),
  };
}

function prepareLocationProfileForDisk(rawProfile, locale = 'ko') {
  const nowIso = new Date().toISOString();
  const defaultLocName = pickLocaleText(locale, '이름 없는 장소', 'Untitled Location');
  const locationName = String(rawProfile?.locationName || defaultLocName).trim() || defaultLocName;
  const profileId = sanitizeLocationId(rawProfile?.profileId, locationName);
  const preparedSharesDoc = prepareDiskDocument({
    updatedAt: nowIso,
    shares: Array.isArray(rawProfile?.savedShares) ? rawProfile.savedShares : [],
  }, locale);
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

function hydrateLocationProfile(diskProfile, locale = 'ko') {
  if (!diskProfile || typeof diskProfile !== 'object') {
    throw new Error(
      pickLocaleText(locale, '올바르지 않은 사용장소 프로필 형식입니다.', 'Invalid location profile format.')
    );
  }
  const locationName = String(diskProfile.locationName || '').trim();
  if (!locationName) {
    throw new Error(
      pickLocaleText(locale, '사용장소 이름(locationName)이 누락된 파일입니다.', 'Missing locationName in location profile file.')
    );
  }
  const profileId = sanitizeLocationId(diskProfile.profileId, locationName);
  const hydratedSharesDoc = hydrateRuntimeDocument({
    updatedAt: diskProfile.updatedAt || '',
    shares: Array.isArray(diskProfile.savedShares) ? diskProfile.savedShares : [],
  }, locale);
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
  const getLocale = () => (typeof options.getLocale === 'function' ? options.getLocale() : options.locale || 'ko');
  const locText = (ko, en) => pickLocaleText(getLocale(), ko, en);
  const getLocation = () => resolvePortableLocation({ ...options, locale: getLocale() });

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

    let raw;
    try {
      raw = readUtf8WithRetrySync(loc.filePath);
    } catch (readErr) {
      const classified = classifyUsbWriteError(readErr, locText('USB 포터블 데이터 읽기', 'USB portable data read'), getLocale());
      return {
        success: false,
        document: emptyDocument(),
        status: {
          ...loc,
          hasExistingFile: fs.existsSync(loc.filePath),
          writeProtected: Boolean(loc.writeProtected || classified.writeProtected),
          writeError: classified.message,
        },
      };
    }

    try {
      const parsed = JSON.parse(raw);
      const doc = hydrateRuntimeDocument(parsed, getLocale());
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
      if (!loc.writeProtected) {
        try {
          backupPath = path.join(loc.directory, `AhBiShare_OneClick.portable.corrupt-${Date.now()}.json`);
          fs.renameSync(loc.filePath, backupPath);
        } catch {
          backupPath = undefined;
        }
      }
      return {
        success: false,
        document: emptyDocument(),
        status: {
          ...loc,
          hasExistingFile: fs.existsSync(loc.filePath),
          corruptedRecovered: true,
          ...(backupPath ? { corruptedBackupPath: backupPath } : {}),
        },
      };
    }
  };

  const savePortableData = (doc) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const lockPath = path.join(loc.directory, `.${PORTABLE_FILE_NAME}.lock`);
    const diskDoc = prepareDiskDocument(doc, activeLocale);
    return withFileLockSync(lockPath, () => {
      const writeRes = atomicWriteJson(loc.filePath, diskDoc, activeLocale);
      if (!writeRes.success) {
        const hydratedFallback = hydrateRuntimeDocument(diskDoc, activeLocale);
        return {
          success: false,
          document: hydratedFallback,
          status: {
            ...loc,
            writable: false,
            writeProtected: Boolean(writeRes.writeProtected || loc.writeProtected),
            hasExistingFile: fs.existsSync(loc.filePath),
            writeError: writeRes.error,
          },
        };
      }

      let committedDoc;
      try {
        const verifiedRaw = fs.readFileSync(loc.filePath, 'utf8').replace(/^\uFEFF/, '');
        committedDoc = hydrateRuntimeDocument(JSON.parse(verifiedRaw), activeLocale);
      } catch (verifyErr) {
        const hydratedFallback = hydrateRuntimeDocument(diskDoc, activeLocale);
        return {
          success: false,
          document: hydratedFallback,
          status: {
            ...loc,
            writable: false,
            hasExistingFile: fs.existsSync(loc.filePath),
            writeError: locText(
              `저장 후 무결성 검증 실패: ${verifyErr && verifyErr.message ? verifyErr.message : 'JSON 파싱 오류'}`,
              `Post-save integrity check failed: ${verifyErr && verifyErr.message ? verifyErr.message : 'JSON parse error'}`
            ),
          },
        };
      }

      return {
        success: true,
        document: committedDoc,
        status: {
          ...loc,
          writable: true,
          hasExistingFile: true,
          lastSyncedAt: diskDoc.updatedAt,
        },
      };
    }, activeLocale);
  };

  const listLocationProfiles = () => {
    const activeLocale = getLocale();
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
            const hydrated = hydrateLocationProfile(parsed, activeLocale);
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

  const findAllLocationFilesByProfileId = (directory, profileId) => {
    const activeLocale = getLocale();
    const { locDir, filePath: exactPath } = resolveSafeLocationFilePath(directory, profileId, profileId, activeLocale);
    const matches = [];
    if (fs.existsSync(exactPath)) {
      matches.push(exactPath);
    }
    const targetRaw = String(profileId || '').trim();
    const targetSanitized = sanitizeLocationId(targetRaw, '');
    if (fs.existsSync(locDir)) {
      try {
        for (const entry of fs.readdirSync(locDir)) {
          if (!entry.toLowerCase().endsWith(LOCATION_FILE_EXT)) continue;
          const candidatePath = path.resolve(locDir, entry);
          if (!candidatePath.startsWith(locDir + path.sep)) continue;
          if (candidatePath === exactPath) continue;
          try {
            const raw = fs.readFileSync(candidatePath, 'utf8').replace(/^\uFEFF/, '');
            const parsed = JSON.parse(raw);
            const hydrated = hydrateLocationProfile(parsed, activeLocale);
            if (
              hydrated.profileId === targetRaw ||
              (targetSanitized && sanitizeLocationId(hydrated.profileId, '') === targetSanitized)
            ) {
              matches.push(candidatePath);
            }
          } catch {}
        }
      } catch {}
    }
    return matches;
  };

  const findLocationFileByProfileId = (directory, profileId) => {
    const matches = findAllLocationFilesByProfileId(directory, profileId);
    return matches[0] || '';
  };

  const saveLocationProfile = (rawProfile) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const diskProfile = prepareLocationProfileForDisk(rawProfile, activeLocale);
    const { locDir, fileName, filePath } = resolveSafeLocationFilePath(
      loc.directory,
      diskProfile.profileId,
      diskProfile.locationName,
      activeLocale
    );
    try {
      fs.mkdirSync(locDir, { recursive: true });
    } catch (err) {
      const classified = classifyUsbWriteError(
        err,
        locText('사용장소 보관 폴더 생성', 'Create location storage folder'),
        activeLocale
      );
      return {
        success: false,
        writeProtected: classified.writeProtected,
        error: classified.message,
      };
    }

    // Automatically back up existing catalog state before overwriting an existing location profile
    try {
      const existingMatches = findAllLocationFilesByProfileId(loc.directory, diskProfile.profileId);
      if (existingMatches.length > 0 && loc.writable) {
        createBackupSnapshot({
          trigger: 'auto_before_modify',
          reason: locText(
            `사용장소 '${diskProfile.locationName}' 수정 직전 자동 백업`,
            `Auto backup before editing location '${diskProfile.locationName}'`
          ),
        });
      }
    } catch {}

    const lockPath = path.join(locDir, '.locations.lock');
    return withFileLockSync(lockPath, () => {
      const staleAliasFiles = findAllLocationFilesByProfileId(loc.directory, diskProfile.profileId).filter(
        (candidate) => path.resolve(candidate) !== path.resolve(filePath)
      );

      const writeRes = atomicWriteJson(filePath, diskProfile, activeLocale);
      if (!writeRes.success) {
        return {
          success: false,
          error:
            writeRes.error ||
            locText('사용장소 프로필 저장에 실패했습니다.', 'Failed to save location profile.'),
        };
      }

      let verifiedProfile;
      try {
        const verifiedRaw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
        verifiedProfile = hydrateLocationProfile(JSON.parse(verifiedRaw), activeLocale);
      } catch (verifyErr) {
        return {
          success: false,
          error: locText(
            `사용장소 프로필 저장 후 무결성 검증 실패: ${verifyErr && verifyErr.message ? verifyErr.message : '파일 검증 오류'}`,
            `Location profile post-save integrity verification failed: ${verifyErr && verifyErr.message ? verifyErr.message : 'Verification error'}`
          ),
        };
      }

      // Clean up legacy/renamed duplicates only after canonical file write and readback verification succeed
      for (const aliasPath of staleAliasFiles) {
        try {
          if (fs.existsSync(aliasPath)) fs.unlinkSync(aliasPath);
        } catch {}
      }

      return {
        success: true,
        profile: verifiedProfile,
        summary: toLocationProfileSummary(verifiedProfile, fileName),
        filePath,
      };
    }, activeLocale);
  };

  const loadLocationProfile = (profileId) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const filePath = findLocationFileByProfileId(loc.directory, profileId);
    if (!filePath || !fs.existsSync(filePath)) {
      return {
        success: false,
        error: locText('해당 사용장소 프로필 파일을 찾을 수 없습니다.', 'Location profile file not found.'),
      };
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw);
      const hydrated = hydrateLocationProfile(parsed, activeLocale);
      return { success: true, profile: hydrated, filePath };
    } catch (err) {
      return {
        success: false,
        error: locText(
          `사용장소 프로필 읽기 실패: ${err && err.message ? err.message : '파일 손상'}`,
          `Failed to read location profile: ${err && err.message ? err.message : 'File corrupted'}`
        ),
      };
    }
  };

  const deleteLocationProfile = (profileId) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const locDir = path.resolve(loc.directory, LOCATIONS_DIR_NAME);

    // Automatically back up existing data before deleting a location profile
    try {
      const preMatches = findAllLocationFilesByProfileId(loc.directory, profileId);
      if (preMatches.length > 0 && loc.writable) {
        let locLabel = String(profileId || '');
        try {
          const rawPre = fs.readFileSync(preMatches[0], 'utf8').replace(/^\uFEFF/, '');
          const parsedPre = JSON.parse(rawPre);
          if (parsedPre && parsedPre.locationName) locLabel = String(parsedPre.locationName);
        } catch {}
        createBackupSnapshot({
          trigger: 'auto_before_delete',
          reason: locText(
            `사용장소 '${locLabel}' 삭제 직전 자동 백업`,
            `Auto backup before deleting location '${locLabel}'`
          ),
        });
      }
    } catch {}

    const lockPath = path.join(locDir, '.locations.lock');
    return withFileLockSync(lockPath, () => {
      const matches = findAllLocationFilesByProfileId(loc.directory, profileId);
      if (matches.length === 0) {
        return {
          success: false,
          error: locText('삭제할 사용장소 파일이 존재하지 않습니다.', 'Location profile file to delete does not exist.'),
        };
      }
      try {
        for (const matchPath of matches) {
          if (fs.existsSync(matchPath)) fs.unlinkSync(matchPath);
        }
        return { success: true };
      } catch (err) {
        const classified = classifyUsbWriteError(
          err,
          locText('사용장소 파일 삭제', 'Delete location profile file'),
          activeLocale
        );
        return {
          success: false,
          writeProtected: classified.writeProtected,
          error: classified.message,
        };
      }
    }, activeLocale);
  };

  const LOG_DIR_NAME = 'log';

  function formatLocalLogDate(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatLocalLogTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${formatLocalLogDate(d)} ${hh}:${mm}:${ss}`;
  }

  function getAppLogFileName(date = new Date()) {
    return `AhBiShare_${formatLocalLogDate(date)}.log`;
  }

  function resolveSafeLogFilePath(baseDir, date = new Date(), locale = 'ko') {
    const logDir = path.resolve(baseDir, LOG_DIR_NAME);
    const fileName = getAppLogFileName(date);
    const filePath = path.resolve(logDir, fileName);
    if (!filePath.startsWith(logDir + path.sep)) {
      throw new Error(pickLocaleText(locale, '허용되지 않은 로그 파일 경로입니다.', 'Disallowed log file path.'));
    }
    return { logDir, fileName, filePath };
  }

  function sanitizeSingleLineLogText(text, maxLen = 900) {
    const scrubbed = stripSensitiveCredentialText(String(text || ''));
    return scrubbed.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  }

  const appendAppLog = (entry = {}) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const now = new Date();
    const { logDir, fileName, filePath } = resolveSafeLogFilePath(loc.directory, now, activeLocale);

    const rawStatus = String(entry.status || 'info').toLowerCase().trim();
    const levelTag =
      rawStatus === 'error'
        ? 'ERROR'
        : rawStatus === 'warn' || rawStatus === 'warning'
          ? 'WARN'
          : rawStatus === 'success'
            ? 'SUCCESS'
            : 'INFO';
    const defaultRole = locText('시스템', 'System');
    const roleText = sanitizeSingleLineLogText(entry.role || defaultRole, 80) || defaultRole;
    const hostText = sanitizeSingleLineLogText(entry.hostName || '', 64);
    const summaryText = sanitizeSingleLineLogText(entry.summary || '', 600);
    const detailText = entry.detail ? sanitizeSingleLineLogText(entry.detail, 700) : '';

    if (!summaryText && !detailText) {
      return {
        success: false,
        directory: logDir,
        filePath,
        error: locText('기록할 로그 내용이 비어 있습니다.', 'Log entry content is empty.'),
      };
    }

    const lineParts = [`[${formatLocalLogTimestamp(now)}]`];
    if (hostText) lineParts.push(`[${hostText}]`);
    lineParts.push(`[${levelTag}]`);
    lineParts.push(`[${roleText}]`);
    lineParts.push(summaryText || detailText);
    if (detailText && detailText !== summaryText) {
      lineParts.push(`| detail: ${detailText}`);
    }
    const lineContent = `${lineParts.join(' ')}\r\n`;

    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (err) {
      const classified = classifyUsbWriteError(err, locText('로그 폴더 생성', 'Create log folder'), activeLocale);
      return {
        success: false,
        directory: logDir,
        filePath,
        writeProtected: classified.writeProtected,
        error: classified.message,
      };
    }

    try {
      const isNewFile = !fs.existsSync(filePath);
      const payload = isNewFile ? `\uFEFF${lineContent}` : lineContent;
      fs.appendFileSync(filePath, payload, 'utf8');
      return {
        success: true,
        directory: logDir,
        fileName,
        filePath,
      };
    } catch (err) {
      const classified = classifyUsbWriteError(err, locText('로그 파일 기록', 'Write log file'), activeLocale);
      return {
        success: false,
        directory: logDir,
        fileName,
        filePath,
        writeProtected: classified.writeProtected,
        error: classified.message,
      };
    }
  };

  const getAppLogInfo = (opts = {}) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const { logDir, fileName, filePath } = resolveSafeLogFilePath(loc.directory, new Date(), activeLocale);
    const limit = Math.max(10, Math.min(300, Number(opts?.limit) || 100));
    const files = [];
    let recentLines = [];

    try {
      if (fs.existsSync(logDir)) {
        for (const entry of fs.readdirSync(logDir)) {
          if (!entry.toLowerCase().endsWith('.log')) continue;
          const full = path.resolve(logDir, entry);
          if (!full.startsWith(logDir + path.sep)) continue;
          try {
            const st = fs.statSync(full);
            if (st.isFile()) {
              files.push({
                fileName: entry,
                filePath: full,
                sizeBytes: st.size,
                updatedAt: st.mtime.toISOString(),
              });
            }
          } catch {}
        }
        files.sort((a, b) => b.fileName.localeCompare(a.fileName));
      }

      const targetReadPath = fs.existsSync(filePath) ? filePath : files[0]?.filePath;
      if (targetReadPath && fs.existsSync(targetReadPath)) {
        const raw = fs.readFileSync(targetReadPath, 'utf8').replace(/^\uFEFF/, '');
        const lines = raw.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
        recentLines = lines.slice(-limit).reverse();
      }
    } catch {}

    return {
      success: true,
      supported: true,
      directory: logDir,
      currentFileName: fileName,
      currentFilePath: filePath,
      writable: Boolean(loc.writable),
      writeProtected: Boolean(loc.writeProtected),
      files,
      recentLines,
    };
  };

  function buildBackupCounts(portableDocument, locationProfiles) {
    const shares = Array.isArray(portableDocument?.shares) ? portableDocument.shares : [];
    const hostPolicies = portableDocument?.hostPolicies ? Object.keys(portableDocument.hostPolicies).length : 0;
    const pendingTasks = portableDocument?.pendingHostActions
      ? Object.keys(portableDocument.pendingHostActions).length
      : 0;
    const tickets = Array.isArray(portableDocument?.troubleshootTickets)
      ? portableDocument.troubleshootTickets.length
      : 0;
    const locations = Array.isArray(locationProfiles) ? locationProfiles.length : 0;
    return {
      shareCount: shares.length,
      hostPolicyCount: hostPolicies,
      pendingTaskCount: pendingTasks,
      ticketCount: tickets,
      locationCount: locations,
    };
  }

  function computeBackupContentHash(portableDocument, locationProfiles) {
    const canonical = {
      shares: Array.isArray(portableDocument?.shares) ? portableDocument.shares : [],
      hostPolicies: portableDocument?.hostPolicies || {},
      pendingHostActions: portableDocument?.pendingHostActions || {},
      troubleshootTickets: Array.isArray(portableDocument?.troubleshootTickets)
        ? portableDocument.troubleshootTickets
        : [],
      lastClientTarget: portableDocument?.lastClientTarget || null,
      locationProfiles: Array.isArray(locationProfiles) ? locationProfiles : [],
    };
    return crypto.createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex').slice(0, 16);
  }

  function collectEncryptedBundleFromDisk(loc, locale = getLocale()) {
    let portableDocument = prepareDiskDocument(emptyDocument(), locale);
    if (fs.existsSync(loc.filePath)) {
      try {
        const rawPortable = readUtf8WithRetrySync(loc.filePath);
        const parsedPortable = JSON.parse(rawPortable);
        portableDocument = prepareDiskDocument(parsedPortable, locale);
      } catch {}
    }

    const locDir = path.resolve(loc.directory, LOCATIONS_DIR_NAME);
    const locationProfiles = [];
    const seenIds = new Set();
    if (fs.existsSync(locDir)) {
      try {
        for (const entry of fs.readdirSync(locDir)) {
          if (!entry.toLowerCase().endsWith(LOCATION_FILE_EXT)) continue;
          const fullPath = path.resolve(locDir, entry);
          if (!fullPath.startsWith(locDir + path.sep)) continue;
          try {
            const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || !parsed.locationName) continue;
            const diskLoc = prepareLocationProfileForDisk(parsed, locale);
            if (parsed.updatedAt) {
              diskLoc.updatedAt = String(parsed.updatedAt);
            }
            if (seenIds.has(diskLoc.profileId)) continue;
            seenIds.add(diskLoc.profileId);
            locationProfiles.push(diskLoc);
          } catch {}
        }
      } catch {}
    }
    locationProfiles.sort((a, b) => String(a.profileId || '').localeCompare(String(b.profileId || '')));

    const counts = buildBackupCounts(portableDocument, locationProfiles);
    const contentHash = computeBackupContentHash(portableDocument, locationProfiles);
    return { portableDocument, locationProfiles, counts, contentHash };
  }

  function toBackupSummary(parsed, fileName, filePath, sizeBytes) {
    const counts = parsed?.counts || buildBackupCounts(parsed?.portableDocument, parsed?.locationProfiles);
    return {
      backupId: String(parsed?.backupId || fileName.replace(BACKUP_FILE_EXT, '')),
      fileName,
      filePath,
      createdAt: String(parsed?.createdAt || new Date().toISOString()),
      trigger: String(parsed?.trigger || 'manual'),
      reason: String(parsed?.reason || locText('데이터 백업', 'Data Backup')),
      createdByHostName: String(parsed?.createdByHostName || ''),
      contentHash: String(parsed?.contentHash || ''),
      sizeBytes: Number(sizeBytes) || 0,
      counts,
    };
  }

  function readBackupEntriesSorted(backupDir, locale = getLocale()) {
    const items = [];
    if (!fs.existsSync(backupDir)) return items;
    try {
      for (const entry of fs.readdirSync(backupDir)) {
        if (!entry.toLowerCase().endsWith(BACKUP_FILE_EXT)) continue;
        let fullPath;
        try {
          ({ filePath: fullPath } = resolveSafeBackupFilePath(path.dirname(backupDir), entry, locale));
        } catch {
          continue;
        }
        try {
          const st = fs.statSync(fullPath);
          if (!st.isFile()) continue;
          const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.kind !== 'ahbishare-data-backup') continue;
          items.push({
            summary: toBackupSummary(parsed, entry, fullPath, st.size),
            parsed,
          });
        } catch {}
      }
    } catch {}
    items.sort((a, b) => {
      const cmp = String(b.summary.createdAt || '').localeCompare(String(a.summary.createdAt || ''));
      if (cmp !== 0) return cmp;
      return String(b.summary.fileName || '').localeCompare(String(a.summary.fileName || ''));
    });
    return items;
  }

  function formatBackupFileStamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(
      d.getMinutes()
    )}${pad(d.getSeconds())}`;
  }

  const ensureBackupDirectory = () => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const backupDir = resolveSafeBackupDir(loc.directory);
    if (!loc.writable) {
      return {
        success: false,
        directory: backupDir,
        writable: false,
        writeProtected: Boolean(loc.writeProtected),
        error: loc.writeError || locText('앱 실행 폴더가 쓰기 불가 상태입니다.', 'Application directory is not writable.'),
      };
    }
    try {
      fs.mkdirSync(backupDir, { recursive: true });
      const probe = probeDirectoryWriteSafety(backupDir, activeLocale);
      if (!probe.writable) {
        return {
          success: false,
          directory: backupDir,
          writable: false,
          writeProtected: Boolean(probe.writeProtected),
          error: probe.writeError || locText('백업 폴더 쓰기 안전 점검 실패', 'Backup folder write safety check failed'),
        };
      }
      return {
        success: true,
        directory: backupDir,
        writable: true,
        writeProtected: false,
      };
    } catch (err) {
      const classified = classifyUsbWriteError(
        err,
        locText('백업 폴더 생성', 'Create backup folder'),
        activeLocale
      );
      return {
        success: false,
        directory: backupDir,
        writable: false,
        writeProtected: classified.writeProtected,
        error: classified.message,
      };
    }
  };

  const listBackupSnapshots = () => {
    const loc = getLocation();
    const backupDir = resolveSafeBackupDir(loc.directory);
    if (loc.writable && !fs.existsSync(backupDir)) {
      try {
        fs.mkdirSync(backupDir, { recursive: true });
      } catch {}
    }
    const entries = readBackupEntriesSorted(backupDir);
    return {
      success: true,
      directory: backupDir,
      writable: Boolean(loc.writable),
      writeProtected: Boolean(loc.writeProtected),
      maxSnapshots: BACKUP_MAX_SNAPSHOTS,
      snapshots: entries.map((e) => e.summary),
      ...(loc.writeError ? { writeError: loc.writeError } : {}),
    };
  };

  function createBackupSnapshot(options = {}) {
    const activeLocale = getLocale();
    const loc = getLocation();
    const ensured = ensureBackupDirectory();
    if (!ensured.success) {
      return {
        success: false,
        directory: ensured.directory,
        writeProtected: Boolean(ensured.writeProtected),
        error: ensured.error,
      };
    }

    const trigger = String(options.trigger || 'manual');
    const reason = String(
      options.reason ||
        (trigger === 'auto_before_delete'
          ? locText('삭제 직전 자동 보호 백업', 'Auto protection backup before deletion')
          : trigger === 'auto_before_modify'
            ? locText('설정 변경 직전 자동 보호 백업', 'Auto protection backup before configuration change')
            : trigger === 'auto_before_reset'
              ? locText('일괄 정리·초기화 직전 자동 보호 백업', 'Auto protection backup before bulk reset')
              : trigger === 'auto_before_restore'
                ? locText('백업 복원 직전 자동 안전 백업', 'Auto safety backup before restore')
                : locText('사용자 수동 백업', 'Manual user backup'))
    ).trim();
    const hostName = String(options.hostName || '').trim();
    const allowDuplicate = Boolean(options.allowDuplicate);

    const lockPath = path.join(ensured.directory, '.backup.lock');
    return withFileLockSync(lockPath, () => {
      const bundle = collectEncryptedBundleFromDisk(loc);
      const totalItems =
        bundle.counts.shareCount +
        bundle.counts.hostPolicyCount +
        bundle.counts.pendingTaskCount +
        bundle.counts.ticketCount +
        bundle.counts.locationCount;

      if (trigger !== 'manual' && totalItems === 0 && !fs.existsSync(loc.filePath)) {
        return {
          success: true,
          skippedEmpty: true,
          directory: ensured.directory,
          prunedCount: 0,
        };
      }

      const existing = readBackupEntriesSorted(ensured.directory);
      if (
        trigger !== 'manual' &&
        !allowDuplicate &&
        existing.length > 0 &&
        existing[0].summary.contentHash === bundle.contentHash
      ) {
        return {
          success: true,
          skippedDuplicate: true,
          directory: ensured.directory,
          snapshot: existing[0].summary,
          prunedCount: 0,
        };
      }

      const now = new Date();
      const suffix = crypto.randomBytes(3).toString('hex');
      const backupId = `bak-${formatBackupFileStamp(now)}-${suffix}`;
      const fileName = `AhBiShare_Backup_${formatBackupFileStamp(now)}_${suffix}${BACKUP_FILE_EXT}`;
      const { filePath } = resolveSafeBackupFilePath(loc.directory, fileName, activeLocale);

      const snapshotDoc = {
        schemaVersion: 1,
        kind: 'ahbishare-data-backup',
        backupId,
        createdAt: now.toISOString(),
        trigger,
        reason,
        createdByHostName: hostName,
        contentHash: bundle.contentHash,
        counts: bundle.counts,
        portableDocument: bundle.portableDocument,
        locationProfiles: bundle.locationProfiles,
      };

      const writeRes = atomicWriteJson(filePath, snapshotDoc, activeLocale);
      if (!writeRes.success) {
        return {
          success: false,
          directory: ensured.directory,
          writeProtected: Boolean(writeRes.writeProtected),
          error:
            writeRes.error ||
            locText('백업 스냅샷 저장에 실패했습니다.', 'Failed to save backup snapshot.'),
        };
      }

      let statSize = 0;
      try {
        statSize = fs.statSync(filePath).size;
      } catch {}

      // Rotate older snapshots beyond BACKUP_MAX_SNAPSHOTS (keep newest 20)
      const afterEntries = readBackupEntriesSorted(ensured.directory, activeLocale);
      let prunedCount = 0;
      for (let i = BACKUP_MAX_SNAPSHOTS; i < afterEntries.length; i += 1) {
        try {
          if (fs.existsSync(afterEntries[i].summary.filePath)) {
            fs.unlinkSync(afterEntries[i].summary.filePath);
            prunedCount += 1;
          }
        } catch {}
      }

      return {
        success: true,
        skippedDuplicate: false,
        directory: ensured.directory,
        snapshot: toBackupSummary(snapshotDoc, fileName, filePath, statSize),
        prunedCount,
      };
    }, activeLocale);
  }

  const restoreBackupSnapshot = (backupIdOrFileName, options = {}) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const backupDir = resolveSafeBackupDir(loc.directory);
    const probe = probeDirectoryWriteSafety(loc.directory, activeLocale);
    if (!probe.writable) {
      return {
        success: false,
        writeProtected: Boolean(probe.writeProtected),
        error:
          probe.writeError ||
          locText(
            '대상 폴더가 쓰기 금지 상태이므로 백업을 복원할 수 없습니다.',
            'Target folder is write-protected, so backup cannot be restored.'
          ),
      };
    }

    const entries = readBackupEntriesSorted(backupDir, activeLocale);
    const needle = String(backupIdOrFileName || '').trim();
    const matched = entries.find(
      (e) => e.summary.backupId === needle || e.summary.fileName === needle
    );
    if (!matched) {
      return {
        success: false,
        error: locText('선택한 백업 스냅샷 파일을 찾을 수 없습니다.', 'Selected backup snapshot file was not found.'),
      };
    }

    const targetSummary = matched.summary;
    const rawPortable = matched.parsed?.portableDocument;
    const rawLocations = Array.isArray(matched.parsed?.locationProfiles)
      ? matched.parsed.locationProfiles
      : [];

    let preparedPortable;
    let preparedLocations;
    try {
      preparedPortable = prepareDiskDocument(hydrateRuntimeDocument(rawPortable || emptyDocument(), activeLocale), activeLocale);
      preparedLocations = rawLocations.map((lp) => prepareLocationProfileForDisk(hydrateLocationProfile(lp, activeLocale), activeLocale));
    } catch (parseErr) {
      return {
        success: false,
        error: locText(
          `백업 스냅샷 데이터 검증 실패: ${parseErr && parseErr.message ? parseErr.message : '형식 오류'}`,
          `Backup snapshot data validation failed: ${parseErr && parseErr.message ? parseErr.message : 'Format error'}`
        ),
      };
    }

    let safetyBackup = null;
    if (!options.skipSafetyBackup) {
      const preRes = createBackupSnapshot({
        trigger: 'auto_before_restore',
        reason: locText(
          `백업('${targetSummary.reason || targetSummary.fileName}') 복원 직전 자동 안전 백업`,
          `Auto safety backup before restoring '${targetSummary.reason || targetSummary.fileName}'`
        ),
        hostName: options.hostName || '',
      });
      if (preRes.success && preRes.snapshot) {
        safetyBackup = preRes.snapshot;
      }
    }

    // 1. Atomically restore AhBiShare_OneClick.portable.json
    const portableLockPath = path.join(loc.directory, `.${PORTABLE_FILE_NAME}.lock`);
    const portableRestoreRes = withFileLockSync(portableLockPath, () => {
      const writeRes = atomicWriteJson(loc.filePath, preparedPortable, activeLocale);
      if (!writeRes.success) {
        return {
          success: false,
          writeProtected: Boolean(writeRes.writeProtected),
          error:
            writeRes.error ||
            locText('포터블 설정 복원 쓰기에 실패했습니다.', 'Failed to write restored portable configuration.'),
        };
      }
      const verifiedRaw = fs.readFileSync(loc.filePath, 'utf8').replace(/^\uFEFF/, '');
      return {
        success: true,
        document: hydrateRuntimeDocument(JSON.parse(verifiedRaw), activeLocale),
      };
    }, activeLocale);

    if (!portableRestoreRes.success) {
      return portableRestoreRes;
    }

    // 2. Atomically restore locations/*.location.json
    const locDir = path.resolve(loc.directory, LOCATIONS_DIR_NAME);
    try {
      fs.mkdirSync(locDir, { recursive: true });
    } catch (err) {
      const classified = classifyUsbWriteError(
        err,
        locText('사용장소 폴더 생성', 'Create location folder'),
        activeLocale
      );
      return {
        success: false,
        writeProtected: classified.writeProtected,
        error: classified.message,
      };
    }

    const locLockPath = path.join(locDir, '.locations.lock');
    const restoredLocationSummaries = withFileLockSync(locLockPath, () => {
      if (fs.existsSync(locDir)) {
        for (const entry of fs.readdirSync(locDir)) {
          if (!entry.toLowerCase().endsWith(LOCATION_FILE_EXT)) continue;
          const full = path.resolve(locDir, entry);
          if (!full.startsWith(locDir + path.sep)) continue;
          try {
            fs.unlinkSync(full);
          } catch {}
        }
      }

      const summaries = [];
      for (const diskLoc of preparedLocations) {
        const { fileName, filePath } = resolveSafeLocationFilePath(
          loc.directory,
          diskLoc.profileId,
          diskLoc.locationName,
          activeLocale
        );
        const wRes = atomicWriteJson(filePath, diskLoc, activeLocale);
        if (wRes.success) {
          const hydratedLoc = hydrateLocationProfile(diskLoc, activeLocale);
          summaries.push(toLocationProfileSummary(hydratedLoc, fileName));
        }
      }
      summaries.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      return summaries;
    }, activeLocale);

    return {
      success: true,
      restoredSnapshot: targetSummary,
      safetyBackup,
      portableDocument: portableRestoreRes.document,
      portableStatus: {
        ...loc,
        writable: true,
        hasExistingFile: fs.existsSync(loc.filePath),
        lastSyncedAt: preparedPortable.updatedAt,
      },
      locationProfiles: restoredLocationSummaries,
    };
  };

  const deleteBackupSnapshot = (backupIdOrFileName) => {
    const activeLocale = getLocale();
    const loc = getLocation();
    const backupDir = resolveSafeBackupDir(loc.directory);
    const lockPath = path.join(backupDir, '.backup.lock');
    if (!fs.existsSync(backupDir)) {
      return {
        success: false,
        error: locText('백업 폴더가 존재하지 않습니다.', 'Backup folder does not exist.'),
      };
    }
    return withFileLockSync(lockPath, () => {
      const entries = readBackupEntriesSorted(backupDir);
      const needle = String(backupIdOrFileName || '').trim();
      const matched = entries.find(
        (e) => e.summary.backupId === needle || e.summary.fileName === needle
      );
      if (!matched) {
        return {
          success: false,
          error: locText('삭제할 백업 스냅샷을 찾을 수 없습니다.', 'Backup snapshot to delete was not found.'),
        };
      }
      try {
        if (fs.existsSync(matched.summary.filePath)) {
          fs.unlinkSync(matched.summary.filePath);
        }
        return { success: true, deletedBackupId: matched.summary.backupId };
      } catch (err) {
        const classified = classifyUsbWriteError(
          err,
          locText('백업 파일 삭제', 'Delete backup file'),
          activeLocale
        );
        return {
          success: false,
          writeProtected: classified.writeProtected,
          error: classified.message,
        };
      }
    }, activeLocale);
  };

  return {
    getStatus: () => {
      const loc = getLocation();
      const exists = fs.existsSync(loc.filePath);
      let lastSyncedAt;
      if (exists) {
        try {
          const parsed = JSON.parse(fs.readFileSync(loc.filePath, 'utf8').replace(/^\uFEFF/, ''));
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
    appendAppLog,
    getAppLogInfo,
    ensureBackupDirectory,
    listBackupSnapshots,
    createBackupSnapshot,
    restoreBackupSnapshot,
    deleteBackupSnapshot,
  };
}

module.exports = {
  PORTABLE_FILE_NAME,
  LOCATIONS_DIR_NAME,
  LOCATION_FILE_EXT,
  LOG_DIR_NAME: 'log',
  BACKUP_DIR_NAME,
  BACKUP_FILE_EXT,
  BACKUP_MAX_SNAPSHOTS,
  sanitizeLocationId,
  resolveSafeBackupDir,
  resolveSafeBackupFilePath,
  encryptCredentials,
  decryptCredentials,
  classifyUsbWriteError,
  probeDirectoryWriteSafety,
  resolvePortableLocation,
  prepareDiskDocument,
  hydrateRuntimeDocument,
  prepareLocationProfileForDisk,
  hydrateLocationProfile,
  toLocationProfileSummary,
  atomicWriteBuffer,
  atomicWriteJson,
  stripSensitiveCredentialText,
  sanitizeTroubleshootTickets,
  createPortableStore,
};
