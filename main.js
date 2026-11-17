const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const dns = require('dns').promises;
const { spawn, execFile, execFileSync } = require('child_process');
const { createPortableStore } = require('./portableStore');

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
  // UTF-16LE BOM or null-byte interleaved pattern (common in WinPE / PowerShell unicode streams)
  if ((buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) || buf.includes(0x00)) {
    return buf.toString('utf16le').replace(/^\uFEFF/, '');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '');
  } catch {
    try {
      return new TextDecoder('euc-kr').decode(buf).replace(/^\uFEFF/, '');
    } catch {
      return buf.toString('utf8').replace(/^\uFEFF/, '');
    }
  }
}

function executePowerShellScript(script, timeoutMs = 45000) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, output: '', error: 'Windows PowerShell is only available on Windows hosts.' });
      return;
    }

    const wrapped = [
      '$script:__AhBiOemEnc = [Console]::OutputEncoding',
      '$script:__AhBiUtf8NoBom = New-Object System.Text.UTF8Encoding($false)',
      '[Console]::InputEncoding = $script:__AhBiUtf8NoBom',
      '[Console]::OutputEncoding = $script:__AhBiUtf8NoBom',
      '$OutputEncoding = $script:__AhBiUtf8NoBom',
      "$PSDefaultParameterValues['*:Encoding'] = 'utf8'",
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
          [Console]::OutputEncoding = $script:__AhBiOemEnc
          $raw = & net.exe view "\\\\$p_ip" 2>$null
          [Console]::OutputEncoding = $script:__AhBiUtf8NoBom
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
  const targetDir = path.resolve(resolvedBase, folderName);
  if (!targetDir.startsWith(resolvedBase + path.sep)) {
    return {
      success: false,
      directory: '',
      savedFiles: [],
      message: '허용되지 않은 저장 폴더 경로입니다.',
    };
  }
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const savedFiles = [];
    for (const item of files) {
      const safeName = path.basename(String(item?.name || ''));
      if (!safeName || !/^[A-Za-z0-9_.-]+$/.test(safeName)) continue;
      const outPath = path.resolve(targetDir, safeName);
      if (!outPath.startsWith(targetDir + path.sep)) continue;
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

