# HOOT Load Performance — Research & Plan

> **For approval** — plan mode. Benchmarks captured 2026-06-10 against live `node server.js` on port 7777.

---

## Executive Summary

HOOT feels slow for two independent reasons:

1. **The Overview page blocks on a full system scan (~32s)** every time you open it.
2. **The UI ships as a single 1.2MB JavaScript bundle** with no route splitting, while the server re-scans all projects on several API calls.

Fixing the scan-on-load behavior alone should cut perceived load time from **~32s → under 2s** for returning users. Bundle splitting and registry caching get first paint and navigation snappier after that.

---

## Measured Bottlenecks (live timings)

| Endpoint / asset | Latency | Size | Who triggers it |
|------------------|---------|------|-----------------|
| **`GET /api/scan`** | **32,297ms** | 24 KB | **Dashboard Overview on every visit** |
| `GET /api/projects` | 3,278ms | 6 KB | Dashboard |
| `GET /api/portfolio/health` | 2,991ms | 3 KB | Dashboard |
| `GET /api/agent-radar` | 1,304ms | 4 KB | `CoachContext` on app mount |
| `GET /api/profiles` | 53ms | **154 KB** | Dashboard (full profile bodies) |
| `index-D1Ys2npj.js` | — | **1,231 KB** | Every page load (no code split) |
| Google Fonts (3 families) | network | — | `index.html` render-blocking |
| `GET /api/token-burn` | 16ms | 2 KB | Dashboard |
| `GET /api/activity/analytics` | 1ms | 1 KB | Activity page |

**Dashboard `Promise.all` today:** 9 parallel calls. Wall-clock = **max(all)** ≈ **32s** because `runScan()` dominates.

```54:64:D:\projects\agentdock\ui\src\pages\Dashboard.tsx
    Promise.all([
      api.getProfiles(),
      api.getProjects().catch(() => ({ projects: [], active: null })),
      api.getActiveProject().catch(() => ({ active: null, project: null })),
      api.runScan().catch(() => null),          // ← 32s PowerShell scanner
      api.getUsage().catch(() => null),
      api.getPortfolioHealth().catch(() => null),
      api.getProjects() /* ... */,
```

---

## Root Cause Analysis

### 1. Full scan on Overview load (P0)

`/api/scan` always spawns `scanner.ps1` (PowerShell, ~460 lines, probes every CLI tool). `lastScan` is **in-memory only** — lost on server restart. Scan results are written to `logs/scan-*.json` (115 files exist) but **never read back** on boot.

### 2. Project registry thrash (P0)

`readProjectRegistry()` calls `discoverProjects()` on **every** `/api/projects` and `/api/portfolio/health` hit. That walks `D:/projects` (18 repos) and runs up to **4 `git` subprocesses per repo** (`readGitStatus`, 5s timeout each). Two dashboard calls ≈ **double work** ≈ 3s each.

### 3. Monolithic JS bundle (P1)

Vite build emits one chunk:

```
dist/assets/index-D1Ys2npj.js   1,231 KB (353 KB gzip)
```

All routes are eagerly imported in `App.tsx`. `recharts` + `@assistant-ui/react` + every page ship on first load. Activity charts load even when visiting Overview.

### 4. Global side effects on mount (P1)

`CoachContext` immediately:
- polls `getAgentRadar()` (~1.3s)
- refreshes coach hints on every route + context change
- runs on **all pages**, not just Overview

### 5. Static assets unoptimized (P2)

`serveStatic` uses `readFileSync` with **no gzip/brotli**, no cache headers on JS/CSS. Fonts load from Google CDN (extra DNS + TLS + render block).

### 6. Blank first paint (P2)

`App.tsx` returns `null` until `/api/auth/status` resolves — no shell/skeleton.

### 7. Bloated profiles payload (P2)

`/api/profiles` returns full markdown `body` for every profile (154 KB). Dashboard only needs id, name, state, score, meta.

---

## Target Performance Budget

| Milestone | First meaningful paint | Overview interactive | Activity page |
|-----------|------------------------|----------------------|---------------|
| **Today** | ~1–2s (bundle) + blank auth | **~32s** | ~2s |
| **After Phase 1** | <1s skeleton | **<2s** (cached scan) | <2s |
| **After Phase 2** | <800ms | <1.5s | <1.5s |
| **After Phase 3** | <500ms (smaller bundle) | <1s | lazy charts |

---

## Proposed Phases

### Phase 1 — Stop the bleeding (P0, ~1 PR, highest ROI)

**Goal:** Overview never blocks on a fresh scan unless user explicitly refreshes.

| Change | Detail |
|--------|--------|
| **Cached scan API** | `GET /api/scan?cached=1` returns `lastScan` or latest `logs/scan-*.json` without running PowerShell |
| **Persist scan on boot** | Server loads most recent `logs/scan-*.json` into `lastScan` at startup |
| **Dashboard uses cache** | Replace `api.runScan()` with `api.getScan({ cached: true })` on load |
| **Explicit refresh only** | ScanPage "Run scan" button calls `api.runScan()` (unchanged) |
| **Staged dashboard fetch** | Wave 1 (fast): profiles summary, usage, memory, active project. Wave 2 (slow): projects, portfolio. Show skeleton between waves |
| **Loading shell** | Replace `return null` auth gate with branded skeleton + sidebar |

**Success test:** Open Overview after server restart → interactive in **<3s** with stale scan badge ("Last scanned 2h ago · Refresh").

---

### Phase 2 — Backend caching (P0, ~1 PR)

**Goal:** Eliminate repeated filesystem/git work.

| Change | Detail |
|--------|--------|
| **Project registry TTL cache** | Cache `readProjectRegistry()` result for 60s; `?refresh=1` busts |
| **Dedup git probes** | Single discovery pass shared by `/api/projects` and `/api/portfolio/health` |
| **Profiles summary endpoint** | `GET /api/profiles/summary` — no `body` field (~15 KB vs 154 KB) |
| **Dashboard uses summary** | Full profile body only on Profiles page / dry-run |
| **Combine dashboard bootstrap** | Optional `GET /api/bootstrap` returning scan cache + summary profiles + usage in one round trip |

**Success test:** `/api/projects` **<200ms** on repeat calls; `/api/profiles/summary` **<20ms**.

---

### Phase 3 — Frontend bundle diet (P1, ~1 PR)

**Goal:** Cut initial JS parse/eval time.

| Change | Detail |
|--------|--------|
| **Route lazy loading** | `React.lazy()` for Activity, Modules, StackBuilder, Terminal, Scan |
| **recharts chunk** | Only import recharts inside Activity route (saves ~150–200 KB from main chunk) |
| **Coach deferred** | Load `HeadCoach` + `@assistant-ui` only when coach panel opened (or after idle) |
| **Vite manualChunks** | Split `react`, `router`, `lucide`, `assistant-ui`, `recharts` |
| **Bundle budget CI** | Fail build if main chunk > 400 KB gzip |

**Success test:** Main chunk **<450 KB gzip**; Activity charts load on demand when visiting `/activity`.

---

### Phase 4 — Perceived polish (P2, ~1 PR)

| Change | Detail |
|--------|--------|
| **Self-host fonts** | Subset Inter + EB Garamond WOFF2 in `public/fonts/`; `font-display: swap` |
| **gzip static assets** | Compress `.js`/`.css` in `serveStatic`; `Cache-Control: max-age=31536000` for hashed assets |
| **Defer agent radar** | CoachContext: delay first radar poll 3s; skip when tab hidden (partially done) |
| **Prefetch on hover** | Sidebar link hover → prefetch route chunk |
| **Server warm scan** | Optional background scan 5s after boot (non-blocking) |

---

## Recommended Approval Options

### Option A — Fast relief (recommended first)
**Phase 1 only** — cached scan + dashboard staged loading + skeleton.

- ~1 day of work
- Fixes the "32 second Overview" problem immediately
- No bundle changes yet

### Option B — Full performance sprint
**Phases 1 → 2 → 3** in sequence.

- ~3–4 focused PRs
- Addresses backend and frontend
- Best overall outcome

### Option C — Backend only
**Phases 1 + 2** — skip bundle work for now.

- Good if load pain is mostly "waiting for data" not "white screen"
- Activity page still pays 1.2MB tax

---

## PR Stack (if Option B approved)

| PR | Scope | Expected win |
|----|-------|--------------|
| PR1 | Cached scan + boot hydrate + Dashboard staged load + skeleton | **~30s → <2s** Overview |
| PR2 | Registry TTL + profiles summary + bootstrap endpoint | **~3s → <200ms** project APIs |
| PR3 | Lazy routes + recharts split + vite chunks | **~1.2MB → ~400KB** initial JS |
| PR4 | Fonts + gzip + cache headers + radar defer | Faster first paint |

---

## What we will NOT do (v1)

- Replace PowerShell scanner with Node (too risky for Phase 1)
- Add Redis/MySQL caching layer
- SSR / Next.js migration
- Remove coach or radar features

---

## Verification Checklist

| # | Test |
|---|------|
| 1 | Cold server start → Overview interactive < 3s with cached scan |
| 2 | ScanPage "Refresh scan" still runs full scanner and updates cache |
| 3 | `/api/projects` repeat call < 200ms (registry cache) |
| 4 | Main JS chunk < 450 KB gzip after split |
| 5 | Activity charts still render after lazy load |
| 6 | `npm test` + UI build pass |

---

## Approval Ask

1. **Which option?** A (fast relief) / B (full sprint) / C (backend only)
2. **Scan staleness UX:** Show "Last scanned X ago" badge on Overview? (recommended: yes)
3. **Background scan on boot:** Enable optional warm scan after 5s? (recommended: yes, non-blocking)

**Recommendation:** **Option B**, with PR1 shipped first so you feel improvement immediately.