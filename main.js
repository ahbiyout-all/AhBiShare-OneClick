const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const https = require('https');
const dns = require('dns').promises;
const { spawn, execFile, execFileSync } = require('child_process');
const {
  createPortableStore,
  prepareLocationProfileForDisk,
  hydrateLocationProfile,
  atomicWriteJson,
} = require('./portableStore');
const {
  detectPortableRuntimeInfo,
  isAllowedGitHubDownloadUrl,
  sanitizeAssetExeName,
  parseExpandedAssetsHtml,
  validateDownloadedExecutable,
  buildPortableSelfUpdatePsScript,
} = require('./portableUpdater');
const APP_PKG_VERSION = (() => {
  try {
    return require('./package.json').version || '1.2.1';
  } catch {
    return '1.2.1';
  }
})();

let mainWindow = null;
const portableStore = createPortableStore({ env: process.env, app, baseDir: __dirname });

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 840,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#0F172A',
    title: 'AhBiShare OneClick',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const isDevFlag = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  const devUrl = process.env.VITE_DEV_URL || 'http://127.0.0.1:3000';
  const distHtml = path.join(__dirname, 'dist', 'index.html');
  const fallbackHtml = fs.existsSync(distHtml) ? distHtml : null;

  if (!app.isPackaged && isDevFlag) {
    mainWindow.loadURL(devUrl).catch(() => {
      if (fallbackHtml) mainWindow.loadFile(fallbackHtml);
    });
  } else if (fallbackHtml) {
    mainWindow.loadFile(fallbackHtml);
  } else {
    mainWindow.loadURL(devUrl);
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function getPowerShellExe() {
  const candidates = [
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'X:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'powershell.exe';
}

function decodeWindowsBuffer(buf) {
  if (!buf || buf.length === 0) return '';
  // Explicit UTF-16LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le').replace(/^\uFEFF/, '').replace(/\u0000/g, '');
  }
  // Distinguish real UTF-16LE (odd-index 0x00 interleaving) from UTF-8 containing an accidental stray 0x00 byte
  let oddZeros = 0;
  let evenZeros = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x00) {
      if (i % 2 === 1) oddZeros++;
      else evenZeros++;
    }
  }
  const cleaned = oddZeros + evenZeros > 0 ? Buffer.from(buf.filter((b) => b !== 0x00)) : buf;
  let strictUtf8 = null;
  try {
    strictUtf8 = new TextDecoder('utf-8', { fatal: true }).decode(cleaned).replace(/^\uFEFF/, '');
  } catch {
    strictUtf8 = null;
  }
  const hasRealUtf16Interleaving =
    oddZeros >= Math.max(4, Math.floor(buf.length * 0.2)) &&
    oddZeros >= evenZeros * 2 &&
    (oddZeros >= Math.floor(buf.length * 0.35) || strictUtf8 === null);
  if (hasRealUtf16Interleaving) {
    return buf.toString('utf16le').replace(/^\uFEFF/, '').replace(/\u0000/g, '');
  }

  if (strictUtf8 !== null) return strictUtf8;
  try {
    return new TextDecoder('euc-kr').decode(cleaned).replace(/^\uFEFF/, '');
  } catch {
    return cleaned.toString('utf8').replace(/^\uFEFF/, '');
  }
}

function executePowerShellScript(script, timeoutMs = 45000) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, output: '', error: 'Windows PowerShell is only available on Windows hosts.' });
      return;
    }

    const wrapped = [
      'try { $script:__AhBiOemEnc = [Console]::OutputEncoding } catch { $script:__AhBiOemEnc = [System.Text.Encoding]::Default }',
      '$script:__AhBiUtf8NoBom = New-Object System.Text.UTF8Encoding($false)',
      'try {',
      '  [Console]::InputEncoding = $script:__AhBiUtf8NoBom',
      '  [Console]::OutputEncoding = $script:__AhBiUtf8NoBom',
      '} catch {}',
      '$OutputEncoding = $script:__AhBiUtf8NoBom',
      "if (Get-Variable -Name PSDefaultParameterValues -ErrorAction SilentlyContinue) { $PSDefaultParameterValues['*:Encoding'] = 'utf8' }",
      script,
    ].join('\n');

    const tmpFile = path.join(os.tmpdir(), `ahbishare_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.ps1`);
    try {
      fs.writeFileSync(tmpFile, '\uFEFF' + wrapped, 'utf8');
    } catch (err) {
      resolve({ success: false, output: '', error: `Temp script write failed: ${err.message}` });
      return;
    }

    const ps = spawn(getPowerShellExe(), ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-NonInteractive', '-File', tmpFile], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const outChunks = [];
    const errChunks = [];
    let settled = false;

    const cleanupTmp = () => {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {}
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ps.kill();
      } catch {}
      cleanupTmp();
      resolve({ success: false, output: '', error: `PowerShell execution timed out after ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);

    ps.stdout.on('data', (d) => outChunks.push(d));
    ps.stderr.on('data', (d) => errChunks.push(d));

    ps.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanupTmp();
      const outBuf = Buffer.concat(outChunks);
      const errBuf = Buffer.concat(errChunks);
      const output = decodeWindowsBuffer(outBuf).trim();
      const error = decodeWindowsBuffer(errBuf).trim();
      resolve({
        success: code === 0,
        output,
        error,
      });
    });

    ps.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanupTmp();
      resolve({ success: false, output: '', error: err.message });
    });
  });
}

function checkWindowsAdmin() {
  if (process.platform !== 'win32') return false;
  try {
    execFileSync('net.exe', ['session'], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle('run-powershell', async (_event, { script }) => {
  return executePowerShellScript(script);
});

ipcMain.handle('select-folder', async () => {
  const win = BrowserWindow.getFocusedWindow() || (mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined);
  const dialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
    title: '공유할 폴더 선택',
  };
  const result = win
    ? await dialog.showOpenDialog(win, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || !result.filePaths.length) return { canceled: true, path: '' };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('open-path', async (_event, { targetPath }) => {
  if (!targetPath) return { success: false, error: 'Missing path' };
  const raw = String(targetPath).trim();
  if (/^ms-settings:windowsupdate$/i.test(raw)) {
    try {
      await shell.openExternal('ms-settings:windowsupdate');
      return { success: true, error: '' };
    } catch (err) {
      return { success: false, error: (err && err.message) || 'Failed to open Windows Update settings' };
    }
  }
  const normalized = process.platform === 'win32' ? raw.replace(/\//g, '\\') : raw;
  const errMsg = await shell.openPath(normalized);
  return { success: !errMsg, error: errMsg || '' };
});

const VIRTUAL_ADAPTER_REGEX = /(vethernet|wsl|vmware|virtualbox|vbox|docker|hyper-v|loopback|tailscale|zerotier|tap-|tunnel|hamachi|bluetooth)/i;

function scoreAdapter(name, address) {
  let score = 0;
  if (address.startsWith('169.254.')) return -1000; // APIPA link-local
  if (VIRTUAL_ADAPTER_REGEX.test(name)) score -= 500;
  if (address.startsWith('192.168.')) score += 100;
  else if (address.startsWith('10.')) score += 80;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 60;
  if (/^(wi-?fi|wlan|ethernet|이더넷|로컬 영역)/i.test(name)) score += 50;
  return score;
}

function classifyOsEraNode(build, displayVersion) {
  const disp = String(displayVersion || '').toUpperCase().trim();
  if (build >= 26200 || disp.includes('25H2') || disp.includes('26H1') || disp.includes('26H2')) return 'win11_25_26h2';
  if (build >= 26100 || disp.includes('24H2')) return 'win11_24h2';
  if (build >= 22000 || disp.includes('21H2') || disp.includes('22H2') || disp.includes('23H2')) return 'win11_21_23';
  return 'win10';
}

let cachedWindowsOsInfo = null;
function getWindowsOsDetails() {
  if (cachedWindowsOsInfo) return cachedWindowsOsInfo;
  if (process.platform !== 'win32') {
    cachedWindowsOsInfo = {
      osProductName: 'Windows 11 Pro',
      osDisplayVersion: '24H2',
      osBuild: 26100,
      osEra: 'win11_24h2',
    };
    return cachedWindowsOsInfo;
  }

  let build = 0;
  let dispVer = '';
  let prodName = 'Windows';
  const releaseParts = String(os.release() || '').split('.');
  if (releaseParts.length >= 3) {
    build = parseInt(releaseParts[2], 10) || 0;
  }
  try {
    const regOut = decodeWindowsBuffer(
      execFileSync(
        'reg.exe',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'],
        { windowsHide: true, timeout: 3000 }
      )
    );
    const bMatch = regOut.match(/CurrentBuildNumber\s+REG_SZ\s+(\d+)/i);
    if (bMatch) build = parseInt(bMatch[1], 10) || build;
    const dMatch = regOut.match(/DisplayVersion\s+REG_SZ\s+([^\r\n]+)/i) || regOut.match(/ReleaseId\s+REG_SZ\s+([^\r\n]+)/i);
    if (dMatch) dispVer = dMatch[1].trim();
    const pMatch = regOut.match(/ProductName\s+REG_SZ\s+([^\r\n]+)/i);
    if (pMatch) {
      prodName = pMatch[1].trim();
      if (build >= 22000) prodName = prodName.replace(/Windows 10/i, 'Windows 11');
    }
  } catch {}

  const fallbackDispVer =
    build >= 26200
      ? '25H2/26H2'
      : build >= 26100
        ? '24H2'
        : build >= 22000
          ? '23H2'
          : build >= 10240
            ? '22H2'
            : build >= 9600
              ? '8.1'
              : build >= 9000
                ? '8.0'
                : 'SP1';

  cachedWindowsOsInfo = {
    osProductName: prodName,
    osDisplayVersion: dispVer || fallbackDispVer,
    osBuild: build || 19045,
    osEra: classifyOsEraNode(build || 19045, dispVer),
  };
  return cachedWindowsOsInfo;
}

function getLocalNetworkDetails() {
  const ifaces = os.networkInterfaces();
  const hostname = os.hostname();
  const candidates = [];

  for (const [name, entries] of Object.entries(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        candidates.push({
          name,
          address: entry.address,
          score: scoreAdapter(name, entry.address),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const primaryIp = best ? best.address : '127.0.0.1';
  const adapterName = best ? best.name : 'Ethernet';
  const octets = primaryIp.split('.');
  const subnetPrefix = octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}` : '192.168.0';
  const osInfo = getWindowsOsDetails();

  return {
    hostname,
    primaryIp,
    adapterName,
    subnetPrefix,
    isAdmin: checkWindowsAdmin(),
    ...osInfo,
  };
}

ipcMain.handle('get-local-network-info', async () => {
  return getLocalNetworkDetails();
});

function probePort445(ip, timeoutMs = 260) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ip, open, latencyMs: Math.max(1, Date.now() - start) });
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
    socket.connect(445, ip);
  });
}

function isValidSubnetPrefix(prefix) {
  const parts = String(prefix || '').trim().split('.');
  if (parts.length !== 3) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

ipcMain.handle('scan-lan-peers', async (_event, { subnetPrefix }) => {
  const info = getLocalNetworkDetails();
  const prefix = isValidSubnetPrefix(subnetPrefix) ? String(subnetPrefix).trim() : info.subnetPrefix;
  if (!isValidSubnetPrefix(prefix) || prefix.startsWith('127.')) {
    return { success: true, peers: [], subnetPrefix: prefix };
  }

  const targets = [];
  for (let i = 1; i <= 254; i++) {
    const candidate = `${prefix}.${i}`;
    if (candidate !== info.primaryIp) targets.push(candidate);
  }

  const batchSize = 48;
  const openPeers = [];
  for (let i = 0; i < targets.length; i += batchSize) {
    const chunk = targets.slice(i, i + batchSize);
    const results = await Promise.all(chunk.map((ip) => probePort445(ip, 260)));
    for (const res of results) {
      if (res.open) openPeers.push(res);
    }
  }

  async function inspectPeer(peer) {
    let hostName = peer.ip;
    let shares = [];
    if (process.platform === 'win32') {
      const res = await executePowerShellScript(
        `
          $p_ip = '${peer.ip}'
          $h = try { ([System.Net.Dns]::GetHostEntry($p_ip)).HostName.Split('.')[0] } catch { $p_ip }
          try { [Console]::OutputEncoding = $script:__AhBiOemEnc } catch {}
          $raw = & net.exe view "\\\\$p_ip" 2>$null
          try { [Console]::OutputEncoding = $script:__AhBiUtf8NoBom } catch {}
          $s = @()
          foreach ($line in $raw) {
            if ($line -match '^(.+?)\\s{2,}(Disk|디스크)\\b') {
              $name = $matches[1].Trim()
              if ($name -and $name -notmatch '\\$$') { $s += $name }
            }
          }
          $resHash = @{ hostName = $h; shares = $s }
          if (Get-Command ConvertTo-Json -ErrorAction SilentlyContinue) {
            $resObj = New-Object PSObject -Property $resHash
            $resObj | ConvertTo-Json -Compress
          } else {
            try {
              Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
              $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
              $ser.Serialize($resHash)
            } catch {
              $escHost = "$h".Replace('\\', '\\\\').Replace('"', '\\"')
              $escShares = ($s | ForEach-Object { '"' + ("$_".Replace('\\', '\\\\').Replace('"', '\\"')) + '"' }) -join ','
              '{"hostName":"' + $escHost + '","shares":[' + $escShares + ']}'
            }
          }
        `,
        12000
      );
      if (res.success && res.output) {
        try {
          const parsed = JSON.parse(res.output);
          if (parsed.hostName) hostName = parsed.hostName;
          if (Array.isArray(parsed.shares)) shares = parsed.shares;
          else if (typeof parsed.shares === 'string' && parsed.shares) shares = [parsed.shares];
        } catch {}
      }
    }
    return {
      hostName,
      ipAddress: peer.ip,
      latencyMs: peer.latencyMs,
      smbPortOpen: true,
      availableShares: shares,
      authModeHint: 'unknown',
      lastSeen: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    };
  }

  const peers = [];
  const concurrency = 4;
  for (let i = 0; i < openPeers.length; i += concurrency) {
    const batch = openPeers.slice(i, i + concurrency);
    const inspected = await Promise.all(batch.map(inspectPeer));
    peers.push(...inspected);
  }

  return { success: true, peers, subnetPrefix: prefix };
});

function parsePingOutput(stdout) {
  const times = [];
  // Matches Windows EN (time=2ms / time<1ms), Windows KO (시간=2ms / 시간<1ms), Linux (time=2.34 ms)
  const regex = /(?:time|시간)\s*([<=])\s*(\d+(?:\.\d+)?)\s*ms/gi;
  let m;
  while ((m = regex.exec(stdout)) !== null) {
    const val = parseFloat(m[2]);
    if (!Number.isNaN(val)) {
      times.push(m[1] === '<' ? Math.max(1, val) : Math.max(1, Math.round(val)));
    }
  }
  const lossMatch = stdout.match(/(\d+(?:\.\d+)?)\s*%\s*(?:loss|packet loss|손실)/i);
  const packetLossPct = lossMatch ? Math.round(parseFloat(lossMatch[1])) : (times.length > 0 ? 0 : 100);
  if (times.length === 0) {
    return { latencies: [], avgLatencyMs: null, minLatencyMs: null, maxLatencyMs: null, packetLossPct };
  }
  const sum = times.reduce((acc, n) => acc + n, 0);
  return {
    latencies: times,
    avgLatencyMs: Math.round(sum / times.length),
    minLatencyMs: Math.min(...times),
    maxLatencyMs: Math.max(...times),
    packetLossPct,
  };
}

function runSystemPing(target) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const args = isWin ? ['-n', '3', '-w', '1000', target] : ['-c', '3', '-W', '1', target];
    execFile('ping', args, { encoding: 'buffer', timeout: 6000, windowsHide: true }, (err, stdoutBuf, stderrBuf) => {
      const stdout = decodeWindowsBuffer(stdoutBuf);
      const stderr = decodeWindowsBuffer(stderrBuf);
      const combined = `${stdout}\n${stderr}`;
      const stats = parsePingOutput(combined);
      const reachable = stats.latencies.length > 0 || (!err && stats.packetLossPct < 100);
      resolve({ reachable, ...stats });
    });
  });
}

ipcMain.handle('ping-host', async (_event, { target }) => {
  const cleanTarget = String(target || '').trim();
  if (!cleanTarget || /[\x00-\x1f\\/:*?"<>|\s;&$`'(){}[\]!]/.test(cleanTarget)) {
    return {
      target: cleanTarget,
      reachable: false,
      avgLatencyMs: null,
      minLatencyMs: null,
      maxLatencyMs: null,
      packetLossPct: 100,
      smbPortOpen: false,
      detail: '유효하지 않은 IP 주소 또는 호스트 이름입니다.',
      checkedAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
    };
  }

  let resolvedIp = net.isIP(cleanTarget) ? cleanTarget : undefined;
  if (!resolvedIp) {
    try {
      const looked = await dns.lookup(cleanTarget, { family: 4 });
      resolvedIp = looked.address;
    } catch {}
  }

  const probeAddr = resolvedIp || cleanTarget;
  const [pingStats, smbProbe] = await Promise.all([
    runSystemPing(probeAddr),
    probePort445(probeAddr, 1500),
  ]);

  const reachable = pingStats.reachable || smbProbe.open;
  const avgLatencyMs = pingStats.avgLatencyMs ?? (smbProbe.open ? smbProbe.latencyMs : null);
  const minLatencyMs = pingStats.minLatencyMs ?? (smbProbe.open ? smbProbe.latencyMs : null);
  const maxLatencyMs = pingStats.maxLatencyMs ?? (smbProbe.open ? smbProbe.latencyMs : null);

  let detail = '';
  if (pingStats.reachable && smbProbe.open) {
    detail = `호스트 응답(${avgLatencyMs}ms) 및 SMB 포트 445 개방 확인 — 즉시 연결 가능합니다.`;
  } else if (pingStats.reachable && !smbProbe.open) {
    detail = `호스트 Ping(${avgLatencyMs}ms)은 정상이나 TCP 445가 닫혀 있습니다. 메인 PC에서 [원클릭 공유폴더 개설]을 실행하세요.`;
  } else if (!pingStats.reachable && smbProbe.open) {
    detail = `ICMP Ping은 방화벽에서 차단되었으나 SMB 포트 445(${smbProbe.latencyMs}ms)가 응답하여 연결 가능합니다.`;
  } else {
    detail = `대상 PC(${cleanTarget})에 연결할 수 없습니다. 전원, 동일 LAN/Wi-Fi 대역 및 IP를 확인하세요.`;
  }

  return {
    target: cleanTarget,
    resolvedIp,
    reachable,
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    packetLossPct: pingStats.packetLossPct,
    smbPortOpen: smbProbe.open,
    detail,
    checkedAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
  };
});

ipcMain.handle('get-portable-status', async () => {
  return portableStore.getStatus();
});

ipcMain.handle('load-portable-data', async () => {
  return portableStore.loadPortableData();
});

ipcMain.handle('save-portable-data', async (_event, { document }) => {
  return portableStore.savePortableData(document);
});

ipcMain.handle('trigger-system-reboot', async () => {
  if (process.platform !== 'win32') {
    return { success: false, message: 'Windows 환경에서만 시스템 재부팅을 실행할 수 있습니다.' };
  }
  return new Promise((resolve) => {
    execFile(
      'shutdown.exe',
      ['/r', '/t', '5', '/c', 'AhBiShare OneClick 네트워크 정책 변경 적용을 위해 5초 후 재부팅합니다.'],
      { encoding: 'buffer', windowsHide: true },
      (err, _stdout, stderrBuf) => {
        if (err) {
          const msg = decodeWindowsBuffer(stderrBuf) || err.message;
          resolve({ success: false, message: `재부팅 예약 실패: ${msg}` });
          return;
        }
        resolve({ success: true, message: '5초 후 Windows가 재부팅됩니다.' });
      }
    );
  });
});

ipcMain.handle('save-legacy-scripts', async (_event, payload) => {
  const folderName = String(payload?.folderName || 'AhBiShare_Legacy_Win7_Win8_Kit').replace(/[^A-Za-z0-9_.-]/g, '') || 'AhBiShare_Legacy_Win7_Win8_Kit';
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (files.length === 0) {
    return { success: false, directory: '', savedFiles: [], message: '저장할 스크립트 파일 목록이 비어 있습니다.' };
  }

  const portStatus = portableStore.getStatus();
  let baseDir = portStatus.directory;

  if (!portStatus.writable) {
    const win = BrowserWindow.getFocusedWindow() || (mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined);
    const pickerOpts = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Win 7·8·8.1 스크립트 패키지를 저장할 USB/폴더 선택',
    };
    const picked = win ? await dialog.showOpenDialog(win, pickerOpts) : await dialog.showOpenDialog(pickerOpts);
    if (picked.canceled || !picked.filePaths.length) {
      return { success: false, directory: '', savedFiles: [], message: '저장할 폴더 선택이 취소되었습니다.' };
    }
    baseDir = picked.filePaths[0];
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedBasePrefix = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
  const targetDir = path.resolve(resolvedBase, folderName);
  if (!targetDir.startsWith(resolvedBasePrefix)) {
    return {
      success: false,
      directory: '',
      savedFiles: [],
      message: '허용되지 않은 저장 폴더 경로입니다.',
    };
  }
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const targetDirPrefix = targetDir.endsWith(path.sep) ? targetDir : targetDir + path.sep;
    const savedFiles = [];
    for (const item of files) {
      const safeName = path.basename(String(item?.name || ''));
      if (!safeName || !/^[A-Za-z0-9_.-]+$/.test(safeName)) continue;
      const outPath = path.resolve(targetDir, safeName);
      if (!outPath.startsWith(targetDirPrefix)) continue;
      const rawContent = String(item?.content || '');
      if (safeName.toLowerCase().endsWith('.reg')) {
        // UTF-16LE with BOM ensures Windows 7/8/10/11 regedit.exe imports cleanly regardless of system codepage
        fs.writeFileSync(outPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(rawContent, 'utf16le')]));
      } else {
        fs.writeFileSync(outPath, rawContent, { encoding: 'utf8' });
      }
      savedFiles.push(outPath);
    }
    if (savedFiles.length === 0) {
      return {
        success: false,
        directory: targetDir,
        savedFiles: [],
        message: '저장 가능한 유효한 스크립트 파일이 없습니다.',
      };
    }
    return {
      success: true,
      directory: targetDir,
      savedFiles,
      message: `USB 폴더(${targetDir})에 적용·원복 스크립트 ${savedFiles.length}개를 저장했습니다.`,
    };
  } catch (err) {
    return {
      success: false,
      directory: targetDir,
      savedFiles: [],
      message: `스크립트 파일 저장 실패: ${err && err.message ? err.message : '권한 또는 디스크 오류'}`,
    };
  }
});

ipcMain.handle('list-location-profiles', async () => {
  return portableStore.listLocationProfiles();
});

ipcMain.handle('save-location-profile', async (_event, { profile }) => {
  return portableStore.saveLocationProfile(profile);
});

ipcMain.handle('load-location-profile', async (_event, { profileId }) => {
  return portableStore.loadLocationProfile(profileId);
});

ipcMain.handle('delete-location-profile', async (_event, { profileId }) => {
  return portableStore.deleteLocationProfile(profileId);
});

ipcMain.handle('export-location-profile-file', async (_event, { profile }) => {
  try {
    const diskProfile = prepareLocationProfileForDisk(profile);
    const portStatus = portableStore.getStatus();
    const defaultDir = portStatus.writable ? path.join(portStatus.directory, 'locations') : app.getPath('documents');
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch {}
    const defaultName = `${diskProfile.profileId}.location.json`;
    const win = BrowserWindow.getFocusedWindow() || (mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined);
    const saveOpts = {
      title: '사용장소 프로필(.json) 내보내기',
      defaultPath: path.join(defaultDir, defaultName),
      filters: [{ name: 'AhBiShare 사용장소 프로필 (*.json)', extensions: ['json'] }],
    };
    const picked = win ? await dialog.showSaveDialog(win, saveOpts) : await dialog.showSaveDialog(saveOpts);
    if (picked.canceled || !picked.filePath) {
      return { success: false, canceled: true, message: '프로필 파일 내보내기가 취소되었습니다.' };
    }
    const writeRes = atomicWriteJson(picked.filePath, diskProfile);
    if (!writeRes.success) {
      return { success: false, error: writeRes.error, message: `파일 저장 실패: ${writeRes.error}` };
    }
    return {
      success: true,
      filePath: picked.filePath,
      message: `사용장소 '${diskProfile.locationName}' 프로필을 파일로 내보냈습니다.`,
    };
  } catch (err) {
    return {
      success: false,
      message: `사용장소 내보내기 실패: ${err && err.message ? err.message : '알 수 없는 오류'}`,
    };
  }
});

ipcMain.handle('import-location-profile-file', async (_event, payload) => {
  try {
    const saveToCatalog = payload?.saveToCatalog !== false;
    const portStatus = portableStore.getStatus();
    const defaultDir = path.join(portStatus.directory, 'locations');
    const win = BrowserWindow.getFocusedWindow() || (mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined);
    const openOpts = {
      title: '사용장소 프로필(.json) 불러오기',
      ...(fs.existsSync(defaultDir) ? { defaultPath: defaultDir } : {}),
      properties: ['openFile'],
      filters: [{ name: 'AhBiShare 사용장소 프로필 (*.json)', extensions: ['json'] }],
    };
    const picked = win ? await dialog.showOpenDialog(win, openOpts) : await dialog.showOpenDialog(openOpts);
    if (picked.canceled || !picked.filePaths.length) {
      return { success: false, canceled: true, message: '프로필 파일 선택이 취소되었습니다.' };
    }
    const selectedPath = picked.filePaths[0];
    const raw = fs.readFileSync(selectedPath, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    const hydrated = hydrateLocationProfile(parsed);
    let savedToCatalog = false;
    if (saveToCatalog) {
      const saveRes = portableStore.saveLocationProfile(hydrated);
      savedToCatalog = Boolean(saveRes.success);
    }
    return {
      success: true,
      profile: hydrated,
      filePath: selectedPath,
      savedToCatalog,
      message: `사용장소 '${hydrated.locationName}' 프로필을 가져왔습니다.`,
    };
  } catch (err) {
    return {
      success: false,
      message: `사용장소 파일 불러오기 실패: ${err && err.message ? err.message : '올바른 JSON 프로필이 아닙니다.'}`,
    };
  }
});

function fetchTextHttps(urlString, headers = {}, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(String(urlString || '').trim());
    } catch {
      reject(new Error('Invalid update check URL'));
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      reject(new Error('Only HTTPS URLs are allowed for update checks'));
      return;
    }

    let settled = false;
    const failOnce = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    try {
      const req = https.get(
        parsedUrl.toString(),
        {
          headers: {
            'User-Agent': `AhBiShare-OneClick/${app.getVersion() || APP_PKG_VERSION}`,
            ...headers,
          },
          timeout: 8000,
        },
        (res) => {
          const status = res.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) {
              failOnce(new Error('Too many redirects during update check'));
              return;
            }
            let nextUrl = '';
            try {
              const resolvedNext = new URL(res.headers.location, parsedUrl.toString());
              if (resolvedNext.protocol !== 'https:') {
                failOnce(new Error('Redirected to non-HTTPS URL during update check'));
                return;
              }
              nextUrl = resolvedNext.toString();
            } catch {
              failOnce(new Error('Invalid redirect URL during update check'));
              return;
            }
            settled = true;
            fetchTextHttps(nextUrl, headers, redirectsLeft - 1).then(resolve, reject);
            return;
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('error', (err) => failOnce(err));
          res.on('end', () => {
            if (settled) return;
            settled = true;
            resolve({
              status,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        }
      );
      req.on('timeout', () => {
        req.destroy(new Error('GitHub update check timed out'));
      });
      req.on('error', (err) => failOnce(err));
    } catch (err) {
      failOnce(err);
    }
  });
}

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

ipcMain.handle('check-github-updates', async () => {
  const apiUrl = 'https://api.github.com/repos/ahbiyout-all/AhBiShare-OneClick/releases/latest';
  const atomUrl = 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases.atom';

  try {
    const apiRes = await fetchTextHttps(apiUrl, { Accept: 'application/vnd.github.v3+json' });
    if (apiRes.status >= 200 && apiRes.status < 300) {
      const data = JSON.parse(apiRes.body);
      const tagName = String(data.tag_name || '').trim();
      if (tagName) {
        const assets = Array.isArray(data.assets)
          ? data.assets
              .filter((a) => a && a.name && a.browser_download_url)
              .map((a) => ({
                name: String(a.name),
                browserDownloadUrl: String(a.browser_download_url),
                size: Number(a.size) || 0,
              }))
          : [];
        return {
          ok: true,
          release: {
            tagName,
            name: String(data.name || tagName),
            body: String(data.body || '새로운 업데이트가 출시되었습니다.'),
            htmlUrl: String(data.html_url || 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases'),
            publishedAt: String(data.published_at || ''),
            assets,
          },
        };
      }
    }
  } catch {}

  try {
    const atomRes = await fetchTextHttps(atomUrl, { Accept: 'application/atom+xml,application/xml,text/xml' });
    if (atomRes.status >= 200 && atomRes.status < 300) {
      const entryMatch = atomRes.body.match(/<entry>([\s\S]*?)<\/entry>/i);
      if (entryMatch) {
        const entry = entryMatch[1];
        const linkMatch = entry.match(/<link[^>]+href=["']([^"']+)["']/i);
        const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const updatedMatch = entry.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
        const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
        const htmlUrl = linkMatch ? decodeXmlEntities(linkMatch[1]) : 'https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/latest';
        const tagMatch = htmlUrl.match(/\/releases\/tag\/([^/?#\s]+)/i);
        const rawTitle = titleMatch ? decodeXmlEntities(titleMatch[1]).trim() : '';
        const tagName = tagMatch ? decodeURIComponent(tagMatch[1]) : rawTitle;
        const bodyText = contentMatch
          ? decodeXmlEntities(
              decodeXmlEntities(contentMatch[1])
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/(?:p|li|h[1-6]|div)>/gi, '\n')
                .replace(/<[^>]+>/g, ' ')
            )
              .replace(/[ \t]+\n/g, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .replace(/[ \t]{2,}/g, ' ')
              .trim()
          : 'GitHub Releases 페이지에서 최신 릴리즈 상세 내역 및 설치 파일을 확인할 수 있습니다.';
        if (tagName) {
          let fallbackAssets = [];
          try {
            const expandedUrl = `https://github.com/ahbiyout-all/AhBiShare-OneClick/releases/expanded_assets/${encodeURIComponent(tagName)}`;
            const expandedRes = await fetchTextHttps(expandedUrl, { Accept: 'text/html' });
            if (expandedRes.status >= 200 && expandedRes.status < 300) {
              fallbackAssets = parseExpandedAssetsHtml(expandedRes.body);
            }
          } catch {}
          return {
            ok: true,
            release: {
              tagName,
              name: rawTitle || tagName,
              body: bodyText || '새로운 업데이트가 출시되었습니다.',
              htmlUrl,
              publishedAt: updatedMatch ? updatedMatch[1].trim() : '',
              assets: fallbackAssets,
            },
          };
        }
      } else if (/<feed\b/i.test(atomRes.body)) {
        return { ok: true, release: null };
      }
    }
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'GitHub 릴리즈 조회 실패' };
  }

  return { ok: false, error: 'GitHub 최신 릴리즈 정보를 불러오지 못했습니다.' };
});

ipcMain.handle('open-external-url', async (_event, { url }) => {
  const safeUrl = String(url || '').trim();
  if (!/^https?:\/\//i.test(safeUrl)) {
    return { success: false, error: '허용되지 않은 외부 URL 형식입니다.' };
  }
  try {
    await shell.openExternal(safeUrl);
    return { success: true };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : '외부 브라우저 열기에 실패했습니다.' };
  }
});

let activeUpdateDownload = null;
let isPortableReplacementQueued = false;

function emitUpdateProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('github-update-progress', payload);
    } catch {}
  }
}

function downloadFileHttpsWithProgress(urlString, destFilePath, expectedSize, onProgress, stateRef, redirectsLeft = 6) {
  return new Promise((resolve, reject) => {
    if (stateRef.cancelled) {
      reject(new Error('사용자에 의해 다운로드가 취소되었습니다.'));
      return;
    }
    if (!isAllowedGitHubDownloadUrl(urlString)) {
      reject(new Error('허용되지 않은 업데이트 다운로드 URL입니다.'));
      return;
    }

    let settled = false;
    const req = https.get(
      urlString,
      {
        headers: {
          'User-Agent': `AhBiShare-OneClick/${app.getVersion() || APP_PKG_VERSION}`,
          Accept: 'application/octet-stream,*/*',
        },
        timeout: 30000,
      },
      (res) => {
        stateRef.res = res;
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            settled = true;
            reject(new Error('리다이렉트 횟수를 초과했습니다.'));
            return;
          }
          let nextUrl = '';
          try {
            nextUrl = new URL(res.headers.location, urlString).toString();
          } catch {
            settled = true;
            reject(new Error('잘못된 리다이렉트 URL입니다.'));
            return;
          }
          settled = true;
          downloadFileHttpsWithProgress(nextUrl, destFilePath, expectedSize, onProgress, stateRef, redirectsLeft - 1).then(
            resolve,
            reject
          );
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          settled = true;
          reject(new Error(`다운로드 HTTP 오류 (${status})`));
          return;
        }

        const headerLen = Number(res.headers['content-length']) || 0;
        const totalBytes = headerLen > 0 ? headerLen : Number(expectedSize) || 0;
        let downloadedBytes = 0;
        let lastEmitAt = 0;

        const outStream = fs.createWriteStream(destFilePath);
        stateRef.stream = outStream;

        const failWithClose = (err) => {
          if (settled) return;
          settled = true;
          try {
            res.unpipe(outStream);
          } catch {}
          try {
            req.destroy();
          } catch {}
          try {
            res.destroy();
          } catch {}
          try {
            outStream.close(() => reject(err));
          } catch {
            try {
              outStream.destroy();
            } catch {}
            reject(err);
          }
        };

        res.on('data', (chunk) => {
          if (stateRef.cancelled) {
            failWithClose(new Error('사용자에 의해 다운로드가 취소되었습니다.'));
            return;
          }
          downloadedBytes += chunk.length;
          const now = Date.now();
          if (now - lastEmitAt >= 120 || (totalBytes > 0 && downloadedBytes >= totalBytes)) {
            lastEmitAt = now;
            const percent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            onProgress({ downloadedBytes, totalBytes, percent });
          }
        });

        res.on('aborted', () => {
          failWithClose(
            new Error(stateRef.cancelled ? '사용자에 의해 다운로드가 취소되었습니다.' : '다운로드 연결이 중단되었습니다.')
          );
        });

        res.on('close', () => {
          if (!settled && !res.complete) {
            failWithClose(
              new Error(stateRef.cancelled ? '사용자에 의해 다운로드가 취소되었습니다.' : '다운로드가 완료되기 전에 연결이 종료되었습니다.')
            );
          }
        });

        res.on('error', (err) => failWithClose(err));
        outStream.on('error', (err) => failWithClose(err));

        outStream.on('finish', () => {
          outStream.close(() => {
            if (settled) return;
            if (stateRef.cancelled) {
              settled = true;
              reject(new Error('사용자에 의해 다운로드가 취소되었습니다.'));
              return;
            }
            if (!res.complete) {
              settled = true;
              reject(new Error('다운로드 스트림이 불완전하게 종료되었습니다.'));
              return;
            }
            settled = true;
            resolve({ downloadedBytes, totalBytes });
          });
        });

        res.pipe(outStream);
      }
    );

    stateRef.req = req;
    req.on('timeout', () => {
      req.destroy(new Error('업데이트 파일 다운로드 응답 시간이 초과되었습니다.'));
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(stateRef.cancelled ? new Error('사용자에 의해 다운로드가 취소되었습니다.') : err);
    });
  });
}

ipcMain.handle('get-update-runtime-info', async () => {
  const osInfo = getWindowsOsDetails();
  return detectPortableRuntimeInfo({
    env: process.env,
    app,
    execPath: process.execPath,
    osBuild: osInfo.osBuild,
  });
});

ipcMain.handle('cancel-portable-update', async () => {
  const targetDownload = activeUpdateDownload;
  if (!targetDownload) {
    return { success: true, cancelled: false };
  }
  targetDownload.cancelled = true;
  try {
    if (targetDownload.req) targetDownload.req.destroy();
  } catch {}
  try {
    if (targetDownload.res) targetDownload.res.destroy();
  } catch {}
  if (targetDownload.cleanupPromise) {
    try {
      await targetDownload.cleanupPromise;
    } catch {}
  }
  emitUpdateProgress({
    phase: 'cancelled',
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    message: '업데이트 다운로드가 취소되었습니다.',
  });
  return { success: true, cancelled: true };
});

ipcMain.handle('install-portable-update', async (_event, payload) => {
  if (activeUpdateDownload || isPortableReplacementQueued) {
    return { success: false, error: '이미 업데이트 다운로드 또는 교체가 진행 중입니다.' };
  }

  const osInfo = getWindowsOsDetails();
  const runtime = detectPortableRuntimeInfo({
    env: process.env,
    app,
    execPath: process.execPath,
    osBuild: osInfo.osBuild,
  });

  if (!runtime.canSelfReplace || !runtime.portableExePath) {
    return {
      success: false,
      error: runtime.reason || '포터블 EXE 실행 환경이 아니므로 자동 교체를 실행할 수 없습니다.',
    };
  }

  const downloadUrl = String(payload?.downloadUrl || '').trim();
  const safeAssetName = sanitizeAssetExeName(payload?.assetName);
  const expectedSize = Number(payload?.expectedSize) || 0;

  if (!isAllowedGitHubDownloadUrl(downloadUrl)) {
    return { success: false, error: '신뢰할 수 있는 GitHub 공식 릴리즈 다운로드 주소가 아닙니다.' };
  }
  if (!safeAssetName || safeAssetName.toLowerCase().includes('setup')) {
    return { success: false, error: '포터블 교체용 실행 파일(.exe)만 자동 교체를 지원합니다.' };
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahbishare-portable-update-'));
  const partFilePath = path.join(stagingDir, `${safeAssetName}.part`);
  const stagedExePath = path.join(stagingDir, safeAssetName);
  const psScriptPath = path.join(stagingDir, 'apply_portable_update.ps1');
  const targetExePath = path.join(runtime.portableDir, safeAssetName);

  let resolveCleanup = () => {};
  const cleanupPromise = new Promise((res) => {
    resolveCleanup = res;
  });

  const downloadState = {
    cancelled: false,
    req: null,
    res: null,
    stream: null,
    stagingDir,
    cleanupPromise,
  };
  activeUpdateDownload = downloadState;

  const cleanupStaging = () => {
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {}
  };

  try {
    emitUpdateProgress({
      phase: 'downloading',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: expectedSize,
      message: `${safeAssetName} 내려받는 중...`,
    });

    const dlRes = await downloadFileHttpsWithProgress(
      downloadUrl,
      partFilePath,
      expectedSize,
      ({ downloadedBytes, totalBytes, percent }) => {
        emitUpdateProgress({
          phase: 'downloading',
          percent,
          downloadedBytes,
          totalBytes,
          message: totalBytes > 0 ? `${safeAssetName} 내려받는 중... (${percent}%)` : `${safeAssetName} 내려받는 중...`,
        });
      },
      downloadState
    );

    emitUpdateProgress({
      phase: 'verifying',
      percent: 100,
      downloadedBytes: dlRes.downloadedBytes,
      totalBytes: dlRes.totalBytes || dlRes.downloadedBytes,
      message: '다운로드 파일 무결성(PE 실행 헤더) 검증 중...',
    });

    const verifyRes = validateDownloadedExecutable(partFilePath, dlRes.totalBytes || expectedSize);
    if (!verifyRes.valid) {
      cleanupStaging();
      emitUpdateProgress({
        phase: 'error',
        percent: 0,
        downloadedBytes: dlRes.downloadedBytes,
        totalBytes: dlRes.totalBytes,
        message: verifyRes.error || '다운로드된 파일 검증에 실패했습니다.',
      });
      return { success: false, error: verifyRes.error || '다운로드된 파일 검증 실패' };
    }

    fs.renameSync(partFilePath, stagedExePath);

    const psScript = buildPortableSelfUpdatePsScript({
      appPid: process.pid,
      parentPid: process.ppid || 0,
      oldExePath: runtime.portableExePath,
      stagedExePath,
      targetExePath,
      stagingDir,
    });
    fs.writeFileSync(psScriptPath, `\uFEFF${psScript}`, 'utf8');

    emitUpdateProgress({
      phase: 'replacing',
      percent: 100,
      downloadedBytes: dlRes.downloadedBytes,
      totalBytes: dlRes.downloadedBytes,
      message: `기존 포터블(${runtime.currentExeName}) 종료·제거 후 ${safeAssetName} 교체·재실행 중...`,
    });

    let exitTimer = null;
    const updaterProc = spawn(
      getPowerShellExe(),
      ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', psScriptPath],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }
    );
    if (!updaterProc || !updaterProc.pid) {
      cleanupStaging();
      const spawnErrMsg = '포터블 교체 PowerShell 업데이터 프로세스를 시작하지 못했습니다.';
      emitUpdateProgress({
        phase: 'error',
        percent: 0,
        downloadedBytes: dlRes.downloadedBytes,
        totalBytes: dlRes.downloadedBytes,
        message: spawnErrMsg,
      });
      return { success: false, error: spawnErrMsg };
    }

    isPortableReplacementQueued = true;
    updaterProc.once('error', (spawnErr) => {
      if (exitTimer) {
        clearTimeout(exitTimer);
        exitTimer = null;
      }
      isPortableReplacementQueued = false;
      cleanupStaging();
      emitUpdateProgress({
        phase: 'error',
        percent: 0,
        downloadedBytes: dlRes.downloadedBytes,
        totalBytes: dlRes.downloadedBytes,
        message: `포터블 교체 백그라운드 실행 오류: ${spawnErr && spawnErr.message ? spawnErr.message : '알 수 없는 오류'}`,
      });
    });
    updaterProc.unref();

    exitTimer = setTimeout(() => {
      exitTimer = null;
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.destroy();
        }
      } catch {}
      app.exit(0);
    }, 350);

    return {
      success: true,
      oldExePath: runtime.portableExePath,
      targetExePath,
    };
  } catch (err) {
    const errMsg = err && err.message ? err.message : '포터블 자동 업데이트 중 오류가 발생했습니다.';
    const wasCancelled = downloadState.cancelled;
    cleanupStaging();
    if (!wasCancelled) {
      emitUpdateProgress({
        phase: 'error',
        percent: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        message: errMsg,
      });
    }
    return {
      success: false,
      cancelled: wasCancelled,
      error: errMsg,
    };
  } finally {
    if (activeUpdateDownload === downloadState) {
      activeUpdateDownload = null;
    }
    resolveCleanup();
  }
});

