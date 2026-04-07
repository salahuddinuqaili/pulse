import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link } from "react-router-dom";

import { useGpuStore } from "../../stores/gpu-store";

type PresentMonStatus =
  | { status: "not_installed" }
  | { status: "downloading"; bytes_downloaded: number; bytes_total: number }
  | { status: "installed"; version: string }
  | { status: "failed"; error: string };

export function FpsCounter() {
  const fpsCurrent = useGpuStore((s) => s.current?.fps_current ?? null);
  const fpsAvg = useGpuStore((s) => s.current?.fps_avg ?? null);
  const fps1pct = useGpuStore((s) => s.current?.fps_1pct_low ?? null);
  const fps01pct = useGpuStore((s) => s.current?.fps_01pct_low ?? null);

  // Surface a hint pointing to Settings when FPS is null AND PresentMon
  // is not installed. We don't poll the status — this only fires when the
  // user lands on the Gaming Profile screen.
  const [presentMonInstalled, setPresentMonInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    invoke<PresentMonStatus>("get_presentmon_status")
      .then((s) => setPresentMonInstalled(s.status === "installed"))
      .catch(() => setPresentMonInstalled(null));
  }, []);

  const fpsColor =
    fpsCurrent === null
      ? "text-muted"
      : fpsCurrent >= 60
        ? "text-primary"
        : fpsCurrent >= 30
          ? "text-on-surface"
          : "text-warning";

  const showOptInHint = fpsCurrent === null && presentMonInstalled === false;

  return (
    <div className="bg-surface-elevate rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-end gap-6">
        {/* Big FPS number */}
        <div>
          <span className={`font-display text-7xl font-bold tracking-tighter ${fpsColor}`}>
            {fpsCurrent !== null ? Math.round(fpsCurrent) : "\u2014"}
          </span>
          <span className="text-sm text-muted font-display ml-2 uppercase">FPS</span>
        </div>

        {/* Supporting metrics */}
        <div className="flex gap-6 pb-2">
          <FpsStat label="AVG" value={fpsAvg} />
          <FpsStat label="1% LOW" value={fps1pct} />
          <FpsStat label="0.1% LOW" value={fps01pct} />
        </div>
      </div>

      {showOptInHint && (
        <div className="text-xs font-body text-muted bg-surface/50 rounded-lg p-3 leading-relaxed">
          FPS tracking is disabled. Pulse can show in-game FPS, frame time, and
          1%/0.1% lows by downloading PresentMon (Intel, MIT, ~1 MB).{" "}
          <Link
            to="/settings"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Enable in Settings →
          </Link>
        </div>
      )}
    </div>
  );
}

function FpsStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted font-display uppercase tracking-wider">
        {label}
      </span>
      <span className="font-display text-lg text-on-surface">
        {value !== null ? Math.round(value) : "\u2014"}
      </span>
    </div>
  );
}
