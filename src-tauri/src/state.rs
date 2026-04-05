use std::sync::Mutex;

use crate::types::GpuSnapshot;

/// Shared application state managed by Tauri.
/// Wrapped in Mutex for safe cross-thread access from commands and poller.
pub struct AppState {
    pub current_snapshot: Mutex<GpuSnapshot>,
    pub poll_generation: Mutex<u64>,
    pub polling_interval_ms: Mutex<u64>,
    pub nvml_available: bool,
}

impl AppState {
    pub fn new(nvml_available: bool) -> Self {
        Self {
            current_snapshot: Mutex::new(GpuSnapshot::default()),
            poll_generation: Mutex::new(0),
            polling_interval_ms: Mutex::new(1000),
            nvml_available,
        }
    }

    pub fn next_generation(&self) -> u64 {
        let mut gen = self.poll_generation.lock().unwrap();
        *gen += 1;
        *gen
    }

    pub fn update_snapshot(&self, snapshot: GpuSnapshot) {
        let mut current = self.current_snapshot.lock().unwrap();
        *current = snapshot;
    }

    pub fn get_snapshot(&self) -> GpuSnapshot {
        self.current_snapshot.lock().unwrap().clone()
    }

    pub fn get_polling_interval(&self) -> u64 {
        *self.polling_interval_ms.lock().unwrap()
    }

    pub fn set_polling_interval(&self, interval_ms: u64) {
        let mut interval = self.polling_interval_ms.lock().unwrap();
        *interval = interval_ms.clamp(100, 5000);
    }
}
