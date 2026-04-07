use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tracing::{debug, warn};

use crate::settings::NotificationSettings;
use crate::types::{GpuSnapshot, ProcessCategory, ProcessInfo};

/// Window over which we track the maximum observed graphics clock for thermal throttle detection.
const CLOCK_HISTORY_WINDOW_SECS: u64 = 60;
/// Fraction of max clock at or below which we consider the GPU to be throttled.
const THROTTLE_CLOCK_RATIO: f32 = 0.85;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AlertKind {
    VramThreshold,
    TempWarning,
    TempCritical,
    ThermalThrottle,
    AiProcessStarted,
    AiProcessStopped,
}

impl AlertKind {
    fn cooldown_key(&self, suffix: &str) -> String {
        let kind = match self {
            AlertKind::VramThreshold => "vram",
            AlertKind::TempWarning => "temp_warn",
            AlertKind::TempCritical => "temp_crit",
            AlertKind::ThermalThrottle => "thermal_throttle",
            AlertKind::AiProcessStarted => "ai_start",
            AlertKind::AiProcessStopped => "ai_stop",
        };
        if suffix.is_empty() {
            kind.to_string()
        } else {
            format!("{kind}:{suffix}")
        }
    }
}

/// Recent (clock_mhz, observed_at) samples used to compute the rolling max clock.
struct ClockSample {
    clock_mhz: u32,
    observed_at: Instant,
}

pub struct NotificationManager {
    cooldowns: Mutex<HashMap<String, Instant>>,
    clock_history: Mutex<Vec<ClockSample>>,
}

impl NotificationManager {
    pub fn new() -> Self {
        Self {
            cooldowns: Mutex::new(HashMap::new()),
            clock_history: Mutex::new(Vec::new()),
        }
    }

    /// Inspect the current snapshot, fire any alerts whose cooldowns have elapsed.
    /// `prev_processes` is the previous tick's process list, used to detect AI start/stop events.
    pub fn check_and_notify(
        &self,
        app_handle: &AppHandle,
        snapshot: &GpuSnapshot,
        prev_processes: &[ProcessInfo],
        settings: &NotificationSettings,
        temp_warning_c: u32,
        temp_critical_c: u32,
    ) {
        if !settings.enabled {
            return;
        }

        // Track clock history regardless of which alerts are enabled — used by throttle detection.
        let max_clock = self.update_clock_history(snapshot.clock_graphics_mhz);

        // VRAM threshold
        if settings.vram_alert && snapshot.vram_total_mb > 0 {
            let pct = (snapshot.vram_used_mb as f32 / snapshot.vram_total_mb as f32) * 100.0;
            if pct >= settings.vram_threshold_pct as f32 {
                self.fire(
                    app_handle,
                    settings,
                    AlertKind::VramThreshold,
                    "",
                    "Pulse — VRAM Pressure",
                    &format!(
                        "VRAM at {:.0}% ({} / {} MB)",
                        pct, snapshot.vram_used_mb, snapshot.vram_total_mb
                    ),
                );
            }
        }

        // Temperature critical
        if settings.temp_critical_alert && snapshot.temperature_c >= temp_critical_c {
            self.fire(
                app_handle,
                settings,
                AlertKind::TempCritical,
                "",
                "Pulse — Critical Temperature",
                &format!(
                    "GPU at {}°C — exceeds critical threshold of {}°C",
                    snapshot.temperature_c, temp_critical_c
                ),
            );
        } else if settings.temp_warning_alert && snapshot.temperature_c >= temp_warning_c {
            // Only fire warning if not already in critical territory
            self.fire(
                app_handle,
                settings,
                AlertKind::TempWarning,
                "",
                "Pulse — High Temperature",
                &format!(
                    "GPU at {}°C — exceeds warning threshold of {}°C",
                    snapshot.temperature_c, temp_warning_c
                ),
            );
        }

        // Thermal throttle: clock dropped while temp is high
        if settings.thermal_throttle
            && max_clock > 0
            && snapshot.temperature_c >= temp_warning_c
        {
            let throttle_floor = (max_clock as f32 * THROTTLE_CLOCK_RATIO) as u32;
            if snapshot.clock_graphics_mhz < throttle_floor {
                self.fire(
                    app_handle,
                    settings,
                    AlertKind::ThermalThrottle,
                    "",
                    "Pulse — Thermal Throttling",
                    &format!(
                        "Clock dropped to {} MHz (peak {} MHz) at {}°C",
                        snapshot.clock_graphics_mhz, max_clock, snapshot.temperature_c
                    ),
                );
            }
        }

        // AI process start/stop diffing
        if settings.ai_process_events {
            self.check_ai_process_events(app_handle, settings, &snapshot.processes, prev_processes);
        }
    }

    fn check_ai_process_events(
        &self,
        app_handle: &AppHandle,
        settings: &NotificationSettings,
        current: &[ProcessInfo],
        previous: &[ProcessInfo],
    ) {
        let prev_ai: HashSet<&str> = previous
            .iter()
            .filter(|p| matches!(p.category, ProcessCategory::Ai))
            .map(|p| p.name.as_str())
            .collect();
        let curr_ai: HashSet<&str> = current
            .iter()
            .filter(|p| matches!(p.category, ProcessCategory::Ai))
            .map(|p| p.name.as_str())
            .collect();

        for started in curr_ai.difference(&prev_ai) {
            self.fire(
                app_handle,
                settings,
                AlertKind::AiProcessStarted,
                started,
                "Pulse — AI Workload Started",
                &format!("{started} is now running"),
            );
        }

        for stopped in prev_ai.difference(&curr_ai) {
            self.fire(
                app_handle,
                settings,
                AlertKind::AiProcessStopped,
                stopped,
                "Pulse — AI Workload Ended",
                &format!("{stopped} has exited"),
            );
        }
    }

    /// Insert a new clock sample, prune anything older than the rolling window, return the max.
    fn update_clock_history(&self, clock_mhz: u32) -> u32 {
        let mut history = self.clock_history.lock().unwrap();
        let now = Instant::now();
        history.push(ClockSample {
            clock_mhz,
            observed_at: now,
        });
        let cutoff = now - Duration::from_secs(CLOCK_HISTORY_WINDOW_SECS);
        history.retain(|s| s.observed_at >= cutoff);
        history.iter().map(|s| s.clock_mhz).max().unwrap_or(0)
    }

    /// Send a notification if the cooldown for this alert key has elapsed.
    fn fire(
        &self,
        app_handle: &AppHandle,
        settings: &NotificationSettings,
        kind: AlertKind,
        suffix: &str,
        title: &str,
        body: &str,
    ) {
        let key = kind.cooldown_key(suffix);
        let now = Instant::now();
        let mut cooldowns = self.cooldowns.lock().unwrap();
        if let Some(last) = cooldowns.get(&key)
            && now.duration_since(*last) < Duration::from_secs(settings.cooldown_secs)
        {
            return;
        }
        cooldowns.insert(key, now);
        drop(cooldowns);

        debug!("Firing notification: {title} — {body}");
        if let Err(e) = app_handle
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
        {
            warn!("Failed to show notification: {e}");
        }
    }
}

impl Default for NotificationManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clock_history_tracks_max_in_window() {
        let mgr = NotificationManager::new();
        assert_eq!(mgr.update_clock_history(1500), 1500);
        assert_eq!(mgr.update_clock_history(2200), 2200);
        assert_eq!(mgr.update_clock_history(1800), 2200);
    }

    #[test]
    fn alert_kind_cooldown_keys_are_distinct() {
        assert_ne!(
            AlertKind::AiProcessStarted.cooldown_key("ollama"),
            AlertKind::AiProcessStopped.cooldown_key("ollama")
        );
        assert_ne!(
            AlertKind::AiProcessStarted.cooldown_key("ollama"),
            AlertKind::AiProcessStarted.cooldown_key("comfyui")
        );
    }
}
