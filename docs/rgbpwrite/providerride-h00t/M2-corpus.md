# M2 — Corpus & inventory

## Primary code (implementation)

| Path | Role |
|------|------|
| `D:\projects\provider-ride\` | Standalone ProviderRide package |
| `provider-ride/index.js` | META, exports, version 0.2.0 |
| `provider-ride/doctor.js` | Multi-backend channel doctor |
| `provider-ride/channels.js` | Channel defs, booth URL allowlist |
| `provider-ride/credentials.js` | Slot intake (`provider:kind`) |
| `provider-ride/secure-store.js` | AES-256-GCM + master key + ACL |
| `provider-ride/account-booth.js` | Allowlisted open only |
| `provider-ride/policy.js` | HITL / risk / forbidden actions |
| `provider-ride/cli.js` | `doctor`, `policy`, `booth`, `creds` |
| `HootAi/provider-ride-host.js` | Host bridge → h00t state dir |
| `HootAi/key-vault.js` | Launch vault AES-GCM + migrate from base64 |
| `HootAi/provider-cooldown.js` | Cooldown SSOT registry |
| `HootAi/server.js` | Routes: doctor, booth, credentials, bootstrap `providerRide` |
| `HootAi/coach-tools.js` | `providers_doctor`, `credentials_*`, `booth_open` HITL |
| `HootAi/ui/src/lib/provider-ride.ts` | UI types |
| `HootAi/ui/src/hooks/useProviderRide.ts` | Poll doctor |
| `HootAi/ui/src/components/deck/ProviderRidePanel.tsx` | Command Deck panel + score chip |
| `HootAi/ui/src/components/settings/ProviderRideCredentials.tsx` | Seal UI |
| `HootAi/ui/src/lib/brand.ts` | h00t / Local Ai Command Center |
| `HootAi/docs/PROVIDER_RIDE.md` | Product doc |

## Prior art (inspiration, not vendored)

| Source | Borrowed | Explicitly not borrowed into core |
|--------|----------|-----------------------------------|
| [Agent-Reach](https://github.com/Panniantong/Agent-Reach) | doctor, multi-backend, fix prescriptions, safe/dry-run ethos | Social channel scrapers as default power |
| [OpenCLI](https://github.com/jackwener/opencli) | Session-bridge *idea* (opt-in future) | Unattended drive of logged-in browser in v1 |
| Prior RGBP | `docs/rgbpwrite/hoot-command-center-seasons-abc/` | Seasons A–D HITL/HealthStrip foundations |

## Live probes (session)

| Probe | Result class |
|-------|----------------|
| `GET /api/providers/doctor` after server restart | **implementation-tested** — JSON score e.g. `6/8` |
| Stale server without route | SPA HTML → UI “unreachable” (ops residual) |
| Unit tests `provider-ride/test/*.test.js` | seal/reveal, cooldown authority, policy |
| Host test `tests/provider-ride-host.test.js` | package resolve + doctor |

## Metrics available

- Doctor `score` = ok/total channels  
- Cooldown registry gauges (`seconds_remaining`, `progress`)  
- Sealed credential `entry_count`  
- Client HITL metrics (HealthStrip localStorage) — not longitudinal server rollup  

## Gaps in corpus

- No formal security audit of master-key-on-disk model  
- No browser E2E for ApprovalSheet + credentials_put  
- Session Bridge extension not implemented  
