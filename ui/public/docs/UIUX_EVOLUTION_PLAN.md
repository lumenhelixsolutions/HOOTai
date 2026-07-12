# HOOT UI/UX Evolution Plan

Ten-milestone evolution of the HOOT (formerly AgentDock) interface. Grounded in the 2026-06-10 audit of `ui/src`. Brand direction: deepen the existing identity (gold owl on near-black, EB Garamond display + Inter body, sharp corners, terminal aesthetic) — do not replace it.

## Audit findings (2026-06-10)

- `body` hard-codes `bg-[#0a0a0a] text-white`; components use raw `BRAND_COLORS` hex and inline-style colors, bypassing the HSL token system in `index.css`. Result: the README's dark/light toggle cannot work (no toggle was found in the source at audit time).
- `AppLayout.tsx` (401 lines) uses inline styles with zero responsive breakpoints — desktop-only.
- Accessibility near-zero: `aria-` attributes in 2 of ~30 components; no `prefers-reduced-motion` despite scan-line/ASCII/glow animations.
- Body text is Inter weight 200 on near-black — readability risk at small sizes.
- Fonts load from Google Fonts CDN — conflicts with the local-first/offline promise.
- README claims full keyboard navigation; no `keydown` handlers found in `ui/src`.
- Monolith pages: StackBuilder 855 lines, Dashboard 678, Profiles 582, Modules 494, Settings 481, Terminal 437, LaunchCenter 403.
- `server.log` and 35 `logs/` artifacts tracked in git despite matching `.gitignore` patterns (added after the files were committed).

## Milestones

### M1 — Theme integrity & local-first foundation
Route global colors through the HSL token system; add a working light theme (`.light` class on `<html>`, dark remains default) with a persisted ThemeToggle; self-host Inter / EB Garamond / Fira Code via Fontsource (no CDN); raise body weight 200 → 300; fix the `font-mono` token to Fira Code; global `prefers-reduced-motion` baseline; untrack committed logs.
**Acceptance:** zero hard-coded colors in `index.css`/`brand.ts`; toggle persists across reloads; `vite build` clean; server tests untouched.
**Honest scope note:** M1 makes the light theme correct at the token/global layer. Surfaces that hard-code dark inline styles (AppLayout, pages) reach full light-mode fidelity as each is migrated in M2–M8.

### M2 — Responsive AppLayout & command navigation
Rebuild AppLayout on tokens + Tailwind classes: collapsible sidebar, mobile drawer, route-aware states; Ctrl+K command palette covering all routes plus actions (launch profile, run scan, open terminal); `?` shortcut overlay making the README's keyboard claim true.

### M3 — Dashboard widget decomposition
Split the 678-line Dashboard into independent widgets (scan status, Token Burn/RTK, Agent Radar, recent activity, quick launch), each with designed loading/empty/error states; recharts themed from tokens.

### M4 — Launch & Terminal experience
Session tabs with status chips (running / exited / blocked-by-memory), ANSI fidelity, sticky autoscroll with pause-on-scrollback, in-output search, copy/export, kill/restart affordances.

### M5 — Stack Builder evolution
Decompose the 855-line flagship into a guided flow: goal → live compatibility filtering from `compatibility-rules.json` → preview → save as profile; inline incompatibility explanations; diff against existing profiles.

### M6 — Profiles & Modules unification
Shared card/list system across Profiles and Modules; memory.md-blocked profiles surfaced with reasons; capability badges; favorites/pinning.

### M7 — Coach & mascot system polish
Consistent docked-coach behavior (CoachContext/CoachThread/HeadCoach); screen-aware hints unified through ViewGuideBar with dismissal memory; static-owl reduced-motion variant of HootMascot.

### M8 — Settings & first-run onboarding
Section the Settings page (Appearance with theme toggle, Auth/Unlock, Research sources, Advanced); first-run flow: scan → recommendation → first launch.

### M9 — Accessibility & motion pass
Aria roles, focus management, keyboard-only operability on every route; reduced-motion honored by all animations; WCAG AA contrast audit (gold-on-black, muted text).

### M10 — Design-system docs, visual regression & release
Extract shared primitives into a documented `ui` kit; Playwright screenshot regression; build-size budget; README screenshot refresh; CHANGELOG; version 2.1.

## Sequencing
Tokens gate everything (M1) → layout (M2) → surfaces in traffic order (M3–M8) → a11y enforced per-milestone and swept once (M9) → consolidation and release (M10).

## Exit criteria per milestone
`vite build` clean, TypeScript clean, server `node --test` suite untouched and passing, and the staff-engineer question: would this ship?

## Status ledger

| Milestone | Status |
|---|---|
| M1 — Theme integrity & local-first foundation | **Integrated** (2026-06-11) |
| M2 — Responsive AppLayout & command navigation | **Integrated** (2026-06-11) |
| M3 — Dashboard widget decomposition | **Integrated** (2026-06-11) |
| M4 — Launch & Terminal experience | **Integrated** (2026-06-11) |
| M5 — Stack Builder evolution | **Integrated** (2026-06-11) |
| M6 — Profiles & Modules unification | Pending |
| M7 — Coach & mascot polish | **In progress** — cognitive ASCII + brain fix shipped 2026-06-11 |
| M8 — Settings & onboarding | Pending |
| M9 — Accessibility & motion pass | Pending |
| M10 — Design system, regression & release | Pending |