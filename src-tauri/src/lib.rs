mod classify;
mod commands;
mod mcp;
mod mcp_handler;
mod notifications;
mod nvml;
mod poller;
mod presentmon;
mod presentmon_download;
mod process;
mod recommendations;
mod session;
mod settings;
mod state;
mod tray;
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
    let mcp_app_state = app_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .setup(move |app| {
            // Initialise settings from %APPDATA%/Pulse/settings.json
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            let settings_mgr = Arc::new(settings::SettingsManager::new(app_data_dir));

            // Apply persisted polling interval
            let saved = settings_mgr.get();
            poller_state.set_polling_interval(saved.polling_interval_ms.clamp(100, 5000));

            app.manage(settings_mgr.clone());

            // Notification manager — shared with poller for threshold alerts
            let notification_mgr = Arc::new(notifications::NotificationManager::new());
            app.manage(notification_mgr.clone());

            // MCP server — opt-in via settings.mcp_enabled
            let mcp_server = Arc::new(mcp::McpServer::new(saved.mcp_port));
            app.manage(mcp_server.clone());
            if saved.mcp_enabled {
                let mcp_clone = mcp_server.clone();
                let mcp_state = mcp_app_state.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = mcp_clone.start(mcp_state).await {
                        warn!("Failed to start MCP server at boot: {e}");
                    }
                });
            }

            // Initialise session recording
            let sessions_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory")
                .join("sessions");
            let session_recorder = Arc::new(session::SessionRecorder::new(sessions_dir.clone()));
            let session_index = Arc::new(
                session::SessionIndex::new(sessions_dir)
                    .expect("Failed to initialise session index")
            );
            app.manage(session_recorder.clone());
            app.manage(session_index);

            // Set up system tray
            if let Err(e) = tray::setup_tray(app) {
                warn!("System tray setup failed: {e}");
            }

            // PresentMon download manager — owns the binary at %APPDATA%/Pulse/bin/.
            // The binary is NOT bundled in the installer; users opt in via Settings,
            // which triggers a SHA-256-verified download from Intel's GitHub releases.
            // See SECURITY.md F-14 and presentmon_download.rs for the rationale.
            let presentmon_download_mgr = Arc::new(
                presentmon_download::PresentMonDownloadManager::new(
                    app.path().app_data_dir()
                        .expect("Failed to resolve app data directory"),
                ),
            );
            app.manage(presentmon_download_mgr.clone());

            if nvml_available {
                let handle = app.handle().clone();
                let presentmon_mgr = std::sync::Arc::new(
                    presentmon::PresentMonManager::new(presentmon_download_mgr.clone()),
                );
                poller::start_polling(
                    handle,
                    poller_state,
                    presentmon_mgr,
                    session_recorder,
                    notification_mgr,
                    settings_mgr,
                );
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_device_info,
            commands::get_current_snapshot,
            commands::set_polling_interval,
            commands::get_settings,
            commands::save_settings,
            commands::toggle_compact_overlay,
            commands::start_recording,
            commands::stop_recording,
            commands::list_sessions,
            commands::load_session,
            commands::delete_session,
            commands::list_sessions_in_range,
            commands::get_recommendations,
            commands::toggle_mcp,
            commands::get_mcp_status,
            commands::set_mcp_port,
            commands::get_presentmon_status,
            commands::download_presentmon,
            commands::delete_presentmon,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run Pulse");
}
