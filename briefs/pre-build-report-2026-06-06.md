# Pre-Build Report — D:/projects Portfolio
**Date:** 2026-06-06  
**AgentDock Active Project:** lookBOOK  
**Scan Source:** AgentDock v2.0 Project Registry + Live Git Status

---

## 1. Portfolio Snapshot

| # | Project | Type | Git | Commits | Remote | Clean | AGENTS.md |
|---|---------|------|-----|---------|--------|-------|-----------|
| 1 | **agentdock** | node | ✅ | 5 | ❌ **NONE** | ❌ runtime dirty | ✅ |
| 2 | **cineforge** | python | ✅ | 1+ | ❌ **NONE** | ✅ clean | ❌ |
| 3 | **ecc** | node | ✅ | ~2,010 | ✅ `affaan-m/ECC` | ❌ dirty | ✅ |
| 4 | **lookBOOK** | generic | ⚠️ init, **0 commits** | ❌ **NONE** | ❌ 5 untracked | ❌ |
| 5 | **NOTEtoolsLM-v2** | node | ✅ | 3+ | ✅ `lumenhelixlab/NOTEtoolsLM` | ✅ clean | ✅ |
| 6 | **plinepro_kimi** | node | ❌ **NO GIT** | N/A | N/A | N/A | ❌ |
| 7 | **plpv2** | node | ❌ **NO GIT** | N/A | N/A | N/A | ❌ |
| 8 | **PromptPack** | node | ✅ | 3 | ❌ **NONE** | ❌ 11 uncommitted | ❌ |
| 9 | **racegps** | node | ✅ | 27 | ✅ `lumenhelixlab/raceGPS` | ❌ 1 uncommitted | ❌ |
| 10 | **scripts** | python | ✅ | 1+ | ❌ **NONE** | ❌ 5 untracked | ❌ |

**Score:** 3 of 10 projects have a working remote. 6 of 10 have AGENTS.md. 2 projects have no git at all.

---

## 2. Critical Issues (Blocking Next Build)

### 🔴 P0 — Version Control Hygiene Violations
Per the **AgentDock Work Ethos** (memory.md):
> "Every project must be initialized with Git before meaningful code is written. Remotes must be created and pushed within the first session. No project shall exist in a 'local only' state across build sessions."

Current violations:
- **lookBOOK**: `git init` done but **zero commits ever made**. 5 untracked files (`.gitignore`, `Modelfile`, `Modelfile.llama31`, `Modelfile.qwen2`, `lookBOOK_true_animation_github_repo/`).
- **plinepro_kimi**: No git repository at all.
- **plpv2**: No git repository at all.
- **agentdock**: 5 commits on `master`, but **no upstream remote** configured.
- **cineforge**: Has commits, but **no upstream remote**.
- **PromptPack**: Has commits, but **no upstream remote**. 11 uncommitted CWS assets.
- **scripts**: Has commits, but **no upstream remote**.

### 🟡 P1 — Missing Agent Onboarding
6 of 10 projects lack `AGENTS.md`. Without this, no AI agent can safely operate on the codebase.

---

## 3. Project Goals Review

### agentdock (Current Focus — Just Shipped Phase 2)
**Status:** v2.0 with React UI, 77 tests, AI Coach, Stack Builder.  
**Next:** Create GitHub repo `lumenhelixlab/agentdock`, push, add AGENTS.md to all downstream projects.

### lookBOOK (Active Project — At Risk)
**Status:** Alpha/MVP, animation compiler. Zero commits. No remote. No AGENTS.md.  
**Portfolio Goal:** v0.3.0 Multimodal AI integration (replace heuristic scene understanding with vision LLM).  
**Blocker:** Cannot meaningfully work on features until git is initialized and committed.

### PromptPack (Closest to Revenue)
**Status:** Chrome Extension, pre-launch/RC. CWS assets ready but uncommitted. No remote.  
**Portfolio Goal:** Chrome Web Store live by 2026-06-20.  
**Blocker:** Missing remote + uncommitted assets.

### racegps (Highest Creative Momentum)
**Status:** UE5 beta, 27 commits. 1 uncommitted 1.6M-line road graph.  
**Portfolio Goal:** v0.2.0 visual polish (Cesium 3D Tiles / Niagara FX).  
**Blocker:** Decide if `akron_road_graph.json` belongs in git or `.gitignore`.

### PipelineLM Pro (plinepro_kimi / plpv2)
**Status:** Two parallel copies, no git, simulated backend.  
**Portfolio Goal:** Consolidate to one repo, replace `setTimeout` simulation with real NotebookLM SDK.  
**Blocker:** No version control = catastrophic data loss risk.

### cineforge (Recently Evolved)
**Status:** Python backend, 1 commit, clean tree, no remote.  
**Portfolio Goal:** M1-M5 evolution complete per `9964125`. Needs remote + AGENTS.md.

---

## 4. Recommended Pre-Build Actions (Do These First)

### Step 1: Emergency Git Hygiene (15 min)
```powershell
# lookBOOK — commit the init
cd D:\projects\lookBOOK
git add -A
git commit -m "init: lookBOOK animation compiler"

# PromptPack — commit CWS assets
cd D:\projects\PromptPack
git add -A
git commit -m "assets: CWS submission screenshots, promo tiles, privacy policy"

# racegps — handle the datafile
cd D:\projects\racegps
# Review akron_road_graph.json — if generated, add to .gitignore
git add RACEGPS_AUTOFORGE_TECH_SPEC.md scripts/ tools/
git commit -m "docs: tech spec + build tooling"
```

### Step 2: Create Missing Remotes (10 min)
Run the existing script:
```powershell
cd D:\projects\scripts
.\create-github-repos.ps1
```
This should create remotes for `agentdock`, `cineforge`, `lookBOOK`, `PromptPack`, and `scripts` under `lumenhelixlab/`.

### Step 3: Initialize PipelineLM Pro (10 min)
```powershell
cd D:\projects\plinepro_kimi
git init
git add -A
git commit -m "init: PipelineLM Pro NotebookLM orchestrator"
# Archive plpv2 or merge as a branch
cd D:\projects\plpv2
git init
git add -A
git commit -m "init: plpv2 prototype (archive candidate)"
```

### Step 4: AGENTS.md Blitz (20 min)
Create minimal `AGENTS.md` in every project that lacks one. Template:
```markdown
# AGENTS.md

## Project
Name, domain, tech stack.

## Build
How to run tests, build, lint.

## Conventions
Coding style, file organization.

## Context
What an agent needs to know before editing.
```

---

## 5. Next Build Session Recommendation

**If you have 1–2 hours:**  
Do Steps 1–4 above. Portfolio hygiene is the highest-leverage work right now. Every project without a remote is one disk failure from deletion.

**If you have 3–4 hours:**  
Do Steps 1–4, then pick **ONE** of:
- **PromptPack**: Submit to Chrome Web Store (closest to shipping).
- **lookBOOK**: Add `AGENTS.md`, make first real commit, then begin multimodal AI integration.
- **racegps**: Review/ignore the 1.6M-line datafile, then prototype Cesium 3D Tiles integration.

**Do NOT start new features on any project until its git remote is created and pushed.**  
The work ethos is clear: "No project shall exist in a 'local only' state across build sessions."

---

## 6. AgentDock Stack Recommendation for This Session

| Goal | Recommended Profile |
|------|---------------------|
| Git hygiene bash scripts | `cloud-patch-test-codex` (fast, reliable) |
| AGENTS.md writing | `local-safe-audit` (read-only, safe) |
| PromptPack CWS submission | `cloud-heavy-refactor-claude` (docs + polish) |
| lookBOOK multimodal AI | `hybrid-bug-hunt-aider` (git-aware exploration) |

---

*Generated by AgentDock v2.0 Portfolio Health Scanner*
