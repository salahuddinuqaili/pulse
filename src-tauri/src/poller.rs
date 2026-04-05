use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter};
use tokio::time::interval;
use tracing::{error, info, warn};

use crate::nvml;
use crate::process;
use crate::state::AppState;
use crate::types::GpuSnapshot;

/// Start the tiered polling loops.
/// - Fast loop (1s): utilization, VRAM, temp, power, clocks
/// - Medium (every 2nd tick): per-process VRAM
/// - Slow (every 5th tick): fan speed, PCIe info
pub fn start_polling(app_handle: AppHandle, state: Arc<AppState>) {
    tokio::spawn(async move {
        info!("Starting GPU polling loop");
        let mut tick_count: u64 = 0;
        let mut poll_interval = interval(Duration::from_millis(state.get_polling_interval()));

        // Cache slow-changing data
        let mut cached_fan_speed: Option<u32> = None;
        let mut cached_pcie_gen: Option<u8> = None;
        let mut cached_pcie_width: Option<u8> = None;
        let mut cached_processes: Vec<crate::types::ProcessInfo> = Vec::new();

        loop {
            poll_interval.tick().await;
            tick_count += 1;

            let generation = state.next_generation();
            let timestamp_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            let mut errors: Vec<String> = Vec::new();

            // === Fast tier (every tick): core GPU metrics ===
            let (gpu_util, mem_util) = match nvml::get_utilization() {
                Ok(v) => v,
                Err(e) => { errors.push(e); (0, 0) }
            };

            let (vram_total, vram_used, vram_free) = match nvml::get_memory_info() {
                Ok(v) => v,
                Err(e) => { errors.push(e); (0, 0, 0) }
            };

            let temperature_c = match nvml::get_temperature() {
                Ok(v) => v,
                Err(e) => { errors.push(e); 0 }
            };

            let (power_draw_w, power_limit_w) = match nvml::get_power() {
                Ok(v) => v,
                Err(e) => { errors.push(e); (0.0, 0.0) }
            };

            let (clock_graphics, clock_memory) = match nvml::get_clocks() {
                Ok(v) => v,
                Err(e) => { errors.push(e); (0, 0) }
            };

            // === Medium tier (every 2nd tick): process info ===
            if tick_count % 2 == 0 {
                match process::get_gpu_processes() {
                    Ok(procs) => cached_processes = procs,
                    Err(e) => {
                        warn!("Process enumeration failed: {e}");
                        errors.push(e);
                    }
                }
            }

            // === Slow tier (every 5th tick): fan, PCIe ===
            if tick_count % 5 == 0 {
                cached_fan_speed = nvml::get_fan_speed();
                let (gen, width) = nvml::get_pcie_info();
                cached_pcie_gen = gen;
                cached_pcie_width = width;
            }

            let snapshot = GpuSnapshot {
                poll_generation: generation,
                timestamp_ms,
                gpu_utilization: gpu_util,
                memory_utilization: mem_util,
                vram_total_mb: vram_total,
                vram_used_mb: vram_used,
                vram_free_mb: vram_free,
                temperature_c,
                temperature_hotspot_c: None, // Not all GPUs; future enhancement
                fan_speed_pct: cached_fan_speed,
                fan_speed_rpm: None, // RPM requires specific fan index queries
                power_draw_w,
                power_limit_w,
                clock_graphics_mhz: clock_graphics,
                clock_memory_mhz: clock_memory,
                pcie_link_gen: cached_pcie_gen,
                pcie_link_width: cached_pcie_width,
                processes: cached_processes.clone(),
                errors: errors.clone(),
            };

            state.update_snapshot(snapshot.clone());

            if let Err(e) = app_handle.emit("gpu-snapshot", &snapshot) {
                error!("Failed to emit gpu-snapshot: {e}");
            }

            // Dynamically adjust interval if user changed it
            let current_interval = state.get_polling_interval();
            let period = poll_interval.period();
            if period.as_millis() as u64 != current_interval {
                poll_interval = interval(Duration::from_millis(current_interval));
                info!("Polling interval changed to {current_interval}ms");
            }
        }
    });
}
