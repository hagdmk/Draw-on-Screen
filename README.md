# Draw on Screen

A lightweight screen annotation tool for macOS and Windows. Draw on top of anything on your screen, then switch back to clicking through to the apps underneath, without losing what you drew.

Built with [Tauri 2](https://tauri.app): the drawing engine is TypeScript on an HTML canvas, and the native shell is Rust using the operating system's own web view (WebView2 on Windows, WKWebView on macOS). No browser engine is bundled, so the app stays small and light on memory.

> **Status:** step 1 of the development plan. The transparent overlay, click-through toggle, global shortcuts, a red pressure-sensitive pen, undo/redo and clear are in place. Pen types, colors, thickness, shapes, text, auto-erase, selection and image export come in later steps.

## Quick start

```sh
git clone https://github.com/hagdmk/draw-on-screen.git
cd draw-on-screen
```

Then run the one file for your system:

| System | Run | Requirements |
| --- | --- | --- |
| Windows 10 (1803+) / 11 | Double-click `run-windows.bat` | None |
| macOS 11+ (Apple Silicon or Intel) | Double-click `run-macos.command` | None |

The script downloads the latest prebuilt app from [Releases](https://github.com/hagdmk/draw-on-screen/releases) into `bin/`, checks its SHA-256 checksum, and starts it. Later runs only download again when a new release is out, so `git pull` plus the same double-click is how you update.

If you downloaded the repository as a ZIP instead of cloning it, macOS drops the executable flag. Restore it once:

```sh
chmod +x run-macos.command
```

## Shortcuts

| Action | Windows | macOS |
| --- | --- | --- |
| Start / stop drawing | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Stop drawing | `Esc` | `Esc` |
| Undo | `Ctrl+Z` | `Cmd+Z` |
| Redo | `Ctrl+Y` or `Ctrl+Shift+Z` | `Cmd+Shift+Z` |
| Clear everything | `Delete` | `Delete` |
| Quit | `Ctrl+Shift+Q` | `Cmd+Shift+Q` |

The tray icon (Windows notification area, macOS menu bar) also has **Toggle drawing** and **Quit**.

When drawing is off, your strokes stay visible but every click goes to the app underneath.

## Platform notes

### macOS

- The app runs as a menu bar utility, with no Dock icon.
- Drawing and global shortcuts need no special permission. Saving a screenshot that includes the screen behind your drawing (a later step) will ask for **Screen Recording** permission in System Settings > Privacy & Security.
- The release app is ad-hoc signed, not notarized. Because the launcher downloads it with `curl`, macOS does not mark it as quarantined and Gatekeeper does not block it. The launcher only downloads from this repository's releases and verifies the checksum first.
- Transparent windows use Tauri's `macOSPrivateApi` option, which means the app cannot be published on the Mac App Store. Distribution through GitHub is unaffected.

### Windows

- WebView2 is preinstalled on Windows 11 and on up-to-date Windows 10. If it is missing, install the [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
- The overlay cannot appear above games running in exclusive fullscreen. Windowed and borderless fullscreen work.

### iPad

An iPad version is planned as a web app you add to the Home Screen. iPadOS does not allow any app to draw over other apps, so it will work as a whiteboard and for annotating photos and screenshots.

## Build from source

Requirements: [Node.js](https://nodejs.org) 20+ and [Rust](https://rustup.rs). On Windows, Rust also needs the Visual Studio C++ Build Tools (rustup offers to install them). On macOS, it needs the Xcode Command Line Tools (`xcode-select --install`).

```sh
# Windows
run-windows.bat --build

# macOS
./run-macos.command --build
```

The launchers also fall back to building from source automatically when no release exists yet and Rust is installed.

## Development

```sh
npm install
npm run dev          # Drawing engine only, in a browser at http://localhost:1420
npx tauri dev        # Full desktop app with hot reload
npm test             # Unit tests (Vitest)
npm run typecheck
```

### Project layout

```
run-windows.bat        Windows launcher
run-macos.command      macOS launcher
src/
  core/                Shared drawing engine (no platform code)
  desktop/             Bridge to the Rust shell
  main.ts              Overlay page: input handling and rendering
src-tauri/
  src/main.rs          Overlay window, click-through, shortcuts, tray
  capabilities/        Allow-list of what the page may call
  tauri.conf.json
tests/                 Unit tests for the drawing engine
.github/workflows/     CI and release builds
```

### Releasing

1. Bump `version` in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
2. Push a tag: `git tag v0.1.0 && git push origin v0.1.0`.
3. The **Release** workflow builds Windows (x64) and macOS (universal) binaries, writes their checksums, and publishes them. The launchers pick up the new version on their next run.

## Known limitations (step 1)

- The overlay covers the primary display only. Multi-monitor support is planned.
- Whether the overlay shows above macOS apps in native fullscreen still needs testing.
