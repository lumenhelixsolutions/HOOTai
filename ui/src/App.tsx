import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HootUnlock from "./components/H00tUnlock";
import { AppBootShell, PageShell } from "./components/AppShell";
import { api } from "./lib/api";
import { APP_ROUTES } from "./lib/app-shell";

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

  const routeComponents = useMemo(
    () =>
      Object.fromEntries(
        APP_ROUTES.filter((route) => route.loader).map((route) => [route.path, lazy(route.loader!)]),
      ) as Record<string, React.ComponentType>,
    [],
  );

  if (!authReady) return <AppBootShell />;
  if (needsUnlock) {
    return <HootUnlock onUnlocked={() => setNeedsUnlock(false)} />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {APP_ROUTES.map((route) => {
          const Component = routeComponents[route.path];
          if (!Component) return null;
          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                <Suspense fallback={<PageShell />}>
                  <Component />
                </Suspense>
              }
            />
          );
        })}
        <Route path="/skills" element={<Navigate to="/modules" replace />} />
        <Route path="/bench" element={<Navigate to="/vitals" replace />} />
      </Route>
    </Routes>
  );
}
