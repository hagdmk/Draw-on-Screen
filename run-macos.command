#!/usr/bin/env bash
# Draw on Screen installer and launcher for macOS.
#
# Downloads the latest prebuilt app from this repository's GitHub Releases, verifies its
# SHA-256 checksum, installs it to ~/Applications (find it in Launchpad or Spotlight),
# and opens it. Run this file again to update.
#
#   ./run-macos.command              install or update, then open
#   ./run-macos.command --build      build from source instead (requires Node.js 20+ and Rust)
#   ./run-macos.command --uninstall  remove the app and launch at startup
set -euo pipefail

# Change this if you run a fork with its own releases.
REPO="hagdmk/draw-on-screen"
ASSET="draw-on-screen-macos-universal.tar.gz"
APP_NAME="Draw on Screen.app"
BASE_URL="https://github.com/$REPO/releases/latest/download"

cd "$(dirname "$0")"
INSTALL_DIR="$HOME/Applications"
APP="$INSTALL_DIR/$APP_NAME"
STATE_DIR="$HOME/Library/Application Support/io.github.hagdmk.drawonscreen"
VERSION_FILE="$STATE_DIR/launcher-version.txt"
mkdir -p "$INSTALL_DIR" "$STATE_DIR"
# Copies downloaded by the first version of this launcher lived in the repository.
rm -rf bin/macos

fail() {
  echo "Error: $*" >&2
  exit 1
}

quit_running_app() {
  osascript -e 'quit app "Draw on Screen"' >/dev/null 2>&1 || true
}

install_app() {
  quit_running_app
  rm -rf "${APP:?}"
  cp -R "$1" "$APP"
}

open_app() {
  open "$APP"
  echo "Draw on Screen is running. Next time, open it from Launchpad or Spotlight."
  exit 0
}

build_from_source() {
  command -v npm >/dev/null 2>&1 || fail "Node.js 20+ is required to build. Install it from https://nodejs.org or with 'brew install node'."
  command -v cargo >/dev/null 2>&1 || fail "Rust is required to build. Install it from https://rustup.rs"
  npm ci
  npx tauri build --bundles app
  install_app "src-tauri/target/release/bundle/macos/$APP_NAME"
  rm -f "$VERSION_FILE"
  open_app
}

uninstall() {
  quit_running_app
  rm -rf "${APP:?}"
  rm -f "$HOME/Library/LaunchAgents/Draw on Screen.plist" "$VERSION_FILE"
  echo "Draw on Screen was removed."
  exit 0
}

case "${1:-}" in
  --build) build_from_source ;;
  --uninstall) uninstall ;;
esac

remote_version="$(curl -fsSL "$BASE_URL/version.txt" 2>/dev/null || true)"
local_version="$(cat "$VERSION_FILE" 2>/dev/null || true)"
# Accept only a plain tag like v1.2.3 from the network.
if [[ -n "$remote_version" && ! "$remote_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Ignoring an unexpected version.txt from the release."
  remote_version=""
fi

if [[ -z "$remote_version" ]]; then
  if [[ -d "$APP" ]]; then
    echo "Could not check for updates; starting the installed copy."
    open_app
  elif command -v cargo >/dev/null 2>&1; then
    echo "No release could be downloaded; building from source."
    build_from_source
  else
    fail "Could not get the latest release from github.com/$REPO. Either no release exists yet, the repository is private, or you are offline. To build locally instead, install Rust and see README.md, 'Build from source'."
  fi
fi

if [[ "$remote_version" != "$local_version" || ! -d "$APP" ]]; then
  echo "Downloading Draw on Screen $remote_version..."
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  curl -fL --progress-bar "$BASE_URL/$ASSET" -o "$work/$ASSET"
  expected="$(curl -fsSL "$BASE_URL/$ASSET.sha256" | awk '{print $1}')"
  actual="$(shasum -a 256 "$work/$ASSET" | awk '{print $1}')"
  if [[ ! "$expected" =~ ^[0-9a-f]{64}$ || "$expected" != "$actual" ]]; then
    fail "Checksum mismatch; the download was discarded."
  fi
  tar -xzf "$work/$ASSET" -C "$work"
  install_app "$work/$APP_NAME"
  printf '%s' "$remote_version" > "$VERSION_FILE"
  echo "Installed Draw on Screen $remote_version to $INSTALL_DIR."
fi

open_app
