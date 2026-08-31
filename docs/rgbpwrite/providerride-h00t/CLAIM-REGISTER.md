# Claim register — providerride-h00t

| ID | Claim | Evidence | Class | Red severity | Status |
|----|-------|----------|-------|--------------|--------|
| C1 | Dual surface package + host | `provider-ride/`, `provider-ride-host.js` | implementation-tested | — | accepted |
| C2 | Multi-backend doctor; cooldown registry wins | `doctor.js`, tests | implementation-tested | R4 mitigated in docs | accepted |
| C3 | AES-256-GCM secrets at rest + master key file | `secure-store.js`, `key-vault.js` | implementation-tested | R2 residual (host adversary) | accepted w/ threat model |
| C4 | Credential GET masks only | server routes | implementation-tested | — | accepted |
| C5 | HITL for booth/creds/set_provider_status | `coach-tools.js` | implementation-tested | R3 scoped | accepted |
| C6 | Deck panel + score chip | `ProviderRidePanel.tsx`, HealthStrip, CooldownStrip | implementation-tested | — | accepted |
| C7 | Settings seal UI | `ProviderRideCredentials.tsx` | implementation-tested | — | accepted |
| C8 | Frontend brand h00t | `brand.ts`, index.html | implementation-tested | R8 residual | accepted |
| C9 | Live doctor on current server | probe 2026-08-02 | implementation-tested | R7 residual | accepted |
| C10 | Session Bridge | plan | aspirational | — | roadmap |
| C11 | Isolated profiles | plan | aspirational | — | roadmap |
| C12 | Measured MTTR improvement | none | aspirational | R — | not claimed in body |
| C13 | Ban prevention | none | aspirational | R — | not claimed |

**Critical open:** none after wording fixes.  
**Major residuals:** host-adversary crypto model; coach-scoped limited power; stale-server ops.
