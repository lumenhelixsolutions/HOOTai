---
title: Dashboard UI Integration for Compound Engineering Skills
status: active
date: 2026-06-07
origin: AgentDock CE backend integration ( Tasks 1-10 complete )
---

# Dashboard UI Integration for Compound Engineering Skills

## Problem Frame

AgentDock's backend now exposes Compound Engineering (CE) skills via `/api/skills/*` and audits every profile launch against model capabilities and CE compatibility. However, the React dashboard (`ui/`) has no awareness of these endpoints. Users cannot browse available CE skills, see why a profile was blocked or warned, or discover CE-compatible alternatives. The audit system's value is trapped on the backend — launch failures appear as silent BLOCKED states with no actionable context.

## Scope Boundary

**In scope:**
- Surface CE skills catalog in the UI (read-only browsing)
- Display audit warnings/errors with actionable explanations
- Add CE compatibility badges to profile cards
- Integrate skills API into the existing API client

**Out of scope:**
- Editing or creating skills from the UI (skills are managed via `scripts/sync-ce-skills.js`)
- Deep CE workflow orchestration (launching multi-step CE pipelines)
- Real-time skill cache updates (manual refresh only)
- Changes to the root `index.html` legacy dashboard

## Requirements Traceability

| Requirement | Source | Verification |
|-------------|--------|--------------|
| Users can browse the CE skills catalog | `ce-plan` skill workflow + user request Option 1 | Visual inspection of new Skills page |
| Audit warnings are visible before launch | `auditProfile()` in `server.js` | Launch a warned profile and see the modal |
| CE-compatible profiles are visually distinguished | `compatibility-rules.json` CE compatibility matrix | Filter profiles by CE support |
| The UI does not break when skills API is unavailable | Zero-dependency runtime constraint | Block `/api/skills` in dev tools, verify graceful degradation |

## Decisions

1. **New page vs. integrated panel** — Add a dedicated `/skills` route rather than embedding in Dashboard. Skills are a distinct concern from system status; a full page supports search, category filters, and content preview without crowding the Dashboard.

2. **Audit surfacing in launch flow** — Add a pre-launch confirmation modal that displays audit `warnings`, `errors`, and `suggestions`. Errors block the launch button. Warnings show an "Launch Anyway" button requiring explicit confirmation. This mirrors the backend behavior exactly.

3. **API client extension pattern** — Add `getSkills()`, `getSkill(id)`, `getSkillContent(id)` to `ui/src/lib/api.ts` using the same `request<T>` wrapper. This maintains consistency with the 22 existing methods.

4. **No new dependencies** — The `ui/` app already uses `recharts` and `lucide-react`. Skill content preview renders as plain markdown in a scrollable panel. No markdown parser added.

5. **Badge strategy** — Profile cards already show `mode`, `task_mode`, `model`, `frontend` tags. Add a `CE` badge (purple) when `p.meta?.ce_compatible === true` (backend already computes this in `auditProfile`).

## Implementation Units

### Unit 1: API Client Extension
**Files:** `ui/src/lib/api.ts`
**Work:** Add three methods:
```ts
getSkills: () => request<{ skills: Array<any> }>('GET', '/api/skills'),
getSkill: (id: string) => request<any>('GET', `/api/skills/${encodeURIComponent(id)}`),
getSkillContent: (id: string) => request<{ content: string }>('GET', `/api/skills/${encodeURIComponent(id)}/content`),
```
**Test:** Verify methods return data when server has synced skills.

### Unit 2: Skills Page
**Files:** `ui/src/pages/SkillsPage.tsx` (new), `ui/src/App.tsx`
**Work:**
- Create `SkillsPage` with category-filtered grid of skill cards
- Each card shows: name, description, category, cached/on-demand status
- Clicking a card opens a side panel with full markdown content
- Add route `/skills` in `App.tsx`
- Add navigation link in `AppLayout.tsx`
**Test:** Navigate to `/skills`, verify all 39 skills load, verify content panel opens.

### Unit 3: Audit Launch Modal
**Files:** `ui/src/pages/ProfilesPage.tsx` (modify launch handler)
**Work:**
- Before calling `api.launch(id)`, call `api.dryRun(id)` which now returns audit results
- If `dryRun` returns `errors`, show modal with errors and disabled launch button
- If `dryRun` returns `warnings`, show modal with warnings and "Launch with Override" button
- If `dryRun` returns `suggestions`, show them as alternative profile links
**Test:**
- Launch a `local-heavy-refactor-gemma4b.md` profile → expect warning modal (model tier mismatch)
- Launch a blocked profile → expect error modal
- Launch a ready profile → no modal, direct launch

### Unit 4: CE Compatibility Badges
**Files:** `ui/src/pages/ProfilesPage.tsx`, `ui/src/pages/Dashboard.tsx`
**Work:**
- Add `ce_compatible` field to profile state computation in `server.js` `evaluateProfiles`
- In profile cards, render a `<Tag text="CE" color="#a855f7" />` when `p.ce_compatible === true`
- In Dashboard stats, add a "CE-Ready Profiles" counter
**Test:** Verify 8 CE workflow profiles show the badge. Verify local-only profiles do not.

### Unit 5: Backend Field Exposure
**Files:** `server.js`
**Work:**
- Ensure `evaluateProfiles` includes `ce_compatible: true` when `auditProfile(p).errors.length === 0 && auditProfile(p).suggestions.length === 0` for CE workflows
- Ensure `dryRun` response includes full audit object: `{ audit: { warnings, errors, suggestions, taskMode } }`
**Test:** `node --test tests/*.test.js` passes.

## Dependencies & Sequencing

```
Unit 5 (backend field exposure)
        ↓
Unit 1 (API client) ──→ Unit 2 (Skills page)
        ↓
Unit 4 (badges) ───────→ Unit 3 (audit modal)
```

Unit 5 must land first — the UI cannot render what the backend does not expose. Units 1, 2, and 4 are parallelizable once Unit 5 is complete. Unit 3 depends on Unit 4's badge logic (shared profile state shape) and Unit 5's audit response format.

## Risks

| Risk | Mitigation |
|------|------------|
| `server.js` `dryRun` currently returns preview data, not audit data | Verify `dryRun` endpoint already calls `auditProfile` or extend it to do so |
| UI bundle size increase from new page | Skills page is lazy-loaded if needed; initial assessment: negligible (single component file) |
| Skills API 404 when cache is empty | SkillsPage shows empty state with "Run sync script" CTA linking to `AGENTS.md` instructions |

## Test Scenarios

1. **Skills catalog loads:** Open `/skills`, observe 39 skill cards with correct categories.
2. **Skill content preview:** Click `ce-plan`, observe markdown content panel with `# Create Technical Plan` heading.
3. **Audit warning blocks launch:** Select `local-heavy-refactor-gemma4b.md`, click Launch, observe warning modal about model tier.
4. **Audit error prevents launch:** Select a profile with insufficient context, click Launch, observe error modal with disabled launch button.
5. **CE badge visibility:** Filter profiles by "CE Compatible", observe exactly 8 profiles (the `compound-*` workflow profiles).
6. **Graceful degradation:** Stop the server, refresh `/skills`, observe friendly error state instead of crash.

## Outcome Log

- **Planned by:** Kimi Code using `ce-plan` skill
- **Date:** 2026-06-07
- **Next step:** Implement Unit 5 (backend field exposure), then parallel Units 1, 2, 4
