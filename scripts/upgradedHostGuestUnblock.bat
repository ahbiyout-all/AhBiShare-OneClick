@echo off
setlocal EnableExtensions
title AhBiShare OneClick - Upgraded Host Guest Unblock

set "AHBI_SHARE=%~1"
if "%AHBI_SHARE%"=="" set "AHBI_SHARE=AhBiShared"
set "AHBI_DIR=%~2"
if "%AHBI_DIR%"=="" set "AHBI_DIR=C:\AhBiShared"
set "AHBI_HAS_WARN=0"

echo ========================================================================
echo   AhBiShare OneClick - Upgraded Host Guest Network Unblock
echo   Target Share : %AHBI_SHARE%
echo   Target Folder: %AHBI_DIR%
echo   Fixes        : LimitBlankPasswordUse=0 / Guest / SeDenyNetworkLogonRight / TCP 445
echo ========================================================================
echo.

echo [*] Checking administrator privileges...
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Administrator privileges are required.
  echo Right-click this .bat file and select [Run as administrator].
  echo.
  if /I "%AHBI_NO_PAUSE%"=="1" exit /b 1
  pause
  exit /b 1
)

echo [1/6] Force-setting LSA blank password and anonymous logon policies...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v LimitBlankPasswordUse /t REG_DWORD /d 0 /f >nul || (echo [WARN] Failed to set LimitBlankPasswordUse=0 & set "AHBI_HAS_WARN=1")
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v everyoneincludesanonymous /t REG_DWORD /d 1 /f >nul || (echo [WARN] Failed to set everyoneincludesanonymous=1 & set "AHBI_HAS_WARN=1")
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v restrictanonymous /t REG_DWORD /d 0 /f >nul || (echo [WARN] Failed to set restrictanonymous=0 & set "AHBI_HAS_WARN=1")
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v forceguest /t REG_DWORD /d 0 /f >nul 2>&1

echo [2/6] Relaxing SMB Server and Workstation Guest/signing/NTLM policies (Win 7-11 26H2)...
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" /v RestrictNullSessAccess /t REG_DWORD /d 0 /f >nul || (echo [WARN] Failed to set RestrictNullSessAccess=0 & set "AHBI_HAS_WARN=1")
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" /v EnableSecuritySignature /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" /v EncryptData /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" /v RejectUnencryptedAccess /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters" /v RequireSecuritySignature /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters" /v BlockNTLM /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters" /v RequireEncryption /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\LanmanWorkstation" /v AllowInsecureGuestAuth /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\LanmanWorkstation" /v BlockNTLM /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\LanmanWorkstation" /v RequireEncryption /t REG_DWORD /d 0 /f >nul 2>&1

echo [3/6] Creating folder, NTFS/SMB ACLs, enabling Guest account & clearing SeDenyNetworkLogonRight...
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Continue';$warns=@();$q=[string][char]34;$safeShare=($env:AHBI_SHARE -replace ('[\\/:*?<>|%$&'+$q+']'),'');if(-not $safeShare){$safeShare='AhBiShared'};$tgtDir=($env:AHBI_DIR -replace ('[%$&|<>^'+$q+']'),'');if(-not $tgtDir){$tgtDir='C:\AhBiShared'};$inf=Join-Path $env:TEMP ('ahbi_ug_'+$PID+'_'+(Get-Random)+'.inf');$sdb=Join-Path $env:TEMP ('ahbi_ug_'+$PID+'_'+(Get-Random)+'.sdb');$log=$inf+'.log';try{if(Get-Command Get-NetConnectionProfile -ErrorAction SilentlyContinue){Get-NetConnectionProfile -ErrorAction SilentlyContinue|Where-Object{$_.NetworkCategory -eq 'Public'}|ForEach-Object{Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private -ErrorAction SilentlyContinue|Out-Null;Write-Host ('  [OK] Network profile set to Private: '+$_.InterfaceAlias)}};if(-not (Test-Path -LiteralPath $tgtDir)){New-Item -Path $tgtDir -ItemType Directory -Force -ErrorAction Stop|Out-Null;Write-Host ('  [OK] Created folder: '+$tgtDir)}else{Write-Host ('  [OK] Verified folder: '+$tgtDir)};$icTarget=if($tgtDir -match '^[A-Za-z]:\\$'){$tgtDir.Substring(0,2)+'\.'}else{$tgtDir};& icacls.exe $icTarget /grant '*S-1-1-0:(OI)(CI)F' /T /C /Q | Out-Null;if($LASTEXITCODE -ne 0){$warns+=('icacls Everyone failed (code '+$LASTEXITCODE+')')}else{Write-Host '  [OK] NTFS ACL granted for Everyone'};& icacls.exe $icTarget /grant '*S-1-5-32-546:(OI)(CI)F' /T /C /Q 2>$null|Out-Null;& icacls.exe $icTarget /grant '*S-1-5-7:(OI)(CI)F' /T /C /Q 2>$null|Out-Null;$g=Get-WmiObject Win32_UserAccount -Filter 'LocalAccount=True' -ErrorAction SilentlyContinue|Where-Object{$_.SID -like '*-501'}|Select-Object -First 1;$gSid=if($g -and $g.SID){'*'+$g.SID}else{''};$gName=if($g -and $g.Name){$g.Name}else{'Guest'};if(Get-Command Get-SmbShare -ErrorAction SilentlyContinue){$sh=Get-SmbShare -Name $safeShare -ErrorAction SilentlyContinue;if($sh -and ($sh.Path.TrimEnd('\') -ine $tgtDir.TrimEnd('\'))){Remove-SmbShare -Name $safeShare -Force -ErrorAction SilentlyContinue;$sh=$null};if(-not $sh){New-SmbShare -Name $safeShare -Path $tgtDir -FullAccess 'Everyone' -ErrorAction Stop|Out-Null;Write-Host ('  [OK] Created SMB share: '+$safeShare)}else{Grant-SmbShareAccess -Name $safeShare -AccountName 'Everyone' -AccessRight Full -Force -ErrorAction SilentlyContinue|Out-Null;Write-Host ('  [OK] Updated SMB share ACL for Everyone: '+$safeShare)};foreach($sidStr in @('S-1-5-32-546','S-1-5-7')){try{$nt=(New-Object System.Security.Principal.SecurityIdentifier($sidStr)).Translate([System.Security.Principal.NTAccount]).Value;if($nt){Grant-SmbShareAccess -Name $safeShare -AccountName $nt -AccessRight Full -Force -ErrorAction SilentlyContinue|Out-Null}}catch{}};if($gName){Grant-SmbShareAccess -Name $safeShare -AccountName $gName -AccessRight Full -Force -ErrorAction SilentlyContinue|Out-Null}}else{& net.exe share $safeShare /delete /y 2>$null|Out-Null;& net.exe share ($safeShare+'='+$tgtDir) '/GRANT:Everyone,FULL';if($LASTEXITCODE -ne 0){$warns+=('net share failed (code '+$LASTEXITCODE+')')}else{Write-Host ('  [OK] Created legacy SMB share: '+$safeShare)}};$nk='HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters';$cn=(Get-ItemProperty -Path $nk -Name NullSessionShares -ErrorAction SilentlyContinue).NullSessionShares;if($null -eq $cn){$cn=@()}elseif($cn -is [string]){$cn=@($cn)};if($cn -notcontains $safeShare){Set-ItemProperty -Path $nk -Name NullSessionShares -Value (@($cn)+$safeShare) -ErrorAction SilentlyContinue|Out-Null};if(Get-Command Set-SmbServerConfiguration -ErrorAction SilentlyContinue){try{Set-SmbServerConfiguration -RequireSecuritySignature $false -EnableSecuritySignature $false -EncryptData $false -Confirm:$false -ErrorAction SilentlyContinue|Out-Null}catch{};try{Set-SmbServerConfiguration -RejectUnencryptedAccess $false -Confirm:$false -ErrorAction SilentlyContinue|Out-Null}catch{}};if(Get-Command Set-SmbClientConfiguration -ErrorAction SilentlyContinue){try{Set-SmbClientConfiguration -EnableInsecureGuestLogons $true -RequireSecuritySignature $false -Confirm:$false -ErrorAction SilentlyContinue|Out-Null}catch{};try{Set-SmbClientConfiguration -BlockNTLM $false -Confirm:$false -ErrorAction SilentlyContinue|Out-Null}catch{};try{Set-SmbClientConfiguration -RequireEncryption $false -Confirm:$false -ErrorAction SilentlyContinue|Out-Null}catch{}};$psiMin=New-Object System.Diagnostics.ProcessStartInfo;$psiMin.FileName='net.exe';$psiMin.Arguments='accounts /minpwlen:0';$psiMin.UseShellExecute=$false;$psiMin.RedirectStandardInput=$true;$psiMin.RedirectStandardOutput=$true;$psiMin.RedirectStandardError=$true;$psiMin.CreateNoWindow=$true;$pMin=[System.Diagnostics.Process]::Start($psiMin);if($pMin){try{$pMin.StandardInput.Close()}catch{};if(-not $pMin.WaitForExit(5000)){try{$pMin.Kill()}catch{}}};$psi=New-Object System.Diagnostics.ProcessStartInfo;$psi.FileName='net.exe';$psi.Arguments=('user '+[char]34+$gName+[char]34+' '+[char]34+[char]34+' /active:yes /passwordreq:no');$psi.UseShellExecute=$false;$psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true;$psi.CreateNoWindow=$true;$p=[System.Diagnostics.Process]::Start($psi);if($p){try{$p.StandardInput.Close()}catch{};if($p.WaitForExit(5000)){$nuCode=$p.ExitCode}else{try{$p.Kill()}catch{};$nuCode=1460}}else{$nuCode=-1};if($nuCode -ne 0){$warns+=('Guest activation/blank-password returned code '+$nuCode+' (check password length policy)')}else{Write-Host ('  [OK] Enabled Guest account with blank password: '+$gName)};if(Get-Command Enable-NetFirewallRule -ErrorAction SilentlyContinue){Enable-NetFirewallRule -Name 'FPS-SMB-In-TCP' -ErrorAction SilentlyContinue|Out-Null;Enable-NetFirewallRule -DisplayGroup '@FirewallAPI.dll,-28502' -ErrorAction SilentlyContinue|Out-Null};& secedit.exe /export /cfg $inf /areas USER_RIGHTS 2>$null|Out-Null;if(Test-Path -LiteralPath $inf){$out=@();foreach($ln in ([System.IO.File]::ReadAllLines($inf,[System.Text.Encoding]::Unicode))){if($ln -match '^(\s*SeDenyNetworkLogonRight\s*=\s*)(.*)$'){$items=@();foreach($tk in ($matches[2] -split ',')){$rawTk=$tk.Trim();$t=$rawTk.Trim([char]34);if(-not $t){continue};$isG=($t -eq '*S-1-5-32-546')-or($t -eq '*S-1-5-7')-or($t -match '-501$')-or($t -match '(?:^|\\)Guests?$')-or($t -match '(?:^|\\)Guest$')-or($gSid -and ($t -ieq $gSid))-or($gName -and ($t -ieq $gName));if(-not $isG){$items+=$rawTk}};$out+=($matches[1]+($items -join ','))}elseif($ln -match '^(\s*SeNetworkLogonRight\s*=\s*)(.*)$'){$items=@();foreach($tk in ($matches[2] -split ',')){$t=$tk.Trim();if($t){$items+=$t}};if($items -notcontains '*S-1-1-0'){$items+='*S-1-1-0'};if($gSid -and ($items -notcontains $gSid)){$items+=$gSid};$out+=($matches[1]+($items -join ','))}else{$out+=$ln}};$out|Out-File -FilePath $inf -Encoding Unicode -Force;& secedit.exe /configure /db $sdb /cfg $inf /areas USER_RIGHTS /log $log /quiet 2>$null|Out-Null;if($LASTEXITCODE -ne 0){$warns+=('secedit USER_RIGHTS returned code '+$LASTEXITCODE)}else{Write-Host '  [OK] Cleared SeDenyNetworkLogonRight for Guest'}}else{$warns+='secedit export failed (USER_RIGHTS not verified)'}}catch{$warns+=('Unexpected exception: '+$_.Exception.Message)}finally{foreach($f in @($inf,$sdb,($sdb+'.jfm'),$log)){if($f -and (Test-Path -LiteralPath $f)){Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue}}};if($warns.Count -gt 0){foreach($w in $warns){Write-Host ('  [WARN] '+$w) -ForegroundColor Yellow};exit 2};exit 0"
  if errorlevel 1 set "AHBI_HAS_WARN=1"
) else (
  if not exist "%AHBI_DIR%" mkdir "%AHBI_DIR%"
  icacls "%AHBI_DIR%" /grant "*S-1-1-0:(OI)(CI)F" /T /C /Q || set "AHBI_HAS_WARN=1"
  net share "%AHBI_SHARE%=%AHBI_DIR%" "/GRANT:Everyone,FULL" || set "AHBI_HAS_WARN=1"
  net accounts /minpwlen:0 >nul 2>&1
  net user Guest "" /active:yes /passwordreq:no || (echo [WARN] Guest activation/password reset returned an error. & set "AHBI_HAS_WARN=1")
)

echo [4/6] Opening Windows Firewall TCP 445 for File Sharing (Private/Domain profiles)...
netsh advfirewall firewall set rule group="File and Printer Sharing" profile=private,domain new enable=Yes >nul 2>&1
netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes >nul 2>&1
netsh advfirewall firewall delete rule name="AhBiShare-SMB-445" >nul 2>&1
netsh advfirewall firewall add rule name="AhBiShare-SMB-445" dir=in action=allow protocol=TCP localport=445 profile=private,domain >nul || (echo [WARN] Failed to add Private/Domain TCP 445 firewall rule & set "AHBI_HAS_WARN=1")

echo [5/6] Restarting SMB services (LanmanServer / LanmanWorkstation)...
net stop LanmanServer /y >nul 2>&1
net start LanmanServer >nul || (echo [ERROR] LanmanServer failed to start & set "AHBI_HAS_WARN=1")
net stop LanmanWorkstation /y >nul 2>&1
net start LanmanWorkstation >nul 2>&1

echo [6/6] Verifying live LimitBlankPasswordUse, SMB Share & TCP 445 firewall rule...
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v LimitBlankPasswordUse 2>nul | findstr /I "0x0" >nul && (echo   [OK] LimitBlankPasswordUse=0x0 verified) || (echo   [WARN] LimitBlankPasswordUse=0x0 not verified & set "AHBI_HAS_WARN=1")
net share "%AHBI_SHARE%" >nul 2>&1 && (echo   [OK] SMB Share \\%COMPUTERNAME%\%AHBI_SHARE% is active) || (echo   [WARN] SMB Share '%AHBI_SHARE%' could not be verified & set "AHBI_HAS_WARN=1")
netsh advfirewall firewall show rule name="AhBiShare-SMB-445" >nul 2>&1 && (echo   [OK] Firewall rule AhBiShare-SMB-445 TCP 445 is active) || (echo   [WARN] Firewall rule AhBiShare-SMB-445 not verified & set "AHBI_HAS_WARN=1")

echo.
echo ========================================================================
if "%AHBI_HAS_WARN%"=="1" (
  echo  [DONE WITH WARNINGS] Review [WARN]/[ERROR] lines above.
  echo  If Guest failed due to password complexity policy, set secpol.msc
  echo  MinimumPasswordLength=0 or use AhBiShare Dedicated Account mode instead.
) else (
  echo  [DONE] Guest network access, LimitBlankPasswordUse=0, SeDenyNetworkLogonRight,
  echo         NTFS/SMB ACLs, and TCP 445 firewall rule are verified on this host.
  echo  Target UNC Share: \\%COMPUTERNAME%\%AHBI_SHARE% (%AHBI_DIR%)
)
echo ========================================================================
echo.
if /I "%AHBI_NO_PAUSE%"=="1" exit /b 0
pause
