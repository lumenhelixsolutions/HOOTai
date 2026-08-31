# HOOT Command Center Evolution: Truth, Curation, and HITL Executive Control

**Technical report**  
**Product:** HOOT v2.3.1 (LumenHelix portfolio)  
**Scope:** Seasons A–D of UX/architecture evolution (2026-08 session)  
**Classification of claims:** See `CLAIM-REGISTER.md`  
**Authors:** RGBPwrite multi-team sprint (Red / Green / Blue / Purple)  

---

## Abstract

HOOT is a local-first AI command center that scans the machine, plans agent stacks, launches approved profiles, and hosts a coach “brain.” Deep capability accumulated faster than **truth**, **curation**, and **executive control**. This report documents a four-season product evolution—implemented in-repo and partially smoke-tested—that enforces *propose → approve → prove*, reorganizes navigation into five hubs, elevates the coach to a HITL control plane, and calms portfolio UX with a fleet narrative. We distinguish **implementation-tested** results from **modeled** UX judgments and list residuals honestly (design-system debt, longitudinal metrics, ops restart discipline).

**Keywords:** local AI, human-in-the-loop, command center UX, Ollama, progressive disclosure, OOTBIJS  

---

## 1. Executive summary

| Season | Theme | Operator-visible outcome |
|--------|-------|---------------------------|
| **A** | Truthful command center | HealthStrip; ApprovalSheet + pending dock; Home operator spine; scrubbed false “running” claims |
| **B** | Curated power | Five Advanced hubs; Vitals chapters; Settings essentials/expert |
| **C** | Owl runs the center | Multi-step workflows; screen bind pulse; full HITL timeline; optional vault knowledge |
| **D** | Fleet calm | Portfolio narrative; resilience copy; client HITL metrics chip |

**What this is not:** a claim that HOOT is finished, award-caliber across every pixel, or a replacement for Claude Code / Grok as coding agents.

**What operators should do:** hard-refresh UI after server restart; use Home spine for first path; Approvals → Start workflow for multi-step; Approve mutations only after reading the sheet.

---

## 2. Problem and context

### 2.1 Capability without spine

HOOT exposed scan, launch, vitals, token ledger, portfolio, pipeline, coach chat, and more. Review found:

- **Truth gaps** — prose claimed scans without executable commands or server execution  
- **Cognitive load** — ~18 routes; Advanced mode felt encyclopedic  
- **Coach gap** — local brain (Ollama/`gemma4`) answered, but executive control with HITL was incomplete  
- **Fleet anxiety** — portfolio grid without a single calm narrative  

### 2.2 Design principles adopted

1. **Truth > cleverness** — never claim execution without result  
2. **One spine** — Home golden path before satellite pages  
3. **Propose → Approve → Prove** — HITL is the brand of control  
4. **Basic is complete** — Advanced is optional power  
5. **Knowledge ≠ command** — Obsidian vault optional read-only; HOOT remains shell  

These align with OOTBIJS (out-of-the-box just works): smart defaults, fail-soft, doctor surfaces.

---

## 3. Architecture by season

### 3.1 Season A — Truthful command center

**A1 HealthStrip** (`ui/src/components/shell/HealthStrip.tsx`)  
Polls HOOT status, coach brain, cached scan. Surfaces Ollama/brain/scan age. On API failure: red state + restart command.

**A2 HITL chrome**  
- `ExecutiveControlContext` — global queue  
- `ApprovalSheet` — replace `window.confirm`  
- `PendingActionsDock` — survives navigation  

**A3 Operator spine** (`Dashboard` + `OperatorSpineWidget`)  
Steps: Scan → Brain → Project → Launch → Session. Primary CTA follows first incomplete step; mutations open approval sheet.

**A4 Copy truth** (`scrubFalseExecutionClaims` in `chat.js`)  
Strips false “Running the scan now” when no tool completed; appends pending Approve notice.

**Supporting backend:** scanner hard timeout (`HOOT_SCAN_TIMEOUT_MS`, default 90s); local LLM skips OpenRouter pricing refresh; native tool mutations propose under HITL.

### 3.2 Season B — Curated power

**B1 Hubs** (`app-shell.ts`)  

| Hub | Examples |
|-----|----------|
| Operate | Home, Readiness, Build, Launch, Session, Deck |
| Machine | Vitals |
| Trust | Approvals, Token Ledger, Activity |
| Fleet | Portfolio, Pipeline, Memory |
| Configure | Profiles, Modules, Settings, Docs |

**B2 Vitals chapters** — Overview | Models | Agents | Integrations | Bench via `?tab=`  

**B3 Settings tiers** — Essentials (brain, keys) vs Expert (LAN, llama.cpp, hybrid, wipe)  

**B4** — Hub blurbs + shell copy (full token migration residual — see Limitations)

### 3.3 Season C — Owl runs the center

**C1 Workflows** (`coach-workflows.js`)  
Examples: prepare-local-audit, brain-health-check, trust-review.  
API: `GET /api/coach/workflows`, `POST /api/coach/workflows/start`.  
UI: Approvals cards → enqueue HITL steps.

**C2 Screen binding**  
`data-hoot-bind="nav:/scan"` on nav; `.hoot-bind-pulse` when coach proposes.

**C3 Timeline**  
Logs soft+hard executes plus propose/deny via `POST /api/coach/approvals/log`.

**C4 Vault context**  
`readVaultContext` in `coach-mcp.js` — read-only excerpts from vault path (`HOOT_VAULT_PATH` or settings). Not a write surface.

### 3.4 Season D — Fleet calm

**D1** Portfolio **fleet narrative** before MVP grid.  
**D2** Resilience strings on HealthStrip (HOOT down / Ollama down / scan stale).  
**D3** `hoot-metrics.ts` client counters; HITL chip on HealthStrip (**not** longitudinal validation).

### 3.5 HITL policy (tools)

| Auto (read/plan) | HITL (mutate) |
|------------------|---------------|
| getStatus, readMemory, git_snapshot, read_hoot_file, makePlan | runScan, navigate, launchProfile (safe only), appendMemory, coachAction, cooldowns |

Coding/refactor profile launches remain blocked by operator policy.

---

## 4. Verification evidence

| Check | Result | Class |
|-------|--------|-------|
| Unit: brain, extract, scrub, workflows, detect | Pass | implementation-tested |
| Live: `/api/status` | ok | implementation-tested |
| Live: `/api/coach/brain` | ready, gemma4:latest | implementation-tested |
| Live: chat HOOT_LOCAL_OK via ollama | pass | implementation-tested |
| Live: workflows start prepare-local-audit | 4 steps | implementation-tested |
| UI `npm run build` | green | implementation-tested |
| Longitudinal HITL approve rate | not measured | residual |

---

## 5. Operator how-to (minimum path)

1. Ensure Ollama up; `gemma4:latest` available.  
2. Start HOOT: `pwsh D:\projects\scripts\start-hoot.ps1` (kill stale :7777 if upgrading).  
3. Hard-refresh browser.  
4. Home → **Operator spine** primary CTA (often Propose scan) → **Approve** on sheet.  
5. Advanced → Approvals → **Start workflow** for multi-step.  
6. Trust timeline and pending dock show truth of proposes/denials.  

---

## 6. Limitations and residuals

1. **Design-system debt** — Vitals/Settings still heavy on inline styles (C15 residual).  
2. **Metrics** — localStorage counters; not multi-device analytics.  
3. **Tool-use variance** — brain.available ≠ reliable native tool calling; flexible JSON parse mitigates.  
4. **Ops** — EADDRINUSE leaves old code on port without new routes.  
5. **No Playwright E2E** for ApprovalSheet.  
6. **Vault default path** is machine-local; set `vault_path` / env for portability.  
7. **Workflows** are HITL step queues, not autonomous multi-agent graphs (LangGraph sidecar remains optional/dry-run).  

---

## 7. Recommendations

### Immediate ops

- Document restart-before-smoke in runbooks.  
- Prefer cached scan + HITL refresh over blocking full scan on every page.

### Product next (Season E candidates)

- Server-side HITL metrics rollup  
- Unified component tokens for Vitals/Settings  
- Browser E2E for spine → Approve → scan complete  
- Optional “trust local operator” soft-auto for soft-only after N approvals  

### Organizational

- Keep coding agents (Claude/Grok) as code writers; HOOT as local ops + HITL  
- Keep Obsidian as knowledge plane  

---

## 8. Conclusion

Seasons A–D demonstrate that a local AI command center can regain **operator trust** without discarding depth: health and truth first, progressive hubs second, coach as HITL executive third, fleet narrative fourth. The implementation is **present and smoke-tested** in HOOT 2.3.1; residuals are real and listed. That honesty is itself part of the product doctrine.

---

## Appendix A — Key modules

See `M2-corpus.md`.

## Appendix B — Claim register

See `CLAIM-REGISTER.md`.

## Appendix C — Glossary

| Term | Meaning |
|------|---------|
| HITL | Human-in-the-loop approval before mutation |
| Spine | Ordered golden path on Home |
| Hub | Advanced nav group (Operate/Machine/Trust/Fleet/Configure) |
| Workflow | Ordered list of coach commands for HITL queue |
| Bind | UI target id for highlight pulse |
