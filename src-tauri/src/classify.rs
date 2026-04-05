use crate::types::ProcessCategory;

/// Known AI process executable names (lowercase, no extension).
const KNOWN_AI_PROCESSES: &[&str] = &[
    "ollama",
    "ollama_llama_server",
    "ollama_runner",
    "comfyui",
    "koboldcpp",
    "llama-server",
    "llama-cpp-server",
    "lm-studio",
    "lm studio",
    "stable-diffusion",
    "invoke-ai",
    "a1111",
    "vllm",
    "text-generation-launcher",
];

/// Known system process names (lowercase, no extension).
const KNOWN_SYSTEM_PROCESSES: &[&str] = &[
    "dwm",
    "csrss",
    "nvcontainer",
    "nvdisplay.container",
    "nvidia-smi",
    "nvspcaps",
    "nvsphelper",
    "nvidia share",
    "nvidia web helper",
    "nvcplui",
];

/// Game store install path fragments (lowercase).
const GAME_PATH_FRAGMENTS: &[&str] = &[
    "steamapps/common/",
    "steamapps\\common\\",
    "epic games/",
    "epic games\\",
    "gog galaxy/games/",
    "gog galaxy\\games\\",
    "xboxgames/",
    "xboxgames\\",
];

/// AI-related command-line keywords for Python processes.
const AI_CMD_KEYWORDS: &[&str] = &[
    "torch",
    "cuda",
    "transformers",
    "diffusers",
];

/// Classification priority chain as defined in CLAUDE.md.
/// Highest priority wins. Never misclassify "unknown" as "ai" or "game".
///
/// 1. User-defined overrides (TODO: wire up from settings)
/// 2. Exact executable name match against known AI tools
/// 3. Path-based game detection (Steam, Epic, GOG, Xbox)
/// 4. Command-line keyword match (python with torch/cuda/transformers/diffusers)
/// 5. VRAM heuristic (>500MB, not matched above) → "game"
/// 6. Known system processes
/// 7. Default → "unknown"
pub fn classify_process(
    exe_name: &str,
    exe_path: Option<&str>,
    command_line: Option<&str>,
    vram_mb: u32,
    _user_overrides: Option<&std::collections::HashMap<String, ProcessCategory>>,
) -> ProcessCategory {
    let name_lower = exe_name.to_lowercase();
    let name_stem = name_lower
        .strip_suffix(".exe")
        .unwrap_or(&name_lower);

    // Priority 1: User-defined overrides
    // TODO: Check user_overrides map when settings are wired up

    // Priority 2: Exact executable name match against known AI tools
    if KNOWN_AI_PROCESSES.contains(&name_stem) {
        return ProcessCategory::Ai;
    }

    // Priority 3: Path-based game detection
    if let Some(path) = exe_path {
        let path_lower = path.to_lowercase();
        if GAME_PATH_FRAGMENTS.iter().any(|frag| path_lower.contains(frag)) {
            return ProcessCategory::Game;
        }
    }

    // Priority 4: Command-line keyword match for Python processes
    if (name_stem == "python" || name_stem == "python3" || name_stem.starts_with("python3."))
        && let Some(cmd) = command_line
    {
        let cmd_lower = cmd.to_lowercase();
        if AI_CMD_KEYWORDS.iter().any(|kw| cmd_lower.contains(kw)) {
            return ProcessCategory::Ai;
        }
    }

    // Priority 5: VRAM heuristic — high VRAM usage from unknown process likely a game
    if vram_mb > 500 {
        return ProcessCategory::Game;
    }

    // Priority 6: Known system processes
    if KNOWN_SYSTEM_PROCESSES.contains(&name_stem) {
        return ProcessCategory::System;
    }

    // Priority 7: Default
    ProcessCategory::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_classification() {
        assert!(matches!(
            classify_process("ollama.exe", None, None, 100, None),
            ProcessCategory::Ai
        ));
        assert!(matches!(
            classify_process("koboldcpp.exe", None, None, 50, None),
            ProcessCategory::Ai
        ));
    }

    #[test]
    fn test_game_path_classification() {
        assert!(matches!(
            classify_process(
                "game.exe",
                Some("C:\\Program Files\\Steam\\steamapps\\common\\MyGame\\game.exe"),
                None,
                100,
                None
            ),
            ProcessCategory::Game
        ));
    }

    #[test]
    fn test_python_ai_classification() {
        assert!(matches!(
            classify_process(
                "python.exe",
                None,
                Some("python -m torch.distributed.launch train.py"),
                100,
                None
            ),
            ProcessCategory::Ai
        ));
    }

    #[test]
    fn test_vram_heuristic() {
        assert!(matches!(
            classify_process("unknown_app.exe", None, None, 1024, None),
            ProcessCategory::Game
        ));
    }

    #[test]
    fn test_system_classification() {
        assert!(matches!(
            classify_process("dwm.exe", None, None, 50, None),
            ProcessCategory::System
        ));
    }

    #[test]
    fn test_unknown_default() {
        assert!(matches!(
            classify_process("random.exe", None, None, 10, None),
            ProcessCategory::Unknown
        ));
    }
}
