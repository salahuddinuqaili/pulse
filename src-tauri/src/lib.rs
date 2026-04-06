mod classify;
mod commands;
mod nvml;
mod poller;
mod process;
mod settings;
mod state;
mod types;

use std::sync::Arc;
use tauri::Manager;
use tracing::warn;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    // Try to initialise NVML — if it fails, the app still launches with an error state
    let nvml_available = match nvml::init() {
        Ok(()) => true,
        Err(e) => {
            warn!("NVML unavailable: {e}");
            false
        }
    };

    // Single shared state — poller and commands both use the same Arc<AppState>
    let app_state = Arc::new(state::AppState::new(nvml_available));
    let poller_state = app_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .setup(move |app| {
            // Initialise settings from %APPDATA%/Pulse/settings.json
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            let settings_mgr = Arc::new(settings::SettingsManager::new(app_data_dir));

            // Apply persisted polling interval
            let saved = settings_mgr.get();
            poller_state.set_polling_interval(saved.polling_interval_ms.clamp(100, 5000));

            app.manage(settings_mgr);

            if nvml_available {
                let handle = app.handle().clone();
                poller::start_polling(handle, poller_state);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_device_info,
            commands::get_current_snapshot,
            commands::set_polling_interval,
            commands::get_settings,
            commands::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Pulse");
}
