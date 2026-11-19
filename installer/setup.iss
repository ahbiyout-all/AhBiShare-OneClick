; AhBiShare OneClick - Inno Setup Installer Script
; Unpacked Multi-File Install + Process Kill + Uninstall/Overwrite Prompt + Silent Install + Firewall Rules

#define AppName "AhBiShare OneClick"
#ifndef AppVersion
  #define AppVersion "1.1.1"
#endif
#define AppPublisher "AhBiYout"
#define AppCopyright "Copyright (c) 1998-2026 AhBiYout. All rights reserved."
#define AppURL "https://github.com/ahbiyout-all/AhBiShare-OneClick"
#define AppExeName "AhBiShare_OneClick.exe"

[Setup]
AppId={{C78A43E8-2E11-4B33-91EC-5D9F48C8B101}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher={#AppPublisher}
AppCopyright={#AppCopyright}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\AhBiShare_OneClick
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=..\release
OutputBaseFilename=AhBiShare_OneClick-Setup_v{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName} v{#AppVersion}
DisableProgramGroupPage=yes

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Unpacked multi-file install only (strictly excludes docs, portable JSONs, and temporary files)
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Excludes: "*.portable.json,*.log,*.tmp,docs\*"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\{#AppName} 제거 (Uninstall)"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
function GetPreviousUninstallString(): String;
var
  RegPath: String;
  UninstallStr: String;
begin
  Result := '';
  RegPath := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{C78A43E8-2E11-4B33-91EC-5D9F48C8B101}_is1';
  if RegQueryStringValue(HKLM, RegPath, 'UninstallString', UninstallStr) then
    Result := RemoveQuotes(UninstallStr)
  else if RegQueryStringValue(HKCU, RegPath, 'UninstallString', UninstallStr) then
    Result := RemoveQuotes(UninstallStr);
end;

function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
  PrevUninstall: String;
  Choice: Integer;
begin
  Result := True;

  // 1. Force terminate running instances before install/upgrade
  Exec('taskkill.exe', '/f /im {#AppExeName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/f /im AhBiShare_OneClick_Lite.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/f /im AhBiShare_OneClick_Win7.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/f /im AhBiShare_OneClick_v{#AppVersion}.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/f /im AhBiShare_OneClick-Lite_v{#AppVersion}.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/f /im AhBiShare_OneClick_Win7_v{#AppVersion}.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  // 2. Check existing installation and ask user to Uninstall or Overwrite (skipped in /SILENT or /VERYSILENT mode)
  PrevUninstall := GetPreviousUninstallString();
  if (PrevUninstall <> '') and (not WizardSilent()) then
  begin
    Choice := MsgBox(
      '기존에 설치된 AhBiShare OneClick이 감지되었습니다.' + #13#10 +
      '[예(Yes)] 기존 앱을 먼저 제거한 뒤 새로 설치합니다.' + #13#10 +
      '[아니오(No)] 기존 경로에 덮어쓰기(업데이트)로 설치합니다.' + #13#10 +
      '[취소(Cancel)] 설치를 중단합니다.',
      mbConfirmation, MB_YESNOCANCEL
    );
    if Choice = IDCANCEL then
    begin
      Result := False;
      Exit;
    end
    else if Choice = IDYES then
    begin
      Exec(PrevUninstall, '/VERYSILENT /NORESTART /SUPPRESSMSGBOXES', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  AppExePath: String;
begin
  if CurStep = ssPostInstall then
  begin
    AppExePath := ExpandConstant('{app}\{#AppExeName}');
    // Quietly register firewall rules using both base name and version-suffixed app name
    Exec('netsh.exe', 'advfirewall firewall delete rule name="AhBiShare_OneClick"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', 'advfirewall firewall add rule name="AhBiShare_OneClick" dir=in action=allow program="' + AppExePath + '" enable=yes profile=any', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    Exec('netsh.exe', 'advfirewall firewall delete rule name="AhBiShare_OneClick_v{#AppVersion}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', 'advfirewall firewall add rule name="AhBiShare_OneClick_v{#AppVersion}" dir=in action=allow program="' + AppExePath + '" enable=yes profile=any', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec('taskkill.exe', '/f /im {#AppExeName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', 'advfirewall firewall delete rule name="AhBiShare_OneClick"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('netsh.exe', 'advfirewall firewall delete rule name="AhBiShare_OneClick_v{#AppVersion}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
