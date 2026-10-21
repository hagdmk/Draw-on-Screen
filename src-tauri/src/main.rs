// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;

use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(target_os = "macos")]
use tauri::RunEvent;
use tauri::utils::config::WindowConfig;
use tauri::{
    AppHandle, Emitter, Manager, Monitor, PhysicalPosition, State, WebviewWindow,
    WebviewWindowBuilder, Wry,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const OVERLAY: &str = "overlay";
const TOOLBAR: &str = "toolbar";
/// Created after the first launch so the autostart default is applied only once.
const AUTOSTART_MARKER: &str = "autostart-initialized";
/// Number keys 1-8 pick toolbar tools while drawing.
const TOOL_KEYS: [Code; 8] = [
    Code::Digit1,
    Code::Digit2,
    Code::Digit3,
    Code::Digit4,
    Code::Digit5,
    Code::Digit6,
    Code::Digit7,
    Code::Digit8,
];

/// True while the overlay captures the mouse for drawing; false while clicks pass through.
struct DrawMode(AtomicBool);

/// Where an overlay sits in desktop coordinates, the space shared by all screens: the
/// overlay's client point (cx, cy) is the desktop point (x + cx * k, y + cy * k).
#[derive(Clone, Serialize)]
struct OverlayGeometry {
    x: f64,
    y: f64,
    /// Desktop units per CSS pixel; 1 unless screens use different scaling.
    k: f64,
}

/// One overlay window per screen, by label.
struct Overlays(HashMap<String, OverlayGeometry>);

/// The tray's "Launch at startup" item, kept so its check mark can follow the toolbar setting.
struct AutostartMenuItem(CheckMenuItem<Wry>);

#[cfg(target_os = "macos")]
const PRIMARY_MOD: Modifiers = Modifiers::SUPER;
#[cfg(not(target_os = "macos"))]
const PRIMARY_MOD: Modifiers = Modifiers::CONTROL;

fn toggle_shortcut() -> Shortcut {
    Shortcut::new(Some(PRIMARY_MOD | Modifiers::SHIFT), Code::KeyD)
}

fn quit_shortcut() -> Shortcut {
    Shortcut::new(Some(PRIMARY_MOD | Modifiers::SHIFT), Code::KeyQ)
}

/// What a key pressed while drawing should do.
enum DrawingKey {
    Exit,
    Command(&'static str),
    Tool(usize),
}

/// Keys that only belong to this app while drawing. The overlay never takes keyboard focus
/// (so it can't cover the toolbar), so these are registered as global shortcuts instead.
fn drawing_shortcuts() -> Vec<(Shortcut, DrawingKey)> {
    let mut keys = vec![
        (Shortcut::new(None, Code::Escape), DrawingKey::Exit),
        (Shortcut::new(Some(PRIMARY_MOD), Code::KeyZ), DrawingKey::Command("undo")),
        (Shortcut::new(Some(PRIMARY_MOD | Modifiers::SHIFT), Code::KeyZ), DrawingKey::Command("redo")),
        (Shortcut::new(Some(PRIMARY_MOD), Code::KeyY), DrawingKey::Command("redo")),
        (Shortcut::new(None, Code::Delete), DrawingKey::Command("clear")),
    ];
    for (index, code) in TOOL_KEYS.into_iter().enumerate() {
        keys.push((Shortcut::new(None, code), DrawingKey::Tool(index)));
    }
    keys
}

fn handle_shortcut(app: &AppHandle, shortcut: &Shortcut) {
    if shortcut == &toggle_shortcut() {
        toggle_draw_mode(app);
        return;
    }
    if shortcut == &quit_shortcut() {
        app.exit(0);
        return;
    }
    let Some((_, key)) = drawing_shortcuts().into_iter().find(|(s, _)| s == shortcut) else {
        return;
    };
    match key {
        DrawingKey::Exit => apply_draw_mode(app, false),
        DrawingKey::Command(name) => {
            let _ = app.emit("command", name);
        }
        DrawingKey::Tool(index) => {
            let _ = app.emit("tool-shortcut", index);
        }
    }
}

fn apply_draw_mode(app: &AppHandle, drawing: bool) {
    let was_drawing = app.state::<DrawMode>().0.swap(drawing, Ordering::SeqCst);
    if let Some(overlays) = app.try_state::<Overlays>() {
        for label in overlays.0.keys() {
            if let Some(window) = app.get_webview_window(label) {
                // Pass-through mode lets clicks reach the apps underneath while strokes stay visible.
                let _ = window.set_ignore_cursor_events(!drawing);
            }
        }
    }
    if drawing != was_drawing {
        let shortcuts = app.global_shortcut();
        for (shortcut, _) in drawing_shortcuts() {
            // A key another app already owns is skipped; the toolbar buttons still work.
            let _ = if drawing { shortcuts.register(shortcut) } else { shortcuts.unregister(shortcut) };
        }
    }
    let _ = app.emit("draw-mode", drawing);
}

fn toggle_draw_mode(app: &AppHandle) {
    let drawing = app.state::<DrawMode>().0.load(Ordering::SeqCst);
    apply_draw_mode(app, !drawing);
}

fn show_toolbar(app: &AppHandle) {
    if let Some(toolbar) = app.get_webview_window(TOOLBAR) {
        let _ = toolbar.unminimize();
        let _ = toolbar.show();
        let _ = toolbar.set_focus();
    }
}

fn autostart_enabled(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Turns launch-at-startup on or off and returns the state the system actually ended up in.
fn change_autostart(app: &AppHandle, enabled: bool) -> bool {
    let manager = app.autolaunch();
    let _ = if enabled { manager.enable() } else { manager.disable() };
    let actual = autostart_enabled(app);
    if let Some(item) = app.try_state::<AutostartMenuItem>() {
        let _ = item.0.set_checked(actual);
    }
    let _ = app.emit("autostart", actual);
    actual
}

/// Launch at startup is on by default: enable it on the very first run only, so a user
/// who turns it off later keeps it off.
fn apply_autostart_default(app: &AppHandle) {
    let Ok(dir) = app.path().app_config_dir() else { return };
    let marker = dir.join(AUTOSTART_MARKER);
    if marker.exists() {
        return;
    }
    let _ = app.autolaunch().enable();
    let _ = std::fs::create_dir_all(&dir).and_then(|_| std::fs::write(&marker, b""));
}

#[tauri::command]
fn get_draw_mode(state: State<'_, DrawMode>) -> bool {
    state.0.load(Ordering::SeqCst)
}

#[tauri::command]
fn set_draw_mode(app: AppHandle, drawing: bool) {
    apply_draw_mode(&app, drawing);
}

#[tauri::command]
fn overlay_geometry(window: WebviewWindow, overlays: State<'_, Overlays>) -> Option<OverlayGeometry> {
    overlays.0.get(window.label()).cloned()
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> bool {
    autostart_enabled(&app)
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> bool {
    change_autostart(&app, enabled)
}

#[tauri::command]
fn minimize_toolbar(app: AppHandle) {
    if let Some(toolbar) = app.get_webview_window(TOOLBAR) {
        let _ = toolbar.minimize();
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn window_config(app: &AppHandle, label: &str) -> WindowConfig {
    app.config()
        .app
        .windows
        .iter()
        .find(|window| window.label == label)
        .unwrap_or_else(|| panic!("{label} window is defined in tauri.conf.json"))
        .clone()
}

/// Desktop coordinates for a screen. macOS reports screen positions consistently in points;
/// Windows reports physical pixels, which are divided by the primary screen's scale so one
/// desktop unit matches a CSS pixel on the primary screen.
fn desktop_geometry(monitor: &Monitor, primary_scale: f64) -> OverlayGeometry {
    #[cfg(target_os = "macos")]
    let unit = {
        let _ = primary_scale;
        monitor.scale_factor()
    };
    #[cfg(not(target_os = "macos"))]
    let unit = primary_scale;
    let position = monitor.position();
    OverlayGeometry {
        x: f64::from(position.x) / unit,
        y: f64::from(position.y) / unit,
        k: monitor.scale_factor() / unit,
    }
}

/// Stretches an overlay over one screen.
fn cover_monitor(window: &WebviewWindow, monitor: &Monitor) -> tauri::Result<()> {
    // macOS converts physical values with the scale of the screen the window is on now, which
    // is wrong for a screen with a different scale, so it gets the screen's own logical rect.
    #[cfg(target_os = "macos")]
    {
        let scale = monitor.scale_factor();
        window.set_position(monitor.position().to_logical::<f64>(scale))?;
        window.set_size(monitor.size().to_logical::<f64>(scale))?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        window.set_position(*monitor.position())?;
        window.set_size(*monitor.size())?;
    }
    Ok(())
}

/// Opens one overlay per screen, primary screen first, and returns them in that order.
/// Screens plugged in later are picked up on the next launch.
fn create_overlays(app: &AppHandle) -> tauri::Result<Vec<WebviewWindow>> {
    let primary = app.primary_monitor()?;
    let primary_scale = primary.as_ref().map_or(1.0, Monitor::scale_factor);
    let mut monitors = app.available_monitors()?;
    if let Some(primary) = &primary {
        monitors.sort_by_key(|monitor| monitor.position() != primary.position());
    }
    let screens: Vec<Option<Monitor>> = if monitors.is_empty() {
        vec![None]
    } else {
        monitors.into_iter().map(Some).collect()
    };
    let label = |index: usize| {
        if index == 0 {
            OVERLAY.to_string()
        } else {
            format!("{OVERLAY}-{index}")
        }
    };

    // Registered before any overlay page loads and asks for its geometry.
    let geometry = screens
        .iter()
        .enumerate()
        .map(|(index, screen)| {
            let geometry = match screen {
                Some(monitor) => desktop_geometry(monitor, primary_scale),
                None => OverlayGeometry { x: 0.0, y: 0.0, k: 1.0 },
            };
            (label(index), geometry)
        })
        .collect();
    app.manage(Overlays(geometry));

    let config = window_config(app, OVERLAY);
    let mut overlays: Vec<WebviewWindow> = Vec::new();
    for (index, screen) in screens.iter().enumerate() {
        let mut overlay_config = config.clone();
        overlay_config.label = label(index);
        let builder = WebviewWindowBuilder::from_config(app, &overlay_config)?;
        // On Windows each overlay is owned by the previous one and the toolbar by the last
        // (see `create_toolbar`). Owned windows always stay above their owner, so the toolbar
        // stays above every overlay.
        #[cfg(windows)]
        let builder = match overlays.last() {
            Some(owner) => builder.parent(owner)?,
            None => builder,
        };
        let overlay = builder.build()?;
        if let Some(monitor) = screen {
            cover_monitor(&overlay, monitor)?;
        }
        // Keep the overlay on every desktop/Space, not just the one it opened on.
        overlay.set_visible_on_all_workspaces(true)?;
        overlay.set_ignore_cursor_events(true)?;
        overlay.show()?;
        overlays.push(overlay);
    }
    Ok(overlays)
}

/// Places the toolbar at the right edge of the primary display, vertically centered.
fn place_toolbar(toolbar: &WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = toolbar.primary_monitor()? {
        let area = monitor.size();
        let origin = monitor.position();
        let size = toolbar.outer_size()?;
        let margin = (16.0 * monitor.scale_factor()) as i32;
        let x = origin.x + area.width as i32 - size.width as i32 - margin;
        let y = origin.y + (area.height as i32 - size.height as i32) / 2;
        toolbar.set_position(PhysicalPosition::new(x, y))?;
    }
    Ok(())
}

/// Creates the toolbar from its tauri.conf.json entry (marked `create: false`), above `overlay`,
/// the last overlay `create_overlays` opened.
fn create_toolbar(app: &AppHandle, overlay: &WebviewWindow) -> tauri::Result<WebviewWindow> {
    let builder = WebviewWindowBuilder::from_config(app, &window_config(app, TOOLBAR))?;
    // On Windows an overlay is raised above other always-on-top windows whenever it takes
    // focus, e.g. when a stroke starts. An owned window always stays above its owner, so
    // making the last overlay the toolbar's owner keeps the toolbar clickable while drawing.
    #[cfg(windows)]
    let builder = builder.parent(overlay)?;
    let toolbar = builder.build()?;
    // Owned windows get no taskbar button by default; add it back.
    #[cfg(windows)]
    let _ = toolbar.set_skip_taskbar(false);
    #[cfg(target_os = "macos")]
    lift_above(&toolbar, overlay);
    #[cfg(not(any(windows, target_os = "macos")))]
    let _ = overlay;
    Ok(toolbar)
}

/// Puts `window` one window level above `below`. On macOS both windows start on the floating
/// level, where clicking the overlay brings it to the front and covers the toolbar; a higher
/// level keeps the toolbar on top no matter which window was clicked last.
#[cfg(target_os = "macos")]
fn lift_above(window: &WebviewWindow, below: &WebviewWindow) {
    use objc2::{msg_send, runtime::AnyObject};
    let (Ok(window), Ok(below)) = (window.ns_window(), below.ns_window()) else {
        return;
    };
    // SAFETY: both pointers are live NSWindow objects owned by Tauri, and `setup` runs on the
    // main thread, as AppKit requires.
    unsafe {
        let window = &*(window as *const AnyObject);
        let below = &*(below as *const AnyObject);
        let level: isize = msg_send![below, level];
        let _: () = msg_send![window, setLevel: level + 1];
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show toolbar", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Toggle drawing", true, None::<&str>)?;
    let autostart =
        CheckMenuItem::with_id(app, "autostart", "Launch at startup", true, autostart_enabled(app), None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &autostart, &quit])?;
    app.manage(AutostartMenuItem(autostart));

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Draw on Screen")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_toolbar(app),
            "toggle" => toggle_draw_mode(app),
            "autostart" => {
                let enabled = !autostart_enabled(app);
                change_autostart(app, enabled);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_toolbar(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn main() {
    let shortcuts = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts([toggle_shortcut(), quit_shortcut()])
        .expect("valid shortcut definitions")
        .with_handler(|app, shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                handle_shortcut(app, shortcut);
            }
        })
        .build();

    let app = tauri::Builder::default()
        // Must be registered first: a second launch (icon, autostart) just brings up the toolbar.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_toolbar(app)))
        .plugin(shortcuts)
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(DrawMode(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![
            get_draw_mode,
            set_draw_mode,
            overlay_geometry,
            get_autostart,
            set_autostart,
            minimize_toolbar,
            quit_app
        ])
        .setup(|app| {
            apply_autostart_default(app.handle());

            let overlays = create_overlays(app.handle())?;
            let last_overlay = overlays.last().expect("at least one overlay is created");
            let toolbar = create_toolbar(app.handle(), last_overlay)?;
            toolbar.set_visible_on_all_workspaces(true)?;
            place_toolbar(&toolbar)?;
            toolbar.show()?;

            build_tray(app.handle())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Draw on Screen");

    app.run(|app, event| {
        // Clicking the Dock icon on macOS brings the toolbar back if it was minimized.
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = event {
            show_toolbar(app);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}
