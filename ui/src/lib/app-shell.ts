import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  BookText,
  CalendarDays,
  Compass,
  Cpu,
  Flame,
  Gauge,
  Layers3,
  PlayCircle,
  Radar,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Wrench,
} from "lucide-react";

export type UiMode = "basic" | "advanced";
export type NavVisibility = UiMode | "both";

export type AppRouteDef = {
  label: string;
  path: string;
  icon: LucideIcon;
  group: string;
  tipId: string;
  visibility: NavVisibility;
  description?: string;
  loader?: () => Promise<{ default: ComponentType<any> }>;
  aliases?: string[];
};

export const APP_ROUTES: AppRouteDef[] = [
  { label: "Home", path: "/", icon: Radar, group: "Operate", tipId: "nav.overview", visibility: "both", loader: () => import("@/pages/Dashboard") },
  { label: "Readiness", path: "/scan", icon: ShieldCheck, group: "Operate", tipId: "nav.readiness", visibility: "both", loader: () => import("@/pages/ScanPage") },
  { label: "Build", path: "/builder", icon: Sparkles, group: "Operate", tipId: "nav.builder", visibility: "both", loader: () => import("@/pages/StackBuilder") },
  { label: "Launch", path: "/launch", icon: PlayCircle, group: "Operate", tipId: "nav.launch", visibility: "both", loader: () => import("@/pages/LaunchCenterPage") },
  { label: "Session", path: "/terminal", icon: TerminalSquare, group: "Operate", tipId: "nav.sessions", visibility: "both", loader: () => import("@/pages/TerminalPage") },
  { label: "Command Deck", path: "/deck", icon: Gauge, group: "Operate", tipId: "nav.deck", visibility: "advanced", loader: () => import("@/pages/CommandDeckPage") },
  { label: "Profiles", path: "/profiles", icon: Layers3, group: "Configure", tipId: "nav.profiles", visibility: "advanced", loader: () => import("@/pages/ProfilesPage") },
  { label: "Modules", path: "/modules", icon: Wrench, group: "Configure", tipId: "nav.modules", visibility: "advanced", loader: () => import("@/pages/ModulesPage"), aliases: ["/skills"] },
  { label: "Settings", path: "/settings", icon: SettingsIcon, group: "Configure", tipId: "nav.settings", visibility: "advanced", loader: () => import("@/pages/SettingsPage") },
  { label: "Documentation", path: "/docs", icon: BookText, group: "Configure", tipId: "nav.docs", visibility: "advanced", loader: () => import("@/pages/DocsPage") },
  { label: "Activity", path: "/activity", icon: CalendarDays, group: "Intelligence", tipId: "nav.activity", visibility: "advanced", loader: () => import("@/pages/ActivityPage") },
  { label: "Token Ledger", path: "/burn", icon: Flame, group: "Intelligence", tipId: "nav.burn", visibility: "advanced", loader: () => import("@/pages/TokenLedgerPage") },
  { label: "Vitals", path: "/vitals", icon: Cpu, group: "Intelligence", tipId: "nav.bench", visibility: "advanced", loader: () => import("@/pages/BenchPage") },
  { label: "Approvals", path: "/approvals", icon: ShieldCheck, group: "Intelligence", tipId: "nav.approvals", visibility: "advanced", loader: () => import("@/pages/ApprovalsPage") },
  { label: "Portfolio", path: "/portfolio", icon: Compass, group: "Intelligence", tipId: "nav.portfolio", visibility: "advanced", loader: () => import("@/pages/PortfolioPage") },
  { label: "Pipeline", path: "/pipeline", icon: Workflow, group: "Intelligence", tipId: "nav.pipeline", visibility: "advanced", loader: () => import("@/pages/PipelinePage") },
  { label: "Memory", path: "/memory", icon: BookOpen, group: "Intelligence", tipId: "nav.memory", visibility: "advanced", loader: () => import("@/pages/MemoryPage") },
];

export const PRIORITY_ROUTE_PATHS = ["/", "/scan", "/builder", "/launch", "/terminal"];

export const NAV_GROUP_ORDER = ["Operate", "Intelligence", "Configure"];

export function routeVisibleInMode(route: AppRouteDef, mode: UiMode) {
  return route.visibility === "both" || route.visibility === mode;
}

export function getRouteByPath(pathname: string) {
  return APP_ROUTES.find((route) => route.path === pathname || route.aliases?.includes(pathname));
}
