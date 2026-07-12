# Project Brain Schema for 6 Repos

> For Hermes: use this document as the contract for generating and reading per-repo project-brain artifacts in AgentDock.

**Goal:** Define one shared project-brain schema that AgentDock can read across the six highest-value repos, while also specifying the repo-specific sections each project needs.

**Architecture:** Every repo gets the same base `.agentdock/project-brain/` structure so AgentDock can ingest it uniformly. Repo-specific value comes from a small number of typed overlays: gameplay systems for racegps, pipeline stages for lookBOOK, host-product architecture for AgentDock, prompt taxonomy for PromptPack, module ownership for cineforge, and skill topology for ECC.

**Tech Stack:** Markdown and JSON artifacts stored inside each repo, generated either by AgentDock-native summarizers or by an optional external graph sidecar such as Graphify.

---

## 1. Shared Contract

Every supported repo should expose a project brain at:

- `<repo>/.agentdock/project-brain/summary.md`
- `<repo>/.agentdock/project-brain/current-state.md`
- `<repo>/.agentdock/project-brain/graph.json`
- `<repo>/.agentdock/project-brain/wiki/index.md`
- `<repo>/.agentdock/project-brain/artifacts.json`

Each required artifact must carry an explicit freshness stamp so AgentDock can tell whether the snapshot is current.

Optional but recommended:

- `<repo>/.agentdock/project-brain/open-questions.md`
- `<repo>/.agentdock/project-brain/milestones.md`
- `<repo>/.agentdock/project-brain/ownership-map.json`
- `<repo>/.agentdock/project-brain/dependency-map.json`
- `<repo>/.agentdock/project-brain/change-hotspots.md`

If Graphify is used as a sidecar, its outputs should be mirrored or mapped into the above structure from:

- `<repo>/graphify-out/GRAPH_REPORT.md`
- `<repo>/graphify-out/graph.json`
- `<repo>/graphify-out/wiki/index.md`

### Required semantics

AgentDock should always be able to answer these five questions from the shared contract:

1. What is this project?
2. What are its main systems?
3. What files, docs, or artifacts matter most?
4. Where was work left off?
5. What should be read first next session?

---

## 2. Shared File Schema

### 2.1 `summary.md`
Purpose: one-screen executive brief for re-entry.

Required sections:

```md
# <Project Name>

Timestamp: 2026-06-10T22:15:00Z
Source: agentdock|graphify|manual

## Mission
## Current Product Shape
## Main Systems
## Current Focus
## Known Risks
## Read This First
```

Rules:
- 300-800 words
- written for fast human re-entry
- no raw dumps
- must name the top 3-7 systems in plain English
- must include an ISO 8601 UTC `Timestamp:` line near the top
- must include a `Source:` line so AgentDock knows where the summary came from

### 2.2 `current-state.md`
Purpose: high-signal status snapshot.

Required sections:

```md
# Current State

Timestamp: 2026-06-10T22:15:00Z
Session-End: true|false
Plan-Version: 1.4.0
Milestone-Version: 2026-06-10.1
Canonical-For-Project: true

## Last Verified
## Active Branch / Repo Health
## What Changed Recently
## What Is Working
## What Is Unverified
## Blockers
## Next Best Move
```

Rules:
- should summarize repo status, not replace git
- should distinguish verified facts from assumptions
- should prefer “last verified working path” over generic roadmap text
- must include an ISO 8601 UTC `Timestamp:` line near the top
- should include `Session-End: true` when written as the final end-of-session snapshot
- must carry a project-wide `Plan-Version:` and `Milestone-Version:` so concurrent agents can anchor to the same state
- `Canonical-For-Project: true` marks this file as the repo's shared source of truth for resume/re-entry state

### 2.3 `graph.json`
Purpose: machine-readable semantic map.

Minimum JSON shape:

```json
{
  "version": 1,
  "project": {
    "name": "",
    "path": "",
    "type": "",
    "primary_language": ""
  },
  "generated_at": "",
  "session_end": false,
  "plan_version": "1.4.0",
  "milestone_version": "2026-06-10.1",
  "canonical": true,
  "source": {
    "generator": "agentdock|graphify|manual",
    "inputs": []
  },
  "nodes": [],
  "edges": [],
  "entrypoints": [],
  "critical_paths": [],
  "hotspots": [],
  "open_questions": []
}
```

Node shape:

```json
{
  "id": "vehicle-pawn",
  "kind": "system|module|document|script|artifact|concept|route|ui-surface|workflow",
  "label": "Chaos Vehicle Pawn",
  "path": "apps/unreal-akron-beta/.../ChaosVehiclePawn.cpp",
  "summary": "Owns drivable vehicle behavior.",
  "status": "active|stable|experimental|deprecated|unknown",
  "tags": ["gameplay", "vehicle"],
  "priority": 1
}
```

Edge shape:

```json
{
  "from": "vehicle-pawn",
  "to": "game-mode",
  "type": "calls|owns|depends_on|documents|produces|consumes|routes_to|tests|configures",
  "summary": "Vehicle pawn behavior is coordinated by game mode."
}
```

### 2.4 `wiki/index.md`
Purpose: browsable human knowledge map.

Required sections:

```md
# Project Brain Wiki

## Start Here
## System Pages
## Workflows
## Key Documents
## Artifact Index
## Open Questions
```

Rules:
- link to sub-pages per major system
- each sub-page should explain responsibility, important files, and known hazards

### 2.5 `artifacts.json`
Purpose: tell AgentDock which artifacts exist and which should be surfaced first.

Minimum shape:

```json
{
  "version": 1,
  "recommended_entry": "summary.md",
  "updated_at": "2026-06-10T22:15:00Z",
  "session_end": false,
  "plan_version": "1.4.0",
  "milestone_version": "2026-06-10.1",
  "canonical": true,
  "files": [
    {
      "path": ".agentdock/project-brain/summary.md",
      "kind": "summary",
      "priority": 1,
      "required": true
    }
  ]
}
```

---

## 3. Shared Generation Rules

### Freshness rules
- `summary.md` and `current-state.md` should be refreshed whenever a meaningful milestone or architecture shift happens.
- `graph.json` can be generated less often, but must include `generated_at`.
- If freshness is unknown, AgentDock should label the brain as stale rather than pretending it is current.
- `artifacts.json` must include `updated_at` and should mirror whether the refresh happened at session end.

### Session-close rule
- At the end of any substantial work session, the repo's `.agentdock/project-brain/current-state.md` should be refreshed first.
- The session-close refresh should set `Session-End: true` in `current-state.md` and `session_end: true` in JSON artifacts generated in the same pass.
- If only one artifact can be updated before exit, prefer `current-state.md` over all others.
- For portfolio views, AgentDock should treat the repo-level `current-state.md` timestamp as the authoritative pipeline snapshot timestamp.

### Multi-agent coordination rule
- Every repo must have exactly one canonical project-brain snapshot under `.agentdock/project-brain/`.
- Concurrent agents should read the repo's `current-state.md` and `artifacts.json` before planning work, and should update them again when their session ends.
- `Plan-Version` advances whenever the shared build plan changes; `Milestone-Version` advances whenever milestone meaning, status, or scope changes.
- Versioning is project-wide, not agent-local: multiple agents working the same repo must converge on the same versions rather than inventing separate branches of milestone state.
- AgentDock should surface version mismatches or stale timestamps as coordination warnings.

### Evidence rules
- Separate observed facts from interpretation.
- Prefer paths, system names, and artifact names over vague prose.
- Redact any secrets as `[REDACTED]`.

### Scope rules
- Do not dump every file.
- Capture only the systems that matter for restart, debugging, or strategic changes.
- Keep repo-specific overlays compact and additive.

---

## 4. Shared AgentDock Ingestion Model

AgentDock should derive these UI fields from any project brain:

```json
{
  "projectBrain": {
    "present": true,
    "summaryPath": "",
    "currentStatePath": "",
    "graphPath": "",
    "wikiIndexPath": "",
    "recommendedEntry": "",
    "source": "agentdock|graphify|manual",
    "generatedAt": "",
    "staleness": "fresh|aging|stale|unknown",
    "focusArea": "",
    "topSystems": [],
    "openQuestions": []
  }
}
```

This gives AgentDock enough structure to:
- show a Project Brain card on overview pages
- prioritize “read this first” artifacts
- distinguish semantic project state from raw git health
- support sidecar-generated brains without embedding Python in runtime

---

## 5. Repo-Specific Overlay: racegps

Repo path:
- `D:\projects\racegps`

Why this repo needs a brain:
- active UE5 gameplay work
- multiple surfaces: gameplay, onboarding, UI/menu, packaging, generated world/spec artifacts
- expensive re-entry cost when context is lost

### Required racegps sections

Add these sections to `summary.md` or linked wiki pages:

```md
## Gameplay Loop
## Vehicle Systems
## World / Route Data
## UI and Onboarding
## Packaging and Installer Path
## Last Playable Path
```

### Required racegps node kinds/tags
- systems: vehicle, game-mode, input, HUD, onboarding, packaging
- artifacts: route-data, build-output, installer-doc, milestone-doc
- workflows: playtest, package-build, first-run-onboarding

### Required racegps wiki pages
- `wiki/gameplay-systems.md`
- `wiki/vehicle-stack.md`
- `wiki/onboarding-and-ui.md`
- `wiki/packaging.md`
- `wiki/world-data.md`

### racegps special rules
- always identify the last known playable path
- always identify the entrypoint files that govern driving behavior
- always track whether onboarding is verified end-to-end
- include “do not break” notes for controls, camera, and packaging flow

---

## 6. Repo-Specific Overlay: lookBOOK

Repo path:
- `D:\projects\lookBOOK`

Why this repo needs a brain:
- mixed code + media pipeline
- process memory matters as much as source-code memory
- hard to resume if stage boundaries and artifact conventions are unclear

### Required lookBOOK sections

```md
## Pipeline Stages
## Inputs and Outputs
## Prompt and Manifest Flow
## Generation Backends
## Export Surfaces
## Last Verified End-to-End Run
```

### Required lookBOOK node kinds/tags
- systems: ingest, prompt-builder, shot-planner, generator, compositor, exporter
- artifacts: prompt-manifest, image-batch, animation-output, style-guide, route-file
- workflows: compile-book, generate-sequence, export-deliverable

### Required lookBOOK wiki pages
- `wiki/pipeline-overview.md`
- `wiki/prompts-and-manifests.md`
- `wiki/generation-backends.md`
- `wiki/export-flow.md`
- `wiki/content-conventions.md`

### lookBOOK special rules
- document each pipeline stage as input -> transform -> output
- identify which modules are production, experimental, or deprecated
- highlight any stage that still requires manual intervention
- always state the last verified end-to-end path

---

## 7. Repo-Specific Overlay: AgentDock

Repo path:
- `D:\projects\agentdock`

Why this repo needs a brain:
- it is the host product for this whole capability
- needs durable reasoning about UI shell, backend APIs, launch governance, memory, and project intelligence
- should dogfood the same artifact contract it reads from other repos

### Required AgentDock sections

```md
## Product Mission
## Command Center Architecture
## Backend API Surface
## Project Registry and Memory Model
## Skills / Launch Governance
## Project Brain Roadmap
```

### Required AgentDock node kinds/tags
- systems: server, scanner, advisor, chat, UI shell, launch-center, skills, memory, project-brain
- artifacts: plan-doc, memory-file, project-registry, stack-usage-state, test-suite
- workflows: scan, audit, plan, dry-run, launch, resume-project

### Required AgentDock wiki pages
- `wiki/runtime-architecture.md`
- `wiki/ui-shell.md`
- `wiki/launch-governance.md`
- `wiki/project-registry.md`
- `wiki/project-brain-roadmap.md`

### AgentDock special rules
- explicitly separate current product reality from stale historical plans
- list current milestone, not every milestone ever discussed
- mark optional external dependencies, especially Graphify, as sidecars not core runtime
- surface the exact files that define the ingest contract

---

## 8. Repo-Specific Overlay: PromptPack

Repo path:
- `D:\projects\PromptPack`

Why this repo needs a brain:
- semantic organization matters more than algorithmic depth
- the main risk is losing taxonomy, exposure paths, and packaging context

### Required PromptPack sections

```md
## Prompt Taxonomy
## Template Families
## UI Exposure Map
## Packaging / Extension Flow
## Editing Rules
## Last Safe Content Edit Path
```

### Required PromptPack node kinds/tags
- systems: prompt-library, taxonomy, UI-surface, sidepanel, packaging, search/filter
- artifacts: prompt-template, category-doc, UI-html, bundle-config
- workflows: add-prompt-family, revise-template, ship-extension-build

### Required PromptPack wiki pages
- `wiki/prompt-taxonomy.md`
- `wiki/template-families.md`
- `wiki/ui-surfaces.md`
- `wiki/packaging.md`
- `wiki/content-editing-rules.md`

### PromptPack special rules
- every major prompt family should have a concise purpose statement
- UI pages should be linked to the content they expose
- include naming conventions and duplication warnings
- identify the safest path for adding content without breaking organization

---

## 9. Repo-Specific Overlay: cineforge

Repo path:
- `D:\projects\cineforge`

Why this repo needs a brain:
- lower urgency today, but ideal to keep clean before architecture sprawl sets in
- likely benefits from module ownership and run-path clarity more than heavy graph depth

### Required cineforge sections

```md
## Product Shape
## Module Ownership
## CLI / API Entry Points
## Data Flow
## Setup / Run / Test Paths
## Capability Gaps
```

### Required cineforge node kinds/tags
- systems: core-module, cli, api, job-runner, config, storage
- artifacts: test-suite, config-file, sample-data, runbook
- workflows: bootstrap, run-task, test-suite, export-output

### Required cineforge wiki pages
- `wiki/architecture.md`
- `wiki/module-map.md`
- `wiki/run-and-test.md`
- `wiki/data-flow.md`
- `wiki/gaps-and-next-moves.md`

### cineforge special rules
- each module should have a single sentence of ownership
- identify canonical run and test commands
- note missing verification areas separately from known failures
- prefer clarity over graph complexity

---

## 10. Repo-Specific Overlay: ECC

Repo path:
- `D:\projects\ecc`

Why this repo needs a brain:
- primarily a capability and knowledge library
- best value comes from mapping skills, overlaps, categories, and import opportunities

### Required ECC sections

```md
## Skill Catalog Shape
## High-Value Skills
## Category Topology
## Overlap / Consolidation Candidates
## Import / Export Surfaces
## Recommended Starting Points
```

### Required ECC node kinds/tags
- systems: skill, category, workflow, adapter, export-tool, registry
- artifacts: skill-file, catalog-json, sync-script, converter-script
- workflows: import-skill, review-overlap, update-catalog, export-skill

### Required ECC wiki pages
- `wiki/skill-map.md`
- `wiki/category-topology.md`
- `wiki/overlap-candidates.md`
- `wiki/import-export.md`
- `wiki/high-value-starters.md`

### ECC special rules
- optimize for discovery and consolidation, not runtime health
- highlight overlap between near-duplicate skills
- separate bundled skills from imported/external skills
- identify best-first skills for common workflows

---

## 11. Rollout Order

Recommended implementation order:

1. `racegps`
2. `lookBOOK`
3. `agentdock`
4. `PromptPack`
5. `cineforge`
6. `ecc`

Why:
- `racegps`: highest re-entry cost and most moving parts
- `lookBOOK`: strongest pipeline-memory need
- `agentdock`: strategic host once pattern is proven
- `PromptPack`: high semantic-organization value
- `cineforge`: clean architecture candidate
- `ecc`: reference/discovery layer, less urgent for day-to-day resume

---

## 12. Minimum Acceptable Brain for v1

A repo counts as Project-Brain-ready when it has at least:

- `summary.md`
- `current-state.md`
- `graph.json`
- `wiki/index.md`
- one repo-specific wiki page covering its dominant system

That is enough for AgentDock to:
- detect presence
- surface a read-first summary
- expose top systems
- show freshness/staleness
- support resume-style navigation

---

## 13. AgentDock Implementation Notes

When implementing ingestion in AgentDock, prefer this order:

1. detect `.agentdock/project-brain/artifacts.json`
2. if absent, fall back to direct file presence checks
3. load `summary.md` as the default human entry
4. load `graph.json` for top systems / open questions / focus area
5. show stale/fresh indicators using `generated_at`
6. optionally map `graphify-out/` into this contract without exposing Graphify internals in the core UX

The UI should present these fields first:
- Project summary
- Top systems
- Current focus
- Known blockers
- Read-this-first link
- Freshness

---

## 14. Final Recommendation

Do not build six unrelated schemas.
Build one base schema with six thin overlays.

That gives you:
- one AgentDock ingest path
- one reusable generator contract
- one consistent “where were we?” experience
- enough specialization to make each repo genuinely useful instead of generic

The key is consistency first, specialization second.
