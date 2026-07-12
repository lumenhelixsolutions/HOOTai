import { CheckCircle2, ChevronDown, Copy, ExternalLink, Play, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { StackTemplate } from "@/lib/stack-catalog";
import { RESEARCH_CATEGORIES, type AgentOption, type LlmOption, type StackNode } from "@/lib/stack-options";
import { btn } from "@/components/terminal/primitives";

export function TemplateCard({
  template,
  expanded,
  onToggle,
  onApply,
}: {
  template: StackTemplate;
  expanded: boolean;
  onToggle: () => void;
  onApply: () => void;
}) {
  const isGoogle = Boolean(template.googleNote);
  const frame = isGoogle ? "border-sky-400/30 bg-sky-400/[0.06]" : "border-[color-mix(in_srgb,var(--hoot-gold)_25%,transparent)] bg-[color-mix(in_srgb,var(--hoot-gold)_6%,transparent)]";
  const accent = isGoogle ? "text-sky-400" : "hoot-gold-text";
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border ${frame}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full bg-transparent p-4 text-left text-foreground">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{template.name}</span>
              <span className={`rounded-full bg-background/40 px-2 py-0.5 text-[10px] ${accent}`}>{template.tag}</span>
            </div>
            <div className="mt-1.5 text-xs leading-snug opacity-70">{template.desc}</div>
          </div>
          <ChevronDown size={16} className={`shrink-0 opacity-50 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border px-4 pb-4">
          <p className="mb-0 mt-3 text-xs leading-relaxed text-foreground/90">{template.explainer}</p>
          <TemplateList title="When to use" items={template.whenToUse} />
          <TemplateList title="Requirements" items={template.requirements} />
          {template.setupSteps && <TemplateList title="Setup" items={template.setupSteps} ordered />}
          {template.googleNote && (
            <div className="rounded-lg border border-sky-400/20 bg-sky-400/[0.08] p-2.5 text-[11px] leading-relaxed text-sky-300">
              <strong className="mb-1 block text-[10px] tracking-wide">Google ecosystem note</strong>
              {template.googleNote}
            </div>
          )}
          <button type="button" onClick={onApply} className={`${btn.secondary} justify-center font-medium ${accent}`}>
            <Play size={12} /> Apply stack
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.1em] opacity-45">{title}</div>
      <List className="m-0 pl-[18px] text-[11px] leading-relaxed text-foreground/80">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    </div>
  );
}

export function NodeConfigPanel({
  node,
  llmOptions,
  agentOptions,
  filterLoadedOnly,
  onFilterToggle,
  onUpdate,
}: {
  node: StackNode;
  llmOptions: LlmOption[];
  agentOptions: AgentOption[];
  filterLoadedOnly: boolean;
  onFilterToggle: () => void;
  onUpdate: (patch: Record<string, any>) => void;
}) {
  const visible = filterLoadedOnly ? llmOptions.filter((l) => l.loaded || l.mode === "cloud") : llmOptions;
  const inputClass = "w-full rounded-md border border-border bg-background/40 px-2.5 py-2 text-xs text-foreground";
  return (
    <div className="hoot-card-soft rounded-xl p-4">
      <h3 className="m-0 mb-2.5 text-[13px] text-foreground">Config: {node.label}</h3>
      {node.type === "llm" && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] opacity-50">Model</label>
          <div className="flex items-center gap-2">
            <select value={node.config.model} onChange={(e) => onUpdate({ model: e.target.value })} className={`flex-1 ${inputClass}`} aria-label="Model">
              {visible.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.loaded ? "● " : ""}
                  {l.name} ({l.context.toLocaleString()} ctx)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onFilterToggle}
              title="Filter to Ollama models currently loaded in memory — green ● means ready to launch now without a pull."
              aria-pressed={filterLoadedOnly}
              className={`rounded-md border px-2 py-1.5 text-[10px] ${
                filterLoadedOnly ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-border text-muted-foreground"
              }`}
            >
              Loaded
            </button>
          </div>
          <label className="text-[11px] opacity-50">Temperature: {node.config.temperature ?? 0.3}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={node.config.temperature ?? 0.3}
            onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
            className="accent-[var(--hoot-gold)]"
            aria-label="Temperature"
          />
        </div>
      )}
      {node.type === "agent" && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] opacity-50">Agent</label>
          <select value={node.config.agent} onChange={(e) => onUpdate({ agent: e.target.value })} className={inputClass} aria-label="Agent">
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.present ? "● " : ""}
                {a.name}
                {a.present ? "" : " (not detected)"}
              </option>
            ))}
          </select>
          <p className="m-0 mt-1 text-[10px] opacity-40">Not installed? Check the Install tab.</p>
        </div>
      )}
      {node.type === "tool" && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] opacity-50">Command</label>
          <input
            value={node.config.command}
            onChange={(e) => onUpdate({ command: e.target.value })}
            placeholder="e.g. git diff"
            className={`font-mono ${inputClass}`}
            aria-label="Tool command"
          />
        </div>
      )}
    </div>
  );
}

export function ResearchTab({
  research,
  setResearch,
  mcpConfigs,
  category,
  onCategory,
  suggestions,
}: {
  research: any;
  setResearch: (r: any) => void;
  mcpConfigs: any[];
  category: string | null;
  onCategory: (id: string | null) => void;
  suggestions: Array<{ title: string; detail: string; action?: () => void }>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-xs opacity-55">Click a category — suggestions come from your scan, MCP catalog, and research brief.</p>
      <div className="flex flex-wrap gap-3">
        {RESEARCH_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategory(active ? null : cat.id)}
              aria-pressed={active}
              className={`flex min-w-[160px] items-center gap-2.5 rounded-xl border p-4 text-[13px] ${active ? cat.chip : "hoot-card-soft text-foreground"}`}
            >
              <Icon size={20} />
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="hoot-card-soft rounded-xl p-5">
        <h3 className="m-0 mb-3 text-sm text-foreground">Suggested next steps</h3>
        {suggestions.length === 0 ? (
          <div className="text-xs opacity-40">Run a scan or refresh research to populate suggestions.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {suggestions.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/30 p-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-foreground">{item.title}</div>
                  <div className="mt-1 truncate text-[11px] opacity-55">{item.detail}</div>
                </div>
                {item.action && (
                  <button type="button" onClick={item.action} className={`${btn.primary} shrink-0 !px-2.5 !py-1.5 !text-[11px]`}>
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hoot-card-soft rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-sm text-foreground">Latest Research Brief</h3>
          <button
            onClick={() =>
              api
                .runResearch()
                .then((r: any) => setResearch(r))
                .catch(() => {})
            }
            className={btn.primary}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        {research?.text ? (
          <pre className="m-0 max-h-[400px] overflow-auto whitespace-pre-wrap rounded-lg bg-background/40 p-3 font-sans text-xs leading-relaxed opacity-80">
            {research.text}
          </pre>
        ) : (
          <div className="p-5 text-center text-xs opacity-40">No research brief yet. Click Refresh to generate.</div>
        )}
      </div>

      <div className="hoot-card-soft rounded-xl p-5">
        <h3 className="m-0 mb-3 text-sm text-foreground">MCP Server Configs Detected</h3>
        {mcpConfigs.length === 0 ? (
          <div className="text-xs opacity-40">No MCP configs found. Check Claude Desktop, Cursor, or Cline configs.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {mcpConfigs.map((cfg: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-background/30 p-3">
                <div className="text-[13px] text-foreground">{cfg.name}</div>
                <div className="mt-0.5 font-mono text-[11px] opacity-50">{cfg.path}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {cfg.servers?.map((s: string) => (
                    <span key={s} className="rounded border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function InstallTab({
  search,
  onSearch,
  missingTools,
  installedTools,
  scan,
  copied,
  onCopy,
}: {
  search: string;
  onSearch: (s: string) => void;
  missingTools: any[];
  installedTools: any[];
  scan: any;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const match = (t: any) => !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.id?.toLowerCase().includes(search.toLowerCase());
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5">
        <Search size={14} className="opacity-50" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search tools, agents, models…"
          aria-label="Search install catalog"
          className="flex-1 rounded-lg border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-[13px] text-foreground"
        />
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {missingTools.filter(match).map((tool: any) => (
          <InstallCard key={tool.id} tool={tool} scan={scan} onCopy={onCopy} copied={copied} />
        ))}
        {installedTools.filter(match).map((tool: any) => (
          <InstallCard key={tool.id} tool={tool} scan={scan} onCopy={onCopy} copied={copied} installed />
        ))}
      </div>
    </div>
  );
}

function InstallCard({ tool, scan, onCopy, copied, installed }: { tool: any; scan: any; onCopy: (text: string, id: string) => void; copied: string | null; installed?: boolean }) {
  const cmd = tool.install_windows || tool.install_guide || tool.install || "See official docs";
  const isCopied = copied === tool.id;
  const envKeys = scan?.env ? Object.entries(scan.env).filter(([, v]: [string, any]) => v?.present).map(([k]) => k) : [];
  const requiredEnv = Array.isArray(tool.required_env) ? tool.required_env : [];
  const needsKey = requiredEnv.length > 0 && !requiredEnv.some((k: string) => envKeys.includes(k));
  return (
    <div className={`flex flex-col gap-2.5 rounded-xl border p-4 ${installed ? "border-emerald-400/15 bg-emerald-400/[0.03]" : "hoot-card-soft"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{tool.name}</span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] ${
              installed ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400" : "border-amber-400/20 bg-amber-400/10 text-amber-500"
            }`}
          >
            {installed ? "Installed" : "Missing"}
          </span>
        </div>
        {tool.official && (
          <a href={tool.official} target="_blank" rel="noopener noreferrer" aria-label={`${tool.name} official site`} className="opacity-50 hover:opacity-100">
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      <p className="m-0 text-xs leading-normal opacity-60">{tool.best_for || tool.description || ""}</p>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/40 p-2.5">
        <code className="break-all font-mono text-[11px] text-foreground">{cmd}</code>
        <button onClick={() => onCopy(cmd, tool.id)} aria-label={`Copy install command for ${tool.name}`} className="shrink-0 opacity-60 hover:opacity-100">
          {isCopied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>
      {tool.prerequisites && <div className="text-[11px] opacity-50">Requires: {tool.prerequisites}</div>}
      {needsKey && (
        <div className="rounded-md border border-red-400/15 bg-red-400/[0.06] p-2 text-[11px] text-red-400">Missing API key: {requiredEnv.join(", ")}</div>
      )}
      {tool.docs && (
        <div className="flex flex-wrap gap-1.5">
          {tool.docs.map((url: string, i: number) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 no-underline">
              Docs {i + 1} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
