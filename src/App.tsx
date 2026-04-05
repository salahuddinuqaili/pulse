import { BrowserRouter, Routes, Route } from "react-router-dom";

import { useGpuListener } from "./hooks/use-gpu-listener";
import { LeftNav } from "./components/shell/left-nav";
import { Header } from "./components/shell/header";
import { QuickTune } from "./components/shell/quick-tune";
import { Dashboard } from "./routes/dashboard";
import { AiWorkload } from "./routes/ai-workload";
import { Settings } from "./routes/settings";

export default function App() {
  useGpuListener();

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
