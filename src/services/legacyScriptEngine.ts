import {
  LegacyComparisonRow,
  LegacyScriptBundle,
  LegacyScriptOptions,
  LegacyTargetOs,
} from '@/types/share';
import { tx } from '@/i18n/localeState';

function toCrlf(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

export function getLegacyComparisonMatrix(): LegacyComparisonRow[] {
  return [
    {
      id: 'leg_smb_dialect',
      category: 'protocol',
      categoryLabel: tx('SMB 세대', 'SMB Dialect'),
      topic: tx('기본 SMB 프로토콜 버전', 'Default SMB Protocol Version'),
      win7Behavior: tx(
        'SMB 2.1 기본 지원 (SMB 3.x 미지원 · 2.0/2.1 또는 구형 SMB1)',
        'SMB 2.1 supported (no SMB 3.x; uses SMB 2.0/2.1 or legacy SMB1)'
      ),
      win8Behavior: tx(
        'SMB 3.0 / 3.02 기본 지원 (Windows 8.1까지 비인증 게스트 기본 허용)',
        'SMB 3.0 / 3.02 supported (unauthenticated guest allowed by default through Win 8.1)'
      ),
      win10_11Behavior: tx(
        'SMB 3.1.1 기본 (Win 10 1709+/Win 11 24H2부터 게스트·서명 강화)',
        'SMB 3.1.1 default (guest & signing hardened since Win 10 1709+ / Win 11 24H2)'
      ),
      resolutionSummary: tx(
        'Win 7 SP1 이상은 SMB 1.0 없이도 SMB 2.1로 Win 10·11과 연결됩니다. 단, Win 10·11 서버에서 SMB2 유지 및 암호화 강제 해제가 필수입니다.',
        'Win 7 SP1+ connects to Win 10/11 over SMB 2.1 without SMB 1.0, provided SMB2 stays enabled and mandatory encryption is disabled on Win 10/11.'
      ),
    },
    {
      id: 'leg_smb_encryption',
      category: 'encryption',
      categoryLabel: tx('SMB 암호화', 'SMB Encryption'),
      topic: tx(
        'SMB 전송 암호화 강제 (Error 58 / 0x80070035)',
        'Enforced SMB Encryption (Error 58 / 0x80070035)'
      ),
      win7Behavior: tx(
        'SMB 전송 암호화(AES-CCM/GCM) 자체 미지원 → 암호화 강제 서버 거부됨',
        'No SMB transport encryption (AES-CCM/GCM) → rejected by encryption-enforcing servers'
      ),
      win8Behavior: tx(
        'SMB 3.0 AES-CCM만 지원 (Win 11의 AES-256-GCM 우선 협상 시 주의)',
        'Supports SMB 3.0 AES-CCM only (watch out for Win 11 AES-256-GCM negotiation)'
      ),
      win10_11Behavior: tx(
        'EncryptData 또는 RejectUnencryptedAccess=$true 시 Win 7 연결 즉시 차단',
        'Blocks Win 7 immediately when EncryptData or RejectUnencryptedAccess=$true'
      ),
      resolutionSummary: tx(
        'Win 10·11 호스트에서 [구형 OS 브릿지 패치]로 EncryptData=$false 및 RejectUnencryptedAccess=$false 적용 시 즉시 해결됩니다.',
        'Resolved by applying the [Legacy OS Bridge Patch] on Win 10/11 to set EncryptData=$false and RejectUnencryptedAccess=$false.'
      ),
    },
    {
      id: 'leg_smb_signing',
      category: 'protocol',
      categoryLabel: tx('보안 서명', 'SMB Signing'),
      topic: tx(
        'SMB 패킷 서명 강제 (Win 11 24H2+ 차단)',
        'Mandatory SMB Packet Signing (Win 11 24H2+ Block)'
      ),
      win7Behavior: tx(
        '클라이언트/서버 기본 서명 선택적 (요구 안 함)',
        'Client/server signing optional by default (not required)'
      ),
      win8Behavior: tx(
        '클라이언트/서버 기본 서명 선택적',
        'Client/server signing optional by default'
      ),
      win10_11Behavior: tx(
        'Win 11 24H2~26H2 기본 RequireSecuritySignature=$true (외부 비서명 차단)',
        'Win 11 24H2–26H2 defaults to RequireSecuritySignature=$true (blocks unsigned peers)'
      ),
      resolutionSummary: tx(
        'Win 10·11에서 서명 강제를 완화하고, Win 7·8 쪽도 RequireSecuritySignature=0으로 일치시킵니다.',
        'Relax mandatory signing on Win 10/11 and align Win 7/8 with RequireSecuritySignature=0.'
      ),
    },
    {
      id: 'leg_ntlm_auth',
      category: 'auth',
      categoryLabel: tx('인증 · NTLM', 'Auth & NTLM'),
      topic: tx(
        'NTLMv1 vs NTLMv2 인증 협상 & UAC 원격 토큰',
        'NTLMv1 vs NTLMv2 Negotiation & UAC Remote Token'
      ),
      win7Behavior: tx(
        '기본 LmCompatibilityLevel=3 (환경에 따라 NTLMv1 응답 또는 UAC 오류 5 발생)',
        'Default LmCompatibilityLevel=3 (some environments hit NTLMv1 or UAC Error 5)'
      ),
      win8Behavior: tx(
        'NTLMv2 기본 사용, 워크그룹 로컬 관리자 공유 시 UAC 토큰 필터링 적용',
        'NTLMv2 default; workgroup local admin shares are subject to UAC token filtering'
      ),
      win10_11Behavior: tx(
        'NTLMv1 사실상 거부 및 24H2+ 게스트 차단, MSA/PIN 전용 계정 확산',
        'NTLMv1 practically rejected, 24H2+ blocks guest logons, MSA/PIN accounts common'
      ),
      resolutionSummary: tx(
        '양단 LmCompatibilityLevel=3(NTLMv2 전용) 고정 + 필요 시 LocalAccountTokenFilterPolicy=1 및 전용 공유 계정(계정 모드)을 사용합니다.',
        'Pin LmCompatibilityLevel=3 (NTLMv2 only) on both ends + use LocalAccountTokenFilterPolicy=1 or dedicated Account Auth credentials.'
      ),
    },
    {
      id: 'leg_discovery',
      category: 'discovery',
      categoryLabel: tx('탐색 · 검색', 'Network Discovery'),
      topic: tx(
        '네트워크 폴더 목록 탐색 (홈 그룹 & Computer Browser 종료)',
        'Network Folder Browsing (HomeGroup & Computer Browser Retired)'
      ),
      win7Behavior: tx(
        '홈 그룹(HomeGroup) + NetBIOS/Computer Browser(SMBv1 기반) 의존',
        'Relies on HomeGroup + NetBIOS/Computer Browser (SMBv1-based)'
      ),
      win8Behavior: tx(
        '홈 그룹 + NetBIOS 탐색 혼용',
        'Mix of HomeGroup + NetBIOS discovery'
      ),
      win10_11Behavior: tx(
        'Win 10 1803 이후 홈 그룹 완전 제거, SMBv1 탐색 비활성 (WS-Discovery 전환)',
        'HomeGroup removed since Win 10 1803; SMBv1 browsing disabled (switched to WS-Discovery)'
      ),
      resolutionSummary: tx(
        'Win 10·11에서 FDResPub/fdPHost 서비스를 켜고, 탐색기 목록 대신 AhBiShare 연결 코드 또는 \\\\IP\\공유폴더명으로 직접 마운트합니다.',
        'Enable FDResPub/fdPHost on Win 10/11 and mount directly using an AhBiShare connection code or \\\\IP\\ShareName.'
      ),
    },
    {
      id: 'leg_error_codes',
      category: 'errors',
      categoryLabel: tx('오류 코드', 'Error Codes'),
      topic: tx(
        'Win 7·8 공유 시 빈번한 오류 (0x80070035 · 58 · 1272 · 5)',
        'Frequent Win 7/8 Sharing Errors (0x80070035 · 58 · 1272 · 5)'
      ),
      win7Behavior: tx(
        '오류 58(명령 오류/암호화), 오류 53(방화벽 445), 오류 1326(계정 불일치)',
        'Error 58 (incorrect command/encryption), Error 53 (firewall 445), Error 1326 (bad credentials)'
      ),
      win8Behavior: tx(
        '오류 5(UAC 원격 토큰), 오류 1219(다중 세션 충돌), 오류 0x80070035',
        'Error 5 (UAC remote token), Error 1219 (multiple session conflict), 0x80070035'
      ),
      win10_11Behavior: tx(
        '오류 1272(게스트 로그온 차단), 0x80070035(서명·암호화 강제)',
        'Error 1272 (guest logon blocked), 0x80070035 (enforced signing/encryption)'
      ),
      resolutionSummary: tx(
        '먼저 SMB 2.1/3.0 브릿지 + USB 스크립트를 적용하고, 그래도 2008/XP급 구형 장비만 남을 때 2단계 확인 후 SMB 1.0을 한시 활성화합니다.',
        'Apply SMB 2.1/3.0 bridge + USB scripts first; only temporarily enable SMB 1.0 after 2-step confirmation for Server 2008/XP-era equipment.'
      ),
    },
  ];
}

export const LEGACY_COMPARISON_MATRIX: LegacyComparisonRow[] = getLegacyComparisonMatrix();

function osDisplayLabel(targetOs: LegacyTargetOs): string {
  return targetOs === 'win7' ? 'Windows 7 SP1 (NT 6.1)' : 'Windows 8 / 8.1 (NT 6.2 / 6.3)';
}

function directionComment(direction: LegacyScriptOptions['direction']): string {
  if (direction === 'modern_to_legacy') return 'Win 10/11 -> Win 7/8/8.1 (Client to Legacy Host)';
  if (direction === 'legacy_to_modern') return 'Win 7/8/8.1 -> Win 10/11 (Legacy Client to Modern Host)';
  return 'Bidirectional (Win 7/8/8.1 <-> Win 10/11)';
}

export function buildLegacyScriptBundle(options: LegacyScriptOptions): LegacyScriptBundle {
  const {
    targetOs,
    direction,
    includeGuestLogon,
    includeUacTokenFilter,
    includeDiscoveryServices,
    includeSmb1Protocol,
  } = options;

  const osLabel = osDisplayLabel(targetOs);
  const dirLabel = directionComment(direction);

  const regApplyLines: string[] = [
    'Windows Registry Editor Version 5.00',
    '',
    `; AhBiShare OneClick - ${osLabel} Cross-Generation Sharing Patch (Apply)`,
    `; Direction: ${dirLabel}`,
    '; Compatible with Windows 7 SP1 / 8 / 8.1 & Windows 10 / 11',
    '',
    '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters]',
    '"SMB2"=dword:00000001',
    '"RequireSecuritySignature"=dword:00000000',
    '"EnableSecuritySignature"=dword:00000000',
    '"EncryptData"=dword:00000000',
    '"RejectUnencryptedAccess"=dword:00000000',
    `"RestrictNullSessAccess"=dword:${includeGuestLogon ? '00000000' : '00000001'}`,
    ...(includeSmb1Protocol ? ['"SMB1"=dword:00000001'] : []),
    '',
    '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters]',
    '"RequireSecuritySignature"=dword:00000000',
    '"EnableSecuritySignature"=dword:00000000',
    `"AllowInsecureGuestAuth"=dword:${includeGuestLogon ? '00000001' : '00000000'}`,
    '',
    '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation]',
    `"AllowInsecureGuestAuth"=dword:${includeGuestLogon ? '00000001' : '00000000'}`,
    '',
    '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Lsa]',
    '"LmCompatibilityLevel"=dword:00000003',
    ...(includeGuestLogon
      ? [
          '"everyoneincludesanonymous"=dword:00000001',
          '"restrictanonymous"=dword:00000000',
          '"LimitBlankPasswordUse"=dword:00000000',
        ]
      : []),
    '',
  ];

  if (includeUacTokenFilter) {
    regApplyLines.push(
      '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System]',
      '"LocalAccountTokenFilterPolicy"=dword:00000001',
      '"EnableLinkedConnections"=dword:00000001',
      ''
    );
  }

  const regRollbackLines: string[] = [
    'Windows Registry Editor Version 5.00',
    '',
    `; AhBiShare OneClick - ${osLabel} Security Restore (Rollback)`,
    `; Direction: ${dirLabel}`,
    '',
    '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters]',
    '"SMB2"=dword:00000001',
    '"RequireSecuritySignature"=dword:00000001',
    '"EnableSecuritySignature"=dword:00000001',
    '"EncryptData"=dword:00000000',
    '"RejectUnencryptedAccess"=dword:00000000',
    '"RestrictNullSessAccess"=dword:00000001',
    ...(includeSmb1Protocol ? ['"SMB1"=dword:00000000'] : []),
    '',
    '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters]',
    '"RequireSecuritySignature"=dword:00000001',
    '"EnableSecuritySignature"=dword:00000001',
    '"AllowInsecureGuestAuth"=dword:00000000',
    '',
    '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation]',
    '"AllowInsecureGuestAuth"=dword:00000000',
    '',
    '[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Lsa]',
    '"LmCompatibilityLevel"=dword:00000003',
    '"everyoneincludesanonymous"=dword:00000000',
    '"restrictanonymous"=dword:00000001',
    '"LimitBlankPasswordUse"=dword:00000001',
    '"forceguest"=dword:00000000',
    '',
    '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System]',
    '"LocalAccountTokenFilterPolicy"=dword:00000000',
    '',
  ];

  const inlineRegFallbackLines: string[] = [
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v SMB2 /t REG_DWORD /d 1 /f >nul',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f >nul',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EnableSecuritySignature /t REG_DWORD /d 0 /f >nul',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EncryptData /t REG_DWORD /d 0 /f >nul',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RejectUnencryptedAccess /t REG_DWORD /d 0 /f >nul',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f >nul',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v EnableSecuritySignature /t REG_DWORD /d 0 /f >nul',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LmCompatibilityLevel /t REG_DWORD /d 3 /f >nul',
    ...(includeGuestLogon
      ? [
          '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f >nul',
          '  reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f >nul 2>&1',
          '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 0 /f >nul',
          '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v everyoneincludesanonymous /t REG_DWORD /d 1 /f >nul',
          '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v restrictanonymous /t REG_DWORD /d 0 /f >nul',
          '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LimitBlankPasswordUse /t REG_DWORD /d 0 /f >nul',
        ]
      : [
          '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f >nul',
          '  reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f >nul 2>&1',
          '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 1 /f >nul',
        ]),
    ...(includeUacTokenFilter
      ? [
          '  reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v LocalAccountTokenFilterPolicy /t REG_DWORD /d 1 /f >nul',
          '  reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLinkedConnections /t REG_DWORD /d 1 /f >nul 2>&1',
        ]
      : []),
  ];

  // Pure ASCII console messages prevent Windows 7 cmd.exe multi-byte UTF-8 codepage block parsing truncation & mojibake
  const applyBatLines: string[] = [
    '@echo off',
    'setlocal EnableExtensions',
    'title AhBiShare OneClick - Legacy OS Sharing Apply - ' + osLabel,
    'echo ========================================================================',
    'echo   AhBiShare OneClick - ' + osLabel + ' Legacy Sharing Apply',
    'echo   Direction: ' + dirLabel,
    'echo ========================================================================',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 (',
    '  echo [ERROR] Administrator privileges are required.',
    '  echo Right-click this file and select [Run as administrator].',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'set "BACKUP_DIR=%~dp0Backup_Before_Apply"',
    'if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"',
    'echo [1/5] Backing up initial registry keys once to "%BACKUP_DIR%"...',
    'if not exist "%BACKUP_DIR%\\LanmanServer.reg" reg export "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" "%BACKUP_DIR%\\LanmanServer.reg" /y >nul 2>&1',
    'if not exist "%BACKUP_DIR%\\LanmanWorkstation.reg" reg export "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" "%BACKUP_DIR%\\LanmanWorkstation.reg" /y >nul 2>&1',
    'if not exist "%BACKUP_DIR%\\LanmanWorkstationPolicy.reg" reg export "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" "%BACKUP_DIR%\\LanmanWorkstationPolicy.reg" /y >nul 2>&1',
    'if not exist "%BACKUP_DIR%\\Lsa.reg" reg export "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" "%BACKUP_DIR%\\Lsa.reg" /y >nul 2>&1',
    'if not exist "%BACKUP_DIR%\\PoliciesSystem.reg" reg export "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" "%BACKUP_DIR%\\PoliciesSystem.reg" /y >nul 2>&1',
    'if not exist "%BACKUP_DIR%\\UserRights.inf" secedit /export /cfg "%BACKUP_DIR%\\UserRights.inf" /areas USER_RIGHTS >nul 2>&1',
    '',
    'echo [2/5] Applying SMB 2.1/3.0 and NTLMv2 compatibility settings...',
    'set "REG_OK=0"',
    'if exist "%~dp0AhBiShare_Legacy_Apply.reg" (',
    '  reg import "%~dp0AhBiShare_Legacy_Apply.reg" >nul 2>&1 && set "REG_OK=1"',
    ')',
    'if "%REG_OK%"=="0" (',
    ...inlineRegFallbackLines,
    ')',
    ...(includeGuestLogon
      ? [
          'if exist "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" (',
          '  "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$inf=Join-Path $env:TEMP (\'ahbi_u_\'+$PID+\'.inf\');$sdb=Join-Path $env:TEMP (\'ahbi_u_\'+$PID+\'.sdb\');$log=$inf+\'.log\';try{$g=Get-WmiObject Win32_UserAccount -Filter \'LocalAccount=True\' -ErrorAction SilentlyContinue|Where-Object{$_.SID -like \'*-501\'}|Select-Object -First 1;$gSid=if($g -and $g.SID){\'*\'+$g.SID}else{\'\'};$gName=if($g -and $g.Name){$g.Name}else{\'Guest\'};$psi=New-Object System.Diagnostics.ProcessStartInfo;$psi.FileName=\'net.exe\';$psi.Arguments=(\'user \'+[char]34+$gName+[char]34+\' \'+[char]34+[char]34+\' /active:yes /passwordreq:no\');$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$p=[System.Diagnostics.Process]::Start($psi);if($p){[void]$p.WaitForExit(5000)};& net.exe user $gName /active:yes 2>$null|Out-Null;& secedit.exe /export /cfg $inf /areas USER_RIGHTS 2>$null|Out-Null;if(Test-Path -LiteralPath $inf){$out=@();foreach($ln in ([System.IO.File]::ReadAllLines($inf,[System.Text.Encoding]::Unicode))){if($ln -match \'^(\\s*SeDenyNetworkLogonRight\\s*=\\s*)(.*)$\'){$items=@();foreach($tk in ($matches[2] -split \',\')){$rawTk=$tk.Trim();$t=$rawTk.Trim([char]34);if(-not $t){continue};$isG=($t -eq \'*S-1-5-32-546\')-or($t -eq \'*S-1-5-7\')-or($t -match \'-501$\')-or($t -match \'(?:^|\\\\)Guests?$\')-or($t -match \'(?:^|\\\\)게스트$\')-or($gSid -and ($t -ieq $gSid))-or($gName -and ($t -ieq $gName));if(-not $isG){$items+=$rawTk}};$out+=($matches[1]+($items -join \',\'))}elseif($ln -match \'^(\\s*SeNetworkLogonRight\\s*=\\s*)(.*)$\'){$items=@();foreach($tk in ($matches[2] -split \',\')){$t=$tk.Trim();if($t){$items+=$t}};if($items -notcontains \'*S-1-1-0\'){$items+=\'*S-1-1-0\'};if($gSid -and ($items -notcontains $gSid)){$items+=$gSid};$out+=($matches[1]+($items -join \',\'))}else{$out+=$ln}};$out|Out-File -FilePath $inf -Encoding Unicode -Force;& secedit.exe /configure /db $sdb /cfg $inf /areas USER_RIGHTS /log $log /quiet 2>$null|Out-Null}}catch{}finally{foreach($f in @($inf,$sdb,($sdb+\'.jfm\'),$log)){if($f -and (Test-Path -LiteralPath $f)){Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue}}}" >nul 2>&1',
          ')',
        ]
      : []),
    '',
    ...(includeSmb1Protocol
      ? [
          'echo [!] Notice: Enabling legacy SMB 1.0 driver. Run Rollback after file transfer.',
          'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v SMB1 /t REG_DWORD /d 1 /f >nul 2>&1',
          'sc config mrxsmb10 start= auto >nul 2>&1',
          'sc start mrxsmb10 >nul 2>&1',
          'if exist "%SystemRoot%\\System32\\dism.exe" dism /online /enable-feature /featurename:SMB1Protocol /all /norestart >nul 2>&1',
        ]
      : []),
    'echo [3/5] Opening Windows Firewall for File Sharing / TCP 445 / NetBIOS...',
    'if exist "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" (',
    '  "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "if(Get-Command Get-NetConnectionProfile -ErrorAction SilentlyContinue){Get-NetConnectionProfile -ErrorAction SilentlyContinue|Where-Object{$_.NetworkCategory -eq \'Public\'}|ForEach-Object{Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction SilentlyContinue|Out-Null}}" >nul 2>&1',
    ')',
    'netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes >nul 2>&1',
    'netsh advfirewall firewall set rule group="파일 및 프린터 공유" new enable=Yes >nul 2>&1',
    'netsh advfirewall firewall set rule group="@FirewallAPI.dll,-28502" new enable=Yes >nul 2>&1',
    ...(includeDiscoveryServices
      ? [
          'netsh advfirewall firewall set rule group="Network Discovery" new enable=Yes >nul 2>&1',
          'netsh advfirewall firewall set rule group="네트워크 검색" new enable=Yes >nul 2>&1',
          'netsh advfirewall firewall set rule group="@FirewallAPI.dll,-32752" new enable=Yes >nul 2>&1',
        ]
      : []),
    'netsh advfirewall firewall delete rule name="AhBiShare-Legacy-SMB-445" >nul 2>&1',
    'netsh advfirewall firewall add rule name="AhBiShare-Legacy-SMB-445" dir=in action=allow protocol=TCP localport=445 profile=any >nul 2>&1',
    'netsh advfirewall firewall delete rule name="AhBiShare-Legacy-NB-139" >nul 2>&1',
    'netsh advfirewall firewall add rule name="AhBiShare-Legacy-NB-139" dir=in action=allow protocol=TCP localport=139 profile=any >nul 2>&1',
    'netsh advfirewall firewall delete rule name="AhBiShare-Legacy-NB-UDP" >nul 2>&1',
    'netsh advfirewall firewall add rule name="AhBiShare-Legacy-NB-UDP" dir=in action=allow protocol=UDP localport=137-138 profile=any >nul 2>&1',
    '',
    'echo [4/5] Starting SMB and network discovery services...',
    ...(includeDiscoveryServices
      ? [
          'sc config FDResPub start= auto >nul 2>&1',
          'net start FDResPub >nul 2>&1',
          'sc config fdPHost start= auto >nul 2>&1',
          'net start fdPHost >nul 2>&1',
          'sc config SSDPSrv start= auto >nul 2>&1',
          'net start SSDPSrv >nul 2>&1',
        ]
      : []),
    'sc config LanmanServer start= auto >nul 2>&1',
    'sc config LanmanWorkstation start= auto >nul 2>&1',
    'net stop LanmanServer /y >nul 2>&1',
    'net start LanmanServer >nul 2>&1',
    'net stop LanmanWorkstation /y >nul 2>&1',
    'net start LanmanWorkstation >nul 2>&1',
    '',
    'echo [5/5] Flushing DNS cache and finalizing...',
    'ipconfig /flushdns >nul 2>&1',
    'echo.',
    'echo [DONE] ' + osLabel + ' cross-generation sharing compatibility applied.',
    'echo  - Backup folder: "%BACKUP_DIR%"',
    'echo  - After file transfer, run AhBiShare_Legacy_Rollback.bat to restore security.',
    ...(includeSmb1Protocol
      ? ['echo  - [REBOOT REQUIRED] Reboot this PC to load SMB 1.0 kernel driver cleanly.']
      : []),
    'pause',
  ];

  const rollbackBatLines: string[] = [
    '@echo off',
    'setlocal EnableExtensions',
    'title AhBiShare OneClick - Legacy OS Sharing Rollback',
    'echo ========================================================================',
    'echo   AhBiShare OneClick - ' + osLabel + ' Security Rollback',
    'echo ========================================================================',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 (',
    '  echo [ERROR] Administrator privileges are required. Right-click and Run as administrator.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'set "BACKUP_DIR=%~dp0Backup_Before_Apply"',
    'set "RESTORE_OK=0"',
    'echo [1/4] Resetting modified security values to hardened baseline first...',
    'if exist "%~dp0AhBiShare_Legacy_Rollback.reg" (',
    '  reg import "%~dp0AhBiShare_Legacy_Rollback.reg" >nul 2>&1 && set "RESTORE_OK=1"',
    ')',
    'if "%RESTORE_OK%"=="0" (',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EnableSecuritySignature /t REG_DWORD /d 1 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v EncryptData /t REG_DWORD /d 0 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RejectUnencryptedAccess /t REG_DWORD /d 0 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 1 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 1 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v EnableSecuritySignature /t REG_DWORD /d 1 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f >nul 2>&1',
    '  reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 0 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v everyoneincludesanonymous /t REG_DWORD /d 0 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v restrictanonymous /t REG_DWORD /d 1 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v LimitBlankPasswordUse /t REG_DWORD /d 1 /f >nul 2>&1',
    '  reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa" /v forceguest /t REG_DWORD /d 0 /f >nul 2>&1',
    '  reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v LocalAccountTokenFilterPolicy /t REG_DWORD /d 0 /f >nul 2>&1',
    '  set "RESTORE_OK=1"',
    ')',
    'if exist "%BACKUP_DIR%\\LanmanServer.reg" (',
    '  echo       Overlaying original pre-patch registry backups from "%BACKUP_DIR%"...',
    '  reg import "%BACKUP_DIR%\\LanmanServer.reg" >nul 2>&1',
    '  if exist "%BACKUP_DIR%\\LanmanWorkstation.reg" reg import "%BACKUP_DIR%\\LanmanWorkstation.reg" >nul 2>&1',
    '  if exist "%BACKUP_DIR%\\LanmanWorkstationPolicy.reg" reg import "%BACKUP_DIR%\\LanmanWorkstationPolicy.reg" >nul 2>&1',
    '  if exist "%BACKUP_DIR%\\Lsa.reg" reg import "%BACKUP_DIR%\\Lsa.reg" >nul 2>&1',
    '  if exist "%BACKUP_DIR%\\PoliciesSystem.reg" reg import "%BACKUP_DIR%\\PoliciesSystem.reg" >nul 2>&1',
    ')',
    'if exist "%BACKUP_DIR%\\UserRights.inf" (',
    '  secedit /configure /db "%BACKUP_DIR%\\UserRights_restore.sdb" /cfg "%BACKUP_DIR%\\UserRights.inf" /areas USER_RIGHTS /log "%BACKUP_DIR%\\UserRights_restore.log" /quiet >nul 2>&1',
    '  del /f /q "%BACKUP_DIR%\\UserRights_restore.*" >nul 2>&1',
    ')',
    'if exist "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" (',
    '  "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "try{$g=Get-WmiObject Win32_UserAccount -Filter \'LocalAccount=True\' -ErrorAction SilentlyContinue|Where-Object{$_.SID -like \'*-501\'}|Select-Object -First 1;if($g -and $g.Name){& net.exe user $g.Name /active:no 2>$null|Out-Null}}catch{}" >nul 2>&1',
    ')',
    '',
    ...(includeSmb1Protocol
      ? [
          'echo [2/4] Disabling SMB 1.0 protocol and temporary firewall rules...',
          'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters" /v SMB1 /t REG_DWORD /d 0 /f >nul 2>&1',
          'sc config mrxsmb10 start= demand >nul 2>&1',
          'if exist "%SystemRoot%\\System32\\dism.exe" dism /online /disable-feature /featurename:SMB1Protocol /norestart >nul 2>&1',
        ]
      : ['echo [2/4] Cleaning up temporary legacy firewall rules...']),
    'netsh advfirewall firewall delete rule name="AhBiShare-Legacy-SMB-445" >nul 2>&1',
    'netsh advfirewall firewall delete rule name="AhBiShare-Legacy-NB-139" >nul 2>&1',
    'netsh advfirewall firewall delete rule name="AhBiShare-Legacy-NB-UDP" >nul 2>&1',
    '',
    'echo [3/4] Restarting SMB services...',
    'net stop LanmanServer /y >nul 2>&1',
    'net start LanmanServer >nul 2>&1',
    'net stop LanmanWorkstation /y >nul 2>&1',
    'net start LanmanWorkstation >nul 2>&1',
    'echo [4/4] Flushing DNS cache and completing rollback...',
    'ipconfig /flushdns >nul 2>&1',
    'echo.',
    'echo [DONE] Network security policy has been safely restored.',
    ...(includeSmb1Protocol
      ? ['echo  - [NOTICE] Reboot this PC to unload SMB 1.0 driver completely.']
      : []),
    'pause',
  ];

  return {
    targetOs,
    riskLevel: includeSmb1Protocol ? 'elevated_smb1' : 'safe_smb2',
    folderName: 'AhBiShare_Legacy_Win7_Win8_Kit',
    files: [
      {
        name: 'AhBiShare_Legacy_Apply.bat',
        label: tx('적용 스크립트 (.bat)', 'Apply Script (.bat)'),
        kind: 'apply',
        format: 'bat',
        content: toCrlf(applyBatLines.join('\n')),
      },
      {
        name: 'AhBiShare_Legacy_Apply.reg',
        label: tx('적용 레지스트리 (.reg)', 'Apply Registry (.reg)'),
        kind: 'apply',
        format: 'reg',
        content: toCrlf(regApplyLines.join('\n')),
      },
      {
        name: 'AhBiShare_Legacy_Rollback.bat',
        label: tx('원복 스크립트 (.bat)', 'Rollback Script (.bat)'),
        kind: 'rollback',
        format: 'bat',
        content: toCrlf(rollbackBatLines.join('\n')),
      },
      {
        name: 'AhBiShare_Legacy_Rollback.reg',
        label: tx('원복 레지스트리 (.reg)', 'Rollback Registry (.reg)'),
        kind: 'rollback',
        format: 'reg',
        content: toCrlf(regRollbackLines.join('\n')),
      },
    ],
  };
}
