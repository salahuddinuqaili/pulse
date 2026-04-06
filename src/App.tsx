import { BrowserRouter, Routes, Route } from "react-router-dom";

import { useGpuListener } from "./hooks/use-gpu-listener";
import { LeftNav } from "./components/shell/left-nav";
import { Header } from "./components/shell/header";
import { QuickTune } from "./components/shell/quick-tune";
import { Dashboard } from "./routes/dashboard";
import { AiWorkload } from "./routes/ai-workload";
import { GamingProfile } from "./routes/gaming-profile";
import { Settings } from "./routes/settings";
import { CompactOverlay } from "./components/compact-overlay";

export default function App() {
  useGpuListener();

  // Compact overlay window renders without shell chrome
  const isOverlay = window.location.pathname === "/overlay";
  if (isOverlay) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/overlay" element={<CompactOverlay />} />
        </Routes>
      </BrowserRouter>
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
