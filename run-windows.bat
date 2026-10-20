@echo off
rem Draw on Screen launcher for Windows.
rem
rem Downloads the latest prebuilt app from this repository's GitHub Releases,
rem verifies its SHA-256 checksum, and starts it. Nothing needs to be installed first.
rem Pass --build to compile from source instead (requires Node.js 20+ and Rust).
setlocal EnableExtensions

rem Change this if you run a fork with its own releases.
set "REPO=hagdmk/draw-on-screen"
set "ASSET=draw-on-screen-windows-x64.exe"
set "BASE_URL=https://github.com/%REPO%/releases/latest/download"

cd /d "%~dp0"
set "BIN_DIR=bin\windows"
set "EXE=%BIN_DIR%\draw-on-screen.exe"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

if /i "%~1"=="--build" goto build

where curl >nul 2>nul
if errorlevel 1 (
  echo curl was not found. It ships with Windows 10 version 1803 and later.
  goto fail
)

set "REMOTE_VERSION="
set "LOCAL_VERSION="
curl -fsSL "%BASE_URL%/version.txt" -o "%BIN_DIR%\version.remote" 2>nul
if not errorlevel 1 set /p REMOTE_VERSION=<"%BIN_DIR%\version.remote"
if exist "%BIN_DIR%\version.txt" set /p LOCAL_VERSION=<"%BIN_DIR%\version.txt"

if not defined REMOTE_VERSION goto offline
if "%REMOTE_VERSION%"=="%LOCAL_VERSION%" if exist "%EXE%" goto run

echo Downloading Draw on Screen %REMOTE_VERSION%...
curl -fL --progress-bar "%BASE_URL%/%ASSET%" -o "%BIN_DIR%\download.tmp"
if errorlevel 1 goto fail
curl -fsSL "%BASE_URL%/%ASSET%.sha256" -o "%BIN_DIR%\download.sha256"
if errorlevel 1 goto fail

set "EXPECTED="
set "ACTUAL="
for /f "usebackq tokens=1" %%H in ("%BIN_DIR%\download.sha256") do if not defined EXPECTED set "EXPECTED=%%H"
for /f "skip=1 tokens=* delims=" %%H in ('certutil -hashfile "%BIN_DIR%\download.tmp" SHA256') do if not defined ACTUAL set "ACTUAL=%%H"
if defined ACTUAL set "ACTUAL=%ACTUAL: =%"
if /i not "%ACTUAL%"=="%EXPECTED%" (
  del /q "%BIN_DIR%\download.tmp"
  echo Checksum mismatch; the download was discarded.
  goto fail
)

rem Close a running copy so it can be replaced.
taskkill /im draw-on-screen.exe /f >nul 2>nul
move /y "%BIN_DIR%\download.tmp" "%EXE%" >nul
copy /y "%BIN_DIR%\version.remote" "%BIN_DIR%\version.txt" >nul
del /q "%BIN_DIR%\download.sha256" >nul 2>nul

:run
start "" "%EXE%"
echo Draw on Screen is running. Ctrl+Shift+D draws, Esc stops drawing, Ctrl+Shift+Q quits.
exit /b 0

:offline
if exist "%EXE%" (
  echo Could not check for updates; starting the copy already downloaded.
  goto run
)
where cargo >nul 2>nul
if not errorlevel 1 (
  echo No release is available yet; building from source.
  goto build
)
echo No release is available yet and Rust is not installed. See README.md, "Build from source".
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
start "" "src-tauri\target\release\draw-on-screen.exe"
exit /b 0

:fail
echo.
pause
exit /b 1
