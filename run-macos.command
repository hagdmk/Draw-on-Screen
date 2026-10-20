#!/usr/bin/env bash
# Draw on Screen launcher for macOS.
#
# Downloads the latest prebuilt app from this repository's GitHub Releases,
# verifies its SHA-256 checksum, and opens it. Nothing needs to be installed first.
# Pass --build to compile from source instead (requires Node.js 20+ and Rust).
set -euo pipefail

# Change this if you run a fork with its own releases.
REPO="hagdmk/draw-on-screen"
ASSET="draw-on-screen-macos-universal.tar.gz"
APP_NAME="Draw on Screen.app"
BASE_URL="https://github.com/$REPO/releases/latest/download"

cd "$(dirname "$0")"
BIN_DIR="bin/macos"
mkdir -p "$BIN_DIR"

fail() {
  echo "Error: $*" >&2
  exit 1
}

build_from_source() {
  command -v npm >/dev/null 2>&1 || fail "Node.js 20+ is required to build. Install it from https://nodejs.org or with 'brew install node'."
  command -v cargo >/dev/null 2>&1 || fail "Rust is required to build. Install it from https://rustup.rs"
  npm ci
  npx tauri build --bundles app
  open "src-tauri/target/release/bundle/macos/$APP_NAME"
  exit 0
}

if [[ "${1:-}" == "--build" ]]; then
  build_from_source
fi

remote_version="$(curl -fsSL "$BASE_URL/version.txt" 2>/dev/null || true)"
local_version="$(cat "$BIN_DIR/version.txt" 2>/dev/null || true)"
# Accept only a plain tag like v1.2.3 from the network.
if [[ -n "$remote_version" && ! "$remote_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Ignoring an unexpected version.txt from the release."
  remote_version=""
fi

if [[ -z "$remote_version" ]]; then
  if [[ -d "$BIN_DIR/$APP_NAME" ]]; then
    echo "Could not check for updates; starting the copy already downloaded."
  elif command -v cargo >/dev/null 2>&1; then
    echo "No release is available yet; building from source."
    build_from_source
  else
    fail "No release is available yet and Rust is not installed. See README.md, 'Build from source'."
  fi
elif [[ "$remote_version" != "$local_version" || ! -d "$BIN_DIR/$APP_NAME" ]]; then
  echo "Downloading Draw on Screen $remote_version..."
  tmp="$BIN_DIR/download.tmp"
  curl -fL --progress-bar "$BASE_URL/$ASSET" -o "$tmp"
  expected="$(curl -fsSL "$BASE_URL/$ASSET.sha256" | awk '{print $1}')"
  actual="$(shasum -a 256 "$tmp" | awk '{print $1}')"
  if [[ ! "$expected" =~ ^[0-9a-f]{64}$ || "$expected" != "$actual" ]]; then
    rm -f "$tmp"
    fail "Checksum mismatch; the download was discarded."
  fi
  # Close a running copy so it can be replaced.
  osascript -e 'quit app "Draw on Screen"' >/dev/null 2>&1 || true
  rm -rf "${BIN_DIR:?}/$APP_NAME"
  tar -xzf "$tmp" -C "$BIN_DIR"
  rm -f "$tmp"
  printf '%s' "$remote_version" > "$BIN_DIR/version.txt"
fi

open "$BIN_DIR/$APP_NAME"
echo "Draw on Screen is running. Cmd+Shift+D draws, Esc stops drawing, Cmd+Shift+Q quits."
