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
assert.strictEqual(rootPkg.build?.win?.artifactName, 'AhBiShare_OneClick.${ext}');
assert.strictEqual(rootPkg.build?.portable?.artifactName, 'AhBiShare_OneClick.${ext}');

const liteCfg = readJson(path.join(rootDir, 'build-config-lite.json'));
assert.strictEqual(liteCfg.compression, 'maximum');
assert.strictEqual(liteCfg.afterPack, 'scripts/prune_electron_pack.js');
assert(Array.isArray(liteCfg.electronLanguages) && liteCfg.electronLanguages.includes('ko') && liteCfg.electronLanguages.includes('en-US'), 'build-config-lite.json must preserve ko and en-US locales');
assert(Array.isArray(liteCfg.files) && liteCfg.files.includes('!**/node_modules/**/*'), 'build-config-lite.json must exclude redundant node_modules from app.asar');
assert.strictEqual(liteCfg.win?.requestedExecutionLevel, 'requireAdministrator');
assert.strictEqual(liteCfg.portable?.artifactName, 'AhBiShare_OneClick-Lite.${ext}');
assert(fs.existsSync(path.join(rootDir, 'scripts', 'prune_electron_pack.js')), 'Missing scripts/prune_electron_pack.js');
assert(fs.existsSync(path.join(rootDir, 'scripts', 'build_lite_exe.js')), 'Missing scripts/build_lite_exe.js');
pass(`Standalone & Lite EXE packaging configs verified (v${rootPkg.version}, requireAdministrator, Win 7~11 safe pruning)`);

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
assert(legacyPanelSrc.includes('encodeUtf16LeWithBom'), 'LegacySharingPanel.tsx missing UTF-16LE BOM encoder for .reg downloads');
assert(legacyPanelSrc.includes('legacy-direction-guidance'), 'LegacySharingPanel.tsx missing direction-aware guidance');
assert(legacyPanelSrc.includes('legacy-client-acc-user') && legacyPanelSrc.includes('legacy-client-acc-pass'), 'LegacySharingPanel.tsx missing accessible client account input IDs');

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

console.log('=======================================================');
console.log(`[SUCCESS] All ${checksPassed} standalone verification checks passed!`);
console.log('=======================================================');
