use std::sync::Arc;

use tauri::State;

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
