@echo off
rem Draw on Screen installer and launcher for Windows.
rem
rem Downloads the latest prebuilt app from this repository's GitHub Releases, verifies its
rem SHA-256 checksum, installs it for the current user (no admin rights needed), adds
rem Start menu and desktop shortcuts, and starts it. After that, use the shortcut;
rem run this file again to update.
rem
rem   run-windows.bat              install or update, then start
rem   run-windows.bat --build      build from source instead (requires Node.js 20+ and Rust)
rem   run-windows.bat --uninstall  remove the app, its shortcuts and launch at startup
setlocal EnableExtensions

rem Change this if you run a fork with its own releases.
set "REPO=hagdmk/draw-on-screen"
set "ASSET=draw-on-screen-windows-x64.exe"
set "BASE_URL=https://github.com/%REPO%/releases/latest/download"

cd /d "%~dp0"
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\Draw on Screen"
set "EXE=%INSTALL_DIR%\draw-on-screen.exe"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
rem Copies downloaded by the first version of this launcher lived in the repository.
if exist "bin\windows" rmdir /s /q "bin\windows" >nul 2>nul

if /i "%~1"=="--build" goto build
if /i "%~1"=="--uninstall" goto uninstall

where curl >nul 2>nul
if errorlevel 1 (
  echo curl was not found. It ships with Windows 10 version 1803 and later.
  goto fail
)

set "REMOTE_VERSION="
set "LOCAL_VERSION="
curl -fsSL "%BASE_URL%/version.txt" -o "%INSTALL_DIR%\version.remote" 2>nul
if errorlevel 1 goto read_local
rem Downloaded text is only read into a variable after it matches a strict pattern,
rem so it can never inject batch syntax such as "&" or "|" when expanded.
rem PowerShell does the check because findstr rejects a last line without a line break.
powershell -NoProfile -NonInteractive -Command "if ((Get-Content -Raw -LiteralPath (Join-Path $env:INSTALL_DIR 'version.remote')).Trim() -cmatch '^v\d+\.\d+\.\d+$') { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo Ignoring an unexpected version.txt from the release.
  goto read_local
)
set /p REMOTE_VERSION=<"%INSTALL_DIR%\version.remote"
:read_local
if exist "%INSTALL_DIR%\version.txt" set /p LOCAL_VERSION=<"%INSTALL_DIR%\version.txt"

if not defined REMOTE_VERSION goto offline
if "%REMOTE_VERSION%"=="%LOCAL_VERSION%" if exist "%EXE%" goto installed

echo Downloading Draw on Screen %REMOTE_VERSION%...
curl -fL --progress-bar "%BASE_URL%/%ASSET%" -o "%INSTALL_DIR%\download.tmp"
if errorlevel 1 goto fail
curl -fsSL "%BASE_URL%/%ASSET%.sha256" -o "%INSTALL_DIR%\download.sha256"
if errorlevel 1 goto fail
powershell -NoProfile -NonInteractive -Command "if ((Get-Content -Raw -LiteralPath (Join-Path $env:INSTALL_DIR 'download.sha256')).Trim() -cmatch '^[0-9a-f]{64}  draw-on-screen-windows-x64\.exe$') { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  del /q "%INSTALL_DIR%\download.tmp"
  echo The checksum file has an unexpected format; the download was discarded.
  goto fail
)

set "EXPECTED="
set "ACTUAL="
for /f "usebackq tokens=1" %%H in ("%INSTALL_DIR%\download.sha256") do if not defined EXPECTED set "EXPECTED=%%H"
for /f "skip=1 tokens=* delims=" %%H in ('certutil -hashfile "%INSTALL_DIR%\download.tmp" SHA256') do if not defined ACTUAL set "ACTUAL=%%H"
if defined ACTUAL set "ACTUAL=%ACTUAL: =%"
if /i not "%ACTUAL%"=="%EXPECTED%" (
  del /q "%INSTALL_DIR%\download.tmp"
  echo Checksum mismatch; the download was discarded.
  goto fail
)

rem Close a running copy so it can be replaced.
taskkill /im draw-on-screen.exe /f >nul 2>nul
rem Give Windows a moment to release the file of the closed copy.
ping -n 2 127.0.0.1 >nul
move /y "%INSTALL_DIR%\download.tmp" "%EXE%" >nul
copy /y "%INSTALL_DIR%\version.remote" "%INSTALL_DIR%\version.txt" >nul
del /q "%INSTALL_DIR%\download.sha256" >nul 2>nul
echo Installed Draw on Screen %REMOTE_VERSION% to "%INSTALL_DIR%".

:installed
call :shortcuts
start "" "%EXE%"
echo Draw on Screen is running. Next time, open it from the Start menu or the desktop icon.
exit /b 0

:offline
if exist "%EXE%" (
  echo Could not check for updates; starting the installed copy.
  goto installed
)
where cargo >nul 2>nul
if not errorlevel 1 (
  echo No release could be downloaded; building from source.
  goto build
)
echo Could not get the latest release from github.com/%REPO%.
echo Either no release exists yet, the repository is private, or you are offline.
echo To build locally instead, install Rust and see README.md, "Build from source".
goto fail

:build
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js 20+ is required to build: https://nodejs.org
  goto fail
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust is required to build: https://rustup.rs
  goto fail
)
call npm ci
if errorlevel 1 goto fail
call npx tauri build --no-bundle
if errorlevel 1 goto fail
taskkill /im draw-on-screen.exe /f >nul 2>nul
rem Give Windows a moment to release the file of the closed copy.
ping -n 2 127.0.0.1 >nul
copy /y "src-tauri\target\release\draw-on-screen.exe" "%EXE%" >nul
if errorlevel 1 goto fail
del /q "%INSTALL_DIR%\version.txt" >nul 2>nul
goto installed

:uninstall
taskkill /im draw-on-screen.exe /f >nul 2>nul
rem Give Windows a moment to release the file of the closed copy.
ping -n 2 127.0.0.1 >nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Draw on Screen" /f >nul 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" /v "Draw on Screen" /f >nul 2>nul
powershell -NoProfile -NonInteractive -Command "foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) { Remove-Item -LiteralPath (Join-Path $dir 'Draw on Screen.lnk') -ErrorAction SilentlyContinue }"
rmdir /s /q "%INSTALL_DIR%" >nul 2>nul
echo Draw on Screen was removed.
exit /b 0

:shortcuts
rem Start menu and desktop shortcuts, recreated on every run so they always point at the install.
powershell -NoProfile -NonInteractive -Command "$shell = New-Object -ComObject WScript.Shell; foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) { $link = $shell.CreateShortcut((Join-Path $dir 'Draw on Screen.lnk')); $link.TargetPath = $env:EXE; $link.WorkingDirectory = $env:INSTALL_DIR; $link.Description = 'Draw on Screen'; $link.Save() }" >nul 2>nul
exit /b 0

:fail
echo.
pause
exit /b 1
