/** Mirrors Rust types.rs — keep in sync when modifying fields */

export interface GpuSnapshot {
  poll_generation: number;
  timestamp_ms: number;
  gpu_utilization: number;
  memory_utilization: number;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  temperature_c: number;
  temperature_hotspot_c: number | null;
  fan_speed_pct: number | null;
  fan_speed_rpm: number | null;
  power_draw_w: number;
  power_limit_w: number;
  clock_graphics_mhz: number;
  clock_memory_mhz: number;
  pcie_link_gen: number | null;
  pcie_link_width: number | null;
  fps_current: number | null;
  fps_avg: number | null;
  frame_time_ms: number | null;
  fps_1pct_low: number | null;
  fps_01pct_low: number | null;
  processes: ProcessInfo[];
  errors: string[];
}

export interface ProcessInfo {
  pid: number;
  name: string;
  vram_mb: number;
  category: "game" | "ai" | "system" | "unknown";
  command_line: string | null;
  exe_path: string | null;
}

export interface DeviceInfo {
  name: string;
  driver_version: string;
  vram_total_mb: number;
  pcie_link_speed: string | null;
  pcie_link_width: number | null;
  cuda_cores: number | null;
  power_limit_w: number;
  vbios_version: string | null;
  cuda_version: string | null;
}

export interface SessionMetadata {
  id: string;
  start_ms: number;
  end_ms: number | null;
  interval_ms: number;
  gpu_name: string;
  game_detected: string | null;
  snapshot_count: number;
  file_name: string;
  aggregates: SessionAggregates | null;
}

export interface SessionAggregates {
  avg_temp: number;
  max_temp: number;
  avg_gpu_util: number;
  max_gpu_util: number;
  avg_vram_used_mb: number;
  max_vram_used_mb: number;
  avg_power_w: number;
  max_power_w: number;
  avg_fps: number | null;
  max_fps: number | null;
  avg_clock_graphics_mhz: number;
  max_clock_graphics_mhz: number;
}

export type MonitoringProfile = "gaming" | "ai";

export type ProfileMode = "gaming" | "ai" | "gaming+ai" | "idle";

export type RecommendationCategory =
  | "model_fit"
  | "texture_budget"
  | "warning"
  | "optimization";

export interface Recommendation {
  category: RecommendationCategory;
  title: string;
  description: string;
  confidence: number;
}
