import { useEffect } from "react";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";

import { useGpuListener } from "./hooks/use-gpu-listener";
import { useTheme } from "./hooks/use-theme";
import { useProfileStore } from "./stores/profile-store";
import { LeftNav } from "./components/shell/left-nav";
import { Header } from "./components/shell/header";
import { QuickTune } from "./components/shell/quick-tune";
import { Dashboard } from "./routes/dashboard";
import { AiWorkload } from "./routes/ai-workload";
import { GamingProfile } from "./routes/gaming-profile";
import { Settings } from "./routes/settings";
import { SessionReplay } from "./routes/session-replay";
import { Analytics } from "./routes/analytics";
import { VramPlanner } from "./routes/vram-planner";
import { CompactOverlay } from "./components/compact-overlay";

export default function App() {
  useGpuListener();
  useTheme();

  const loadProfile = useProfileStore((s) => s.loadProfile);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Compact overlay window renders without shell chrome
  const isOverlay = window.location.hash.includes("/overlay");
  if (isOverlay) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/overlay" element={<CompactOverlay />} />
        </Routes>
      </HashRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen bg-background text-on-surface overflow-hidden">
        {/* Left Navigation */}
        <LeftNav />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ai-workload" element={<AiWorkload />} />
              <Route path="/gaming" element={<GamingProfile />} />
              <Route path="/replay/:sessionId" element={<SessionReplay />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/vram-planner" element={<VramPlanner />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>

        {/* Right Sidebar */}
        <QuickTune />
      </div>
    </BrowserRouter>
  );
}
