import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as Slider from "@radix-ui/react-slider";

interface NotificationSettings {
  enabled: boolean;
  vram_threshold_pct: number;
  vram_alert: boolean;
  temp_warning_alert: boolean;
  temp_critical_alert: boolean;
  thermal_throttle: boolean;
  ai_process_events: boolean;
  cooldown_secs: number;
}

interface Settings {
  theme: string;
  polling_interval_ms: number;
  temp_warning_c: number;
  temp_critical_c: number;
  vram_block_size_mb: number;
  start_minimized: boolean;
  launch_at_startup: boolean;
  compact_overlay_on_minimize: boolean;
  custom_ai_processes: string[];
  custom_game_processes: string[];
  notifications: NotificationSettings;
  mcp_enabled: boolean;
  mcp_port: number;
  stream_deck_api_key: string | null;
  obs_ws_password: string | null;
  obs_ws_port: number;
}

interface McpStatus {
  running: boolean;
  endpoint_url: string;
  port: number;
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: true,
  vram_threshold_pct: 90,
  vram_alert: true,
  temp_warning_alert: true,
  temp_critical_alert: true,
  thermal_throttle: true,
  ai_process_events: true,
  cooldown_secs: 60,
};

const DEFAULT_SETTINGS: Settings = {
  theme: "Dark",
  polling_interval_ms: 1000,
  temp_warning_c: 70,
  temp_critical_c: 85,
  vram_block_size_mb: 256,
  start_minimized: false,
  launch_at_startup: false,
  compact_overlay_on_minimize: true,
  custom_ai_processes: [],
  custom_game_processes: [],
  notifications: DEFAULT_NOTIFICATIONS,
  mcp_enabled: false,
  mcp_port: 9426,
  stream_deck_api_key: null,
  obs_ws_password: null,
  obs_ws_port: 4455,
};

export function Settings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [endpointCopied, setEndpointCopied] = useState(false);

  useEffect(() => {
    invoke<Settings>("get_settings")
      .then((s) => {
        setSettings(s);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    invoke<McpStatus>("get_mcp_status")
      .then(setMcpStatus)
      .catch((e) => console.error("Failed to fetch MCP status:", e));
  }, []);

  const save = useCallback(async (updated: Settings) => {
    setSettings(updated);
    setSaveStatus("saving");
    try {
      await invoke("save_settings", { settings: updated });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e) {
      console.error("Failed to save settings:", e);
      setSaveStatus("idle");
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const updated = { ...settings, ...patch };
      save(updated);
    },
    [settings, save],
  );

  const updateNotifications = useCallback(
    (patch: Partial<NotificationSettings>) => {
      const updated = {
        ...settings,
        notifications: { ...settings.notifications, ...patch },
      };
      save(updated);
    },
    [settings, save],
  );

  const toggleMcp = useCallback(
    async (enabled: boolean) => {
      setMcpError(null);
      try {
        const status = await invoke<McpStatus>("toggle_mcp", { enabled });
        setMcpStatus(status);
        setSettings((prev) => ({ ...prev, mcp_enabled: enabled }));
      } catch (e) {
        setMcpError(String(e));
      }
    },
    [],
  );

  const updateMcpPort = useCallback(
    async (port: number) => {
      setMcpError(null);
      try {
        await invoke("set_mcp_port", { port });
        setSettings((prev) => ({ ...prev, mcp_port: port }));
        const status = await invoke<McpStatus>("get_mcp_status");
        setMcpStatus(status);
      } catch (e) {
        setMcpError(String(e));
      }
    },
    [],
  );

  const copyEndpoint = useCallback(async () => {
    if (!mcpStatus) return;
    try {
      await navigator.clipboard.writeText(mcpStatus.endpoint_url);
      setEndpointCopied(true);
      setTimeout(() => setEndpointCopied(false), 1500);
    } catch (e) {
      console.error("Failed to copy endpoint:", e);
    }
  }, [mcpStatus]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted font-body">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-on-surface tracking-tight">Settings</h1>
        {saveStatus === "saved" && (
          <span className="text-xs font-display text-primary">Saved</span>
        )}
        {saveStatus === "saving" && (
          <span className="text-xs font-display text-muted">Saving...</span>
        )}
      </div>

      {/* Theme Selection */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Theme
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {["System", "Dark", "Neon-Max"].map((theme) => (
            <button
              key={theme}
              onClick={() => update({ theme })}
              className={`bg-surface-elevate rounded-xl p-4 text-center font-display text-sm transition-all ${
                settings.theme === theme
                  ? "ring-2 ring-primary text-primary shadow-[0_0_15px_rgba(0,255,102,0.2)]"
                  : "text-muted hover:text-on-surface"
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </section>

      {/* Monitoring Configuration */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Monitoring
        </h2>
        <div className="bg-surface-elevate rounded-xl p-5 flex flex-col gap-5">
          {/* Polling Interval */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-body text-on-surface">Polling Interval</span>
              <span className="font-display text-sm text-primary">
                {settings.polling_interval_ms}ms
              </span>
            </div>
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-5"
              value={[settings.polling_interval_ms]}
              min={100}
              max={5000}
              step={100}
              onValueChange={([v]) => update({ polling_interval_ms: v })}
            >
              <Slider.Track className="bg-surface relative grow rounded-full h-1.5">
                <Slider.Range className="absolute bg-primary rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-4 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(0,255,102,0.4)] hover:bg-primary/90 focus:outline-none cursor-pointer" />
            </Slider.Root>
            <div className="flex justify-between text-xs text-muted font-display mt-1">
              <span>100ms</span>
              <span>5000ms</span>
            </div>
          </div>

          {/* Temperature Warning */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-body text-on-surface">Temp Warning</span>
              <span className="font-display text-sm text-on-surface">
                {settings.temp_warning_c}°C
              </span>
            </div>
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-5"
              value={[settings.temp_warning_c]}
              min={50}
              max={95}
              step={1}
              onValueChange={([v]) => update({ temp_warning_c: v })}
            >
              <Slider.Track className="bg-surface relative grow rounded-full h-1.5">
                <Slider.Range className="absolute bg-[#FBBF24] rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-4 h-4 bg-[#FBBF24] rounded-full hover:brightness-110 focus:outline-none cursor-pointer" />
            </Slider.Root>
          </div>

          {/* Temperature Critical */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-body text-on-surface">Temp Critical</span>
              <span className="font-display text-sm text-warning">
                {settings.temp_critical_c}°C
              </span>
            </div>
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-5"
              value={[settings.temp_critical_c]}
              min={60}
              max={105}
              step={1}
              onValueChange={([v]) => update({ temp_critical_c: v })}
            >
              <Slider.Track className="bg-surface relative grow rounded-full h-1.5">
                <Slider.Range className="absolute bg-warning rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-4 h-4 bg-warning rounded-full hover:brightness-110 focus:outline-none cursor-pointer" />
            </Slider.Root>
          </div>

          {/* VRAM Block Size */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-body text-on-surface">VRAM Block Size</span>
            <select
              value={settings.vram_block_size_mb}
              onChange={(e) => update({ vram_block_size_mb: Number(e.target.value) })}
              className="bg-surface text-on-surface font-display text-sm rounded-lg px-3 py-1.5 border-none outline-none cursor-pointer"
            >
              <option value={128}>128 MB</option>
              <option value={256}>256 MB</option>
              <option value={512}>512 MB</option>
            </select>
          </div>
        </div>
      </section>

      {/* Behavior */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Behavior
        </h2>
        <div className="bg-surface-elevate rounded-xl p-5 flex flex-col gap-4">
          <ToggleRow
            label="Start minimized to tray"
            enabled={settings.start_minimized}
            onToggle={(v) => update({ start_minimized: v })}
          />
          <ToggleRow
            label="Launch at Windows startup"
            enabled={settings.launch_at_startup}
            onToggle={(v) => update({ launch_at_startup: v })}
          />
          <ToggleRow
            label="Compact overlay on minimize"
            enabled={settings.compact_overlay_on_minimize}
            onToggle={(v) => update({ compact_overlay_on_minimize: v })}
          />
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Notifications
        </h2>
        <div className="bg-surface-elevate rounded-xl p-5 flex flex-col gap-5">
          <ToggleRow
            label="Enable notifications"
            enabled={settings.notifications.enabled}
            onToggle={(v) => updateNotifications({ enabled: v })}
          />

          <div
            className={`flex flex-col gap-5 ${
              settings.notifications.enabled ? "" : "opacity-40 pointer-events-none"
            }`}
          >
            <div className="border-t border-surface-highest/20" />

            <ToggleRow
              label="VRAM pressure"
              enabled={settings.notifications.vram_alert}
              onToggle={(v) => updateNotifications({ vram_alert: v })}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-body text-on-surface">VRAM threshold</span>
                <span className="font-display text-sm text-primary">
                  {settings.notifications.vram_threshold_pct}%
                </span>
              </div>
              <Slider.Root
                className="relative flex items-center select-none touch-none w-full h-5"
                value={[settings.notifications.vram_threshold_pct]}
                min={50}
                max={99}
                step={1}
                onValueChange={([v]) => updateNotifications({ vram_threshold_pct: v })}
              >
                <Slider.Track className="bg-surface relative grow rounded-full h-1.5">
                  <Slider.Range className="absolute bg-primary rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-4 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(0,255,102,0.4)] hover:bg-primary/90 focus:outline-none cursor-pointer" />
              </Slider.Root>
              <div className="flex justify-between text-xs text-muted font-display mt-1">
                <span>50%</span>
                <span>99%</span>
              </div>
            </div>

            <div className="border-t border-surface-highest/20" />

            <ToggleRow
              label="Temperature warning"
              enabled={settings.notifications.temp_warning_alert}
              onToggle={(v) => updateNotifications({ temp_warning_alert: v })}
            />
            <ToggleRow
              label="Temperature critical"
              enabled={settings.notifications.temp_critical_alert}
              onToggle={(v) => updateNotifications({ temp_critical_alert: v })}
            />
            <ToggleRow
              label="Thermal throttling detected"
              enabled={settings.notifications.thermal_throttle}
              onToggle={(v) => updateNotifications({ thermal_throttle: v })}
            />
            <ToggleRow
              label="AI process started / stopped"
              enabled={settings.notifications.ai_process_events}
              onToggle={(v) => updateNotifications({ ai_process_events: v })}
            />

            <div className="border-t border-surface-highest/20" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-body text-on-surface">Cooldown</span>
                <span className="font-display text-sm text-on-surface">
                  {settings.notifications.cooldown_secs}s
                </span>
              </div>
              <Slider.Root
                className="relative flex items-center select-none touch-none w-full h-5"
                value={[settings.notifications.cooldown_secs]}
                min={10}
                max={300}
                step={5}
                onValueChange={([v]) => updateNotifications({ cooldown_secs: v })}
              >
                <Slider.Track className="bg-surface relative grow rounded-full h-1.5">
                  <Slider.Range className="absolute bg-primary rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-4 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(0,255,102,0.4)] hover:bg-primary/90 focus:outline-none cursor-pointer" />
              </Slider.Root>
              <div className="flex justify-between text-xs text-muted font-display mt-1">
                <span>10s</span>
                <span>300s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Process Classification */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Custom Process Classification
        </h2>
        <div className="bg-surface-elevate rounded-xl p-5 flex flex-col gap-4">
          <ProcessList
            label="AI Processes"
            processes={settings.custom_ai_processes}
            color="#9333EA"
            onUpdate={(list) => update({ custom_ai_processes: list })}
          />
          <div className="border-t border-surface-highest/20" />
          <ProcessList
            label="Game Processes"
            processes={settings.custom_game_processes}
            color="#00FF66"
            onUpdate={(list) => update({ custom_game_processes: list })}
          />
        </div>
      </section>

      {/* External Integrations */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          External Integrations
        </h2>

        {/* MCP Connection */}
        <div className="bg-surface-elevate rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-display text-on-surface">MCP Connection</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    mcpStatus?.running ? "bg-primary" : "bg-muted/60"
                  }`}
                />
                <span className="text-xs font-display text-muted">
                  {mcpStatus?.running ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <button
              onClick={() => toggleMcp(!settings.mcp_enabled)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                settings.mcp_enabled ? "bg-primary" : "bg-surface-highest"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-on-surface absolute top-0.5 transition-transform ${
                  settings.mcp_enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {mcpError && (
            <div className="text-xs text-warning font-body">{mcpError}</div>
          )}

          <div className="flex items-center gap-2">
            <code className="flex-1 bg-surface text-on-surface text-xs font-display rounded-lg px-3 py-2 truncate">
              {mcpStatus?.endpoint_url ?? `http://127.0.0.1:${settings.mcp_port}`}
            </code>
            <button
              onClick={copyEndpoint}
              disabled={!mcpStatus}
              className="px-3 py-2 bg-surface text-primary font-display text-xs rounded-lg hover:bg-surface-highest/30 disabled:opacity-40 transition-colors"
            >
              {endpointCopied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-body text-on-surface">Port</span>
            <input
              type="number"
              min={1024}
              max={65535}
              value={settings.mcp_port}
              disabled={settings.mcp_enabled}
              onChange={(e) => {
                const port = Number(e.target.value);
                if (Number.isFinite(port) && port >= 1024 && port <= 65535) {
                  updateMcpPort(port);
                }
              }}
              className="w-24 bg-surface text-on-surface font-display text-sm rounded-lg px-3 py-1.5 border-none outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          {settings.mcp_enabled && (
            <p className="text-xs text-muted font-body">
              Disable MCP to change the port.
            </p>
          )}
        </div>

        {/* Stream Deck (placeholder) */}
        <div className="bg-surface-elevate rounded-xl p-5 mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display text-on-surface">Stream Deck API Key</span>
            <span className="text-xs font-display text-muted bg-surface px-2 py-0.5 rounded">
              v1.0
            </span>
          </div>
          <input
            type="password"
            value={settings.stream_deck_api_key ?? ""}
            placeholder="Paste API key"
            onChange={(e) =>
              update({ stream_deck_api_key: e.target.value || null })
            }
            className="w-full bg-surface text-on-surface font-body text-sm rounded-lg px-3 py-2 placeholder:text-muted/50 outline-none focus:ring-1 focus:ring-primary/30"
          />
          <p className="text-xs text-muted font-body">
            Integration available in v1.0. The key is stored locally for now.
          </p>
        </div>

        {/* OBS WebSocket (placeholder) */}
        <div className="bg-surface-elevate rounded-xl p-5 mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display text-on-surface">OBS WebSocket</span>
            <span className="text-xs font-display text-muted bg-surface px-2 py-0.5 rounded">
              v1.0
            </span>
          </div>
          <input
            type="password"
            value={settings.obs_ws_password ?? ""}
            placeholder="WebSocket password"
            onChange={(e) =>
              update({ obs_ws_password: e.target.value || null })
            }
            className="w-full bg-surface text-on-surface font-body text-sm rounded-lg px-3 py-2 placeholder:text-muted/50 outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm font-body text-on-surface">Port</span>
            <input
              type="number"
              min={1024}
              max={65535}
              value={settings.obs_ws_port}
              onChange={(e) => {
                const port = Number(e.target.value);
                if (Number.isFinite(port) && port >= 1024 && port <= 65535) {
                  update({ obs_ws_port: port });
                }
              }}
              className="w-24 bg-surface text-on-surface font-display text-sm rounded-lg px-3 py-1.5 border-none outline-none"
            />
          </div>
          <p className="text-xs text-muted font-body">
            Integration available in v1.0. Settings are stored locally for now.
          </p>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-body text-on-surface">{label}</span>
      <button
        onClick={() => onToggle(!enabled)}
        className={`w-10 h-5 rounded-full transition-colors relative ${
          enabled ? "bg-primary" : "bg-surface-highest"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-on-surface absolute top-0.5 transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function ProcessList({
  label,
  processes,
  color,
  onUpdate,
}: {
  label: string;
  processes: string[];
  color: string;
  onUpdate: (list: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const name = input.trim().toLowerCase();
    if (name && !processes.includes(name)) {
      onUpdate([...processes, name]);
      setInput("");
    }
  };

  const remove = (name: string) => {
    onUpdate(processes.filter((p) => p !== name));
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-display text-on-surface">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {processes.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-display"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {name}
            <button
              onClick={() => remove(name)}
              className="hover:opacity-70 text-xs leading-none"
            >
              ×
            </button>
          </span>
        ))}
        {processes.length === 0 && (
          <span className="text-xs text-muted font-body">No custom processes added</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Process name (e.g., my-ai-tool)"
          className="flex-1 bg-surface text-on-surface text-sm font-body rounded-lg px-3 py-1.5 placeholder:text-muted/50 outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 bg-surface text-primary font-display text-sm rounded-lg hover:bg-surface-highest/30 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
