use serde::{Deserialize, Serialize};

use crate::types::ProcessCategory;
use crate::types::ProcessInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecommendationCategory {
    ModelFit,
    TextureBudget,
    Warning,
    Optimization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub category: RecommendationCategory,
    pub title: String,
    pub description: String,
    /// 0.0–1.0 — how confident we are this recommendation applies right now.
    pub confidence: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProfileMode {
    Gaming,
    Ai,
    #[serde(rename = "gaming+ai")]
    GamingAi,
    Idle,
}

impl ProfileMode {
    pub fn detect(processes: &[ProcessInfo]) -> Self {
        let game_running = processes
            .iter()
            .any(|p| matches!(p.category, ProcessCategory::Game));
        let ai_running = processes
            .iter()
            .any(|p| matches!(p.category, ProcessCategory::Ai));
        match (game_running, ai_running) {
            (true, true) => Self::GamingAi,
            (true, false) => Self::Gaming,
            (false, true) => Self::Ai,
            (false, false) => Self::Idle,
        }
    }
}

/// Generate workload recommendations based on the current GPU state.
///
/// The mode determines which family of advice we surface; free VRAM determines
/// the specific suggestions within that family.
pub fn generate_recommendations(
    free_vram_mb: u32,
    total_vram_mb: u32,
    mode: ProfileMode,
) -> Vec<Recommendation> {
    let mut out = Vec::new();
    if total_vram_mb == 0 {
        return out;
    }

    match mode {
        ProfileMode::Gaming => {
            out.extend(texture_recommendations(free_vram_mb));
            out.push(Recommendation {
                category: RecommendationCategory::Optimization,
                title: "Idle GPU bandwidth available".to_string(),
                description: format!(
                    "{:.1} GB free — you could run a small LLM alongside this game.",
                    free_vram_mb as f32 / 1024.0
                ),
                confidence: clamp_confidence(free_vram_mb as f32 / total_vram_mb as f32),
            });
        }
        ProfileMode::Ai => {
            out.extend(model_fit_recommendations(free_vram_mb));
        }
        ProfileMode::GamingAi => {
            out.push(Recommendation {
                category: RecommendationCategory::Warning,
                title: "Game + AI workload active".to_string(),
                description: format!(
                    "{:.1} GB free of {:.1} GB. Consider Q4 quantization to free VRAM.",
                    free_vram_mb as f32 / 1024.0,
                    total_vram_mb as f32 / 1024.0
                ),
                confidence: 0.9,
            });
            out.extend(model_fit_recommendations(free_vram_mb));
            if free_vram_mb < 1024 {
                out.push(Recommendation {
                    category: RecommendationCategory::Warning,
                    title: "Low VRAM headroom".to_string(),
                    description:
                        "Loading another model may cause instability or shared memory fallback."
                            .to_string(),
                    confidence: 0.95,
                });
            }
        }
        ProfileMode::Idle => {
            out.push(Recommendation {
                category: RecommendationCategory::ModelFit,
                title: "GPU is idle".to_string(),
                description: format!(
                    "Capacity overview: {:.1} GB total VRAM available.",
                    total_vram_mb as f32 / 1024.0
                ),
                confidence: 1.0,
            });
            out.extend(model_fit_recommendations(free_vram_mb));
        }
    }

    out
}

/// Map free VRAM → texture quality bands. Conservative numbers — gamers can
/// always push higher than these.
fn texture_recommendations(free_vram_mb: u32) -> Vec<Recommendation> {
    let (level, headroom_msg) = match free_vram_mb {
        m if m >= 4096 => ("Ultra textures", "Plenty of headroom for max-quality assets."),
        m if m >= 2048 => ("High textures", "Comfortable margin for high-quality textures."),
        m if m >= 1024 => ("Medium textures", "Drop one tier to avoid stutter."),
        _ => ("Low textures", "VRAM is tight — reduce texture quality."),
    };
    vec![Recommendation {
        category: RecommendationCategory::TextureBudget,
        title: format!("Recommended: {level}"),
        description: format!(
            "{:.1} GB free. {headroom_msg}",
            free_vram_mb as f32 / 1024.0
        ),
        confidence: 0.8,
    }]
}

/// Map free VRAM → loadable model classes. Numbers mirror src/lib/model-database.ts
/// loosely so the planner and recommendations stay consistent.
fn model_fit_recommendations(free_vram_mb: u32) -> Vec<Recommendation> {
    let suggestion: &str = match free_vram_mb {
        m if m >= 40_960 => "Llama 3.1 70B Q4_K_M (~40 GB)",
        m if m >= 16_000 => "Llama 3.1 8B FP16 (~16 GB) or Qwen 2.5 14B Q4 (~10 GB)",
        m if m >= 9_000 => "Llama 3.1 8B Q8 (~9 GB) or Gemma 2 9B Q4 (~6 GB)",
        m if m >= 5_500 => "Llama 3.1 8B Q4_K_M (~5.5 GB) or SDXL FP16 (~6.5 GB)",
        m if m >= 2_800 => "Phi-3 Mini Q4 (~2.8 GB) or Llama 3.2 3B Q4 (~2.4 GB)",
        _ => "Free VRAM is too low for most modern LLMs",
    };

    vec![Recommendation {
        category: RecommendationCategory::ModelFit,
        title: "Compatible models".to_string(),
        description: format!(
            "{:.1} GB free — fits {suggestion}.",
            free_vram_mb as f32 / 1024.0
        ),
        confidence: 0.85,
    }]
}

fn clamp_confidence(v: f32) -> f32 {
    v.clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proc(name: &str, category: ProcessCategory) -> ProcessInfo {
        ProcessInfo {
            pid: 1,
            name: name.to_string(),
            vram_mb: 100,
            category,
            command_line: None,
            exe_path: None,
        }
    }

    #[test]
    fn detect_idle() {
        assert_eq!(ProfileMode::detect(&[]), ProfileMode::Idle);
    }

    #[test]
    fn detect_gaming() {
        let procs = vec![proc("game.exe", ProcessCategory::Game)];
        assert_eq!(ProfileMode::detect(&procs), ProfileMode::Gaming);
    }

    #[test]
    fn detect_ai_only() {
        let procs = vec![proc("ollama.exe", ProcessCategory::Ai)];
        assert_eq!(ProfileMode::detect(&procs), ProfileMode::Ai);
    }

    #[test]
    fn detect_gaming_plus_ai() {
        let procs = vec![
            proc("game.exe", ProcessCategory::Game),
            proc("ollama.exe", ProcessCategory::Ai),
        ];
        assert_eq!(ProfileMode::detect(&procs), ProfileMode::GamingAi);
    }

    #[test]
    fn gaming_recommends_textures() {
        let recs = generate_recommendations(8192, 12288, ProfileMode::Gaming);
        assert!(recs.iter().any(|r| matches!(r.category, RecommendationCategory::TextureBudget)));
    }

    #[test]
    fn ai_recommends_model_fit() {
        let recs = generate_recommendations(16_384, 24_576, ProfileMode::Ai);
        assert!(recs.iter().any(|r| matches!(r.category, RecommendationCategory::ModelFit)));
    }

    #[test]
    fn gaming_ai_warns_when_low_vram() {
        let recs = generate_recommendations(512, 12_288, ProfileMode::GamingAi);
        assert!(recs.iter().any(|r| matches!(r.category, RecommendationCategory::Warning)));
    }

    #[test]
    fn zero_total_returns_empty() {
        let recs = generate_recommendations(0, 0, ProfileMode::Idle);
        assert!(recs.is_empty());
    }
}
