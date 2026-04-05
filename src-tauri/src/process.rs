use std::collections::HashMap;
use sysinfo::System;
use tracing::warn;

use crate::classify::classify_process;
use crate::nvml;
use crate::types::ProcessInfo;

/// Enrich NVML process data with system info (name, path, command line)
/// and classify each process using the priority chain.
pub fn get_gpu_processes() -> Result<Vec<ProcessInfo>, String> {
    // Collect PIDs and VRAM from both graphics and compute processes
    let mut pid_vram: HashMap<u32, u64> = HashMap::new();

    if let Ok(graphics) = nvml::get_running_graphics_processes() {
        for (pid, vram) in graphics {
            *pid_vram.entry(pid).or_insert(0) += vram;
        }
    }

    if let Ok(compute) = nvml::get_running_compute_processes() {
        for (pid, vram) in compute {
            *pid_vram.entry(pid).or_insert(0) += vram;
        }
    }

    if pid_vram.is_empty() {
        return Ok(Vec::new());
    }

    // Use sysinfo to get process names and paths
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut result = Vec::with_capacity(pid_vram.len());

    for (pid, vram_bytes) in &pid_vram {
        let vram_mb = (*vram_bytes / (1024 * 1024)) as u32;
        let sys_pid = sysinfo::Pid::from_u32(*pid);

        let (name, exe_path, command_line) = if let Some(process) = sys.process(sys_pid) {
            let name = process.name().to_string_lossy().to_string();
            let exe = process.exe().map(|p| p.to_string_lossy().to_string());
            let cmd_parts: Vec<String> = process.cmd().iter().map(|s| s.to_string_lossy().to_string()).collect();
            let cmd = if cmd_parts.is_empty() {
                None
            } else {
                Some(cmd_parts.join(" "))
            };
            (name, exe, cmd)
        } else {
            warn!(pid = pid, "Could not find process info — likely AccessDenied");
            (format!("PID {pid}"), None, None)
        };

        let category = classify_process(
            &name,
            exe_path.as_deref(),
            command_line.as_deref(),
            vram_mb,
            None, // User overrides not yet wired
        );

        result.push(ProcessInfo {
            pid: *pid,
            name,
            vram_mb,
            category,
            command_line,
            exe_path,
        });
    }

    // Sort by VRAM descending so the biggest consumers appear first
    result.sort_by(|a, b| b.vram_mb.cmp(&a.vram_mb));
    Ok(result)
}

