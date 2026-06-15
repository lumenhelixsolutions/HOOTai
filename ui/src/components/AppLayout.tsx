import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  BookText,
  CalendarDays,
  Cpu,
  Flame,
  ChevronLeft,
  ChevronRight,
  Command,
  Compass,
  Gauge,
  Layers3,
  Menu,
  PanelLeft,
  PlayCircle,
  Radar,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import CommandPalette from "./CommandPalette";
import ShortcutHelp from "./ShortcutHelp";
import HootMascot from "./hoot/HootMascot";
import HootMark from "./HootMark";
import HootWordmark from "./HootWordmark";
import { BRAND } from "@/lib/brand";
import HelpTooltip from "./HelpTooltip";
import ViewGuideBar from "./ViewGuideBar";
import CooldownStrip from "./deck/CooldownStrip";
import { CooldownRegistryProvider } from "@/context/CooldownRegistryContext";
import { DeckPopoutProvider } from "./deck/popout";
import { HootFloatProvider } from "./hoot/hoot-float";
import { ToastProvider } from "./Toast";
import SessionPollProvider from "./SessionPollProvider";
import { getViewDoc } from "@/lib/app-docs";
import { getTooltip } from "@/lib/tooltips";
import { toggleTheme } from "@/lib/theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHootVersion } from "@/hooks/useHootVersion";

const priorityRoutes = ["/", "/scan", "/profiles", "/terminal"];

const NAV_TOOLTIP_IDS = {
  "/": "nav.overview",
  "/scan": "nav.readiness",
  "/profiles": "nav.profiles",
  "/terminal": "nav.sessions",
  "/launch": "nav.launch",
  "/deck": "nav.deck",
  "/activity": "nav.activity",
  "/burn": "nav.burn",
  "/bench": "nav.bench",
  "/approvals": "nav.approvals",
  "/pipeline": "nav.pipeline",
  "/portfolio": "nav.portfolio",
  "/memory": "nav.memory",
  "/builder": "nav.builder",
  "/modules": "nav.modules",
  "/settings": "nav.settings",
  "/docs": "nav.docs",
} as const;

const navGroups = [
  {
    title: "Command Center",
    items: [
      { label: "Overview", path: "/", icon: Radar, tipId: NAV_TOOLTIP_IDS["/"] },
      { label: "Readiness", path: "/scan", icon: ShieldCheck, tipId: NAV_TOOLTIP_IDS["/scan"] },
      { label: "Profiles", path: "/profiles", icon: Layers3, tipId: NAV_TOOLTIP_IDS["/profiles"] },
      { label: "Sessions", path: "/terminal", icon: TerminalSquare, tipId: NAV_TOOLTIP_IDS["/terminal"] },
      { label: "Launch Center", path: "/launch", icon: PlayCircle, tipId: NAV_TOOLTIP_IDS["/launch"] },
      { label: "Command Deck", path: "/deck", icon: Gauge, tipId: NAV_TOOLTIP_IDS["/deck"] },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Activity", path: "/activity", icon: CalendarDays, tipId: NAV_TOOLTIP_IDS["/activity"] },
      { label: "Token Ledger", path: "/burn", icon: Flame, tipId: NAV_TOOLTIP_IDS["/burn"] },
      { label: "Vitals", path: "/vitals", icon: Cpu, tipId: NAV_TOOLTIP_IDS["/bench"] },
      { label: "Approvals", path: "/approvals", icon: ShieldCheck, tipId: NAV_TOOLTIP_IDS["/approvals"] },
      { label: "Portfolio", path: "/portfolio", icon: Compass, tipId: NAV_TOOLTIP_IDS["/portfolio"] },
      { label: "Pipeline", path: "/pipeline", icon: Workflow, tipId: NAV_TOOLTIP_IDS["/pipeline"] },
      { label: "Memory", path: "/memory", icon: BookOpen, tipId: NAV_TOOLTIP_IDS["/memory"] },
    ],
  },
  {
    title: "Build + Configure",
    items: [
      { label: "Stack Builder", path: "/builder", icon: Sparkles, tipId: NAV_TOOLTIP_IDS["/builder"] },
      { label: "Modules", path: "/modules", icon: Wrench, tipId: NAV_TOOLTIP_IDS["/modules"] },
      { label: "Documentation", path: "/docs", icon: BookText, tipId: NAV_TOOLTIP_IDS["/docs"] },
      { label: "Settings", path: "/settings", icon: SettingsIcon, tipId: NAV_TOOLTIP_IDS["/settings"] },
    ],
  },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

export default function AppLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingData, setOnboardingData] = useState<Awaited<ReturnType<typeof api.getOnboarding>> | null>(null);
  const versionInfo = useHootVersion();

  const loadOnboarding = useCallback(() => {
    api.getOnboarding().then((data) => {
      setOnboardingData(data);
      if (!data.completed && data.current_step !== "ready") setOnboardingOpen(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadOnboarding();
  }, [loadOnboarding]);

  useEffect(() => {
    const open = () => setOnboardingOpen(true);
    window.addEventListener("hoot-open-onboarding", open);
    return () => window.removeEventListener("hoot-open-onboarding", open);
  }, []);

  const current = useMemo(() => {
    for (const group of navGroups) {
      const found = group.items.find((item) => item.path === location.pathname);
      if (found) return { ...found, group: group.title };
    }
    return { label: BRAND.name, desc: BRAND.subtitle, group: "Command Center" };
  }, [location.pathname]);

  const viewDoc = useMemo(() => getViewDoc(location.pathname), [location.pathname]);

  const focusItems = useMemo(
    () =>
      navGroups
        .flatMap((group) => group.items)
        .filter((item) => priorityRoutes.includes(item.path)),
    [],
  );

  // Close the mobile drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Global keyboard shortcuts: Ctrl/Cmd+K palette, ? help, Ctrl/Cmd+B sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setHelpOpen(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (isMobile) setDrawerOpen((v) => !v);
        else setCollapsed((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        toggleTheme();
      } else if (e.key === "?" && !isTypingTarget(e.target) && !paletteOpen) {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, paletteOpen]);

  const toggleSidebar = () => {
    if (isMobile) setDrawerOpen((v) => !v);
    else setCollapsed((v) => !v);
  };

  const sidebar = (
    <SidebarContent
      collapsed={!isMobile && collapsed}
      pathname={location.pathname}
      focusItems={focusItems}
      versionInfo={versionInfo}
      onCollapseToggle={() => setCollapsed((v) => !v)}
      showCollapseToggle={!isMobile}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <ToastProvider>
      <SessionPollProvider />
      <CooldownRegistryProvider pollMs={30000}>
      <DeckPopoutProvider>
      <HootFloatProvider>
      <div className="hoot-app-shell flex min-h-screen bg-background font-sans text-foreground">
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside
            className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card/95 shadow-[20px_0_60px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[width] duration-200"
            style={{ width: collapsed ? 88 : 280 }}
            aria-label="Primary navigation"
          >
            {sidebar}
          </aside>
        )}

        {/* Mobile drawer */}
        {isMobile && drawerOpen && (
          <div className="hoot-backdrop fixed inset-0 z-[80]" onMouseDown={() => setDrawerOpen(false)}>
            <aside
              className="flex h-full w-[280px] flex-col border-r border-border bg-card shadow-2xl"
              aria-label="Primary navigation"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end p-2">
                <button onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="p-2 opacity-70">
                  <X size={18} />
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <main
          className="flex min-h-screen flex-1 flex-col transition-[margin-left] duration-200"
          style={{ marginLeft: isMobile ? 0 : collapsed ? 88 : 280 }}
        >
          <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-xl md:px-7 md:py-5">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {isMobile && (
                  <button
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Open navigation"
                    className="-ml-1 p-1.5 text-muted-foreground"
                  >
                    <Menu size={20} />
                  </button>
                )}
                <div className="text-[11px] uppercase tracking-[0.18em] opacity-50">{current.group}</div>
                <div className="hoot-gold-chip rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
                  {BRAND.mascotTagline}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-serif text-xl font-semibold tracking-[-0.02em] md:text-[28px]">{current.label}</h1>
                  <HelpTooltip
                    title={viewDoc.title}
                    body={viewDoc.summary}
                    features={viewDoc.features}
                    orchestration={viewDoc.orchestration}
                    tips={viewDoc.tips}
                    size={16}
                  />
                </div>
                <div className="mt-1 hidden max-w-3xl text-sm opacity-70 sm:block">
                  {"tipId" in current ? getTooltip(current.tipId).body : current.desc}
                </div>
              </div>
              <div className="hidden flex-wrap items-stretch gap-3 lg:flex">
                <TopMetric
                  icon={<Radar size={16} strokeWidth={1.9} className="hoot-gold-text" />}
                  label="Primary loop"
                  value="Overview → Readiness → Profiles → Sessions"
                />
                <TopMetric
                  icon={<PanelLeft size={16} strokeWidth={1.9} className="text-green-300" />}
                  label="Operator focus"
                  value="Resolve blockers, launch with intent, stay in context"
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 md:flex-row md:items-center md:gap-3">
              <CooldownStrip />
              <HelpTooltip {...getTooltip("shell.commandPalette")} size={12}>
                <button
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Open command palette"
                  className="hoot-card-soft flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
                >
                <Command size={13} />
                <span className="hidden sm:inline">Search</span>
                <kbd className="border border-border px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
                </button>
              </HelpTooltip>
              <div className="hidden items-center gap-2 xl:flex">
                <StatusPill label="127.0.0.1 active" tone="green" />
                {versionInfo?.display ? <StatusPill label={versionInfo.display} tone="gold" /> : <StatusPill label={BRAND.subtitle} tone="gold" />}
                <StatusPill label="Profiles + sessions" tone="slate" />
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 md:px-7 md:py-7">
            <ViewGuideBar />
            <Outlet />
          </div>
        </main>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onToggleSidebar={toggleSidebar} />
        <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
        <OnboardingWizard
          open={onboardingOpen}
          initial={onboardingData}
          onClose={() => setOnboardingOpen(false)}
          onComplete={loadOnboarding}
        />
        <HootMascot />
      </div>
      </HootFloatProvider>
      </DeckPopoutProvider>
      </CooldownRegistryProvider>
    </ToastProvider>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  focusItems,
  versionInfo,
  onCollapseToggle,
  showCollapseToggle,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  focusItems: Array<{ label: string; path: string; tipId: (typeof NAV_TOOLTIP_IDS)[keyof typeof NAV_TOOLTIP_IDS] }>;
  versionInfo: ReturnType<typeof useHootVersion>;
  onCollapseToggle: () => void;
  showCollapseToggle: boolean;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className={`border-b border-border ${collapsed ? "px-4 py-[18px]" : "px-5 py-[22px]"}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center">
            <HootMark size={collapsed ? 48 : 60} />
          </div>
          {!collapsed && <HootWordmark />}
        </div>
        {!collapsed && (
          <div className="hoot-focus-card mt-[18px] rounded-[18px] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="hoot-gold-text text-[10px] uppercase tracking-[0.18em] opacity-80">Active focus</div>
            <div className="mt-2 text-[15px] font-semibold leading-snug">
              Keep overview, readiness, profiles, and sessions in one operating loop.
            </div>
            <div className="mt-2 text-xs leading-relaxed opacity-60">
              Prioritize what is healthy, who is configured, and which sessions need action next.
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-auto px-2.5 pb-5 pt-4" aria-label="Sections">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-[18px]">
            {!collapsed && (
              <div className="px-2.5 pb-2 text-[10px] uppercase tracking-[0.18em] opacity-40">{group.title}</div>
            )}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.path;
                const tip = getTooltip(item.tipId);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={tip.body}
                    className={`flex items-center gap-3 rounded-2xl no-underline ${
                      collapsed ? "justify-center p-3" : "px-3.5 py-3"
                    } ${active ? "hoot-active-item text-foreground" : "border border-transparent text-foreground/80 hover:bg-foreground/[0.03]"}`}
                  >
                    <Icon size={18} strokeWidth={1.8} className={active ? "hoot-gold-text" : undefined} />
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`text-[13px] ${active ? "font-semibold" : "font-medium"}`}>{item.label}</div>
                          <span onClick={(e) => e.preventDefault()} className="inline-flex">
                            <HelpTooltip {...tip} size={11} />
                          </span>
                        </div>
                        <div className="truncate text-[11px] opacity-50">{tip.body}</div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {!collapsed && (
          <div className="hoot-card-soft mt-2 rounded-[18px] p-3.5">
            <div className="mb-2.5 text-[10px] uppercase tracking-[0.18em] opacity-45">Core views</div>
            <div className="grid gap-2">
              {focusItems.map((item, index) => {
                const active = pathname === item.path;
                const tip = getTooltip(item.tipId);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    title={tip.body}
                    className={`flex items-center justify-between gap-3 py-2.5 no-underline ${
                      index === 0 ? "" : "border-t border-border"
                    } text-foreground`}
                  >
                    <div>
                      <div className={`text-[13px] ${active ? "font-semibold" : "font-medium"}`}>{item.label}</div>
                      <div className="mt-0.5 text-[11px] opacity-50">{tip.tips?.[0] || tip.body}</div>
                    </div>
                    <Compass size={15} className={active ? "hoot-gold-text" : "opacity-40"} />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <VersionFooter collapsed={collapsed} versionInfo={versionInfo} />

      <ThemeToggle collapsed={collapsed} />

      {showCollapseToggle && (
        <button
          onClick={onCollapseToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-2 border-t border-border px-4 py-3.5 text-muted-foreground ${
            collapsed ? "justify-center" : "justify-end"
          }`}
        >
          {!collapsed && <span className="text-[11px] uppercase tracking-[0.14em] opacity-50">Dock</span>}
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </>
  );
}

function TopMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="hoot-card-soft flex min-w-[220px] items-start gap-2.5 rounded-2xl px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.03]">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] opacity-45">{label}</div>
        <div className="mt-1 text-[13px] leading-relaxed">{value}</div>
      </div>
    </div>
  );
}

function VersionFooter({
  collapsed,
  versionInfo,
}: {
  collapsed: boolean;
  versionInfo: ReturnType<typeof useHootVersion>;
}) {
  if (!versionInfo) return null;
  const gitLabel = versionInfo.git
    ? `${versionInfo.git.commit}${versionInfo.git.dirty ? "*" : ""}`
    : null;
  return (
    <div className={`border-t border-border px-4 py-3 ${collapsed ? "text-center" : ""}`}>
      {collapsed ? (
        <div className="text-[10px] font-medium tracking-wide text-muted-foreground" title={`${versionInfo.display} — engine ${versionInfo.engine?.package_version || versionInfo.version}`}>
          v{versionInfo.version}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-foreground/85">{versionInfo.display}</div>
          <div className="text-[10px] leading-relaxed text-muted-foreground">
            Engine {versionInfo.engine?.package_version || versionInfo.version}
            {versionInfo.ui?.version ? ` · UI ${versionInfo.ui.version}` : ""}
            {versionInfo.core?.name ? ` · ${versionInfo.core.name}` : ""}
          </div>
          {(gitLabel || versionInfo.changelog_headline) && (
            <div className="text-[10px] leading-relaxed text-muted-foreground/80">
              {gitLabel ? <span className="font-mono">{gitLabel}</span> : null}
              {gitLabel && versionInfo.changelog_headline ? " · " : null}
              {versionInfo.changelog_headline}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "gold" | "slate" }) {
  const toneClass = {
    green: "border-green-400/20 bg-green-400/10 text-green-300",
    gold: "hoot-gold-chip",
    slate: "border-border bg-foreground/5 text-muted-foreground",
  }[tone];
  return (
    <div className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.08em] ${toneClass}`}>{label}</div>
  );
}
