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

for (const reqFile of ['dist/**/*', 'main.js', 'preload.js', 'portableStore.js', 'package.json']) {
  assert(
    Array.isArray(rootPkg.build?.files) && rootPkg.build.files.includes(reqFile),
    `package.json build.files missing "${reqFile}"`
  );
}
assert.strictEqual(rootPkg.name, 'ahbishare-oneclick');
assert.strictEqual(rootPkg.version, '1.0.0');
assert.strictEqual(rootConfig.version, rootPkg.version, `public/config.json version (${rootConfig.version}) !== package.json (${rootPkg.version})`);
assert.strictEqual(rootPkg.build?.win?.requestedExecutionLevel, 'requireAdministrator');
assert.strictEqual(rootPkg.build?.win?.artifactName, 'AhBiShare_OneClick_v${version}.${ext}');
assert.strictEqual(rootPkg.build?.nsis?.artifactName, 'AhBiShare_OneClick-Setup_v${version}.${ext}');
assert.strictEqual(rootPkg.build?.portable?.artifactName, 'AhBiShare_OneClick_v${version}.${ext}');

const liteCfg = readJson(path.join(rootDir, 'build-config-lite.json'));
assert.strictEqual(liteCfg.compression, 'maximum');
assert.strictEqual(liteCfg.afterPack, 'scripts/prune_electron_pack.js');
assert(Array.isArray(liteCfg.electronLanguages) && liteCfg.electronLanguages.includes('ko') && liteCfg.electronLanguages.includes('en-US'), 'build-config-lite.json must preserve ko and en-US locales');
assert(Array.isArray(liteCfg.files) && liteCfg.files.includes('!**/node_modules/**/*'), 'build-config-lite.json must exclude redundant node_modules from app.asar');
assert.strictEqual(liteCfg.win?.requestedExecutionLevel, 'requireAdministrator');
assert.strictEqual(liteCfg.portable?.artifactName, 'AhBiShare_OneClick-Lite_v${version}.${ext}');

const win7Cfg = readJson(path.join(rootDir, 'build-config-win7.json'));
assert.strictEqual(win7Cfg.electronVersion, '21.4.4');
assert.strictEqual(win7Cfg.portable?.artifactName, 'AhBiShare_OneClick_Win7_v${version}.${ext}');

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
]) {
  assert(modMain.includes(ipc), `main.js missing IPC handler: ${ipc}`);
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

  fs.writeFileSync(path.join(tempUsbDir, portableStore.PORTABLE_FILE_NAME), `\uFEFF${rawDisk}`, 'utf8');

  const loadRes = store.loadPortableData();
  assert.strictEqual(loadRes.success, true);
  assert.strictEqual(loadRes.document.shares[0].password, 'SuperSecret!2026');
  assert.strictEqual(loadRes.document.shares[0].ttlMinutes, 60);
  assert.strictEqual(loadRes.document.shares[0].expiresAt, '2026-11-16T11:00:00.000Z');
  assert.strictEqual(loadRes.document.hostPolicies['HOST-26H2-PC'].rpcAuthnLevelPrivacyDisabled, true);

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

  const locDel = store.deleteLocationProfile(locSaveRes.profile.profileId);
  assert.strictEqual(locDel.success, true);
  assert.strictEqual(store.listLocationProfiles().profiles.length, 0);
  pass('Per-location .location.json AES-256-GCM encryption, BOM resilience, mixed-script ID safety & CRUD verified');
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
  "'/user:Guest'",
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
  !psEngineSrc.includes("Invoke-NetUseSafe @('use', $p_drive, $p_unc, '', '/user:Guest'"),
  'powershellEngine.ts uses empty string arg that PowerShell 5.1 strips for native net.exe'
);
assert(
  psEngineSrc.includes('try { Set-SmbServerConfiguration -RejectUnencryptedAccess'),
  'powershellEngine.ts missing isolated ParameterBinding try/catch for -RejectUnencryptedAccess'
);
pass('Windows 7 SP1 ~ 11 26H2 PowerShell 2.0/5.1 fallbacks, network drive creation, GPO/UAC, and OS patch safeguards verified');

// 5. Verify NetworkMatrixPanel host-client mismatch detection & 1-click batch auto-align wiring
const netEvoSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'networkEvolution.ts'), 'utf8');
const bridgeSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'shareBridge.ts'), 'utf8');
const matrixPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'NetworkMatrixPanel.tsx'), 'utf8');

for (const marker of ['extractAutoAlignModes', 'combineRebootJudgments', 'HOST_POLICY_REFERENCE_TARGETS', 'diff_ntlm', 'diff_uac_token', 'Win 7${ver']) {
  assert(netEvoSrc.includes(marker), `networkEvolution.ts missing auto-align / OS label symbol: ${marker}`);
}
assert(bridgeSrc.includes('autoAlignHostClientPolicies('), 'shareBridge.ts missing autoAlignHostClientPolicies method');
assert(bridgeSrc.includes('Get-Command Remove-SmbMapping'), 'shareBridge.ts missing Win 7 Remove-SmbMapping guard in unmountDrive');
for (const uiId of ['matrix-auto-align-banner', 'btn-auto-align-top', 'btn-sync-cross-pc-policy', 'btn-copy-host-guide']) {
  assert(matrixPanelSrc.includes(uiId), `NetworkMatrixPanel.tsx missing auto-align UI element: ${uiId}`);
}
pass('NetworkMatrixPanel host-client mismatch detection, Win 7/8 labels, unmountDrive guard & 1-click auto-align verified');

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
  'if not exist "%BACKUP_DIR%\\\\LanmanServer.reg"',
  'dism /online /disable-feature /featurename:SMB1Protocol /norestart',
]) {
  assert(legacyEngineSrc.includes(marker), `legacyScriptEngine.ts missing marker: ${marker}`);
}
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
  'WizardSilent()',
  'taskkill.exe',
  'AhBiShare_OneClick_v{#AppVersion}',
  'AhBiShare_OneClick_Win7_v{#AppVersion}',
  'win-unpacked\\*',
]) {
  assert(issSrc.includes(marker), `installer/setup.iss missing marker: ${marker}`);
}

for (const docFile of ['PATCH_NOTES.md', 'google_blogger_post.md', 'github_release_guide.md']) {
  assert(fs.existsSync(path.join(rootDir, 'docs', docFile)), `Missing docs/${docFile}`);
}

const workflowSrc = fs.readFileSync(path.join(rootDir, '.github', 'workflows', 'release.yml'), 'utf8');
assert(workflowSrc.includes('release-github/*_v*.exe'), '.github/workflows/release.yml must upload only version-numbered executables');
assert(workflowSrc.includes('gh release delete-asset'), '.github/workflows/release.yml must prune stale/unversioned assets from existing releases');
assert(!workflowSrc.includes('dist/*.zip') && !workflowSrc.includes('android') && !workflowSrc.includes('.apk'), '.github/workflows/release.yml must exclude zip/mobile artifacts');

const gitignoreSrc = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
for (const ignoredEntry of [
  'push_github.bat',
  'build_release.bat',
  '/app/',
  'metadata.json',
  '*.portable.json',
  '*.location.json',
  '/locations/',
  'AhBiShare_CrossOS_Sync_Bridge*.json',
  'AhBiShare_Legacy_Win7_Win8_Kit/',
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
      pushBatSrc.includes('--cached --ignore-unmatch app metadata.json push_github.bat'),
    'push_github.bat must enable delayed expansion, link origin/main safely, and untrack stale excluded files'
  );
}

const readmeSrc = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
assert(
  readmeSrc.includes('build.bat') &&
    readmeSrc.includes('electron:build:win7') &&
    readmeSrc.includes(`_v${rootPkg.version}.exe`),
  'README.md must document build.bat, electron:build:win7, and version-numbered EXEs'
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
  !/\s-(?:in|notin)\b/.test(psEngineSrc) &&
    psEngineSrc.includes('-notcontains $_.Name') &&
    (psEngineSrc.match(/RejectUnencryptedAccess/g) || []).length >= 5,
  'powershellEngine.ts must use PowerShell 2.0 compatible -notcontains and clear RejectUnencryptedAccess across guest & legacy compat flows'
);

const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');
assert(
  appSrc.includes(`checkForUpdates('${rootPkg.version}')`) &&
    appSrc.includes(`currentVersion="${rootPkg.version}"`) &&
    appSrc.includes('autoRevoked: revoked'),
  `App.tsx update checker version must match package.json (${rootPkg.version}) and report accurate autoRevoked state`
);

const updateModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'UpdateModal.tsx'), 'utf8');
assert(
  updateModalSrc.includes('role="dialog"') && updateModalSrc.includes('aria-modal="true"'),
  'UpdateModal.tsx must provide accessible dialog ARIA attributes'
);

assert(
  bridgeSrc.includes('exportCrossOsBridgeBundle') &&
    bridgeSrc.includes('importCrossOsBridgeData') &&
    bridgeSrc.includes('mergedPolicies') &&
    bridgeSrc.includes('sanitizeLocalShareForStorage(') &&
    bridgeSrc.includes('sanitizeLocalShareForStorage(sanitizedLocal, netInfo)') &&
    bridgeSrc.includes('promotedPortableEntries'),
  'shareBridge.ts missing cross-OS bidirectional bridge sync, hostPolicies merge, or localStorage sanitization'
);
assert(
  bridgeSrc.includes('Get-Command Get-SmbShare') && bridgeSrc.includes('net.exe share $p_share /delete /y'),
  'shareBridge.ts removeHostShare missing Win 7 PowerShell 2.0 net.exe share delete fallback'
);
const portableStoreSrc = fs.readFileSync(path.join(rootDir, 'portableStore.js'), 'utf8');
assert(
  portableStoreSrc.includes('lmCompatibilityLevel') && portableStoreSrc.includes('localAccountTokenFilterEnabled'),
  'portableStore.js must preserve lmCompatibilityLevel and localAccountTokenFilterEnabled in hostPolicies'
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
assert(fs.existsSync(path.join(rootDir, 'src', 'services', 'updateChecker.ts')), 'Missing updateChecker.ts');

// 8. Verify per-location UI components, bridge methods, and App.tsx wiring
const locBarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LocationProfileBar.tsx'), 'utf8');
const locModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'LocationManagerModal.tsx'), 'utf8');
for (const uiId of [
  'location-profile-bar',
  'select-location-profile',
  'btn-open-save-location',
  'btn-quick-import-location',
  'btn-open-location-manager',
  'btn-batch-apply-location',
  'location-batch-result',
]) {
  assert(locBarSrc.includes(uiId), `LocationProfileBar.tsx missing control: ${uiId}`);
}
assert(
  locModalSrc.includes('role="dialog"') &&
    locModalSrc.includes('aria-modal="true"') &&
    locModalSrc.includes('btn-save-new-location') &&
    locModalSrc.includes('btn-modal-import-json'),
  'LocationManagerModal.tsx missing accessible dialog or save/import controls'
);
for (const fnMarker of [
  'buildLocationProfileSnapshot',
  'listLocationProfiles',
  'saveLocationProfile',
  'loadLocationProfile',
  'deleteLocationProfile',
  'exportLocationProfileFile',
  'importLocationProfileFile',
  'importLocationProfileFromJson',
  'applyLocationProfileBatch',
]) {
  assert(bridgeSrc.includes(fnMarker), `shareBridge.ts missing location method: ${fnMarker}`);
}
assert(
  appSrc.includes('LocationProfileBar') &&
    appSrc.includes('LocationManagerModal') &&
    appSrc.includes('applyLocationProfileToWorkspace'),
  'App.tsx missing LocationProfileBar / LocationManagerModal / workspace auto-fill wiring'
);
pass('LICENSE, CRLF .bat scripts, Inno Setup, Win 7 isolation & Chromium 106 CSS, Cross-OS sync, location profiles & accessibility verified');

console.log('=======================================================');
console.log(`[SUCCESS] All ${checksPassed} standalone verification checks passed!`);
console.log('=======================================================');
