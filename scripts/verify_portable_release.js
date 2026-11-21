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

  const locDel = store.deleteLocationProfile(locSaveRes.profile.profileId);
  assert.strictEqual(locDel.success, true);
  assert.strictEqual(store.listLocationProfiles().profiles.length, 0);

  // Verify copied/renamed .location.json file whose filename differs from internal profileId
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
  const aliasedDel = store.deleteLocationProfile('loc-renamed-check');
  assert.strictEqual(aliasedDel.success, true, 'deleteLocationProfile must delete renamed .location.json by internal profileId');
  assert.strictEqual(store.listLocationProfiles().profiles.length, 0);
  pass('Per-location .location.json AES-256-GCM encryption, BOM resilience, mixed-script ID & renamed-file CRUD verified');
} finally {
  fs.rmSync(tempUsbDir, { recursive: true, force: true });
}

// 4. Verify PowerShell network drive mount & host guest / OS feature safeguards
const psEngineSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'powershellEngine.ts'), 'utf8');
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
const bridgeSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'shareBridge.ts'), 'utf8');
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
  netEvoSrc.indexOf("'Error 1385'") < netEvoSrc.indexOf("'Error 1223'") &&
    netEvoSrc.indexOf("'Error 1223'") < netEvoSrc.indexOf("'0x80070035 / 1272'"),
  'networkEvolution.ts classifyFailureDiagnostics must prioritize Error 1385 and Error 1223 before generic Guest error'
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
for (const batFile of ['build.bat', 'build_release.bat', 'push_github.bat']) {
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

const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');
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
    bridgeSrc.includes('if (res.success && res.profile) {\n        this.cacheLocationProfileCredentials(res.profile);'),
  'shareBridge.ts must prioritize explicit username in loadWebPreviewPortable and re-cache decrypted res.profile after Electron saveLocationProfile'
);
assert(
  rollbackPanelSrc.includes('const res = await onFullSecurityRollback();') &&
    rollbackPanelSrc.includes("setFeedback({ scope: 'full', ...res });") &&
    appSrc.includes('return { success: allOk, message: msg };') &&
    appSrc.includes("if (!jobKey) {\n      return { success: false, message: '다른 작업이 진행 중입니다.' };"),
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
  assert(
    psSelfScript.includes('Remove-Item -LiteralPath $oldExe -Force') &&
      psSelfScript.includes('Copy-Item -LiteralPath $stagedExe -Destination $targetExe -Force') &&
      psSelfScript.includes('old_portable_backup.exe') &&
      psSelfScript.includes('Test-ValidPeExe $targetExe') &&
      psSelfScript.includes('Copy-Item -LiteralPath $backupOldExe -Destination $oldExe -Force') &&
      psSelfScript.includes('Start-Process -FilePath $targetExe') &&
      psSelfScript.includes("''test.exe") &&
      !psSelfScript.includes('[PSCustomObject]@{') &&
      !/\s-(?:in|notin)\b/.test(psSelfScript),
    'buildPortableSelfUpdatePsScript must be PS 2.0 compatible, backup old EXE, verify target PE MZ header with rollback, escape single quotes, delete old EXE, copy target EXE, and relaunch'
  );
  pass('portableUpdater.js runtime edition detection, GitHub asset allowlist, PE validation & PS 2.0 self-replacement script verified');
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

console.log('=======================================================');
console.log(`[SUCCESS] All ${checksPassed} standalone verification checks passed!`);
console.log('=======================================================');
