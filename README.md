# HOOTai

<p align="center">
  <img src="docs/assets/logo.svg" alt="HOOTai logo" width="160">
</p>

<h3 align="center">Local AI command center for project-aware agent stacks</h3>

<p align="center">Scan your machine, discover projects, evaluate agent stacks, launch safely, and remember what works — all locally.</p>

<p align="center">
  <a href="https://lumenhelixlab.github.io/HOOTai/">Launch Page</a>
  <span> · </span>
  <a href="https://github.com/LumenHelixLab/HOOTai">GitHub</a>
  <span> · </span>
  <a href="https://lumenhelix.com">LumenHelix</a>
</p>

---

HOOTai is the local AI command center for project-aware agent stacks. It scans your machine, discovers projects, evaluates agents and models, monitors launched profiles, and remembers outcomes — keeping every decision local and traceable.

## Why HOOTai

- **Own your stack.** Local-first, zero server runtime dependencies, no cloud telemetry.
- **Launch safely.** Only approved Markdown profile blocks execute; dangerous patterns are preview-warned.
- **Learn continuously.** Memory.md captures outcomes so the system avoids repeating failures.

## Quick start

### macOS / Linux

```bash
git clone https://github.com/LumenHelixLab/HOOTai.git
cd HOOTai
npm install
npm test
node server.js
```

### Windows (PowerShell)

```powershell
git clone https://github.com/LumenHelixLab/HOOTai.git
Set-Location HOOTai
npm install
npm test
node server.js
```

### Windows (Git Bash / WSL)

```bash
git clone https://github.com/LumenHelixLab/HOOTai.git
cd HOOTai
npm install
npm test
node server.js
```

> Tested on Windows 11, macOS Sonoma, Ubuntu 22.04/24.04, and modern mobile browsers.

## Features

| Feature | What it gives you |
|---------|-------------------|
| System scan | Detects installed AI agents, Ollama models, local backends, API keys, and hardware specs in one pass. |
| Goal planner | Ranks launch profiles by goal: privacy, speed, cost, heavy refactor, or safe audit. |
| Monitored launch | Runs profile PowerShell scripts in tracked child processes with live terminal output and preview warnings. |
| Memory system | Auto-learns from successes and failures via memory.md and blocks repeatedly failing profiles. |

## Architecture

```
Machine scan  ->  Project discovery  ->  Agent stack evaluation
       |                                       |
       v                                       v
PowerShell probe  ->  Node server  ->  React Vite UI
       |                   |
       v                   v
Memory.md learning  <-  Monitored launches
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

## License

Released under the MIT License.

---

<p align="center">
  <sub>HOOTai is a <a href="https://lumenhelix.com">LumenHelix</a> project — Applied Symbolic Dynamics & Reversible Computation.</sub>
</p>
