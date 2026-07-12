import { getTooltip } from "./tooltips";

export type ViewDoc = {
  title: string;
  group: string;
  summary: string;
  features: string[];
  orchestration: string;
  tips: string[];
};

function fromTooltip(id: Parameters<typeof getTooltip>[0], group: string): ViewDoc {
  const t = getTooltip(id);
  return {
    title: t.title,
    group,
    summary: t.body,
    features: t.features || [],
    orchestration: t.orchestration || "",
    tips: t.tips || [],
  };
}

export const VIEW_DOCS: Record<string, ViewDoc> = {
  "/": fromTooltip("nav.overview", "Command Center"),
  "/scan": fromTooltip("nav.readiness", "Command Center"),
  "/profiles": fromTooltip("nav.profiles", "Command Center"),
  "/launch": fromTooltip("nav.launch", "Command Center"),
  "/terminal": fromTooltip("nav.sessions", "Command Center"),
  "/deck": fromTooltip("nav.deck", "Command Center"),
  "/activity": fromTooltip("nav.activity", "Intelligence"),
  "/burn": fromTooltip("nav.burn", "Intelligence"),
  "/bench": fromTooltip("nav.bench", "Intelligence"),
  "/approvals": fromTooltip("nav.approvals", "Intelligence"),
  "/portfolio": fromTooltip("nav.portfolio", "Intelligence"),
  "/pipeline": fromTooltip("nav.pipeline", "Intelligence"),
  "/memory": fromTooltip("nav.memory", "Intelligence"),
  "/builder": fromTooltip("nav.builder", "Build + Configure"),
  "/skills": fromTooltip("nav.modules", "Build + Configure"),
  "/modules": fromTooltip("nav.modules", "Build + Configure"),
  "/settings": fromTooltip("nav.settings", "Build + Configure"),
  "/docs": fromTooltip("nav.docs", "Build + Configure"),
};

export function getViewDoc(path: string): ViewDoc {
  return VIEW_DOCS[path] || {
    title: "HOOT",
    group: "Command Center",
    summary: "Local AI command center — scan, launch, monitor, and hand off across providers.",
    features: ["Use sidebar navigation", "Ctrl+K command palette", "Ask the AI Coach on any screen"],
    orchestration: "Overview → Readiness → Profiles → Launch → Sessions → Memory",
    tips: ["Open Documentation for bundled operator guides", "Check Command Deck before switching providers"],
  };
}

export const ORCHESTRATION_STEPS = [
  { label: "Overview", path: "/" },
  { label: "Readiness", path: "/scan" },
  { label: "Profiles", path: "/profiles" },
  { label: "Launch", path: "/launch" },
  { label: "Sessions", path: "/terminal" },
  { label: "Memory", path: "/memory" },
];