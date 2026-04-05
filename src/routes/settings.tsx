export function Settings() {
  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      <h1 className="font-display text-xl text-on-surface tracking-tight">Settings</h1>

      {/* Theme Selection */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Theme
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {["System", "Dark", "Neon-Max"].map((theme) => (
            <button
              key={theme}
              className={`bg-surface-elevate rounded-xl p-4 text-center font-display text-sm transition-all ${
                theme === "Dark"
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
        <div className="bg-surface-elevate rounded-xl p-4 flex flex-col gap-4">
          <SettingRow label="Polling Interval" value="1000ms" />
          <SettingRow label="Temp Warning" value="70\u00b0C" />
          <SettingRow label="Temp Critical" value="85\u00b0C" />
          <SettingRow label="VRAM Block Size" value="Auto" />
        </div>
      </section>

      {/* Behavior */}
      <section>
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          Behavior
        </h2>
        <div className="bg-surface-elevate rounded-xl p-4 flex flex-col gap-4">
          <ToggleRow label="Start minimized to tray" enabled={false} />
          <ToggleRow label="Launch at Windows startup" enabled={false} />
          <ToggleRow label="Compact overlay on minimize" enabled={true} />
        </div>
      </section>

      {/* External Integrations placeholder */}
      <section className="opacity-50">
        <h2 className="text-xs font-display text-muted uppercase tracking-wider mb-3">
          External Integrations
          <span className="ml-2 text-xs bg-surface-highest px-1.5 py-0.5 rounded">Coming Soon</span>
        </h2>
        <div className="bg-surface-elevate rounded-xl p-4 text-sm text-muted font-body">
          MCP Connection, Stream Deck, OBS — available in v0.3
        </div>
      </section>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-body text-on-surface">{label}</span>
      <span className="text-sm font-display text-muted">{value}</span>
    </div>
  );
}

function ToggleRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-body text-on-surface">{label}</span>
      <div
        className={`w-10 h-5 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-surface-highest"
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-on-surface mt-0.5 transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}
