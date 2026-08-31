/** User-facing H00T brand constants (path aliases may still include HootAi / agentdock). */
export const BRAND = {
  /** Primary wordmark — zeros, not letter O; always caps in UI */
  name: "H00T",
  /** Tagline under wordmark */
  subtitle: "AI Command Center",
  title: "H00T \u00b7 AI Command Center",
  /** Filesystem / package / CSS slug */
  slug: "h00t",
  mascotTagline: "My Ops OWL",
  dockLabel: "H00T docked",
  externalLabel: "outside H00T",
  legacyName: "AgentDock",
  /** Prior public wordmarks kept for migration notes / search */
  legacyWordmark: "HOOT",
  legacyNames: ["HOOT", "HOOTai", "HootAi", "AgentDock", "h00t", "hoot"] as const,
} as const;

/**
 * Brand colors resolve through the theme token layer (ui/src/index.css),
 * so they adapt to dark/light. Hex fallbacks preserve the dark-theme values.
 * CSS vars use --h00t-* with --hoot-* aliases during the migration window.
 */
export const BRAND_COLORS = {
  gold: "var(--h00t-gold, var(--hoot-gold, #ffb042))",
  goldLight: "var(--h00t-gold-light, var(--hoot-gold-light, #f5c878))",
  goldMid: "var(--h00t-gold-mid, var(--hoot-gold-mid, #e8a050))",
  goldDark: "var(--h00t-gold-dark, var(--hoot-gold-dark, #c8872e))",
  ink: "var(--h00t-ink, var(--hoot-ink, #0a0a0a))",
  face: "var(--h00t-face, var(--hoot-face, #12100e))",
  glow: "var(--h00t-glow, var(--hoot-glow, rgba(255,176,66,0.28)))",
} as const;
