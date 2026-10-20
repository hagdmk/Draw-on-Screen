// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(target_os = "macos")]
use tauri::RunEvent;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewWindow, Wry};
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
    if let Some(window) = app.get_webview_window(OVERLAY) {
        // Pass-through mode lets clicks reach the apps underneath while strokes stay visible.
        let _ = window.set_ignore_cursor_events(!drawing);
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

/// Stretches the overlay over the primary display. Multi-monitor support comes later.
fn cover_primary_monitor(window: &WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = window.primary_monitor()? {
        window.set_position(*monitor.position())?;
        window.set_size(*monitor.size())?;
    }
    Ok(())
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
            get_autostart,
            set_autostart,
            minimize_toolbar,
            quit_app
        ])
        .setup(|app| {
            apply_autostart_default(app.handle());

            let overlay = app
                .get_webview_window(OVERLAY)
                .expect("overlay window is defined in tauri.conf.json");
            cover_primary_monitor(&overlay)?;
            // Keep the overlay on every desktop/Space, not just the one it opened on.
            overlay.set_visible_on_all_workspaces(true)?;
            overlay.set_ignore_cursor_events(true)?;
            overlay.show()?;

            let toolbar = app
                .get_webview_window(TOOLBAR)
                .expect("toolbar window is defined in tauri.conf.json");
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
