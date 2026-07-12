# AI Coach

Proactive, Clippy-style assistance for HOOT core views. **HOOT** (My Ops OWL) surfaces contextual tips and one-click actions; the chat panel uses [assistant-ui](https://github.com/assistant-ui/assistant-ui) with a custom external-store runtime wired to `POST /api/chat`.

## Architecture

| Layer | Path | Role |
|-------|------|------|
| Hint rules | `coach-hints.js` | View-aware rules, top 3 hints by priority |
| API | `POST /api/coach/hints` | Merges scan, profiles, sessions, portfolio + `pageContext` |
| Context | `ui/src/context/CoachContext.tsx` | Hints fetch, dismiss (daily), action bus |
| UI | `ui/src/components/HeadCoach.tsx` | Proactive bubble + dock avatar |
| Chat | `ui/src/components/coach/CoachThread.tsx` | assistant-ui `Thread` + `Composer` |
| Runtime | `ui/src/lib/useAgentDockRuntime.ts` | `useExternalStoreRuntime` → `/api/chat` |

## pageContext

Each core view calls `setPageContext()` so hints reflect live UI state:

| View | Keys |
|------|------|
| `/` | `scanPresent`, `readyCount`, `blockedCount`, `portfolioIssues` |
| `/scan` | `scanLoaded`, `ollamaPresent`, `missingAgents` |
| `/profiles` | `viewMode`, `easyStep`, `easyTopPickId`, `blockedCount` |
| `/builder` | `stackScore`, `wizardStep`, `nodeCount`, `hasAgent`, `hasLlm` |
| `/launch` | `recommendedCount`, `previewProfileId`, `hasAuditWarnings` |
| `/terminal` | `runningCount`, `activeSessionId` |
| `/memory` | `hasBlockedEvidence` |
| `/settings` | `llamacppEnabled`, `llamacppInterest` |

Context resets on route change.

## Coach actions

Pages register handlers via `registerActionHandler(target)`:

- **Profiles:** `profiles-easy-mode`, `profiles-launch-top`
- **Launch:** `launch-review-first`, `launch-staged-go`
- **Scan:** `scan-run`
- **Stack Builder:** `wizard-agent`, `wizard-llm`, `template-local-audit`, `save-stack`, `launch-stack`, `tab-install`, `add-mcp-git`, `filter-loaded`

Bubble actions use `type: "navigate" | "chat" | "action"`.

## Adding a hint

1. Add rules in `buildCoachHints()` for the route.
2. If needed, extend `pageContext` from the page component.
3. For in-page actions, register a handler and use `type: "action"` in the hint.

## Dismissal

Hints dismissed via "Not now" are stored in `localStorage` (`agentdock_coach_dismissed`) and reset daily.

## View guides & tooltips

- `coach-guides.js` — per-screen features, orchestration, and always-on baseline hints
- `GET /api/coach/docs?view=/profiles` — static guide payload for tooltips
- `ui/src/lib/app-docs.ts` — client-side docs for `HelpTooltip` and `ViewGuideBar`
- `ViewGuideBar` — orchestration stepper + "Ask AI Coach" on every screen
- Chat requests include `coachView` + `pageContext` so the coach knows what you are looking at