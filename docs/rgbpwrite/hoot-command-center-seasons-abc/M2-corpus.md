# M2 — Corpus & inventory

**Owners:** Blue + Green  

## Primary code (implementation-tested)

| Path | Role |
|------|------|
| `HootAi/server.js` | HTTP routes, scan timeout, vitals/agents, coach execute, workflows |
| `HootAi/hoot-brain.js` | Local brain resolve, gemma-first, migrate cloud→auto |
| `HootAi/chat.js` | HITL propose, extractCommands, scrubFalseExecutionClaims |
| `HootAi/coach-tools.js` | AUTO vs HITL tools |
| `HootAi/coach-workflows.js` | Multi-step workflows C1 |
| `HootAi/coach-approval-log.js` | Timeline soft+hard+propose/deny |
| `HootAi/coach-mcp.js` | Vault read-only C4 |
| `HootAi/coding-agent-detect.js` | Claude/OmniRoute detect-only |
| `HootAi/ui/src/lib/app-shell.ts` | B1 hubs |
| `HootAi/ui/src/context/ExecutiveControlContext.tsx` | Global HITL queue |
| `HootAi/ui/src/components/shell/*` | HealthStrip, ApprovalSheet, PendingDock, ScreenBind |
| `HootAi/ui/src/pages/Dashboard.tsx` | Operator spine A3 |
| `HootAi/ui/src/pages/BenchPage.tsx` | Vitals chapters B2 |
| `HootAi/ui/src/pages/SettingsPage.tsx` | Essentials/Expert B3 |
| `HootAi/ui/src/pages/ApprovalsPage.tsx` | Workflows + timeline C3 |
| `HootAi/ui/src/pages/PortfolioPage.tsx` | Fleet narrative D1 |
| `HootAi/ui/src/lib/hoot-metrics.ts` | Client success metrics D3 |
| `HootAi/AGENTS.md` | Season notes |

## Tests

| File | Coverage |
|------|----------|
| `tests/hoot-brain.test.js` | gemma rank, migrate |
| `tests/extract-commands.test.js` | flexible JSON, scrub claims |
| `tests/coding-agent-detect.test.js` | detect-only agents |
| `tests/coach-workflows.test.js` | workflows + vault policy |

## Prior art / related

- Portfolio `docs/UIUX_EVOLUTION_10_ROUND.md` (other products; HOOT separate track)  
- OOTBIJS skill doctrine  
- Obsidian vault `D:\akashic` as knowledge plane (not shell)  

## Live smoke (this session)

- `GET /api/status` ok  
- `GET /api/coach/brain` ready, `gemma4:latest`  
- `POST /api/chat` → ollama source, HOOT_LOCAL_OK  
- Workflows list + start prepare-local-audit  
- UI production builds green