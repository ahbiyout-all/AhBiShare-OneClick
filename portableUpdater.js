const fs = require('fs');
const path = require('path');
const { probeDirectoryWriteSafety } = require('./portableStore');
const { pickLocaleText } = require('./localeHelper');

const ALLOWED_GITHUB_REPO = 'ahbiyout-all/AhBiShare-OneClick';

function getFileBasenameAnyPlatform(filePath) {
  const raw = String(filePath || '').trim();
  if (!raw) return '';
  return path.win32.basename(raw);
}

function detectEdition({ appName = '', portableExePath = '', execPath = '', electronVersion = process.versions.electron, osBuild = 0 } = {}) {
  const combined = `${appName} ${getFileBasenameAnyPlatform(portableExePath)} ${getFileBasenameAnyPlatform(execPath)}`.toLowerCase();
  if (String(electronVersion || '').startsWith('21.') || combined.includes('win7') || (typeof osBuild === 'number' && osBuild > 0 && osBuild < 10240)) {
    return 'win7';
  }
  if (combined.includes('lite')) {
    return 'lite';
  }
  return 'standard';
}

function detectPortableRuntimeInfo({
  env = process.env,
  app = null,
  execPath = process.execPath,
  platform = process.platform,
  osBuild = 0,
  locale = 'ko',
} = {}) {
  const portableEnv = env && typeof env.PORTABLE_EXECUTABLE_FILE === 'string' ? env.PORTABLE_EXECUTABLE_FILE.trim() : '';
  const isPackaged = Boolean(app && app.isPackaged);
  const appName = (app && typeof app.getName === 'function' ? app.getName() : '') || '';
  const currentVersion = (app && typeof app.getVersion === 'function' ? app.getVersion() : '') || '1.0.0';
  const edition = detectEdition({
    appName,
    portableExePath: portableEnv,
    execPath,
    electronVersion: process.versions.electron,
    osBuild,
  });

  if (platform !== 'win32') {
    return {
      isPackaged,
      isPortable: false,
      canSelfReplace: false,
      writeProtected: false,
      edition,
      currentVersion,
      portableExePath: '',
      portableDir: '',
      currentExeName: path.basename(execPath || ''),
      reason: pickLocaleText(
        locale,
        'Windows 환경에서만 포터블 자동 교체를 지원합니다.',
        'Portable self-replacement is supported on Windows only.'
      ),
    };
  }

  if (portableEnv) {
    const resolvedExe = path.resolve(portableEnv);
    const resolvedDir = path.dirname(resolvedExe);
    const currentExeName = path.basename(resolvedExe);
    if (!fs.existsSync(resolvedExe)) {
      return {
        isPackaged,
        isPortable: true,
        canSelfReplace: false,
        writeProtected: false,
        edition,
        currentVersion,
        portableExePath: resolvedExe,
        portableDir: resolvedDir,
        currentExeName,
        reason: pickLocaleText(
          locale,
          '현재 실행 중인 포터블 EXE 원본 경로를 찾을 수 없습니다.',
          'Unable to locate the currently running portable EXE source path.'
        ),
      };
    }
    const writeProbe = probeDirectoryWriteSafety(resolvedDir, locale);
    if (writeProbe.writable) {
      return {
        isPackaged,
        isPortable: true,
        canSelfReplace: true,
        writeProtected: false,
        edition,
        currentVersion,
        portableExePath: resolvedExe,
        portableDir: resolvedDir,
        currentExeName,
        reason: '',
      };
    }
    return {
      isPackaged,
      isPortable: true,
      canSelfReplace: false,
      writeProtected: Boolean(writeProbe.writeProtected),
      edition,
      currentVersion,
      portableExePath: resolvedExe,
      portableDir: resolvedDir,
      currentExeName,
      reason:
        writeProbe.writeError ||
        pickLocaleText(
          locale,
          '실행 중인 포터블 USB/폴더에 쓰기 권한이 없거나 쓰기 금지 상태여서 자동 교체를 실행할 수 없습니다.',
          'The portable USB drive/folder lacks write permission or is write-protected, so auto-replacement cannot run.'
        ),
    };
  }

  if (!isPackaged) {
    return {
      isPackaged: false,
      isPortable: false,
      canSelfReplace: false,
      writeProtected: false,
      edition,
      currentVersion,
      portableExePath: '',
      portableDir: '',
      currentExeName: path.basename(execPath || ''),
      reason: pickLocaleText(
        locale,
        '개발/미리보기 모드에서는 포터블 자동 교체가 비활성화됩니다.',
        'Portable self-replacement is disabled in development/preview mode.'
      ),
    };
  }

  return {
    isPackaged: true,
    isPortable: false,
    canSelfReplace: false,
    writeProtected: false,
    edition,
    currentVersion,
    portableExePath: '',
    portableDir: path.dirname(execPath || ''),
    currentExeName: path.basename(execPath || ''),
    reason: pickLocaleText(
      locale,
      '설치형(Setup) 또는 비압축 폴더 실행 중이므로 포터블 자동 교체 대신 일반 다운로드를 사용하세요.',
      'Running as an installed (Setup) or unpacked build; please use the standard installer download instead of portable auto-replace.'
    ),
  };
}

function isPortableExeAsset(asset) {
  const lower = String(asset?.name || '').toLowerCase();
  return lower.endsWith('.exe') && !lower.includes('setup');
}

function selectMatchingPortableAsset(assets = [], { edition = 'standard', osBuild = 0 } = {}) {
  const list = Array.isArray(assets) ? assets.filter(isPortableExeAsset) : [];
  if (list.length === 0) return null;

  const isLegacyWin = edition === 'win7' || (typeof osBuild === 'number' && osBuild > 0 && osBuild < 10240);
  if (isLegacyWin) {
    const win7 = list.find((a) => a.name.toLowerCase().includes('win7'));
    if (win7) return win7;
  }
  if (edition === 'lite') {
    const lite = list.find((a) => a.name.toLowerCase().includes('lite'));
    if (lite) return lite;
  }
  const standard = list.find((a) => {
    const l = a.name.toLowerCase();
    return !l.includes('win7') && !l.includes('lite');
  });
  return standard || list[0];
}

function isAllowedGitHubDownloadUrl(urlString) {
  try {
    const u = new URL(String(urlString || '').trim());
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'github.com') {
      return u.pathname.toLowerCase().startsWith(`/${ALLOWED_GITHUB_REPO.toLowerCase()}/releases/download/`);
    }
    if (host === 'api.github.com') {
      return u.pathname.toLowerCase().startsWith(`/repos/${ALLOWED_GITHUB_REPO.toLowerCase()}/releases/assets/`);
    }
    return (
      host === 'objects.githubusercontent.com' ||
      host === 'release-assets.githubusercontent.com' ||
      host === 'github-releases.githubusercontent.com'
    );
  } catch {
    return false;
  }
}

function sanitizeAssetExeName(name) {
  const base = path.basename(String(name || '').trim()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  if (!base || !base.toLowerCase().endsWith('.exe')) return '';
  return base;
}

function parseExpandedAssetsHtml(html, repoPath = ALLOWED_GITHUB_REPO) {
  const raw = String(html || '');
  const escapedRepo = repoPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRegex = new RegExp(`href=["'](/${escapedRepo}/releases/download/[^"'\\s]+)["']`, 'gi');
  const seen = new Set();
  const assets = [];
  let m;
  while ((m = linkRegex.exec(raw)) !== null) {
    const relPath = m[1];
    const lastSeg = relPath.split('/').pop() || '';
    let decodedName = lastSeg;
    try {
      decodedName = decodeURIComponent(lastSeg);
    } catch {}
    if (!decodedName.toLowerCase().endsWith('.exe') || seen.has(decodedName.toLowerCase())) continue;
    seen.add(decodedName.toLowerCase());
    assets.push({
      name: decodedName,
      browserDownloadUrl: `https://github.com${relPath}`,
      size: 0,
    });
  }
  return assets;
}

function validateDownloadedExecutable(filePath, expectedSize = 0, locale = 'ko') {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      valid: false,
      size: 0,
      error: pickLocaleText(locale, '다운로드된 파일을 찾을 수 없습니다.', 'Downloaded file not found.'),
    };
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < 1024) {
    return {
      valid: false,
      size: stat.size,
      error: pickLocaleText(
        locale,
        '다운로드된 실행 파일 크기가 비정상적으로 작습니다.',
        'Downloaded executable file size is unexpectedly small.'
      ),
    };
  }
  if (expectedSize > 0 && stat.size !== expectedSize) {
    return {
      valid: false,
      size: stat.size,
      error: pickLocaleText(
        locale,
        `파일 크기 불일치 (${stat.size} / ${expectedSize} bytes)`,
        `File size mismatch (${stat.size} / ${expectedSize} bytes)`
      ),
    };
  }
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(2);
    const readBytes = fs.readSync(fd, header, 0, 2, 0);
    if (readBytes < 2 || header[0] !== 0x4d || header[1] !== 0x5a) {
      return {
        valid: false,
        size: stat.size,
        error: pickLocaleText(
          locale,
          '유효한 Windows 실행 파일(PE/MZ) 형식이 아닙니다.',
          'Not a valid Windows executable (PE/MZ) binary.'
        ),
      };
    }
  } finally {
    fs.closeSync(fd);
  }
  return { valid: true, size: stat.size };
}

function escapePsSingleQuoted(value) {
  return String(value || '').replace(/'/g, "''");
}

function buildPortableSelfUpdatePsScript({
  appPid,
  parentPid = 0,
  oldExePath,
  stagedExePath,
  targetExePath,
  stagingDir,
}) {
  const safeAppPid = Number(appPid) || 0;
  const safeParentPid = Number(parentPid) || 0;
  const targetDir = path.dirname(targetExePath);

  return [
    "$ErrorActionPreference = 'Continue'",
    `$appPid = ${safeAppPid}`,
    `$parentPid = ${safeParentPid}`,
    `$oldExe = '${escapePsSingleQuoted(oldExePath)}'`,
    `$stagedExe = '${escapePsSingleQuoted(stagedExePath)}'`,
    `$targetExe = '${escapePsSingleQuoted(targetExePath)}'`,
    `$targetDir = '${escapePsSingleQuoted(targetDir)}'`,
    `$stagingDir = '${escapePsSingleQuoted(stagingDir)}'`,
    '',
    'if ($appPid -gt 4) {',
    '  for ($i = 0; $i -lt 15; $i++) {',
    '    $proc = Get-Process -Id $appPid -ErrorAction SilentlyContinue',
    '    if (-not $proc) { break }',
    '    Start-Sleep -Milliseconds 400',
    '  }',
    '  $stillApp = Get-Process -Id $appPid -ErrorAction SilentlyContinue',
    '  if ($stillApp) {',
    '    try { Stop-Process -Id $appPid -Force -ErrorAction SilentlyContinue } catch {}',
    '    Start-Sleep -Milliseconds 500',
    '  }',
    '}',
    '',
    'if ($parentPid -gt 4 -and $parentPid -ne $appPid) {',
    '  $parentProc = Get-Process -Id $parentPid -ErrorAction SilentlyContinue',
    '  if ($parentProc) {',
    "    $pName = ''",
    '    try { $pName = [string]$parentProc.ProcessName } catch {}',
    "    if ($pName -notmatch '^(explorer|cmd|powershell|pwsh|wininit|services|svchost|conhost)$') {",
    '      for ($j = 0; $j -lt 20; $j++) {',
    '        $chk = Get-Process -Id $parentPid -ErrorAction SilentlyContinue',
    '        if (-not $chk) { break }',
    '        Start-Sleep -Milliseconds 400',
    '      }',
    '      $stillParent = Get-Process -Id $parentPid -ErrorAction SilentlyContinue',
    '      if ($stillParent) {',
    '        try { Stop-Process -Id $parentPid -Force -ErrorAction SilentlyContinue } catch {}',
    '        Start-Sleep -Milliseconds 500',
    '      }',
    '    }',
    '  }',
    '}',
    '',
    'function Stop-ProcessesMatchingExePath($exePath) {',
    '  if (-not $exePath) { return }',
    '  $allProcs = Get-Process -ErrorAction SilentlyContinue',
    '  if ($allProcs) {',
    '    foreach ($p in $allProcs) {',
    "      if ($p.Id -le 4 -or $p.Id -eq $PID) { continue }",
    "      $modPath = ''",
    '      try { $modPath = [string]$p.MainModule.FileName } catch {}',
    '      if ($modPath -and ([string]::Compare($modPath, $exePath, $true) -eq 0)) {',
    '        try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}',
    '      }',
    '    }',
    '  }',
    '}',
    '',
    "$probeName = '.ahbishare_update_probe_' + $PID + '.tmp'",
    '$probePath = Join-Path $targetDir $probeName',
    '$targetDirWritable = $false',
    'try {',
    '  $pfs = [System.IO.File]::Open($probePath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)',
    '  $pfs.Close()',
    '  if (Test-Path -LiteralPath $probePath) { Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue }',
    '  $targetDirWritable = $true',
    '} catch {',
    '  try { if (Test-Path -LiteralPath $probePath) { Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue } } catch {}',
    '  $targetDirWritable = $false',
    '}',
    'if (-not $targetDirWritable) {',
    "  try { Set-Content -LiteralPath (Join-Path $stagingDir 'update_error.log') -Value 'Target portable directory is write-protected or unwritable; aborted safely before modifying existing EXE.' -Encoding UTF8 } catch {}",
    '  exit 4',
    '}',
    '',
    "$backupOldExe = Join-Path $stagingDir 'old_portable_backup.exe'",
    '$hasBackup = $false',
    'if ($oldExe -and (Test-Path -LiteralPath $oldExe)) {',
    '  try {',
    '    Copy-Item -LiteralPath $oldExe -Destination $backupOldExe -Force -ErrorAction Stop',
    '    if ((Test-Path -LiteralPath $backupOldExe) -and ((Get-Item -LiteralPath $backupOldExe).Length -gt 1024)) {',
    '      $hasBackup = $true',
    '    }',
    '  } catch {}',
    '}',
    '',
    '$oldRemoved = $false',
    'for ($attempt = 0; $attempt -lt 25; $attempt++) {',
    '  if (-not (Test-Path -LiteralPath $oldExe)) {',
    '    $oldRemoved = $true',
    '    break',
    '  }',
    '  try {',
    '    $item = Get-Item -LiteralPath $oldExe -Force -ErrorAction SilentlyContinue',
    '    if ($item -and $item.IsReadOnly) { $item.IsReadOnly = $false }',
    '    Remove-Item -LiteralPath $oldExe -Force -ErrorAction Stop',
    '    if (-not (Test-Path -LiteralPath $oldExe)) {',
    '      $oldRemoved = $true',
    '      break',
    '    }',
    '  } catch {}',
    '  if ($attempt -eq 3 -or $attempt -eq 10) {',
    '    Stop-ProcessesMatchingExePath $oldExe',
    '  }',
    '  Start-Sleep -Milliseconds 400',
    '}',
    '',
    'if (-not $oldRemoved) {',
    "  try { Set-Content -LiteralPath (Join-Path $stagingDir 'update_error.log') -Value 'Failed to remove existing portable EXE.' -Encoding UTF8 } catch {}",
    '  exit 2',
    '}',
    '',
    'if (([string]::Compare($oldExe, $targetExe, $true) -ne 0) -and (Test-Path -LiteralPath $targetExe)) {',
    '  for ($k = 0; $k -lt 10; $k++) {',
    '    try {',
    '      Remove-Item -LiteralPath $targetExe -Force -ErrorAction Stop',
    '      if (-not (Test-Path -LiteralPath $targetExe)) { break }',
    '    } catch {}',
    '    if ($k -eq 2) { Stop-ProcessesMatchingExePath $targetExe }',
    '    Start-Sleep -Milliseconds 400',
    '  }',
    '}',
    '',
    'function Test-ValidPeExe($filePath) {',
    '  if (-not $filePath -or -not (Test-Path -LiteralPath $filePath)) { return $false }',
    '  try {',
    '    $fi = Get-Item -LiteralPath $filePath -ErrorAction Stop',
    '    if ($fi.Length -le 1024) { return $false }',
    '    $fs = [System.IO.File]::OpenRead($filePath)',
    '    try {',
    '      $b1 = $fs.ReadByte()',
    '      $b2 = $fs.ReadByte()',
    '      return ($b1 -eq 0x4D -and $b2 -eq 0x5A)',
    '    } finally {',
    '      $fs.Close()',
    '    }',
    '  } catch {',
    '    return $false',
    '  }',
    '}',
    '',
    '$copied = $false',
    'for ($c = 0; $c -lt 10; $c++) {',
    '  try {',
    '    Copy-Item -LiteralPath $stagedExe -Destination $targetExe -Force -ErrorAction Stop',
    '    if (Test-ValidPeExe $targetExe) {',
    '      $copied = $true',
    '      break',
    '    }',
    '  } catch {}',
    '  Start-Sleep -Milliseconds 400',
    '}',
    '',
    'if (-not $copied) {',
    '  if ($hasBackup -and (Test-Path -LiteralPath $backupOldExe)) {',
    '    try {',
    '      if (([string]::Compare($oldExe, $targetExe, $true) -eq 0) -and (Test-Path -LiteralPath $targetExe)) {',
    '        Remove-Item -LiteralPath $targetExe -Force -ErrorAction SilentlyContinue',
    '      }',
    '      Copy-Item -LiteralPath $backupOldExe -Destination $oldExe -Force -ErrorAction SilentlyContinue',
    '    } catch {}',
    '  }',
    "  try { Set-Content -LiteralPath (Join-Path $stagingDir 'update_error.log') -Value 'Failed to copy new portable EXE; restored backup if available.' -Encoding UTF8 } catch {}",
    '  exit 3',
    '}',
    '',
    'try {',
    '  Start-Process -FilePath $targetExe -WorkingDirectory $targetDir -ErrorAction Stop',
    '} catch {',
    '  try {',
    '    $psi = New-Object System.Diagnostics.ProcessStartInfo',
    '    $psi.FileName = $targetExe',
    '    $psi.WorkingDirectory = $targetDir',
    '    $psi.UseShellExecute = $true',
    '    [System.Diagnostics.Process]::Start($psi) | Out-Null',
    '  } catch {}',
    '}',
    '',
    'Start-Sleep -Milliseconds 500',
    'try {',
    '  if ($stagingDir -and (Test-Path -LiteralPath $stagingDir)) {',
    '    Remove-Item -LiteralPath $stagingDir -Recurse -Force -ErrorAction SilentlyContinue',
    '  }',
    '} catch {}',
  ].join('\r\n');
}

module.exports = {
  ALLOWED_GITHUB_REPO,
  detectEdition,
  detectPortableRuntimeInfo,
  isPortableExeAsset,
  selectMatchingPortableAsset,
  isAllowedGitHubDownloadUrl,
  sanitizeAssetExeName,
  parseExpandedAssetsHtml,
  validateDownloadedExecutable,
  escapePsSingleQuoted,
  buildPortableSelfUpdatePsScript,
};
