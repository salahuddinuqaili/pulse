use std::sync::Arc;

use tauri::State;

use crate::settings::{Settings, SettingsManager};
use crate::state::AppState;
use crate::types::{DeviceInfo, GpuSnapshot};

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
