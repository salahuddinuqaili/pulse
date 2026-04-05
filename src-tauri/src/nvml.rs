use nvml_wrapper::Nvml;
use once_cell::sync::OnceCell;
use tracing::{error, info};

static NVML_INSTANCE: OnceCell<Nvml> = OnceCell::new();

/// Initialise NVML once. Returns Ok(()) if already initialised or newly initialised.
/// Returns Err with a human-readable message if NVML cannot load.
pub fn init() -> Result<(), String> {
    NVML_INSTANCE.get_or_try_init(|| {
        Nvml::init().map_err(|e| {
            let msg = format!("Failed to initialise NVML: {e}");
            error!("{msg}");
            msg
        })
    })?;
    info!("NVML initialised successfully");
    Ok(())
}

/// Get a reference to the global NVML instance.
/// Panics if called before `init()` succeeds — this is intentional because
/// the app should not start polling without a valid NVML handle.
pub fn get() -> &'static Nvml {
    NVML_INSTANCE
        .get()
        .expect("NVML not initialised — call nvml::init() during app setup")
}

/// Get the first GPU device. Most consumer systems have one discrete NVIDIA GPU.
pub fn get_device() -> Result<nvml_wrapper::Device<'static>, String> {
    let nvml = get();
    let device = nvml.device_by_index(0).map_err(|e| {
        format!("Failed to get GPU device: {e}")
    })?;
    Ok(device)
}

/// Query GPU utilization rates (GPU core %, memory controller %).
pub fn get_utilization() -> Result<(u8, u8), String> {
    let device = get_device()?;
    let util = device.utilization_rates().map_err(|e| format!("Utilization query failed: {e}"))?;
    Ok((util.gpu as u8, util.memory as u8))
}

/// Query VRAM usage: (total_mb, used_mb, free_mb).
pub fn get_memory_info() -> Result<(u32, u32, u32), String> {
    let device = get_device()?;
    let mem = device.memory_info().map_err(|e| format!("Memory query failed: {e}"))?;
    let total = (mem.total / (1024 * 1024)) as u32;
    let used = (mem.used / (1024 * 1024)) as u32;
    let free = (mem.free / (1024 * 1024)) as u32;
    Ok((total, used, free))
}

/// Query GPU temperature in Celsius.
pub fn get_temperature() -> Result<u32, String> {
    let device = get_device()?;
    device
        .temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu)
        .map_err(|e| format!("Temperature query failed: {e}"))
}

/// Query power draw in watts and power limit in watts.
pub fn get_power() -> Result<(f32, f32), String> {
    let device = get_device()?;
    let draw_mw = device.power_usage().map_err(|e| format!("Power usage query failed: {e}"))?;
    let limit_mw = device.enforced_power_limit().map_err(|e| format!("Power limit query failed: {e}"))?;
    Ok((draw_mw as f32 / 1000.0, limit_mw as f32 / 1000.0))
}

/// Query graphics and memory clock speeds in MHz.
pub fn get_clocks() -> Result<(u32, u32), String> {
    use nvml_wrapper::enum_wrappers::device::Clock;
    let device = get_device()?;
    let graphics = device.clock_info(Clock::Graphics).map_err(|e| format!("Graphics clock query failed: {e}"))?;
    let memory = device.clock_info(Clock::Memory).map_err(|e| format!("Memory clock query failed: {e}"))?;
    Ok((graphics, memory))
}

/// Query fan speed percentage (may return None for passive cooling).
pub fn get_fan_speed() -> Option<u32> {
    let device = get_device().ok()?;
    device.fan_speed(0).ok()
}

/// Query PCIe link generation and width.
pub fn get_pcie_info() -> (Option<u8>, Option<u8>) {
    let device = match get_device() {
        Ok(d) => d,
        Err(_) => return (None, None),
    };
    let pcie_gen = device.current_pcie_link_gen().ok().map(|v| v as u8);
    let width = device.current_pcie_link_width().ok().map(|v| v as u8);
    (pcie_gen, width)
}

/// Query NVML for process info: returns Vec<(pid, vram_bytes)>.
pub fn get_running_graphics_processes() -> Result<Vec<(u32, u64)>, String> {
    let device = get_device()?;
    let procs = device
        .running_graphics_processes()
        .map_err(|e| format!("Process query failed: {e}"))?;
    Ok(procs
        .into_iter()
        .map(|p| {
            let vram = match p.used_gpu_memory {
                nvml_wrapper::enums::device::UsedGpuMemory::Used(bytes) => bytes,
                nvml_wrapper::enums::device::UsedGpuMemory::Unavailable => 0,
            };
            (p.pid, vram)
        })
        .collect())
}

/// Query NVML for compute processes (AI workloads often use compute, not graphics).
pub fn get_running_compute_processes() -> Result<Vec<(u32, u64)>, String> {
    let device = get_device()?;
    let procs = device
        .running_compute_processes()
        .map_err(|e| format!("Compute process query failed: {e}"))?;
    Ok(procs
        .into_iter()
        .map(|p| {
            let vram = match p.used_gpu_memory {
                nvml_wrapper::enums::device::UsedGpuMemory::Used(bytes) => bytes,
                nvml_wrapper::enums::device::UsedGpuMemory::Unavailable => 0,
            };
            (p.pid, vram)
        })
        .collect())
}

/// Get device info (called once at startup).
pub fn get_device_info() -> Result<crate::types::DeviceInfo, String> {
    let device = get_device()?;
    let nvml = get();

    let name = device.name().map_err(|e| format!("Name query failed: {e}"))?;
    let driver_version = nvml.sys_driver_version().map_err(|e| format!("Driver version query failed: {e}"))?;
    let mem = device.memory_info().map_err(|e| format!("Memory query failed: {e}"))?;
    let vram_total_mb = (mem.total / (1024 * 1024)) as u32;

    let pcie_link_width = device.current_pcie_link_width().ok().map(|v| v as u8);
    let pcie_link_speed = device.current_pcie_link_gen().ok().map(|g| format!("Gen{g}"));

    let power_limit_w = device
        .enforced_power_limit()
        .map(|mw| mw as f32 / 1000.0)
        .unwrap_or(0.0);

    let vbios_version = device.vbios_version().ok();

    let cuda_cores = lookup_cuda_cores(&name);

    Ok(crate::types::DeviceInfo {
        name,
        driver_version,
        vram_total_mb,
        pcie_link_speed,
        pcie_link_width,
        cuda_cores,
        power_limit_w,
        vbios_version,
    })
}

/// Lookup table for approximate CUDA core counts by GPU model.
fn lookup_cuda_cores(name: &str) -> Option<u32> {
    let name_upper = name.to_uppercase();
    // RTX 50 series
    if name_upper.contains("5090") { return Some(21760); }
    if name_upper.contains("5080") { return Some(10752); }
    if name_upper.contains("5070 TI") { return Some(8960); }
    if name_upper.contains("5070") { return Some(6144); }
    // RTX 40 series
    if name_upper.contains("4090") { return Some(16384); }
    if name_upper.contains("4080 SUPER") { return Some(10240); }
    if name_upper.contains("4080") { return Some(9728); }
    if name_upper.contains("4070 TI SUPER") { return Some(8448); }
    if name_upper.contains("4070 TI") { return Some(7680); }
    if name_upper.contains("4070 SUPER") { return Some(7168); }
    if name_upper.contains("4070") { return Some(5888); }
    if name_upper.contains("4060 TI") { return Some(4352); }
    if name_upper.contains("4060") { return Some(3072); }
    // RTX 30 series
    if name_upper.contains("3090") { return Some(10496); }
    if name_upper.contains("3080 TI") { return Some(10240); }
    if name_upper.contains("3080") { return Some(8704); }
    if name_upper.contains("3070 TI") { return Some(6144); }
    if name_upper.contains("3070") { return Some(5888); }
    if name_upper.contains("3060 TI") { return Some(4864); }
    if name_upper.contains("3060") { return Some(3584); }
    None
}
