# M3 — Red team assault

**Persona:** Hostile peer reviewer / skeptical operator  

| ID | Attack | Severity | Demand | Kill thesis? |
|----|--------|----------|--------|--------------|
| R1 | “Complete evolution” overclaims — Season D metrics are client-only, not longitudinal | major | Tag D3 as implementation-tested presence, not validated outcome | No |
| R2 | HealthStrip can show green while coach still fails tool-calling on weak models | major | Separate brain.available from tool-use success rate | No |
| R3 | Inline styles remain on Vitals/Settings — “one design system” not delivered | major | B4 was partial; state residual | No |
| R4 | Workflows are linear propose queues, not true multi-agent orchestration | minor | Clarify C1 is HITL step queue, not LangGraph | No |
| R5 | Vault path default `D:\akashic` is machine-specific | major | Document env/settings override | No |
| R6 | Scanner timeout may still leave UX waiting if UI awaits full scan | minor | Prefer cached scan + spine propose | No |
| R7 | EADDRINUSE / dual start scripts can leave old process without new routes | critical ops | Operator must kill :7777 before upgrade smoke | No |
| R8 | Success metrics in localStorage vanish per browser profile | minor | Accept or server-side later | No |
| R9 | Approvals “Phase 4” framing is legacy; may confuse | minor | Rename copy (done partially → timeline) | No |
| R10 | No automated E2E browser test for Approve sheet | major | Unit+API smoke only | No |

## Overclaims to reject

- “Award-caliber full UI redesign” — not claimed; only curation  
- “OmniRoute integrated” — detect-only only  
- “100% OOTBIJS” — improved, not perfect  

## Kill-criteria (thesis dies if)

1. Mutations execute without HITL when hitl true — **not observed**  
2. Status hangs indefinitely with no strip feedback — **mitigated by A1 + scanner timeout**