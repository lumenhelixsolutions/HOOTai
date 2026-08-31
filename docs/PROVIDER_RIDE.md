# ProviderRide — H00T module + private standalone tool

**Product brand:** **ProviderRide**  
**h00t frontend:** wordmark **H00T** · tagline **AI Command Center**  
**Package:** `D:\projects\provider-ride` (standalone, private)  
**Host bridge:** `HootAi/provider-ride-host.js`  
**Doctrine:** OOTBIJS · HITL mutations · limited power  

## Intent

Flawless **provider cooldown / account** monitoring without turning h00t into an unconstrained browser agent. Patterns borrowed from [Agent-Reach](https://github.com/Panniantong/Agent-Reach) (`doctor`, multi-backend, fix prescriptions) applied only to **AI provider channels**.

## Dual surface

| Mode | Path | Use |
|------|------|-----|
| Standalone CLI | `provider-ride/cli.js` | Private environment doctor / dry-run booth / sealed creds |
| h00t module | host bridge + `/api/providers/*` | Command center matrix, coach tools, bootstrap |

## Golden path

1. Start h00t → bootstrap includes `providerRide`  
2. `GET /api/providers/doctor` → score + matrix + fixes  
3. HITL mark cooldown (existing `/api/providers/cooldown`)  
4. Store API keys via Settings or ProviderRide credentials API  
5. HITL Account Booth open allowlisted usage URL  

**No extension required** for first useful result.

## API

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/providers/doctor` | Read-only multi-backend matrix |
| GET | `/api/providers/ride/meta` | Package availability + policy table (`/reach/meta` alias) |
| GET | `/api/providers/booth` | Allowlisted targets |
| POST | `/api/providers/booth/open` | Allowlist open only — call after HITL Approve |
| GET/POST | `/api/providers/credentials` | AES-GCM sealed slots (never return plaintext) |
| GET | `/api/bootstrap` | Includes `providerRide` + `brand` |

## Coach tools

| Tool | HITL | Role |
|------|------|------|
| `providers_doctor` | No | Read-only doctor |
| `set_provider_status` | Yes | Cooldown / active |
| `credentials_list` | No | Masked presence |
| `credentials_put` / `delete` | Yes | Sealed vault |
| `booth_open` | Yes | Open allowlisted account URL |
| `generate_handoff` | Soft | Handoff packet |

## Credentials (safe intake + storage)

| Kind | Allowed | Notes |
|------|---------|--------|
| `api_key` | Yes | Dual-written into h00t launch key-vault |
| `session` | Yes (high risk) | Prefer tool accounts |
| `cookie` | Yes (high risk) | Manual paste only |
| `password` | **No** | Use booth login / API keys |

- **AES-256-GCM** per secret  
- Master key: `state/provider-ride/vault.master` (ACL-restricted)  
- Optional: `PROVIDER_RIDE_VAULT_PASSPHRASE`  

```bash
cd D:\projects\provider-ride
echo YOUR_KEY | node cli.js creds put claude api_key --stdin
node cli.js creds list
node cli.js doctor
```

## Forbidden

- Arbitrary URL open  
- Cookie export off-machine  
- Unattended browser automation  
- General social scrapers as core power  

## Legacy names

Former codename **Provider Reach** / package `provider-reach` is retired. Host still accepts old env vars and state dir as fallbacks.
