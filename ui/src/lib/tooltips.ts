/**
 * Central tooltip registry — single source for HelpTooltip, HoverTip, and native title fallbacks.
 */
export type TooltipDef = {
  title: string;
  body: string;
  features?: string[];
  tips?: string[];
  orchestration?: string;
};

export const TOOLTIPS = {
  // Navigation & shell
  "nav.overview": {
    title: "Overview",
    body: "Mission dashboard — profile health, active project, portfolio git, and your next action before you launch anything.",
    features: ["Ready / Fixable / Blocked counts", "Active project switcher", "Portfolio git alerts", "Token burn + memory preview"],
    tips: ["Run Readiness if scan is stale", "Resolve blockers before Launch Center"],
    orchestration: "Start every session here, then follow the operator loop chips below.",
  },
  "nav.readiness": {
    title: "Readiness",
    body: "Full environment scan — agents on PATH, Ollama models, GPU, RTK, llama.cpp, and .env key presence.",
    features: ["One-click rescan", "Agent radar live processes", "GGUF discovery", "RTK token-burn panel"],
    tips: ["Scan after any install or env change", "Fix Ollama before local profiles"],
    orchestration: "Feeds Stack Builder scoring and profile readiness across the app.",
  },
  "nav.profiles": {
    title: "Profiles",
    body: "Pre-built agent+model+task launch profiles with dry-run audit and memory block awareness.",
    features: ["Easy 1-2-3 wizard", "Advanced grouped catalog", "Audit preview panel", "Telemetry per profile"],
    tips: ["Use Easy mode with 12+ profiles", "Never launch Blocked without reading Memory"],
    orchestration: "Pick Ready → preview audit → launch → Sessions → report outcome.",
  },
  "nav.sessions": {
    title: "Sessions",
    body: "Live terminal monitor for launched agent processes — stream output, send input, stop, and report outcomes.",
    features: ["Multi-session list", "ANSI-colored stream", "Outcome reporting to Memory", "Queue handoff from Launch"],
    tips: ["Report outcome when a session ends", "Stop runaway processes before switching providers"],
    orchestration: "Watch launches here; outcomes feed Memory and future profile scoring.",
  },
  "nav.launch": {
    title: "Launch Center",
    body: "Goal-based launch staging — privacy, speed, local, audit — with ranked recommendations and script preview.",
    features: ["Goal selector", "Recommended vs blocked lists", "Audit explainability", "One-click staged launch"],
    tips: ["Preview audit on experimental profiles", "Align goal with active project context"],
    orchestration: "Set goal → preview top pick → launch when audit is clean → Sessions.",
  },
  "nav.deck": {
    title: "Command Deck",
    body: "Live provider cooldown matrix — compact radial monitor with popout, recovery timeline, workspace context radar, and save-state handoffs.",
    features: ["Compact radial popout monitor", "Expand to full deck while floating", "Per-provider countdown gauges", "8-hour recovery timeline", "Agent radar + telemetry in popout"],
    tips: ["Top-bar strip shows deck everywhere", "Copy matrix line into your next AI chat"],
    orchestration: "Check before switching providers; generate save-state before handoff.",
  },
  "nav.activity": {
    title: "Activity",
    body: "Session diary, agent radar diffs, telemetry calendar, and per-project driver rollups.",
    features: ["14-day heatmap", "Day timeline", "External vs docked agent minutes", "Diary markdown export"],
    tips: ["HOOT switches to logging mood on this view", "Select a calendar day to filter the timeline"],
    orchestration: "Review after long sessions to see what HOOT logged automatically.",
  },
  "nav.burn": {
    title: "Token Ledger",
    body: "Multi-provider token burn — Codex exact, Claude exact+estimate, ChatGPT estimate — with work-family drivers, Fermi equivalents, and 30-day moving averages.",
    features: ["4-row log heatmap", "Last-hour now strip", "Work-family breakdown", "Per-tool matrix + sparklines", "Scale equivalents"],
    tips: ["Configure Codex roots and CSV paths via API config", "RTK prevention stays on Overview/Readiness"],
    orchestration: "Check cumulative burn before long multi-provider sessions; cross-check Activity for session minutes.",
  },
  "nav.bench": {
    title: "Local Model Bench",
    body: "Ollama smoke benchmarks — latency, tokens/sec, and pass/weak/missing tiers that adjust local profile readiness scoring.",
    features: ["CSV results table", "Run bench on model list", "Presets from scan-loaded models", "Scoring tier labels (fast/ok/slow)"],
    tips: ["Re-bench after ollama pull", "Use loaded-model presets from Readiness scan"],
    orchestration: "Run bench after pulling new models, then re-check Profiles for updated local scores.",
  },
  "nav.approvals": {
    title: "Coach Approvals",
    body: "Gated coach command log — launch, memory edits, and project switches — with Phase 4 progress toward operator trust.",
    features: ["Approval event table", "Phase 4 progress bar (10 gated runs)", "Blocked vs ok outcomes", "Profile and project context"],
    tips: ["Phase 4 unlocks at 10 logged gated commands", "Distinct from full coach audit log"],
    orchestration: "Review after coach launches or memory edits; track progress before enabling Phase 4 autonomy.",
  },
  "nav.portfolio": {
    title: "Portfolio",
    body: "MVP launcher hub — health cards for every portfolio repo with git status, project-brain freshness, next-best-move excerpts, and bridge links.",
    features: ["Responsive MVP card grid", "Git health from portfolio scan", "Brain timestamp + pipeline wiki flags", "Set active project per card", "Quick links to Pipeline and bundled docs"],
    tips: ["Set the active MVP before cross-repo work", "Auto-refreshes every 30m while HOOT tab is open", "Manual Refresh forces project-brain re-read"],
    orchestration: "Scan git + brain health here, then open Pipeline for milestones and integration matrix detail.",
  },
  "nav.pipeline": {
    title: "Pipeline",
    body: "Portfolio pipeline map — MILESTONES.md progress, cross-repo bridges, Phase 1 integration matrix, and per-repo project-brain freshness.",
    features: ["Active repo project overview", "Per-repo pipeline wiki excerpts", "Milestone cards", "Bridge + integration matrix", "Brain status table"],
    tips: ["Add wiki/pipeline-overview.md per repo for stage detail", "Auto-refreshes every 30m while HOOT tab is open", "Refresh registry after brain updates"],
    orchestration: "Check milestones before multi-repo work; read active project next-best-move before launching.",
  },
  "nav.memory": {
    title: "Memory",
    body: "Local evidence store — repeated failures block bad launches until you document a safe override.",
    features: ["Markdown evidence blocks", "Parsed on every launch", "Manual edit", "Coach can explain blocks"],
    tips: ["Edit carefully — launches read this file", "Ask HOOT how to unblock safely"],
    orchestration: "Check when profiles show Blocked; fix root cause, don't override blindly.",
  },
  "nav.builder": {
    title: "Stack Builder",
    body: "Visual stack composer — Agent → Model → Tools → Review with health scoring and quick templates.",
    features: ["Wizard + templates", "● = detected agents / loaded models", "MCP git assignment", "Save or launch directly"],
    tips: ["Use Local audit template for read-only work", "Target health score ≥ 80 before saving"],
    orchestration: "Compose → fix score → save profile → launch from Profiles or here.",
  },
  "nav.modules": {
    title: "Modules",
    body: "Prefab inventory — CE skills, MCP servers, bundled packs, and one-click install into detected frontends.",
    features: ["21 agents · 51 upstream skills", "Auto-sync interval", "MCP git/fetch toggles", "Full setup workflow"],
    tips: ["Sync 9 core skills before complex stacks", "HOOT reacts when sync or install runs"],
    orchestration: "Check inventory → sync → full setup → return to Stack Builder.",
  },
  "nav.settings": {
    title: "Settings",
    body: "API keys, provider routing, llama.cpp paths, hybrid workspace roots, C.O.R.E. budget hooks, and server sync.",
    features: ["Browser-local key storage", "Hybrid workspace + cooldown prefs", "llama.cpp GGUF path", "About + version info"],
    tips: ["Set a provider key for full Coach LLM answers", "Re-scan after local inference changes"],
    orchestration: "Configure once; revisit when adding providers or workspace roots.",
  },
  "nav.docs": {
    title: "Documentation",
    body: "Bundled operator guides, coach architecture, and implementation plans — shipped inside every HOOT build.",
    features: ["README operator guide", "AI Coach + chatbot docs", "Command Deck & hybrid workspace plans", "Searchable in-app browser"],
    tips: ["Docs update on each UI build", "Link from any screen guide for deeper context"],
    orchestration: "Reference before complex workflows or when onboarding a teammate.",
  },

  // Command Deck
  "deck.open": {
    title: "Open Command Deck",
    body: "Jump to the full cooldown monitor — gauges, timeline, context radar, handoff console, and telemetry health.",
    tips: ["Available from the top-bar strip on every screen"],
  },
  "deck.popout.open": {
    title: "Pop out floating monitor",
    body: "Opens an always-on-top window (Chromium Document PiP when available) with larger radial gauges, live telemetry, agent radar, and expand-to-full-deck.",
    features: ["Stays above IDE and other AI chats", "Cooldown + session + unlock stats", "Expand to full Command Deck in-place", "Optional HOOT chat overlay"],
    tips: ["Use the compact radial on Command Deck or top-bar PiP button", "Expand inside the floating window for gauges + timeline + telemetry"],
  },
  "deck.popout.close": {
    title: "Close floating monitor",
    body: "Closes the PiP/popup window. Registry polling continues in the main HOOT tab.",
  },
  "deck.popout.expand": {
    title: "Expand floating deck",
    body: "Grows the always-on-top window into the full Command Deck — provider gauges with actions, recovery timeline, agent radar, and telemetry sync.",
    tips: ["Use Compact to shrink back to the monitor", "Chat can overlay on the expanded deck"],
  },
  "deck.popout.collapse": {
    title: "Compact floating monitor",
    body: "Shrinks the popout back to the larger radial monitor — gauges, telemetry row, agent radar, and matrix line.",
  },
  "session.refresh": {
    title: "Session refresh",
    body: "Intelligence views reload on open and every 30 minutes while this tab stays visible.",
    tips: ["Portfolio and Pipeline pass refresh=1 to re-read project-brain", "Command Deck cooldowns poll faster (30s)"],
  },
  "deck.refresh": {
    title: "Refresh provider registry",
    body: "Pulls the latest cooldown matrix from the server — updates gauges, timeline, and matrix ticker line.",
    tips: ["Auto-refreshes every 30s app-wide", "Top bar, deck, and popout share one registry"],
  },
  "deck.matrix.copy": {
    title: "Copy registry line",
    body: "Copies the paste-ready provider matrix header for your next AI chat — includes SESSION provider when set.",
    features: ["One-line status for Claude, Codex, Gemini, Grok, local", "Appends current session provider"],
    tips: ["Paste as the first message when switching providers mid-task"],
  },
  "deck.gauge.provider": {
    title: "Provider gauge",
    body: "Radial countdown for one provider. Green = active, red = cooldown, amber = almost recovered, sky = local always-on.",
    features: ["3h / 5h / til-reset quick actions", "Mark active to clear cooldown", "Est. messages recovered on unlock"],
  },
  "deck.context.window": {
    title: "Context window",
    body: "Filter workspace files touched within the selected hour window — see what changed and estimated token cost to feed an AI.",
    tips: ["1h for tight focus · 24h for end-of-day review"],
  },
  "deck.context.rescan": {
    title: "Rescan workspace",
    body: "Re-runs the workspace interceptor against configured hybrid roots — refreshes file list and token estimates.",
  },
  "deck.context.file": {
    title: "Touched file",
    body: "Recently modified file under a workspace root with size and estimated token cost if included in context.",
  },
  "deck.handoff.generate": {
    title: "Generate save-state",
    body: "Builds auto_handoff.md — structured project state (active project, profiles, cooldowns, radar, memory excerpt) for provider handoff.",
    features: ["Writes snapshot to disk when enabled", "Copy button for clipboard", "Strict manifest §4 block format"],
    tips: ["Generate before marking a provider COOLDOWN", "Paste into the next AI's first message"],
  },
  "deck.handoff.auto": {
    title: "Auto handoff on cooldown",
    body: "When armed in Settings → Hybrid workspace, HOOT writes auto_handoff.md the moment any provider is marked COOLDOWN.",
    tips: ["Toggle in Settings if you want zero-click handoffs"],
  },
  "deck.handoff.written": {
    title: "Snapshot written",
    body: "Save-state was persisted to disk at this path — safe to reference across sessions and provider switches.",
  },
  "deck.radar.refresh": {
    title: "Refresh agent radar",
    body: "Re-scans running coding agent processes — docked (HOOT-launched) vs external (IDE, CLI, other tools).",
  },
  "deck.radar.agent": {
    title: "Agent process",
    body: "Detected coding agent with process count split between HOOT-docked and external sessions.",
  },
  "deck.radar.query": {
    title: "Last user query",
    body: "Most recent user message captured from agent radar telemetry for this process group.",
  },
  "deck.soonest": {
    title: "Next provider unlock",
    body: "The provider with the shortest remaining cooldown — shown in the top-bar strip for at-a-glance planning.",
  },
  "deck.provider.mini": {
    title: "Mini provider gauge",
    body: "Compact radial indicator in the header strip — hover for provider name, state, and time remaining.",
  },
  "deck.chat.expand": {
    title: "Expand HOOT chat",
    body: "Opens the full Coach thread inside the floating monitor — ask about cooldowns, handoffs, or your active project.",
  },
  "deck.chat.collapse": {
    title: "Collapse chat",
    body: "Shrinks the popout back to gauges + radar only — keeps the window out of your way.",
  },

  // Shell controls
  "shell.commandPalette": {
    title: "Command palette",
    body: "Fuzzy-search every route and operator action — navigate, toggle theme, mark cooldowns, open docs.",
    tips: ["Ctrl+K from anywhere", "Arrow keys + Enter to run"],
  },
  "shell.theme": {
    title: "Theme toggle",
    body: "Switch between dark and light interface modes. Preference persists in localStorage.",
    tips: ["Ctrl+. shortcut", "Matches HOOT gold accent in both modes"],
  },
  "shell.sidebar.collapse": {
    title: "Collapse sidebar",
    body: "Shrinks the navigation dock to icon-only — more room for dashboards and terminals.",
    tips: ["Ctrl+B to toggle", "Tooltips remain on nav icons"],
  },
  "shell.version": {
    title: "HOOT version",
    body: "Engine, UI, C.O.R.E., and git commit info — hover for full build string.",
  },
  "shell.hoot.drag": {
    title: "Drag HOOT",
    body: "Reposition the floating coach avatar anywhere on screen — position persists per session.",
  },
  "shell.hoot.popout": {
    title: "Pop out HOOT",
    body: "Detach the coach panel into a floating window separate from the docked avatar.",
  },
  "shell.hoot.float": {
    title: "Float owl above windows",
    body: "Opens a transparent always-on-top PiP window with only the animated ASCII owl — click to open coach, drag to reposition.",
    features: ["Document PiP on Chromium", "Transparent background", "Right-click for owl face styles", "Persists drag position"],
    tips: ["Use when you want HOOT visible over your IDE without the full coach panel", "Cycle owl faces via right-click on the glyph"],
  },
  "shell.hoot.float.dock": {
    title: "Dock floating owl",
    body: "Closes the always-on-top owl window and restores the corner avatar.",
  },
  "shell.hoot.float.close": {
    title: "Close floating owl",
    body: "Closes the PiP owl window.",
  },
  "shell.hoot.pin": {
    title: "Pin HOOT on top",
    body: "Keeps the coach panel above other windows while you work in the IDE or browser.",
  },
  "shell.onboarding.dismiss": {
    title: "Continue later",
    body: "Dismisses the workspace setup wizard — reopen anytime from the command palette.",
  },

  // Activity & telemetry
  "activity.calendar": {
    title: "Activity day",
    body: "Total agent minutes and event count for this calendar day — click to filter the session timeline.",
  },
  "activity.project": {
    title: "Project driver",
    body: "Per-project activity rollup — minutes, sessions, and dominant agents for the selected window.",
  },
  "tokenburn.day": {
    title: "RTK savings day",
    body: "Estimated shell-output tokens saved on this day via RTK-tagged profiles and agents.",
  },

  // Settings
  "settings.keySource": {
    title: "Key storage source",
    body: "Where this API key was loaded from — browser localStorage, server settings, or environment.",
  },

  // Builder
  "builder.loadedOnly": {
    title: "Loaded models only",
    body: "Filter the model list to Ollama models currently loaded in memory — green ● means ready now.",
  },

  // Provider matrix (settings widget)
  "matrix.copy": {
    title: "Copy provider matrix",
    body: "Copies the live registry line — same format as Command Deck matrix ticker.",
  },
  "matrix.refresh": {
    title: "Refresh matrix",
    body: "Reload provider cooldown state from the server without leaving Settings.",
  },
  "matrix.provider": {
    title: "Provider status",
    body: "Live cooldown state with time remaining and rate-limit notes — click gauge actions on Command Deck for presets.",
  },
} as const satisfies Record<string, TooltipDef>;

export type TooltipId = keyof typeof TOOLTIPS;

export function getTooltip(id: TooltipId): TooltipDef {
  return TOOLTIPS[id];
}

/** Plain-text fallback for native title attributes and aria descriptions. */
export function tooltipTitle(id: TooltipId): string {
  const t = TOOLTIPS[id];
  const parts = [t.body];
  if (t.orchestration) parts.push(`Orchestration: ${t.orchestration}`);
  if (t.tips?.length) parts.push(`Tip: ${t.tips[0]}`);
  return parts.join(" · ");
}