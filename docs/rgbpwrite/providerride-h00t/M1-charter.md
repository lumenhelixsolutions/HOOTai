# M1 — Brief & charter

**Slug:** `providerride-h00t`  
**Genre:** Technical report  
**Audience:** Engineering (operators of local AI command centers; portfolio maintainers)  
**Tone:** Technical deep-dive, honest claim classes  
**Length target:** ~3.5–5k words (final)  
**Sprint mode:** Full 10-milestone  

## Problem

Local multi-provider AI work (Claude, ChatGPT, Gemini, Kimi, Ollama, …) fails operationally when **cooldown state is manual and fragmented**, **credentials are stored weakly**, and **agent power expands into unconstrained browsing**. Operators need a **limited-power** capability layer that tells the truth about provider readiness and never acts without human approval.

## Thesis

**ProviderRide** is a dual-surface (standalone private package + h00t module) **capability layer**—inspired by Agent-Reach patterns (doctor, multi-backend, prescriptions) but **scoped only to AI provider channels**—that delivers cooldown/doctor truth, allowlisted Account Booth opens, and AES-GCM credential intake under **HITL** and **OOTBIJS** (first useful result without extension or booth).

## Success metrics

1. Operator can open Command Deck and see a live ProviderRide score/matrix without installing extras.  
2. Credentials can be sealed at rest (AES-256-GCM) with API masks only—no plaintext GET.  
3. Mutations (cooldown mark, booth open, credential put) require HITL when coach-mediated.  
4. Documentation and claim register distinguish implementation-tested vs aspirational.  

## Non-goals

- Full Agent-Reach social scraping (Twitter/Reddit/XHS, etc.) as core power  
- Unattended browser automation / password storage  
- Claiming cryptographic HSM / OS keychain equivalence  
- Longitudinal E2E proof of ban-risk reduction  

## Assumptions used

- Canonical app: `D:\projects\HootAi` (frontend brand **h00t** · tagline **Local Ai Command Center**)  
- Sibling package: `D:\projects\provider-ride`  
- Session work (2026-08) implemented doctor, vault, deck UI, settings credentials panel  
- Live doctor probe available when server is current (`GET /api/providers/doctor`)  

## Facilitator (Purple)

Proceed M2 with code paths and live API as primary corpus.
