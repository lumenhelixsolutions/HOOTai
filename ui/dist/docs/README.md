# HOOT — Local AI Command Center

<p align="center">
  <img src="ui/public/hoot-favicon.svg" alt="HOOT owl mark" width="88" />
</p>

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()

> **HOOT** is your local AI command center — project-aware agent stack scanner, planner, Markdown memory core, research watch, monitored terminal, and launcher. (Technical package name remains `agentdock`.)

## Rebrand note

**AgentDock** is now **HOOT — Local AI Command Center**.

| What changed | Details |
|--------------|---------|
| **Product name** | HOOT (sidebar, browser title, docs) |
| **Subtitle** | Local AI Command Center |
| **Mascot** | My Ops OWL — head-only ASCII coach with screen awareness |
| **Logo** | Custom owl mark (`ui/src/components/HootMark.tsx`, favicon `ui/public/hoot-favicon.svg`) |

**Unchanged (on purpose):** npm package name `agentdock`, `AGENTDOCK_*` environment variables, `/api/*` routes, and launch profile internals. Existing scripts and env configs keep working.

**Portfolio path:** store and work on this project in `D:/projects/HootAi/` (not `agentdock/`). Git remote remains `lumenhelixsolutions/agentDOCK`.

If you have bookmarks or docs pointing at “AgentDock”, read them as HOOT — same local engine, new identity.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [API Reference](#api-reference)
- [Tests](#tests)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Safety Model](#safety-model)
- [Rebrand note](#rebrand-note)
- [Changelog](#changelog)
- [Contributing](#contributing)

## Features

- 🔍 **System Scan** — Detects installed AI agents, Ollama models, local backends, API keys, and hardware specs.
- 🎯 **Goal Planner** — Ranks launch profiles by goal: privacy, speed, cost, heavy refactor, or safe audit.
- 🚀 **Monitored Launch** — Runs profile PowerShell scripts in tracked child processes with live terminal output.
- 💬 **HOOT Coach** — Chat with HOOT for stack recommendations, setup help, and app control.
- 🧠 **Memory System** — Auto-learns from successes/failures via `memory.md` and blocks repeatedly failing profiles.
- 📁 **Project Registry** — Discovers local projects, reads Git status, detects `AGENTS.md`, and suggests stacks per project type.
- 📚 **Research Watch** — Periodically pulls briefs from configured sources.
- 🔥 **Token Burn Prevention** — RTK risk panel on Overview and Readiness; ingest `rtk gain` savings locally.
- 📡 **Agent Radar** — System-wide scan for running coding agents (docked vs external).
- 🌗 **Dark / Light Theme** — Toggle between dark and light UI modes.
- ⌨️ **Keyboard Shortcuts** — Full keyboard navigation support.

## Requirements

- [Node.js](https://nodejs.org/) >= 18.0.0
- Windows, macOS, or Linux
- PowerShell (`powershell.exe` or `pwsh`) for running scanner and launch profiles

## Install

No npm dependencies required. Just clone and run:

```bash
cd D:/projects/Hoot
node server.js
```

Or on Windows:

```powershell
pwsh D:\projects\scripts\start-hoot.ps1
```

Double-click `start-hoot.bat`. **Do not** run from `D:\projects\agentdock` (legacy mirror).

Open `http://127.0.0.1:7777` in your browser.

## Usage

| Action | How |
|--------|-----|
| **Scan** | Click "🔍 Scan" to detect installed agents, models, env keys, and hardware. |
| **Plan** | Choose a goal (privacy, fastest, cheapest, heavy, audit) to get ranked profile recommendations. |
| **Launch** | Select a profile and click Launch. Review the preview first if dangerous patterns are detected. |
| **Chat** | Click the HOOT owl button bottom-right for interactive help. |
| **Research** | Run the research watch to pull latest briefs from configured sources. |
| **Theme** | Click the 🌓 button in the header to toggle dark/light mode. |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Focus project search |
| `Ctrl + /` | Show / hide keyboard shortcuts help |
| `Ctrl + .` | Toggle dark / light theme |
| `Esc` | Close chat or modal |
| `Ctrl + Enter` | Send chat message |
| `Ctrl + 1` | Switch to Easy mode |
| `Ctrl + 2` | Switch to Advanced mode |
| `Ctrl + S` | Run system scan |

## API Reference

AgentDock exposes a localhost-only REST API on `http://127.0.0.1:7777`.

### Status

```http
GET /api/status
```

Returns `{ ok: true, version: "2.0.0" }`.

### Scan

```http
GET /api/scan?repo=<path>
```

Runs the PowerShell scanner and returns JSON with system, hardware, env keys, coders, and Ollama status.

### Profiles

```http
GET /api/profiles
GET /api/profile/:id
GET /api/profiles/matrix
GET /api/profiles/groups
GET /api/profiles/cookbook
GET /api/profiles/cookbook/:id
GET /api/profiles/combinations
GET /api/templates
```

### Launch

```http
POST /api/launch/:id
Body: { dryRun?: boolean, overrideReason?: string }
```

Returns `{ launched: true, session: { ... } }` or `{ blocked: true, message: ... }`.

### Sessions

```http
GET /api/sessions
GET /api/session/:id/output?since=0
POST /api/session/:id/input
POST /api/session/:id/stop
POST /api/session/:id/outcome
```

### Projects

```http
GET /api/projects
POST /api/projects/discover
POST /api/active-project
GET /api/active-project
GET /api/project/:path/agents-md
GET /api/project/:path/git-status
```

### Memory & Logs

```http
GET /api/memory
POST /api/memory
GET /api/logs
GET /api/log/:name
GET /api/usage
```

### Chat

```http
POST /api/chat
GET /api/chat/history?session=<id>
POST /api/chat/clear
```

### Advisor & Research

```http
POST /api/advisor/analyze
POST /api/research/run
GET /api/research/latest
```

### LAN access

```bat
set AGENTDOCK_LAN=1 && node server.js
```

Optional firewall (Windows): `netsh advfirewall firewall add rule name="HOOT LAN" dir=in action=allow protocol=TCP localport=7777`

Generate a HOOT token in **Settings → Network** when exposing LAN. Localhost (`127.0.0.1`) always bypasses auth.

### Activity

```http
GET /api/activity?from=2026-06-01&to=2026-06-10
GET /api/activity/today
POST /api/activity/emit
POST /api/activity/diary
```

### Token Burn

```http
GET /api/token-burn
GET /api/token-burn?refresh=1
```

Returns RTK prevention report: risk level, shell-heavy agents, RTK-tagged profiles, recommendations, and optional `rtk gain --all --format json` data. Pass `refresh=1` to re-run `rtk gain` when RTK is installed (requires a prior scan).

### Agent Radar

```http
GET /api/agent-radar
GET /api/agent-radar?force=1
```

Returns running coding-agent processes (Claude, Codex, Cursor, etc.) with docked vs external counts. Cached ~20s; `force=1` bypasses cache.

### Other

```http
GET /api/catalog
GET /api/suggestions
GET /api/mcp
GET /api/portfolio/health
POST /api/race
```

## Tests

```bash
npm test
# or
node --test tests/*.test.js
```

Tests cover:
- Scanner JSON schema validation
- Profile frontmatter and PowerShell block validation
- Server health endpoint and API smoke tests
- Memory.md structure and evidence parsing
- Ollama `ps` output parsing and model normalization

To add a new test file, create `tests/<name>.test.js` using `node:test` and `node:assert`.

## Architecture

```
┌─────────────┐
│  index.html │  ← Dashboard UI (dark/light themes, keyboard shortcuts, a11y)
└──────┬──────┘
       │ HTTP (localhost only)
┌──────▼──────┐
│  server.js  │  ← Router, session manager, evaluator
└──────┬──────┘
       │
  ┌────┼────┬────────┬─────────┐
  ▼    ▼    ▼        ▼         ▼
scanner.ps1 advisor.js chat.js profiles/*.md
   │                    │           │
   ▼                    ▼           ▼
  JSON              Gemini API   launch blocks
   │                    │           │
   └────────────────────┴───────────┘
              │
         memory.md
         state/*.json
         logs/*.md
```

| Component | Responsibility |
|-----------|--------------|
| `server.js` | HTTP server, route handler, session manager, project registry, stack evaluation |
| `scanner.ps1` | PowerShell probe — tools, env vars, Ollama models, hardware |
| `advisor.js` | Rule-based + optional Gemini-powered operations advisor |
| `chat.js` | Session-based chat controller with structured command responses |
| `profiles/*.md` | Launch profiles with frontmatter metadata and PowerShell blocks |
| `memory.md` | Local learning layer — successes, failures, ethos, avoided loops |
| `index.html` | Single-page dashboard with responsive layout, theming, and keyboard shortcuts |

## Deployment

AgentDock is designed to run **locally only**. It binds to `127.0.0.1:7777` by default.

### Custom Port

```bash
set AGENTDOCK_PORT=8888 && node server.js
```

### Background Service (Windows)

Use `nssm` or Task Scheduler to run `start-agentdock.bat` on login.

### Reverse Proxy (Advanced)

If exposing through a reverse proxy, ensure:
- Authentication is enforced at the proxy layer.
- WebSocket support is not required (AgentDock uses HTTP polling).
- The proxy sets `X-Forwarded-For` for logging if desired.

> ⚠️ **Do not expose HOOT directly to the public internet.** It has no built-in authentication and executes PowerShell scripts.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTDOCK_PORT` | HTTP server port | `7777` |
| `AGENTDOCK_DEBUG` | Include stack traces in 500 responses | `undefined` |
| `GEMINI_API_KEY` | Gemini API key for AI advisor & chat | `undefined` |
| `GOOGLE_API_KEY` | Fallback for Gemini API key | `undefined` |

## Safety Model

- Binds to `127.0.0.1` only.
- No cloud telemetry.
- No arbitrary shell command box.
- No secret values printed — key names and provider hints only.
- Launches only profile-defined command blocks.
- Dangerous patterns are preview-warned.
- Terminal sessions are logged locally.
- Auto-blocks profiles after repeated failures on the same project.

## Changelog

### v2.3.0 — LAN + Activity diary + mascot
- `AGENTDOCK_LAN=1` binds on all interfaces; optional HOOT token for LAN clients.
- Activity log (`/api/activity`), diary `.md` files, Activity page with calendar heatmap.
- Single geometric HOOT mascot (green-glow eyes) — sidebar + animated coach.

### v2.2.0 — Token burn v1
- `GET /api/token-burn` — local RTK prevention layer from scan + `rtk gain`.
- Token burn panel on Overview and Readiness; HOOT coach hints and high-risk alerts.
- Agent radar API documented alongside burn module.

### v2.1.0 — HOOT rebrand
- User-facing rebrand from AgentDock to **HOOT — Local AI Command Center**.
- Custom owl logo, favicon, and wordmark; mascot line **My Ops OWL**.
- System-wide agent radar, head-only HOOT ASCII, coach awareness upgrades.
- Render perf: throttled pupil tracking, debounced hints, background poll pausing.

### v2.0.0
- Project-aware registry with Git status, AGENTS.md detection, and portfolio health.
- Automated smoke tests using Node.js built-ins (`node:test`, `node:assert`).
- AGENTS.md for agent onboarding and architecture context.
- `/api/status` health endpoint.
- Dark / light theme toggle with CSS custom properties.
- Loading overlay and error toasts.
- Keyboard shortcuts (`Ctrl+K`, `Ctrl+/`, `Ctrl+.`, etc.).
- Accessibility improvements (skip link, focus-visible, ARIA labels, semantic roles).
- Mobile-responsive layout refinements.
- Expanded README with API reference, deployment guide, and environment variables.

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Add or update tests in `tests/`.
4. Run `npm test` and ensure all tests pass.
5. Commit with a clear message and push.

Please keep the zero-dependency constraint for the server runtime. Frontend enhancements are welcome as long as `index.html` remains self-contained.
