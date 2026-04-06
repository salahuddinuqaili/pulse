use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuSnapshot {
    pub poll_generation: u64,
    pub timestamp_ms: u64,
    pub gpu_utilization: u8,
    pub memory_utilization: u8,
    pub vram_total_mb: u32,
    pub vram_used_mb: u32,
    pub vram_free_mb: u32,
    pub temperature_c: u32,
    pub temperature_hotspot_c: Option<u32>,
    pub fan_speed_pct: Option<u32>,
    pub fan_speed_rpm: Option<u32>,
    pub power_draw_w: f32,
    pub power_limit_w: f32,
    pub clock_graphics_mhz: u32,
    pub clock_memory_mhz: u32,
    pub pcie_link_gen: Option<u8>,
    pub pcie_link_width: Option<u8>,
    pub fps_current: Option<f32>,
    pub fps_avg: Option<f32>,
    pub frame_time_ms: Option<f32>,
    pub fps_1pct_low: Option<f32>,
    pub fps_01pct_low: Option<f32>,
    pub processes: Vec<ProcessInfo>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub vram_mb: u32,
    pub category: ProcessCategory,
    pub command_line: Option<String>,
    pub exe_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProcessCategory {
    Game,
    Ai,
    System,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub name: String,
    pub driver_version: String,
    pub vram_total_mb: u32,
    pub pcie_link_speed: Option<String>,
    pub pcie_link_width: Option<u8>,
    pub cuda_cores: Option<u32>,
    pub power_limit_w: f32,
    pub vbios_version: Option<String>,
    pub cuda_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub id: String,
    pub start_ms: u64,
    pub end_ms: Option<u64>,
    pub interval_ms: u64,
    pub gpu_name: String,
    pub game_detected: Option<String>,
    pub snapshot_count: u32,
    pub file_name: String,
    pub aggregates: Option<SessionAggregates>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionAggregates {
    pub avg_temp: f32,
    pub max_temp: f32,
    pub avg_gpu_util: f32,
    pub max_gpu_util: f32,
    pub avg_vram_used_mb: f32,
    pub max_vram_used_mb: u32,
    pub avg_power_w: f32,
    pub max_power_w: f32,
    pub avg_fps: Option<f32>,
    pub max_fps: Option<f32>,
    pub avg_clock_graphics_mhz: f32,
    pub max_clock_graphics_mhz: u32,
}

impl Default for GpuSnapshot {
    fn default() -> Self {
        Self {
            poll_generation: 0,
            timestamp_ms: 0,
            gpu_utilization: 0,
            memory_utilization: 0,
            vram_total_mb: 0,
            vram_used_mb: 0,
            vram_free_mb: 0,
            temperature_c: 0,
            temperature_hotspot_c: None,
            fan_speed_pct: None,
            fan_speed_rpm: None,
            power_draw_w: 0.0,
            power_limit_w: 0.0,
            clock_graphics_mhz: 0,
            clock_memory_mhz: 0,
            pcie_link_gen: None,
            pcie_link_width: None,
            fps_current: None,
            fps_avg: None,
            frame_time_ms: None,
            fps_1pct_low: None,
            fps_01pct_low: None,
            processes: Vec::new(),
            errors: Vec::new(),
        }
    }
}
