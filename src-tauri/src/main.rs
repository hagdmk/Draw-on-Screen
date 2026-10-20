// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

const OVERLAY: &str = "overlay";

/// True while the overlay captures the mouse for drawing; false while clicks pass through.
struct DrawMode(AtomicBool);

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

fn apply_draw_mode(app: &AppHandle, drawing: bool) {
    app.state::<DrawMode>().0.store(drawing, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window(OVERLAY) {
        // Pass-through mode lets clicks reach the apps underneath while strokes stay visible.
        let _ = window.set_ignore_cursor_events(!drawing);
        if drawing {
            // Focus is needed so Esc and undo shortcuts reach the page.
            let _ = window.set_focus();
        }
    }
    let _ = app.emit("draw-mode", drawing);
}

fn toggle_draw_mode(app: &AppHandle) {
    let drawing = app.state::<DrawMode>().0.load(Ordering::SeqCst);
    apply_draw_mode(app, !drawing);
}

#[tauri::command]
fn get_draw_mode(state: State<'_, DrawMode>) -> bool {
    state.0.load(Ordering::SeqCst)
}

#[tauri::command]
fn set_draw_mode(app: AppHandle, drawing: bool) {
    apply_draw_mode(&app, drawing);
}

/// Stretches the overlay over the primary display. Multi-monitor support comes later.
fn cover_primary_monitor(window: &WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = window.primary_monitor()? {
        window.set_position(*monitor.position())?;
        window.set_size(*monitor.size())?;
    }
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Toggle drawing", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Draw on Screen")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_draw_mode(app),
            "quit" => app.exit(0),
            _ => {}
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
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if shortcut == &toggle_shortcut() {
                toggle_draw_mode(app);
            } else if shortcut == &quit_shortcut() {
                app.exit(0);
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(shortcuts)
        .manage(DrawMode(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![get_draw_mode, set_draw_mode])
        .setup(|app| {
            // Run as a background utility: no Dock icon on macOS.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app
                .get_webview_window(OVERLAY)
                .expect("overlay window is defined in tauri.conf.json");
            cover_primary_monitor(&window)?;
            // Keep the overlay on every desktop/Space, not just the one it opened on.
            window.set_visible_on_all_workspaces(true)?;
            window.set_ignore_cursor_events(true)?;
            window.show()?;

            build_tray(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Draw on Screen");
}
