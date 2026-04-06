use std::sync::Arc;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use tracing::{error, info};

use crate::state::AppState;

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItemBuilder::new("Show Pulse").id("show").build(app)?;
    let settings = MenuItemBuilder::new("Settings").id("settings").build(app)?;
    let quit = MenuItemBuilder::new("Quit").id("quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show, &settings, &quit])
        .build()?;

    let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))
        .expect("Failed to load tray icon");

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("Pulse — GPU Monitor")
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => restore_main_window(app),
                "settings" => {
                    restore_main_window(app);
                    // Navigation handled by frontend
                }
                "quit" => {
                    info!("Quit requested from tray");
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                ..
            } = event
            {
                restore_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn restore_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Update the tray tooltip with current GPU stats. Called from the poller.
pub fn update_tray_tooltip(app: &AppHandle, state: &Arc<AppState>) {
    let snapshot = state.get_snapshot();
    let tooltip = format!(
        "GPU: {}% | VRAM: {:.1}/{:.1} GB | Temp: {}°C",
        snapshot.gpu_utilization,
        snapshot.vram_used_mb as f32 / 1024.0,
        snapshot.vram_total_mb as f32 / 1024.0,
        snapshot.temperature_c,
    );

    if let Some(tray) = app.tray_by_id("main")
        && let Err(e) = tray.set_tooltip(Some(&tooltip))
    {
        error!("Failed to update tray tooltip: {e}");
    }
}
