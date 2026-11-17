/**
 * AhBiShare OneClick - Standard & Size-Reduced Lite Portable EXE Builder
 * Usage:
 *   node scripts/build_lite_exe.js --lite-only   (default)
 *   node scripts/build_lite_exe.js --all
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const buildAll = args.includes('--all');
const isWin = process.platform === 'win32';

function readAppVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  return pkg.version || '1.0.0';
}

function runStep(cmd, cmdArgs, label) {
  console.log(`\n[*] ${label}...`);
  execFileSync(cmd, cmdArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWin,
  });
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function cleanStaleTempArchives(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    if (entry.toLowerCase().endsWith('.nsis.7z')) {
      const target = path.join(dirPath, entry);
      try {
        fs.unlinkSync(target);
        console.log(`[*] Cleaned stale temp archive: ${path.relative(rootDir, target)}`);
      } catch {}
    }
  }
}

function verifyLiteUnpackedDir(unpackedDir) {
  assert(fs.existsSync(unpackedDir), `Missing Lite unpacked directory: ${unpackedDir}`);

  const localesDir = path.join(unpackedDir, 'locales');
  assert(fs.existsSync(localesDir), `Missing Lite locales directory: ${localesDir}`);
  const localeFiles = fs.readdirSync(localesDir).sort();
  assert.deepStrictEqual(
    localeFiles,
    ['en-US.pak', 'ko.pak'],
    `Unexpected Lite locales retained: ${localeFiles.join(', ')}`
  );

  for (const prunedFile of [
    'LICENSES.chromium.html',
    'LICENSE.electron.txt',
    'dxcompiler.dll',
    'dxil.dll',
    'vk_swiftshader.dll',
    'vk_swiftshader_icd.json',
    'vulkan-1.dll',
  ]) {
    assert(
      !fs.existsSync(path.join(unpackedDir, prunedFile)),
      `Pruned file unexpectedly present in Lite build: ${prunedFile}`
    );
  }

  for (const requiredRuntime of [
    'icudtl.dat',
    'ffmpeg.dll',
    'libGLESv2.dll',
    'libEGL.dll',
    'd3dcompiler_47.dll',
    'v8_context_snapshot.bin',
    'snapshot_blob.bin',
    'resources.pak',
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
  ]) {
    assert(
      fs.existsSync(path.join(unpackedDir, requiredRuntime)),
      `Critical Win 7~11 runtime asset missing in Lite build: ${requiredRuntime}`
    );
  }

  const asarPath = path.join(unpackedDir, 'resources', 'app.asar');
  assert(fs.existsSync(asarPath), `Missing Lite app.asar: ${asarPath}`);
  const asar = require('@electron/asar');
  const entries = asar.listPackage(asarPath);
  const hasNodeModules = entries.some((p) => p.replace(/\\/g, '/').includes('/node_modules/'));
  assert(!hasNodeModules, 'Lite app.asar unexpectedly contains node_modules/');

  const asarSize = fs.statSync(asarPath).size;
  console.log(
    `[PASS] Lite integrity verified: locales=[${localeFiles.join(', ')}], app.asar=${formatMb(asarSize)} (${entries.length} files, 0 node_modules), Win 7~11 runtime DLLs intact.`
  );
}

function main() {
  const ver = readAppVersion();
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  const npxCmd = isWin ? 'npx.cmd' : 'npx';
  const extraWinArgs = isWin ? [] : ['--config.win.signAndEditExecutable=false'];

  const releaseDir = path.join(rootDir, 'release');
  const liteDir = path.join(rootDir, 'release-lite');
  fs.mkdirSync(releaseDir, { recursive: true });
  cleanStaleTempArchives(releaseDir);
  cleanStaleTempArchives(liteDir);

  runStep(npmCmd, ['run', 'build'], 'Building production frontend assets (dist/)');

  if (buildAll) {
    runStep(
      npxCmd,
      ['electron-builder', '--win', 'portable', '--x64', ...extraWinArgs],
      `Packaging standard AhBiShare_OneClick_v${ver}.exe`
    );
  }

  runStep(
    npxCmd,
    ['electron-builder', '--config', 'build-config-lite.json', '--win', 'portable', '--x64', ...extraWinArgs],
    `Packaging size-reduced AhBiShare_OneClick-Lite_v${ver}.exe`
  );

  cleanStaleTempArchives(releaseDir);
  cleanStaleTempArchives(liteDir);

  verifyLiteUnpackedDir(path.join(liteDir, 'win-unpacked'));

  const liteFileName = `AhBiShare_OneClick-Lite_v${ver}.exe`;
  const liteOutPath = path.join(liteDir, liteFileName);
  const sharedLiteDest = path.join(releaseDir, liteFileName);
  if (fs.existsSync(liteOutPath)) {
    fs.copyFileSync(liteOutPath, sharedLiteDest);
  }

  // Remove any unversioned EXE leftovers so only version-numbered executables remain in release/
  for (const unversioned of ['AhBiShare_OneClick.exe', 'AhBiShare_OneClick-Lite.exe', 'AhBiShare_OneClick_Win7.exe', 'AhBiShare_OneClick-Setup.exe']) {
    const p = path.join(releaseDir, unversioned);
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {}
    }
  }

  const stdExe = path.join(releaseDir, `AhBiShare_OneClick_v${ver}.exe`);
  console.log('\n=======================================================');
  console.log(`[*] Portable EXE Build Summary (v${ver} · Win 7~11 Standalone)`);
  console.log('=======================================================');
  if (fs.existsSync(stdExe)) {
    const stdBytes = fs.statSync(stdExe).size;
    console.log(`  Standard EXE : release/AhBiShare_OneClick_v${ver}.exe (${formatMb(stdBytes)})`);
    if (fs.existsSync(sharedLiteDest)) {
      const liteBytes = fs.statSync(sharedLiteDest).size;
      const savedBytes = stdBytes - liteBytes;
      const savedPct = stdBytes > 0 ? ((savedBytes / stdBytes) * 100).toFixed(1) : '0.0';
      console.log(`  Lite EXE     : release/${liteFileName} (${formatMb(liteBytes)})`);
      console.log(`  Size Reduced : -${formatMb(savedBytes)} (-${savedPct}%)`);
    }
  } else if (fs.existsSync(sharedLiteDest)) {
    const liteBytes = fs.statSync(sharedLiteDest).size;
    console.log(`  Lite EXE     : release/${liteFileName} (${formatMb(liteBytes)})`);
  }
  console.log('=======================================================\n');
}

main();
