import { HostConfig, ClientTargetConfig, LegacyRollbackSnapshot, PolicyPatchMode, WindowsNetworkEra } from '@/types/share';

function escapePsSingle(val: string): string {
  return (val || '').replace(/'/g, "''");
}

function normalizeWindowsFolderPath(raw: string): string {
  const trimmed = (raw || 'C:\\AhBiShared').trim().replace(/\//g, '\\');
  if (/^[A-Za-z]:\\*$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}\\`;
  }
  return trimmed.replace(/\\+$/, '');
}

function formatIcaclsTarget(normalizedFolder: string): string {
  if (/^[A-Za-z]:\\$/.test(normalizedFolder)) {
    return `${normalizedFolder.slice(0, 2)}\\.`;
  }
  return normalizedFolder;
}

function normalizeDriveLetter(raw: string): string {
  const match = (raw || 'Z:').trim().toUpperCase().match(/^([A-Z]):?$/);
  return match ? `${match[1]}:` : 'Z:';
}

const PS_JSON_HELPER = `
function ConvertTo-AhBiJson {
  param([Parameter(ValueFromPipeline=$true)]$InputObject, [int]$Depth = 4)
  process {
    if (Get-Command ConvertTo-Json -ErrorAction SilentlyContinue) {
      return ($InputObject | ConvertTo-Json -Compress -Depth $Depth)
    }
    if ($InputObject -and ($InputObject -is [System.Collections.IDictionary] -or $InputObject -is [string] -or $InputObject -is [ValueType])) {
      try {
        Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
        $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        return $ser.Serialize($InputObject)
      } catch {}
    }
    function Serialize-Node($val, [int]$lvl) {
      if ($null -eq $val) { return 'null' }
      if ($val -is [bool]) { if ($val) { return 'true' } else { return 'false' } }
      if ($val -is [byte] -or $val -is [int] -or $val -is [long] -or $val -is [double] -or $val -is [decimal]) { return "$val" }
      if ($val -is [string]) {
        $esc = $val.Replace('\\', '\\\\').Replace('"', '\\"').Replace([string][char]13, '\\r').Replace([string][char]10, '\\n').Replace([string][char]9, '\\t')
        return '"' + $esc + '"'
      }
      if ($val -is [System.Collections.IDictionary]) {
        $pairs = @()
        foreach ($k in $val.Keys) { $pairs += ((Serialize-Node "$k" ($lvl + 1)) + ':' + (Serialize-Node $val[$k] ($lvl + 1))) }
        return '{' + ($pairs -join ',') + '}'
      }
      if ($val -is [System.Collections.IEnumerable] -and -not ($val -is [string])) {
        $items = @()
        foreach ($item in $val) { $items += (Serialize-Node $item ($lvl + 1)) }
        return '[' + ($items -join ',') + ']'
      }
      if ($val.PSObject -and $val.PSObject.Properties -and $lvl -lt 6) {
        $pairs = @()
        foreach ($p in $val.PSObject.Properties) { $pairs += ((Serialize-Node $p.Name ($lvl + 1)) + ':' + (Serialize-Node $p.Value ($lvl + 1))) }
        return '{' + ($pairs -join ',') + '}'
      }
      $s = "$val".Replace('\\', '\\\\').Replace('"', '\\"')
      return '"' + $s + '"'
    }
    return (Serialize-Node $InputObject 0)
  }
}
`.trim();

export function buildHostStepScripts(config: HostConfig, osEra?: WindowsNetworkEra): Array<{ id: string; title: string; detail: string; script: string }> {
  const normalizedFolder = normalizeWindowsFolderPath(config.folderPath);
  const folder = escapePsSingle(normalizedFolder);
  const icaclsFolder = escapePsSingle(formatIcaclsTarget(normalizedFolder));
  const shareName = escapePsSingle(config.shareName.trim() || 'AhBiShared');
  const shareAccess = config.permission === 'full' ? 'Full' : 'Read';
  const ntfsGrant = config.permission === 'full' ? '(OI)(CI)F' : '(OI)(CI)RX';
  const username = escapePsSingle(config.username.trim() || 'AhBiShare');
  const password = escapePsSingle(config.password || 'AhBi!2026Share');

  return [
    {
      id: 'h_profile',
      title: '네트워크 프로필 개인(Private) 전환',
      detail: '공용(Public) 차단 해제를 위해 활성 네트워크를 개인 네트워크로 전환합니다.',
      script: `
        if (Get-Command Get-NetConnectionProfile -ErrorAction SilentlyContinue) {
          Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.NetworkCategory -ne 'DomainAuthenticated' } | ForEach-Object {
            Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction SilentlyContinue
          }
        }
        Write-Output "Network profiles set to Private"
      `.trim(),
    },
    {
      id: 'h_firewall',
      title: '방화벽 파일 및 프린터 공유 포트(445/139) 개방',
      detail: 'Windows Defender 방화벽 SMB 인바운드 규칙을 활성화합니다.',
      script: `
        netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes 2>$null | Out-Null
        netsh advfirewall firewall set rule group="파일 및 프린터 공유" new enable=Yes 2>$null | Out-Null
        netsh advfirewall firewall set rule group="Network Discovery" new enable=Yes 2>$null | Out-Null
        netsh advfirewall firewall set rule group="네트워크 검색" new enable=Yes 2>$null | Out-Null
        if (Get-Command Get-NetFirewallRule -ErrorAction SilentlyContinue) {
          $fwRule = Get-NetFirewallRule -DisplayName "AhBiShare-SMB-445" -ErrorAction SilentlyContinue
          if (-not $fwRule) {
            New-NetFirewallRule -DisplayName "AhBiShare-SMB-445" -Direction Inbound -Protocol TCP -LocalPort 445 -Action Allow -Profile Any -ErrorAction Stop | Out-Null
          } else {
            Set-NetFirewallRule -DisplayName "AhBiShare-SMB-445" -Enabled True -ErrorAction SilentlyContinue | Out-Null
          }
        } else {
          netsh advfirewall firewall delete rule name="AhBiShare-SMB-445" 2>$null | Out-Null
          netsh advfirewall firewall add rule name="AhBiShare-SMB-445" dir=in action=allow protocol=TCP localport=445 profile=any | Out-Null
          if ($LASTEXITCODE -ne 0) { throw "방화벽 TCP 445 규칙 추가 실패 (관리자 권한 확인 필요)" }
        }
        Write-Output "Firewall rules opened (TCP 445/139)"
      `.trim(),
    },
    {
      id: 'h_services',
      title: 'SMB 서버 및 네트워크 탐색 서비스 가동',
      detail: 'LanmanServer, FDResPub, fdPHost, SSDPSrv를 자동 시작으로 활성화합니다.',
      script: `
        $svcs = @('LanmanServer', 'fdPHost', 'FDResPub', 'SSDPSrv')
        foreach ($s in $svcs) {
          Set-Service -Name $s -StartupType Automatic -ErrorAction SilentlyContinue
          Start-Service -Name $s -ErrorAction SilentlyContinue
        }
        $srv = Get-Service -Name 'LanmanServer' -ErrorAction Stop
        if ($srv.Status -ne 'Running') { throw "LanmanServer service failed to start" }
        Write-Output "Core hosting services running"
      `.trim(),
    },
    {
      id: 'h_auth',
      title: config.authMode === 'guest'
        ? (osEra === 'win11_24h2' || osEra === 'win11_25_26h2'
            ? 'Win11 24H2~26H2 호환 게스트 정책 및 SMB 서명 완화'
            : '간편 무비밀번호(Guest/익명) 정책 적용')
        : '전용 보안 공유 계정 구성 및 암호 보호 활성화',
      detail:
        config.authMode === 'guest'
          ? 'LSA 익명 허용, SMB 서명 완화, Guest 활성화 후 LanmanServer를 즉시 반영합니다 (재부팅 불필요).'
          : `전용 계정(${config.username || 'AhBiShare'}) 생성·갱신 및 익명/게스트 접근 차단을 적용합니다.`,
      script:
        config.authMode === 'guest'
          ? `
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v everyoneincludesanonymous /t REG_DWORD /d 1 /f | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Failed to update LSA everyoneincludesanonymous (Admin required)" }
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v restrictanonymous /t REG_DWORD /d 0 /f | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LimitBlankPasswordUse /t REG_DWORD /d 0 /f | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 0 /f | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EnableSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EncryptData /t REG_DWORD /d 0 /f 2>$null | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RejectUnencryptedAccess /t REG_DWORD /d 0 /f 2>$null | Out-Null
            try {
              if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
                Set-SmbServerConfiguration -RequireSecuritySignature $false -EnableSecuritySignature $false -EncryptData $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
              }
            } catch {}
            try { Set-SmbServerConfiguration -RejectUnencryptedAccess $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
            if (Get-Command Get-LocalUser -ErrorAction SilentlyContinue) {
              $guest = Get-LocalUser -ErrorAction SilentlyContinue | Where-Object { $_.SID.Value -like '*-501' } | Select-Object -First 1
              if ($guest) { Enable-LocalUser -Name $guest.Name -ErrorAction SilentlyContinue }
            } else {
              $guestWmi = Get-WmiObject Win32_UserAccount -Filter "LocalAccount=True" -ErrorAction SilentlyContinue | Where-Object { $_.SID -like '*-501' } | Select-Object -First 1
              $guestName = if ($guestWmi) { $guestWmi.Name } else { 'Guest' }
              & net.exe user $guestName /active:yes 2>$null | Out-Null
            }
            Restart-Service -Name LanmanServer -Force -ErrorAction SilentlyContinue | Out-Null
            Write-Output "Passwordless guest sharing policy enabled (LanmanServer refreshed, no reboot required)"
          `.trim()
          : `
            $p_user = '${username}'
            $p_pass = '${password}'
            if (Get-Command Get-LocalUser -ErrorAction SilentlyContinue) {
              $secPass = ConvertTo-SecureString -String $p_pass -AsPlainText -Force
              $existing = Get-LocalUser -Name $p_user -ErrorAction SilentlyContinue
              if ($existing) {
                Set-LocalUser -Name $p_user -Password $secPass -PasswordNeverExpires $true -UserMayNotChangePassword $true -ErrorAction Stop
                Enable-LocalUser -Name $p_user -ErrorAction SilentlyContinue
              } else {
                New-LocalUser -Name $p_user -Password $secPass -FullName 'AhBiShare User' -Description 'AhBiShare OneClick Managed Account' -PasswordNeverExpires -UserMayNotChangePassword -ErrorAction Stop | Out-Null
              }
            } else {
              & net.exe user $p_user 2>$null | Out-Null
              if ($LASTEXITCODE -eq 0) {
                & net.exe user $p_user $p_pass /active:yes /expires:never /passwordchg:no 2>&1 | Out-Null
              } else {
                & net.exe user $p_user $p_pass /add /active:yes /expires:never /passwordchg:no 2>&1 | Out-Null
              }
              if ($LASTEXITCODE -ne 0) { throw ("로컬 공유 계정 생성/갱신 실패: " + $p_user) }
            }
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v everyoneincludesanonymous /t REG_DWORD /d 0 /f | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Failed to harden LSA policy (Admin required)" }
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v restrictanonymous /t REG_DWORD /d 1 /f | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LimitBlankPasswordUse /t REG_DWORD /d 1 /f | Out-Null
            if (Get-Command Get-LocalUser -ErrorAction SilentlyContinue) {
              $guest = Get-LocalUser -ErrorAction SilentlyContinue | Where-Object { $_.SID.Value -like '*-501' } | Select-Object -First 1
              if ($guest) { Disable-LocalUser -Name $guest.Name -ErrorAction SilentlyContinue }
            } else {
              $guestWmi = Get-WmiObject Win32_UserAccount -Filter "LocalAccount=True" -ErrorAction SilentlyContinue | Where-Object { $_.SID -like '*-501' } | Select-Object -First 1
              $guestName = if ($guestWmi) { $guestWmi.Name } else { 'Guest' }
              & net.exe user $guestName /active:no 2>$null | Out-Null
            }
            Write-Output ("Dedicated secure account ready: " + $p_user)
          `.trim(),
    },
    {
      id: 'h_ntfs',
      title: '공유 폴더 생성 및 NTFS 파일 시스템 권한 주입',
      detail: `대상 폴더(${normalizedFolder}) 존재 확인 후 ACL을 설정합니다.`,
      script:
        config.authMode === 'guest'
          ? `
            $p_folder = '${folder}'
            $p_icacls = '${icaclsFolder}'
            if ($p_folder -match '^[A-Za-z]:\\\\$') { throw "Cannot apply recursive NTFS ACL to a raw drive root." }
            if (!(Test-Path -LiteralPath $p_folder)) { New-Item -Path $p_folder -ItemType Directory -Force -ErrorAction Stop | Out-Null }
            try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
            $script:__out = (& icacls.exe $p_icacls /grant "*S-1-1-0:${ntfsGrant}" /T /C /Q 2>&1) -join ' '
            $icaclsExit = $LASTEXITCODE
            try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
            if ($icaclsExit -ne 0) { throw ("icacls Everyone ACL 설정 실패 (" + $p_folder + "): " + $script:__out) }
            try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
            (& icacls.exe $p_icacls /grant "*S-1-5-7:${ntfsGrant}" /T /C /Q 2>&1) | Out-Null
            try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
            Write-Output ("NTFS Everyone/Anonymous ACL applied to " + $p_folder)
          `.trim()
          : `
            $p_folder = '${folder}'
            $p_icacls = '${icaclsFolder}'
            $p_user = '${username}'
            if ($p_folder -match '^[A-Za-z]:\\\\$') { throw "Cannot apply recursive NTFS ACL to a raw drive root." }
            if (!(Test-Path -LiteralPath $p_folder)) { New-Item -Path $p_folder -ItemType Directory -Force -ErrorAction Stop | Out-Null }
            try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
            $script:__out = (& icacls.exe $p_icacls /grant "$($p_user):${ntfsGrant}" /T /C /Q 2>&1) -join ' '
            $icaclsExit = $LASTEXITCODE
            try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
            if ($icaclsExit -ne 0) { throw ("icacls 계정 ACL 설정 실패 (" + $p_user + "): " + $script:__out) }
            Write-Output ("NTFS ACL applied for " + $p_user + " on " + $p_folder)
          `.trim(),
    },
    {
      id: 'h_share',
      title: 'SMB 네트워크 공유 등록 및 검증',
      detail: `공유 이름(${config.shareName.trim() || 'AhBiShared'}) 등록 및 접속 가능 상태를 검증합니다.`,
      script:
        config.authMode === 'guest'
          ? `
            $p_share = '${shareName}'
            $p_folder = '${folder}'
            if (Get-Command New-SmbShare -ErrorAction SilentlyContinue) {
              $old = Get-SmbShare -Name $p_share -ErrorAction SilentlyContinue
              if ($old) { Remove-SmbShare -Name $p_share -Force -ErrorAction SilentlyContinue }
              ${
                shareAccess === 'Read'
                  ? "New-SmbShare -Name $p_share -Path $p_folder -ReadAccess 'Everyone' -ErrorAction Stop | Out-Null"
                  : "New-SmbShare -Name $p_share -Path $p_folder -FullAccess 'Everyone' -ErrorAction Stop | Out-Null"
              }
            } else {
              & net.exe share $p_share /delete /y 2>$null | Out-Null
              $grantLevel = '${shareAccess === 'Read' ? 'READ' : 'FULL'}'
              try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
              $script:__netShareOut = (& net.exe share "$p_share=$p_folder" "/GRANT:Everyone,$grantLevel" 2>&1) -join ' '
              $netShareCode = $LASTEXITCODE
              try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
              if ($netShareCode -ne 0) { throw ("net share 등록 실패 (" + $p_share + "): " + $script:__netShareOut) }
            }
            Write-Output ("SMB share registered: " + $p_share)
          `.trim()
          : `
            $p_share = '${shareName}'
            $p_folder = '${folder}'
            $p_user = '${username}'
            if (Get-Command New-SmbShare -ErrorAction SilentlyContinue) {
              $old = Get-SmbShare -Name $p_share -ErrorAction SilentlyContinue
              if ($old) { Remove-SmbShare -Name $p_share -Force -ErrorAction SilentlyContinue }
              ${
                shareAccess === 'Read'
                  ? "New-SmbShare -Name $p_share -Path $p_folder -FullAccess 'Administrators' -ReadAccess $p_user -ErrorAction Stop | Out-Null"
                  : "New-SmbShare -Name $p_share -Path $p_folder -FullAccess $p_user,'Administrators' -ErrorAction Stop | Out-Null"
              }
            } else {
              & net.exe share $p_share /delete /y 2>$null | Out-Null
              $grantLevel = '${shareAccess === 'Read' ? 'READ' : 'FULL'}'
              try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
              $script:__netShareOut = (& net.exe share "$p_share=$p_folder" "/GRANT:$p_user,$grantLevel" "/GRANT:Administrators,FULL" 2>&1) -join ' '
              $netShareCode = $LASTEXITCODE
              try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
              if ($netShareCode -ne 0) { throw ("net share 보안 등록 실패 (" + $p_share + "): " + $script:__netShareOut) }
            }
            Write-Output ("Secure SMB share registered: " + $p_share)
          `.trim(),
    },
  ];
}

export function buildClientStepScripts(config: ClientTargetConfig, osEra?: WindowsNetworkEra): Array<{ id: string; title: string; detail: string; script: string }> {
  const hostRaw = config.targetHost.trim();
  const shareRaw = config.shareName.trim();
  const drive = normalizeDriveLetter(config.driveLetter);
  const host = escapePsSingle(hostRaw);
  const usernameRaw = config.username.trim();
  const credUsernameRaw = usernameRaw.includes('\\') || usernameRaw.includes('@') || !usernameRaw
    ? usernameRaw
    : `${hostRaw}\\${usernameRaw}`;
  const username = escapePsSingle(usernameRaw);
  const credUsername = escapePsSingle(credUsernameRaw);
  const password = escapePsSingle(config.password || '');
  const unc = escapePsSingle(`\\\\${hostRaw}\\${shareRaw}`);
  const ipcUnc = escapePsSingle(`\\\\${hostRaw}\\IPC$`);

  return [
    {
      id: 'c_services',
      title: '클라이언트 워크스테이션 및 탐색 서비스 활성화',
      detail: 'LanmanWorkstation, fdPHost, FDResPub, NetBIOS 및 UAC 연결 공유(EnableLinkedConnections)를 활성화합니다.',
      script: `
        $svcs = @('LanmanWorkstation', 'fdPHost', 'FDResPub', 'Dnscache')
        foreach ($s in $svcs) {
          Set-Service -Name $s -StartupType Automatic -ErrorAction SilentlyContinue | Out-Null
          Start-Service -Name $s -ErrorAction SilentlyContinue | Out-Null
        }
        $ws = Get-Service -Name 'LanmanWorkstation' -ErrorAction SilentlyContinue
        if (-not $ws -or $ws.Status -ne 'Running') { throw "LanmanWorkstation(SMB 클라이언트) 서비스가 실행되지 않았습니다." }
        $nbtPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces"
        Get-ChildItem $nbtPath -ErrorAction SilentlyContinue | ForEach-Object {
          Set-ItemProperty -Path $_.PSPath -Name "NetbiosOptions" -Value 1 -Force -ErrorAction SilentlyContinue | Out-Null
        }
        reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLinkedConnections /t REG_DWORD /d 1 /f 2>$null | Out-Null
        Write-Output "Client workstation, NetBIOS & linked connections active"
      `.trim(),
    },
    {
      id: 'c_policy',
      title: config.authMode === 'guest'
        ? (osEra === 'win11_25_26h2'
            ? 'Win11 25H2/26H2 0x80070035 및 SMB 서명 차단 완화'
            : 'Win11 24H2 0x80070035 및 비인증 게스트 차단 해제')
        : 'SMB 클라이언트 보안·서명·NTLMv2 정책 정렬',
      detail:
        config.authMode === 'guest'
          ? 'GPO·레지스트리 게스트 허용, SMB 서명 완화 적용 후 워크스테이션 서비스를 즉시 재시작합니다.'
          : 'Win 11 24H2~26H2 SMB 클라이언트 서명 협상·NTLMv2 정책을 정렬합니다.',
      script:
        config.authMode === 'guest'
          ? `
            try {
              if (Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue) {
                Set-SmbClientConfiguration -EnableInsecureGuestLogons $true -RequireSecuritySignature $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
              }
            } catch {}
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "AllowInsecureGuestAuth 레지스트리 설정 실패 (관리자 권한 필요)" }
            reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f 2>$null | Out-Null
            Restart-Service -Name LanmanWorkstation -Force -ErrorAction SilentlyContinue | Out-Null
            Write-Output "Win11 24H2~26H2 guest auth & SMB signature bypass applied (service refreshed, no reboot required)"
          `.trim()
          : `
            try {
              if (Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue) {
                Set-SmbClientConfiguration -RequireSecuritySignature $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
              }
            } catch {}
            reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
            $lsa = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa' -ErrorAction SilentlyContinue
            if (-not $lsa -or $null -eq $lsa.LmCompatibilityLevel -or [int]$lsa.LmCompatibilityLevel -lt 3) {
              reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LmCompatibilityLevel /t REG_DWORD /d 3 /f 2>$null | Out-Null
            }
            Write-Output "Client authenticated SMB policy aligned"
          `.trim(),
    },
    {
      id: 'c_probe',
      title: `대상 서버(${hostRaw}) SMB 포트(445) 도달성 검증`,
      detail: '방화벽 차단이나 IP 오입력 여부를 사전에 빠르게 검증합니다.',
      script: `
        $p_host = '${host}'
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar = $null
        try {
          $ar = $tcp.BeginConnect($p_host, 445, $null, $null)
          $ok = $ar.AsyncWaitHandle.WaitOne(2500, $false)
          if (-not $ok) { throw ("TCP 445 연결 시간 초과 (" + $p_host + "): 대상 PC 방화벽 또는 전원을 확인하세요.") }
          $tcp.EndConnect($ar)
          Write-Output ("Port 445 reachable on " + $p_host)
        } finally {
          if ($ar -and $ar.AsyncWaitHandle) { $ar.AsyncWaitHandle.Close() }
          $tcp.Close()
        }
      `.trim(),
    },
    {
      id: 'c_cred',
      title: config.authMode === 'account' ? '자격 증명 저장소(cmdkey) 자동 등록' : '기존 충돌 SMB 세션 일괄 정리',
      detail:
        config.authMode === 'account'
          ? `팝업 없는 연결을 위해 ${hostRaw} 자격 증명을 Windows Credential Manager에 저장합니다.`
          : '대상 서버에 남은 캐시 세션으로 인한 1219 다중 연결 오류를 방지합니다.',
      script:
        config.authMode === 'account'
          ? `
            $p_host = '${host}'
            $p_unc = '${unc}'
            $p_ipc = '${ipcUnc}'
            $p_user = '${credUsername}'
            $p_dispUser = '${username}'
            $p_pass = '${password}'
            if (Get-Command Get-SmbMapping -ErrorAction SilentlyContinue) {
              Get-SmbMapping -ErrorAction SilentlyContinue | Where-Object { $_.RemotePath -like ("\\\\" + $p_host + "\\*") } | ForEach-Object {
                Remove-SmbMapping -LocalPath $_.LocalPath -RemotePath $_.RemotePath -Force -ErrorAction SilentlyContinue | Out-Null
              }
            }
            & net.exe use $p_unc /delete /y 2>$null | Out-Null
            & net.exe use $p_ipc /delete /y 2>$null | Out-Null
            & cmdkey.exe "/delete:$p_host" 2>$null | Out-Null
            & cmdkey.exe "/delete:TERMSRV/$p_host" 2>$null | Out-Null
            try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
            $script:__cmdOut = (& cmdkey.exe "/add:$p_host" "/user:$p_user" "/pass:$p_pass" 2>&1) -join ' '
            $cmdExit = $LASTEXITCODE
            try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
            if ($cmdExit -ne 0) { throw ("cmdkey 자격 증명 등록 실패 (" + $p_host + "): " + $script:__cmdOut) }
            Write-Output ("Saved Windows credentials for " + $p_host + " (" + $p_dispUser + ")")
          `.trim()
          : `
            $p_host = '${host}'
            $p_unc = '${unc}'
            $p_ipc = '${ipcUnc}'
            if (Get-Command Get-SmbMapping -ErrorAction SilentlyContinue) {
              Get-SmbMapping -ErrorAction SilentlyContinue | Where-Object { $_.RemotePath -like ("\\\\" + $p_host + "\\*") } | ForEach-Object {
                Remove-SmbMapping -LocalPath $_.LocalPath -RemotePath $_.RemotePath -Force -ErrorAction SilentlyContinue | Out-Null
              }
            }
            & net.exe use $p_unc /delete /y 2>$null | Out-Null
            & net.exe use $p_ipc /delete /y 2>$null | Out-Null
            Write-Output ("Cleared stale SMB sessions for " + $p_host)
          `.trim(),
    },
    {
      id: 'c_mount',
      title: `네트워크 드라이브(${drive}) 마운트 및 탐색기 연결`,
      detail: `${`\\\\${hostRaw}\\${shareRaw}`} 경로를 ${drive} 드라이브로 매핑합니다.`,
      script: `
        $p_drive = '${drive}'
        $p_host = '${host}'
        $p_unc = '${unc}'
        $p_mode = '${config.authMode}'
        $p_user = '${credUsername}'
        $p_bareUser = '${username}'
        $p_pass = '${password}'
        $p_persist = ${config.persistent ? "'/persistent:yes'" : "'/persistent:no'"}
        $p_persistBool = ${config.persistent ? '$true' : '$false'}

        $vol = if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) {
          Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$p_drive'" -ErrorAction SilentlyContinue
        } else {
          Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='$p_drive'" -ErrorAction SilentlyContinue
        }
        if ($vol -and $vol.DriveType -ne 4) {
          throw ("드라이브 문자 " + $p_drive + "는 로컬 디스크에서 이미 사용 중입니다. 다른 드라이브 문자(Y:, X: 등)를 선택하세요.")
        }

        function Clear-HostAndDriveConflicts {
          if (Get-Command Remove-SmbMapping -ErrorAction SilentlyContinue) {
            Remove-SmbMapping -LocalPath $p_drive -Force -UpdateProfile -ErrorAction SilentlyContinue | Out-Null
          }
          & net.exe use $p_drive /delete /y 2>$null | Out-Null
          if (Get-Command Get-SmbMapping -ErrorAction SilentlyContinue) {
            Get-SmbMapping -ErrorAction SilentlyContinue | Where-Object { $_.RemotePath -like ("\\\\" + $p_host + "\\*") } | ForEach-Object {
              Remove-SmbMapping -LocalPath $_.LocalPath -RemotePath $_.RemotePath -Force -ErrorAction SilentlyContinue | Out-Null
            }
          }
          try {
            $lines = & net.exe use 2>$null
            foreach ($line in $lines) {
              if ($line -match ('\\\\\\\\' + [regex]::Escape($p_host) + '\\\\[^\\s]+')) {
                & net.exe use $matches[0] /delete /y 2>$null | Out-Null
              }
            }
          } catch {}
        }

        function Invoke-NetUseSafe([string[]]$netArgs) {
          try { [Console]::OutputEncoding = [System.Text.Encoding]::Default } catch {}
          $out = (& net.exe @netArgs 2>&1) -join ' '
          $code = $LASTEXITCODE
          try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
          return New-Object PSObject -Property @{ Code = $code; Output = $out }
        }

        Clear-HostAndDriveConflicts
        $mounted = $false
        $lastCode = 0
        $lastOut = ''

        if ($p_mode -eq 'account') {
          if ($p_pass -and $p_pass -ne '*' -and -not $p_pass.StartsWith('/') -and $p_user) {
            $r1 = Invoke-NetUseSafe @('use', $p_drive, $p_unc, $p_pass, "/user:$p_user", $p_persist)
          } else {
            $r1 = Invoke-NetUseSafe @('use', $p_drive, $p_unc, $p_persist)
          }
          $lastCode = $r1.Code; $lastOut = $r1.Output
          if ($lastCode -eq 0) { $mounted = $true }

          if (-not $mounted -and $p_bareUser -and $p_bareUser -ne $p_user -and $p_pass) {
            Clear-HostAndDriveConflicts
            $r2 = Invoke-NetUseSafe @('use', $p_drive, $p_unc, $p_pass, "/user:$p_bareUser", $p_persist)
            if ($r2.Code -eq 0) { $mounted = $true; $lastCode = 0; $lastOut = $r2.Output }
            else { $lastCode = $r2.Code; $lastOut = $r2.Output }
          }

          if (-not $mounted -and (Get-Command New-SmbMapping -ErrorAction SilentlyContinue)) {
            try {
              Clear-HostAndDriveConflicts
              if ($p_user -and $p_pass) {
                New-SmbMapping -LocalPath $p_drive -RemotePath $p_unc -UserName $p_user -Password $p_pass -Persistent:$p_persistBool -ErrorAction Stop | Out-Null
              } else {
                New-SmbMapping -LocalPath $p_drive -RemotePath $p_unc -Persistent:$p_persistBool -ErrorAction Stop | Out-Null
              }
              $mounted = $true
            } catch {
              $lastOut = ($lastOut + ' | New-SmbMapping: ' + $_.Exception.Message).Trim(' |')
            }
          }
        } else {
          $r1 = Invoke-NetUseSafe @('use', $p_drive, $p_unc, $p_persist)
          $lastCode = $r1.Code; $lastOut = $r1.Output
          if ($lastCode -eq 0) { $mounted = $true }

          if (-not $mounted) {
            Clear-HostAndDriveConflicts
            $r2 = Invoke-NetUseSafe @('use', $p_drive, $p_unc, '""', '/user:Guest', $p_persist)
            if ($r2.Code -eq 0) { $mounted = $true; $lastCode = 0; $lastOut = $r2.Output }
            else { $lastCode = $r2.Code; $lastOut = ($lastOut + ' | Guest: ' + $r2.Output).Trim(' |') }
          }

          if (-not $mounted -and (Get-Command New-SmbMapping -ErrorAction SilentlyContinue)) {
            try {
              Clear-HostAndDriveConflicts
              New-SmbMapping -LocalPath $p_drive -RemotePath $p_unc -Persistent:$p_persistBool -ErrorAction Stop | Out-Null
              $mounted = $true
            } catch {
              $lastOut = ($lastOut + ' | New-SmbMapping: ' + $_.Exception.Message).Trim(' |')
            }
          }
        }

        if (-not $mounted) {
          $hint = ''
          if ($lastOut -match '\\b85\\b|이미 사용|already in use|already assigned') {
            $hint = ' [원인: 선택한 드라이브 문자(' + $p_drive + ')가 다른 세션에서 사용 중입니다. Y:/X: 등 다른 드라이브 문자를 선택하세요.]'
          } elseif ($lastOut -match '\\b1219\\b|다중 연결|Multiple connections') {
            $hint = ' [원인: 대상 PC(' + $p_host + ')에 다른 계정의 기존 연결 세션이 남아 있습니다. 실행 창/탐색기 열려 있는 UNC 연결을 닫고 재시도하세요.]'
          } elseif ($lastOut -match '\\b1272\\b|\\b384\\b|0x80070035|게스트|guest') {
            $hint = ' [원인: Win 11 24H2~26H2 게스트 차단/서명 정책 충돌. 호스트·클라이언트 양쪽 OS 호환성 매트릭스에서 안전 호환 패치를 적용하세요.]'
          } elseif ($lastOut -match '\\b1326\\b|\\b86\\b|\\b5\\b|액세스|거부|로그온|암호') {
            $hint = ' [원인: 호스트 계정 ID/암호 불일치 또는 익명 접근 제한. 보안 계정 모드 또는 호스트 공유 재개설을 확인하세요.]'
          } elseif ($lastOut -match '\\b53\\b|\\b67\\b|네트워크 경로') {
            $hint = ' [원인: 네트워크 경로(' + $p_unc + ') 또는 공유 이름을 찾을 수 없습니다. 호스트 방화벽/공유 이름을 확인하세요.]'
          }
          throw ("네트워크 드라이브 생성 실패 (코드 " + $lastCode + "): " + $lastOut + $hint)
        }

        try {
          if (Test-Path -LiteralPath ($p_drive + '\\')) {
            Start-Process explorer.exe ($p_drive + '\\') -ErrorAction SilentlyContinue
          } else {
            Start-Process explorer.exe $p_unc -ErrorAction SilentlyContinue
          }
        } catch {}
        Write-Output ("Mounted " + $p_unc + " to " + $p_drive)
      `.trim(),
    },
  ];
}

export function buildRollbackScript(scope: 'host' | 'client'): string {
  if (scope === 'host') {
    return `
      if (Get-Command Get-SmbShare -ErrorAction SilentlyContinue) {
        Get-SmbShare -ErrorAction SilentlyContinue | Where-Object {
          $_.Special -eq $false -and $_.Name -notmatch '^.*\\$$' -and (@('IPC$','ADMIN$','C$','D$') -notcontains $_.Name)
        } | Remove-SmbShare -Force -ErrorAction SilentlyContinue
      } else {
        Get-WmiObject Win32_Share -Filter "Type=0" -ErrorAction SilentlyContinue | Where-Object {
          $_.Name -notmatch '^.*\\$$' -and (@('IPC$','ADMIN$','C$','D$') -notcontains $_.Name)
        } | ForEach-Object {
          & net.exe share $_.Name /delete /y 2>$null | Out-Null
        }
      }
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v everyoneincludesanonymous /t REG_DWORD /d 0 /f | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v restrictanonymous /t REG_DWORD /d 1 /f | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LimitBlankPasswordUse /t REG_DWORD /d 1 /f | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 1 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EncryptData /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RejectUnencryptedAccess /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v LocalAccountTokenFilterPolicy /t REG_DWORD /d 0 /f 2>$null | Out-Null
      if (Get-Command Get-LocalUser -ErrorAction SilentlyContinue) {
        $guest = Get-LocalUser -ErrorAction SilentlyContinue | Where-Object { $_.SID.Value -like '*-501' } | Select-Object -First 1
        if ($guest) { Disable-LocalUser -Name $guest.Name -ErrorAction SilentlyContinue }
      } else {
        $guestWmi = Get-WmiObject Win32_UserAccount -Filter "LocalAccount=True" -ErrorAction SilentlyContinue | Where-Object { $_.SID -like '*-501' } | Select-Object -First 1
        $guestName = if ($guestWmi) { $guestWmi.Name } else { 'Guest' }
        & net.exe user $guestName /active:no 2>$null | Out-Null
      }
      try {
        if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbServerConfiguration -RequireSecuritySignature $true -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      netsh advfirewall firewall delete rule name="AhBiShare-SMB-445" 2>$null | Out-Null
      Restart-Service -Name LanmanServer -Force -ErrorAction SilentlyContinue | Out-Null
      Write-Output "Host shares removed and security defaults restored"
    `.trim();
  }
  return `
    net use * /delete /y 2>$null | Out-Null
    try {
      if (Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue) {
        Set-SmbClientConfiguration -EnableInsecureGuestLogons $false -RequireSecuritySignature $true -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
      }
    } catch {}
    reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f 2>$null | Out-Null
    reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f | Out-Null
    reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f 2>$null | Out-Null
    Restart-Service -Name LanmanWorkstation -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Output "Client drives disconnected and guest auth disabled"
  `.trim();
}

export function buildNetworkDiagnosticScript(): string {
  return `
    ${PS_JSON_HELPER}
    ipconfig /flushdns | Out-Null
    arp -d * 2>$null | Out-Null
    $ws = (Get-Service LanmanWorkstation -ErrorAction SilentlyContinue).Status
    $srv = (Get-Service LanmanServer -ErrorAction SilentlyContinue).Status
    $fd = (Get-Service FDResPub -ErrorAction SilentlyContinue).Status
    @{
      LanmanWorkstation = "$ws"
      LanmanServer = "$srv"
      FDResPub = "$fd"
      DnsFlushed = $true
    } | ConvertTo-AhBiJson
  `.trim();
}

export function buildLiveStateScript(): string {
  return `
    ${PS_JSON_HELPER}
    $shares = @()
    if (Get-Command Get-SmbShare -ErrorAction SilentlyContinue) {
      $shares = @(Get-SmbShare -ErrorAction SilentlyContinue | Where-Object {
        $_.Special -eq $false -and $_.Name -notmatch '^.*\\$$' -and (@('IPC$','ADMIN$','C$','D$') -notcontains $_.Name)
      } | ForEach-Object {
        @{ shareName = $_.Name; folderPath = $_.Path }
      })
    } else {
      $shares = @(Get-WmiObject Win32_Share -Filter "Type=0" -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -notmatch '^.*\\$$' -and (@('IPC$','ADMIN$','C$','D$') -notcontains $_.Name)
      } | ForEach-Object {
        @{ shareName = $_.Name; folderPath = $_.Path }
      })
    }
    $mappings = @()
    if (Get-Command Get-SmbMapping -ErrorAction SilentlyContinue) {
      $mappings = @(Get-SmbMapping -ErrorAction SilentlyContinue | Where-Object { $_.LocalPath } | ForEach-Object {
        @{ driveLetter = $_.LocalPath; uncPath = $_.RemotePath; status = "$($_.Status)" }
      })
    } else {
      $mappings = @(Get-WmiObject Win32_MappedLogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.Name -and $_.ProviderName } | ForEach-Object {
        @{ driveLetter = $_.Name; uncPath = $_.ProviderName; status = 'OK' }
      })
    }
    @{ shares = $shares; mappings = $mappings } | ConvertTo-AhBiJson -Depth 4
  `.trim();
}

export function buildOsNetworkPolicyInspectScript(): string {
  return `
    ${PS_JSON_HELPER}
    $cv = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -ErrorAction SilentlyContinue
    $buildNum = 0
    if ($cv -and $cv.CurrentBuildNumber) { [void][int]::TryParse("$($cv.CurrentBuildNumber)", [ref]$buildNum) }
    $ubrVal = $null
    if ($cv -and $null -ne $cv.UBR) {
      [int]$tmpUbr = 0
      if ([int]::TryParse("$($cv.UBR)", [ref]$tmpUbr)) { $ubrVal = $tmpUbr }
    }
    $editionId = if ($cv -and $cv.EditionID) { "$($cv.EditionID)" } else { "Professional" }
    $dispVer = if ($cv -and $cv.DisplayVersion) { "$($cv.DisplayVersion)" } elseif ($cv -and $cv.ReleaseId) { "$($cv.ReleaseId)" } else { "" }
    $prodName = if ($cv -and $cv.ProductName) { "$($cv.ProductName)" } else { "Windows" }
    if ($buildNum -ge 22000 -and $prodName -match 'Windows 10') { $prodName = $prodName -replace 'Windows 10', 'Windows 11' }

    $hotfixes = @()
    try {
      $qfe = if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) {
        Get-CimInstance Win32_QuickFixEngineering -ErrorAction SilentlyContinue
      } else {
        Get-WmiObject Win32_QuickFixEngineering -ErrorAction SilentlyContinue
      }
      $hotfixes = @($qfe | Where-Object { $_.HotFixID } | Sort-Object { try { [datetime]$_.InstalledOn } catch { [datetime]::MinValue } } -Descending | Select-Object -First 6 -ExpandProperty HotFixID)
    } catch {}

    $sysPol = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -ErrorAction SilentlyContinue
    $localTokenFilter = [bool]($sysPol -and $null -ne $sysPol.LocalAccountTokenFilterPolicy -and [int]$sysPol.LocalAccountTokenFilterPolicy -eq 1)

    $smb1State = 'Unknown'
    try {
      if (Get-Command Get-WindowsOptionalFeature -ErrorAction SilentlyContinue) {
        $f = Get-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol-Client' -ErrorAction SilentlyContinue
        if ($f -and $f.State) {
          if ("$($f.State)" -match 'Enable') { $smb1State = 'Enabled' }
          elseif ("$($f.State)" -match 'Disable') { $smb1State = 'Disabled' }
        }
      }
    } catch {}

    $msaPinRisk = $false
    try {
      $upn = ''
      try { $upn = (& whoami.exe /upn 2>$null) -join '' } catch {}
      $isMicrosoftUser = ($env:USERNAME -match '@') -or ($upn -match '@')
      $ngcNgcCount = @(Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\Credential Providers\\{D6886603-9D2F-4EB2-B667-1971041FA96B}' -ErrorAction SilentlyContinue).Count
      $ngcPinKey = Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\PolicyManager\\default\\PassportForWork' -ErrorAction SilentlyContinue
      if (Get-Command Get-LocalUser -ErrorAction SilentlyContinue) {
        $ahbiAccount = Get-LocalUser -Name 'AhBiShare' -ErrorAction SilentlyContinue
        $hasDedicatedLocalShareAcc = [bool]($ahbiAccount -and $ahbiAccount.Enabled)
        $curLocal = Get-LocalUser -Name $env:USERNAME -ErrorAction SilentlyContinue
        $noLocalPass = [bool]($curLocal -and $curLocal.Enabled -and ($null -eq $curLocal.PasswordLastSet))
      } else {
        $ahbiWmi = Get-WmiObject Win32_UserAccount -Filter "LocalAccount=True AND Name='AhBiShare'" -ErrorAction SilentlyContinue | Select-Object -First 1
        $hasDedicatedLocalShareAcc = [bool]($ahbiWmi -and -not $ahbiWmi.Disabled)
        $noLocalPass = $false
      }
      if (($isMicrosoftUser -or $noLocalPass) -and -not $hasDedicatedLocalShareAcc -and ($ngcNgcCount -gt 0 -or $ngcPinKey -or $isMicrosoftUser)) {
        $msaPinRisk = $true
      }
    } catch {}

    $netProfile = 'Unknown'
    if (Get-Command Get-NetConnectionProfile -ErrorAction SilentlyContinue) {
      $profiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
      if ($profiles.Count -gt 0) {
        $cats = @($profiles | ForEach-Object { "$($_.NetworkCategory)" })
        if ($cats -contains 'Public') { $netProfile = 'Public' }
        elseif ($cats -contains 'Private') { $netProfile = 'Private' }
        else { $netProfile = "$($cats[0])" }
      }
    } else {
      try {
        $nlProfiles = Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\NetworkList\\Profiles' -ErrorAction SilentlyContinue
        foreach ($np in $nlProfiles) {
          $pObj = Get-ItemProperty $np.PSPath -ErrorAction SilentlyContinue
          if ($pObj -and $null -ne $pObj.Category) {
            if ([int]$pObj.Category -eq 0) { $netProfile = 'Public'; break }
            elseif ([int]$pObj.Category -eq 1) { $netProfile = 'Private' }
            elseif ([int]$pObj.Category -eq 2 -and $netProfile -eq 'Unknown') { $netProfile = 'DomainAuthenticated' }
          }
        }
      } catch {}
    }

    $srvCfg = if (Get-Command Get-SmbServerConfiguration -ErrorAction SilentlyContinue) { Get-SmbServerConfiguration -ErrorAction SilentlyContinue } else { $null }
    $cliCfg = if (Get-Command Get-SmbClientConfiguration -ErrorAction SilentlyContinue) { Get-SmbClientConfiguration -ErrorAction SilentlyContinue } else { $null }

    $lsParams = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters' -ErrorAction SilentlyContinue
    $lwParams = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters' -ErrorAction SilentlyContinue
    $lwPolicy = Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation' -ErrorAction SilentlyContinue
    $guestAuth = $false
    if ($lwPolicy -and $null -ne $lwPolicy.AllowInsecureGuestAuth) {
      $guestAuth = ([int]$lwPolicy.AllowInsecureGuestAuth -eq 1)
    } elseif (($lwParams -and $lwParams.AllowInsecureGuestAuth -eq 1) -or ($cliCfg -and $cliCfg.EnableInsecureGuestLogons)) {
      $guestAuth = $true
    } elseif ($buildNum -gt 0 -and $buildNum -lt 16299) {
      $guestAuth = $true
    }

    $lsa = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa' -ErrorAction SilentlyContinue
    $lmLevel = if ($lsa -and $null -ne $lsa.LmCompatibilityLevel) { [int]$lsa.LmCompatibilityLevel } else { $null }
    $msv = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\MSV1_0' -ErrorAction SilentlyContinue
    $ntlmOut = if ($msv -and $null -ne $msv.RestrictSendingNTLMTraffic) { [int]$msv.RestrictSendingNTLMTraffic } else { $null }

    $netbiosEnabled = $false
    $nbtIfaces = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces' -ErrorAction SilentlyContinue
    if ($nbtIfaces) {
      foreach ($iface in $nbtIfaces) {
        $prop = Get-ItemProperty $iface.PSPath -ErrorAction SilentlyContinue
        if ($prop -and ($prop.NetbiosOptions -eq 0 -or $prop.NetbiosOptions -eq 1)) { $netbiosEnabled = $true; break }
      }
    }

    $wsRunning = ((Get-Service LanmanWorkstation -ErrorAction SilentlyContinue).Status -eq 'Running')
    $srvRunning = ((Get-Service LanmanServer -ErrorAction SilentlyContinue).Status -eq 'Running')
    $fdRunning = ((Get-Service FDResPub -ErrorAction SilentlyContinue).Status -eq 'Running')

    $printReg = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Print' -ErrorAction SilentlyContinue
    $rpcPrivDisabled = [bool]($printReg -and $null -ne $printReg.RpcAuthnLevelPrivacyEnabled -and [int]$printReg.RpcAuthnLevelPrivacyEnabled -eq 0)
    $rpcPol = Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC' -ErrorAction SilentlyContinue
    $rpcNamedPipe = [bool]($rpcPol -and $null -ne $rpcPol.RpcUseNamedPipeProtocol -and [int]$rpcPol.RpcUseNamedPipeProtocol -eq 1)
    $rpcProt = if ($rpcPol -and $null -ne $rpcPol.RpcProtocols) { [int]$rpcPol.RpcProtocols } else { $null }
    $pap = Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint' -ErrorAction SilentlyContinue
    $papRelaxed = [bool]($pap -and $null -ne $pap.NoWarningNoElevationOnInstall -and [int]$pap.NoWarningNoElevationOnInstall -eq 1)
    $spoolerRunning = ((Get-Service Spooler -ErrorAction SilentlyContinue).Status -eq 'Running')

    $pendingReboot = $false
    if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') { $pendingReboot = $true }
    if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') { $pendingReboot = $true }

    $regSmb1 = if ($lsParams -and $null -ne $lsParams.SMB1) { [int]$lsParams.SMB1 -ne 0 } else { ($buildNum -gt 0 -and $buildNum -lt 10240) }
    $regSmb2 = if ($lsParams -and $null -ne $lsParams.SMB2) { [int]$lsParams.SMB2 -ne 0 } else { $true }
    $regSrvSig = if ($lsParams -and $null -ne $lsParams.RequireSecuritySignature) { [int]$lsParams.RequireSecuritySignature -ne 0 } else { $false }
    $regCliSig = if ($lwParams -and $null -ne $lwParams.RequireSecuritySignature) { [int]$lwParams.RequireSecuritySignature -ne 0 } else { $false }
    $regEncrypt = if ($lsParams -and $null -ne $lsParams.EncryptData) { [int]$lsParams.EncryptData -ne 0 } else { $false }
    $regRejectUnenc = if ($lsParams -and $null -ne $lsParams.RejectUnencryptedAccess) { [int]$lsParams.RejectUnencryptedAccess -ne 0 } else { $false }

    $smb1Final = if ($srvCfg) { [bool]$srvCfg.EnableSMB1Protocol } else { $regSmb1 }
    if ($smb1State -eq 'Unknown') { $smb1State = if ($smb1Final) { 'Enabled' } else { 'Disabled' } }

    @{
      osProductName = $prodName
      osDisplayVersion = $dispVer
      osBuild = $buildNum
      osEditionId = $editionId
      osUbr = $ubrVal
      recentHotfixIds = $hotfixes
      localAccountTokenFilterEnabled = $localTokenFilter
      smb1ClientFeatureState = $smb1State
      msaPinOnlyRisk = $msaPinRisk
      networkProfile = $netProfile
      smb1Enabled = $smb1Final
      smbServerSigningRequired = if ($srvCfg) { [bool]$srvCfg.RequireSecuritySignature } else { $regSrvSig }
      smbClientSigningRequired = if ($cliCfg) { [bool]$cliCfg.RequireSecuritySignature } else { $regCliSig }
      allowInsecureGuestAuth = $guestAuth
      enableInsecureGuestLogons = if ($cliCfg) { [bool]$cliCfg.EnableInsecureGuestLogons } else { $guestAuth }
      lmCompatibilityLevel = $lmLevel
      ntlmRestrictOutbound = $ntlmOut
      netbiosEnabled = $netbiosEnabled
      smbEncryptData = if ($srvCfg) { [bool]$srvCfg.EncryptData } else { $regEncrypt }
      smbRejectUnencryptedAccess = if ($srvCfg -and $null -ne $srvCfg.RejectUnencryptedAccess) { [bool]$srvCfg.RejectUnencryptedAccess } else { $regRejectUnenc }
      smb2Enabled = if ($srvCfg -and $null -ne $srvCfg.EnableSMB2Protocol) { [bool]$srvCfg.EnableSMB2Protocol } else { $regSmb2 }
      smb1ServerEnabled = $smb1Final
      lanmanServerRunning = $srvRunning
      lanmanWorkstationRunning = $wsRunning
      fdResPubRunning = $fdRunning
      rpcAuthnLevelPrivacyDisabled = $rpcPrivDisabled
      rpcUseNamedPipeProtocol = $rpcNamedPipe
      rpcProtocols = $rpcProt
      pointAndPrintRelaxed = $papRelaxed
      printSpoolerRunning = $spoolerRunning
      pendingRebootFlag = $pendingReboot
    } | ConvertTo-AhBiJson
  `.trim();
}

export function buildOsCompatibilityPatchScript(
  mode: PolicyPatchMode,
  rollbackSnapshot?: LegacyRollbackSnapshot | null
): string {
  if (mode === 'rpc_printer_compat') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $restarted = @()
      $spoolerFailed = $false
      $priorPendingReboot = $false
      if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') { $priorPendingReboot = $true }
      if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') { $priorPendingReboot = $true }

      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print" /v RpcAuthnLevelPrivacyEnabled /t REG_DWORD /d 0 /f | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Failed to set RpcAuthnLevelPrivacyEnabled (Admin required)" }
      $actions += '프린터 RPC 개인정보 인증 완화 (RpcAuthnLevelPrivacyEnabled=0 · 0x0000011b 해결)'

      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC" /v RpcUseNamedPipeProtocol /t REG_DWORD /d 1 /f | Out-Null
      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC" /v RpcProtocols /t REG_DWORD /d 7 /f | Out-Null
      $actions += 'RPC over Named Pipes 활성화 (RpcUseNamedPipeProtocol=1, RpcProtocols=7 · 0x00000709 해결)'

      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint" /v NoWarningNoElevationOnInstall /t REG_DWORD /d 1 /f | Out-Null
      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint" /v UpdatePromptSettings /t REG_DWORD /d 2 /f | Out-Null
      $actions += 'Point and Print LAN 공유 프린터 드라이버 자동 설치 허용 정렬'

      netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes 2>$null | Out-Null
      netsh advfirewall firewall set rule group="파일 및 프린터 공유" new enable=Yes 2>$null | Out-Null

      Set-Service -Name 'Spooler' -StartupType Automatic -ErrorAction SilentlyContinue | Out-Null
      Restart-Service -Name 'Spooler' -Force -ErrorAction SilentlyContinue | Out-Null
      $sp = Get-Service -Name 'Spooler' -ErrorAction SilentlyContinue
      if ($sp -and $sp.Status -eq 'Running') {
        $restarted += 'Spooler'
        $actions += 'Print Spooler(Spooler) 서비스 즉시 재시작 및 RPC 정책 반영 완료'
      } else {
        $spoolerFailed = $true
        $actions += 'Spooler 서비스 즉시 재시작 실패 (프로세스 잠금 · 재부팅 권장)'
      }

      @{
        appliedActions = $actions
        restartedServices = $restarted
        netbiosStateChanged = $false
        spoolerRestartFailed = $spoolerFailed
        priorPendingReboot = $priorPendingReboot
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'rpc_printer_default') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $restarted = @()
      $spoolerFailed = $false

      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print" /v RpcAuthnLevelPrivacyEnabled /t REG_DWORD /d 1 /f | Out-Null
      $actions += '프린터 RPC 개인정보 인증 강제(RpcAuthnLevelPrivacyEnabled=1) 복원'

      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC" /v RpcUseNamedPipeProtocol /t REG_DWORD /d 0 /f | Out-Null
      reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC" /v RpcProtocols /f 2>$null | Out-Null
      $actions += 'RPC over TCP 기본 보안 전송 정책으로 복원'

      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint" /v NoWarningNoElevationOnInstall /t REG_DWORD /d 0 /f | Out-Null
      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\PointAndPrint" /v UpdatePromptSettings /t REG_DWORD /d 0 /f | Out-Null
      $actions += 'Point and Print 관리자 드라이버 설치 제한 복원'

      Restart-Service -Name 'Spooler' -Force -ErrorAction SilentlyContinue | Out-Null
      $sp = Get-Service -Name 'Spooler' -ErrorAction SilentlyContinue
      if ($sp -and $sp.Status -eq 'Running') {
        $restarted += 'Spooler'
        $actions += 'Print Spooler 서비스 새로고침 완료'
      } else {
        $spoolerFailed = $true
      }

      @{
        appliedActions = $actions
        restartedServices = $restarted
        netbiosStateChanged = $false
        spoolerRestartFailed = $spoolerFailed
        priorPendingReboot = $false
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'deep_stack_reset') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $restarted = @()
      & netsh.exe winsock reset 2>&1 | Out-Null
      $actions += 'Winsock 카탈로그 초기화 (netsh winsock reset)'
      & netsh.exe int ip reset 2>&1 | Out-Null
      $actions += 'TCP/IP 프로토콜 스택 초기화 (netsh int ip reset)'
      & ipconfig.exe /flushdns 2>&1 | Out-Null
      & arp.exe -d * 2>$null | Out-Null
      $actions += 'DNS & ARP 테이블 캐시 플러시 완료'
      foreach ($svc in @('LanmanWorkstation', 'LanmanServer', 'FDResPub')) {
        Set-Service -Name $svc -StartupType Automatic -ErrorAction SilentlyContinue | Out-Null
        Restart-Service -Name $svc -Force -ErrorAction SilentlyContinue | Out-Null
        $restarted += $svc
      }
      @{
        appliedActions = $actions
        restartedServices = $restarted
        netbiosStateChanged = $false
        spoolerRestartFailed = $false
        priorPendingReboot = $true
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'enable_uac_token_filter') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v LocalAccountTokenFilterPolicy /t REG_DWORD /d 1 /f | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "LocalAccountTokenFilterPolicy 설정 실패 (관리자 권한 필요)" }
      reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLinkedConnections /t REG_DWORD /d 1 /f 2>$null | Out-Null
      $actions += 'UAC 원격 토큰 필터 완화 활성화 (LocalAccountTokenFilterPolicy=1 · 오류 5 방지)'
      $actions += '관리자/일반 토큰 간 네트워크 드라이브 공유(EnableLinkedConnections=1) 확인 완료'
      @{
        appliedActions = $actions
        restartedServices = @()
        netbiosStateChanged = $false
        smb1Changed = $false
        spoolerRestartFailed = $false
        priorPendingReboot = $false
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'disable_uac_token_filter') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v LocalAccountTokenFilterPolicy /t REG_DWORD /d 0 /f | Out-Null
      $actions += 'UAC 원격 토큰 필터 기본 보안 복원 (LocalAccountTokenFilterPolicy=0)'
      @{
        appliedActions = $actions
        restartedServices = @()
        netbiosStateChanged = $false
        smb1Changed = $false
        spoolerRestartFailed = $false
        priorPendingReboot = $false
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'enable_smbv1_client') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $smb1Changed = $false
      if (Get-Command Get-WindowsOptionalFeature -ErrorAction SilentlyContinue) {
        $feat = Get-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol-Client' -ErrorAction SilentlyContinue
        if ($feat -and "$($feat.State)" -eq 'Enabled') {
          $actions += 'SMB 1.0/CIFS 클라이언트(SMB1Protocol-Client) 기능이 이미 활성화되어 있습니다.'
        } else {
          Enable-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol-Client' -All -NoRestart -ErrorAction Stop | Out-Null
          $smb1Changed = $true
          $actions += '구형 NAS·복합기용 SMB 1.0/CIFS 클라이언트 선택적 기능(SMB1Protocol-Client) 설치 완료'
        }
      } else {
        & sc.exe config mrxsmb10 start= auto 2>$null | Out-Null
        & sc.exe start mrxsmb10 2>$null | Out-Null
        $smb1Changed = $true
        $actions += '레거시 SMB 1.0 클라이언트 드라이버(mrxsmb10) 시작 설정 완료'
      }
      @{
        appliedActions = $actions
        restartedServices = @()
        netbiosStateChanged = $false
        smb1Changed = $smb1Changed
        spoolerRestartFailed = $false
        priorPendingReboot = $smb1Changed
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'legacy_bridge_compat') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $restarted = @()
      $netbiosChanged = $false
      $priorPendingReboot = $false
      if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') { $priorPendingReboot = $true }
      if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') { $priorPendingReboot = $true }

      if (Get-Command Get-NetConnectionProfile -ErrorAction SilentlyContinue) {
        Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.NetworkCategory -eq 'Public' } | ForEach-Object {
          Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction SilentlyContinue | Out-Null
          $actions += ("네트워크 프로필 개인(Private) 전환: " + $_.InterfaceAlias)
        }
      }

      netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes 2>$null | Out-Null
      netsh advfirewall firewall set rule group="파일 및 프린터 공유" new enable=Yes 2>$null | Out-Null
      if (Get-Command Get-NetFirewallRule -ErrorAction SilentlyContinue) {
        if (-not (Get-NetFirewallRule -DisplayName "AhBiShare-SMB-445" -ErrorAction SilentlyContinue)) {
          New-NetFirewallRule -DisplayName "AhBiShare-SMB-445" -Direction Inbound -Protocol TCP -LocalPort 445 -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
        }
      } else {
        netsh advfirewall firewall delete rule name="AhBiShare-SMB-445" 2>$null | Out-Null
        netsh advfirewall firewall add rule name="AhBiShare-SMB-445" dir=in action=allow protocol=TCP localport=445 profile=any 2>$null | Out-Null
      }
      $actions += 'TCP 445 및 파일·프린터 공유 방화벽 규칙 개방 정렬'

      try {
        if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbServerConfiguration -EnableSMB2Protocol $true -EncryptData $false -RequireSecuritySignature $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      try { Set-SmbServerConfiguration -RejectUnencryptedAccess $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
      try {
        if (Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbClientConfiguration -EnableInsecureGuestLogons $true -RequireSecuritySignature $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v SMB2 /t REG_DWORD /d 1 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EnableSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EncryptData /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RejectUnencryptedAccess /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f | Out-Null
      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f 2>$null | Out-Null
      $actions += 'Win 7(SMB 2.1)·Win 8(SMB 3.0) 호환을 위해 SMB 암호화·서명 강제 해제 및 비암호화 접근 허용'

      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LmCompatibilityLevel /t REG_DWORD /d 3 /f | Out-Null
      $actions += 'NTLM 인증 협상 수준 NTLMv2 고정(LmCompatibilityLevel=3) 정렬'

      $nbtPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces'
      Get-ChildItem $nbtPath -ErrorAction SilentlyContinue | ForEach-Object {
        $prop = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if ($prop -and $prop.NetbiosOptions -eq 2) {
          Set-ItemProperty -Path $_.PSPath -Name 'NetbiosOptions' -Value 1 -Force -ErrorAction SilentlyContinue | Out-Null
          $netbiosChanged = $true
        }
      }
      if ($netbiosChanged) { $actions += 'NetBIOS over TCP/IP(NetbiosOptions=1) 활성화' }

      foreach ($svc in @('FDResPub', 'fdPHost', 'SSDPSrv')) {
        Set-Service -Name $svc -StartupType Automatic -ErrorAction SilentlyContinue | Out-Null
        Start-Service -Name $svc -ErrorAction SilentlyContinue | Out-Null
      }
      foreach ($svc in @('LanmanWorkstation', 'LanmanServer')) {
        Set-Service -Name $svc -StartupType Automatic -ErrorAction SilentlyContinue | Out-Null
        Restart-Service -Name $svc -Force -ErrorAction SilentlyContinue | Out-Null
        $restarted += $svc
      }
      & ipconfig.exe /flushdns 2>&1 | Out-Null
      $actions += 'WS-Discovery 탐색 · LanmanServer · LanmanWorkstation 즉시 재시작 완료'

      @{
        appliedActions = $actions
        restartedServices = $restarted
        netbiosStateChanged = $netbiosChanged
        smb1Changed = $false
        spoolerRestartFailed = $false
        priorPendingReboot = $priorPendingReboot
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'legacy_smb1_enable') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $restarted = @()
      $smb1Changed = $false
      if (Get-Command Get-WindowsOptionalFeature -ErrorAction SilentlyContinue) {
        $feat = Get-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol' -ErrorAction SilentlyContinue
        if ($feat -and "$($feat.State)" -eq 'Enabled') {
          $actions += 'SMB 1.0/CIFS 프로토콜(SMB1Protocol) 기능이 이미 활성화되어 있습니다.'
        } else {
          Enable-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol' -All -NoRestart -ErrorAction Stop | Out-Null
          $smb1Changed = $true
          $actions += '구형 Win 7·XP 호환용 SMB 1.0/CIFS 서버·클라이언트 기능(SMB1Protocol) 활성화 완료'
        }
      } else {
        & sc.exe config mrxsmb10 start= auto 2>$null | Out-Null
        & sc.exe start mrxsmb10 2>$null | Out-Null
        $smb1Changed = $true
        $actions += '레거시 SMB 1.0 드라이버(mrxsmb10) 자동 시작 구성 완료'
      }
      try {
        if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbServerConfiguration -EnableSMB1Protocol $true -EnableSMB2Protocol $true -EncryptData $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      try { Set-SmbServerConfiguration -RejectUnencryptedAccess $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v SMB1 /t REG_DWORD /d 1 /f 2>$null | Out-Null
      foreach ($svc in @('LanmanWorkstation', 'LanmanServer')) {
        Restart-Service -Name $svc -Force -ErrorAction SilentlyContinue | Out-Null
        $restarted += $svc
      }
      $actions += 'SMB 1.0 레지스트리 활성화 및 서비스 갱신 (커널 적재를 위해 재부팅 필수)'
      @{
        appliedActions = $actions
        restartedServices = $restarted
        netbiosStateChanged = $false
        smb1Changed = $smb1Changed
        spoolerRestartFailed = $false
        priorPendingReboot = $true
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'legacy_bridge_rollback') {
    const hasSnap = Boolean(rollbackSnapshot);
    const srvSigPs = rollbackSnapshot ? (rollbackSnapshot.smbServerSigningRequired ? '$true' : '$false') : '$true';
    const cliSigPs = rollbackSnapshot ? (rollbackSnapshot.smbClientSigningRequired ? '$true' : '$false') : '$true';
    const srvSigDword = rollbackSnapshot ? (rollbackSnapshot.smbServerSigningRequired ? 1 : 0) : 1;
    const cliSigDword = rollbackSnapshot ? (rollbackSnapshot.smbClientSigningRequired ? 1 : 0) : 1;
    const guestPs = rollbackSnapshot ? (rollbackSnapshot.allowInsecureGuestAuth ? '$true' : '$false') : '$false';
    const guestDword = rollbackSnapshot ? (rollbackSnapshot.allowInsecureGuestAuth ? 1 : 0) : 0;
    const nullRestrictDword = guestDword === 1 ? 0 : 1;
    const encryptPs = rollbackSnapshot ? (rollbackSnapshot.smbEncryptData ? '$true' : '$false') : '$false';
    const rejectUnencPs = rollbackSnapshot ? (rollbackSnapshot.smbRejectUnencryptedAccess ? '$true' : '$false') : '$false';
    const encryptDword = rollbackSnapshot && rollbackSnapshot.smbEncryptData ? 1 : 0;
    const rejectUnencDword = rollbackSnapshot && rollbackSnapshot.smbRejectUnencryptedAccess ? 1 : 0;
    const lmDword =
      rollbackSnapshot && typeof rollbackSnapshot.lmCompatibilityLevel === 'number'
        ? Math.max(0, Math.min(5, Math.floor(rollbackSnapshot.lmCompatibilityLevel)))
        : 3;
    const uacFilterDword = rollbackSnapshot?.localAccountTokenFilterEnabled ? 1 : 0;
    const shouldDisableSmb1 = !rollbackSnapshot?.smb1Enabled;
    const actionHeader = hasSnap
      ? `사전 캡처 스냅샷(${rollbackSnapshot?.capturedAt || ''}) 기준 SMB 서명·암호화·게스트·NTLMv(${lmDword})·UAC 상태 복원 완료`
      : 'SMB 서명 강제 · 비인증 게스트 차단 · UAC 원격 토큰 보호 표준 원복 완료';

    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $restarted = @()
      $smb1Changed = $false

      try {
        if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbServerConfiguration -RequireSecuritySignature ${srvSigPs} -EncryptData ${encryptPs} -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      try { Set-SmbServerConfiguration -RejectUnencryptedAccess ${rejectUnencPs} -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
      try {
        if (Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbClientConfiguration -EnableInsecureGuestLogons ${guestPs} -RequireSecuritySignature ${cliSigPs} -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d ${srvSigDword} /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EncryptData /t REG_DWORD /d ${encryptDword} /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RejectUnencryptedAccess /t REG_DWORD /d ${rejectUnencDword} /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d ${cliSigDword} /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d ${guestDword} /f | Out-Null
      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d ${guestDword} /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d ${nullRestrictDword} /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LmCompatibilityLevel /t REG_DWORD /d ${lmDword} /f 2>$null | Out-Null
      reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v LocalAccountTokenFilterPolicy /t REG_DWORD /d ${uacFilterDword} /f 2>$null | Out-Null
      $actions += '${escapePsSingle(actionHeader)}'

      ${
        shouldDisableSmb1
          ? `
      $srvCfg = if (Get-Command Get-SmbServerConfiguration -ErrorAction SilentlyContinue) { Get-SmbServerConfiguration -ErrorAction SilentlyContinue } else { $null }
      $featFull = if (Get-Command Get-WindowsOptionalFeature -ErrorAction SilentlyContinue) { Get-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol' -ErrorAction SilentlyContinue } else { $null }
      $lsReg = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters' -ErrorAction SilentlyContinue
      if (($srvCfg -and $srvCfg.EnableSMB1Protocol) -or ($featFull -and "$($featFull.State)" -eq 'Enabled') -or ($lsReg -and $lsReg.SMB1 -eq 1)) {
        try {
          if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
            Set-SmbServerConfiguration -EnableSMB1Protocol $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
          }
        } catch {}
        reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v SMB1 /t REG_DWORD /d 0 /f 2>$null | Out-Null
        if (Get-Command Disable-WindowsOptionalFeature -ErrorAction SilentlyContinue) {
          Disable-WindowsOptionalFeature -Online -FeatureName 'SMB1Protocol' -NoRestart -ErrorAction SilentlyContinue | Out-Null
        }
        $smb1Changed = $true
        $actions += '레거시 SMB 1.0 프로토콜 비활성화(Disable-WindowsOptionalFeature SMB1Protocol) 완료'
      }`
          : `$actions += '패치 이전부터 SMB 1.0이 활성 상태였던 환경으로 확인되어 기존 SMB 1.0 상태를 유지했습니다.'`
      }

      foreach ($svc in @('LanmanWorkstation', 'LanmanServer')) {
        Restart-Service -Name $svc -Force -ErrorAction SilentlyContinue | Out-Null
        $restarted += $svc
      }
      & ipconfig.exe /flushdns 2>&1 | Out-Null
      @{
        appliedActions = $actions
        restartedServices = $restarted
        netbiosStateChanged = $false
        smb1Changed = $smb1Changed
        spoolerRestartFailed = $false
        priorPendingReboot = $smb1Changed
      } | ConvertTo-AhBiJson
    `.trim();
  }

  if (mode === 'strict_26h2_default') {
    return `
      ${PS_JSON_HELPER}
      $actions = @()
      $restarted = @()
      try {
        if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbServerConfiguration -RequireSecuritySignature $true -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      try {
        if (Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue) {
          Set-SmbClientConfiguration -EnableInsecureGuestLogons $false -RequireSecuritySignature $true -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
        }
      } catch {}
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f 2>$null | Out-Null
      $actions += 'Server/Client SMB 보안 서명 강제(RequireSecuritySignature=$true) 복원'
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f | Out-Null
      reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f 2>$null | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 1 /f 2>$null | Out-Null
      reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v LocalAccountTokenFilterPolicy /t REG_DWORD /d 0 /f 2>$null | Out-Null
      $actions += '비인증 게스트 로그온(서비스·GPO), 익명 세션 및 UAC 원격 토큰 필터 차단 복원'
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v everyoneincludesanonymous /t REG_DWORD /d 0 /f | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v restrictanonymous /t REG_DWORD /d 1 /f | Out-Null
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LimitBlankPasswordUse /t REG_DWORD /d 1 /f | Out-Null
      $actions += 'LSA 익명 접근 차단 및 빈 암호 제한 복원'
      foreach ($svc in @('LanmanWorkstation', 'LanmanServer')) {
        Restart-Service -Name $svc -Force -ErrorAction SilentlyContinue | Out-Null
        $restarted += $svc
      }
      & ipconfig.exe /flushdns 2>&1 | Out-Null
      @{
        appliedActions = $actions
        restartedServices = $restarted
        netbiosStateChanged = $false
        smb1Changed = $false
        spoolerRestartFailed = $false
        priorPendingReboot = $false
      } | ConvertTo-AhBiJson
    `.trim();
  }

  // safe_compat (default): OS build aware safe compatibility without touching SMBv1 or Winsock
  return `
    ${PS_JSON_HELPER}
    $actions = @()
    $restarted = @()
    $netbiosChanged = $false
    $priorPendingReboot = $false
    if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') { $priorPendingReboot = $true }
    if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') { $priorPendingReboot = $true }

    if (Get-Command Get-NetConnectionProfile -ErrorAction SilentlyContinue) {
      Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.NetworkCategory -eq 'Public' } | ForEach-Object {
        Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction SilentlyContinue | Out-Null
        $actions += ("네트워크 프로필 개인(Private) 전환: " + $_.InterfaceAlias)
      }
    }

    netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes 2>$null | Out-Null
    netsh advfirewall firewall set rule group="파일 및 프린터 공유" new enable=Yes 2>$null | Out-Null
    if (Get-Command Get-NetFirewallRule -ErrorAction SilentlyContinue) {
      if (-not (Get-NetFirewallRule -DisplayName "AhBiShare-SMB-445" -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName "AhBiShare-SMB-445" -Direction Inbound -Protocol TCP -LocalPort 445 -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
      }
    } else {
      netsh advfirewall firewall delete rule name="AhBiShare-SMB-445" 2>$null | Out-Null
      netsh advfirewall firewall add rule name="AhBiShare-SMB-445" dir=in action=allow protocol=TCP localport=445 profile=any 2>$null | Out-Null
    }
    $actions += 'TCP 445 인바운드 및 파일 공유 방화벽 규칙 정렬'

    try {
      if (Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue) {
        Set-SmbClientConfiguration -EnableInsecureGuestLogons $true -RequireSecuritySignature $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
      }
    } catch {}
    try {
      if (Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue) {
        Set-SmbServerConfiguration -RequireSecuritySignature $false -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
      }
    } catch {}
    reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
    reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f 2>$null | Out-Null
    reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f | Out-Null
    reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f 2>$null | Out-Null
    reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 0 /f 2>$null | Out-Null
    reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLinkedConnections /t REG_DWORD /d 1 /f 2>$null | Out-Null
    $actions += 'Win 11 24H2~26H2 SMB 서명 강제 완화 및 게스트 로그온 · LinkedConnections 호환 허용'

    $lsa = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa' -ErrorAction SilentlyContinue
    if (-not $lsa -or $null -eq $lsa.LmCompatibilityLevel -or [int]$lsa.LmCompatibilityLevel -lt 3) {
      reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LmCompatibilityLevel /t REG_DWORD /d 3 /f | Out-Null
      $actions += 'NTLMv2 인증 협상 수준(LmCompatibilityLevel=3) 정렬'
    }

    $nbtPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters\\Interfaces'
    Get-ChildItem $nbtPath -ErrorAction SilentlyContinue | ForEach-Object {
      $prop = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
      if ($prop -and $prop.NetbiosOptions -eq 2) {
        Set-ItemProperty -Path $_.PSPath -Name 'NetbiosOptions' -Value 1 -Force -ErrorAction SilentlyContinue | Out-Null
        $netbiosChanged = $true
      }
    }
    if ($netbiosChanged) { $actions += '비활성화된 어댑터 NetBIOS over TCP/IP(NetbiosOptions=1) 복구' }

    foreach ($svc in @('FDResPub', 'fdPHost', 'SSDPSrv')) {
      Set-Service -Name $svc -StartupType Automatic -ErrorAction SilentlyContinue | Out-Null
      Start-Service -Name $svc -ErrorAction SilentlyContinue | Out-Null
    }
    foreach ($svc in @('LanmanWorkstation', 'LanmanServer')) {
      Set-Service -Name $svc -StartupType Automatic -ErrorAction SilentlyContinue | Out-Null
      Restart-Service -Name $svc -Force -ErrorAction SilentlyContinue | Out-Null
      $restarted += $svc
    }
    & ipconfig.exe /flushdns 2>&1 | Out-Null
    $actions += 'LanmanWorkstation · LanmanServer 즉시 재시작 및 DNS 캐시 플러시'

    @{
      appliedActions = $actions
      restartedServices = $restarted
      netbiosStateChanged = $netbiosChanged
      spoolerRestartFailed = $false
      priorPendingReboot = $priorPendingReboot
    } | ConvertTo-AhBiJson
  `.trim();
}
