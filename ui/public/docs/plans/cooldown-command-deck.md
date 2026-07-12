# HOOT Cooldown Command Deck — Visual Monitor Plugin Plan

> **Shipped** — Full plan implemented 2026-06-11: `/deck` page (gauges, timeline, context radar, save-state console, telemetry), top-bar `CooldownStrip`, always-on-top PiP popout, `context-radar.js` + `/api/workspace/context`, enriched cooldown matrix (incl. DeepSeek/Perplexity), `cooldown-command-deck` builtin module.

**Date:** 2026-06-11
**Source concept:** AI_COMMAND_CENTER plugin manifest v2.0.0 (autonomous cooldown metric engine + context extraction interceptor)
**Goal:** A *very visual* built-in plugin mod for HOOT — live cooldown gauges, recovery timeline, workspace context radar, and one-click save-state — replacing the current flat badge grid.

---

## Where the manifest stands today (gap analysis)

| Manifest section | Status in HOOT | Gap |
|---|---|---|
| §1 Cooldown matrix + recovery prediction | `provider-cooldown.js` registry + ETA shipped | Limits ref is thin: no `limit_type`, no replenish rates, no daily-reset clock math; missing DeepSeek + Perplexity |
| §1.1 Cooldown logging → `ai_status.json` | Shipped (`telemetry-bridge.js`, auto-handoff on cooldown) | — |
| §2 Context extraction (files modified <2h in roots) | Roots exist (`workspace-roots.js`) | **No recent-file scanner exists anywhere** — no API, no UI |
| §3 Token compression | `token-burn.js` (shell) + terse handoff mode | — (orthogonal, done) |
| §4 Save-state `auto_handoff.md` | Shipped (`handoff-packet.js`) | UI is a button buried in settings — no console/preview |
| §5 Init / `ai_status.json` bootstrap | Shipped (onboarding wizard) | — |
| **The visual monitor itself** | `ProviderMatrixWidget.tsx` = static text badges | **This is the core gap** — no live countdowns, no gauges, no timeline, nothing "monitor"-like |

**Conclusion:** the engine is built; the cockpit is missing. This plan ships the cockpit, enriches the cooldown math behind it, and packages it as a built-in plugin mod.

---

## Phase 1 — Backend enrichment (small)

### 1.1 Upgrade cooldown matrix (`provider-cooldown.js`)
Replace thin `LIMITS_REF` with the manifest's full matrix per provider:

```js
claude: {
  limit_type: 'rolling_window', window_hours: 5, max_messages: 45,
  replenish_rate_minutes: 7.1, context_penalty: true,
  notes: 'Long-context sessions burn blocks up to 3x faster.'
}
```

- Add providers: **deepseek** (`concurrency_dependent`, ~50/3h), **perplexity** (`daily_reset` 00:00 UTC, 600/day). Keep gemini as `daily_reset` 08:00 UTC.
- New computed fields in `enrichRegistry()` (the gauges feed off these):
  - `seconds_remaining` — exact, so the UI can tick client-side
  - `progress` — 0→1 fraction of the cooldown window elapsed (drives the ring)
  - `ready_at_iso` — absolute unlock time
  - `predicted_messages_recovered` — for rolling-window providers, est. messages back via `replenish_rate_minutes`
  - For `daily_reset` providers with no manual cooldown: auto-compute next reset from system clock (manifest §1 "reads the local system clock")
- Backward-compatible with existing `state/provider-cooldown.json`.

### 1.2 New module: `context-radar.js` (manifest §2)
The missing context extraction interceptor, HOOT-native (no hard-coded `c:/web/`):

- Scans configured workspace roots (fallback: active project) for files matching `.py .js .ts .tsx .json .html .css .md` modified within last N hours (default 2).
- Depth-limited walk, skips `node_modules`, `.git`, `dist`, `state/`, `logs/`.
- Returns per-root grouping: `{ root, files: [{ path, ext, mtime, size, est_tokens }], total_files, total_est_tokens }` (est_tokens ≈ size/4).
- Endpoint: `GET /api/workspace/context?hours=2` in `server.js`.

### 1.3 Register as built-in plugin mod
Add entry to `modules/modules-catalog.json`: id `cooldown-command-deck`, `type: "builtin"`, always-enabled, described as "Live provider cooldown gauges, recovery timeline, context radar, save-state console" — so it shows up on the Modules page as a first-class plugin of the command center.

---

## Phase 2 — The visual Command Deck (the main event)

New page `/deck` in the React app (`ui/src/pages/CommandDeckPage.tsx`) + components under `ui/src/components/deck/`:

### 2.1 `ProviderGauge.tsx` — radial countdown gauges
- One SVG ring per provider (claude, chatgpt, gemini, kimi, deepseek, perplexity, ollama, llamacpp).
- Ring fills with cooldown progress; center shows **live ticking H:MM:SS** (client-side 1s tick from `ready_at_iso` — no server polling needed for the countdown itself).
- Color states: green **ACTIVE** (steady glow), red **COOLDOWN** (ring drains toward unlock), amber **RECOVERING** (rolling-window providers regaining messages), blue **LOCAL** (Ollama/llama.cpp, pulse dot), grey **UNKNOWN**.
- Under the ring: limits line (`45 msg / 5h · ~1 msg / 7.1 min`) from the matrix.
- Click → quick action popover: `3hr · 5hr · until midnight · custom time · mark ACTIVE` (existing PATCH API).

### 2.2 `RecoveryTimeline.tsx` — unlock ribbon
- Horizontal next-8-hours axis with a moving "NOW" cursor.
- A marker per cooled-down provider at its unlock time; daily-reset providers show their reset tick (08:00 UTC Gemini etc.).
- Instantly answers "who comes back next, and when."

### 2.3 `MatrixTicker.tsx` — live registry strip
- The `matrix_line` (`CLAUDE: COOLDOWN UNTIL 18:30 · CHATGPT: ACTIVE …`) as a monospace ticker with blinking live-dot, `updated HH:MM` clock, and copy button — the §1.2 header, paste-ready into any AI chat.

### 2.4 `ContextRadar.tsx` — workspace interceptor view (§2)
- Three root columns (app / core / data) showing files modified in the last 2h with ext chips, relative time, token-estimate bars, and per-root + grand-total est. token burn.
- Window selector (1h / 2h / 6h / 24h). Empty roots show "configure in Settings → Hybrid Workspace" link.

### 2.5 `HandoffConsole.tsx` — save-state generator (§4)
- Big "GENERATE SAVE-STATE" action → renders the strict `auto_handoff.md` block in a terminal-style preview, with Copy + "written to disk" path confirmation.
- Shows last-handoff timestamp and the **auto-handoff-on-cooldown** armed/disarmed indicator (existing setting).

### 2.6 `TelemetryHealth.tsx`
- `ai_status.json` kernel path + mirror status (reuse `GET /api/telemetry`), manual sync button, last-export time.

### Wiring
- Route in `App.tsx` (`/deck`), nav entry "Command Deck" in `AppLayout.tsx` (gauge icon).
- Registry polled every 30s, context every 60s; countdowns tick locally every second.
- **Dashboard upgrade:** replace `ProviderMatrixWidget`'s badge grid internals with a compact mini-gauge strip (same data hook) linking to `/deck` — the always-visible indicator you wanted.

---

## Phase 3 — Polish & tests

- Command palette entries: "Open Command Deck", "Generate handoff", "Mark <provider> cooldown".
- Optional: HOOT mascot reacts (concerned owl) when a provider enters cooldown.
- Tests (`tests/`): rolling-window vs daily-reset math (UTC reset computation), `progress`/`seconds_remaining` correctness, context-radar ext/age filtering and ignore rules, `/api/workspace/context` response shape.
- `npm test` + `vite build` green.

---

## Explicit non-goals (same scope guards as the hybrid plan)
- No scraping real provider usage counters (Phase E remains deferred); gauges run on manual marks + clock math, clearly labeled "last updated".
- No hard-coded `c:/web/hermes-*` paths — roots stay user-configured.
- No prose-ban on coach UX; terse mode stays exports-only.

## Effort
| Phase | Size |
|---|---|
| 1 — matrix + context-radar + module entry | ~4 hrs |
| 2 — Command Deck UI | ~1 day |
| 3 — polish + tests + build | ~3 hrs |
