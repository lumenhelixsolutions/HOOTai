# Session Diary · Radar History · Telemetry — v2 Plan

> **Shipped** (2026-06-11) — Phase A+B implemented in activity-analytics v2, activity-log reconcile, and ActivityPage v2 UX.

**Scope:** Fix telemetry **logic** and sharpen **UX** for session diary + radar history on HOOT `/activity`.  
**Out of scope (unless you ask):** Token burn panel redesign, CodeBurn ingest, LAN multi-client sync.  
**Date:** 2026-06-10  
**Builds on:** Sepia dashboard v1 (shipped) · `docs/plans/2026-06-10-activity-diary-sepia-dashboard-plan.md`

---

## Executive summary

v1 delivered the sepia dashboard shell — KPIs, calendar, drivers, agent table, flat timeline, rollup. The page **looks** like operator telemetry but several **truth** and **navigation** gaps remain:

| Gap | Impact |
|-----|--------|
| Dock/external minutes may be **double-counted** | Calendar, drivers, KPIs, diary `.md` can show ~2× real agent time |
| Radar history only grows when **`GET /api/agent-radar`** runs | Activity page alone does not populate history; depends on Coach poll (~20s) |
| **HOOT launches** and **radar PIDs** are separate event streams | Timeline is flat; no “session card” story |
| **Live running** agents live on Overview/Coach, not Activity | Operator opens Activity and sees history with no “right now” |
| Timeline has **no filters**, **no Terminal deep link**, **no expand** | Hard to audit a failed launch or jump to `session_ref` |
| **30-day rollup** duplicates diary + driver table narrative | Long scroll, repeated numbers |

**Recommendation:** Ship **Phase A + B** as one approval unit (logic fixes + diary UX). Phase C is polish; Phase D is optional platform work.

---

## Current architecture (verified)

```
CoachContext (all pages)
  └─ poll GET /api/agent-radar every 20s (3s boot delay)
       └─ server.js: diffRadarSnapshots(prev, next)
            └─ activity-log.js: appendEvent(start/stop), sessions{radar-pid}, daily{}

Launch flow (server.js)
  └─ recordLaunch / recordLaunchEnd → activity-log events (session.launch/end/fail)

Activity page
  └─ GET /api/activity/analytics?days=30
       └─ activity-analytics.js: buildDailySeries, drivers, timeline, rollup
```

| File | Role |
|------|------|
| `activity-log.js` | Event store, `daily{}` rollups, radar diff, diary `.md` |
| `activity-analytics.js` | Aggregations for UI + `formatDiaryMarkdown` |
| `agent-radar.js` | Process scan, dock vs external via `dockPids` + `AGENTDOCK_SESSION_ID` |
| `ui/src/pages/ActivityPage.tsx` | 7 sections + TokenBurnPanel |
| `ui/src/components/activity/*` | Charts, tables, `ActivityTimeline` |
| `ui/src/context/CoachContext.tsx` | Sole steady radar poll in SPA |

---

## Logic issues (with evidence)

### 1. Minutes double-count (P0)

**What happens today**

1. `appendEvent` increments `data.daily[day].dock_minutes` / `external_minutes` when a stop event carries `duration_ms` (`activity-log.js` L63–68).
2. `buildDailySeries` **first** copies those rollup values into each day row (L69–77).
3. Then it **again** adds stop-event minutes when `dailyRollup[day]` exists (L96–104).

**Example from test fixture** (`tests/activity-analytics.test.js`):

- `daily['2026-06-10'].external_minutes = 60`
- Same day has `agent.external.stop` with `duration_ms: 3_600_000` (60m)
- Resulting `daily_series` row ≈ **120m external** (rollup + event replay)

Same inflation affects `buildDrivers`, `buildAgentComparison`, KPIs, calendar intensity, and exported JSON.

**Fix (single source of truth)**

Pick **one** path:

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A (recommended)** | `daily{}` is canonical for minutes; analytics **only** reads rollup for dock/external totals; events used for peak hour, successes/failures, agent attribution **without** re-adding minutes when rollup exists | Matches write path; fast; diary `.md` stays consistent | Requires backfill/recompute if historical `daily` wrong |
| B | Remove minute updates from `appendEvent`; compute all minutes from stop events at analytics time | Simpler writer | Slower; diary writer must call analytics |
| C | Keep both but gate: `if (!dailyRollup[day])` add from events (partial fix) | Minimal diff | Leaves duplicate if rollup already wrong |

**Deliverables (Option A)**

- Change `buildDailySeries` / `buildDrivers` / `buildAgentComparison` to **not** add stop `duration_ms` when day exists in `dailyRollup`.
- Add regression tests with explicit minute assertions (today fixture should assert 60m not 120m).
- Optional one-time `scripts/rebuild-activity-daily.js` to recompute `daily{}` from events (idempotent).

---

### 2. Radar history coverage (P1)

**What happens today**

- Events are created only inside `GET /api/agent-radar` when cache is stale or `force=1`.
- Activity page calls **only** `/api/activity/analytics` — no radar ping.
- If user stays on Activity with Coach disabled / tab backgrounded / server never polled → **gaps** in radar history.

**Fix**

- Activity page: lightweight radar touch on mount + every 60s while visible (`getAgentRadar()` or new `GET /api/activity/live` that wraps radar + open sessions).
- Analytics payload: add `radar_meta: { last_scanned_at, poll_source, events_from_radar_24h }` so UI can show “history freshness”.
- Server: on boot after first radar scan, run **reconcile** (see §3).

---

### 3. Session reconciliation on restart (P1)

**What happens today**

- `sessions['radar-{pid}']` persisted in `activity-log.json`.
- On server restart, PIDs may be stale; first radar diff may emit spurious stops or miss duration (`started_at` from old process).
- Stop duration uses `Date.now() - startedAt` at diff time (L117–118), not `next.scanned_at - started_at` → clock skew vs radar TTL.

**Fix**

- `reconcileRadarOnBoot(liveRadar)`:
  - Drop `sessions` keys whose PID ∉ live radar.
  - For live PIDs without session key, create session **without** start event (or emit `agent.*.resume` meta-only event).
- Use `next.scanned_at` for stop `at` and duration math.
- Cap absurd durations (e.g. > 24h) with `meta.capped: true`.

---

### 4. Launch sessions vs radar sessions (P2)

**What happens today**

- `session.launch` / `session.end` share `session_ref` (HOOT terminal session id).
- Radar events carry `meta.pid` only — **no link** to `session_ref` even when PID ∈ `dockPids` from running HOOT sessions.

**Fix**

- When diffing, if `pid` matches a running dock session, set `session_ref` on radar start/stop events.
- Analytics: new `buildSessionGroups(events)` → `{ id, kind: 'hoot'|'radar', agent, project, started_at, ended_at, duration_ms, events[], outcome }`.
- UI session cards prefer grouped view; flat timeline remains as “Advanced” toggle.

---

### 5. KPI success-rate duplication (P2)

`buildKpis` adds `todayRow.successes/failures` **plus** usage outcomes for today — can double-count launch outcomes when both streams record the same session.

**Fix:** Deduplicate by `session_ref` when merging usage outcomes into KPIs.

---

## UX issues (with target behavior)

### Current page map (v1)

1. KPI strip  
2. Daily agent activity (trend + calendar + driver-by-day table)  
3. What is driving activity? (dot plot + drivers table)  
4. Agent comparison  
5. Session diary (flat timeline, date from calendar)  
6. 30-day rollup table  
7. Token burn (compact)

**Problems:** §5 + §6 repeat the same day’s story; §7 is orthogonal to diary/radar focus; no “now” band; timeline is read-only.

---

### Proposed information architecture (v2)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Operator Telemetry                    [Refresh] [Export] [Write diary .md] │
├──────────────────────────────────────────────────────────────────────────┤
│ LIVE STRIP (new)                                                         │
│ N agents running · dock X · external Y · last radar scan · [Terminal →] │
├──────────────────────────────────────────────────────────────────────────┤
│ KPIs (unchanged layout, corrected numbers after Phase A)                 │
├──────────────────────────────────────────────────────────────────────────┤
│ §1 Patterns (merge current §1–§3 into tabs or accordion)               │
│   [Calendar] [Trend] [Drivers] [Agents]                                  │
├──────────────────────────────────────────────────────────────────────────┤
│ §2 Session diary (hero section)                                          │
│   View: [Grouped sessions ▼] [Raw events]                                │
│   Filters: type · agent · project · source (dock/external/hoot)          │
│   Row: session card or event → expand meta · link /terminal?session=…      │
│   Footer: selected-day mini-rollup (replaces standalone §6 table)        │
├──────────────────────────────────────────────────────────────────────────┤
│ §3 Radar & telemetry health (compact)                                    │
│   Last scan · events logged 24h · gaps hint · “Keep tab open or Refresh” │
└──────────────────────────────────────────────────────────────────────────┘
```

**Token burn:** Collapse to a single KPI tile (“RTK saved”) or move to Overview — not a diary section unless you want it kept.

---

### UX deliverables by component

| Component | Change |
|-----------|--------|
| **Live strip** | `useCoach()` radar fields + `agentRadarScannedAt`; link to `/terminal` |
| **ActivityTimeline** | Filters; expandable `meta` (pid, exitCode); `Link` when `session_ref` |
| **Session cards (new)** | `ActivitySessionCards.tsx` from grouped API |
| **ActivityPage layout** | Patterns sub-nav; diary as hero; remove duplicate rollup section |
| **Empty states** | Actionable copy: “Open any page to start radar poll”, “Launch from Terminal”, “Run external Claude/Codex” |
| **Calendar selection** | Already wired — extend to filter session cards + show day rollup inline under diary |
| **Export / diary .md** | Use `formatDiaryMarkdown` after truth fixes; include grouped session summary section |

---

## API changes (proposed)

| Endpoint | Change |
|----------|--------|
| `GET /api/activity/analytics` | Add `session_groups[]`, `live: { running, dock, external, scanned_at }`, `radar_meta`, `telemetry_health` |
| `GET /api/activity/live` *(optional)* | Thin alias: radar summary + `activityLog.load().sessions` + today KPI — for fast poll without full analytics |
| `GET /api/agent-radar` | No contract change; reconcile on boot inside existing handler |
| `POST /api/activity/diary` | Markdown includes session groups + corrected minutes |

**UI types:** extend `ui/src/lib/activity-types.ts` with `ActivitySessionGroup`, `ActivityLiveSnapshot`.

---

## Phased implementation

### Phase A — Telemetry truth (backend, ~1 PR)

**Goal:** Numbers match reality; tests lock behavior.

- [ ] Fix double-count in `activity-analytics.js` (Option A).
- [ ] Deduplicate KPI outcomes by `session_ref`.
- [ ] Stop duration uses `scanned_at`; duration cap + meta flag.
- [ ] `reconcileRadarOnBoot` in `activity-log.js`, called from first radar scan after server start.
- [ ] Tests: minute totals, driver shares, KPI dedupe, reconcile fixture.
- [ ] Optional: `rebuild-activity-daily.js` for existing installs.

**Acceptance**

- Fixture day `2026-06-10` reports **60m** external, not 120m.
- `npm test` — `activity-analytics.test.js` + new cases green.

---

### Phase B — Diary + live UX (frontend + analytics API, ~1 PR)

**Goal:** Operator can answer “what’s running?” and “what happened today?” without leaving Activity.

- [ ] `buildSessionGroups` + analytics fields.
- [ ] Activity page: live strip, diary hero, patterns accordion/tabs.
- [ ] `ActivitySessionCards` + enhanced `ActivityTimeline` (filters, expand, terminal link).
- [ ] Activity mount radar poll (60s, respect visibility).
- [ ] Remove standalone 30-day rollup section → inline day footer under diary.
- [ ] Demote TokenBurn to KPI-only or footnote link to Overview.

**Acceptance**

- Click calendar day → session cards + events filter to that day.
- Launch with `session_ref` in timeline → navigates to Terminal session.
- Live strip updates when external agent starts (within one radar interval).

---

### Phase C — Analytics depth (optional, ~1 PR)

- [ ] Project attribution column in drivers (from `event.project`).
- [ ] Radar gap detection (“no radar events in 2h while agents running on Dashboard”).
- [ ] Sparkline on session cards (minute blocks).
- [ ] `GET /api/activity/analytics?days=7|30|90` selector in UI.

---

### Phase D — Platform / coach (optional, defer)

- [ ] LAN clients emit `POST /api/activity/emit` for module events.
- [ ] Coach `pageContext` includes `activityToday` + selected diary day on `/activity`.
- [ ] Background radar scheduler in server (interval) so history grows even if no browser open.

---

## Testing strategy

| Layer | Tests |
|-------|-------|
| Unit | `buildDailySeries` minutes, `buildSessionGroups`, reconcile, duration cap |
| API | `/api/activity/analytics` shape includes `session_groups`, `live` |
| Manual | Start external agent → see live strip + stop event with sane duration; launch HOOT session → grouped card with terminal link; restart server mid-session → no duplicate start/stop storm |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Fixing double-count lowers displayed minutes vs what user saw in v1 | Release note; optional daily rebuild script |
| Grouped sessions heuristic wrong for overlapping PIDs | Keep raw events toggle; refine `session_ref` on dock PIDs |
| Extra radar polls on Activity | 60s interval, visibility-gated; reuse cached radar TTL server-side |
| Large `activity-log.json` | Already capped at 5000 events; session groups computed in memory |

---

## Approval options

Reply with one of:

| Choice | Meaning |
|--------|---------|
| **A+B** | Ship truth fixes + diary/live UX (recommended) |
| **A only** | Backend correctness first; UI in a follow-up |
| **A+B+C** | Full telemetry polish including project attribution |
| **Custom** | e.g. “A+B but keep TokenBurn section” |

Optional tweaks:

- Keep / remove TokenBurn section on Activity  
- Default diary view: **Grouped** vs **Raw events**  
- Collapse patterns into tabs vs accordion  

---

## Effort estimate

| Phase | Size |
|-------|------|
| A | S (~half day) |
| B | M (~1 day) |
| C | S–M (~half–1 day) |
| D | M–L (platform; separate milestone) |

---

*Waiting for approval before any code changes.*