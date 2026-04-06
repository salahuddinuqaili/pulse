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

export type MonitoringProfile = "gaming" | "ai";
