use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tracing::{debug, error, info, warn};

/// Rolling window size for percentile calculations (~5 min at ~60fps would be huge,
/// but PresentMon outputs one line per present, so 300 samples ≈ 5 seconds at 60fps).
const FRAME_TIME_BUFFER_SIZE: usize = 300;

/// Rolling window for average FPS calculation.
const AVG_WINDOW_SIZE: usize = 60;

#[derive(Debug, Clone, Default)]
pub struct FrameMetrics {
    pub fps_current: f32,
    pub fps_avg: f32,
    pub frame_time_ms: f32,
    pub fps_1pct_low: f32,
    pub fps_01pct_low: f32,
}

/// Manages the PresentMon subprocess lifecycle: spawn, parse, stop.
pub struct PresentMonManager {
    metrics: Arc<Mutex<Option<FrameMetrics>>>,
    /// Handle to request cancellation of the active subprocess task.
    cancel_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    /// The process name currently being tracked.
    active_game: Mutex<Option<String>>,
    /// Path to the PresentMon binary (resolved at construction).
    binary_path: Option<PathBuf>,
}

impl PresentMonManager {
    /// Create a new manager. Resolves the PresentMon binary from Tauri's resource directory.
    /// If the binary is not found, all FPS fields will remain None.
    pub fn new(resource_dir: Option<PathBuf>) -> Self {
        let binary_path = resource_dir.and_then(|dir| {
            // Look for any PresentMon exe in the resources directory
            let pattern = dir.join("PresentMon-*-x64.exe");
            let pattern_str = pattern.to_string_lossy().to_string();
            glob_first_match(&pattern_str).or_else(|| {
                // Fallback: check exact known name
                let exact = dir.join("PresentMon-2.4.1-x64.exe");
                if exact.exists() { Some(exact) } else { None }
            })
        });

        if let Some(ref path) = binary_path {
            info!("PresentMon binary found at {}", path.display());
        } else {
            warn!("PresentMon binary not found — FPS metrics will be unavailable");
        }

        Self {
            metrics: Arc::new(Mutex::new(None)),
            cancel_tx: Mutex::new(None),
            active_game: Mutex::new(None),
            binary_path,
        }
    }

    /// Returns the current frame metrics, or None if PresentMon is not running.
    pub fn get_metrics(&self) -> Option<FrameMetrics> {
        self.metrics.lock().unwrap().clone()
    }

    /// Returns true if PresentMon is actively tracking a game.
    pub fn is_active(&self) -> bool {
        self.active_game.lock().unwrap().is_some()
    }

    /// Start tracking a game process. No-op if already tracking the same process
    /// or if the binary is not available.
    pub fn start(&self, process_name: &str) {
        // No binary → no-op
        let binary = match &self.binary_path {
            Some(p) => p.clone(),
            None => return,
        };

        // Already tracking the same game → no-op
        {
            let active = self.active_game.lock().unwrap();
            if active.as_deref() == Some(process_name) {
                return;
            }
        }

        // Stop any existing tracking first
        self.stop();

        info!("Starting PresentMon for process: {process_name}");

        let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();
        {
            let mut tx = self.cancel_tx.lock().unwrap();
            *tx = Some(cancel_tx);
        }
        {
            let mut active = self.active_game.lock().unwrap();
            *active = Some(process_name.to_string());
        }

        let metrics = self.metrics.clone();
        let process_name_owned = process_name.to_string();
        let active_game = Arc::new(Mutex::new(Some(process_name.to_string())));
        let active_game_for_cleanup = active_game.clone();

        // Store a reference to self.active_game for cleanup
        let self_active_game = {
            // We can't hold a reference across spawn, so we'll use the Arc<Mutex> metrics
            // to signal cleanup. Instead, pass what we need.
            Arc::new(Mutex::new(()))
        };
        let _ = self_active_game; // suppress unused warning

        let self_metrics = metrics.clone();

        tauri::async_runtime::spawn(async move {
            let result = run_presentmon(
                binary,
                &process_name_owned,
                self_metrics,
                cancel_rx,
            )
            .await;

            if let Err(e) = result {
                error!("PresentMon error: {e}");
            }

            // Clear metrics when done
            {
                let mut m = metrics.lock().unwrap();
                *m = None;
            }
            {
                let mut ag = active_game_for_cleanup.lock().unwrap();
                *ag = None;
            }

            info!("PresentMon stopped for process: {process_name_owned}");
        });
    }

    /// Stop the currently tracked process.
    pub fn stop(&self) {
        let tx = {
            let mut cancel = self.cancel_tx.lock().unwrap();
            cancel.take()
        };

        if let Some(tx) = tx {
            let _ = tx.send(());
        }

        {
            let mut active = self.active_game.lock().unwrap();
            *active = None;
        }
        {
            let mut m = self.metrics.lock().unwrap();
            *m = None;
        }
    }

}

/// Spawn PresentMon as a subprocess and parse its CSV stdout.
async fn run_presentmon(
    binary: PathBuf,
    process_name: &str,
    metrics: Arc<Mutex<Option<FrameMetrics>>>,
    mut cancel_rx: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), String> {
    let mut child = TokioCommand::new(&binary)
        .args([
            "--process_name",
            process_name,
            "--output_stdout",
            "--terminate_on_proc_exit",
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        // Prevent the console window from appearing
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| format!("Failed to spawn PresentMon: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture PresentMon stdout")?;

    let mut reader = BufReader::new(stdout).lines();
    let mut header_parsed = false;
    let mut ms_between_presents_col: Option<usize> = None;

    // Ring buffers for metric computation
    let mut frame_times: VecDeque<f32> = VecDeque::with_capacity(FRAME_TIME_BUFFER_SIZE);
    let mut recent_for_avg: VecDeque<f32> = VecDeque::with_capacity(AVG_WINDOW_SIZE);

    loop {
        tokio::select! {
            _ = &mut cancel_rx => {
                debug!("PresentMon cancel requested");
                let _ = child.kill().await;
                break;
            }
            line = reader.next_line() => {
                match line {
                    Ok(Some(line)) => {
                        if !header_parsed {
                            // First line is CSV header — find the MsBetweenPresents column
                            ms_between_presents_col = parse_header(&line);
                            if ms_between_presents_col.is_none() {
                                warn!("PresentMon CSV header missing MsBetweenPresents column");
                                let _ = child.kill().await;
                                return Err("Missing MsBetweenPresents in CSV header".to_string());
                            }
                            header_parsed = true;
                            continue;
                        }

                        let col_idx = ms_between_presents_col.unwrap();
                        if let Some(frame_time) = parse_frame_time(&line, col_idx) {
                            // Update ring buffers
                            if frame_times.len() >= FRAME_TIME_BUFFER_SIZE {
                                frame_times.pop_front();
                            }
                            frame_times.push_back(frame_time);

                            if recent_for_avg.len() >= AVG_WINDOW_SIZE {
                                recent_for_avg.pop_front();
                            }
                            recent_for_avg.push_back(frame_time);

                            // Compute metrics
                            let computed = compute_metrics(&frame_times, &recent_for_avg, frame_time);
                            let mut m = metrics.lock().unwrap();
                            *m = Some(computed);
                        }
                    }
                    Ok(None) => {
                        // PresentMon process exited (game closed or process ended)
                        debug!("PresentMon stdout closed (process exited)");
                        break;
                    }
                    Err(e) => {
                        error!("Error reading PresentMon stdout: {e}");
                        break;
                    }
                }
            }
        }
    }

    // Ensure child is cleaned up
    let _ = child.kill().await;
    let _ = child.wait().await;
    Ok(())
}

/// Parse CSV header line to find the index of MsBetweenPresents.
fn parse_header(header: &str) -> Option<usize> {
    header
        .split(',')
        .position(|col| col.trim() == "MsBetweenPresents")
}

/// Extract the frame time value from a CSV data line at the given column index.
fn parse_frame_time(line: &str, col_idx: usize) -> Option<f32> {
    line.split(',')
        .nth(col_idx)
        .and_then(|val| val.trim().parse::<f32>().ok())
        .filter(|&v| v > 0.0 && v < 1000.0) // Sanity check: 0-1000ms
}

/// Compute FPS metrics from the frame-time buffers.
fn compute_metrics(
    all_times: &VecDeque<f32>,
    recent_times: &VecDeque<f32>,
    last_frame_time: f32,
) -> FrameMetrics {
    let fps_current = if last_frame_time > 0.0 {
        1000.0 / last_frame_time
    } else {
        0.0
    };

    let fps_avg = if recent_times.is_empty() {
        fps_current
    } else {
        let avg_ms: f32 = recent_times.iter().sum::<f32>() / recent_times.len() as f32;
        if avg_ms > 0.0 { 1000.0 / avg_ms } else { 0.0 }
    };

    // Percentile calculations: sort a copy of frame times
    let fps_1pct_low = percentile_fps(all_times, 0.99);
    let fps_01pct_low = percentile_fps(all_times, 0.999);

    FrameMetrics {
        fps_current,
        fps_avg,
        frame_time_ms: last_frame_time,
        fps_1pct_low,
        fps_01pct_low,
    }
}

/// Calculate FPS from the Nth percentile of frame times.
/// For 1% low FPS: use the 99th percentile of frame times (slowest 1% of frames).
fn percentile_fps(times: &VecDeque<f32>, percentile: f64) -> f32 {
    if times.is_empty() {
        return 0.0;
    }

    let mut sorted: Vec<f32> = times.iter().copied().collect();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let idx = ((sorted.len() as f64 * percentile).ceil() as usize).min(sorted.len()) - 1;
    let frame_time = sorted[idx];

    if frame_time > 0.0 {
        1000.0 / frame_time
    } else {
        0.0
    }
}

/// Simple glob-like matching: find the first file matching a pattern with a wildcard.
fn glob_first_match(pattern: &str) -> Option<PathBuf> {
    // Split pattern into directory and file pattern
    let path = PathBuf::from(pattern);
    let parent = path.parent()?;
    let file_pattern = path.file_name()?.to_string_lossy();

    // Extract prefix before the wildcard
    let prefix = file_pattern.split('*').next().unwrap_or("");
    let suffix = file_pattern.split('*').next_back().unwrap_or("");

    let entries = std::fs::read_dir(parent).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with(prefix) && name_str.ends_with(suffix) {
            return Some(entry.path());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_header() {
        let header = "Application,ProcessID,SwapChainAddress,Runtime,SyncInterval,PresentFlags,AllowsTearing,PresentMode,CPUStartTime,CPUStartQPC,FrameTime,CPUBusy,CPUWait,GPULatency,GPUTime,GPUBusy,GPUWait,VideoBusy,DisplayLatency,DisplayedTime,AnimationError,ClickToPhotonLatency,AllInputToPhotonLatency,MsBetweenPresents,MsBetweenDisplayChange,MsInPresentAPI,MsUntilRenderComplete,MsUntilDisplayed,MsUntilRenderStart,MsBetweenSimulationStart,MsBetweenInputAndSimulationStart";
        let idx = parse_header(header);
        assert_eq!(idx, Some(23));
    }

    #[test]
    fn test_parse_header_missing() {
        let header = "Application,ProcessID,SomeOtherColumn";
        assert_eq!(parse_header(header), None);
    }

    #[test]
    fn test_parse_frame_time() {
        let line = "game.exe,1234,0x1234,DXGI,1,0,0,Hardware: Legacy Flip,123.456,789,16.67,10.0,6.67,5.0,15.0,14.0,1.0,0.0,20.0,16.67,0.1,25.0,30.0,16.67,16.67,0.5,15.0,20.0,0.1,16.67,0.0";
        // MsBetweenPresents is at index 23
        let ft = parse_frame_time(line, 23);
        assert!(ft.is_some());
        assert!((ft.unwrap() - 16.67).abs() < 0.01);
    }

    #[test]
    fn test_parse_frame_time_invalid() {
        let line = "game.exe,1234";
        assert_eq!(parse_frame_time(line, 23), None);
    }

    #[test]
    fn test_parse_frame_time_out_of_range() {
        // Negative value should be filtered
        let line = "a,b,c,-5.0";
        assert_eq!(parse_frame_time(line, 3), None);
    }

    #[test]
    fn test_compute_metrics_basic() {
        let mut times = VecDeque::new();
        times.push_back(16.67); // ~60fps
        times.push_back(16.67);
        times.push_back(16.67);

        let recent = times.clone();
        let m = compute_metrics(&times, &recent, 16.67);

        assert!((m.fps_current - 60.0).abs() < 1.0);
        assert!((m.fps_avg - 60.0).abs() < 1.0);
        assert!((m.frame_time_ms - 16.67).abs() < 0.01);
    }

    #[test]
    fn test_percentile_fps() {
        let mut times = VecDeque::new();
        // 95 fast frames + 5 slow frames — 99th percentile lands in the slow range
        for _ in 0..95 {
            times.push_back(10.0); // 100fps
        }
        for _ in 0..5 {
            times.push_back(50.0); // 20fps stutter
        }

        let fps_1pct = percentile_fps(&times, 0.99);
        // 99th percentile frame time should be 50.0ms → 20fps
        assert!((fps_1pct - 20.0).abs() < 1.0);
    }

    #[test]
    fn test_percentile_fps_empty() {
        let times = VecDeque::new();
        assert_eq!(percentile_fps(&times, 0.99), 0.0);
    }
}
