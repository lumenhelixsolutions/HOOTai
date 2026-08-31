# M1 — Brief & charter

**Sprint:** hoot-command-center-seasons-abc  
**Genre:** Technical report (hybrid industry + engineering)  
**Audience:** Engineering leads, local-AI operators, portfolio maintainers  
**Facilitator:** Purple  

## Problem

HOOT (local AI command center) accumulated deep capability (scan, launch, vitals, coach, portfolio) but suffered:

1. **Truth gaps** — UI/chat claimed actions (“running scan”) without execution  
2. **Encyclopedic IA** — 18 routes without progressive silence  
3. **Chat-only coach** — brain worked but lacked executive control with HITL  
4. **Fleet anxiety** — portfolio grid without a calm narrative  

## Thesis

A **seasoned evolution** (A→D) can make HOOT *truthful, curated, coach-executable, and fleet-calm* without a framework rewrite—by enforcing propose→approve→prove, hub IA, workflows, and narrative-first portfolio UX.

## Success metrics

| Metric | Target |
|--------|--------|
| Status/brain respond when healthy | < 200ms / available |
| Mutations without Approve | Zero when `hitl: true` |
| Time-to-first useful path | Home spine CTA without nav hunting |
| Advanced nav groups | 5 hubs, not flat encyclopedia |
| Workflow start → HITL queue | One click from Approvals |

## Non-goals

- Replacing coding agents (Claude Code / Grok) with HOOT  
- Auto-running hard mutations for “agentic feel”  
- Obsidian as command shell (vault = knowledge only)  
- Full design-system rewrite of all inline styles  

## Honesty bar

| Class | Use |
|-------|-----|
| **implementation-tested** | Features present in `HootAi` code + live smoke this session |
| **modeled** | UX scores / maturity estimates from review |
| **aspirational** | Season D metrics not yet longitudinally measured |

## Output

`M10-technical-report-FINAL.md` + claim register + dossier.
