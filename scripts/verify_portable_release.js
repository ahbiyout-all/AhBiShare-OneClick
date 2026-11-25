/**
 * AhBiShare OneClick - Standalone Portable EXE Packaging & Integrity Verifier
 * Run via: npm run verify
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

let checksPassed = 0;
function pass(msg) {
  checksPassed++;
  console.log(`[PASS] ${msg}`);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

console.log('=======================================================');
console.log('[*] AhBiShare OneClick Standalone Portable Audit');
console.log('=======================================================');

// 1. Verify root electron-builder packaging configs & version 1.0.0
const rootPkg = readJson(path.join(rootDir, 'package.json'));
const rootConfig = readJson(path.join(rootDir, 'public', 'config.json'));

for (const reqFile of ['dist/**/*', 'main.js', 'preload.js', 'portableStore.js', 'portableUpdater.js', 'package.json']) {
  assert(
    Array.isArray(rootPkg.build?.files) && rootPkg.build.files.includes(reqFile),
    `package.json build.files missing "${reqFile}"`
  );
}
assert.strictEqual(rootPkg.name, 'ahbishare-oneclick');
const rootLock = readJson(path.join(rootDir, 'package-lock.json'));
assert.strictEqual(rootLock.name, rootPkg.name, `package-lock.json name (${rootLock.name}) !== package.json (${rootPkg.name})`);
assert.deepStrictEqual(
  Object.keys(rootLock.packages?.['']?.dependencies || {}).sort(),
  Object.keys(rootPkg.dependencies || {}).sort(),
  'package-lock.json root dependencies must match package.json'
);
assert.deepStrictEqual(
  Object.keys(rootLock.packages?.['']?.devDependencies || {}).sort(),
  Object.keys(rootPkg.devDependencies || {}).sort(),
  'package-lock.json root devDependencies must match package.json'
);
assert(/^\d+\.\d+\.\d+$/.test(rootPkg.version), `package.json version must strictly follow SemVer MAJOR.MINOR.PATCH (got "${rootPkg.version}")`);
assert.strictEqual(rootPkg.version, '1.2.1');
assert.strictEqual(rootConfig.version, rootPkg.version, `public/config.json version (${rootConfig.version}) !== package.json (${rootPkg.version})`);
const srcVersionTs = fs.readFileSync(path.join(rootDir, 'src', 'version.ts'), 'utf8');
assert(
  srcVersionTs.includes(`APP_VERSION = '${rootPkg.version}'`),
  `src/version.ts must match package.json version (${rootPkg.version})`
);
assert(fs.existsSync(path.join(rootDir, 'scripts', 'bump_version.js')), 'Missing scripts/bump_version.js');
assert.strictEqual(rootPkg.build?.win?.requestedExecutionLevel, 'requireAdministrator');
assert.strictEqual(rootPkg.build?.win?.artifactName, 'AhBiShare_OneClick_v${version}.${ext}');
assert.strictEqual(rootPkg.build?.nsis?.artifactName, 'AhBiShare_OneClick-Setup_v${version}.${ext}');
assert.strictEqual(rootPkg.build?.portable?.artifactName, 'AhBiShare_OneClick_v${version}.${ext}');

const liteCfg = readJson(path.join(rootDir, 'build-config-lite.json'));
assert.strictEqual(liteCfg.compression, 'maximum');
assert.strictEqual(liteCfg.afterPack, 'scripts/prune_electron_pack.js');
assert(Array.isArray(liteCfg.electronLanguages) && liteCfg.electronLanguages.includes('ko') && liteCfg.electronLanguages.includes('en-US'), 'build-config-lite.json must preserve ko and en-US locales');
assert(Array.isArray(liteCfg.files) && liteCfg.files.includes('portableUpdater.js'), 'build-config-lite.json files missing portableUpdater.js');
assert(Array.isArray(liteCfg.files) && liteCfg.files.includes('!**/node_modules/**/*'), 'build-config-lite.json must exclude redundant node_modules from app.asar');
assert.strictEqual(liteCfg.win?.requestedExecutionLevel, 'requireAdministrator');
assert.strictEqual(liteCfg.portable?.artifactName, 'AhBiShare_OneClick-Lite_v${version}.${ext}');

const win7Cfg = readJson(path.join(rootDir, 'build-config-win7.json'));
assert.strictEqual(win7Cfg.electronVersion, '21.4.4');
assert(Array.isArray(win7Cfg.files) && win7Cfg.files.includes('portableUpdater.js'), 'build-config-win7.json files missing portableUpdater.js');
assert.strictEqual(win7Cfg.portable?.artifactName, 'AhBiShare_OneClick_Win7_v${version}.${ext}');
for (const [cfgName, c] of [
  ['package.json', rootPkg.build?.copyright],
  ['build-config-lite.json', liteCfg.copyright],
  ['build-config-win7.json', win7Cfg.copyright],
]) {
  assert.strictEqual(c, 'Copyright © 1998-2026 AhBiYout. All rights reserved.', `${cfgName} copyright must be AhBiYout`);
}

assert(fs.existsSync(path.join(rootDir, 'scripts', 'prune_electron_pack.js')), 'Missing scripts/prune_electron_pack.js');
assert(fs.existsSync(path.join(rootDir, 'scripts', 'build_lite_exe.js')), 'Missing scripts/build_lite_exe.js');
assert(fs.existsSync(path.join(rootDir, 'scripts', 'build_win7_exe.js')), 'Missing scripts/build_win7_exe.js');
pass(`Standalone, Lite & Win7 EXE version-numbered configs verified (v${rootPkg.version}, requireAdministrator)`);

// 2. Verify Electron main.js & preload.js expose required bridge channels
const modMain = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
const modPreload = fs.readFileSync(path.join(rootDir, 'preload.js'), 'utf8');
for (const ipc of [
  'run-powershell',
  'get-local-network-info',
  'scan-lan-peers',
  'ping-host',
  'get-portable-status',
  'load-portable-data',
  'save-portable-data',
  'trigger-system-reboot',
  'save-legacy-scripts',
  'list-location-profiles',
  'save-location-profile',
  'load-location-profile',
  'delete-location-profile',
  'export-location-profile-file',
  'import-location-profile-file',
  'check-github-updates',
  'open-external-url',
  'get-update-runtime-info',
  'install-portable-update',
  'cancel-portable-update',
  'github-update-progress',
]) {
  assert(modMain.includes(ipc), `main.js missing IPC handler/event: ${ipc}`);
  assert(modPreload.includes(ipc), `preload.js missing IPC channel: ${ipc}`);
}
for (const bridgeMethod of [
  'runPowerShell',
  'getLocalNetworkInfo',
  'getPortableStatus',
  'loadPortableData',
  'savePortableData',
  'triggerSystemReboot',
  'saveLegacyScripts',
  'listLocationProfiles',
  'saveLocationProfile',
  'loadLocationProfile',
  'deleteLocationProfile',
  'exportLocationProfileFile',
  'importLocationProfileFile',
  'checkGitHubUpdates',
  'openExternalUrl',
  'getUpdateRuntimeInfo',
  'installPortableUpdate',
  'cancelPortableUpdate',
  'onUpdateProgress',
]) {
  assert(modPreload.includes(bridgeMethod), `preload.js missing bridge API: ${bridgeMethod}`);
}
assert(modMain.includes('ms-settings:windowsupdate'), 'main.js missing ms-settings:windowsupdate handler');
assert(
  modMain.includes('setWindowOpenHandler') && modMain.includes('shell.openExternal'),
  'main.js missing external HTTPS shell.openExternal handler'
);
assert(
  modMain.includes('fallbackDispVer') && modMain.includes("'8.1'") && modMain.includes("'SP1'"),
  'main.js missing Win 7/8/8.1 fallback display version mapping'
);
const appTsxSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');
for (const channelMarker of [
  'https://github.com/ahbiyout-all/AhBiShare-OneClick',
  'https://ahbiyoutvibe.blogspot.com/',
  'https://www.cisnet.co.kr',
  '(주)청운정보시스템',
]) {
  assert(appTsxSrc.includes(channelMarker), `src/App.tsx missing official channel marker: ${channelMarker}`);
}
pass('Electron IPC handlers, external link security, & contextBridge preload APIs verified');

// 3. Functional test of portableStore.js (PORTABLE_EXECUTABLE_DIR, AES-256-GCM, password strip, ttl/hostPolicies, BOM)
const portableStore = require(path.join(rootDir, 'portableStore.js'));
const tempUsbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-verify-'));
try {
  const store = portableStore.createPortableStore({
    env: { PORTABLE_EXECUTABLE_DIR: tempUsbDir },
    app: { isPackaged: true, getPath: () => tempUsbDir },
  });
  const initStatus = store.getStatus();
  assert.strictEqual(initStatus.mode, 'portable-exe');
  assert.strictEqual(path.resolve(initStatus.directory), path.resolve(tempUsbDir));
  assert.strictEqual(initStatus.writable, true);

  const sampleDoc = {
    schemaVersion: 1,
    updatedAt: '2026-11-16T10:00:00.000Z',
    shares: [
      {
        sourceHostName: 'HOST-26H2-PC',
        sourceIp: '192.168.0.105',
        shareName: 'VerifyDocs',
        folderPath: 'D:\\VerifyDocs',
        uncPath: '\\\\192.168.0.105\\VerifyDocs',
        authMode: 'account',
        permission: 'full',
        username: 'AhBiShare',
        password: 'SuperSecret!2026',
        createdAt: '10:00:00',
        updatedAt: '2026-11-16T10:00:00.000Z',
        ttlMinutes: 60,
        expiresAt: '2026-11-16T11:00:00.000Z',
        autoRevokeOnExpiry: true,
        connectionCode: 'ABSHARE://placeholder',
      },
    ],
    hostPolicies: {
      'HOST-26H2-PC': {
        hostName: 'HOST-26H2-PC',
        osProductName: 'Windows 11 Pro',
        osDisplayVersion: '26H2',
        osBuild: 26300,
        osEra: 'win11_25_26h2',
        networkProfile: 'Private',
        smbServerSigningRequired: false,
        allowInsecureGuestAuth: true,
        rpcAuthnLevelPrivacyDisabled: true,
        rpcUseNamedPipeProtocol: true,
        pointAndPrintRelaxed: true,
        guestNetworkLogonDenied: true,
        capturedAt: '2026-11-16T10:00:00.000Z',
      },
    },
  };

  const saveRes = store.savePortableData(sampleDoc);
  assert.strictEqual(saveRes.success, true);

  const rawDisk = fs.readFileSync(path.join(tempUsbDir, portableStore.PORTABLE_FILE_NAME), 'utf8');
  assert(!rawDisk.includes('SuperSecret!2026'), 'Plaintext password leaked into portable JSON on disk!');
  const diskParsed = JSON.parse(rawDisk);
  assert(diskParsed.shares[0].encryptedCredentials?.ciphertext, 'Missing AES-256-GCM encryptedCredentials on disk');
  assert.strictEqual(diskParsed.shares[0].ttlMinutes, 60);
  assert.strictEqual(diskParsed.shares[0].autoRevokeOnExpiry, true);
  assert.strictEqual(diskParsed.hostPolicies['HOST-26H2-PC'].osDisplayVersion, '26H2');
  assert.strictEqual(diskParsed.hostPolicies['HOST-26H2-PC'].guestNetworkLogonDenied, true);

  fs.writeFileSync(path.join(tempUsbDir, portableStore.PORTABLE_FILE_NAME), `\uFEFF${rawDisk}`, 'utf8');
  assert.strictEqual(store.getStatus().lastSyncedAt, '2026-11-16T10:00:00.000Z', 'getStatus must parse lastSyncedAt cleanly when .portable.json has UTF-8 BOM');

  const loadRes = store.loadPortableData();
  assert.strictEqual(loadRes.success, true);
  assert.strictEqual(loadRes.document.shares[0].password, 'SuperSecret!2026');
  assert.strictEqual(loadRes.document.shares[0].ttlMinutes, 60);
  assert.strictEqual(loadRes.document.shares[0].expiresAt, '2026-11-16T11:00:00.000Z');
  assert.strictEqual(loadRes.document.hostPolicies['HOST-26H2-PC'].rpcAuthnLevelPrivacyDisabled, true);
  assert.strictEqual(loadRes.document.hostPolicies['HOST-26H2-PC'].guestNetworkLogonDenied, true);

  const unlimitedDoc = {
    ...sampleDoc,
    shares: [
      {
        sourceHostName: 'HOST-26H2-PC',
        sourceIp: '192.168.0.105',
        shareName: 'VerifyDocs',
        folderPath: 'D:\\VerifyDocs',
        uncPath: '\\\\192.168.0.105\\VerifyDocs',
        authMode: 'account',
        permission: 'full',
        username: 'AhBiShare',
        password: 'SuperSecret!2026',
        createdAt: '10:00:00',
        updatedAt: '2026-11-16T10:05:00.000Z',
        connectionCode: 'ABSHARE://placeholder',
      },
    ],
  };
  store.savePortableData(unlimitedDoc);
  const reloadedUnlimited = store.loadPortableData();
  assert.strictEqual(reloadedUnlimited.document.shares[0].ttlMinutes, undefined);
  assert.strictEqual(reloadedUnlimited.document.shares[0].expiresAt, undefined);
  pass('portableStore.js AES-256-GCM encryption, BOM resilience, TTL clear & hostPolicies roundtrip verified');

  // 3b. Per-location .location.json storage, collision guard, BOM & AES-256-GCM roundtrip
  const locIdOffice1 = portableStore.sanitizeLocationId('사무실 1', '사무실 1');
  const locIdHome1 = portableStore.sanitizeLocationId('집 1', '집 1');
  assert.notStrictEqual(
    locIdOffice1,
    locIdHome1,
    'Mixed non-ASCII + ASCII location IDs must not collide after sanitization'
  );

  const locSaveRes = store.saveLocationProfile({
    locationName: '본사 사무실 1',
    description: '디자인실 공유 + NAS Z드라이브',
    networkHint: { subnetPrefix: '192.168.10', primaryIp: '192.168.10.25', hostname: 'OFFICE-PC' },
    hostPreset: {
      folderPath: 'D:\\OfficeShare',
      shareName: 'OfficeDocs',
      authMode: 'account',
      permission: 'full',
      username: 'OfficeAdmin',
      password: 'LocHostSecret!1',
    },
    savedShares: [
      {
        sourceHostName: 'OFFICE-PC',
        sourceIp: '192.168.10.25',
        shareName: 'OfficeDocs',
        folderPath: 'D:\\OfficeShare',
        uncPath: '\\\\192.168.10.25\\OfficeDocs',
        authMode: 'account',
        permission: 'full',
        username: 'OfficeAdmin',
        password: 'LocShareSecret!2',
        createdAt: '09:00:00',
        updatedAt: '2026-11-17T09:00:00.000Z',
        connectionCode: 'ABSHARE://placeholder',
      },
    ],
    clientTargets: [
      {
        targetHost: '192.168.10.200',
        shareName: 'DesignNAS',
        driveLetter: 'z',
        authMode: 'account',
        username: 'NasUser',
        password: 'LocClientSecret!3',
        persistent: true,
      },
    ],
  });
  assert.strictEqual(locSaveRes.success, true, 'saveLocationProfile failed');
  assert(fs.existsSync(locSaveRes.filePath), 'Location .location.json file missing on disk');

  const rawLocDisk = fs.readFileSync(locSaveRes.filePath, 'utf8');
  assert(!rawLocDisk.includes('LocHostSecret!1'), 'Plaintext hostPreset password leaked in .location.json!');
  assert(!rawLocDisk.includes('LocShareSecret!2'), 'Plaintext savedShare password leaked in .location.json!');
  assert(!rawLocDisk.includes('LocClientSecret!3'), 'Plaintext clientTarget password leaked in .location.json!');

  fs.writeFileSync(locSaveRes.filePath, `\uFEFF${rawLocDisk}`, 'utf8');

  const locList = store.listLocationProfiles();
  assert.strictEqual(locList.success, true);
  assert.strictEqual(locList.profiles.length, 1);
  assert.strictEqual(locList.profiles[0].locationName, '본사 사무실 1');
  assert.strictEqual(locList.profiles[0].shareCount, 1);
  assert.strictEqual(locList.profiles[0].clientTargetCount, 1);

  const locLoaded = store.loadLocationProfile(locSaveRes.profile.profileId);
  assert.strictEqual(locLoaded.success, true);
  assert.strictEqual(locLoaded.profile.hostPreset?.password, 'LocHostSecret!1');
  assert.strictEqual(locLoaded.profile.savedShares[0].password, 'LocShareSecret!2');
  assert.strictEqual(locLoaded.profile.clientTargets[0].password, 'LocClientSecret!3');
  assert.strictEqual(locLoaded.profile.clientTargets[0].driveLetter, 'Z:');

  // Verify edited top-level username overrides stale encryptedCredentials.username when password is not re-entered
  const locEditedUserOnly = {
    ...locLoaded.profile,
    hostPreset: { ...locLoaded.profile.hostPreset, username: 'UpdatedHostUser', password: '' },
    savedShares: [{ ...locLoaded.profile.savedShares[0], username: 'UpdatedShareUser', password: '' }],
    clientTargets: [{ ...locLoaded.profile.clientTargets[0], username: 'UpdatedClientUser', password: '' }],
  };
  assert.strictEqual(store.saveLocationProfile(locEditedUserOnly).success, true);
  const locReloadedUserOnly = store.loadLocationProfile(locSaveRes.profile.profileId);
  assert.strictEqual(locReloadedUserOnly.success, true);
  assert.strictEqual(locReloadedUserOnly.profile.hostPreset?.username, 'UpdatedHostUser');
  assert.strictEqual(locReloadedUserOnly.profile.hostPreset?.password, 'LocHostSecret!1');
  assert.strictEqual(locReloadedUserOnly.profile.savedShares[0].username, 'UpdatedShareUser');
  assert.strictEqual(locReloadedUserOnly.profile.savedShares[0].password, 'LocShareSecret!2');
  assert.strictEqual(locReloadedUserOnly.profile.clientTargets[0].username, 'UpdatedClientUser');
  assert.strictEqual(locReloadedUserOnly.profile.clientTargets[0].password, 'LocClientSecret!3');
  assert.strictEqual(
    portableStore.decryptCredentials(locReloadedUserOnly.profile.hostPreset.encryptedCredentials).username,
    'UpdatedHostUser',
    'Encrypted ciphertext payload must synchronize updated hostPreset username without password re-entry'
  );
  assert.strictEqual(
    portableStore.decryptCredentials(locReloadedUserOnly.profile.clientTargets[0].encryptedCredentials).username,
    'UpdatedClientUser',
    'Encrypted ciphertext payload must synchronize updated clientTarget username without password re-entry'
  );

  const locDel = store.deleteLocationProfile(locSaveRes.profile.profileId);
  assert.strictEqual(locDel.success, true);
  assert.strictEqual(store.listLocationProfiles().profiles.length, 0);

  // Verify copied/renamed .location.json file whose filename differs from internal profileId, and alias deduplication on re-save
  const renamedSaveRes = store.saveLocationProfile({
    profileId: 'loc-renamed-check',
    locationName: '외부 복사 장소',
    networkHint: { subnetPrefix: '10.0.0', primaryIp: '10.0.0.5', hostname: 'COPY-PC' },
    savedShares: [],
    clientTargets: [
      {
        targetHost: '10.0.0.99',
        shareName: 'CopyShare',
        driveLetter: 'y',
        authMode: 'account',
        username: 'CopyUser',
        password: 'CopySecret!9',
        persistent: true,
      },
    ],
  });
  assert.strictEqual(renamedSaveRes.success, true);
  const locDirPath = path.dirname(renamedSaveRes.filePath);
  const aliasedLocPath = path.join(locDirPath, 'Manual_Renamed_Copy.location.json');
  fs.renameSync(renamedSaveRes.filePath, aliasedLocPath);
  const aliasedList = store.listLocationProfiles();
  assert.strictEqual(aliasedList.profiles.length, 1);
  assert.strictEqual(aliasedList.profiles[0].profileId, 'loc-renamed-check');
  const aliasedLoad = store.loadLocationProfile('loc-renamed-check');
  assert.strictEqual(aliasedLoad.success, true, 'loadLocationProfile must resolve renamed .location.json by internal profileId');
  assert.strictEqual(aliasedLoad.profile.clientTargets[0].password, 'CopySecret!9');
  // Re-save decrypted profile loaded from aliased file and confirm stale duplicate removal + zero leftover temp/lock files
  const consolidatedSave = store.saveLocationProfile({
    ...aliasedLoad.profile,
    description: '정규 파일 통합 검증',
  });
  assert.strictEqual(consolidatedSave.success, true);
  assert.strictEqual(consolidatedSave.profile.clientTargets[0].password, 'CopySecret!9');
  assert.strictEqual(fs.existsSync(aliasedLocPath), false, 'Re-saving aliased profile must consolidate stale duplicate .location.json file');
  assert.strictEqual(store.listLocationProfiles().profiles.length, 1, 'Consolidated profile must appear once in listLocationProfiles');
  const dirResidue = fs.readdirSync(locDirPath).filter((f) => f.endsWith('.tmp') || f.endsWith('.lock'));
  assert.strictEqual(dirResidue.length, 0, 'portableStore must leave zero leftover .tmp or .lock files after save');
  const aliasedDel = store.deleteLocationProfile('loc-renamed-check');
  assert.strictEqual(aliasedDel.success, true, 'deleteLocationProfile must delete consolidated .location.json by internal profileId');
  assert.strictEqual(store.listLocationProfiles().profiles.length, 0);

  // USB write-safety probe, OS write-protect error classifier, and atomicWriteBuffer verification
  const writableProbeRes = portableStore.probeDirectoryWriteSafety(tempUsbDir);
  assert.strictEqual(writableProbeRes.writable, true, 'probeDirectoryWriteSafety must pass on writable directory');
  assert.strictEqual(writableProbeRes.writeProtected, false);
  const probeResidue = fs.readdirSync(tempUsbDir).filter((f) => f.includes('ahbishare-write-probe'));
  assert.strictEqual(probeResidue.length, 0, 'probeDirectoryWriteSafety must leave zero probe temp files');

  const missingProbeRes = portableStore.probeDirectoryWriteSafety(path.join(tempUsbDir, 'non-existent-usb-subdir'));
  assert.strictEqual(missingProbeRes.writable, false);
  assert.strictEqual(missingProbeRes.writeProtected, false);

  const erofsErr = Object.assign(new Error('EROFS: read-only file system'), { code: 'EROFS' });
  const epermErr = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
  const enospcErr = Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
  assert.strictEqual(portableStore.classifyUsbWriteError(erofsErr).writeProtected, true);
  assert.strictEqual(portableStore.classifyUsbWriteError(epermErr).writeProtected, true);
  assert.strictEqual(portableStore.classifyUsbWriteError(enospcErr).writeProtected, false);

  const bufTarget = path.join(tempUsbDir, 'AhBiShare_Legacy_Test.reg');
  const regPayload = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Windows Registry Editor Version 5.00\r\n', 'utf16le')]);
  const bufWriteRes = portableStore.atomicWriteBuffer(bufTarget, regPayload);
  assert.strictEqual(bufWriteRes.success, true, 'atomicWriteBuffer must write UTF-16LE BOM buffer cleanly');
  assert.strictEqual(Buffer.compare(fs.readFileSync(bufTarget), regPayload), 0);

  const isNonRootPosix =
    process.platform !== 'win32' && (typeof process.getuid !== 'function' || process.getuid() !== 0);

  if (isNonRootPosix) {
    const lockedDir = path.join(tempUsbDir, 'locked-usb-sim');
    fs.mkdirSync(lockedDir);
    fs.chmodSync(lockedDir, 0o555);
    try {
      const lockedProbe = portableStore.probeDirectoryWriteSafety(lockedDir);
      assert.strictEqual(lockedProbe.writable, false, 'probeDirectoryWriteSafety must reject read-only USB directory');
      assert.strictEqual(lockedProbe.writeProtected, true, 'probeDirectoryWriteSafety must flag read-only directory as writeProtected');
    } finally {
      fs.chmodSync(lockedDir, 0o755);
    }
  }

  // Cross-platform (including Windows NTFS where chmod 0o555 on dirs is ignored) simulation of hardware/driver WriteProtect rejecting exclusive 'wx' probe
  {
    const wpProbeDir = path.join(tempUsbDir, 'writeprotect-probe-sim');
    fs.mkdirSync(wpProbeDir);
    const origOpenSync = fs.openSync;
    fs.openSync = function wrappedOpenSync(filePath, ...rest) {
      if (
        typeof filePath === 'string' &&
        path.resolve(path.dirname(filePath)) === path.resolve(wpProbeDir) &&
        path.basename(filePath).startsWith('.ahbishare-write-probe-')
      ) {
        throw Object.assign(new Error('EROFS: read-only file system (simulated USB WriteProtect)'), { code: 'EROFS' });
      }
      return origOpenSync.call(this, filePath, ...rest);
    };
    try {
      const wpProbe = portableStore.probeDirectoryWriteSafety(wpProbeDir);
      assert.strictEqual(wpProbe.writable, false, 'probeDirectoryWriteSafety must reject WriteProtect hardware/driver EROFS');
      assert.strictEqual(wpProbe.writeProtected, true, 'probeDirectoryWriteSafety must flag EROFS as writeProtected');
      assert.strictEqual(wpProbe.errorCode, 'EROFS');
    } finally {
      fs.openSync = origOpenSync;
    }
  }

  // 17th Deep Audit: loadPortableData must separate read/permission failures from JSON corruption and never quarantine .portable.json on writeProtected/unreadable errors
  const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-corrupt-test-'));
  try {
    const corruptStore = portableStore.createPortableStore({
      env: { PORTABLE_EXECUTABLE_DIR: corruptDir },
      app: { isPackaged: true, getPath: () => corruptDir },
    });
    const portablePath = path.join(corruptDir, portableStore.PORTABLE_FILE_NAME);

    // Case A: writable dir + genuine malformed JSON -> quarantines to .corrupt-*.json
    fs.writeFileSync(portablePath, '{not-valid-json', 'utf8');
    const corruptRes = corruptStore.loadPortableData();
    assert.strictEqual(corruptRes.success, false, 'Malformed JSON must return success: false');
    assert.strictEqual(fs.existsSync(portablePath), false, 'Genuine corrupt JSON on writable drive should be quarantined');
    const quarantinedFiles = fs.readdirSync(corruptDir).filter((f) => f.includes('.corrupt-'));
    assert.strictEqual(quarantinedFiles.length, 1, 'Genuine corrupt JSON should produce one .corrupt-*.json backup');

    // Case B: writeProtected (read-only dir on POSIX OR simulated WriteProtect EROFS on all OS incl. Windows) + malformed JSON -> must NOT attempt rename/quarantine
    if (isNonRootPosix) {
      const roCorruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-ro-corrupt-'));
      try {
        const roStore = portableStore.createPortableStore({
          env: { PORTABLE_EXECUTABLE_DIR: roCorruptDir },
          app: { isPackaged: true, getPath: () => roCorruptDir },
        });
        const roPortablePath = path.join(roCorruptDir, portableStore.PORTABLE_FILE_NAME);
        fs.writeFileSync(roPortablePath, '{corrupt-ro', 'utf8');
        fs.chmodSync(roCorruptDir, 0o555);
        try {
          const roLoadRes = roStore.loadPortableData();
          assert.strictEqual(roLoadRes.success, false);
          assert.strictEqual(roLoadRes.status?.writeProtected, true, 'Write-protected corrupt file load must report status.writeProtected: true');
          assert.strictEqual(fs.existsSync(roPortablePath), true, 'Write-protected .portable.json must remain untouched');
          assert.strictEqual(
            fs.readdirSync(roCorruptDir).filter((f) => f.includes('.corrupt-')).length,
            0,
            'Write-protected directory must not accumulate quarantine files'
          );
        } finally {
          fs.chmodSync(roCorruptDir, 0o755);
        }
      } finally {
        fs.rmSync(roCorruptDir, { recursive: true, force: true });
      }
    }

    {
      const wpCorruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-wp-corrupt-'));
      const origOpenSync = fs.openSync;
      try {
        const wpStore = portableStore.createPortableStore({
          env: { PORTABLE_EXECUTABLE_DIR: wpCorruptDir },
          app: { isPackaged: true, getPath: () => wpCorruptDir },
        });
        const wpPortablePath = path.join(wpCorruptDir, portableStore.PORTABLE_FILE_NAME);
        fs.writeFileSync(wpPortablePath, '{corrupt-wp', 'utf8');
        fs.openSync = function wrappedOpenSync(filePath, ...rest) {
          if (
            typeof filePath === 'string' &&
            path.resolve(path.dirname(filePath)) === path.resolve(wpCorruptDir) &&
            path.basename(filePath).startsWith('.ahbishare-write-probe-')
          ) {
            throw Object.assign(new Error('EROFS: read-only file system (simulated USB WriteProtect)'), { code: 'EROFS' });
          }
          return origOpenSync.call(this, filePath, ...rest);
        };
        const wpLoadRes = wpStore.loadPortableData();
        assert.strictEqual(wpLoadRes.success, false);
        assert.strictEqual(wpLoadRes.status?.writeProtected, true, 'Write-protected corrupt file load must report status.writeProtected: true on all platforms');
        assert.strictEqual(fs.existsSync(wpPortablePath), true, 'Write-protected .portable.json must remain untouched on all platforms');
        assert.strictEqual(
          fs.readdirSync(wpCorruptDir).filter((f) => f.includes('.corrupt-')).length,
          0,
          'Write-protected directory must not accumulate quarantine files on all platforms'
        );
      } finally {
        fs.openSync = origOpenSync;
        fs.rmSync(wpCorruptDir, { recursive: true, force: true });
      }
    }

    // Case C: unreadable/locked entry (directory at .portable.json or read error) -> must NOT quarantine as .corrupt
    const lockSimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-readerr-test-'));
    try {
      const lockStore = portableStore.createPortableStore({
        env: { PORTABLE_EXECUTABLE_DIR: lockSimDir },
        app: { isPackaged: true, getPath: () => lockSimDir },
      });
      const lockTargetPath = path.join(lockSimDir, portableStore.PORTABLE_FILE_NAME);
      fs.mkdirSync(lockTargetPath); // causes EISDIR read failure
      const readErrRes = lockStore.loadPortableData();
      assert.strictEqual(readErrRes.success, false);
      assert.strictEqual(fs.existsSync(lockTargetPath), true, 'Read/lock failure must NOT rename .portable.json to .corrupt');
      assert.strictEqual(
        fs.readdirSync(lockSimDir).filter((f) => f.includes('.corrupt-')).length,
        0,
        'Read/lock failure must never create .corrupt quarantine files'
      );
    } finally {
      fs.rmSync(lockSimDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(corruptDir, { recursive: true, force: true });
  }

  pass('Per-location .location.json AES-256-GCM encryption, BOM resilience, mixed-script ID & renamed-file CRUD & USB write-safety verified');
} finally {
  fs.rmSync(tempUsbDir, { recursive: true, force: true });
}

// 4. Verify PowerShell network drive mount & host guest / OS feature safeguards
const psEngineSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'powershellEngine.ts'), 'utf8').replace(/\r\n/g, '\n');
for (const marker of [
  'EnableLinkedConnections',
  'RestrictNullSessAccess',
  'Policies\\\\Microsoft\\\\Windows\\\\LanmanWorkstation',
  'New-SmbMapping',
  'Clear-HostAndDriveConflicts',
  'Invoke-NetUseBlankPass',
  'Invoke-WNetMap',
  'WNetAddConnection2',
  '/passwordreq:no',
  '[System.IO.File]::ReadAllLines',
  '[System.Text.Encoding]::Unicode',
  '$rawTok',
  '$canUseCliPass',
  "Invoke-WNetMap $p_drive $p_unc '' '' $p_persistBool",
  'LimitBlankPasswordUse',
  'S-1-5-7',
  'Restart-Service -Name LanmanServer',
  'Restart-Service -Name LanmanWorkstation',
  'LocalAccountTokenFilterPolicy',
  'SMB1Protocol-Client',
  'EditionID',
  'UBR',
  'rollbackSnapshot?: LegacyRollbackSnapshot | null',
  'ConvertTo-AhBiJson',
  'net.exe share',
  'Get-Command New-SmbShare',
]) {
  assert(psEngineSrc.includes(marker), `src/services/powershellEngine.ts missing safeguard: ${marker}`);
}
assert(!psEngineSrc.includes('($p_drive + "\\\\")'), 'powershellEngine.ts contains unterminated PowerShell backslash literal');
assert(
  !psEngineSrc.includes("Invoke-NetUseSafe @('use', $p_drive, $p_unc, '', '/user:Guest'") &&
    !psEngineSrc.includes("Invoke-NetUseSafe @('use', $p_drive, $p_unc, '\"\"', '/user:Guest'"),
  'powershellEngine.ts uses empty/quoted empty string array arg that PowerShell 5.1 strips or passes as literal quotes to native net.exe'
);
assert(
  psEngineSrc.includes('try { Set-SmbServerConfiguration -RejectUnencryptedAccess'),
  'powershellEngine.ts missing isolated ParameterBinding try/catch for -RejectUnencryptedAccess'
);
for (const win25Marker of [
  'Set-AhBiGuestNetworkLogonPolicy',
  'SeDenyNetworkLogonRight',
  'guestNetworkLogonDenied',
  "'Guest'",
  "'Anonymous'",
  'cmdkey.exe "/delete:$p_host"',
]) {
  assert(psEngineSrc.includes(win25Marker), `powershellEngine.ts missing Win 11 24H2/25H2 safeguard: ${win25Marker}`);
}
assert(
  psEngineSrc.includes('1385') && psEngineSrc.includes('1223') && psEngineSrc.includes('0x80070035'),
  'powershellEngine.ts must include Error 1385, 1223 and 0x80070035 diagnostics'
);
pass('Windows 7 SP1 ~ 11 26H2 PowerShell 2.0/5.1 fallbacks, Win32 WNetAddConnection2, Guest blank-password, SeDenyNetworkLogonRight & OS patch safeguards verified');

// 5. Verify NetworkMatrixPanel host-client mismatch detection, 1-click batch auto-align & 10-point rollback audit wiring
const netEvoSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'networkEvolution.ts'), 'utf8');
const bridgeSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'shareBridge.ts'), 'utf8').replace(/\r\n/g, '\n');
const matrixPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'NetworkMatrixPanel.tsx'), 'utf8');
const rollbackReportSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'SecurityRollbackReport.tsx'), 'utf8');
const rollbackPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'RollbackPanel.tsx'), 'utf8');

const typesSrc = fs.readFileSync(path.join(rootDir, 'src', 'types', 'share.ts'), 'utf8');
const expertViewSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ExpertComparisonView.tsx'), 'utf8');
const portableStoreAuditSrc = fs.readFileSync(path.join(rootDir, 'portableStore.js'), 'utf8');
assert(
  typesSrc.includes('HostPolicyComparison') &&
    typesSrc.includes('HostDiscrepancyLevel') &&
    typesSrc.includes('RawSecurityRegistrySnapshot') &&
    typesSrc.includes('ExpertRegistryPolicyRow'),
  'share.ts missing HostPolicyComparison / RawSecurityRegistrySnapshot / ExpertRegistryPolicyRow types'
);
assert(
  portableStoreAuditSrc.includes('rawRegistrySnapshot'),
  'portableStore.js sanitizeHostPolicySnapshot must preserve rawRegistrySnapshot'
);
for (const marker of ['extractAutoAlignModes', 'combineRebootJudgments', 'evaluateSecurityRollbackAudit', 'buildHostItemComparison', 'rawRegistryRecordToSnapshot', 'buildExpertRegistryComparisonRows', 'formatSecurityRollbackReportText', 'HOST_POLICY_REFERENCE_TARGETS', 'diff_ntlm', 'diff_uac_token', 'diff_guest_deny', 'Error 1385', 'Error 1223', 'Error 5 / 86 / 1326', 'Win 7${ver']) {
  assert(netEvoSrc.includes(marker), `networkEvolution.ts missing auto-align / audit / raw registry / diagnostic / OS label symbol: ${marker}`);
}
assert(
  netEvoSrc.indexOf("'Error 1385'") < netEvoSrc.indexOf("'Error 5 / 86 / 1326'") &&
    netEvoSrc.indexOf("'Error 5 / 86 / 1326'") < netEvoSrc.indexOf("'0x80070035 / 1272'") &&
    netEvoSrc.indexOf("'0x80070035 / 1272'") < netEvoSrc.indexOf("'Error 1223'"),
  'networkEvolution.ts classifyFailureDiagnostics must prioritize Error 1385 and Error 5 / 86 / 1326 before Error 1223'
);
assert(
  psEngineSrc.includes('everyoneIncludesAnonymous') &&
    psEngineSrc.includes('ahbiFirewallRulePresent') &&
    psEngineSrc.includes('buildRawSecurityRegistryScript'),
  'powershellEngine.ts must inspect everyoneIncludesAnonymous, ahbiFirewallRulePresent and export buildRawSecurityRegistryScript'
);
assert(
  bridgeSrc.includes('autoAlignHostClientPolicies(') && bridgeSrc.includes('fetchExpertRawRegistryComparison('),
  'shareBridge.ts missing autoAlignHostClientPolicies or fetchExpertRawRegistryComparison method'
);
assert(bridgeSrc.includes('Get-Command Remove-SmbMapping'), 'shareBridge.ts missing Win 7 Remove-SmbMapping guard in unmountDrive');
assert(
  bridgeSrc.includes('normalizeUnc(prev.uncPath) === normalizeUnc(live.uncPath)') &&
    bridgeSrc.includes('prev.folderPath === nextFolderPath'),
  'shareBridge.ts syncLiveState must validate UNC & folderPath changes before reusing stored metadata'
);
for (const uiId of ['matrix-auto-align-banner', 'btn-auto-align-top', 'btn-sync-cross-pc-policy', 'btn-copy-host-guide', 'SecurityRollbackReport', 'targetHostSnapshot={selectedHostSnap}', 'ExpertComparisonView']) {
  assert(matrixPanelSrc.includes(uiId), `NetworkMatrixPanel.tsx missing auto-align / audit / expert view UI element: ${uiId}`);
}
for (const rbId of ['security-rollback-report', 'btn-reverify-security-audit', 'btn-copy-security-audit', 'btn-harden-remaining-policies', 'security-audit-filter-host-diff', 'data-discrepancy={hc.status}']) {
  assert(rollbackReportSrc.includes(rbId), `SecurityRollbackReport.tsx missing audit UI element: ${rbId}`);
}
for (const exId of ['expert-comparison-view', 'btn-fetch-raw-registry', 'btn-copy-expert-registry', 'btn-toggle-expert-comparison', 'data-raw-side="local"', 'data-raw-side="host"']) {
  assert(expertViewSrc.includes(exId), `ExpertComparisonView.tsx missing Expert Comparison UI element: ${exId}`);
}
assert(
  rollbackPanelSrc.includes('SecurityRollbackReport') && rollbackPanelSrc.includes('btn-full-security-rollback'),
  'RollbackPanel.tsx must render SecurityRollbackReport and full rollback button'
);
pass('NetworkMatrixPanel host-client mismatch detection, 10-point rollback audit, Expert Comparison View raw registry, Error 1385/1223 diagnostics, Win 7/8 labels & 1-click auto-align verified');

// 6. Verify Legacy OS (Win 7/8/8.1 <-> Win 10/11) tab, .bat/.reg generator, and 2-step SMB1 guardrails
const topBarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TopBar.tsx'), 'utf8');
const legacyEngineSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'legacyScriptEngine.ts'), 'utf8');
const legacyPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LegacySharingPanel.tsx'), 'utf8');

assert(topBarSrc.includes('nav-legacy') && topBarSrc.includes('구형 OS 공유'), 'TopBar missing nav-legacy tab');
for (const marker of [
  'AhBiShare_Legacy_Apply.bat',
  'AhBiShare_Legacy_Apply.reg',
  'AhBiShare_Legacy_Rollback.bat',
  'AhBiShare_Legacy_Rollback.reg',
  'Backup_Before_Apply',
  'RejectUnencryptedAccess',
  '"RejectUnencryptedAccess"=dword:00000000',
  '/v everyoneincludesanonymous /t REG_DWORD /d 1',
  '/v restrictanonymous /t REG_DWORD /d 0',
  'LimitBlankPasswordUse',
  'if not exist "%BACKUP_DIR%\\\\LanmanServer.reg"',
  'dism /online /disable-feature /featurename:SMB1Protocol /norestart',
]) {
  assert(legacyEngineSrc.includes(marker), `legacyScriptEngine.ts missing marker: ${marker}`);
}
assert(
  legacyEngineSrc.includes('UserRights.inf') &&
    legacyEngineSrc.includes('SeDenyNetworkLogonRight') &&
    legacyEngineSrc.includes('[System.IO.File]::ReadAllLines($inf,[System.Text.Encoding]::Unicode)') &&
    legacyEngineSrc.includes('$rawTk') &&
    legacyEngineSrc.includes('[char]34'),
  'legacyScriptEngine.ts must back up/restore UserRights.inf, read UTF-16LE INF via ReadAllLines Unicode encoding, preserve non-guest quotes, and clear SeDenyNetworkLogonRight for Error 1385 parity'
);
assert(!legacyEngineSrc.includes('chcp 65001'), 'legacyScriptEngine.ts must avoid chcp 65001 in Win7 .bat scripts');
assert(
  !/Windows\\{1,2}LanmanWorkstation/.test(legacyEngineSrc.replace(/Policies\\{1,2}Microsoft\\{1,2}Windows\\{1,2}LanmanWorkstation/g, '')),
  'legacyScriptEngine.ts must always include Policies\\Microsoft\\Windows\\LanmanWorkstation'
);
assert(legacyPanelSrc.includes('encodeUtf16LeWithBom'), 'LegacySharingPanel.tsx missing UTF-16LE BOM encoder for .reg downloads');
assert(legacyPanelSrc.includes('legacy-direction-guidance'), 'LegacySharingPanel.tsx missing direction-aware guidance');
assert(legacyPanelSrc.includes('legacy-client-acc-user') && legacyPanelSrc.includes('legacy-client-acc-pass'), 'LegacySharingPanel.tsx missing accessible client account input IDs');
const clientPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ClientPanel.tsx'), 'utf8');
assert(clientPanelSrc.includes('htmlFor="client-acc-user"') && clientPanelSrc.includes('htmlFor="client-acc-pass"'), 'ClientPanel.tsx missing accessible account input labels');

for (const guardId of [
  'btn-legacy-step-host',
  'btn-legacy-step-client',
  'btn-legacy-host-oneclick',
  'btn-legacy-client-oneclick',
  'btn-apply-legacy-bridge',
  'btn-request-legacy-smb1-step1',
  'chk-legacy-smb1-ack',
  'btn-confirm-legacy-smb1',
  'btn-apply-legacy-rollback',
  'btn-export-legacy-usb',
]) {
  assert(legacyPanelSrc.includes(guardId), `LegacySharingPanel.tsx missing guardrail/action control: ${guardId}`);
}
pass('Legacy OS (Win 7/8/8.1 <-> Win 10/11) 2-step Main/Client 1-click, .bat/.reg bundle, rollback & guardrails verified');

// 7. Verify MIT LICENSE, CRLF English batch scripts, Inno Setup, Docs, Update Checker & GitHub Actions versioned-only release
const licenseTxt = fs.readFileSync(path.join(rootDir, 'LICENSE'), 'utf8');
assert(licenseTxt.includes('MIT License') && licenseTxt.includes('1998-2026 AhBiYout'), 'LICENSE missing MIT 1998-2026 AhBiYout');

assert(fs.existsSync(path.join(rootDir, 'build.bat')), 'Missing root build.bat');
assert(fs.existsSync(path.join(rootDir, 'scripts', 'upgradedHostGuestUnblock.bat')), 'Missing scripts/upgradedHostGuestUnblock.bat');
for (const batFile of ['build.bat', 'build_release.bat', 'push_github.bat', path.join('scripts', 'upgradedHostGuestUnblock.bat')]) {
  const batPath = path.join(rootDir, batFile);
  if (!fs.existsSync(batPath)) {
    continue; // .gitignore intentionally excludes build_release.bat and push_github.bat in CI checkouts
  }
  const batContent = fs.readFileSync(batPath, 'utf8');
  assert(
    batContent.includes('\r\n') && !/(?<!\r)\n/.test(batContent),
    `${batFile} must use Windows CRLF line endings on every line`
  );
  assert(!/[^\x00-\x7F]/.test(batContent), `${batFile} must be pure English ASCII`);
}
const upgradedGuestBat = fs.readFileSync(path.join(rootDir, 'scripts', 'upgradedHostGuestUnblock.bat'), 'utf8');
for (const batMarker of [
  '/v LimitBlankPasswordUse /t REG_DWORD /d 0 /f',
  '/active:yes /passwordreq:no',
  'SeDenyNetworkLogonRight',
  'netsh advfirewall firewall add rule name="AhBiShare-SMB-445"',
  'localport=445',
  'profile=private,domain',
  '*S-1-1-0:(OI)(CI)F',
  'AHBI_HAS_WARN',
  'AHBI_NO_PAUSE',
]) {
  assert(upgradedGuestBat.includes(batMarker), `scripts/upgradedHostGuestUnblock.bat missing required marker: ${batMarker}`);
}
assert(
  !/StorageDevicePolicies|diskpart|attrib\s+\+r\b/i.test(upgradedGuestBat),
  'scripts/upgradedHostGuestUnblock.bat must never contain USB write-protection patterns'
);
const rootBuildBat = fs.readFileSync(path.join(rootDir, 'build.bat'), 'utf8');
assert(
  rootBuildBat.includes("require('./package.json').version") &&
    rootBuildBat.includes('_v%APP_VER%') &&
    rootBuildBat.includes('explorer "%~dp0release"'),
  'build.bat must resolve version from metadata, append _v%APP_VER% to EXEs, and open release output folder'
);

const issSrc = fs.readFileSync(path.join(rootDir, 'installer', 'setup.iss'), 'utf8');
for (const marker of [
  'AppId={{C78A43E8-2E11-4B33-91EC-5D9F48C8B101}',
  'C78A43E8-2E11-4B33-91EC-5D9F48C8B101',
  'AhBiShare_OneClick-Setup_v{#AppVersion}',
  '#define AppPublisher "AhBiYout"',
  'AppCopyright={#AppCopyright}',
  'WizardSilent()',
  'taskkill.exe',
  'AhBiShare_OneClick_v{#AppVersion}',
  'AhBiShare_OneClick_Win7_v{#AppVersion}',
  'win-unpacked\\*',
]) {
  assert(issSrc.includes(marker), `installer/setup.iss missing marker: ${marker}`);
}

for (const docFile of [
  'README.md',
  'PATCH_NOTES.md',
  'VERSIONING.md',
  'google_blogger_post.md',
  'github_release_post.md',
  'github_release_guide.md',
]) {
  assert(fs.existsSync(path.join(rootDir, 'docs', docFile)), `Missing docs/${docFile}`);
}
for (const verDoc of ['PATCH_NOTES.md', 'google_blogger_post.md', 'github_release_post.md']) {
  const docBody = fs.readFileSync(path.join(rootDir, 'docs', verDoc), 'utf8');
  assert(
    docBody.includes(`v${rootPkg.version}`),
    `docs/${verDoc} must record the current release version v${rootPkg.version}`
  );
}
const bloggerDoc = fs.readFileSync(path.join(rootDir, 'docs', 'google_blogger_post.md'), 'utf8');
assert(
  bloggerDoc.includes('[작성 모드 (서식 있는 텍스트)]') && bloggerDoc.includes('[HTML 편집 모드]'),
  'docs/google_blogger_post.md must provide both Compose Mode (Rich Text) and HTML Edit Mode sections'
);

const workflowSrc = fs.readFileSync(path.join(rootDir, '.github', 'workflows', 'release.yml'), 'utf8');
assert(workflowSrc.includes('release-github/*_v*.exe'), '.github/workflows/release.yml must upload only version-numbered executables');
assert(workflowSrc.includes('gh release delete-asset'), '.github/workflows/release.yml must prune stale/unversioned assets from existing releases');
assert(!workflowSrc.includes('dist/*.zip') && !workflowSrc.includes('android') && !workflowSrc.includes('.apk'), '.github/workflows/release.yml must exclude zip/mobile artifacts');

const gitignoreSrc = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
for (const ignoredEntry of [
  'push_github.bat',
  'push_github*.bat',
  'build_release.bat',
  '/app/',
  '.aistudio/',
  'metadata.json',
  '/public/assets/aistudio/',
  '*.portable.json',
  '*.location.json',
  '/locations/',
  'AhBiShare_CrossOS_Sync_Bridge*.json',
  'AhBiShare_Legacy_Win7_Win8_Kit/',
  'AhBiShare_*.bat',
  'AhBiShare_*.reg',
  '_ahbishare_update/',
  '*.part',
  '*apply_portable_update.ps1',
  '/release-win7/',
  '/release-github/',
  'builder-debug.yml',
]) {
  assert(gitignoreSrc.includes(ignoredEntry), `.gitignore must exclude ${ignoredEntry}`);
}
assert(!gitignoreSrc.includes('AhBiYout-Helper'), '.gitignore contains stale repo reference');

const pushBatPath = path.join(rootDir, 'push_github.bat');
if (fs.existsSync(pushBatPath)) {
  const pushBatSrc = fs.readFileSync(pushBatPath, 'utf8');
  assert(
    pushBatSrc.includes('EnableDelayedExpansion') &&
      pushBatSrc.includes('git reset --soft origin/main') &&
      pushBatSrc.includes('core.quotepath=false') &&
      pushBatSrc.includes('public/assets/aistudio') &&
      pushBatSrc.includes('git ls-files --cached --error-unmatch') &&
      pushBatSrc.includes('git push -u origin HEAD:main') &&
      pushBatSrc.includes('--cached --ignore-unmatch app metadata.json push_github.bat'),
    'push_github.bat must enable delayed expansion, link origin/main safely, untrack public/assets/aistudio & non-ASCII ignored paths, guard excluded files, and push to main'
  );
}

const readmeSrc = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
assert(
  readmeSrc.includes('build.bat') &&
    readmeSrc.includes('electron:build:win7') &&
    readmeSrc.includes(`_v${rootPkg.version}.exe`) &&
    readmeSrc.includes('README.en.md'),
  'README.md must document build.bat, electron:build:win7, version-numbered EXEs, and link README.en.md'
);
const readmeEnSrc = fs.readFileSync(path.join(rootDir, 'README.en.md'), 'utf8');
assert(
  readmeEnSrc.includes('build.bat') &&
    readmeEnSrc.includes('electron:build:win7') &&
    readmeEnSrc.includes(`_v${rootPkg.version}.exe`) &&
    readmeEnSrc.includes('README.md') &&
    readmeEnSrc.includes('AhBiYout'),
  'README.en.md must document build.bat, electron:build:win7, version-numbered EXEs, AhBiYout copyright, and link README.md'
);

const win7BuildCfg = JSON.parse(fs.readFileSync(path.join(rootDir, 'build-config-win7.json'), 'utf8'));
assert(
  win7BuildCfg.directories?.output === 'release-win7',
  'build-config-win7.json must isolate output to release-win7 so release/win-unpacked is preserved'
);

const mainJsSrc = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
assert(
  mainJsSrc.includes('New-Object PSObject -Property') &&
    mainJsSrc.includes('$ser.Serialize($resHash)') &&
    !mainJsSrc.includes('[PSCustomObject]@{') &&
    !/\s-(?:in|notin)\b/.test(mainJsSrc),
  'main.js must use PowerShell 2.0 compatible syntax (Hashtable for JavaScriptSerializer, no [PSCustomObject]@{} or -in/-notin)'
);
assert(
  mainJsSrc.includes('Get-Variable -Name PSDefaultParameterValues') &&
    mainJsSrc.includes('decodeXmlEntities(contentMatch[1])') &&
    mainJsSrc.includes('return { ok: true, release: null };') &&
    mainJsSrc.includes('resolvedBasePrefix') &&
    mainJsSrc.includes('res.complete') &&
    mainJsSrc.includes('cleanupPromise') &&
    mainJsSrc.includes('hasRealUtf16Interleaving') &&
    mainJsSrc.includes('strictUtf8 === null') &&
    mainJsSrc.includes("stdio: ['ignore', 'pipe', 'pipe']"),
  'main.js must guard PSDefaultParameterValues, decode UTF-8 with stray NULs without CJK mojibake, ignore stdin on PowerShell spawn, handle empty Atom feed, support drive-root save-legacy-scripts, and guard stream completeness/cancel cleanup'
);

assert(
  mainJsSrc.includes("parsedUrl.protocol !== 'https:'") &&
    mainJsSrc.includes('isPortableReplacementQueued') &&
    mainJsSrc.includes('totalBytes > 0 ?') &&
    mainJsSrc.includes('!updaterProc || !updaterProc.pid') &&
    mainJsSrc.includes("updaterProc.once('error'") &&
    mainJsSrc.includes('clearTimeout(exitTimer)') &&
    mainJsSrc.includes(`require('./package.json').version || '${rootPkg.version}'`),
  'main.js must validate HTTPS redirects, guard double replacement & spawn PID/error cancellation, format unknown-total progress, and sync APP_PKG_VERSION fallback'
);

assert(
  !/\s-(?:in|notin)\b/.test(psEngineSrc) &&
    psEngineSrc.includes('-notcontains $_.Name') &&
    psEngineSrc.includes('if ($nbtIfaces)') &&
    (psEngineSrc.match(/RejectUnencryptedAccess/g) || []).length >= 5,
  'powershellEngine.ts must use PowerShell 2.0 compatible -notcontains, guard $nbtIfaces, and clear RejectUnencryptedAccess across guest & legacy compat flows'
);

const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8').replace(/\r\n/g, '\n');
assert(
  appSrc.includes('checkForUpdates(APP_VERSION)') &&
    appSrc.includes('currentVersion={APP_VERSION}') &&
    appSrc.includes('autoRevoked: revoked') &&
    appSrc.includes('updateCheckInFlightRef') &&
    appSrc.includes('z-[60]') &&
    appSrc.includes('if (batchRes.appliedShares > 0 || batchRes.appliedMounts > 0)') &&
    appSrc.includes('const allOk = rollbackRes.success && strictRes.success;') &&
    appSrc.includes('showToast(res.success ? res.rebootJudgment.title : res.summary)'),
  'App.tsx must use centralized APP_VERSION, prevent overlapping checks, render toasts above modals, refresh OS policy after batch apply, check rollbackRes && strictRes success, and report accurate error toasts/autoRevoked state'
);

const updateModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'UpdateModal.tsx'), 'utf8');
assert(
  updateModalSrc.includes('role="dialog"') &&
    updateModalSrc.includes('aria-modal="true"') &&
    updateModalSrc.includes('github-update-modal') &&
    updateModalSrc.includes('btn-update-download') &&
    updateModalSrc.includes('btn-auto-replace-portable') &&
    updateModalSrc.includes('btn-cancel-portable-update') &&
    updateModalSrc.includes('portable-update-progress') &&
    updateModalSrc.includes('hasUserSelectedAssetRef') &&
    updateModalSrc.includes('btn-skip-update-version') &&
    updateModalSrc.includes('formatBytesHuman') &&
    updateModalSrc.includes('수신 중'),
  'UpdateModal.tsx must provide accessible dialog ARIA attributes, update confirmation, sticky selection, clean byte units, and portable auto-replace progress actions'
);

assert(
  bridgeSrc.includes('exportCrossOsBridgeBundle') &&
    bridgeSrc.includes('importCrossOsBridgeData') &&
    bridgeSrc.includes('mergedPolicies') &&
    bridgeSrc.includes('sanitizeLocalShareForStorage(') &&
    bridgeSrc.includes('sanitizeLocalShareForStorage(sanitizedLocal, netInfo)') &&
    bridgeSrc.includes('promotedPortableEntries') &&
    bridgeSrc.includes('guestNetworkLogonDenied: Boolean(parsed.guestNetworkLogonDenied)'),
  'shareBridge.ts missing cross-OS bidirectional bridge sync, hostPolicies merge, localStorage sanitization, or guestNetworkLogonDenied propagation'
);
assert(
  bridgeSrc.includes('Get-Command Get-SmbShare') && bridgeSrc.includes('net.exe share $p_share /delete /y'),
  'shareBridge.ts removeHostShare missing Win 7 PowerShell 2.0 net.exe share delete fallback'
);
const typesShareSrc = fs.readFileSync(path.join(rootDir, 'src', 'types', 'share.ts'), 'utf8');
assert(
  typesShareSrc.includes('username?: string;') &&
    bridgeSrc.includes('cacheLocationProfileCredentials(') &&
    bridgeSrc.includes('setCachedPassword(trimmedHost, trimmedShare, config.password)') &&
    bridgeSrc.includes('...(trimmedUser ? { username: trimmedUser } : {})'),
  'share.ts & shareBridge.ts must preserve MountedDrive.username, cache client passwords on mount, and cache Electron location credentials on load/import'
);
const portableStoreSrc = fs.readFileSync(path.join(rootDir, 'portableStore.js'), 'utf8');
assert(
  portableStoreSrc.includes('lmCompatibilityLevel') &&
    portableStoreSrc.includes('localAccountTokenFilterEnabled') &&
    portableStoreSrc.includes('guestNetworkLogonDenied') &&
    portableStoreSrc.includes('path.basename(filePath)'),
  'portableStore.js must preserve lmCompatibilityLevel, localAccountTokenFilterEnabled, guestNetworkLogonDenied, and use per-target temp filenames in atomicWriteJson'
);
assert(
  rootBuildBat.includes('HAS_EXE'),
  'build.bat must verify versioned executable output exists before reporting success'
);
assert(
  legacyPanelSrc.includes('onBridgeImported') &&
    legacyPanelSrc.includes('importCrossOsBridgeData(content, netInfo)') &&
    legacyPanelSrc.includes('aria-label={`${share.shareName} 공유 해제`}') &&
    !legacyPanelSrc.includes('window.location.reload()'),
  'LegacySharingPanel.tsx must pass netInfo, provide accessible icon labels, and refresh state cleanly via onBridgeImported'
);
const viteCfgSrc = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf8');
assert(
  viteCfgSrc.includes("target: 'chrome106'") &&
    viteCfgSrc.includes("cssTarget: 'chrome100'") &&
    viteCfgSrc.includes("cssMinify: 'lightningcss'"),
  'vite.config.ts must target chrome106/chrome100 with lightningcss so Electron 21 (Win7/8) lowers oklch() colors cleanly'
);
const distAssetsDir = path.join(rootDir, 'dist', 'assets');
if (fs.existsSync(distAssetsDir)) {
  const cssFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.css'));
  for (const cssFile of cssFiles) {
    const cssText = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8');
    assert(!cssText.includes('oklch('), `Built ${cssFile} still contains raw oklch() unsupported in Win7 Electron 21 Chromium 106`);
  }
}
const updateCheckerSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'updateChecker.ts'), 'utf8');
assert(
  updateCheckerSrc.includes('comparePreRelease') && updateCheckerSrc.includes("split('+')[0]"),
  'updateChecker.ts must strip +buildMetadata and compare numeric pre-release identifiers per SemVer 2.0'
);

// 8. Verify per-location UI components, bridge methods, and App.tsx wiring
const locBarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LocationProfileBar.tsx'), 'utf8');
const locModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LocationManagerModal.tsx'), 'utf8');
const locEditViewSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LocationProfileEditView.tsx'), 'utf8');
for (const uiId of [
  'location-profile-bar',
  'select-location-profile',
  'btn-open-save-location',
  'btn-quick-import-location',
  'btn-open-location-manager',
  'btn-edit-active-location',
  'btn-batch-apply-location',
  'location-batch-result',
]) {
  assert(locBarSrc.includes(uiId), `LocationProfileBar.tsx missing control: ${uiId}`);
}
assert(
  locModalSrc.includes('role="dialog"') &&
    locModalSrc.includes('aria-modal="true"') &&
    locModalSrc.includes("e.key === 'Escape'") &&
    locModalSrc.includes('!loadingEditId') &&
    locModalSrc.includes('btn-save-new-location') &&
    locModalSrc.includes('btn-modal-import-json') &&
    locModalSrc.includes('LocationProfileEditView') &&
    locModalSrc.includes('onUpdateProfile') &&
    locModalSrc.includes('wasOpenRef') &&
    locModalSrc.includes('loadingEditId ?'),
  'LocationManagerModal.tsx missing accessible dialog, Escape/loadingEditId guard, wasOpenRef open-edge init, edit loading state, edit view, or save/import controls'
);
for (const editUiId of [
  'edit-loc-name',
  'edit-loc-desc',
  'edit-loc-patch-mode',
  'btn-edit-add-share',
  'btn-edit-add-client',
  'btn-cancel-location-edit',
  'btn-save-location-edit',
]) {
  assert(locEditViewSrc.includes(editUiId), `LocationProfileEditView.tsx missing edit control: ${editUiId}`);
}
assert(
  locEditViewSrc.includes("k.startsWith('share-')") &&
    locEditViewSrc.includes("k.startsWith('client-')") &&
    locEditViewSrc.includes('nextTtl ? {} : { autoRevokeOnExpiry: false }') &&
    locEditViewSrc.includes("mode === 'guest' ? { password: '', encryptedCredentials: undefined } : {}"),
  'LocationProfileEditView.tsx must re-index visiblePasswords on row deletion, clear autoRevokeOnExpiry when hostPreset TTL is cleared, and clear stale credentials when switching to guest mode'
);
assert(
  psEngineSrc.includes('Wait-Job -Job $job -Timeout 6'),
  'powershellEngine.ts buildRawSecurityRegistryScript must allow at least 6s for remote registry Wait-Job'
);
const hostPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'HostPanel.tsx'), 'utf8');
assert(
  hostPanelSrc.includes("pendingHostPreset.config.shareName !== 'AhBiShared'") &&
    !hostPanelSrc.includes('pendingHostPreset.config.password || prev.password'),
  'HostPanel.tsx must only set shareNameCustomized for non-default share name and must not carry over prev.password across profile presets'
);
assert(
  clientPanelSrc.includes('driveLetterOptions'),
  'ClientPanel.tsx missing dynamic driveLetterOptions for custom loaded location drive letters'
);
for (const fnMarker of [
  'normalizeLocationProfileId',
  'buildLocationProfileSnapshot',
  'listLocationProfiles',
  'saveLocationProfile',
  'saveEditedLocationProfile',
  'loadLocationProfile',
  'deleteLocationProfile',
  'exportLocationProfileFile',
  'importLocationProfileFile',
  'importLocationProfileFromJson',
  'applyLocationProfileBatch',
  '보안 계정 모드의 공유 암호를 복원할 수 없습니다',
  '보안 계정 모드의 접속 암호가 비어 있습니다',
]) {
  assert(bridgeSrc.includes(fnMarker), `shareBridge.ts missing location/credential guard: ${fnMarker}`);
}
assert(
  bridgeSrc.includes('username = username || dec.username;') &&
    !bridgeSrc.includes('username = dec.username || username;') &&
    bridgeSrc.includes('const res = await window.ahbiShareElectron.saveLocationProfile(profile);') &&
    /if \(res\.success && res\.profile\) \{\r?\n\s+this\.cacheLocationProfileCredentials\(res\.profile\);/.test(bridgeSrc),
  'shareBridge.ts must prioritize explicit username in loadWebPreviewPortable and re-cache decrypted res.profile after Electron saveLocationProfile'
);
assert(
  rollbackPanelSrc.includes('const res = await onFullSecurityRollback();') &&
    rollbackPanelSrc.includes("setFeedback({ scope: 'full', ...res });") &&
    appSrc.includes('return { success: allOk, message: msg };') &&
    /if \(!jobKey\) \{\r?\n\s+return \{ success: false, message: '다른 작업이 진행 중입니다\.' \};/.test(appSrc),
  'App.tsx handleFullSecurityRollback & RollbackPanel.tsx must propagate exact full rollback success/failure state instead of hardcoding success: true'
);
assert(
  modMain.includes("let stagingDir = '';") &&
    modMain.includes('if (!stagingDir) return;') &&
    modMain.includes("stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-portable-update-'));"),
  'main.js install-portable-update must create stagingDir inside try/catch with null-guarded cleanupStaging'
);
assert(
  appSrc.includes('LocationProfileBar') &&
    appSrc.includes('LocationManagerModal') &&
    appSrc.includes('WorkProgressModal') &&
    appSrc.includes('startProgressJob') &&
    appSrc.includes('applyLocationProfileToWorkspace') &&
    appSrc.includes('handleLoadLocationProfileForEdit') &&
    appSrc.includes('handleUpdateLocationProfile') &&
    appSrc.includes("firstShare.authMode === 'account' ? firstShare.password || '' : ''") &&
    appSrc.includes("preset.authMode === 'account' ? preset.password || '' : ''") &&
    appSrc.includes('Copyright © 1998-2026 AhBiYout. All rights reserved.'),
  'App.tsx missing LocationProfileBar / LocationManagerModal / WorkProgressModal wiring, profile edit handlers, cross-profile password isolation, or AhBiYout copyright'
);
  const validSharesBridgeCheck =
    bridgeSrc.includes('const validShares = profile.savedShares.filter') &&
    bridgeSrc.includes('호스트 공유폴더(${i + 1}/${validShares.length})');
  assert(
    validSharesBridgeCheck,
    'shareBridge.ts applyLocationProfileBatch must filter validShares identically to App.tsx before emitting progress indices'
  );
  const progressModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'WorkProgressModal.tsx'), 'utf8');
  const indexCssSrc = fs.readFileSync(path.join(rootDir, 'src', 'index.css'), 'utf8');
  assert(
    progressModalSrc.includes('role="dialog"') &&
      progressModalSrc.includes('aria-modal="true"') &&
      progressModalSrc.includes('AUTO_CLOSE_DELAY_MS = 1500') &&
      progressModalSrc.includes('ahbi-motion-ring-cw') &&
      progressModalSrc.includes('ahbi-motion-ring-ccw') &&
      progressModalSrc.includes('if (e.target === e.currentTarget && !isRunning)') &&
      progressModalSrc.includes("document.body.style.overflow = 'hidden'") &&
      progressModalSrc.includes('modalRef') &&
      progressModalSrc.includes('previousFocusRef') &&
      indexCssSrc.includes('@keyframes ahbi-ring-cw') &&
      indexCssSrc.includes('@keyframes ahbi-ring-ccw') &&
      indexCssSrc.includes('animation-iteration-count: 1 !important'),
    'WorkProgressModal.tsx / src/index.css missing dual-ring animation, running lock, focus trap, scroll lock, reduced-motion iteration limit, or 1.5s success auto-close guard'
  );
  const netEvoAuditSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'networkEvolution.ts'), 'utf8');
  const connCodeAuditSrc = fs.readFileSync(path.join(rootDir, 'src', 'utils', 'connectionCode.ts'), 'utf8');
  assert(
    typesShareSrc.includes('guestAccountEnabled?: boolean;') &&
      psEngineSrc.includes('const shouldDisableGuest501 = !rollbackSnapshot?.guestAccountEnabled;') &&
      psEngineSrc.includes('$guestLegacyWmi') &&
      bridgeSrc.includes('guestAccountEnabled: Boolean(current.guestAccountEnabled)') &&
      bridgeSrc.includes('everyoneIncludesAnonymous: restoredGuestAllow') &&
      bridgeSrc.includes('let diskHostPreset: LocationHostPreset | undefined;') &&
      bridgeSrc.includes('encryptWebSimCredentials(hpUser, hpPass)') &&
      bridgeSrc.includes('decryptWebSimCredentials(hp.encryptedCredentials)') &&
      netEvoAuditSrc.includes('cliRequireSig: isPreset ? (snap.smbServerSigningRequired ? 1 : 0) : null') &&
      netEvoAuditSrc.includes('everyAnon: isPreset ? (snap.allowInsecureGuestAuth ? 1 : 0) : null') &&
      locEditViewSrc.includes('validateShareName') &&
      locEditViewSrc.includes('validateFolderPath') &&
      locEditViewSrc.includes('validateTargetHost') &&
      locEditViewSrc.includes('호스트 폼 프리셋의 보안 계정 비밀번호를 입력하세요.') &&
      mainJsSrc.includes("cleanTarget.startsWith('-')") &&
      connCodeAuditSrc.includes('/^-/.test(trimmed)') &&
      updateCheckerSrc.includes('/^https?:\\/\\//i.test(rawTarget)') &&
      !updateCheckerSrc.includes('window.open('),
    '11th audit regressions failed: legacy_bridge_rollback *-501 Guest disable, web sim symmetry, Web Preview location encryption, non-preset snapshot guard, LocationProfileEditView validation, leading-hyphen guard, or openExternalReleaseUrl safety'
  );
  const locPreflightModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LocationPreflightModal.tsx'), 'utf8');
  assert(
    typesShareSrc.includes('LocationPreflightReport') &&
      typesShareSrc.includes('LocationPreflightItemResult') &&
      psEngineSrc.includes('buildLocationPreflightScript') &&
      bridgeSrc.includes('preflightLocationProfileBatch') &&
      bridgeSrc.includes('buildLocationPreflightScript(') &&
      locPreflightModalSrc.includes('role="dialog"') &&
      locPreflightModalSrc.includes('aria-modal="true"') &&
      locPreflightModalSrc.includes('preflight-summary-banner') &&
      locPreflightModalSrc.includes('btn-preflight-rerun') &&
      locPreflightModalSrc.includes('btn-preflight-edit-profile') &&
      locPreflightModalSrc.includes('btn-preflight-confirm-apply') &&
      appSrc.includes('LocationPreflightModal') &&
      appSrc.includes('runPreflightCheckForProfile') &&
      appSrc.includes('executeBatchApplyLocation'),
    'Location batch Pre-flight Check (types, PowerShell engine, shareBridge, LocationPreflightModal UI & App wiring) check failed'
  );
  const clientPanelAuthSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ClientPanel.tsx'), 'utf8');
  const legacyPanelAuthSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LegacySharingPanel.tsx'), 'utf8');
  assert(
    connCodeAuditSrc.includes('resolveClientAccountCredentials') &&
      connCodeAuditSrc.includes('validateAccountUsername') &&
      clientPanelAuthSrc.includes('showClientPass') &&
      clientPanelAuthSrc.includes('EyeOff') &&
      legacyPanelAuthSrc.includes('showLegacyClientPass') &&
      appSrc.includes('inferredTarget'),
    'Client credential resolution helper, validateAccountUsername, password visibility toggles in ClientPanel/LegacySharingPanel, and App.tsx inferred client target fallback must be present'
  );
  const presetGridSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'PresetPasswordGrid.tsx'), 'utf8');
  const matrixRefreshSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'NetworkMatrixPanel.tsx'), 'utf8');
  assert(
    presetGridSrc.includes("username: 'Visitor'") &&
      !presetGridSrc.includes("username: 'Guest'") &&
      hostPanelSrc.includes('PresetPasswordGrid') &&
      hostPanelSrc.includes('validateAccountUsername') &&
      hostPanelSrc.includes('disabled={isExecuting || isRefreshing}') &&
      clientPanelAuthSrc.includes('PresetPasswordGrid') &&
      clientPanelAuthSrc.includes('switchToAccountMode') &&
      clientPanelAuthSrc.includes('getHostCandidates') &&
      clientPanelAuthSrc.includes('disabled={isConnecting || isRefreshing}') &&
      legacyPanelAuthSrc.includes('PresetPasswordGrid') &&
      legacyPanelAuthSrc.includes('validateAccountUsername') &&
      legacyPanelAuthSrc.includes('getHostCandidates') &&
      legacyPanelAuthSrc.includes('disabled={isScanning || isRefreshing}') &&
      rollbackPanelSrc.includes('disabled={busyScope !== null || isInspecting || isRefreshing}') &&
      hostPanelSrc.includes('btn-refresh-host') &&
      clientPanelAuthSrc.includes('btn-refresh-client') &&
      matrixRefreshSrc.includes('btn-refresh-matrix') &&
      legacyPanelAuthSrc.includes('btn-refresh-legacy') &&
      appSrc.includes('btn-refresh-logs') &&
      rollbackPanelSrc.includes('btn-refresh-rollback') &&
      appSrc.includes('activeLocationProfileRef'),
    '12th audit regressions failed: numeric account presets (Visitor avoiding *-501 Guest lock), validateAccountUsername, hostCandidates, switchToAccountMode, 6-tab refresh buttons, or concurrency guards missing'
  );
  assert(
    locEditViewSrc.includes('validateAccountUsername') &&
      locModalSrc.includes('!isSaving && !isBatchApplying && !loadingEditId') &&
      locModalSrc.includes('disabled={isSaving || isBatchApplying || Boolean(loadingEditId)}') &&
      locModalSrc.includes('disabled={isSaving || isBatchApplying}') &&
      bridgeSrc.includes('const resolvedAuthMode: AuthMode =') &&
      bridgeSrc.includes('decodeConnectionCode(s.connectionCode)') &&
      bridgeSrc.includes('this.pingHost(host, [], netInfo)') &&
      (mainJsSrc.match(/if \(downloadState\.cancelled\)/g) || []).length >= 2 &&
      psEngineSrc.includes('[int]$lmKey.LmCompatibilityLevel -lt 3') &&
      bridgeSrc.includes('webSimPolicyBase.lmCompatibilityLevel < 3') &&
      rollbackReportSrc.includes('report!.recommendedModes.length > 0') &&
      !rollbackReportSrc.includes('report!.partialCount > 0'),
    '13th audit regressions failed: LocationProfileEditView validateAccountUsername, LocationManagerModal loadingEditId/isBatchApplying guards, shareBridge client account snapshot & Web Preview hydration & preflight ping netInfo, main.js updater cancel race guard, strict_26h2_default LmCompatibilityLevel < 3 hardening, or SecurityRollbackReport remediation condition'
  );
  assert(
    progressModalSrc.includes('const onCloseRef = useRef(onClose);') &&
      !progressModalSrc.includes('}, [job.isOpen, isSuccess, job.jobKey, onClose]);') &&
      !progressModalSrc.includes('}, [job.isOpen, isRunning, onClose]);') &&
      locPreflightModalSrc.includes('const onCloseRef = useRef(onClose);') &&
      !locPreflightModalSrc.includes('}, [isOpen, isChecking, isExecuting, onClose]);') &&
      legacyPanelAuthSrc.includes('driveLetterOptions') &&
      legacyPanelAuthSrc.includes('switchToAccountMode') &&
      legacyPanelAuthSrc.includes('diag.isHostAuthOrGuestIssue') &&
      legacyPanelAuthSrc.includes('buildHostGuestUnlockPsCommand') &&
      legacyPanelAuthSrc.includes('if (isBusy) return;') &&
      appSrc.includes('onOpenDiagnostics={(errText) => {') &&
      hostPanelSrc.includes('if (isExecuting || isRefreshing) return;') &&
      clientPanelAuthSrc.includes('if (isConnecting || isRefreshing) return;') &&
      mainJsSrc.includes('tagName = decodeURIComponent(tagMatch[1]);') &&
      mainJsSrc.includes('tagName = tagMatch[1];'),
    '14th audit regressions failed: WorkProgressModal/LocationPreflightModal onCloseRef timer/listener stability, LegacySharingPanel failure recovery parity/driveLetterOptions/isBusy submit guard, HostPanel/ClientPanel Enter-key busy guards, or main.js Atom tag decodeURIComponent try/catch guard'
  );
  const legacyScriptEngineSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'legacyScriptEngine.ts'), 'utf8');
  assert(
    legacyPanelAuthSrc.includes("const checkServerHostSide = direction === 'bidirectional' || direction === 'modern_to_legacy';") &&
      legacyPanelAuthSrc.includes("const checkClientSide = direction === 'bidirectional' || direction === 'legacy_to_modern';") &&
      legacyPanelAuthSrc.includes('policyStatus.firewall445Allowed === false') &&
      legacyPanelAuthSrc.includes('policyStatus.guestNetworkLogonDenied') &&
      legacyScriptEngineSrc.includes('[char]34+$gName+[char]34') &&
      legacyScriptEngineSrc.includes('게스트$') &&
      legacyScriptEngineSrc.includes('LanmanWorkstationPolicy.reg') &&
      legacyScriptEngineSrc.includes('Resetting modified security values to hardened baseline first...') &&
      legacyScriptEngineSrc.includes('@FirewallAPI.dll,-28502') &&
      legacyScriptEngineSrc.includes('profile=any') &&
      legacyScriptEngineSrc.includes('/featurename:SMB1Protocol /all /norestart') &&
      psEngineSrc.includes('/v forceguest /t REG_DWORD /d 0') &&
      psEngineSrc.includes('HNetCfg.FwPolicy2') &&
      psEngineSrc.includes('AhBiShare-Legacy-SMB-445') &&
      psEngineSrc.includes('mrxsmb10 start= demand') &&
      psEngineSrc.includes('로컬 공유 계정 생성/갱신 실패 (') &&
      netEvoAuditSrc.includes("code: 'Error 58'") &&
      netEvoAuditSrc.includes('snap.osBuild > 0 && snap.osBuild < 10240 ? 1 : 0') &&
      bridgeSrc.includes('build > 0 && build < 9200') &&
      bridgeSrc.includes('async ensureLegacyRollbackSnapshot(') &&
      appSrc.includes('await shareBridge.ensureLegacyRollbackSnapshot(freshNet)'),
    '15th audit (Legacy OS sharing verification) regressions failed: inverted direction check, [char]34/게스트$ quote & SID handling, baseline-first rollback overlay, forceguest=0 reset, HNetCfg.FwPolicy2 Win 7 profile, AhBiShare-Legacy-SMB-445 detection, Win 7 mrxsmb10 demand rollback, Error 58 diagnostic, Win 7/8.1 osDisplayVersion fallback, or account-mode client guest-unlock skip'
  );
  const typesShareProbeSrc = fs.readFileSync(path.join(rootDir, 'src', 'types', 'share.ts'), 'utf8');
  const probeBarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ShareAuthProbeBar.tsx'), 'utf8');
  assert(
    typesShareProbeSrc.includes('export interface ShareAuthProbeResult') &&
      typesShareProbeSrc.includes("'client_guest_blocked'") &&
      psEngineSrc.includes('export function buildShareAuthProbeScript(') &&
      psEngineSrc.includes('WNetCancelConnection2') &&
      psEngineSrc.includes('lpLocalName = $null') &&
      psEngineSrc.includes('existing_session_conflict') &&
      psEngineSrc.includes("-ieq 'IPC$'") &&
      psEngineSrc.includes('$hasExplicitCredReject') &&
      mainJsSrc.includes("Arguments = ('view ' + [char]34 + '\\\\\\\\' + $p_ip + [char]34)") &&
      mainJsSrc.includes('$procNv.WaitForExit(4000)') &&
      mainJsSrc.includes('authModeHint = $hint') &&
      bridgeSrc.includes('async probeShareAuthMode(') &&
      clientPanelAuthSrc.includes('<ShareAuthProbeBar') &&
      clientPanelAuthSrc.includes('suppressedAutoSwitchKeysRef') &&
      clientPanelAuthSrc.includes('inFlightProbeRef') &&
      clientPanelAuthSrc.includes('completedProbeRef') &&
      clientPanelAuthSrc.includes('ahbishare:autoswitch-changed') &&
      legacyPanelAuthSrc.includes('<ShareAuthProbeBar') &&
      legacyPanelAuthSrc.includes('runLegacyShareAuthProbe') &&
      legacyPanelAuthSrc.includes('inFlightProbeRef') &&
      legacyPanelAuthSrc.includes('ahbishare:autoswitch-changed') &&
      probeBarSrc.includes('auto-switch-toggle') &&
      probeBarSrc.includes('btn-undo-autoswitch') &&
      !probeBarSrc.includes('border-l-4'),
    'Manual NAS/Share auth probe & 16th audit regressions failed: ShareAuthProbeResult, buildShareAuthProbeScript IPC$/precedence, main.js ProcessStartInfo 4s timeout/authModeHint, probeShareAuthMode, ShareAuthProbeBar Zero-Pill banner, or ClientPanel/LegacySharingPanel inFlightProbeRef race guards missing'
  );
  const connCodeUncSrc = fs.readFileSync(path.join(rootDir, 'src', 'utils', 'connectionCode.ts'), 'utf8');
  assert(
    connCodeUncSrc.includes('export function resolveActiveShareUncPath(') &&
      hostPanelSrc.includes('resolveActiveShareUncPath(share, netInfo.primaryIp)') &&
      hostPanelSrc.includes('탐색기에서 열기') &&
      hostPanelSrc.includes('onOpenFolder(uncTarget)') &&
      legacyPanelAuthSrc.includes('resolveActiveShareUncPath(share, netInfo.primaryIp)') &&
      legacyPanelAuthSrc.includes('탐색기에서 열기') &&
      legacyPanelAuthSrc.includes('onOpenPath(uncTarget)') &&
      bridgeSrc.includes('Windows 탐색기에서 열었습니다:') &&
      mainJsSrc.includes("const explorerExe = fs.existsSync(candidateExe) ? candidateExe : 'explorer.exe';") &&
      mainJsSrc.includes('spawn(explorerExe, [normalized], {'),
    'ActiveShare Open-in-Explorer UNC feature assertions failed: resolveActiveShareUncPath, HostPanel/LegacySharingPanel button, or main.js explorer.exe UNC handler missing'
  );
  assert(
    typesShareProbeSrc.includes('export interface SmartAuthDetectionResult') &&
      typesShareProbeSrc.includes('export interface SmartAuthTargetInput') &&
      bridgeSrc.includes('export interface') === false && // sanity: interfaces live in types/share.ts
      bridgeSrc.includes('SMART_AUTH_CACHE_TTL_MS') &&
      bridgeSrc.includes('function parseSmartAuthTarget(') &&
      bridgeSrc.includes('function resolveKnownSmartAuthHint(') &&
      bridgeSrc.includes('clearSmartAuthCache(') &&
      bridgeSrc.includes('evaluateSmartAuthDecision(') &&
      bridgeSrc.includes('async detectSmartShareAuth(') &&
      bridgeSrc.includes('isSmartAuthSuppressed(') &&
      bridgeSrc.includes('setSmartAuthSuppressed(') &&
      probeBarSrc.includes('smartResult?: SmartAuthDetectionResult | null') &&
      probeBarSrc.includes('canAlignSession') &&
      clientPanelAuthSrc.includes('shareBridge.detectSmartShareAuth(') &&
      clientPanelAuthSrc.includes('shareBridge.evaluateSmartAuthDecision(') &&
      legacyPanelAuthSrc.includes('shareBridge.detectSmartShareAuth(') &&
      legacyPanelAuthSrc.includes('shareBridge.evaluateSmartAuthDecision(') &&
      connCodeUncSrc.includes('export function isValidIpv4Address(') &&
      bridgeSrc.includes('async probeSmbTarget(') &&
      appSrc.includes('const probeSmbTarget = useCallback(') &&
      appSrc.includes('[clientDraft.targetHost, probeSmbTarget]'),
    'Smart Auth Detection assertions failed: SmartAuthDetectionResult types, shareBridge.detectSmartShareAuth/probeSmbTarget/suppression/caching, isValidIpv4Address, App.tsx probeSmbTarget useEffect, ShareAuthProbeBar smartResult, or ClientPanel/LegacySharingPanel integration missing'
  );
  assert(
    appSrc.includes("if (finalDecision.action !== 'auto_switch' || !finalDecision.switchToMode) return;") &&
      appSrc.includes('hasValidAbshareTokenRef') &&
      appSrc.includes('skipNextIpProbeHostRef') &&
      appSrc.includes('onAbshareTokenValidityChange') &&
      clientPanelAuthSrc.includes('pendingClientAuthMode.targetHost') &&
      clientPanelAuthSrc.includes('pendingClientAuthMode.switchedFrom ||') &&
      clientPanelAuthSrc.includes("setCodeParseState('empty');") &&
      clientPanelAuthSrc.includes("setRawCodeInput('');") &&
      legacyPanelAuthSrc.includes("setCodeParseState('empty');") &&
      legacyPanelAuthSrc.includes("setRawCodeInput('');") &&
      portableStoreSrc.includes('function readUtf8WithRetrySync(') &&
      portableStoreSrc.includes('if (!loc.writeProtected)') &&
      mainJsSrc.includes('writeProtected: Boolean(writeRes.writeProtected)') &&
      readmeSrc.includes('탐색기에서 열기') &&
      readmeSrc.includes('probeSmbTarget') &&
      readmeEnSrc.includes('Open in Explorer') &&
      readmeEnSrc.includes('probeSmbTarget') &&
      fs.readFileSync(path.join(rootDir, 'docs', 'PATCH_NOTES.md'), 'utf8').includes('제17차 자아성찰 심층 점검') &&
      fs.readFileSync(path.join(rootDir, 'docs', 'github_release_post.md'), 'utf8').includes('17차 자아성찰 심층 점검') &&
      bloggerDoc.includes('17차 자아성찰') &&
      bloggerDoc.includes('탐색기에서 열기') &&
      bloggerDoc.includes('probeSmbTarget'),
    '17th Deep Audit & doc sync assertions failed: App.tsx strict Smart Auth policy/suppression/token guard, ClientPanel pendingClientAuthMode debounce preservation & rawCodeInput reset, LegacySharingPanel suppression & rawCodeInput reset, portableStore readUtf8WithRetrySync, main.js export writeProtected propagation, or updated docs missing'
  );
  pass('LICENSE, CRLF .bat scripts, Inno Setup, Win 7 isolation & Chromium 106 CSS, Cross-OS sync, location profiles & accessibility verified');

// 9. Functional unit test of portableUpdater.js (runtime detection, edition matching, URL allowlist, PE verification, PS 2.0 script)
const portableUpdater = require(path.join(rootDir, 'portableUpdater.js'));
const tmpUpdaterDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-updater-verify-'));
try {
  const fakeOldExe = path.join(tmpUpdaterDir, "AhBiShare_OneClick-Lite_v1.0.0'test.exe");
  const validPeBuf = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(2046, 0)]);
  fs.writeFileSync(fakeOldExe, validPeBuf);

  const peCheck = portableUpdater.validateDownloadedExecutable(fakeOldExe, validPeBuf.length);
  assert.strictEqual(peCheck.valid, true, 'Valid MZ PE buffer must pass validateDownloadedExecutable');

  const badPePath = path.join(tmpUpdaterDir, 'bad.exe');
  fs.writeFileSync(badPePath, '<html>404 Not Found</html>'.repeat(100));
  const badCheck = portableUpdater.validateDownloadedExecutable(badPePath);
  assert.strictEqual(badCheck.valid, false, 'HTML response must fail PE validation');

  const liteRuntime = portableUpdater.detectPortableRuntimeInfo({
    env: { PORTABLE_EXECUTABLE_FILE: fakeOldExe },
    app: { isPackaged: true, getName: () => 'AhBiShare_OneClick_Lite', getVersion: () => '1.0.0' },
    execPath: 'C:\\Temp\\app.exe',
    platform: 'win32',
    osBuild: 26100,
  });
  assert.strictEqual(liteRuntime.isPortable, true);
  assert.strictEqual(liteRuntime.canSelfReplace, true);
  assert.strictEqual(liteRuntime.writeProtected, false);
  assert.strictEqual(liteRuntime.edition, 'lite');

  assert.strictEqual(
    portableUpdater.detectEdition({
      appName: 'AhBiShare_OneClick',
      portableExePath: 'D:\\Win7_Backup\\Lite_Folder\\AhBiShare_OneClick_v1.0.0.exe',
      execPath: 'C:\\LiteTemp\\app.exe',
      electronVersion: '41.3.0',
      osBuild: 26100,
    }),
    'standard',
    'detectEdition must ignore win7/lite substrings in parent directory names'
  );

  const sampleAssets = [
    { name: 'AhBiShare_OneClick-Setup_v1.1.0.exe', browserDownloadUrl: 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/download/v1.1.0/AhBiShare_OneClick-Setup_v1.1.0.exe', size: 100 },
    { name: 'AhBiShare_OneClick_v1.1.0.exe', browserDownloadUrl: 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/download/v1.1.0/AhBiShare_OneClick_v1.1.0.exe', size: 100 },
    { name: 'AhBiShare_OneClick-Lite_v1.1.0.exe', browserDownloadUrl: 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/download/v1.1.0/AhBiShare_OneClick-Lite_v1.1.0.exe', size: 100 },
    { name: 'AhBiShare_OneClick_Win7_v1.1.0.exe', browserDownloadUrl: 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/download/v1.1.0/AhBiShare_OneClick_Win7_v1.1.0.exe', size: 100 },
  ];
  assert.strictEqual(
    portableUpdater.selectMatchingPortableAsset(sampleAssets, { edition: 'standard', osBuild: 26100 }).name,
    'AhBiShare_OneClick_v1.1.0.exe'
  );
  assert.strictEqual(
    portableUpdater.selectMatchingPortableAsset(sampleAssets, { edition: 'lite', osBuild: 26100 }).name,
    'AhBiShare_OneClick-Lite_v1.1.0.exe'
  );
  assert.strictEqual(
    portableUpdater.selectMatchingPortableAsset(sampleAssets, { edition: 'win7', osBuild: 7601 }).name,
    'AhBiShare_OneClick_Win7_v1.1.0.exe'
  );

  assert.strictEqual(
    portableUpdater.isAllowedGitHubDownloadUrl('https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/download/v1.1.0/AhBiShare_OneClick_v1.1.0.exe'),
    true
  );
  assert.strictEqual(
    portableUpdater.isAllowedGitHubDownloadUrl('https://objects.githubusercontent.com/github-production-release-asset-2e65be/test'),
    true
  );
  assert.strictEqual(
    portableUpdater.isAllowedGitHubDownloadUrl('https://evil.example.com/payload.exe'),
    false
  );

  const parsedHtmlAssets = portableUpdater.parseExpandedAssetsHtml(
    '<a href="/ahbiyout-all/AhBiShare-OneClick/releases/download/v1.1.0/AhBiShare_OneClick_v1.1.0.exe">dl</a>'
  );
  assert.strictEqual(parsedHtmlAssets.length, 1);
  assert.strictEqual(parsedHtmlAssets[0].name, 'AhBiShare_OneClick_v1.1.0.exe');

  const psSelfScript = portableUpdater.buildPortableSelfUpdatePsScript({
    appPid: 1234,
    parentPid: 1200,
    oldExePath: fakeOldExe,
    stagedExePath: path.join(tmpUpdaterDir, 'new.exe'),
    targetExePath: path.join(tmpUpdaterDir, 'AhBiShare_OneClick-Lite_v1.1.0.exe'),
    stagingDir: tmpUpdaterDir,
  });
  const probeIdx = psSelfScript.indexOf('.ahbishare_update_probe_');
  const removeOldIdx = psSelfScript.indexOf('Remove-Item -LiteralPath $oldExe -Force');
  assert(
    probeIdx >= 0 &&
      removeOldIdx > probeIdx &&
      psSelfScript.includes('exit 4') &&
      psSelfScript.includes('Remove-Item -LiteralPath $oldExe -Force') &&
      psSelfScript.includes('Copy-Item -LiteralPath $stagedExe -Destination $targetExe -Force') &&
      psSelfScript.includes('old_portable_backup.exe') &&
      psSelfScript.includes('Test-ValidPeExe $targetExe') &&
      psSelfScript.includes('Copy-Item -LiteralPath $backupOldExe -Destination $oldExe -Force') &&
      psSelfScript.includes('Start-Process -FilePath $targetExe') &&
      psSelfScript.includes("''test.exe") &&
      !psSelfScript.includes('[PSCustomObject]@{') &&
      !/\s-(?:in|notin)\b/.test(psSelfScript),
    'buildPortableSelfUpdatePsScript must be PS 2.0 compatible, probe USB writability before modifying oldExe (exit 4), backup old EXE, verify target PE MZ header with rollback, escape single quotes, delete old EXE, copy target EXE, and relaunch'
  );

  // Verify USB write-safety: ZERO write-protection injection patterns anywhere in app runtime/scripts, and atomic USB saves in main.js
  assert(
    mainJsSrc.includes('probeDirectoryWriteSafety(targetDir)') &&
      mainJsSrc.includes('atomicWriteBuffer(outPath, fileBuf)') &&
      mainJsSrc.includes('probeDirectoryWriteSafety(runtime.portableDir)'),
    'main.js must verify target directory write safety and use atomicWriteBuffer in save-legacy-scripts and check portableDir write safety before portable self-update'
  );
  const issSrc = fs.readFileSync(path.join(rootDir, 'installer', 'setup.iss'), 'utf8');
  for (const [label, srcText] of [
    ['main.js', mainJsSrc],
    ['portableStore.js', portableStoreSrc],
    ['portableUpdater.js', fs.readFileSync(path.join(rootDir, 'portableUpdater.js'), 'utf8')],
    ['src/services/powershellEngine.ts', psEngineSrc],
    ['src/services/legacyScriptEngine.ts', legacyScriptEngineSrc],
    ['src/services/shareBridge.ts', bridgeSrc],
    ['src/services/troubleshootPlaybook.ts', fs.readFileSync(path.join(rootDir, 'src', 'services', 'troubleshootPlaybook.ts'), 'utf8')],
    ['installer/setup.iss', issSrc],
  ]) {
    assert(
      !/StorageDevicePolicies|diskpart|attrib\s+\+r\b|IsReadOnly\s*=\s*\$true|Set-Disk|Set-Volume|autorun\.inf|\b0o4[04]0\b/i.test(srcText),
      `${label} must NEVER inject USB write-protection policies, diskpart readonly attributes, attrib +R, IsReadOnly=$true, autorun.inf, or 0o444/0o400 read-only modes`
    );
  }

  pass('portableUpdater.js runtime edition detection, GitHub asset allowlist, PE validation, PS 2.0 pre-delete USB probe & zero write-protect injection verified');
} finally {
  fs.rmSync(tmpUpdaterDir, { recursive: true, force: true });
}

// 10. Functional unit test of Semantic Versioning 3-tier bump & auto patch-note recorder
const bumpTool = require(path.join(rootDir, 'scripts', 'bump_version.js'));
assert.strictEqual(bumpTool.computeNextSemVer('1.1.0', 'major'), '2.0.0');
assert.strictEqual(bumpTool.computeNextSemVer('1.1.0', 'minor'), '1.2.0');
assert.strictEqual(bumpTool.computeNextSemVer('1.1.0', 'patch'), '1.1.1');
const tmpBumpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-semver-verify-'));
try {
  fs.mkdirSync(path.join(tmpBumpRoot, 'public'), { recursive: true });
  fs.mkdirSync(path.join(tmpBumpRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpBumpRoot, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(tmpBumpRoot, 'installer'), { recursive: true });
  fs.writeFileSync(path.join(tmpBumpRoot, 'package.json'), JSON.stringify({ name: 'test', version: '1.1.0' }, null, 2));
  fs.writeFileSync(path.join(tmpBumpRoot, 'public', 'config.json'), JSON.stringify({ version: '1.1.0' }, null, 2));
  fs.writeFileSync(path.join(tmpBumpRoot, 'src', 'version.ts'), "export const APP_VERSION = '1.1.0';\n");
  fs.writeFileSync(path.join(tmpBumpRoot, 'installer', 'setup.iss'), '#define AppVersion "1.1.0"\n');
  fs.writeFileSync(path.join(tmpBumpRoot, 'README.md'), '# AhBiShare OneClick v1.1.0\nAhBiShare_OneClick_v1.1.0.exe\n');
  fs.writeFileSync(path.join(tmpBumpRoot, 'docs', 'PATCH_NOTES.md'), '# 🛠 AhBiShare OneClick 패치 노트 (Patch Notes)\n\n## 📅 v1.1.0\n');
  fs.writeFileSync(path.join(tmpBumpRoot, 'docs', 'google_blogger_post.md'), 'AhBiShare OneClick v1.1.0\nAhBiShare_OneClick_v1.1.0.exe\n');
  fs.writeFileSync(path.join(tmpBumpRoot, 'docs', 'github_release_post.md'), 'AhBiShare OneClick v1.1.0\nAhBiShare_OneClick-Lite_v1.1.0.exe\n');

  const bumpRes = bumpTool.runBump({
    level: 'patch',
    summary: 'Win7 테스트 패치',
    notes: ['특이점 자동 기록 테스트'],
    targetRoot: tmpBumpRoot,
  });
  assert.strictEqual(bumpRes.nextVersion, '1.1.1');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmpBumpRoot, 'package.json'), 'utf8')).version, '1.1.1');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmpBumpRoot, 'public', 'config.json'), 'utf8')).version, '1.1.1');
  assert(fs.readFileSync(path.join(tmpBumpRoot, 'src', 'version.ts'), 'utf8').includes('1.1.1'));
  const patchText = fs.readFileSync(path.join(tmpBumpRoot, 'docs', 'PATCH_NOTES.md'), 'utf8');
  assert(patchText.includes('v1.1.1') && patchText.includes('[PATCH]') && patchText.includes('특이점 자동 기록 테스트'));
  assert(patchText.indexOf('v1.1.1') < patchText.indexOf('v1.1.0'), 'New patch note must appear above previous version');
  pass('Semantic Versioning 3-tier (MAJOR.MINOR.PATCH) sync & auto PATCH_NOTES.md recorder verified');
} finally {
  fs.rmSync(tmpBumpRoot, { recursive: true, force: true });
}

// 11. Verify USB bidirectional troubleshootTickets persistence, credential stripping, shareBridge preservation & wizard wiring
const tmpTroubleshootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-troubleshoot-'));
try {
  const tsStore = portableStore.createPortableStore({
    env: { PORTABLE_EXECUTABLE_DIR: tmpTroubleshootDir },
    app: { isPackaged: true, getPath: () => tmpTroubleshootDir },
  });

  // Verify credential sanitization helper strips passwords, tokens, and cmdkey /pass
  const redactedSummary = portableStore.stripSensitiveCredentialText(
    'Failed with ABSHARE://abcDEF12345== password=MySuperSecret! cmdkey /add:192.168.0.10 /user:Admin /pass:SecretPass99'
  );
  assert(!redactedSummary.includes('abcDEF12345=='), 'stripSensitiveCredentialText must redact ABSHARE:// tokens');
  assert(!redactedSummary.includes('MySuperSecret!'), 'stripSensitiveCredentialText must redact plaintext password=');
  assert(!redactedSummary.includes('SecretPass99'), 'stripSensitiveCredentialText must redact cmdkey /pass');

  const sampleTicket = {
    ticketId: 'ts-verify-1385',
    schemaVersion: 1,
    originRole: 'client',
    originHostName: 'CLIENT-LAB-01',
    originIp: '192.168.0.55',
    targetHostName: 'MAIN-OFFICE-PC',
    targetIp: '192.168.0.105',
    shareName: 'WorkDocs',
    driveLetter: 'Z:',
    authMode: 'guest',
    errorCode: 'Error 1385',
    errorTitle: '호스트 PC 게스트 네트워크 로그온 차단',
    rawErrorSummary: 'net use Z: \\\\192.168.0.105\\WorkDocs /user:Admin Secret999 failed: error 1385',
    recommendedSide: 'host',
    hostSteps: [
      {
        stepId: 'host-1-unlock',
        side: 'host',
        order: 1,
        title: '호스트 Guest 로그온 거부 해제',
        description: 'SeDenyNetworkLogonRight 제거',
        executor: 'host_guest_unlock_and_reopen',
        status: 'pending',
      },
    ],
    clientSteps: [
      {
        stepId: 'client-1-retry',
        side: 'client',
        order: 1,
        title: '클라이언트 재연결',
        description: '호스트 조치 후 재연결',
        executor: 'retry_mount',
        status: 'pending',
      },
    ],
    status: 'open',
    createdAt: '2026-11-23T01:00:00.000Z',
    updatedAt: '2026-11-23T01:00:00.000Z',
  };

  const tsSave1 = tsStore.savePortableData({
    schemaVersion: 1,
    updatedAt: '2026-11-23T01:00:00.000Z',
    shares: [],
    troubleshootTickets: [sampleTicket],
  });
  assert.strictEqual(tsSave1.success, true, 'Saving troubleshootTickets to .portable.json must succeed');

  const rawDiskJson = JSON.parse(fs.readFileSync(path.join(tmpTroubleshootDir, portableStore.PORTABLE_FILE_NAME), 'utf8'));
  assert.strictEqual(rawDiskJson.troubleshootTickets.length, 1);
  assert(!rawDiskJson.troubleshootTickets[0].rawErrorSummary.includes('Secret999'), 'Disk .portable.json must not retain /user:... password');

  const tsLoad1 = tsStore.loadPortableData();
  assert.strictEqual(tsLoad1.success, true);
  assert.strictEqual(tsLoad1.document.troubleshootTickets.length, 1);
  assert.strictEqual(tsLoad1.document.troubleshootTickets[0].errorCode, 'Error 1385');
  assert.strictEqual(tsLoad1.document.troubleshootTickets[0].hostSteps[0].executor, 'host_guest_unlock_and_reopen');

  // Update ticket status to host_fixed -> resolved -> manual delete empty array
  const tsSave2 = tsStore.savePortableData({
    schemaVersion: 1,
    updatedAt: '2026-11-23T01:05:00.000Z',
    shares: [],
    troubleshootTickets: [{ ...sampleTicket, status: 'host_fixed' }],
  });
  assert.strictEqual(tsSave2.document.troubleshootTickets[0].status, 'host_fixed');

  const tsSaveCleared = tsStore.savePortableData({
    schemaVersion: 1,
    updatedAt: '2026-11-23T01:10:00.000Z',
    shares: [],
    troubleshootTickets: [],
  });
  assert.strictEqual(tsSaveCleared.document.troubleshootTickets, undefined, 'Manual ticket cleanup must omit empty troubleshootTickets on disk');

  const playbookSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'troubleshootPlaybook.ts'), 'utf8');
  const bannerSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TroubleshootHandoffBanner.tsx'), 'utf8');
  const wizardSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TroubleshootWizardModal.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');
  const hostPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'HostPanel.tsx'), 'utf8');
  const clientPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ClientPanel.tsx'), 'utf8');

  for (const sym of ['buildTroubleshootTicketDraft', 'upsertTroubleshootTicketList', 'recomputeTroubleshootTicketStatus', 'evaluateTroubleshootTicketsForPc', 'detectTicketMatchSideForPc', 'sortWizardStepsBySuccessProbability']) {
    assert(playbookSrc.includes(sym), `troubleshootPlaybook.ts missing ${sym}`);
  }
  for (const bridgeSym of ['recordTroubleshootError(', 'updateTroubleshootTicket(', 'deleteTroubleshootTicket(', 'clearResolvedTroubleshootTickets(', 'runHostGuestUnlockDirect(', 'clearConflictingSmbSessions(']) {
    assert(bridgeSrc.includes(bridgeSym), `shareBridge.ts missing ${bridgeSym}`);
  }
  // Ensure every savePortableData call site in shareBridge.ts preserves troubleshootTickets
  const saveCallCount = (bridgeSrc.match(/savePortableData\(/g) || []).length;
  const preserveFieldCount = (bridgeSrc.match(/troubleshootTickets/g) || []).length;
  assert(
    saveCallCount >= 8 && preserveFieldCount >= saveCallCount + 8,
    'shareBridge.ts must preserve troubleshootTickets across all savePortableData call sites'
  );
  assert(
    bannerSrc.includes('troubleshoot-handoff-banner') &&
      bannerSrc.includes('btn-open-troubleshoot-wizard') &&
      bannerSrc.includes('btn-clear-resolved-troubleshoot'),
    'TroubleshootHandoffBanner.tsx missing required IDs/actions'
  );
  assert(
    wizardSrc.includes('troubleshoot-wizard-backdrop') &&
      wizardSrc.includes('btn-wizard-stage-1') &&
      wizardSrc.includes('btn-wizard-stage-2') &&
      wizardSrc.includes('btn-wizard-stage-3') &&
      wizardSrc.includes('btn-wizard-verify-445') &&
      wizardSrc.includes('btn-wizard-mark-resolved') &&
      wizardSrc.includes('btn-wizard-delete-ticket'),
    'TroubleshootWizardModal.tsx missing 3-step wizard controls'
  );
  assert(
    appSrc.includes('TroubleshootHandoffBanner') &&
      appSrc.includes('TroubleshootWizardModal') &&
      appSrc.includes('captureTroubleshootFailure') &&
      appSrc.includes('autoOpenedTroubleshootKeysRef'),
    'App.tsx missing USB error handoff capture, banner, or auto-open wizard wiring'
  );
  assert(hostPanelSrc.includes('btn-host-failure-open-wizard'), 'HostPanel.tsx missing wizard trigger button');
  assert(clientPanelSrc.includes('btn-failure-open-wizard'), 'ClientPanel.tsx missing wizard trigger button');
  assert(
    legacyPanelSrc.includes('btn-legacy-host-failure-open-wizard') && legacyPanelSrc.includes('btn-legacy-failure-open-wizard'),
    'LegacySharingPanel.tsx missing host/client wizard trigger buttons'
  );

  // Verify real-world trace fixes: RawUI BufferSize widening, partial timeout stderr preservation, timed out regex,
  // ProcessStartInfo non-blocking net.exe wrapper, batch folder/NTFS/SMB ACL/Guest/warning/private-domain firewall/verification,
  // Error 86 account-mode branching, guest unlock lock-in on retry_host_share, cached credential recovery, and ticket reclassification
  assert(
    mainJsSrc.includes('RawUI.BufferSize') &&
      mainJsSrc.includes('$bs.Width -lt 512') &&
      mainJsSrc.includes('partialErr ? `${timeoutMsg}'),
    'main.js must widen RawUI.BufferSize to avoid 80-col error wrapping and preserve partialErr on timeout'
  );
  assert(
    netEvoSrc.includes('timed\\s*out') && netEvoSrc.includes('시간\\s*초과'),
    'networkEvolution.ts classifyFailureDiagnostics must classify PowerShell "timed out" messages'
  );
  assert(
    psEngineSrc.includes('$psi.RedirectStandardInput = $true') &&
      psEngineSrc.includes('$proc.WaitForExit(8000)') &&
      /buildHostGuestUnlockBatchScript\(\r?\n\s*shareName = 'AhBiShared',\r?\n\s*folderPath = 'C:\\\\AhBiShared'\r?\n\)/.test(psEngineSrc) &&
      psEngineSrc.includes('profile=private,domain') &&
      psEngineSrc.includes('AHBI_HAS_WARN') &&
      psEngineSrc.includes('*S-1-1-0:(OI)(CI)F') &&
      psEngineSrc.includes('upgradedHostGuestUnblock.bat') &&
      psEngineSrc.includes("$psiBat.RedirectStandardInput = $true") &&
      psEngineSrc.includes('$procBat.StandardInput.Close()') &&
      psEngineSrc.includes("$psiBat.EnvironmentVariables['AHBI_NO_PAUSE'] = '1'") &&
      psEngineSrc.includes('$procBat.WaitForExit(15000)') &&
      psEngineSrc.includes('export function buildHostEmptyPasswordBlockPsScript') &&
      psEngineSrc.includes('/v LimitBlankPasswordUse /t REG_DWORD /d 1 /f') &&
      hostPanelSrc.includes('buildHostGuestUnlockBatchScript(config.shareName, config.folderPath)'),
    'powershellEngine.ts / HostPanel.tsx missing non-blocking ProcessStartInfo wrapper, upgradedHostGuestUnblock.bat invocation, buildHostEmptyPasswordBlockPsScript, or upgraded host guest unblock batch script'
  );
  const emptyPwdToggleSrc = fs.readFileSync(
    path.join(rootDir, 'src', 'components', 'EmptyPasswordPolicyToggle.tsx'),
    'utf8'
  );
  assert(
    emptyPwdToggleSrc.includes('role="switch"') &&
      emptyPwdToggleSrc.includes('btn-toggle-block-empty-password') &&
      emptyPwdToggleSrc.includes('Block Empty-Password Accounts') &&
      emptyPwdToggleSrc.includes('upgradedHostGuestUnblock.bat') &&
      emptyPwdToggleSrc.includes('LimitBlankPasswordUse=') &&
      hostPanelSrc.includes('EmptyPasswordPolicyToggle') &&
      hostPanelSrc.includes('onToggleBlockEmptyPasswordAccounts') &&
      bridgeSrc.includes('async toggleBlockEmptyPasswordAccounts(') &&
      appSrc.includes('handleToggleBlockEmptyPasswordAccounts') &&
      appSrc.includes('isTogglingEmptyPasswordPolicy'),
    'EmptyPasswordPolicyToggle / HostPanel / shareBridge / App missing Block Empty-Password Accounts toggle wiring'
  );
  assert(
    playbookSrc.includes('reclassifyTroubleshootTicketOnRetryFailure') &&
      playbookSrc.includes("if (input.authMode === 'account')") &&
      bridgeSrc.includes('getCachedSharePassword(') &&
      appSrc.includes('reclassifyTroubleshootTicketOnRetryFailure') &&
      appSrc.includes('hostUnlockedByWizard') &&
      appSrc.includes('shouldReclassifyOnRetryFailure'),
    'troubleshootPlaybook.ts / shareBridge.ts / App.tsx missing account-mode branching, hostUnlockedByWizard guard, cached password fallback, or retry reclassification'
  );

  pass('USB bidirectional troubleshootTickets persistence, credential stripping, cross-PC matcher, 3-step wizard & real-world trace fixes verified');
} finally {
  fs.rmSync(tmpTroubleshootDir, { recursive: true, force: true });
}

// 12. Verify app-directory <appDir>/log/ file logging, credential scrubbing, IPC & UI wiring
const tmpAppLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-applog-'));
try {
  const logStore = portableStore.createPortableStore({
    env: { PORTABLE_EXECUTABLE_DIR: tmpAppLogDir },
    app: { isPackaged: true, getPath: () => tmpAppLogDir },
  });

  const expectedLogDir = path.join(tmpAppLogDir, 'log');
  const writeOk = logStore.appendAppLog({
    role: '메인 PC',
    hostName: 'HOST-LOG-PC',
    status: 'success',
    summary: '공유폴더(WorkDocs) 개설 완료 password=LeakSecret!2026 ABSHARE://secretTokenPayload123',
  });
  assert.strictEqual(writeOk.success, true, 'appendAppLog must create <appDir>/log and write log file');
  assert.strictEqual(path.resolve(writeOk.directory), path.resolve(expectedLogDir));
  assert(writeOk.filePath.startsWith(expectedLogDir + path.sep) && writeOk.fileName.endsWith('.log'));

  const writeErr = logStore.appendAppLog({
    role: '클라이언트 PC',
    hostName: 'CLIENT-LOG-PC',
    status: 'error',
    summary: '연결 실패 cmdkey /add:192.168.0.10 /user:Admin /pass:HiddenPass99',
  });
  assert.strictEqual(writeErr.success, true);

  const rawLogFile = fs.readFileSync(writeOk.filePath, 'utf8');
  assert(rawLogFile.startsWith('\uFEFF'), 'App log file must start with UTF-8 BOM for clean Windows Notepad Korean display');
  assert(rawLogFile.includes('[HOST-LOG-PC] [SUCCESS] [메인 PC]'));
  assert(rawLogFile.includes('[CLIENT-LOG-PC] [ERROR] [클라이언트 PC]'));
  assert(!rawLogFile.includes('LeakSecret!2026'), 'App log file must strip plaintext password=');
  assert(!rawLogFile.includes('secretTokenPayload123'), 'App log file must strip ABSHARE:// token payload');
  assert(!rawLogFile.includes('HiddenPass99'), 'App log file must strip cmdkey /pass');

  const logInfo = logStore.getAppLogInfo({ limit: 20 });
  assert.strictEqual(logInfo.success, true);
  assert.strictEqual(path.resolve(logInfo.directory), path.resolve(expectedLogDir));
  assert.strictEqual(logInfo.files.length, 1);
  assert.strictEqual(logInfo.recentLines.length, 2);

  assert(
    modMain.includes("'append-app-log'") &&
      modMain.includes("'get-app-log-info'") &&
      modPreload.includes('appendAppLog:') &&
      modPreload.includes('getAppLogInfo:') &&
      bridgeSrc.includes('async appendAppLog(') &&
      bridgeSrc.includes('async getAppLogInfo(') &&
      appTsxSrc.includes('btn-open-log-folder') &&
      appTsxSrc.includes('shareBridge') &&
      appTsxSrc.includes('.appendAppLog('),
    'main.js / preload.js / shareBridge.ts / App.tsx missing <appDir>/log IPC or UI log persistence wiring'
  );

  pass('App-directory <appDir>/log daily UTF-8 BOM logging, credential redaction & open-folder UI wiring verified');
} finally {
  fs.rmSync(tmpAppLogDir, { recursive: true, force: true });
}

// 13. Verify Win 11 24H2-26H2 mixed guest/account coexistence, BlockNTLM/RequireEncryption, minpwlen=0, NullString & KB5065426 KIR 1517186191
{
  const batPath = path.join(rootDir, 'scripts', 'upgradedHostGuestUnblock.bat');
  const batRaw = fs.readFileSync(batPath, 'utf8');
  assert(batRaw.includes('\r\n'), 'upgradedHostGuestUnblock.bat must use Windows CRLF line endings');
  assert(!/[^\x00-\x7F]/.test(batRaw), 'upgradedHostGuestUnblock.bat must remain pure ASCII for Windows cmd.exe ANSI safety');
  assert(batRaw.includes('/v forceguest /t REG_DWORD /d 0 /f'), 'upgradedHostGuestUnblock.bat must enforce Classic forceguest=0');
  assert(batRaw.includes('accounts /minpwlen:0'), 'upgradedHostGuestUnblock.bat must clear minpwlen=0 before blank-password Guest reset');
  assert(batRaw.includes('BlockNTLM') && batRaw.includes('RequireEncryption'), 'upgradedHostGuestUnblock.bat must clear Win11 24H2+ BlockNTLM and RequireEncryption');

  assert(!/\/v\s+forceguest\s+\/t\s+REG_DWORD\s+\/d\s+1/i.test(psEngineSrc), 'powershellEngine.ts must NOT set forceguest=1 (clobbers named-account shares with Error 86)');
  assert(
    psEngineSrc.includes('$hasOtherGuestShare') &&
      psEngineSrc.includes('accounts /minpwlen:0') &&
      psEngineSrc.includes('[NullString]::Value') &&
      psEngineSrc.includes('-BlockNTLM') &&
      psEngineSrc.includes('1517186191') &&
      psEngineSrc.includes("mode === 'kir_duplicate_sid_compat'"),
    'powershellEngine.ts missing mixed-share coexistence guard, minpwlen=0, NullString, BlockNTLM, or KIR 1517186191 support'
  );
  const playbookSrcCheck = fs.readFileSync(path.join(rootDir, 'src', 'services', 'troubleshootPlaybook.ts'), 'utf8');
  const matrixPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'NetworkMatrixPanel.tsx'), 'utf8');
  assert(
    netEvoSrc.includes('duplicate_machine_sid_24h2') &&
      netEvoSrc.includes('kir_duplicate_sid_compat') &&
      playbookSrcCheck.includes('kir_duplicate_sid_compat') &&
      matrixPanelSrc.includes('btn-apply-kir-dup-sid') &&
      bridgeSrc.includes('targetHostName'),
    'Missing duplicate Machine SID (KB5065426 / KIR 1517186191) diagnostics or targetHostName fallback wiring'
  );
  pass('Mixed guest/account coexistence (forceguest=0), minpwlen=0, BlockNTLM/NullString & KB5065426 duplicate SID KIR (1517186191=0) verified');
}

// 14. Verify bidirectional sync between OS Compatibility Matrix / HostPanel / pendingHostActions & USB Troubleshoot Wizard
{
  const playbookSrcSync = fs.readFileSync(path.join(rootDir, 'src', 'services', 'troubleshootPlaybook.ts'), 'utf8');
  const wizardSrcSync = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TroubleshootWizardModal.tsx'), 'utf8');
  const syncBadgeSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'SyncAwarePolicyBadge.tsx'), 'utf8');
  const bannerSrcSync = fs.readFileSync(path.join(rootDir, 'src', 'components', 'TroubleshootHandoffBanner.tsx'), 'utf8');
  const matrixSrcSync = fs.readFileSync(path.join(rootDir, 'src', 'components', 'NetworkMatrixPanel.tsx'), 'utf8');
  const typesSrcSync = fs.readFileSync(path.join(rootDir, 'src', 'types', 'share.ts'), 'utf8');

  for (const sym of ['TroubleshootStepResolvedSource', 'TroubleshootSyncSummary', 'resolvedSource', 'requiresReboot']) {
    assert(typesSrcSync.includes(sym), `types/share.ts missing bidirectional sync type ${sym}`);
  }
  for (const sym of [
    'reconcileTroubleshootTicketsWithLocalState',
    'getSatisfiedPolicyModesFromStatus',
    'isPolicyStepSatisfiedOnLocalPc',
    'getPolicyStepMatchedExplanation',
    'formatStepResolvedSourceLabel',
  ]) {
    assert(playbookSrcSync.includes(sym), `troubleshootPlaybook.ts missing ${sym}`);
  }
  assert(
    syncBadgeSrc.includes('export function evaluateStepPolicyMatch') &&
      syncBadgeSrc.includes('export const SyncAwarePolicyBadge') &&
      syncBadgeSrc.includes('Policy Matched') &&
      syncBadgeSrc.includes('data-sync-aware="policy-matched"') &&
      syncBadgeSrc.includes('autoCompletedByPolicy') &&
      syncBadgeSrc.includes('autoSkippedByPolicy') &&
      syncBadgeSrc.includes('effectiveStatus') &&
      syncBadgeSrc.includes('effectiveSourceLabel') &&
      syncBadgeSrc.includes('getPolicyStepMatchedExplanation') &&
      syncBadgeSrc.includes('formatStepResolvedSourceLabel'),
    'SyncAwarePolicyBadge.tsx missing evaluateStepPolicyMatch, Policy Matched badge, effectiveStatus, autoSkippedByPolicy, or explanation helper'
  );
  assert(
    bridgeSrc.includes('async syncTroubleshootTicketsWithLocalState(') &&
      bridgeSrc.includes('async reconcilePendingHostActionsWithLocalPolicy('),
    'shareBridge.ts missing syncTroubleshootTicketsWithLocalState or reconcilePendingHostActionsWithLocalPolicy'
  );
  assert(
    appTsxSrc.includes('syncAllMatrixAndWizardState') &&
      appTsxSrc.includes("'host_panel'") &&
      appTsxSrc.includes("source: 'matrix'") &&
      appTsxSrc.includes("source: 'rollback'") &&
      appTsxSrc.includes("source: 'share_retry'") &&
      appTsxSrc.includes("source: 'mount_retry'") &&
      appTsxSrc.includes("resolvedSource: 'wizard'"),
    'App.tsx missing bidirectional syncAllMatrixAndWizardState wiring across HostPanel/Matrix/Rollback/Wizard'
  );
  assert(
    wizardSrcSync.includes('wizard-matrix-sync-summary') &&
      wizardSrcSync.includes('wizard-reboot-judgment-banner') &&
      wizardSrcSync.includes('btn-wizard-open-matrix') &&
      wizardSrcSync.includes('btn-wizard-confirm-reboot') &&
      wizardSrcSync.includes('SyncAwarePolicyBadge') &&
      wizardSrcSync.includes('evaluateStepPolicyMatch') &&
      wizardSrcSync.includes('effectiveHostSteps') &&
      wizardSrcSync.includes('effectiveClientSteps') &&
      wizardSrcSync.includes('effectiveTicketStatus') &&
      wizardSrcSync.includes('autoSkippedByPolicy') &&
      wizardSrcSync.includes('data-step-status={effectiveStatus}') &&
      wizardSrcSync.includes("data-step-skipped={isMarkedSkipped ? 'true' : 'false'}") &&
      wizardSrcSync.includes('<StepStatusIcon status={effectiveStatus} />') &&
      wizardSrcSync.includes('const isExecuteDisabled = isBusy || isPolicyMatched;') &&
      wizardSrcSync.includes('disabled={isExecuteDisabled}'),
    'TroubleshootWizardModal.tsx missing Matrix sync banner, reboot judgment alert, SyncAwarePolicyBadge, or render-time policyStatus auto-completion/skipping'
  );
  assert(
    bannerSrcSync.includes('btn-banner-open-matrix') &&
      bannerSrcSync.includes('lastPatchResult?.rebootJudgment'),
    'TroubleshootHandoffBanner.tsx missing unified Matrix open button or reboot judgment notice'
  );
  assert(
    matrixSrcSync.includes('matrix-wizard-sync-banner') &&
      matrixSrcSync.includes('btn-matrix-open-wizard'),
    'NetworkMatrixPanel.tsx missing Troubleshoot Wizard bidirectional sync banner or trigger button'
  );

  pass('Bidirectional sync & SyncAwarePolicyBadge (Policy Matched + Execute lock) between OS Compatibility Matrix, HostPanel, pendingHostActions & USB Troubleshoot Wizard verified');
}

console.log('=======================================================');
console.log(`[SUCCESS] All ${checksPassed} standalone verification checks passed!`);
console.log('=======================================================');

