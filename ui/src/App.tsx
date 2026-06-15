import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HootUnlock from "./components/HootUnlock";
import { AppBootShell, PageShell } from "./components/AppShell";
import { api } from "./lib/api";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ScanPage = lazy(() => import("./pages/ScanPage"));
const ProfilesPage = lazy(() => import("./pages/ProfilesPage"));
const MemoryPage = lazy(() => import("./pages/MemoryPage"));
const TerminalPage = lazy(() => import("./pages/TerminalPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const StackBuilder = lazy(() => import("./pages/StackBuilder"));
const ModulesPage = lazy(() => import("./pages/ModulesPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const TokenLedgerPage = lazy(() => import("./pages/TokenLedgerPage"));
const BenchPage = lazy(() => import("./pages/BenchPage"));
const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage"));
const PipelinePage = lazy(() => import("./pages/PipelinePage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const LaunchCenterPage = lazy(() => import("./pages/LaunchCenterPage"));
const CommandDeckPage = lazy(() => import("./pages/CommandDeckPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((s) => {
        if (s.enabled && !s.authenticated && !s.loopback) setNeedsUnlock(true);
        setAuthReady(true);
      })
      .catch(() => setAuthReady(true));
  }, []);

  if (!authReady) return <AppBootShell />;
  if (needsUnlock) {
    return <HootUnlock onUnlocked={() => setNeedsUnlock(false)} />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <Suspense fallback={<PageShell />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="/profiles" element={<Suspense fallback={<PageShell />}><ProfilesPage /></Suspense>} />
        <Route path="/launch" element={<Suspense fallback={<PageShell />}><LaunchCenterPage /></Suspense>} />
        <Route path="/deck" element={<Suspense fallback={<PageShell />}><CommandDeckPage /></Suspense>} />
        <Route path="/terminal" element={<Suspense fallback={<PageShell />}><TerminalPage /></Suspense>} />
        <Route path="/memory" element={<Suspense fallback={<PageShell />}><MemoryPage /></Suspense>} />
        <Route path="/activity" element={<Suspense fallback={<PageShell />}><ActivityPage /></Suspense>} />
        <Route path="/burn" element={<Suspense fallback={<PageShell />}><TokenLedgerPage /></Suspense>} />
        <Route path="/bench" element={<Suspense fallback={<PageShell />}><BenchPage /></Suspense>} />
        <Route path="/approvals" element={<Suspense fallback={<PageShell />}><ApprovalsPage /></Suspense>} />
        <Route path="/pipeline" element={<Suspense fallback={<PageShell />}><PipelinePage /></Suspense>} />
        <Route path="/portfolio" element={<Suspense fallback={<PageShell />}><PortfolioPage /></Suspense>} />
        <Route path="/scan" element={<Suspense fallback={<PageShell />}><ScanPage /></Suspense>} />
        <Route path="/builder" element={<Suspense fallback={<PageShell />}><StackBuilder /></Suspense>} />
        <Route path="/modules" element={<Suspense fallback={<PageShell />}><ModulesPage /></Suspense>} />
        <Route path="/skills" element={<Navigate to="/modules" replace />} />
        <Route path="/settings" element={<Suspense fallback={<PageShell />}><SettingsPage /></Suspense>} />
        <Route path="/docs" element={<Suspense fallback={<PageShell />}><DocsPage /></Suspense>} />
      </Route>
    </Routes>
  );
}