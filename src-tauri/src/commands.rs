use std::sync::Arc;

use tauri::State;

use crate::recommendations::{self, ProfileMode, Recommendation};
use crate::session::{SessionIndex, SessionRecorder};
use crate::settings::{Settings, SettingsManager};
use crate::state::AppState;
use crate::types::{DeviceInfo, GpuSnapshot, SessionMetadata};

/// Get static device information (called once on frontend mount).
#[tauri::command]
pub fn get_device_info(state: State<Arc<AppState>>) -> Result<DeviceInfo, String> {
    if !state.nvml_available {
        return Err("NVML is not available — NVIDIA drivers may not be installed".to_string());
    }
    crate::nvml::get_device_info()
}

/// Get the latest GPU snapshot on demand (supplements event-driven updates).
#[tauri::command]
pub fn get_current_snapshot(state: State<Arc<AppState>>) -> GpuSnapshot {
    state.get_snapshot()
}

/// Update the polling interval (100–5000ms).
#[tauri::command]
pub fn set_polling_interval(state: State<Arc<AppState>>, interval_ms: u64) -> Result<(), String> {
    if !(100..=5000).contains(&interval_ms) {
        return Err("Polling interval must be between 100 and 5000 ms".to_string());
    }
    state.set_polling_interval(interval_ms);
    Ok(())
}

/// Get persisted settings.
#[tauri::command]
pub fn get_settings(settings_mgr: State<Arc<SettingsManager>>) -> Settings {
    settings_mgr.get()
}

/// Save settings and apply side effects (e.g., polling interval).
#[tauri::command]
pub fn save_settings(
    settings_mgr: State<Arc<SettingsManager>>,
    app_state: State<Arc<AppState>>,
    settings: Settings,
) -> Result<(), String> {
    // Apply polling interval change immediately
    let interval = settings.polling_interval_ms.clamp(100, 5000);
    app_state.set_polling_interval(interval);

    settings_mgr.update(settings)
}

/// Start a recording session.
#[tauri::command]
pub fn start_recording(
    recorder: State<Arc<SessionRecorder>>,
    interval_ms: u64,
    gpu_name: String,
    game_detected: Option<String>,
) -> Result<String, String> {
    recorder.start(interval_ms, gpu_name, game_detected)
}

/// Stop the active recording session.
#[tauri::command]
pub fn stop_recording(
    recorder: State<Arc<SessionRecorder>>,
    index: State<Arc<SessionIndex>>,
) -> Result<SessionMetadata, String> {
    let meta = recorder.stop()?;
    index.insert_session(&meta)?;
    Ok(meta)
}

/// List all recorded sessions.
#[tauri::command]
pub fn list_sessions(index: State<Arc<SessionIndex>>) -> Result<Vec<SessionMetadata>, String> {
    index.list_sessions()
}

/// Load full snapshot data from a recorded session.
#[tauri::command]
pub fn load_session(
    index: State<Arc<SessionIndex>>,
    session_id: String,
) -> Result<Vec<GpuSnapshot>, String> {
    index.load_session(&session_id)
}

/// Delete a recorded session (file + index entry).
#[tauri::command]
pub fn delete_session(
    index: State<Arc<SessionIndex>>,
    session_id: String,
) -> Result<(), String> {
    index.delete_session(&session_id)
}

/// List sessions within a time range.
#[tauri::command]
pub fn list_sessions_in_range(
    index: State<Arc<SessionIndex>>,
    start_ms: u64,
    end_ms: u64,
) -> Result<Vec<SessionMetadata>, String> {
    index.list_sessions_in_range(start_ms, end_ms)
}

/// Get smart workload recommendations based on the current GPU snapshot.
/// The profile mode is auto-detected from the running processes.
#[tauri::command]
pub fn get_recommendations(state: State<Arc<AppState>>) -> Vec<Recommendation> {
    let snapshot = state.get_snapshot();
    let mode = ProfileMode::detect(&snapshot.processes);
    recommendations::generate_recommendations(
        snapshot.vram_free_mb,
        snapshot.vram_total_mb,
        mode,
    )
}

/// Toggle the compact overlay window.
#[tauri::command]
pub fn toggle_compact_overlay(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    if let Some(overlay) = app.get_webview_window("overlay") {
        // Overlay exists — close it
        overlay.close().map_err(|e| format!("Failed to close overlay: {e}"))?;
    } else {
        // Create the overlay window
        let url = tauri::WebviewUrl::App("/overlay".into());
        tauri::WebviewWindowBuilder::new(&app, "overlay", url)
            .title("Pulse Compact")
            .inner_size(320.0, 480.0)
            .resizable(false)
            .always_on_top(true)
            .decorations(false)
            .transparent(true)
            .skip_taskbar(true)
            .build()
            .map_err(|e| format!("Failed to create overlay: {e}"))?;
    }
    Ok(())
}
