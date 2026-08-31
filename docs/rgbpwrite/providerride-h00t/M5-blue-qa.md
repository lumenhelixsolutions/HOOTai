# M5 — Blue team QA

## Gate score

**pass-with-residuals**

Critical Red wording (“flawless”, unbounded “safe”, unbounded limited power) must be corrected in Purple draft; technical corpus is real and paths exist.

## Claim register seed

| ID | Claim | Evidence | Class | Notes |
|----|-------|----------|-------|-------|
| C1 | ProviderRide is dual: sibling package + h00t host | `provider-ride/`, `provider-ride-host.js` | implementation-tested | |
| C2 | Doctor multi-backend with cooldown precedence | `doctor.js`, tests | implementation-tested | |
| C3 | Credentials AES-256-GCM at rest | `secure-store.js`, tests | implementation-tested | Not HSM |
| C4 | API never returns plaintext secrets | server credentials GET, masks | implementation-tested | |
| C5 | Coach mutations HITL for booth/creds/cooldown | `coach-tools.js` HITL_TOOLS | implementation-tested | |
| C6 | Command Deck shows ProviderRide panel | `ProviderRidePanel.tsx` | implementation-tested | |
| C7 | Settings seal UI exists | `ProviderRideCredentials.tsx` | implementation-tested | |
| C8 | Brand wordmark h00t | `brand.ts` | implementation-tested | |
| C9 | Doctor live JSON on current server | session probe 2026-08-02 | implementation-tested | Requires current process |
| C10 | Session Bridge extension | plan only | **aspirational** | |
| C11 | Isolated profiles | plan only | **aspirational** | |
| C12 | Improves operator MTTR vs baseline | none | **modeled/aspirational** | No study |
| C13 | Stops account bans | none | **aspirational** | Do not claim |

## Consistency issues

- Product **h00t** vs engine display strings still “HOOT” in places (`/api/status` product field) — residual brand dualism  
- Env aliases `PROVIDER_REACH_*` retained for migration  

## Ethics / dual-use / privacy

- Session/cookie kinds are high-risk: docs must recommend **tool accounts**, never encourage harvesting third-party cookies for abuse.  
- Localhost bind default reduces exposure; LAN+auth is separate Settings concern.  
- Dual-write increases secret copies—disclose.  

## Citation plan

- Agent-Reach, OpenCLI: GitHub URLs (inspiration)  
- Local paths as primary evidence  
- Prior seasons RGBP for HITL foundation  

## Residuals not blocking M7

1. No formal crypto audit  
2. Brand string dualism  
3. No operator study (C12)  
