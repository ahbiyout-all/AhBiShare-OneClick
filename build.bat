@echo off
setlocal EnableExtensions
title AhBiShare OneClick - Versioned Executable Build Script

cd /d "%~dp0"

set "APP_VER="
for /f "usebackq delims=" %%v in (`node -p "String(require('./package.json').version || '').replace(/^v/i,'')" 2^>nul`) do set "APP_VER=%%v"
if not "%APP_VER%"=="" goto :ver_ready
for /f "usebackq delims=" %%v in (`node -p "String(require('./public/config.json').version || '').replace(/^v/i,'')" 2^>nul`) do set "APP_VER=%%v"
:ver_ready
if "%APP_VER%"=="" set "APP_VER=1.3.0"

echo ========================================================================
echo   AhBiShare OneClick v%APP_VER% - Root Build Script
echo   Output Target: release\AhBiShare_OneClick*_v%APP_VER%.exe
echo ========================================================================

if not exist "%~dp0node_modules" (
  echo [1/5] Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/5] Dependencies detected ^(node_modules^). Checking sync...
)

echo [2/5] Running TypeScript check and release verification...
call npm run lint
if errorlevel 1 (
  echo [ERROR] TypeScript lint check failed.
  pause
  exit /b 1
)
call npm run verify
if errorlevel 1 (
  echo [ERROR] Verification suite failed.
  pause
  exit /b 1
)

echo [3/5] Building frontend and Standard + Lite Portable EXEs ^(v%APP_VER%^)...
call npm run electron:build:all
if errorlevel 1 (
  echo [ERROR] Standard/Lite Electron build failed.
  pause
  exit /b 1
)

echo [4/5] Building Windows 7/8/8.1 Portable EXE and Setup Installer ^(v%APP_VER%^)...
call npm run electron:build:win7
if errorlevel 1 (
  echo [ERROR] Windows 7 compatible Electron build failed.
  pause
  exit /b 1
)

if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" (
  "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" "/DAppVersion=%APP_VER%" "%~dp0installer\setup.iss"
  if errorlevel 1 (
    echo [ERROR] Inno Setup compilation failed.
    pause
    exit /b 1
  )
) else if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" (
  "%ProgramFiles%\Inno Setup 6\ISCC.exe" "/DAppVersion=%APP_VER%" "%~dp0installer\setup.iss"
  if errorlevel 1 (
    echo [ERROR] Inno Setup compilation failed.
    pause
    exit /b 1
  )
) else (
  call npx electron-builder --win nsis --x64 --config.nsis.artifactName="AhBiShare_OneClick-Setup_v%APP_VER%.exe"
  if errorlevel 1 (
    echo [ERROR] NSIS installer build failed.
    pause
    exit /b 1
  )
)

rem Normalize any unversioned .exe outputs in release\ to include _v%APP_VER%
for %%F in (
  "AhBiShare_OneClick.exe:AhBiShare_OneClick_v%APP_VER%.exe"
  "AhBiShare_OneClick-Lite.exe:AhBiShare_OneClick-Lite_v%APP_VER%.exe"
  "AhBiShare_OneClick_Win7.exe:AhBiShare_OneClick_Win7_v%APP_VER%.exe"
  "AhBiShare_OneClick-Setup.exe:AhBiShare_OneClick-Setup_v%APP_VER%.exe"
) do (
  for /f "tokens=1,2 delims=:" %%A in (%%F) do (
    if exist "%~dp0release\%%~A" (
      if not exist "%~dp0release\%%~B" (
        move /y "%~dp0release\%%~A" "%~dp0release\%%~B" >nul
      ) else (
        del /f /q "%~dp0release\%%~A" >nul 2>&1
      )
    )
  )
)

echo.
echo [5/5] Generated Versioned Executables in release\:
set "HAS_EXE="
for /f "delims=" %%E in ('dir /b "%~dp0release\*_v%APP_VER%*.exe" 2^>nul') do (
  echo   - %%E
  set "HAS_EXE=1"
)
if not defined HAS_EXE (
  echo [ERROR] No versioned executable ^(*_v%APP_VER%*.exe^) was generated in release\.
  pause
  exit /b 1
)

echo.
echo [*] Opening output folder: %~dp0release
start "" explorer "%~dp0release"

echo ========================================================================
echo   [SUCCESS] AhBiShare OneClick v%APP_VER% build completed.
echo ========================================================================
pause
