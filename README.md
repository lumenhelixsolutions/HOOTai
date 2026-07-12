# HOOTai

<p align="center">
  <a href="https://lumenhelix.com">
    <img src="docs/assets/lumenhelix-logo.svg" alt="LumenHelix Solutions" width="180">
  </a>
</p>

<h3 align="center">Local AI command center for project-aware agent stacks</h3>

<p align="center">
  <a href="https://lumenhelixsolutions.github.io/HOOTai/">
    <img src="https://img.shields.io/badge/Launch_Page-HOOTai-00D4FF?style=flat-square&logo=githubpages&logoColor=white" alt="Launch Page">
  </a>
  <a href="https://lumenhelix.com">
    <img src="https://img.shields.io/badge/Built_by-LumenHelix-7C3AED?style=flat-square" alt="Built by LumenHelix">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-8A95A8?style=flat-square" alt="License">
</p>

---

**HOOTai** is part of the [LumenHelix Solutions](https://lumenhelix.com) portfolio — applied symbolic dynamics & reversible computation for deterministic, traceable AI systems.

HOOTai is the LumenHelix local AI command center. It scans your machine, discovers projects, evaluates agent stacks, monitors launched profiles, and remembers outcomes — all without runtime npm dependencies for the server. The React + Vite UI in ui/ adds a modern operator dashboard and conversational coach.

## Why this exists

- **Own your stack.** Local-first, zero server runtime dependencies, no cloud telemetry.
- **Launch safely.** Only approved Markdown profile blocks execute; dangerous patterns are preview-warned.
- **Learn continuously.** Memory.md captures outcomes so the system avoids repeating failures.

## Quick start

Install and run HOOTai in under two minutes.

### macOS / Linux

```bash
# Clone
git clone https://github.com/lumenhelixsolutions/HOOTai.git
cd HOOTai

# Install & run
npm install
npm test
node server.js
```

### Windows (PowerShell)

```powershell
# Clone
git clone https://github.com/lumenhelixsolutions/HOOTai.git
Set-Location HOOTai

# Install & run
npm install
npm test
node server.js
```

### Windows (Git Bash / WSL)

```bash
git clone https://github.com/lumenhelixsolutions/HOOTai.git
cd HOOTai
npm install
npm test
node server.js
```

> **Device note:** HOOTai is tested on Windows 11, macOS Sonoma, Ubuntu 22.04/24.04, and modern mobile browsers.

## Full documentation

Visit the launch page for architecture, API reference, and deployment guides:  
**https://lumenhelixsolutions.github.io/HOOTai/**

## Features

| Feature | What it gives you |
|---------|-------------------|
| System Scan | Detects installed AI agents, Ollama models, local backends, API keys, and hardware specs. |
| Goal Planner | Ranks launch profiles by goal: privacy, speed, cost, heavy refactor, or safe audit. |
| Monitored Launch | Runs profile PowerShell scripts in tracked child processes with live terminal output. |
| Memory System | Auto-learns from successes/failures via memory.md and blocks repeatedly failing profiles. |

## Architecture at a glance

```
HootAi/
├── server.js        Node.js HTTP server, router, session manager
├── scanner.ps1      PowerShell system probe
├── advisor.js       Rule-based + optional Gemini advisor
├── chat.js          Session-based coach chat
├── profiles/*.md    Launch profiles with frontmatter + PowerShell blocks
├── ui/              React + Vite operator dashboard
└── tests/           Node.js built-in test suite
```

## Development

```bash
# Server (zero runtime deps)
npm test
node server.js

# UI dev (new terminal)
cd ui && npm install && npm run dev
```

## Roadmap

- [ ] Coach-graph sidecar for multi-step planning
- [ ] MCP allowlist and git catalog curation
- [ ] Portfolio health dashboard integration

## Support & consulting

Need deterministic AI systems with full traceability? LumenHelix builds reversible computation kernels, governance layers, and end-to-end AI integrations.

- **Website:** https://lumenhelix.com
- **Services:** AI diagnostics, B.Y.O. support packages, governance audits
- **Research:** TEN² kernel, R.U.B.I.C. boundary discipline, C.O.R.E. constraint lens

## License

Released under the MIT License.

---

<p align="center">
  <sub>Engineered by <a href="https://lumenhelix.com">LumenHelix Solutions</a> — Applied Symbolic Dynamics & Reversible Computation.</sub>
</p>
