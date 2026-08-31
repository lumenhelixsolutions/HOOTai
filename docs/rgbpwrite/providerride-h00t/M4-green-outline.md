# M4 — Green team growth plan

## Narrative spine

**Problem** → Multi-provider local AI ops thrash on silent cooldowns and ad-hoc secrets.  
**Insight** → Treat providers as *channels* with ordered status backends and a doctor, not as a general web agent.  
**Method** → Dual surface (CLI package + h00t host), HITL mutations, AES-GCM vault, progressive booth.  
**Evidence** → Live doctor API, unit tests, UI panels, dual-write into launch paths.  
**Implication** → Operators get OOTB matrix; power stays propose→approve; future bridge/profiles optional.

## Audience takeaways

| Audience | One takeaway |
|----------|--------------|
| Operator | Command Deck shows ProviderRide score; seal keys in Settings; mark cooldowns with HITL. |
| Maintainer | Package lives at `provider-ride`; host bridge is thin; policy table is the power boundary. |
| Security-minded eng | Encryption at rest yes; master key local; no passwords; no cookie export off-box. |
| Portfolio lead | Reuse Agent-Reach *patterns*, not social reach; brand is ProviderRide under h00t. |

## Outline with word budgets (final ~4.2k)

1. Abstract (180)  
2. Scope & non-goals (350)  
3. System overview / dual surface (500)  
4. Doctor & channel model (700)  
5. Cooldown SSOT & handoff (450)  
6. Credentials & threat model (650)  
7. HITL & limited power (450)  
8. UI surfaces (400)  
9. Ops: bootstrap, stale server, tests (350)  
10. Roadmap & residuals (300)  
11. Conclusion (150)  
12. Appendix: APIs, paths (250)  

## Amplifiers

| ID | Type | Purpose |
|----|------|---------|
| T1 | table | Channel backends ordered list |
| T2 | table | HITL vs free tools |
| T3 | table | Claim honesty classes |
| F1 | ASCII arch | Dual surface diagram |
| C1 | callout | OOTBIJS golden path (zero extension) |

## Accessibility

- Glossary: ProviderRide, HITL, booth, doctor, dual-write, h00t  
- Progressive disclosure: abstract → ops appendix  
