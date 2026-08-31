import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useCoach } from "@/context/CoachContext";
import { STACK_TEMPLATES } from "@/lib/stack-catalog";
import {
  NODE_TYPES,
  buildAgentOptions,
  buildLlmOptions,
  type StackNode,
  type WizardStep,
} from "@/lib/stack-options";
import { analyzeStack, diffAgainstProfiles, modelCapability, type StackIssue } from "@/lib/stack-compatibility";
import {
  CanvasActions,
  CanvasEmptyState,
  HealthPanel,
  LaunchButton,
  NodeList,
  NodePalette,
  ProfileDiffCard,
  WizardStepper,
} from "@/components/builder/parts";
import { InstallTab, NodeConfigPanel, ResearchTab, TemplateCard } from "@/components/builder/tabs";
import { HOOT_ACTIONS } from '@/lib/h00t-control';
import { asScanArray } from "@/lib/scan-normalize";

export default function StackBuilder() {
  const [nodes, setNodes] = useState<StackNode[]>([]);
  const [scan, setScan] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [research, setResearch] = useState<any>(null);
  const [mcp, setMcp] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [issues, setIssues] = useState<StackIssue[]>([]);
  const [score, setScore] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"builder" | "research" | "install">("builder");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("agent");
  const [builderMode, setBuilderMode] = useState<"basic" | "advanced">("basic");
  const [filterLoadedOnly, setFilterLoadedOnly] = useState(false);
  const [researchCategory, setResearchCategory] = useState<string | null>(null);
  const [vaultKeys, setVaultKeys] = useState<Set<string>>(new Set());
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const { setPageContext, registerActionHandler } = useCoach();

  const llmOptions = useMemo(() => buildLlmOptions(scan), [scan]);
  const agentOptions = useMemo(() => buildAgentOptions(scan), [scan]);
  const hasAgent = nodes.some((n) => n.type === "agent");
  const hasLlm = nodes.some((n) => n.type === "llm");
  const selectedNode = nodes.find((n) => n.id === selected);

  useEffect(() => {
    Promise.all([
      api.getScanCached().catch(() => api.runScan().catch(() => null)),
      api.getCatalog().catch(() => null),
      api.getResearch().catch(() => null),
      api.getMcp().catch(() => null),
      api.getKeys().catch(() => ({ keys: [] })),
      api.getCompatibilityRules().catch(() => null),
      api.getProfiles().catch(() => []),
    ]).then(([s, c, r, m, keys, ruleData, profileData]) => {
      setScan(s);
      setCatalog(c);
      setResearch(r);
      setMcp(m);
      setVaultKeys(new Set((keys?.keys || []).map((k: { name: string }) => k.name)));
      setRules(ruleData);
      setProfiles(profileData || []);
    });
  }, []);

  useEffect(() => {
    setPageContext({
      stackScore: score,
      stackIssues: issues.map((i) => i.text),
      nodeCount: nodes.length,
      builderMode,
      wizardStep: nodes.length === 0 ? wizardStep : hasAgent && !hasLlm ? "llm" : hasAgent && hasLlm ? "review" : wizardStep,
      hasAgent,
      hasLlm,
      launching,
      selectedNodeType: selectedNode?.type || null,
      toolFromMcp: selectedNode?.type === "tool" ? Boolean(selectedNode.config.mcpServer) : false,
    });
  }, [score, issues, nodes.length, builderMode, wizardStep, hasAgent, hasLlm, launching, selectedNode, setPageContext]);

  const analyze = useCallback(() => {
    if (!scan) return;
    const result = analyzeStack(nodes, scan, llmOptions, vaultKeys, rules);
    setIssues(result.issues);
    setScore(result.score);
  }, [nodes, scan, llmOptions, vaultKeys, rules]);

  useEffect(() => {
    const t = setTimeout(() => analyze(), 140);
    return () => clearTimeout(t);
  }, [analyze]);

  const issuesByNode = useMemo(() => {
    const map = new Map<string, StackIssue[]>();
    for (const issue of issues) {
      if (!issue.nodeId) continue;
      map.set(issue.nodeId, [...(map.get(issue.nodeId) || []), issue]);
    }
    return map;
  }, [issues]);

  const addNode = (type: string, configPatch?: Record<string, unknown>) => {
    const def = NODE_TYPES.find((n) => n.type === type);
    if (!def) return;
    const id = `${type}-${Date.now()}`;
    const config: Record<string, unknown> = {};
    if (type === "llm") config.model = llmOptions.find((l) => l.loaded)?.id || llmOptions[0]?.id;
    if (type === "agent") config.agent = agentOptions.find((a) => a.present)?.id || agentOptions[0]?.id;
    if (type === "tool") {
      config.command = "";
      config.mcpServer = "";
    }
    Object.assign(config, configPatch);
    setNodes((prev) => [...prev, { id, type: type as StackNode["type"], label: def.label, config }]);
    setSelected(id);
  };

  const addMcpGitTool = useCallback(() => {
    addNode("tool", { command: "mcp-server-git", mcpServer: "git", label: "MCP Git" });
    setWizardStep("review");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTemplate = (templateId: string) => {
    const tpl = STACK_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const built: StackNode[] = tpl.nodes.map((n, i) => {
      const def = NODE_TYPES.find((nt) => nt.type === n.type)!;
      const id = `${n.type}-${Date.now()}-${i}`;
      const config: Record<string, unknown> =
        n.type === "agent" ? { agent: n.agent } : n.type === "llm" ? { model: n.model } : { command: n.command, mcpServer: n.mcpServer || "" };
      return { id, type: n.type as StackNode["type"], label: def.label, config };
    });
    setNodes(built);
    setSelected(built[0]?.id || null);
    setWizardStep("review");
    setTab("builder");
    toast.showToast(`Applied "${tpl.name}" template`, "success");
  };

  const composed = useMemo(() => {
    const llmNode = nodes.find((n) => n.type === "llm");
    const agentNode = nodes.find((n) => n.type === "agent");
    const llm = llmNode ? llmOptions.find((l) => l.id === llmNode.config.model) : null;
    return { agentId: agentNode?.config.agent as string | undefined, modelId: llm?.id, mode: llm?.mode };
  }, [nodes, llmOptions]);

  const profileDiff = useMemo(() => diffAgainstProfiles(profiles, composed), [profiles, composed]);
  const capability = useMemo(() => modelCapability(rules, composed.modelId), [rules, composed.modelId]);

  const buildProfilePayload = () => {
    const llmNode = nodes.find((n) => n.type === "llm");
    const agentNode = nodes.find((n) => n.type === "agent");
    const llm = llmNode ? llmOptions.find((l) => l.id === llmNode.config.model) : null;
    const agent = agentNode ? agentOptions.find((a) => a.id === agentNode.config.agent) : null;
    const mode = llm?.mode || "hybrid";
    const name = `stack-${mode}-${agent?.id || "custom"}-${Date.now()}`;
    const profileId = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60);
    const launchCmd = agent ? `${agent.id} ${mode === "local" ? "--local" : ""}` : `echo "Custom stack: ${profileId}"`;
    const meta: Record<string, unknown> = {
      name: `Custom ${mode} stack`,
      mode,
      status: "experimental",
      command: agent?.id || "",
      backend: llm?.backend || "",
      model: llm?.id || "",
      required_context: llm?.context || 0,
    };
    if (llm?.mode === "cloud") meta.required_env = [`${String(llm.backend).toUpperCase()}_API_KEY`];
    return {
      id: profileId,
      meta,
      description: `Stack Builder profile. LLM: ${llm?.name || "none"}, Agent: ${agent?.name || "none"}`,
      launch: launchCmd,
    };
  };

  const saveStack = async () => {
    if (nodes.length === 0) {
      toast.showToast("Add at least one node before saving", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = buildProfilePayload();
      await api.createProfile(payload);
      toast.showToast(`Profile "${payload.id}" saved`, "success");
      navigate("/profiles");
    } catch (e: unknown) {
      toast.showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const launchStack = async () => {
    if (score < 50 || nodes.length === 0) return;
    setLaunching(true);
    try {
      const payload = buildProfilePayload();
      await api.createProfile(payload);
      toast.showToast(`Profile "${payload.id}" created. Launching...`, "success");
      const result = await api.launch(payload.id);
      if (result.launched) {
        toast.showToast(`Stack launched! Session: ${result.session?.id?.slice(0, 8)}`, "success");
        navigate(`/terminal?session=${encodeURIComponent(result.session?.id || "")}`);
      } else if (result.blocked) {
        toast.showToast(`Launch blocked: ${result.message}`, "warning");
      } else {
        toast.showToast("Launch completed.", "info");
      }
    } catch (e: any) {
      toast.showToast(e.message || "Launch failed", "error");
    } finally {
      setLaunching(false);
    }
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    if (selected === id) setSelected(null);
  };
  const updateNode = (id: string, patch: Record<string, any>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...patch } } : n)));
  };

  const missingTools = useMemo(() => {
    if (!scan || !catalog) return [];
    const coders = asScanArray(scan.coders);
    return asScanArray(catalog.tools).filter((t: any) => {
      const coder = coders.find((c: any) => c.id === t.id || c.command === t.command);
      return !coder?.detection?.present;
    });
  }, [scan, catalog]);

  const installedTools = useMemo(() => {
    if (!scan || !catalog) return [];
    const coders = asScanArray(scan.coders);
    return asScanArray(catalog.tools).filter((t: any) => {
      const coder = coders.find((c: any) => c.id === t.id || c.command === t.command);
      return coder?.detection?.present;
    });
  }, [scan, catalog]);

  const mcpConfigs = useMemo(() => mcp?.configs || [], [mcp]);
  const mcpCatalog = useMemo(() => mcp?.catalog?.servers || [], [mcp]);

  const researchSuggestions = useMemo(() => {
    const items: Array<{ title: string; detail: string; action?: () => void }> = [];
    if (!researchCategory || researchCategory === "mcp") {
      for (const srv of mcpCatalog) {
        items.push({ title: srv.name || srv.id, detail: srv.description || "MCP server from catalog", action: () => addMcpGitTool() });
      }
    }
    if (!researchCategory || researchCategory === "agents") {
      for (const a of agentOptions.filter((x) => !x.present).slice(0, 4)) {
        items.push({ title: a.name, detail: `Install: ${a.install}`, action: () => setTab("install") });
      }
    }
    if (!researchCategory || researchCategory === "models") {
      for (const l of llmOptions.filter((x) => x.loaded).slice(0, 4)) {
        items.push({
          title: l.name,
          detail: "Loaded on this machine",
          action: () => {
            addNode("llm", { model: l.id });
            setTab("builder");
          },
        });
      }
    }
    if (research?.text && (!researchCategory || researchCategory === "prompts")) {
      const lines = String(research.text).split("\n").filter((l: string) => l.trim()).slice(0, 5);
      for (const line of lines) items.push({ title: "Research brief", detail: line.slice(0, 120) });
    }
    return items.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchCategory, mcpCatalog, agentOptions, llmOptions, research]);

  const prefabCards = useMemo(
    () => [
      {
        action: HOOT_ACTIONS.PREFAB_LOCAL,
        templateId: "local-audit",
        title: "Local prefab",
        eyebrow: "Private workstation",
        detail: "Use what is already installed on this machine, stay local-first, and keep setup friction low.",
      },
      {
        action: HOOT_ACTIONS.PREFAB_CLOUD,
        templateId: "cloud-research",
        title: "Cloud prefab",
        eyebrow: "Fastest capability ramp",
        detail: "Favor hosted models and remote capacity when speed and breadth matter more than offline isolation.",
      },
      {
        action: HOOT_ACTIONS.PREFAB_HYBRID,
        templateId: "hybrid-copilot",
        title: "Hybrid prefab",
        eyebrow: "Balanced control",
        detail: "Blend local agent execution with cloud reasoning or APIs for systems that need both reach and control.",
      },
    ],
    [],
  );

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const coachActionRef = useRef<(target: string) => void>(() => {});
  coachActionRef.current = (target) => {
    if (target === "wizard-agent") {
      setBuilderMode("advanced");
      setTab("builder");
      setWizardStep("agent");
    } else if (target === "wizard-llm") {
      setBuilderMode("advanced");
      setTab("builder");
      setWizardStep("llm");
      if (!hasAgent) addNode("agent");
      if (!hasLlm) addNode("llm");
    } else if (target === HOOT_ACTIONS.PREFAB_LOCAL) {
      setBuilderMode("basic");
      applyTemplate("local-audit");
    } else if (target === HOOT_ACTIONS.PREFAB_CLOUD) {
      setBuilderMode("basic");
      applyTemplate("cloud-research");
    } else if (target === HOOT_ACTIONS.PREFAB_HYBRID) {
      setBuilderMode("basic");
      applyTemplate("hybrid-copilot");
    } else if (target === HOOT_ACTIONS.PREFAB_REVIEW) {
      setBuilderMode("advanced");
      setTab("builder");
      setWizardStep("review");
    } else if (target === "template-local-audit") applyTemplate("local-audit");
    else if (target.startsWith("template-")) applyTemplate(target.replace("template-", ""));
    else if (target === "tab-install") setTab("install");
    else if (target === "filter-loaded") setFilterLoadedOnly(true);
    else if (target === "add-mcp-git") addMcpGitTool();
    else if (target === "save-stack") saveStack();
    else if (target === "launch-stack") launchStack();
  };

  useEffect(() => {
    return registerActionHandler((target) => coachActionRef.current(target));
  }, [registerActionHandler]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="text-[11px] uppercase tracking-[0.16em] opacity-45">Prefab stack construction</div>
          <h2 className="m-0 mt-1 font-serif text-xl text-foreground">Stack Builder</h2>
          <p className="m-0 mt-1 text-xs opacity-60">
            {builderMode === "basic"
              ? "Start with a local, cloud, or hybrid prefab matched to the systems HOOT can see."
              : "Full composer mode for Agent → Model → Tools → Review without losing any underlying capability."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-border bg-foreground/[0.03] p-1">
            {(["basic", "advanced"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBuilderMode(mode)}
                className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] ${builderMode === mode ? "hoot-gold-chip font-semibold" : "text-foreground/70"}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex gap-2" role="tablist" aria-label="Builder tabs">
            {(["builder", "research", "install"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-lg border px-4 py-2 text-xs capitalize ${tab === t ? "hoot-gold-chip font-semibold" : "border-border bg-foreground/[0.02] text-foreground/80"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "builder" && builderMode === "basic" && (
        <div className="grid gap-3 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="hoot-card-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] opacity-45">Basic workflow</div>
            <div className="mt-2 text-sm opacity-70">Pick the deployment shape first. HOOT will load a safe prefab, then you can refine or open the advanced composer.</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {prefabCards.map((card) => (
                <button
                  key={card.action}
                  type="button"
                  onClick={() => {
                    setBuilderMode("basic");
                    applyTemplate(card.templateId);
                  }}
                  className="rounded-2xl border border-border bg-background/65 p-4 text-left transition hover:border-amber-400/35 hover:bg-amber-400/5"
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] opacity-45">{card.eyebrow}</div>
                  <div className="mt-2 font-semibold">{card.title}</div>
                  <div className="mt-2 text-xs leading-relaxed opacity-70">{card.detail}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="hoot-card-soft rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] opacity-45">What HOOT sees</div>
            <div className="mt-3 space-y-2 text-xs opacity-75">
              <div>Loaded models: <span className="font-semibold text-foreground">{llmOptions.filter((item) => item.loaded).length}</span></div>
              <div>Present agents: <span className="font-semibold text-foreground">{agentOptions.filter((item) => item.present).length}</span></div>
              <div>Missing tools: <span className="font-semibold text-foreground">{missingTools.length}</span></div>
              <div>MCP configs: <span className="font-semibold text-foreground">{mcpConfigs.length}</span></div>
            </div>
            <button
              type="button"
              onClick={() => {
                setBuilderMode("advanced");
                setWizardStep(nodes.length ? "review" : "agent");
              }}
              className="mt-4 rounded-xl border border-border px-3 py-2 text-xs text-foreground/80"
            >
              Open advanced composer
            </button>
          </div>
        </div>
      )}

      {tab === "builder" && (builderMode === "advanced" || nodes.length > 0) && (
        <div className="flex flex-col gap-3">
          <WizardStepper step={wizardStep} onStep={setWizardStep} hasAgent={hasAgent} hasLlm={hasLlm} hasTool={nodes.some((n) => n.type === "tool")} />
          <div className="flex flex-col gap-4 lg:h-[calc(100vh-280px)] lg:flex-row">
            <NodePalette collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} onAdd={addNode} />

            <div className="flex flex-1 flex-col gap-3">
              <CanvasActions onClear={() => { setNodes([]); setSelected(null); }} onSave={saveStack} saving={saving} disabled={nodes.length === 0} />
              <div className="hoot-card-soft min-h-[320px] flex-1 overflow-auto rounded-xl p-5">
                {nodes.length === 0 ? (
                  <CanvasEmptyState
                    onCustom={() => {
                      addNode("agent");
                      setWizardStep("llm");
                    }}
                  >
                    {STACK_TEMPLATES.map((tpl) => (
                      <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        expanded={expandedTemplate === tpl.id}
                        onToggle={() => setExpandedTemplate((id) => (id === tpl.id ? null : tpl.id))}
                        onApply={() => applyTemplate(tpl.id)}
                      />
                    ))}
                  </CanvasEmptyState>
                ) : (
                  <NodeList
                    nodes={nodes}
                    selected={selected}
                    issuesByNode={issuesByNode}
                    llmOptions={llmOptions}
                    agentOptions={agentOptions}
                    onSelect={setSelected}
                    onRemove={removeNode}
                  />
                )}
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col gap-3.5 lg:w-[320px]">
              <HealthPanel score={score} issues={issues} />
              {wizardStep === "review" && nodes.length > 0 && <ProfileDiffCard diff={profileDiff} capability={capability} />}
              {selectedNode && (
                <NodeConfigPanel
                  node={selectedNode}
                  llmOptions={llmOptions}
                  agentOptions={agentOptions}
                  filterLoadedOnly={filterLoadedOnly}
                  onFilterToggle={() => setFilterLoadedOnly((v) => !v)}
                  onUpdate={(patch) => updateNode(selectedNode.id, patch)}
                />
              )}
              <LaunchButton score={score} launching={launching} onLaunch={launchStack} />
            </div>
          </div>
        </div>
      )}

      {tab === "research" && (
        <ResearchTab
          research={research}
          setResearch={setResearch}
          mcpConfigs={mcpConfigs}
          category={researchCategory}
          onCategory={setResearchCategory}
          suggestions={researchSuggestions}
        />
      )}

      {tab === 'install' && (
        <InstallTab
          search={search}
          onSearch={setSearch}
          missingTools={missingTools}
          installedTools={installedTools}
          scan={scan}
          copied={copied}
          onCopy={copyText}
        />
      )}
    </div>
  );
}
