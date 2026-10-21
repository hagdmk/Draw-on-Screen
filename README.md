# Draw on Screen

A lightweight screen annotation tool for macOS and Windows. Draw on top of anything on your screen, then switch back to clicking through to the apps underneath, without losing what you drew.

Built with [Tauri 2](https://tauri.app): the drawing engine is TypeScript on an HTML canvas, and the native shell is Rust using the operating system's own web view (WebView2 on Windows, WKWebView on macOS). No browser engine is bundled, so the app stays small and light on memory.

> **Status:** steps 1 to 3 of the development plan, plus parts of 5 and 6: overlay with click-through, floating toolbar, pen, brush, highlighter, line, arrow, rectangle, ellipse, eraser, colors including rainbow, three thicknesses, undo/redo, launch at startup. Text boxes, auto-erase, selection and image export come next.

## Install

```sh
git clone https://github.com/hagdmk/draw-on-screen.git
cd draw-on-screen
```

Then run the one file for your system:

| System | Run | Requirements |
| --- | --- | --- |
| Windows 10 (1803+) / 11 | Double-click `run-windows.bat` | None |
| macOS 11+ (Apple Silicon or Intel) | Double-click `run-macos.command` | None |

The launcher downloads the latest prebuilt app from [Releases](https://github.com/hagdmk/draw-on-screen/releases), checks its SHA-256 checksum, installs it for your user account (no admin rights), and starts it:

- **Windows:** installed to `%LOCALAPPDATA%\Programs\Draw on Screen`, with a Start menu entry and a desktop icon.
- **macOS:** installed to `~/Applications`, so it shows up in Launchpad and Spotlight.

After that, start it from the icon like any other app. To update, `git pull` and run the launcher again. To remove everything, run it with `--uninstall`.

If you downloaded the repository as a ZIP instead of cloning it, macOS drops the executable flag. Restore it once:

```sh
chmod +x run-macos.command
```

## Using it

A floating toolbar appears at the right edge of the screen and in the taskbar (Dock on macOS), so you can always see that the app is running. Drag it by the bar at the top; the dash button minimizes it.

- Pick a tool to start drawing. The **Draw** button switches between drawing and click-through: in click-through mode your drawing stays visible but clicks go to the apps underneath.
- Tools: pen, brush, highlighter, line, arrow, rectangle, ellipse, eraser (removes whole strokes). Hold `Shift` for straight 45-degree lines, squares and circles.
- Colors: eight presets, rainbow, and a custom color picker. Three thicknesses.
- You can draw on every connected screen. Undo, redo and clear apply to all of them.
- The gear button opens **Settings**:
  - **Screens**: **One screen** keeps each stroke on the screen where it started, so it stops at the screen edge. **All screens** (the default) lets a stroke or shape carry on when the pointer moves to another screen.
  - **Launch at startup** (on by default; your choice is kept).
  - **Quit**.

The tray icon (Windows notification area, macOS menu bar) has the same options plus **Show toolbar**.

### Shortcuts

| Action | Windows | macOS |
| --- | --- | --- |
| Start / stop drawing | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Stop drawing | `Esc` | `Esc` |
| Pick a tool (while drawing) | `1` to `8` | `1` to `8` |
| Undo | `Ctrl+Z` | `Cmd+Z` |
| Redo | `Ctrl+Y` or `Ctrl+Shift+Z` | `Cmd+Shift+Z` |
| Clear everything | `Delete` | `Delete` |
| Quit | `Ctrl+Shift+Q` | `Cmd+Shift+Q` |

`Esc`, the number keys, undo/redo and `Delete` belong to Draw on Screen only while drawing; in click-through mode they go to your other apps as usual.

## Platform notes

### macOS

- Drawing and global shortcuts need no special permission. Saving a screenshot that includes the screen behind your drawing (a later step) will ask for **Screen Recording** permission in System Settings > Privacy & Security.
- Launch at startup adds a Launch Agent in `~/Library/LaunchAgents`.
- The release app is ad-hoc signed, not notarized. Because the launcher downloads it with `curl`, macOS does not mark it as quarantined and Gatekeeper does not block it. The launcher only downloads from this repository's releases and verifies the checksum first.
- Transparent windows use Tauri's `macOSPrivateApi` option, which means the app cannot be published on the Mac App Store. Distribution through GitHub is unaffected.

### Windows

- WebView2 is preinstalled on Windows 11 and on up-to-date Windows 10. If it is missing, install the [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
- Launch at startup adds an entry under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`; you can also see it in Task Manager > Startup apps.
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

This builds the app and installs it the same way as a downloaded release. The launchers also fall back to building from source automatically when no release exists yet and Rust is installed.

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
run-windows.bat        Windows installer/launcher
run-macos.command      macOS installer/launcher
src/
  core/                Shared drawing engine (no platform code)
  desktop/             Bridge to the Rust shell
  main.ts              Overlay page: input handling and rendering
  toolbar.ts           Floating toolbar page
src-tauri/
  src/main.rs          Windows, click-through, shortcuts, tray, launch at startup
  capabilities/        Allow-list of what the page may call
  tauri.conf.json
tests/                 Unit tests for the drawing engine
.github/workflows/     CI and release builds
```

### Releasing

1. Bump `version` in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
2. Push a tag: `git tag v0.1.0 && git push origin v0.1.0`.
3. The **Release** workflow builds Windows (x64) and macOS (universal) binaries, writes their checksums, and publishes them. The launchers pick up the new version on their next run.

## Known limitations

- Screens connected or disconnected while the app runs are picked up on the next launch.
- Whether the overlay shows above macOS apps in native fullscreen still needs testing.
