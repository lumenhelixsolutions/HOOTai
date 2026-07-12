# AgentDock UI Architecture Brief

> For Hermes: use this as the source-of-truth brief for the AgentDock premium UX overhaul. Preserve meaningful capability. Reduce clutter through information architecture, hierarchy, and progressive disclosure — not by deleting power features.

## Goal

Transform AgentDock from a powerful single-page internal dashboard into a premium command-center product with:
- stronger information hierarchy
- clearer first-run and daily-run flow
- project-centered operating model
- deliberate launch review and session control experiences
- better separation of primary workflows vs secondary utilities

## Non-Negotiables

1. Keep the local-first safety identity
- localhost only
- no arbitrary shell box
- profile-defined launch blocks only
- secret redaction
- visible audit and evidence model

2. Preserve meaningful feature depth
- project registry
- system scan
- goal planning
- profile catalog
- launch preview
- managed sessions / terminal
- advisor / AI chat
- local models visibility
- install guides
- memory.md editing / evidence
- logs
- research brief support

3. Do not solve clutter by deleting power
- solve it through layout, layering, and clearer flow

4. Maintain zero-dependency runtime constraint
- `index.html` remains self-contained
- visual overhaul must respect current architectural constraints

---

## Grounded Diagnosis From Current UI

Current `index.html` already includes the following major surfaces:
- global header with project select, mode toggle, scan, theme, shortcuts
- Easy mode:
  - active project summary
  - quick launch cards
  - missing tools install block
  - AI assistant CTA
- Advanced mode:
  - active project summary
  - quick launch templates
  - goal planner
  - managed terminal + session tabs + stop/input/outcome/troubleshooting
  - full profiles grid
  - missing tools install guides
  - local models
  - research brief
  - system snapshot
  - coder tools
  - env/model-key scan
  - memory editor
  - logs
- persistent chat / mascot
- loading overlay, toasts, shortcuts modal

This proves the core issue is not capability shortage.

The core issue is that too many unrelated surfaces are presented in one long control stack, with too many elements sharing equal priority.

That produces four UX problems:
1. weak center of gravity
2. weak “what do I do next?” sequencing
3. excessive panel parity
4. operator-grade features presented with utility-grade hierarchy

---

## Product Model To Replace the Current One

Replace the current “Easy mode vs Advanced mode on one giant page” model with a command-center information architecture.

The new model should feel like this:
- one product shell
- one persistent top navigation
- one active-project context bar
- one primary view at a time
- one right-side utility rail or drawer for assistant/tools where appropriate
- advanced detail available intentionally, not dumped by default

## Proposed Navigation Model

### Primary navigation
1. Overview
2. Projects
3. Profiles
4. Launch Center
5. Sessions
6. Advisor
7. Evidence
8. Tools

### Utility controls in header
- project switcher
- run scan
- theme toggle
- keyboard shortcuts
- assistant open/close

### Why this is the right split
- Overview = “where am I / what matters now?”
- Projects = project selection and project health
- Profiles = browse and compare launch options
- Launch Center = deliberate launch review and execution
- Sessions = active and historical session operations
- Advisor = recommendations, recovery, install help
- Evidence = memory, known-good, blocked history, logs summary
- Tools = low-frequency utilities like raw scan detail, env scan, local models, research brief

This structure preserves every current major capability while removing the long-page sprawl.

---

## Proposed Screen Hierarchy

## 1. Overview
Purpose:
- premium first screen
- active-project mission control
- clear “ready / blocked / next action” verdict

Contents:
- active project hero card
  - project name
  - type
  - git cleanliness
  - branch / remote / sync state
  - AGENTS.md detected / missing
- system readiness card
  - scan freshness
  - ollama present / missing
  - coder tools installed / missing
  - local models summary
- recommended next actions
  - run scan
  - fix missing tools
  - review profiles
  - continue active session
- recommended launch options
  - top 3 suggested profiles for current project and intent
- recent sessions snapshot
  - latest outcomes
  - blocked/failure callouts

Notes:
- this replaces the weak current split between easy project panel, quick launch, install guides, and miscellaneous setup cues
- the Overview should feel calm, premium, and conclusive

## 2. Projects
Purpose:
- make project context first-class instead of a dropdown-only primitive

Contents:
- project list / switcher
- project cards with:
  - path
  - detected type
  - git state
  - AGENTS.md presence
  - recommended stack summary
- active project deep panel
  - richer git details
  - AGENTS.md preview
  - recent launches on this project
  - common actions

Notes:
- current project details are too cramped and secondary
- this screen gives the app a strong operating center

## 3. Profiles
Purpose:
- turn profile sprawl into a curated library

Contents:
- segmented filters:
  - local / cloud / hybrid / CE
  - task mode
  - tier
  - frontend/backend
- profile cards showing:
  - name
  - best for
  - privacy posture
  - context tier
  - env requirements
  - known-good / warning / blocked indicators
- compare drawer or compare mode for selected profiles
- “recommended for current project” row above general catalog

Notes:
- current profile grid is valuable but too undifferentiated
- profile trust is a major premium signal

## 4. Launch Center
Purpose:
- launch should feel deliberate and senior-engineered, not like a crowded button action

Contents:
- chosen profile summary
- current project summary
- intent selector or inherited recommended plan
- audit result stack:
  - pass
  - warning
  - blocked
- why this profile / why not alternatives
- dangerous pattern preview
- env requirements summary
- launch CTA with explicit confirmation state
- success/blocked result handoff into Sessions

Notes:
- current launch affordances are split across quick launch, templates, planner cards, and profile cards
- this screen centralizes launch trust

## 5. Sessions
Purpose:
- premium operator control room for active runs

Contents:
- active sessions strip
- state tabs:
  - active
  - completed
  - blocked
  - failed
- session details pane
  - live terminal
  - profile used
  - project
  - start time / duration
  - input controls
  - stop / restart / review actions
- outcome capture panel
- troubleshooting and recovery suggestions

Notes:
- current managed terminal is one of the strongest features, but its hierarchy is too low-level and page-bound
- it deserves a dedicated command-center screen

## 6. Advisor
Purpose:
- keep the assistant, but place it in a more intentional support workflow

Contents:
- recommendation input
- structured advice output
- setup blockers section
- recovery recommendations after failure
- install help cards
- project-specific guidance
- optional docked chat assistant panel

Notes:
- today the assistant exists as a floating mascot/chat plus some advisor logic; this should become a first-class support lane without losing the conversational assistant

## 7. Evidence
Purpose:
- make trust and memory operationally visible

Contents:
- known-good / blocked / failure summaries
- project-specific recent evidence
- memory.md editing surface
- recent outcome timeline
- top repeated blockers
- logs index with deep-link into full logs

Notes:
- current memory and logs are present but feel like raw utility panels
- this view turns them into the trust layer of the product

## 8. Tools
Purpose:
- preserve powerful secondary surfaces without polluting the primary flow

Contents:
- system snapshot
- local models
- env/model-key scan
- coder tools inventory
- research brief
- shortcuts reference
- advanced/raw diagnostics

Notes:
- this is where “advanced mode” conceptually moves
- instead of a whole-app binary mode, complexity becomes feature-scoped and intentional

---

## Proposed Shell Layout

### Header
Persistent:
- AgentDock brand
- active project selector
- global scan CTA
- assistant toggle
- theme toggle
- shortcuts

### Nav bar
Persistent top or left rail depending on viewport:
- Overview
- Projects
- Profiles
- Launch Center
- Sessions
- Advisor
- Evidence
- Tools

### Context bar
Just below nav:
- current project
- scan age/status
- active sessions count
- current recommendation badge

### Main content area
- one primary view at a time
- avoid long mixed-purpose scroll pages

### Utility rail / drawers
Use for:
- assistant chat
- compare profile drawer
- launch review drawer on some screens
- quick actions

### Mobile behavior
- bottom-sheet assistant
- collapsible nav
- card stacks, not split panes where unnecessary

---

## Easy vs Advanced: Recommended Replacement

Current model:
- Easy mode and Advanced mode are app-wide state toggles
- both contain important features
- mode boundaries are not aligned to real user goals

Recommended replacement:
- remove “mode” as the primary architectural idea
- replace it with progressive disclosure inside each section

Examples:
- Overview has a compact operator summary by default, with “show diagnostics” expansion
- Profiles show curated cards first, advanced metadata on expand
- Sessions show primary controls first, raw terminal and troubleshooting deeper
- Tools houses dense diagnostic surfaces intentionally

If a mode concept remains, use it sparingly:
- “Operator view” vs “Diagnostics view” as a per-screen control, not as the app’s top-level structure

---

## Current-to-Future Panel Mapping

| Current surface | Future home | Notes |
|---|---|---|
| Easy project panel | Overview / Projects | promote to premium hero and project health card |
| Easy quick launch | Overview / Launch Center | keep speed, add recommendation context |
| Easy missing tools | Overview / Advisor / Tools | keep surfaced only when relevant |
| Easy AI CTA | Advisor | assistant remains globally accessible |
| Advanced active project | Projects | expand meaningfully |
| Quick launch templates | Launch Center | launch templates should be contextual |
| Goal planner | Overview / Launch Center | treat as intent selection and recommendation engine |
| Managed terminal | Sessions | dedicated control-room screen |
| Profiles grid | Profiles | curated catalog with filters and compare |
| Install guides | Advisor / Tools | contextual recovery plus full tool inventory |
| Local models | Tools | optionally summarized in Overview |
| Research brief | Tools | secondary utility, not primary flow |
| System snapshot | Overview / Tools | concise verdict on Overview, detail in Tools |
| Coder tools | Tools | summarize missing/present state elsewhere |
| Env/model-key scan | Tools | keep advanced visibility |
| Memory editor | Evidence | position as trust/learning layer |
| Logs | Evidence | logs index plus deeper log viewer |
| Floating chat | Advisor utility rail | keep mascot if desired, but integrate better |
| Shortcuts modal | Shell utility | retain as-is with style cleanup |

---

## Interaction Principles

1. One dominant action per screen
- Overview: understand and choose next step
- Profiles: compare and select
- Launch Center: review and launch
- Sessions: monitor and control

2. Strong system verdicts
Every major screen should surface:
- Ready
- Needs attention
- Blocked
- In progress

3. Better copy tone
Replace generic panel labels with operator-grade language:
- “System readiness” instead of raw snapshot-first framing
- “Launch review” instead of vague quick-launch overload
- “Recent outcomes” instead of just logs
- “Recovery actions” instead of hidden troubleshooting after failure

4. Dense detail only where earned
The current product has valuable low-level detail. Keep it, but gate it behind:
- tabs
- accordions
- drawers
- dedicated screens

5. Preserve keyboard friendliness
- current shortcuts are useful and should remain
- the new shell should improve focus paths rather than regress them

---

## Visual Direction

This does not require a totally different aesthetic language.
The current dark glassmorphism-inspired palette is workable.
The real need is hierarchy, spacing discipline, and semantic consistency.

Visual upgrades should prioritize:
- larger spacing rhythm between primary sections
- stronger page titles and section intros
- consistent CTA hierarchy
- fewer equally-loud pills and panels
- clearer empty states
- more deliberate use of badges
- reduced card noise
- stronger differentiation between summary cards vs detailed inspector panels

Keep:
- dark/light theme support
- accessibility posture
- loading overlay
- toast pattern

Improve:
- page shell
- nav hierarchy
- card taxonomy
- action emphasis
- state design

---

## Technical Migration Strategy

Because `index.html` is self-contained and large, do not attempt a one-shot rewrite.

### Phase 1 — Shell and routing structure
Implement:
- primary nav shell
- section containers for Overview / Projects / Profiles / Launch Center / Sessions / Advisor / Evidence / Tools
- preserve existing functions initially
- move current content into new homes before redesigning internals deeply

Success bar:
- same features still reachable
- app immediately feels more structured

### Phase 2 — Overview + Projects + Profiles
Implement:
- project-centered home screen
- project view
- curated profiles catalog
- recommendation row and better filtering

Success bar:
- the app stops feeling like a mixed-purpose dashboard

### Phase 3 — Launch Center + Sessions
Implement:
- dedicated launch review surface
- dedicated session control screen
- cleaner blocked/warning/success handoff

Success bar:
- strongest operator workflows become premium

### Phase 4 — Advisor + Evidence + Tools consolidation
Implement:
- advisor screen
- evidence/history screen
- tools screen for diagnostics
- move remaining long-tail panels out of primary flow

Success bar:
- no major capability left stranded on legacy layout

### Phase 5 — Finish pass
Implement:
- visual refinement
- copy upgrades
- empty-state pass
- mobile refinement
- keyboard pass

Success bar:
- premium feel without feature regression

---

## Suggested File/Code Strategy

Primary target:
- `D:/projects/agentdock/index.html`

Supporting references to keep aligned:
- `D:/projects/agentdock/README.md`
- `D:/projects/agentdock/AGENTS.md`
- `D:/projects/agentdock/tests/server.test.js`
- `D:/projects/agentdock/tests/profiles.test.js`
- `D:/projects/agentdock/tests/scanner.test.js`
- `D:/projects/agentdock/tests/memory.test.js`

Implementation guidance:
- do not rewrite backend routes unless required by UI gaps
- prefer reusing current API surfaces first
- add lightweight client-side view state to switch sections
- only add new API endpoints if the new IA truly needs cleaner aggregated data

---

## Explicit Anti-Patterns To Avoid

1. Do not flatten the app into a prettier version of the current long page
2. Do not hide important features behind obscure icons
3. Do not force users into chat for actions that deserve first-class controls
4. Do not replace structured launch review with “smart guesses” only
5. Do not reduce trust surfaces like audit, memory, and logs into afterthoughts
6. Do not keep Easy/Advanced as the dominant mental model if it continues to fragment the IA
7. Do not delete advanced diagnostics just to make screenshots cleaner

---

## Success Criteria

The overhaul succeeds if a user can:
1. open AgentDock and immediately understand current system readiness
2. see the active project and its health without hunting
3. understand which profiles are best and why
4. review a launch with confidence before starting it
5. monitor active sessions in a dedicated control-room surface
6. recover from failure using clear guidance
7. inspect memory/evidence without entering a raw-maintenance mindset
8. access advanced diagnostics when needed without carrying them everywhere

## Final Recommendation

Build this as a command-center re-architecture, not a panel facelift.

The current product already has enough substance to justify a premium experience.
The shortest path to that experience is:
- reset the shell
- center the project
- centralize launch review
- elevate sessions into a true control room
- move diagnostics into a deliberate tools/evidence layer

That preserves power while finally making the product feel senior-engineered.
