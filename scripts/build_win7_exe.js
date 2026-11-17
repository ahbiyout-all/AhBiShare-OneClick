/**
 * AhBiShare OneClick - Windows 7 SP1 ~ 8.1 Compatible Portable EXE Builder (Legacy Electron v21 Profile)
 * Usage: node scripts/build_win7_exe.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
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

function cleanStaleTempArchives(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    if (entry.toLowerCase().endsWith('.nsis.7z')) {
      try {
        fs.unlinkSync(path.join(dirPath, entry));
      } catch {}
    }
  }
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function main() {
  const ver = readAppVersion();
  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  const npxCmd = isWin ? 'npx.cmd' : 'npx';
  const extraWinArgs = isWin ? [] : ['--config.win.signAndEditExecutable=false'];

  const releaseDir = path.join(rootDir, 'release');
  const win7Dir = path.join(rootDir, 'release-win7');
  fs.mkdirSync(releaseDir, { recursive: true });
  cleanStaleTempArchives(releaseDir);
  cleanStaleTempArchives(win7Dir);

  runStep(npmCmd, ['run', 'build'], 'Building production frontend assets (dist/)');

  const outFileName = `AhBiShare_OneClick_Win7_v${ver}.exe`;
  runStep(
    npxCmd,
    ['electron-builder', '--config', 'build-config-win7.json', '--win', 'portable', '--x64', ...extraWinArgs],
    `Packaging Windows 7/8/8.1 compatible ${outFileName}`
  );

  cleanStaleTempArchives(releaseDir);
  cleanStaleTempArchives(win7Dir);

  const win7OutPath = path.join(win7Dir, outFileName);
  const sharedDest = path.join(releaseDir, outFileName);
  if (fs.existsSync(win7OutPath)) {
    fs.copyFileSync(win7OutPath, sharedDest);
  }

  console.log('\n=======================================================');
  console.log(`[*] Windows 7 Portable EXE Build Summary (v${ver})`);
  console.log('=======================================================');
  if (fs.existsSync(sharedDest)) {
    const bytes = fs.statSync(sharedDest).size;
    console.log(`  Win 7/8 EXE : release/${outFileName} (${formatMb(bytes)})`);
  }
  console.log('=======================================================\n');
}

main();
