# ProviderRide: A Limited-Power Provider Capability Layer for the h00t Local Ai Command Center

**Document type:** Technical report  
**Org:** LumenHelix / h00t portfolio  
**Date:** 2026-08-02  
**Package version:** ProviderRide 0.2.0 · h00t UI 2.3.1  
**Honesty policy:** Claims are tagged *implementation-tested*, *modeled*, or *aspirational*. No claim is “proved” beyond local implementation and unit/live API checks.

---

## Abstract

Local multi-provider AI work fails when cooldown state is manual, credentials are weakly protected, and agent tooling expands into unconstrained web automation. **ProviderRide** is a dual-surface capability layer—standalone private CLI package plus **h00t** host module—that applies Agent-Reach–style *doctor*, multi-backend status, and fix prescriptions **only** to AI provider channels (Claude, ChatGPT, Gemini, Kimi, DeepSeek, Perplexity, Ollama, llama.cpp). Mutations that change state (cooldown marks, Account Booth opens, credential puts) are **HITL**-gated on the coach path. Secrets are sealed with **AES-256-GCM** under a local master-key threat model. Command Deck and Settings surfaces expose the doctor matrix and sealed intake. This report describes architecture, interfaces, evaluation class, limitations, and roadmap. *Implementation-tested* unless noted.

**Keywords:** ProviderRide, h00t, HITL, cooldown, credential vault, OOTBIJS, multi-backend doctor, local AI ops

---

## 1. Scope and non-goals

### 1.1 In scope

- Provider channel readiness (doctor matrix)  
- Cooldown registry integration (SSOT remains `provider-cooldown.js`)  
- Allowlisted Account Booth URL open  
- Encrypted credential intake (API key / session / cookie kinds)  
- Coach tool policy and UI surfaces  
- Frontend brand: wordmark **h00t**, tagline **Local Ai Command Center**

### 1.2 Non-goals

- General social/web scraping as core power (Agent-Reach full channel set)  
- Unattended browser automation or password storage  
- OS keychain / HSM-grade secret protection  
- Claims of reduced platform ban rates or measured MTTR studies  

---

## 2. System overview

### 2.1 Dual surface

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  provider-ride (standalone) │     │  h00t (HootAi)               │
│  cli.js · doctor · creds    │◄───►│  provider-ride-host.js        │
│  AES vault (own state/)     │     │  state/provider-ride/         │
└─────────────────────────────┘     │  server routes · coach · UI   │
                                    └──────────────────────────────┘
```

| Mode | Path | First useful result |
|------|------|---------------------|
| Standalone | `D:\projects\provider-ride` | `node cli.js doctor` |
| Module | host + UI | Command Deck ProviderRide panel |

**Claim C1 — implementation-tested.**

### 2.2 Design principles (OOTBIJS + limited power)

1. **Golden path without extras** — doctor works with registry + scan + vault presence; extension/booth optional.  
2. **Propose → Approve → Execute** for mutations on coach path.  
3. **Read-only doctor** never marks cooldown.  
4. **Allowlist, not browse** for booth URLs.  
5. **Masks only** on credential list APIs.  

---

## 3. Channel model and doctor

### 3.1 Ordered backends (Table T1)

For each provider channel, status sources are probed in order. **Registry cooldown is authoritative** when status is cooldown.

| Order | Backend | Signal |
|------:|---------|--------|
| 1 | `registry` | Manual / HITL cooldown & session provider |
| 2 | `scan` | Last readiness scan tools/coders |
| 3 | `cli` | Detected coder IDs from scan |
| 4 | `vault` | API key presence (h00t key-vault or ProviderRide sealed `api_key`) |
| 5 | `live` | Ollama / llama.cpp reachability when supplied |
| 6 | `bridge` | Optional session bridge heartbeat (absent = optional) |
| 7 | `booth` | Last open metadata if any |

**Claim C2 — implementation-tested** (`provider-ride/doctor.js`, unit tests).

### 3.2 Output contract

`GET /api/providers/doctor` returns JSON including:

- `score` (`ok/total`)  
- `session_provider`, `alternates`  
- `channels[id].{status, active_backend, fixes[], booth[]}`  
- `matrix_line`  
- `credentials` status summary when host-attached  

Example snapshot (live session, not a performance claim): `score: "6/8"`. **Claim C9 — implementation-tested** on a *current* server process.

### 3.3 Precedence and honesty

- Presence of a key does **not** prove validity.  
- Scan ACTIVE does not override an explicit cooldown.  
- Unknown cloud status often means “operator has not marked it,” not “provider is down.”  

---

## 4. Cooldown SSOT and handoff

ProviderRide **does not replace** `provider-cooldown.js`. The registry remains single writer for status, presets (`3hr` / `5hr` / `midnight_pt`), gauge fields, and matrix line. Command Deck gauges and CooldownStrip continue to poll `GET /api/providers/cooldown`.

On cooldown enter, optional auto-handoff (existing hybrid workspace setting) drafts a packet recommending ACTIVE alternates. Switching providers remains a human decision.

---

## 5. Credentials and threat model

### 5.1 Threat model (lead, not bury)

| Adversary | Outcome |
|-----------|---------|
| Remote network (default bind 127.0.0.1) | Cannot read vault without local foothold (assuming no LAN exposure) |
| Local process with user privileges | **Can** read master key file + decrypt vault |
| Malicious extension / XSS (future) | Must not receive plaintext via GET (current API masks) |

This is **local encrypted-at-rest storage**, not a hardware security module. **Claim C3 — implementation-tested** for AES-256-GCM seal/open; **not** a claim of resistance to host administrators.

### 5.2 Mechanics

- Algorithm: AES-256-GCM, per-secret IV/tag  
- Master key: 32 random bytes in `vault.master` (Windows `icacls` owner-only / POSIX `0600`, best-effort)  
- Optional passphrase: `PROVIDER_RIDE_VAULT_PASSPHRASE` (scrypt)  
- h00t launch keys: `key-vault.js` also AES-GCM; migrates legacy base64 on access  
- Dual-write: sealing `api_key` may copy into launch vault env names so existing launch paths keep working (disclosed residual R5)

### 5.3 Allowed kinds

| Kind | Policy |
|------|--------|
| `api_key` | Allowed |
| `session` | Allowed, high risk — prefer tool accounts |
| `cookie` | Allowed, manual paste only — never auto-scrape |
| `password` | **Rejected** |

**Claim C4 — implementation-tested** (list APIs return masks; unit tests assert plaintext absent from vault file).

---

## 6. HITL and limited power

### 6.1 Coach tools (Table T2)

| Tool | HITL | Role |
|------|------|------|
| `providers_doctor` | No | Read-only matrix |
| `credentials_list` | No | Masks only |
| `set_provider_status` | Yes | Cooldown / active |
| `credentials_put` / `credentials_delete` | Yes | Vault mutate |
| `booth_open` | Yes | Allowlisted open |
| `generate_handoff` | Soft / existing policy | Packet |

**Claim C5 — implementation-tested.**

### 6.2 Scope of “limited power” (callout)

> **Limited power applies to the coach/ProviderRide tool surface.**  
> Human operators can still use Launch Center and terminal workflows for full coding launches.  
> Coding/shell remain blocked in coach-operator allowlists. Do not read this report as “h00t cannot launch coders.”

---

## 7. UI surfaces

| Surface | Behavior | Claim |
|---------|----------|-------|
| Command Deck `ProviderRidePanel` | Score, session, channel cards, top fixes, booth open, link to credentials | C6 |
| CooldownStrip / HealthStrip | `Ride {score}` chip | C6 |
| Settings `ProviderRideCredentials` | Provider/kind select, seal, masked list, delete | C7 |
| Brand | `h00t` · Local Ai Command Center | C8 |

Stale server processes that predate the doctor route SPA-fallback HTML for `/api/providers/doctor`; UI now surfaces a **restart** prescription (ops residual R7).

---

## 8. Operations and evaluation

### 8.1 Bootstrap

`GET /api/bootstrap` includes `providerRide` (and legacy alias `providerReach`) plus `brand`.

### 8.2 Tests (implementation-tested)

- `provider-ride/test/doctor.test.js` — cooldown authority, booth allowlist, policy  
- `provider-ride/test/credentials.test.js` — seal, no plaintext in file, kind rejection  
- `HootAi/tests/provider-ride-host.test.js` — host resolve + doctor  
- `HootAi/tests/chat-key.test.js` — launch vault still resolves after encrypt migration  

### 8.3 What is *not* evaluated

- Operator MTTR A/B (C12 **aspirational**, not claimed)  
- Account ban rates (C13 **not claimed**)  
- Formal crypto audit  

---

## 9. Related work and alternatives

| Approach | Relation |
|----------|----------|
| Agent-Reach | Inspiration for doctor/multi-backend; social channels **out of core** |
| OpenCLI | Future opt-in session bridge pattern; not shipped |
| Manual `provider-cooldown.json` | Still SSOT; ProviderRide *reads* and *explains* it |
| Cloud secret managers | Out of scope for offline-local default |

---

## 10. Roadmap (aspirational)

| Item | Claim class |
|------|-------------|
| Session Bridge browser extension (presence only) | C10 aspirational |
| Isolated Chromium profiles for tool accounts | C11 aspirational |
| Optional dual-write opt-out | residual fix |
| Onboarding preflight doctor step | product backlog |
| Unify remaining HOOT display strings → h00t | brand residual |

---

## 11. Limitations and threats to validity

1. **Cooldown accuracy** depends on operator marks for cloud providers; doctor does not scrape vendor quota UIs in v0.2.  
2. **Host-adversary crypto model** — local master key is recoverable by same-user malware.  
3. **Limited power is path-scoped** — coach vs Launch Center.  
4. **Stale server process** can hide new APIs behind SPA fallback until restart.  
5. **Brand dualism** — engine package/status strings may still say HOOT.  
6. **No user study** — productivity claims avoided.  
7. **Cookie/session kinds** increase account-takeover impact if misused; tool accounts recommended.  

---

## 12. Conclusion

ProviderRide gives h00t a **named, dual-surface capability layer** for provider readiness and credential hygiene without turning the command center into a general web agent. The doctor is multi-backend and operator-visible; secrets are encrypted at rest under an explicit local threat model; mutations stay HITL on the coach path; UI surfaces make the system usable daily. Future bridge and profile work remains optional progressive disclosure—not prerequisites for the golden path.

---

## Appendix A — HTTP surface

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/providers/doctor` | Doctor matrix |
| GET | `/api/providers/ride/meta` | Package meta (+ `/reach/meta` alias) |
| GET | `/api/providers/booth` | Allowlist catalog |
| POST | `/api/providers/booth/open` | HITL recommended |
| GET/POST | `/api/providers/credentials` | List masks / put-delete |
| GET/PATCH | `/api/providers/cooldown` | SSOT registry |
| GET | `/api/bootstrap` | `providerRide`, `brand` |

## Appendix B — CLI

```bash
cd D:\projects\provider-ride
node cli.js doctor
node cli.js policy
node cli.js booth list
echo KEY | node cli.js creds put claude api_key --stdin
node cli.js creds list
```

## Appendix C — Key paths

| Artifact | Path |
|----------|------|
| Package | `D:\projects\provider-ride` |
| Host | `HootAi/provider-ride-host.js` |
| Cred state | `HootAi/state/provider-ride/` |
| Cooldown | `HootAi/state/provider-cooldown.json` |
| Product doc | `HootAi/docs/PROVIDER_RIDE.md` |
| This sprint | `HootAi/docs/rgbpwrite/providerride-h00t/` |

## Appendix D — Glossary

| Term | Definition |
|------|------------|
| **h00t** | Frontend wordmark for the Local Ai Command Center |
| **ProviderRide** | Provider capability layer brand/package |
| **Doctor** | Read-only multi-backend readiness report |
| **HITL** | Human-in-the-loop approve before mutate |
| **Account Booth** | Allowlisted open of provider account/usage URLs |
| **OOTBIJS** | Out of the Box, It Just Works methodology |

## References / paths

1. Panniantong/Agent-Reach — https://github.com/Panniantong/Agent-Reach (inspiration)  
2. jackwener/OpenCLI — https://github.com/jackwener/opencli (inspiration)  
3. Local corpus — M2-corpus.md in this sprint directory  
4. Prior seasons report — `docs/rgbpwrite/hoot-command-center-seasons-abc/M10-technical-report-FINAL.md`  

---

*RGBPwrite M10 ship · claim register CLAIM-REGISTER.md · residuals SPRINT-DOSSIER.md*
