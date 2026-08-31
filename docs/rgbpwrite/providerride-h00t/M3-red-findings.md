# M3 — Red team findings

## Thesis under attack

ProviderRide delivers “flawless” cooldown monitoring and “safe” credentials under limited power and HITL.

## Assault register

| ID | Target claim | Attack | Severity | Evidence demand | Kill thesis? |
|----|--------------|--------|----------|-----------------|--------------|
| R1 | “Flawless” cooldown | Cloud status is still largely **manual**; no live quota API. Expired cooldowns resolve on enrich, but accuracy depends on human marks. | **critical** (wording) | Never ship “flawless” without live probes or rephrase to “consistent / operator-visible” | No if wording fixed |
| R2 | “Safe” credential storage | AES-GCM + local master key ≠ HSM/OS keychain. Admin/malware on host can read master + vault. Base64 legacy migration is fine but past secrets may have lived unencrypted. | **major** | Explicit threat model; no “bank-grade” language | No |
| R3 | Limited power | Launch Center / human path can still launch coding profiles; coach path is limited, not whole product. | **major** | Scope “coach/ProviderRide surface” not “all of h00t” | No |
| R4 | Doctor truth | Multi-backend can report ACTIVE from scan/CLI while registry says unknown; vault “configured” ≠ valid key. | **major** | Document precedence: cooldown wins; presence ≠ validity | No |
| R5 | Dual-write keys | API key dual-write into launch vault increases blast radius if one store compromised. | **minor** | Document dual-write; optional opt-out later | No |
| R6 | Booth open | Allowlist reduces risk but `openExternal` still leaves operator in real browser; no guarantee of tool-account use. | **minor** | UX copy: tool accounts recommended | No |
| R7 | OOTBIJS | First paint depends on **current** server process; stale server shows doctor as down (observed). | **major** (ops) | Restart discipline + error copy (mitigated in UI) | No |
| R8 | Brand dualism | h00t vs HOOT vs agentdock package names confuse docs and metrics. | **minor** | Glossary; gradual rename | No |

## Overclaim / hype flags

- “Flawless cooldown monitor”  
- “Safe storage” without threat model  
- Equating Agent-Reach adoption with product completeness  

## Missing baselines / ablations

- No A/B of operator recovery time with vs without ProviderRide  
- No comparison to pure `provider-cooldown.json` editing  
- No penetration test of vault files  

## Recommended kill-list (must fix before ship in final paper)

1. Drop or quote “flawless”; use **operator-visible, multi-backend doctor with registry SSOT for cooldown**.  
2. Credential section must lead with **threat model: local host adversary wins**.  
3. Limited power claim scoped to **coach + ProviderRide tools**, not entire command center.  
4. Residual: stale-server ops class in Limitations.  
