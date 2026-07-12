# AgentDock Next Milestone + Graphify Assessment

> For Hermes: use this as the current resume point for AgentDock. This document reflects live repo state verified on 2026-06-10 from git, tests, source files, and the current state registry.

**Goal:** Lock in exactly where the command-center overhaul stands, define the next implementation milestone, and decide whether Graphify belongs inside AgentDock or beside it as a project-brain pipeline.

**Architecture:** AgentDock already has the command-center shell in place in the React UI and the CE skills/audit backend exposed over HTTP. The next move should be a focused “project intelligence” milestone that adds durable repo summaries and re-entry context without turning the product into a Python-heavy embedded graph runtime.

**Tech Stack:** Node.js server, React/TypeScript UI, zero-runtime-dependency backend constraint, local JSON/Markdown state, optional external Python tool (Graphify) for offline graph generation.

---

## 1. Verified Current State

### Repo and tests
- Repo: `D:\projects\agentdock`
- Branch: `master...origin/master`
- Current working tree delta: only `state/projects.json` and `state/stack-usage.json`
- Verification command: `npm test`
- Result: `537/537` passing

### What is already implemented in the UI
Verified in source, not inferred from old notes:
- `ui/src/App.tsx`
  - routes exist for `/`, `/scan`, `/profiles`, `/launch`, `/terminal`, `/memory`, `/builder`, `/skills`, `/settings`
- `ui/src/components/AppLayout.tsx`
  - command-center shell is real, with grouped nav:
    - Command Center: Overview, Readiness, Profiles, Sessions, Launch Center
    - Intelligence: Memory
    - Build + Configure: Stack Builder, Skills, Settings
- `ui/src/pages/LaunchCenterPage.tsx`
  - dedicated launch review surface exists
  - loads profiles, active project, and sessions
  - runs `api.makePlan(goal)` for recommendation goals
  - supports dry-run preview via `api.dryRun(id)`
  - shows audit warnings/errors/suggestions
  - supports explicit override launch path
- `ui/src/pages/SkillsPage.tsx`
  - CE skills catalog page exists
  - supports search, category filters, cached content preview
- `ui/src/lib/api.ts`
  - `getSkills`, `getSkill`, `getSkillContent`, `dryRun`, `launch`, `getProjects`, `getActiveProject`, and portfolio endpoints are wired

### What the current uncommitted changes actually are
The repo is not carrying a giant unstaged UI rewrite anymore.

The live diff is only state data:
- `state/projects.json`
  - active project switched from `D:\projects\lookBOOK` to `D:\projects\cineforge`
  - discovered project metadata refreshed
  - git cleanliness/uncommitted counts refreshed for several repos
  - `lastOpened` fields were reset to `null`
  - `helixFORGE-main` entry appeared in registry
- `state/stack-usage.json`
  - appended recent launch records including:
    - `codex-patch-test` success on `2026-06-08`
    - `cloud-architecture-codex` success on `2026-06-10`

### Interpretation
This means the command-center work that previously looked “in progress” is now mostly already landed in committed source. The repo is currently operational and green. The main unfinished problem is not shell architecture anymore — it is project intelligence and resume quality.

---

## 2. Gap Analysis: What Is Still Missing

The premium shell exists, but AgentDock still lacks a first-class “project brain” layer.

Current behavior:
- project registry knows repo path, git health, AGENTS.md presence, and basic type
- portfolio health aggregates these snapshots
- memory is evidence-oriented and launch-oriented
- skills page surfaces CE capabilities
- launch center helps choose and review launch paths

Missing behavior:
- no durable per-project semantic summary
- no compact “read this first” artifact for re-entry
- no generated map of components, concepts, docs, and relationships
- no cacheable knowledge artifact that reduces repeated repo skimming between sessions
- no project-level distinction between:
  - runtime health
  - repo shape
  - semantic architecture
  - milestone/blocker memory

Bottom line:
AgentDock has command center and launch governance; it does not yet have a proper project-intelligence substrate.

---

## 3. Recommendation on Graphify

## Quick verdict
**Yes, but not as an embedded runtime dependency.**

Best path:
- keep Graphify external to AgentDock’s core runtime
- use it as an optional project-intelligence producer
- ingest its outputs (`GRAPH_REPORT.md`, `wiki/`, `graph.json`) into AgentDock as project artifacts

## Why not embed it directly in core runtime
Graphify is a Python package with substantial dependency surface:
- requires Python 3.10+
- tree-sitter packages across many languages
- optional MCP / PDF / watch / SVG / LLM extras
- writes to `graphify-out/`

That conflicts with AgentDock’s core identity:
- zero runtime npm dependencies
- thin local-first Node server
- constrained and inspectable behavior

Embedding Graphify into the default AgentDock runtime would:
- increase install/setup friction
- blur the product boundary between “command center” and “analysis engine”
- create support burden on Windows for Python pathing and package install issues
- make a previously reliable local app feel heavier and more brittle

## Why Graphify is still a strong fit
Graphify is genuinely aligned with the missing layer:
- builds persistent graph artifacts instead of ephemeral summaries
- supports update caching
- can generate human-readable artifacts (`GRAPH_REPORT.md`, `wiki/`)
- can operate on mixed corpora, not just code
- can run locally and preserve privacy

For AgentDock, the best value is not the graph itself. The value is the stable, cached project-intelligence artifact it can emit.

---

## 4. Integration Options Compared

| Option | Description | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Native embed | AgentDock directly installs/runs Graphify as part of core product | Deepest integration | Violates lightweight runtime feel; Python burden; support cost | No |
| B. Optional external adapter | AgentDock detects Graphify outputs in a project and reads them | Preserves core simplicity; highest leverage-to-risk ratio | Requires a separate generation workflow | Yes |
| C. AgentDock-managed sidecar job | AgentDock can optionally launch Graphify for a project via explicit task | Good UX; still optional | Some orchestration complexity | Yes, phase 2 |
| D. Full portfolio graph platform | Cross-project graph sync, search, and shared memory layer | Strategic upside | Too much too early | Later |

Recommended sequence:
1. Option B now
2. Option C next
3. Option D only after the first two prove value

---

## 5. Next Milestone Definition

# Project Intelligence Milestone Implementation Plan

## Milestone objective
Add a lightweight project-brain layer to AgentDock without changing the zero-dependency Node runtime contract.

## Milestone name
**Milestone 11 — Project Intelligence Layer**

## Deliverables
1. AgentDock recognizes Graphify-style project artifacts if present
2. AgentDock surfaces a “Project Brain” summary in the UI
3. AgentDock prefers generated project-intelligence artifacts before broad repo rescans
4. AgentDock documents a repeatable sidecar workflow for generating/updating project graphs

## Scope boundary
In scope:
- read existing Graphify outputs from project directories
- add project-brain metadata to the project model
- show project-brain status in Overview / Projects
- define explicit artifact conventions
- add docs and tests for artifact detection

Out of scope:
- bundling Graphify into Node runtime
- automatic Python environment setup inside default app boot
- graph visualization inside AgentDock v1 of this milestone
- portfolio-wide cross-project graph federation

---

## 6. Bite-Sized Execution Plan

### Task 1: Define project-brain artifact contract
**Objective:** Standardize where AgentDock looks for project-intelligence artifacts.

**Files:**
- Create: `docs/plans/2026-06-10-agentdock-next-milestone-and-graphify-assessment.md` (this file)
- Modify later: `AGENTS.md`

**Contract proposal:**
AgentDock checks for either:
- `<project>/.agentdock/project-brain/summary.md`
- `<project>/.agentdock/project-brain/graph.json`
- `<project>/.agentdock/project-brain/wiki/index.md`

Adapter rule:
- if Graphify output exists under `<project>/graphify-out/`, AgentDock may mirror or reference:
  - `graphify-out/GRAPH_REPORT.md`
  - `graphify-out/graph.json`
  - `graphify-out/wiki/index.md`

### Task 2: Add backend detection helpers
**Objective:** Teach `server.js` to detect project-brain artifacts per project.

**Files:**
- Modify: `server.js`
- Test: `tests/server.test.js` or new `tests/project-brain.test.js`

**Implementation details:**
Add helper(s):
- `detectProjectBrain(projectPath)`
- returns:
  - `present: boolean`
  - `source: 'agentdock' | 'graphify' | null`
  - `summaryPath: string | null`
  - `graphPath: string | null`
  - `wikiIndexPath: string | null`
  - `updatedAt: string | null`

Then attach this object to project records returned from:
- `readProjectRegistry()`
- `/api/projects`
- `/api/active-project`
- optionally `/api/portfolio/health`

### Task 3: Add test fixtures for project-brain detection
**Objective:** Verify detection without requiring Python or Graphify installation.

**Files:**
- Create: `tests/fixtures/project-brain/graphify-out/GRAPH_REPORT.md`
- Create: `tests/fixtures/project-brain/graphify-out/graph.json`
- Create: `tests/fixtures/project-brain/graphify-out/wiki/index.md`
- Create: `tests/project-brain.test.js`

**Verification:**
Run:
- `node --test tests/project-brain.test.js`
- `npm test`

### Task 4: Surface project-brain status in UI
**Objective:** Make project intelligence visible in the command center.

**Files:**
- Modify: `ui/src/pages/Dashboard.tsx`
- Modify: `ui/src/pages/ScanPage.tsx` or `ui/src/pages/ProfilesPage.tsx` only if needed
- Modify: `ui/src/components/AppLayout.tsx` only if navigation needs a dedicated entry later

**UI behavior:**
- show “Project Brain” status card on Overview:
  - Ready
  - Missing
  - Stale
- if present, show:
  - source (`Graphify` or `AgentDock`)
  - updated time
  - quick links to summary/wiki source
- if absent, show CTA:
  - “Generate project brain” with docs guidance

### Task 5: Add project-brain detail surface
**Objective:** Provide a readable first-stop summary for re-entry.

**Files:**
- Create: `ui/src/pages/ProjectBrainPage.tsx` or fold into Dashboard initially
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/lib/api.ts`

**API needs:**
- `GET /api/project-brain?path=...` or equivalent active-project endpoint expansion
- minimal response:
  - metadata
  - summary text preview
  - wiki index preview path

### Task 6: Add docs for optional Graphify workflow
**Objective:** Make the external-sidecar workflow official and repeatable.

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Create: `docs/plans/graphify-sidecar-workflow.md` or `docs/project-brain.md`

**Workflow doc should cover:**
- install Graphify separately
- run against a project
- point output into `graphify-out/`
- optionally copy/mirror into `.agentdock/project-brain/`
- when to refresh (`--update`, post-commit hook, manual)

### Task 7: Phase-2 launcher hook (optional, not same PR unless small)
**Objective:** Let AgentDock trigger Graphify as an explicit operator action.

**Files:**
- likely profile or script-based integration, not core auto-run

**Behavior:**
- explicit button or action only
- no silent install
- no background always-on runtime coupling

---

## 7. Verification Criteria

The milestone is complete when all of the following are true:
- `npm test` remains green
- a project with no graph artifacts shows “Project Brain: Missing” cleanly
- a project with Graphify artifacts shows “Project Brain: Ready” with source metadata
- active-project response exposes project-brain metadata
- re-entry flow can prioritize summary/wiki artifacts before broad repo skim
- docs explain the optional Graphify sidecar path clearly

---

## 8. Final Recommendation

Do not spend the next cycle rebuilding the command-center shell again. That layer is largely already shipped.

Do this next instead:
- ship a lightweight project-intelligence layer
- treat Graphify as an optional external artifact producer
- ingest its outputs into AgentDock
- preserve the zero-dependency Node runtime while gaining the “don’t reskim the repo every time” benefit

This is the highest-leverage next move because it strengthens the one capability the current product still lacks: durable project understanding between sessions.
