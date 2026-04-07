use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub polling_interval_ms: u64,
    pub temp_warning_c: u32,
    pub temp_critical_c: u32,
    pub vram_block_size_mb: u32,
    pub start_minimized: bool,
    pub launch_at_startup: bool,
    pub compact_overlay_on_minimize: bool,
    pub custom_ai_processes: Vec<String>,
    pub custom_game_processes: Vec<String>,
    #[serde(default)]
    pub notifications: NotificationSettings,
    #[serde(default = "default_mcp_enabled")]
    pub mcp_enabled: bool,
    #[serde(default = "default_mcp_port")]
    pub mcp_port: u16,
    #[serde(default)]
    pub stream_deck_api_key: Option<String>,
    #[serde(default)]
    pub obs_ws_password: Option<String>,
    #[serde(default = "default_obs_port")]
    pub obs_ws_port: u16,
}

fn default_mcp_enabled() -> bool {
    false
}

fn default_mcp_port() -> u16 {
    9426
}

fn default_obs_port() -> u16 {
    4455
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSettings {
    pub enabled: bool,
    pub vram_threshold_pct: u8,
    pub vram_alert: bool,
    pub temp_warning_alert: bool,
    pub temp_critical_alert: bool,
    pub thermal_throttle: bool,
    pub ai_process_events: bool,
    pub cooldown_secs: u64,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            vram_threshold_pct: 90,
            vram_alert: true,
            temp_warning_alert: true,
            temp_critical_alert: true,
            thermal_throttle: true,
            ai_process_events: true,
            cooldown_secs: 60,
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "Dark".to_string(),
            polling_interval_ms: 1000,
            temp_warning_c: 70,
            temp_critical_c: 85,
            vram_block_size_mb: 256,
            start_minimized: false,
            launch_at_startup: false,
            compact_overlay_on_minimize: true,
            custom_ai_processes: Vec::new(),
            custom_game_processes: Vec::new(),
            notifications: NotificationSettings::default(),
            mcp_enabled: default_mcp_enabled(),
            mcp_port: default_mcp_port(),
            stream_deck_api_key: None,
            obs_ws_password: None,
            obs_ws_port: default_obs_port(),
        }
    }
}

pub struct SettingsManager {
    settings: Mutex<Settings>,
    file_path: PathBuf,
}

impl SettingsManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let file_path = app_data_dir.join("settings.json");
        let settings = Self::load_from_disk(&file_path);
        Self {
            settings: Mutex::new(settings),
            file_path,
        }
    }

    fn load_from_disk(path: &PathBuf) -> Settings {
        match fs::read_to_string(path) {
            Ok(contents) => {
                match serde_json::from_str::<Settings>(&contents) {
                    Ok(s) => {
                        info!("Settings loaded from {}", path.display());
                        s
                    }
                    Err(e) => {
                        warn!("Failed to parse settings file: {e}, using defaults");
                        Settings::default()
                    }
                }
            }
            Err(_) => {
                info!("No settings file found at {}, using defaults", path.display());
                Settings::default()
            }
        }
    }

    pub fn get(&self) -> Settings {
        self.settings.lock().unwrap().clone()
    }

    pub fn update(&self, new_settings: Settings) -> Result<(), String> {
        // Ensure data dir exists
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create settings directory: {e}"))?;
        }

        let json = serde_json::to_string_pretty(&new_settings)
            .map_err(|e| format!("Failed to serialize settings: {e}"))?;

        fs::write(&self.file_path, json)
            .map_err(|e| format!("Failed to write settings file: {e}"))?;

        *self.settings.lock().unwrap() = new_settings;
        info!("Settings saved to {}", self.file_path.display());
        Ok(())
    }

}
