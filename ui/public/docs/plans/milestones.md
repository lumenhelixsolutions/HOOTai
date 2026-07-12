# AgentDock Profile Summary + 10 Proposed Milestones

> Approval draft focused on a major user interface and flow overhaul for AgentDock without losing features. The target is a premium, senior-engineered operator experience — not a stripped-down dev tool.

## Project Profile Summary

AgentDock is a local-only AI agent operations dashboard for scanning a machine, evaluating available agent stacks, ranking launch options, monitoring terminal sessions, and learning from prior outcomes. It is intentionally constrained:
- binds to `127.0.0.1` only
- zero runtime npm dependencies
- executes only approved PowerShell launch blocks embedded in Markdown profile files
- preserves local memory and launch evidence in plain files

This is not a toy prototype anymore. The repo already shows a coherent product shape with:
- system scanning via `scanner.ps1`
- stack evaluation and HTTP API in `server.js`
- advisory/recommendation logic in `advisor.js`
- session/chat control surface in `chat.js`
- profile-driven launches in `profiles/*.md`
- evidence-based memory in `memory.md`
- CE profile integration and sync scripts
- localhost dashboard UI in `index.html`
- test coverage for server, scanner, profiles, and memory contracts

## Revised Product Assessment

AgentDock’s problem is no longer “missing core capability.”

AgentDock already has meaningful capability depth.
Its current weakness is that the interface and flow do not yet present that depth with the level of confidence, hierarchy, and clarity expected from a premium command-center product.

After reviewing the live UI structure in `index.html`, the strongest conclusion is:
- this should not be treated as a light UI cleanup
- this should be treated as a major UX architecture overhaul
- the overhaul must preserve the feature set while reorganizing how the user discovers, understands, and controls it

## Current Product Identity

At its best, AgentDock is:
- local-first
- safety-constrained
- profile-driven
- operations-oriented
- transparent in file formats
- designed for users juggling multiple agent frontends, models, and launch patterns

In plain language, AgentDock is becoming a mission control for local and hybrid coding agents.

## What Already Looks Strong

1. Safety posture is credible
- approved profile blocks only
- dangerous command preview warnings
- localhost-only binding
- secret redaction
- memory-based auto-blocking after repeated failures

2. Architecture is coherent
- scan -> evaluate -> plan -> launch -> remember is clean
- files and responsibilities are easy to reason about
- zero-dependency runtime is a strong product constraint, not a gimmick

3. Profile system is a real differentiator
- Markdown profiles are inspectable, editable, and auditable
- local / cloud / hybrid splits are legible
- CE workflow profiles add real leverage for Claude/Codex users

4. Product surface already has useful depth
- project registry
- session tracking
- advisor recommendations
- chat control surface
- logs, briefs, state files

## The Real Product Problem

The problem is not that AgentDock lacks enough features.
The problem is that too many features currently share the same level of visual and navigational importance.

From the current `index.html`, the likely user experience issue is:
- too many panels compete at once
- control density is high
- “what do I do next?” is not strong enough
- sessions, launches, advice, setup, and logs are all present, but not orchestrated into a premium journey
- Easy mode reduces complexity, but does not fully solve command-center hierarchy
- Advanced mode exposes power, but risks feeling like an engineering utility surface

So the correct roadmap is not “add some polish.”
It is:
- redesign the information architecture
- simplify first-run and daily-run flow
- preserve power features behind clearer layers
- create a premium control-room experience

## UX Overhaul Principles

1. Keep all meaningful features
- do not “simplify” by deleting valuable operator capability
- simplify by reorganizing and prioritizing

2. One primary workflow at a time
- setup
- choose project
- choose intent
- review recommended stack
- launch
- monitor
- resolve outcome

3. Command center over dashboard sprawl
- users should feel like they are operating a system, not browsing a wall of widgets

4. Strong default state
- first screen should feel guided, curated, and calm
- not like a tool chest exploded onto the page

5. Progressive disclosure
- first-run users see clarity
- advanced users still have depth
- complexity should unlock intentionally, not appear all at once

6. Premium operator language
- every key screen should answer:
  - what is happening
  - what matters most
  - what I should do next
  - what is blocked
  - what is safe to launch

## Bottom-Line Assessment

- Concept: strong and differentiated
- Architecture: strong
- Safety model: strong
- Feature depth: already meaningful
- Current UX hierarchy: insufficient for premium positioning
- Product maturity: advanced internal/beta tool with real operator potential
- Premium readiness: blocked primarily by UI/flow architecture, not by lack of backend capability

## Recommended Approval Framing

Approve AgentDock as a premium UX and flow overhaul program.

The goal should be:
- preserve features
- radically improve hierarchy
- reduce cognitive clutter
- make launch/monitor/recover flows feel deliberate
- make the product feel like a senior-engineered control room

---

## 10 Proposed Milestones

### Milestone 1 — Information Architecture Reset
Goal:
- Redesign the product structure so users understand the system in seconds.

What it should deliver:
- new top-level product architecture for `index.html`
- clear primary sections such as:
  - Home / Overview
  - Projects
  - Profiles
  - Launch Center
  - Sessions
  - Advisor
  - Memory / Evidence
  - Tools
- removal of “everything is a panel on one page” feel
- a cleaner separation between primary workflows and secondary utilities

Approval value:
- creates the structural foundation for every other premium UX improvement

### Milestone 2 — First-Run Mission Control Flow
Goal:
- Make the first five minutes feel obvious, calm, and premium.

What it should deliver:
- guided first-run scan flow
- explicit “ready / blocked / action needed” machine verdict
- curated next actions after the first scan
- elegant empty states for:
  - no active project
  - no sessions
  - no local backend
  - missing tools

Approval value:
- removes the “smart product, but unclear first move” problem

### Milestone 3 — Project-Centered Home Screen
Goal:
- Reframe AgentDock around the active project, not around raw controls.

What it should deliver:
- a project command-center home
- active project health card
- Git cleanliness / AGENTS.md / project type / recommended stacks in one premium summary area
- stronger “current mission” framing instead of scattered control rows

Approval value:
- gives the app a strong center of gravity

### Milestone 4 — Profile Catalog Rebuild
Goal:
- Make the profile library feel curated, trustworthy, and easy to browse.

What it should deliver:
- stronger metadata validation
- duplicate/inconsistent profile detection
- better visual grouping for:
  - local
  - cloud
  - hybrid
  - CE workflows
- clearer “best for” and task-tier presentation
- better profile browse/filter/compare flow

Approval value:
- turns profile sprawl into confident choice architecture

### Milestone 5 — Audit Explainability Upgrade
Goal:
- Make audit results instantly understandable and premium.

What it should deliver:
- structured reasons for errors/warnings/suggestions
- explicit “why blocked” and “how to unblock” messaging
- clearer alternative profile rationale
- more human-readable capability mismatch explanations

Approval value:
- replaces system opacity with trust

### Milestone 6 — Launch Center Overhaul
Goal:
- Make launch feel like a deliberate professional operation, not a button click hidden in a crowded dashboard.

What it should deliver:
- dedicated launch review surface
- stronger preview hierarchy
- richer dangerous-pattern warnings
- better environment requirement summaries
- explicit confirmation language for risky launches
- cleaner launch success / blocked / warning states

Approval value:
- increases operator confidence and perceived product quality immediately

### Milestone 7 — Sessions Command Center
Goal:
- Turn active session monitoring into a premium control room.

What it should deliver:
- stronger live session status presentation
- better session tabs/history hierarchy
- cleaner stop/restart/review flows
- clearer terminal/log surfacing
- stronger state distinction between:
  - queued
  - running
  - completed
  - blocked
  - failed

Approval value:
- makes AgentDock feel like a serious operations surface

### Milestone 8 — Advisor + Recovery Experience
Goal:
- Make the advisor feel sharper, more decisive, and more integrated into user recovery paths.

What it should deliver:
- tighter fallback rule-based advice
- better recovery suggestions after blocked launches
- clearer install/setup commands for missing agents
- better project-type-specific recommendations
- more premium action-priority formatting

Approval value:
- turns advice into flow, not just text output

### Milestone 9 — Memory, Evidence, and Trust Layer
Goal:
- Make historical evidence feel visible, useful, and trustworthy instead of buried.

What it should deliver:
- better known-good / blocked / failure summaries from `memory.md`
- project-aware evidence surfacing during planning and launch review
- stronger “don’t repeat this failure” visibility
- premium timeline/history treatment for recent outcomes

Approval value:
- raises AgentDock from launcher to learning command center

### Milestone 10 — Visual System + Premium Finish Pass
Goal:
- Give the whole product a senior-level visual and interaction finish without sacrificing zero-dependency simplicity.

What it should deliver:
- tighter visual hierarchy
- cleaner spacing and typography rhythm
- more premium cards, badges, states, and empty states
- consistent button semantics
- stronger modal/chat/assistant styling integration
- final end-to-end UX review across easy mode, advanced mode, mobile, and keyboard use

Approval value:
- converts “capable internal tool” into “premium operator product”

---

## Recommended Execution Order

1. Information Architecture Reset
2. First-Run Mission Control Flow
3. Project-Centered Home Screen
4. Profile Catalog Rebuild
5. Audit Explainability Upgrade
6. Launch Center Overhaul
7. Sessions Command Center
8. Advisor + Recovery Experience
9. Memory, Evidence, and Trust Layer
10. Visual System + Premium Finish Pass

## Recommendation

Approve the roadmap.

If you want the highest leverage sequence, treat Milestones 1 through 7 as the real overhaul core:
- architecture reset
- first-run clarity
- project-centered flow
- profile choice clarity
- audit trust
- launch trust
- session control-room quality

That sequence determines whether AgentDock feels premium or still reads as a powerful internal dashboard.

## Approval Statement Draft

Approve the AgentDock roadmap as a major premium UX and flow overhaul that preserves existing capability while redesigning the interface architecture, launch flow, session control experience, audit clarity, and overall product hierarchy. The success bar is not fewer features, but a more coherent, senior-engineered operator experience.
