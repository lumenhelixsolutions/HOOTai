# HOOT Cognitive ASCII + Brain Fix — Combined Plan

> **Shipped** (2026-06-11) — Phase 0+1+2 cognitive ASCII **and** HOOT brain/API-key fix implemented.

**Date:** 2026-06-11  
**Relates to:** UIUX M7 (mascot polish) · `ui/src/lib/hoot-ascii.ts` · `hoot-logo.tsx` · `HootMascot.tsx`  
**User sketch:** [`image-36e327a0-f8d2-4f14-b8b7-5b5b55d0e14c.png`](../../agent-tools/) — hand-drawn face with labeled zones. Symbols cascade and **fluctuate in understandable ways** tied to current action.

### Sketch translation (Image #1)

The drawing is a **top-down face** with explicit labels and vertical connectors:

```
        THINKING ABOUT DOING
              │
    THINKING ─ A @ ! ─ THINKING    ← upper band (mind + intent)
              │
           ( ! ! )                  ← SEEING (eyes)
         THINKING ─┘   └─ THINKING
              │
             /▼\                      ← beak (user notes: off-center today)
              │
            DOING                     ← output drops below beak
```

| Sketch label | ASCII row | Role |
|--------------|-----------|------|
| **SEEING** | `( ! ! )` | Perception — what entered his view |
| **THINKING** (flanking line) | `A @ !` band | Processing — symbols **fluctuate** here (`A`, `@`, `!` mix) |
| **THINKING ABOUT DOING** | center of top band, `@` dominant | Intent — “about to act” |
| **DOING** | beak + row below | Action — glyph **emits downward** off the beak |

**Causal time order** (not top-to-bottom screen order): **see → think → intend → do**.  
**Visual emission order**: intent symbol **falls** from upper band → beak → **below** beak (`DOING` row).

---

## Problem

Today’s owl is **4 lines** (ears, eyes, beak, caption). Moods swap static glyphs but there is no:

- **Cognitive pipeline** (perceive → think → intent → act)
- **Symbol fluctuation** that reads as “working on X”
- **Beak alignment** under the eye center (each row centered independently → drift)

The sketch goal was **never implemented** — deferred behind telemetry + UI milestone work.

---

## Design north star

HOOT’s face is a **live state machine**, not a sticker:

1. **On trigger** — symbols **rise through cognition** (see in eyes → echo in thinking band → `@` intent) then **drop through beak** (doing).
2. **While action runs** — all active zones **pulse/cycle** in domain-specific patterns (not random).
3. **On completion** — settle to **hold** or idle.

The operator reads: *seeing · thinking · about to do · doing* — matching the sketch labels.

---

## Owl anatomy (v2 — matches sketch, 7 lines compact)

```
  /\_/\           ← crown/ears (optional; may omit in sm mascot)
   A @ !          ← THINKING band (+ intent: @ center when active)
  ( ! ! )         ← SEEING — eyes (L/R perception glyphs)
     ▽            ← beak — spine-aligned under pupil gap
     @            ← DOING emit (1–2 frames; glyph “fell off” beak)
  watching        ← caption (replaces sketch’s side labels in UI)
```

**Why this order:** sketch places **thinking/intent above eyes**, not below. Eyes stay the familiar “face” center; the `A @ !` band is the forehead/mind.

**Spine alignment (Phase 0 fix):**  
`faceCenterCol` from `( L R )` eye row → beak `▽` and emit glyph share that column. Fixes current drift where `>>`, `~▽~`, etc. mis-center.

**Thinking band format:** 7–11 chars, e.g. `  A @ !  ` idle, `  ! @ !  ` alert pulse, `  1 0 1  ` coding pulse. Three slots: left echo · **center intent** · right echo.

---

## Fluctuation engine

### Two-mode loop (user-approved: **both**)

| Mode | When | Behavior |
|------|------|----------|
| **Cascade** | Trigger edge (new signal, page change, coach message sent, scan start) | Phase sequence: **see** (eyes) → **think** (band fills) → **intent** (`@` centers) → **do** (glyph drops to beak + emit row) (~1.5–2.5s) |
| **Pulse** | Steady state while action continues | Cycle domain alphabet at `domain.tickMs` until trigger clears |

### `CognitiveRuntime` (new module in `hoot-ascii.ts`)

```ts
type CognitivePhase = "idle" | "perceive" | "think" | "intent" | "act" | "hold";

type CognitiveDomain =
  | "idle" | "alert" | "coding" | "scanning" | "thinking"
  | "launching" | "reading" | "monitoring" | "syncing" | "celebrating";

type DomainVocab = {
  perceive: string[];   // eyes ( L R ) — SEEING
  thinkingBand: string[]; // 3-slot forehead: left, center-intent, right — A @ !
  act: string[];        // beak glyph
  emit: string[];       // DOING row below beak
  pulse: {
    eyes?: string[][];
    band?: string[][];  // e.g. [["A","@","!"],["!","@","A"]]
    beak?: string[][];
  };
  tickMs: number;
};
```

**Fluctuation rules (understandable patterns):**

| Pattern | Example | Reads as |
|---------|---------|----------|
| **Binary flip** | `1↔0`, `01↔10` | Coding / compute |
| **Intensity ramp** | `·` → `!` → `!!` | Escalating alert |
| **Morph chain** | `!` → `@` → `>` | Alert → intent → launch |
| **Scan sweep** | `.` `..` `...` `=>` | Progress / scan |
| **Band echo** | eyes `!` → band `! @ ·` → band `· @ ·` | Seeing propagates upward per sketch |
| **Intent center** | `@` pulses in middle slot of `A @ !` | “Thinking about doing” |
| **Downward emit** | beak holds `@` → emit row shows `@` → clear | “Comes off the beak” |

Pulse uses **frame % pulse.length** — never random glyphs. Every symbol in a domain is documented in `COGNITIVE_DOMAINS`.

### Trigger → domain mapping

Reuse `resolveHootEmotion()` / `SIGNAL_EMOTIONS` but output `{ domain, phase, caption }`:

| Context | Domain | Pulse while active |
|---------|--------|-------------------|
| `coach:thinking`, `chatLoading` | `thinking` | `...` ↔ `@` in third eye; eyes `- o` |
| `/terminal`, `building`, `launch:running` | `coding` | `1↔0` eyes; mind `01↔10`; beak `>`/`;` |
| `scan:active`, `radarLoading` | `scanning` | `◎` pulse; mind `~`; beak `.` sweep |
| `radar:external`, `error`, `alert` | `alert` | `!↔!!` cascade then hold |
| `path:/activity`, `logging` | `monitoring` | `●↔○`; mind `::` |
| `syncing`, `installing` | `syncing` | `[~~]` mind; `=>` intent |
| `celebrating`, `proud` | `celebrating` | `^`/`★` short burst then hold |
| default | `idle` | soft blink `- -` occasionally |

**Coach LLM path:** on user send → cascade `thinking`; while `chatLoading` → pulse `...`/`@`; on reply → brief `act` then `hold`. On LLM error → `alert` cascade (`!`→`@`) even if chat text says unavailable.

---

## Domain vocabularies (Phase 2)

Each domain defines **cascade keyframes** + **pulse table**:

### Alert (sketch default: `!` → `@`)

| Phase | Thinking band | Eyes SEEING | Beak | DOING emit |
|-------|---------------|-------------|------|------------|
| perceive | `  · · ·  ` | `( ! ! )` | `▽` | — |
| think | `  ! · ·  ` | `( ! ! )` | `▽` | — |
| intent | `  ! @ !  ` | `( ! ! )` | `▽` | — |
| act | `  · @ ·  ` | `( ! ! )` | `@` | `@` |
| pulse | `!@!`↔`!@!!` | `( ! !!)` | `@`/`!!` | flicker |

### Coding (`1` / `0` per user request)

| Phase | Band | Eyes | Beak | Emit |
|-------|------|------|------|------|
| pulse | `1 0 1`↔`0 1 0` | `(1 0)↔(0 1)` | `>`/`;` | `0`/`1` drop |

### Scanning

| Phase | Band | Eyes | Beak | Emit |
|-------|------|------|------|------|
| pulse | `~ > ~`↔`~ =>` | `(◎ ◎)` | `.` | `.` `..` `...` |

*(Full table for all domains in implementation.)*

---

## Beak alignment fix (Phase 0)

- Add `faceCenterCol(lines.eyes)` → integer column.
- `alignRow(glyph, width, centerCol)` for mind, third eye, beak.
- Remove asymmetric padding in `brandBeakLine()`.
- Visual test: sm mascot (64px), lg (96px), coach header.

---

## HOOT brain / API key fix (same pass)

### Problem

Coach shows `LLM unavailable — incorrect API key` even when vault keys are valid and `hoot_brain.mode` is `ollama`.

**Root cause:** client `apiKey` from `localStorage` (`agentdock_gemini_key`) is sent on every chat request and **wins** over server vault resolution in `chat.js`:

```js
const resolvedKey = apiKey || resolveProviderKey(effectiveProvider) || ...
```

A stale or wrong browser key forces Gemini even when `resolveEffectiveBrain` picked Ollama, or poisons cloud calls when vault has the real key.

### Fix (server + UI)

| Layer | Change |
|-------|--------|
| **`chat.js`** | Resolve key as `resolveProviderKey(effectiveProvider) || vault fallback || trim(apiKey)` — only use client `apiKey` when non-empty **and** vault has no key for that provider. Never pass cloud keys to local providers (`__local__` / Ollama). |
| **`key-vault.js`** | Trim whitespace on `setVaultKey` / read paths so copy-paste keys don’t fail. |
| **`useAgentDockRuntime.ts`** | Stop sending `apiKey` when localStorage value is empty; when `hoot_brain.mode` is `ollama`/`auto` and no explicit cloud provider override, omit `apiKey` entirely (server resolves). |
| **`/api/coach/brain`** (optional) | Surface `last_error` from a lightweight probe so UI can show “Ollama down” vs “bad key”. |

### Brain fix acceptance

- [ ] Coach chat works with `hoot_brain.mode: ollama` when Ollama is up (no Gemini key sent)
- [ ] Coach chat works with `hoot_brain.mode: cloud` + valid vault Gemini key (browser stale key ignored)
- [ ] Error message distinguishes local unreachable vs invalid cloud key
- [ ] Existing `tests/coach-chat.test.js` / `key-vault.test.js` still pass

---

## Files to change

| File | Change |
|------|--------|
| `ui/src/lib/hoot-ascii.ts` | `CognitiveRuntime`, domains, **7-line sketch layout**, alignment helpers, wire `resolveHootEmotion` → domain |
| `ui/src/lib/hoot-logo.tsx` | Render thinking band + eyes + beak + emit; glow `@` and eye chars |
| `ui/src/index.css` | Optional `.hoot-ascii--emit` drop animation; `prefers-reduced-motion` static hold |
| `ui/src/context/CoachContext.tsx` | Expose `chatLoading` + trigger edges for cascade (if not already) |
| `tests/hoot-ascii.test.ts` | **New** — alignment, cascade phases, pulse cycles, domain resolution |
| `chat.js` | Vault-first key resolution; local provider key hygiene |
| `key-vault.js` | Trim keys on read/write |
| `ui/src/lib/useAgentDockRuntime.ts` | Conditional `apiKey` — omit when server should resolve |

---

## Phased delivery (approved scope: **0+1+2**)

### Phase 0 — Alignment hotfix
- Spine-centered beak/mind/third eye
- No behavior change yet

### Phase 1 — Cognitive stack + fluctuation engine
- 7-line sketch renderer (band above eyes, emit below beak)
- `CognitiveRuntime`: cascade on trigger, pulse while active
- Phase driver hooked to frame interval

### Phase 2 — Domain vocabularies + context wiring
- Full `COGNITIVE_DOMAINS` table
- Map all `resolveHootEmotion` triggers + page paths
- Coach chat: cascade on send, pulse on load, alert on error

### Phase 3 — Polish (optional follow-up)
- Emit particle below beak
- Reduced-motion static frame
- Brand/wordmark 6-line variant

---

## Acceptance criteria

- [ ] Beak glyph centered under eye gap (sm + lg mascot)
- [ ] On coach message send: visible cascade within 2s
- [ ] While scanning: scan-sweep pulse readable without caption
- [ ] On `/terminal` with live session: `1/0` coding pulse
- [ ] On alert/radar external: `!` in eyes → `! @ !` band → `@` drops off beak (matches sketch)
- [ ] Thinking band visibly above eyes (not below)
- [ ] `prefers-reduced-motion`: no emit drop; final hold frame only
- [ ] `npm run build` clean; new unit tests pass

---

## Open defaults (using unless you override)

| Decision | Default |
|----------|---------|
| Thinking band idle | `  · · ·  ` or `  A · !  ` (sketch-inspired) |
| Intent slot | center of band; `@` when “thinking about doing” |
| Emit animation | dedicated row under beak (sketch `DOING` connector) |
| Width | 11 cols; band uses 3-slot `L C R` within fit() |

---

## Approval

User selections (2026-06-11):

- **Fluctuation:** cascade on trigger + pulse/hold while action runs
- **Scope:** Phase 0 + 1 + 2 (cognitive ASCII)
- **Sketch attached:** Image #1 — topology locked (band above eyes, emit below beak)
- **Combined pass:** HOOT brain / API key fix ships **in the same implementation pass** as cognitive ASCII
- **Design sign-off:** “that looks good” — sketch layout and fluctuation engine approved

Reply **execute the plan** / **ship it** to implement both workstreams.

---

## Execution order (single pass)

1. **Brain fix** — `chat.js`, `key-vault.js`, `useAgentDockRuntime.ts` (unblocks coach testing)
2. **Phase 0** — beak alignment helpers
3. **Phase 1** — `CognitiveRuntime` + 7-line renderer
4. **Phase 2** — domain vocab + coach `chatLoading` / error → `alert` cascade
5. **Verify** — `npm run build`, unit tests, restart server on `:7777`, smoke coach + mascot

---

## Not in scope (this plan)

- PNG owl logo replacement
- Full M7 coach dock redesign
- Phase 3 polish (emit particle, reduced-motion) — optional follow-up