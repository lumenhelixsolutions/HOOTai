# HOOT Chatbot Builder

Coach UI standard for HOOT: **[assistant-ui](https://github.com/assistant-ui/assistant-ui)** in `ui/`, kernel APIs unchanged.

## Skill

Agents: `skills/chatbot-builder/SKILL.md`  
Portfolio canonical: `D:\projects\skills\chatbot-builder\SKILL.md`

## Current state

| Piece | Location | Notes |
|-------|----------|-------|
| Chat API | `chat.js` | Session map, multi-provider, `json commands` |
| Advisor | `advisor.js` | Rule-based + optional Gemini |
| UI | `ui/src/components/coach/CoachThread.tsx` | **assistant-ui** Thread + external-store runtime |
| Command gates | `ui/src/lib/coach-command-policy.ts` | Auto / soft / hard confirm per command type |
| Endpoint | `POST /api/chat` | `{ sessionId, text, context, provider, model }` |

## Target architecture

```
┌──────────────────────────────────────┐
│  ui/ — assistant-ui Thread         │
│  useAgentDockRuntime()               │
└──────────────┬───────────────────────┘
               │ POST /api/chat
┌──────────────▼───────────────────────┐
│  chat.js + advisor.js                │
│  context blob ← scan, profiles, mem  │
└──────────────┬───────────────────────┘
               │ launch (gated)
┌──────────────▼───────────────────────┐
│  profiles/*.md + audit + memory.md │
└──────────────────────────────────────┘
```

## Install (ui/ only)

```bash
cd ui
npx assistant-ui@latest init
npm install @assistant-ui/react
```

For a custom backend (not Vercel AI SDK), use `useExternalStoreRuntime` — see `skills/chatbot-builder/references/agentdock-integration.md`.

## Coach permission gates

Commands from `chat.js` must render as approval UI:

- **Auto:** `showMessage`, `openUrl`
- **Soft confirm:** `runScan`, `generatePlan`
- **Hard confirm:** `launch`, `setMemory`, `switchProject`

## Related docs

- `D:\projects\docs\CHATBOT_STACK.md` — portfolio standard
- `D:\projects\docs\AI_OS_ARCHITECTURE.md` — Coach module in AI OS