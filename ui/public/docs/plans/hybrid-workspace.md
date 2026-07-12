# HOOT Hybrid Workspace & Cooldown Monitor — Integration Plan

> **Shipped** — Full A–D implemented 2026-06-11. HOOT-native telemetry at `state/ai_status.json` (optional mirror via workspace data root).

**Date:** 2026-06-11  
**Source concept:** All-in-One Hybrid Workspace & Cooldown Monitor (multi-provider rotation, token efficiency, handoff packets)  
**Target:** HOOT (`agentdock`) as the local command center — not a copy-pasted system prompt inside each cloud AI.

---

## Executive summary

Your concept solves a real problem HOOT was already circling: **rotating across Claude, ChatGPT, Gemini, and Kimi while preserving context and not wasting quota.** HOOT already tracks agents (radar), token burn (RTK), projects (registry), and re-entry artifacts (project-brain). What's missing is a **unified provider cooldown registry**, a **standard handoff packet**, and **workspace boundary rules** wired into the UI and coach — not buried in a prompt only one model sees.

**Recommendation:** Ship **Option A+B** — Provider Registry + Handoff Packet first (high value, low risk), then Workspace Roots in a follow-up.

---

## 1. Concept analysis (your 4 sections → HOOT mapping)

| Your section | Intent | HOOT today | Gap |
|--------------|--------|------------|-----|
| **§1 Cooldown & Resource Tracker** | Know which cloud account is usable *right now* | Radar sees running agents; token-burn tracks RTK savings; no message-window limits | No Claude 45/5hr, GPT 80/3hr, Kimi freeze tracking |
| **§2 Workspace Boundaries** | Pin work to 3 trees; no prose; minimal diffs | `state/projects.json` + active project; profiles launch agents; project-brain schema exists | No enforced roots (`hermes-app/core/data`); no "prose ban" mode for exports |
| **§3 Handoff Packet** | Copy-paste save state when switching providers | `memory.md` evidence; `.agentdock/project-brain/current-state.md` spec; activity diary | No single strict template; coach doesn't auto-emit packet |
| **§4 Initialization** | Inject cooldowns + directory + prior packet | Settings + scan on boot; coach accepts `pageContext` | No "session bootstrap" form or API |

### Critical design choice

**Do not** paste this entire system prompt into HOOT Coach or launched agent profiles as the primary integration. That would:

- Bloat every coach turn (token cost inside HOOT)
- Drift per model (Claude vs Gemini interpret differently)
- Duplicate data HOOT should own as **structured JSON + UI**

Instead: **HOOT stores state; Coach and profiles read it; handoff is generated from facts.**

---

## 2. What HOOT already has (reuse, don't rebuild)

```
┌─────────────────────────────────────────────────────────────────┐
│  EXISTING HOOT LAYER              │  REUSE FOR THIS FEATURE   │
├───────────────────────────────────┼───────────────────────────┤
│  agent-radar + activity-log       │  "who is running" (dock/   │
│                                   │  external) — not quotas   │
│  token-burn.js + RTK skill        │  Shell token efficiency   │
│  key-vault + hoot-brain           │  Multi-provider keys +    │
│                                   │  Ollama-first coach       │
│  state/projects.json              │  Portfolio project paths  │
│  project-brain schema (AGENTS.md) │  Re-entry + milestones    │
│  memory.md evidence blocks        │  Learned successes/fails  │
│  Stack Builder + profiles         │  Launch right agent when    │
│                                   │  provider becomes ACTIVE  │
│  Activity diary v2                │  Session history + groups │
│  Coach operator tools             │  Extensible tool surface  │
└─────────────────────────────────────────────────────────────────┘
```

**Synergy:** When Claude hits COOLDOWN, HOOT can recommend Gemini or local Ollama profile from stack compatibility — if cooldown registry says they're ACTIVE.

---

## 3. Proposed HOOT-native architecture

### 3.1 New module: `provider-cooldown.js`

Persistent registry in `state/provider-cooldown.json`:

```json
{
  "version": 1,
  "providers": {
    "claude": {
      "label": "Claude Pro",
      "status": "cooldown",
      "cooldown_until": "2026-06-11T18:30:00-04:00",
      "limits_ref": { "messages": 45, "window_hours": 5, "recovery_note": "~1 msg / 7 min" },
      "last_updated": "2026-06-11T17:00:00Z",
      "source": "manual"
    },
    "chatgpt": { "status": "active", ... },
    "gemini": { "status": "active", "boundaries_ok": true },
    "kimi": { "status": "cooldown", "cooldown_until": "..." },
    "ollama": { "status": "active", "source": "scan" }
  },
  "current_session_provider": "gemini",
  "updated_at": "..."
}
```

**Status enum:** `active` | `cooldown` | `unknown` | `local` (Ollama/llama.cpp — always available if scan says so)

**Update paths:**

| Source | How |
|--------|-----|
| Manual | Settings UI + quick actions ("Start cooldown 3hr", "Mark active") |
| Coach tool | `setProviderStatus({ provider, status, until })` |
| API | `PATCH /api/providers/cooldown` |
| Future | Browser extension / usage scrape (Phase D — optional) |

**Limit reference table** (read-only defaults from your §1.1) — used for ETA hints, not auto-enforcement (HOOT cannot see Anthropic's internal counter without user input).

### 3.2 New module: `workspace-roots.js`

Maps your three trees to HOOT **workspace roots** (configurable, not hard-coded `c:/web/`):

```json
{
  "roots": [
    { "id": "app", "label": "Application", "path": "D:/projects/hermes-app", "role": "ui" },
    { "id": "core", "label": "Core logic", "path": "D:/projects/hermes-core", "role": "backend" },
    { "id": "data", "label": "Data & cache", "path": "D:/projects/hermes-data", "role": "data" }
  ],
  "active_root_id": "app",
  "enforce_boundaries": true
}
```

**Portfolio bridge:** Each root can alias a registered project path or subfolder. Default for LumenHelix portfolio: map to active project + standard subtrees (`ui/`, `backend/`, `data/`) when single-repo mode.

**Coach rule injection (terse):** When `enforce_boundaries` is on, coach system context includes:

- Active root path only
- "Prefer minimal diffs; no filler prose in generated handoffs"

This is **not** a global prose ban on HOOT Coach UX (users need readable coach). Terse mode applies to **handoff artifacts and operator exports** only.

### 3.3 Handoff packet: `handoff-packet.js`

Generates your §3.1 layout from structured sources:

| Field | Source |
|-------|--------|
| Target Directory | `workspace-roots.active` or `projects.active.path` |
| Current Goals | `project-brain/current-state.md` or coach session summary |
| Completed Artifacts | Git diff summary (MCP git read-only) + activity session groups |
| Immutable Decisions | `project-brain` "Locked decisions" section or `memory.md` ethos |
| Reasoning Gaps | `project-brain/open-questions.md` or empty |
| Next Immediate Action | User pin or coach last recommendation |

**Output:**

- `POST /api/handoff/generate` → `{ markdown, json, copied_at }`
- Writes optional snapshot: `<active-project>/.agentdock/project-brain/handoff-packet.md`
- Clipboard button in UI

**Strict template** (your format, HOOT-filled):

```markdown
### [PROJECT STATE DUMP - DO NOT TRANSLATE]
- **Target Directory:** …
- **Current Goals:** …
- **Completed Artifacts:** …
- **Immutable Decisions:** …
- **Reasoning Gaps:** …
- **Next Immediate Action:** …
```

### 3.4 UI surfaces

| Surface | Content |
|---------|---------|
| **Dashboard widget: Provider Matrix** | Global Resource Registry header — always visible, color-coded ACTIVE/COOLDOWN |
| **Settings → Hybrid Workspace** | Edit cooldowns, workspace roots, current session provider |
| **Command palette** | "Mark Claude cooldown", "Generate handoff", "Switch active root" |
| **Coach dock** | Pin compact provider strip; on session end suggest handoff |
| **Launch Center** | Filter/rank profiles by provider ACTIVE status |

### 3.5 API summary

| Endpoint | Purpose |
|----------|---------|
| `GET /api/providers/cooldown` | Full registry + computed ETAs |
| `PATCH /api/providers/cooldown` | Manual status update |
| `GET /api/workspace/roots` | Roots + active |
| `PUT /api/workspace/roots` | Configure roots |
| `POST /api/handoff/generate` | Build packet (markdown + JSON) |
| `GET /api/handoff/latest` | Last packet for active project |

---

## 4. Global Resource Registry (UI mock)

Matches your §1.2 header — rendered in dashboard + copyable as markdown:

```
PROVIDER MATRIX · updated 17:04
CLAUDE: COOLDOWN UNTIL 18:30 · CHATGPT: ACTIVE · GEMINI: ACTIVE · KIMI: COOLDOWN UNTIL 20:00 · OLLAMA: ACTIVE
SESSION: Gemini · ROOT: hermes-core · PROJECT: agentdock
```

Click any provider → quick status toggle. Click "Copy registry" → paste into next AI's first message.

---

## 5. Phased implementation

### Phase A — Provider Cooldown Registry (~0.5 day)

- [x] `provider-cooldown.js` + `state/provider-cooldown.json`
- [x] `GET/PATCH /api/providers/cooldown`
- [x] Default limits reference (Claude/GPT/Gemini/Kimi) as read-only docs in module
- [x] Dashboard `ProviderMatrixWidget`
- [x] Settings section: manual cooldown entry (datetime picker + presets: 3hr, 5hr, midnight PT)
- [x] Tests: status transitions, ETA formatting, API validation

**Acceptance:** User marks Claude cooldown → Launch Center deprioritizes `claude-code` profiles → registry visible on Overview.

---

### Phase B — Handoff Packet (~0.5–1 day)

- [x] `handoff-packet.js` + API
- [x] Integrate git diff summary via existing `coach-mcp` read-only git (file list only, no secrets)
- [x] Read `project-brain/current-state.md` when present
- [x] UI: "Generate handoff" on Dashboard, Activity, Coach thread
- [x] Coach tool: `generateHandoff`
- [x] Write snapshot to `.agentdock/project-brain/handoff-packet.md` + `auto_handoff.md`
- [x] Tests: template shape, empty project graceful fallback

**Acceptance:** One click produces paste-ready block matching your §3.1 layout.

---

### Phase C — Workspace Roots (~0.5 day)

- [x] `workspace-roots.js` + settings UI
- [x] Link roots to portfolio projects or custom paths
- [x] Active root shown in registry header + handoff Target Directory
- [x] Coach context includes active root; launch profiles tagged with `workspace_root` in frontmatter (optional)
- [x] Validation: path exists on scan

**Acceptance:** User sets three roots → handoff and registry reference correct tree.

---

### Phase D — Smart routing & initialization (optional, ~1 day)

- [x] Onboarding wizard (`/api/onboarding`) — scan → project → inferred layout → providers → ready
- [x] Boot wizard: "Inject session" form (your §4) — cooldowns + root + paste prior handoff
- [x] Parse inbound handoff markdown → populate `project-brain` draft
- [x] Stack Builder goal: **"Bypass cooldown"** auto-picks ACTIVE provider
- [x] Session-end hook: prompt handoff when radar shows external agent stopped

---

### Phase E — External quota ingest (defer)

- [ ] Chrome extension snippet or manual CSV import for real message counts
- [ ] No dependency on scraping Anthropic/OpenAI ToS-violating automation

---

## 6. Integration with portfolio pipeline

| Portfolio piece | Role |
|-----------------|------|
| `ecc/skills/token-efficiency` | RTK remains shell efficiency; cooldown registry is **provider quota** (orthogonal) |
| `project-brain` schema | Add optional `handoff-packet.md`; extend `current-state.md` with Goals/Gaps |
| `docs/PIPELINE_INTEGRATIONS.md` | Register as Phase 2 HOOT kernel feature |
| Other repos | Each gets `.agentdock/project-brain/` handoff snapshots on session end |

**Hermes path mapping (your `c:/web/`):**

| Your tree | HOOT default (portfolio) |
|-----------|--------------------------|
| `hermes-app/` | `<project>/ui/` or frontend package |
| `hermes-core/` | `<project>/backend/` or `server.js` / core lib |
| `hermes-data/` | `<project>/data/`, `state/`, or `generated/` |

User configures actual paths in Settings; no hard-coded `c:/web/`.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Manual cooldown drifts from reality | Prominent "last updated"; optional reminders; Phase E for real counts |
| Handoff packet leaks secrets | Redact via key-vault rules; git diff paths only; no `.env` contents |
| Prose-ban harms HOOT coach UX | Apply terse mode to **exports only**, not coach conversation |
| Three-root model doesn't fit all repos | Roots optional; fallback to single active project path |
| Over-engineering | Ship A+B first; C only if you use Hermes split trees daily |

---

## 8. Approval options

Reply with one of:

| Choice | Scope |
|--------|-------|
| **A+B** | Provider registry + handoff packet (**recommended**) |
| **A+B+C** | Add workspace roots + boundary tagging |
| **A only** | Cooldown tracking first; handoff later |
| **Full (A–D)** | Include boot wizard + smart routing |
| **Custom** | e.g. "A+B, skip dashboard widget, coach-only" |

**Optional tweaks:**

- Include Ollama/llama.cpp as first-class providers in matrix? (default: **yes**)
- Auto-suggest handoff on coach close? (default: **yes, dismissible**)
- Terse handoff only vs terse coach mode toggle? (default: **handoff only**)

---

## 9. Effort estimate

| Phase | Size |
|-------|------|
| A — Provider registry | S (~4–6 hrs) |
| B — Handoff packet | S–M (~6–8 hrs) |
| C — Workspace roots | S (~4 hrs) |
| D — Boot wizard + routing | M (~1 day) |
| E — External quota ingest | L (research; separate milestone) |

**Total recommended (A+B):** ~1–1.5 days  
**Total with roots (A+B+C):** ~2 days

---

## 10. What we will NOT do (scope guard)

- Replace cloud provider rate limits with HOOT-enforced throttling (HOOT is advisory, not a proxy)
- Embed the full initialization prompt as default coach system text
- Require Hermes directory layout for all portfolio projects
- Scrape Claude/ChatGPT usage without explicit future approval

---

*Shipped Full A–D. HOOT telemetry: `telemetry-bridge.js` exports registry → `state/ai_status.json`; mirrors to `<data-root>/telemetry/ai_status.json` when workspace roots are set.*