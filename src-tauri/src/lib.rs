mod classify;
mod commands;
mod nvml;
mod poller;
mod process;
mod state;
mod types;

use std::sync::Arc;
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

    let app_state = Arc::new(state::AppState::new(nvml_available));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state::AppState::new(nvml_available))
        .setup(move |app| {
            if nvml_available {
                let handle = app.handle().clone();
                poller::start_polling(handle, app_state.clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_device_info,
            commands::get_current_snapshot,
            commands::set_polling_interval,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Pulse");
}
