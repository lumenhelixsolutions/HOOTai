# HOOT Coach Graph (Phase 4 sidecar)

Status: **spec + runtime** (Phase 4 active). Kernel remains launch authority; graph is optional sidecar.

## Purpose

LangGraph sidecar for human-in-the-loop launch approval. Patterns borrowed from upstream AgentDock orchestration (reference only).

## First graph

```
scan → score profile → human approve → launch → remember
```

| Node | HOOT API / file |
|------|-----------------|
| `scan` | `GET /api/scan` (redacted) |
| `score` | Profile eval ≥ 80 via stack health |
| `approve` | assistant-ui tool call / Coach confirm card |
| `launch` | `POST /api/launch` with validated profile ID only |
| `remember` | `memory.md` + `state/stack-usage.json` |

## Layout

```
coach-graph/
  README.md
  graph.spec.json
  graph.py            # LangGraph runtime (shipped)
  nodes.py
  h00t_client.py
  requirements.txt
```

## Run

### HTTP sidecar (M14)

```powershell
pip install -r coach-graph/requirements.txt
# Terminal 1 — HOOT kernel on 7777
node server.js
# Terminal 2 — graph sidecar on 7788
python coach-graph/server.py
```

Kernel routes: `GET /api/coach/graph/status`, `POST /api/coach/graph/run`  
UI: `/approvals` → **LangGraph dry-run** (safe — no live launch)

### CLI

```powershell
python coach-graph/graph.py --profile local-safe-audit --dry-run --auto-approve --json
```

Profile tiers: `coach-graph/graph_profiles.json` (per-profile `minScore`).

## Guardrails

- Never execute arbitrary shell — profile IDs from `profiles/*.md` only
- Kernel `server.js` owns launch authority
- No `agentdock-core` npm dependency

## Entry criteria

See `D:/projects/docs/PHASE_4_COACH_GRAPH_PREP.md`:

- [x] M2 HOOT Kernel GA
- [x] M9 bench + Coach confirm gates
- [x] 10 launch-approval flows logged (`phase4Ready: true`)
- [x] Graph spec reviewed against `AI_OS_ARCHITECTURE.md`

## Related

- `D:/projects/docs/PHASE_4_COACH_GRAPH_PREP.md`
- `D:/projects/skills/agentdock-framework/SKILL.md`