# Claim register

| ID | Claim | Evidence | Class | Red | Status |
|----|-------|----------|-------|-----|--------|
| C1 | HOOT local brain defaults to Ollama with gemma-first ranking | `hoot-brain.js`, settings migrate, live brain API | implementation-tested | — | accepted |
| C2 | Mutations require HITL Approve when hitl true | `coach-tools.js` HITL_TOOLS, ExecutiveControl, ApprovalSheet | implementation-tested | — | accepted |
| C3 | Flexible parse accepts local-model `{"action":"runScan"}` | `extractCommands` + tests | implementation-tested | — | accepted |
| C4 | False “running now” claims are scrubbed without tool success | `scrubFalseExecutionClaims` + tests | implementation-tested | — | accepted |
| C5 | Advanced nav is five hubs | `app-shell.ts` NAV_GROUP_ORDER | implementation-tested | — | accepted |
| C6 | Vitals uses chapter tabs via `?tab=` | `BenchPage.tsx` | implementation-tested | — | accepted |
| C7 | Workflows enqueue multi-step HITL sequences | `coach-workflows.js`, API smoke | implementation-tested | R4 | accepted (clarified as step queues) |
| C8 | Screen bind pulses nav on propose | ScreenBindHighlight + CSS | implementation-tested | — | accepted |
| C9 | Approvals log propose/deny/soft/hard | coach-approval-log.js | implementation-tested | — | accepted |
| C10 | Optional akashic vault read-only in coach context | coach-mcp readVaultContext | implementation-tested | R5 | accepted with override docs |
| C11 | Portfolio shows one fleet narrative first | PortfolioPage portfolioStory | implementation-tested | — | accepted |
| C12 | HealthStrip shows resilience + HITL metrics | HealthStrip + hoot-metrics | implementation-tested | R1,R8 | accepted as presence not longitudinal validation |
| C13 | UX maturity ~3.2/5 pre-season, improved after A–D | Review scorecard | modeled | R1 | accepted as opinionated review |
| C14 | Scanner hard timeout prevents forever children | server.js runScanner | implementation-tested | R6 | accepted |
| C15 | Full visual design-system unification complete | — | aspirational | R3 | **rejected / residual** |
