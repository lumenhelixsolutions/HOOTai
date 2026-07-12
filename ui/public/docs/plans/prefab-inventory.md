# Plan: Prefab Inventory + HOOT Activity Emotions

**Status:** Executed (2026-06-10)  
**Updated:** 2026-06-10  
**Scope:** Both tracks in one pass  
**Emotion depth:** Reactive — `pageContext` signals + short TTL bursts (no activity diary poll in v1)

---

## Part A — Prefab inventory (from research)

### Goal
Make it obvious what HOOT ships vs what the user must install.

### PR A1 — Prefab manifest API + catalog honesty
- `GET /api/prefab` — bundled vs detected vs gaps
- Fix `modules-catalog.json` counts (39 skills, 21 agents catalog + `upstream_agents: 51`)
- Fix `cache/README.md` (on-demand fetch not implemented unless PR A3 ships)
- `tests/prefab-inventory.test.js`

### PR A2 — Modules UI inventory panel
- Summary cards on `/modules`: Bundled · Cached · Detected · Needs install
- Per-skill badge: `cached` | `metadata-only`
- Agents tab note: 21 in catalog / 51 upstream
- Register or exclude `chatbot-builder` skill
- Add `/modules` to `app-docs.ts`

### PR A3 — On-demand skill fetch (optional)
- Fetch uncached CE skills from GitHub on first `GET /api/skills/:id/content`
- Cache under `skills/compound-engineering/cache/<id>/`

---

## Part B — HOOT expressions, triggers & activity emotions (NEW)

### Problem today
- **13 moods** exist but many pages collapse to `reading` or `monitoring`
- Triggers are coarse (`pathname` + a few `pageContext` keys)
- ASCII expressions reuse the same 4-line sprite; captions are generic
- **No transient emotions** for user actions (sync done, launch failed, profile blocked)
- Activity diary and agent-radar events don't reach HOOT mood resolver

### Design: emotion trigger bus (mirrors coach hints)

Priority-sorted rules — first match wins (unless manual override):

```
signal priority → mood + caption + optional TTL
```

| Priority | Signal | Mood | Caption example | Source |
|----------|--------|------|-----------------|--------|
| 100 | `error` | error | uh-oh! | hootError |
| 95 | `coach:thinking` | thinking | … | chat loading |
| 90 | `burn:high` | alert | RTK missing! | token burn |
| 88 | `radar:external` | alert | 2 outside HOOT | agent radar |
| 85 | `module:install-fail` | error | install failed | ModulesPage |
| 82 | `launch:blocked` | alert | launch blocked | LaunchCenter |
| 80 | `profile:blocked` | alert | profile blocked | ProfilesPage |
| 75 | `module:syncing` | scanning | syncing CE… | ModulesPage busy |
| 72 | `module:installing` | building | installing… | ModulesPage busy |
| 70 | `launch:running` | launching | go now>> | Terminal/Launch |
| 68 | `activity:new-event` | logging | +1 diary | activity poll |
| 65 | `burn:savings` | celebrating | RTK saved ~12k | token burn low |
| 62 | `module:ready` | celebrating | CE ready | detection ready |
| 60 | `stack:weak` | alert | stack < 50 | StackBuilder |
| 55 | `stack:strong` | celebrating | stack solid | score ≥ 80 |
| 50 | `hint:warning` | alert | heads up! | coach hint |
| 48 | `hint:celebration` | celebrating | nice! | coach hint |
| 45 | `hint:tip` | peeking | noticed | coach hint |
| 40 | `path:/activity` | logging | diary.. | route default |
| 35 | `path:/modules` | reading | modules.. | route default |
| 10 | `idle` | idle | watching | fallback |

### New / refined moods

| Mood | When | ASCII expression upgrades |
|------|------|---------------------------|
| `syncing` | CE sync, scan refresh, radar poll | `[~~~~]` crown, `~sync~` caption, faster frames |
| `installing` | module install / full-setup | `+=+` crown, `|pipe|` caption |
| `curious` | peeking + skills/agents tab | `◔ ◔` eyes, head tilt frames |
| `proud` | CE ready, stack ≥ 80, RTK savings | `^ ^` eyes, `nice!` / `solid!` |
| `watchful` | dock sessions live, no external | `● ●` steady pulse (replaces generic monitoring on `/`) |

*Implementation note:* `syncing` and `installing` can be new `HootMood` values OR mapped to existing `scanning`/`building` with richer frames — prefer **new moods** for clearer captions.

### Expression library upgrades (`hoot-ascii.ts`)

1. **Frame banks** — 3–4 variants per mood for ears, eyes, beak, feet (not just eyes)
2. **Activity captions** — `statusCaption()` takes resolved trigger id → specific line
3. **Per-mood scan bar** — only scanning/monitoring/logging/syncing
4. **Micro-expressions** — idle blink, error wince, celebrate hop (CSS already partial)

### Trigger wiring (pages emit signals)

Extend `setPageContext` with structured signals (merged, TTL auto-clear):

```ts
setPageContext({
  hootSignal: "module:syncing",
  hootSignalAt: Date.now(),
  hootSignalTtl: 4000,
});
```

**Pages to wire:**

| Page | Signals |
|------|---------|
| `ModulesPage` | syncing, installing, ready, install-fail |
| `ScanPage` | scanning (burn/radar/scan load), burn:savings |
| `TerminalPage` | launch:running, errorCount → alert |
| `LaunchCenterPage` | launching, launch:blocked |
| `ProfilesPage` | profile:blocked, celebrating on READY pick |
| `StackBuilder` | stack:weak, stack:strong, building |
| `ActivityPage` | activity:new-event count, logging |
| `Dashboard` | radar:external, burn:high, monitoring |

### Activity diary feed — deferred (v2)

User chose **reactive** depth for v1. Diary polling (`/api/activity/today`) and event-type moods ship in a follow-up if needed.

### Coach integration

- `resolveHootMoodFromContext` → refactor to `resolveHootEmotion(ctx)` using trigger table
- `hootStatusFromContext` → return trigger-specific caption, not generic radar line
- Coach hints and HOOT mood share priority numbers (documented in one table)
- Modules inventory panel: HOOT uses `reading` on skills tab, `curious` on agents, `syncing` during sync

### Tests

- `tests/hoot-emotions.test.js` — trigger priority, TTL, path defaults
- UI smoke: mood changes on mocked pageContext signals

### Files to touch

| File | Change |
|------|--------|
| `ui/src/lib/hoot-ascii.ts` | Trigger table, new moods, frame banks, captions |
| `ui/src/lib/hoot-logo.tsx` | Support new moods / motion classes |
| `ui/src/context/CoachContext.tsx` | Signal TTL decay, optional activity poll |
| `ui/src/pages/*.tsx` | Emit `hootSignal` on user actions |
| `ui/src/index.css` | Motion for syncing/installing/proud |
| `coach-hints.js` | Align priority numbers with emotion triggers |

---

## Execution order (single pass)

```
1. B1 — Emotion trigger bus + richer ASCII frames (hoot-ascii.ts)
2. B2 — CoachContext signal TTL + page wiring (Modules, Scan, Terminal, Launch, Stack, Profiles, Activity)
3. A1 — GET /api/prefab + catalog count fixes + tests
4. A2 — Modules inventory panel + skill badges + HOOT tab signals (curious on agents, syncing on sync)
5. Skip A3 on-demand skill fetch in v1
```

---

## Success criteria

- HOOT face and caption change within 1s of sync/launch/scan/radar events
- No page stuck on generic `reading` or `monitoring` during active work
- User can infer what HOOT is reacting to from caption alone
- Modules page shows bundled vs installed inventory at a glance