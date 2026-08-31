# M5 — Blue team harden

**Persona:** Fact-checker / standards editor  

## Consistency

| Item | Check |
|------|-------|
| Version | HOOT 2.3.1 in package + status |
| Ports | 7777 HOOT, 11434 Ollama, OmniRoute 20131/20132 detect-only |
| Model default | gemma4:latest in hoot-brain + settings migration |
| HITL default | operator_policy.hitl true |
| Hubs | Operate, Machine, Trust, Fleet, Configure |

## Ethics / risk

- Local-first: keys in vault; vault notes read-only  
- No auto coding profile launch  
- Quarantine safetensors never hard-delete  

## Gate score

**Pass-with-residuals**

Critical Red R7 (process restart discipline) accepted as ops residual.  
Major residuals: design system debt, no browser E2E, metrics not longitudinal.

## Citation plan

- In-repo paths as primary evidence  
- No external DOIs invented  
- Live API smoke timestamps in dossier