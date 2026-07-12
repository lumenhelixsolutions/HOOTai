# Plan: HOOT Local Operator — Always-On, MCP Powers, No Coding

**Status:** PR1–PR4 executed (local brain, app ops, MCP read bridge, native tool loop + audit)
**Date:** 2026-06-10  
**Goal:** HOOT always works on **local AI**, with **MCP-level situational awareness** and **exceptional app operation** — reasoning and orchestration, **not** a coding agent.

### Locked decisions

| Decision | Choice |
|----------|--------|
| MCP scope v1 | **Git read-only** + **read-only filesystem for HOOT root** (`memory.md`, `profiles/`, `state/`, `logs/`) |
| Local brain default | **Auto-use Ollama** when scan detects it |
| Tool format v1 | **JSON `commands` blocks** in PR1 (works on every local model); native Ollama tool loop in PR4 |
| No operator model loaded | **Auto-pull `llama3.2:3b`** via `ollama pull` when Ollama present but no suitable model |
| Memory writes | **HOOT can append structured evidence blocks** to `memory.md` (not freeform file edit) |
| Launch policy | **`safe-audit` / `read-only` profiles** + **monitoring / terminal sessions** — no coding/refactor profiles |
| Execution | **Ready** — say `execute PR1` to start |

---

## Problem today

| What works | What's missing |
|------------|----------------|
| Always-visible mascot + proactive hints | Coach LLM needs cloud key or falls back to **rules** (not real reasoning) |
| `pageContext` + operator loop guidance | Chat commands mostly **navigate** — `launch`, `setMemory`, `generatePlan` not wired |
| MCP git injected into **launched agents** | **Coach has zero MCP tools** — can't read repo/files for context |
| Safe-audit profiles block coding agents | No **operator mode** for HOOT itself |

**Bottom line:** HOOT advises; it doesn't **operate** with local intelligence + file awareness.

---

## Design principles

1. **Local-first** — Ollama or llama.cpp is the default coach brain when detected; cloud is optional upgrade.
2. **Operator, not coder** — HOOT runs the command center; coding agents run in Sessions under governance.
3. **Two tool classes** — App tools (HOOT APIs) + MCP tools (read-only file/repo awareness).
4. **Allowlist everything** — Server enforces what HOOT can do; LLM proposes, server executes.
5. **Exceptional app UX** — Prefer `emitCoachAction`, real launches, scan, memory — over generic chat.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  HootMascot (always on)                                           │
│    CoachThread ──POST /api/chat──► chat.js                        │
│         │                              │                          │
│         │                    ┌─────────┴─────────┐                │
│         │                    ▼                   ▼                │
│         │            Local LLM loop      coach-operator.js       │
│         │            (Ollama/llama)      (tool executor)         │
│         │                    │                   │                │
│         │                    └─────────┬─────────┘                │
│         │                              ▼                          │
│         │                    coach-mcp.js (read-only MCP client)   │
│         │                    git · filesystem(read) · fetch(opt)   │
│         └──── emitCoachAction / navigate ◄── app tool results     │
└──────────────────────────────────────────────────────────────────┘
```

### Layer 1 — Local brain (always works)

| Piece | Change |
|-------|--------|
| `advisor.js` | Add `ollama` + `llamacpp` providers using scan-detected endpoints |
| `key-vault.js` | `resolveProviderKey('ollama')` → always OK (no key) |
| `chat.js` | Default provider = `ollama` when `scan.tools.ollama.present`, else `llamacpp`, else `coach-local` |
| Settings UI | "HOOT brain" section: auto (default) / ollama / llamacpp / cloud |
| Model pick (auto) | `settings.hoot_brain.ollama_model` → else loaded `llama3.2*` / `qwen2.5*` / `phi*` → else **auto-pull `llama3.2:3b`** |

**Auto-selection logic:**

```
scan.tools.ollama.present?
  YES → provider=ollama, endpoint=http://127.0.0.1:11434/v1
        model = settings.hoot_brain.ollama_model
             || bestLoadedOperatorModel(scan)
             || autoPull('llama3.2:3b')   // background ollama pull + retry
  NO  → scan.tools.llamacpp.server?
        YES → provider=llamacpp
        NO  → coach-local (rules)
```

**Auto-pull behavior:** On first HOOT start when Ollama is up but no suitable model: run `ollama pull llama3.2:3b` (non-blocking UI toast "HOOT is fetching local brain…"), poll until loaded or timeout → fall back to rules.

**Fallback chain:** Ollama (auto) → llama.cpp server → rule-based `coach-chat.js` (never dead).

### Layer 2 — App operator tools (HOOT-native, no MCP)

New **`coach-operator.js`** — allowlisted commands executed server-side:

| Tool | Action | Coding? |
|------|--------|---------|
| `navigate` | Return route for UI | No |
| `runScan` | `POST /api/scan` | No |
| `getStatus` | Scan + profiles + sessions + radar summary | No |
| `launchProfile` | `POST /api/launch/:id` — **only** `read-only` / `safe-audit` / `monitoring` / terminal-session profiles; block `coding` / `heavy-refactor` tiers | No |
| `switchProject` | `POST /api/active-project` | No |
| `readMemory` | `GET /api/memory` | No |
| `appendMemory` | Append structured evidence block to `memory.md` (typed template: observation / blocker / outcome) | No |
| `makePlan` | `POST /api/plan` | No |
| `setMcpEnabled` | Toggle allowlisted MCP server | No |
| `coachAction` | Map to `emitCoachAction` targets (scan-run, launch-staged, etc.) | No |
| `getPrefab` | Inventory state | No |
| `getActivity` | Today's diary | No |

**Blocked always:** `shell`, `writeFile`, `editFile`, `launchCodingProfile`, `exec`, `npm`, `git push`.

**Launch allowlist** (`coach-operator.js`):

```js
const OPERATOR_LAUNCH_OK = (profile) => {
  const mode = profile.task_mode || profile.frontmatter?.task_mode;
  const tier = profile.task_tier || 'light';
  if (['coding', 'heavy-refactor', 'refactor'].includes(mode)) return false;
  if (['safe-audit', 'read-only', 'operator', 'monitoring'].includes(mode)) return true;
  if (mode === 'monitoring' || profile.tags?.includes('terminal-session')) return true;
  return tier === 'light' || tier === 'safe-audit';
};
```

Wire via:
- `POST /api/coach/execute` (server)
- Expand `HootMascot.executeCmd` + `CoachThread` to call it
- Tool-calling loop in `chat.js` when local LLM supports function calling (Ollama tools API)

### Layer 3 — MCP powers (read-only, scoped)

New **`coach-mcp.js`** — MCP client **for HOOT coach only** (separate from agent launch env):

| MCP server | HOOT operator use | Risk | Default |
|------------|-------------------|------|---------|
| `mcp-server-git` | diff, log, blame, status on active project | Low | **On** |
| `filesystem-read` (HOOT root only) | Read `memory.md`, `profiles/*.md`, `state/*.json`, `logs/`, scan cache | Low | **On** |
| `mcp-server-fetch` | Docs/URLs user asks about | Medium | Off |

**v1 scope (locked):** MCP filesystem is **HOOT install root only** — not arbitrary project trees. Repo context comes from **git MCP** on active project.

**Policy (`state/mcp-catalog.json` extension):**

```json
{
  "id": "filesystem-hoot",
  "package": "mcp-server-filesystem",
  "operator_allowed": true,
  "read_only": true,
  "roots": ["{{HOOT_ROOT}}"],
  "allowed_paths": ["memory.md", "profiles", "state", "logs", "skills/compound-engineering/cache"],
  "deny_write": true
}
```

**Not allowed for operator:** write, delete, execute, terminal MCP, arbitrary shell.

Tool loop:
1. User asks "why is my profile blocked?"
2. HOOT calls `readMemory` + MCP `git diff` + `getStatus`
3. Reasons locally, suggests `navigate /memory` or `launchProfile local-safe-audit-*`

### Layer 4 — Operator persona (no coding)

**System prompt** (`chat.js`):

```
You are HOOT Operator — local ops owl for this command center.

YOU DO: explain screens, run scans, read repo/memory, recommend safe-audit profiles,
        navigate, stage launches, monitor sessions, manage modules/MCP policy.

YOU DO NOT: write code, edit source files, run shell, launch coding/refactor profiles,
             use write/delete MCP tools, or act as a coding agent.

When the user wants code changes, route them: Profiles → safe coding agent in Sessions.
Prefer app tools over prose. Use MCP only to read context.
```

**Profile taxonomy addition:**

| `task_mode` | Who | Can code? |
|-------------|-----|-----------|
| `operator` | HOOT coach | **No** — app + read MCP only |
| `safe-audit` | Launched session | Read-only agent |
| `coding` | Launched session | Yes (external agent) |

Optional `profiles/hoot-operator-ollama.md` — if user wants a **terminal** read-only analyst under HOOT (still not HOOT coach).

---

## Local AI tool-calling strategy

Ollama supports OpenAI-compatible `/v1/chat/completions` + tools. Two implementation paths:

### Path A — Prompt-based commands (v1, **locked**)

Keep ` ```json commands``` ` blocks; expand executor to cover all app tools. Works on any local model including freshly pulled `llama3.2:3b`.

### Path B — Native tool loop (PR4)

`chat.js` runs multi-turn: LLM → tool call → result → LLM until done. Requires model with tool support.

**Locked:** Ship **A** in PR1–PR3, **B** in PR4.

---

## Execution plan (4 PRs)

### PR1 — Local brain + command executor (foundation)

- `advisor.js`: `ollama`, `llamacpp` providers
- Auto-detect default provider from last scan
- `coach-operator.js` + `POST /api/coach/execute`
- Wire `launchProfile`, `runScan`, `makePlan`, `readMemory`, `navigate`, `coachAction`
- Settings: "HOOT brain" selector
- Operator system prompt + policy tests

**Success:** HOOT chat works offline with Ollama; "run scan" and "launch safe audit" actually execute.

### PR2 — App operation excellence

- Map all `emitCoachAction` targets to `coachAction` tool
- `CoachThread` shows tool execution status ("HOOT ran scan…")
- Dashboard/Scan/Modules context auto-injected into every chat turn
- HOOT can complete full operator loop via chat: scan → recommend profile → launch → open sessions

**Success:** User can drive HOOT through a full session without clicking sidebar.

### PR3 — MCP read bridge

- `coach-mcp.js`: spawn `uvx mcp-server-git` + read-only filesystem MCP
- Add `filesystem-read` to `mcp-catalog.json` with root scoping
- `GET /api/coach/tools` — list available operator tools for UI/debug
- Integrate MCP results into chat context (file excerpts, git log snippets)

**Success:** "What changed in my repo?" answered from live git MCP, not hallucination.

### PR4 — Native tool loop + monitoring

- Ollama tools API multi-turn loop
- Operator audit log: `state/hoot-operator-log.json` (every tool call, blocked attempt)
- UI: Settings → Operator policy (read roots, enabled MCP, blocked commands)
- Coach hint when external agent detected: offer to consolidate via Launch Center

**Success:** HOOT feels like a local AI ops agent with file awareness and full app control.

---

## Security model

| Threat | Mitigation |
|--------|------------|
| LLM launches destructive profile | Server checks `task_mode` + `taskTiers` before launch |
| LLM writes files via MCP | Only read-only MCP roots; no write tools in operator allowlist |
| LLM runs shell | No shell tool in schema; execute endpoint rejects |
| LAN exposure | Existing HOOT token auth; operator execute requires same auth |
| Prompt injection via repo file | MCP excerpts truncated; system prompt reinforces operator role |

---

## What HOOT operator does NOT do

- Write or refactor code
- Edit arbitrary files on disk
- Replace Codex/Claude/Cursor for coding
- Run without allowlisted tools (no raw PowerShell from coach)

Coding stays in **Sessions** with explicit profiles. HOOT **operates the app** and **reads** the environment.

---

## Remaining open (minor)

1. **Active project git** — default to `activeProject` path; confirm with user only when none set.

---

## Refined operator scenarios (what "operate exceptionally" means)

| User says | HOOT does (tools) |
|-----------|-------------------|
| "What's wrong with my setup?" | `runScan` + `getStatus` + read `memory.md` via MCP fs |
| "Why is X profile blocked?" | MCP fs read profile + memory evidence + explain |
| "Launch a safe audit on this repo" | `makePlan` → `launchProfile` (safe-audit) → `navigate /terminal` |
| "Open my live session" | `launchProfile` (monitoring/terminal) or `navigate /terminal` |
| "Log this blocker" | `appendMemory` with structured evidence block |
| "Sync my CE skills" | `coachAction: module-sync` or `navigate /modules` + explain steps |
| "What agents are running outside HOOT?" | `getStatus` (radar) + `navigate /scan` |
| "Write me a function to…" | **Refuse** — redirect to Sessions + coding profile |

---

## Success criteria

- HOOT coach works with **zero cloud keys** when Ollama is running
- User can say "scan my system and launch a safe audit" → it happens
- HOOT can read git state and memory via MCP for grounded answers
- Zero code writes from coach path in tests and audit log
- Operator loop completable via chat alone on a fresh machine