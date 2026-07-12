import { Brain, Cpu, FileOutput, Terminal, Wrench, Server, Box, Gauge, GitBranch, Sparkles } from "lucide-react";
import { asScanArray, normalizeLoadedModels } from "@/lib/scan-normalize";

export interface StackNode {
  id: string;
  type: "llm" | "tool" | "agent" | "processor" | "output";
  label: string;
  config: Record<string, any>;
}

/** Node palette. Tones are tailwind-safe families so light/dark both work. */
export const NODE_TYPES = [
  { type: "llm", label: "LLM", icon: Brain, tone: "emerald", chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" },
  { type: "tool", label: "Tool", icon: Wrench, tone: "sky", chip: "border-sky-400/30 bg-sky-400/10 text-sky-400" },
  { type: "agent", label: "Agent", icon: Terminal, tone: "amber", chip: "border-amber-400/30 bg-amber-400/10 text-amber-500" },
  { type: "processor", label: "Processor", icon: Cpu, tone: "violet", chip: "border-violet-400/30 bg-violet-400/10 text-violet-400" },
  { type: "output", label: "Output", icon: FileOutput, tone: "pink", chip: "border-pink-400/30 bg-pink-400/10 text-pink-400" },
] as const;

export const LLM_OPTIONS = [
  { id: "gemma3:4b", name: "Gemma 3 4B", context: 128000, backend: "ollama", mode: "local" },
  { id: "gemma3:4b-it-qat", name: "Gemma 3 4B QAT", context: 128000, backend: "ollama", mode: "local" },
  { id: "gemma3:12b", name: "Gemma 3 12B", context: 128000, backend: "ollama", mode: "local" },
  { id: "gemma3:1b", name: "Gemma 3 1B (router)", context: 32000, backend: "ollama", mode: "local" },
  { id: "llama3.1:8b", name: "Llama 3.1 8B", context: 8192, backend: "ollama", mode: "local" },
  { id: "llama3.1:8b-instruct-q8_0", name: "Llama 3.1 8B Q8_0", context: 64000, backend: "ollama", mode: "local" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", context: 200000, backend: "anthropic", mode: "cloud" },
  { id: "gpt-4o", name: "GPT-4o", context: 128000, backend: "openai", mode: "cloud" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context: 1000000, backend: "google", mode: "cloud" },
  { id: "grok-build-0.1", name: "Grok Build 0.1", context: 256000, backend: "xai", mode: "cloud" },
  { id: "qwen2.5:7b", name: "Qwen 2.5 7B", context: 32768, backend: "ollama", mode: "local" },
];

export const AGENT_OPTIONS = [
  { id: "hermes", name: "Hermes Agent", install: "npm install -g @nousresearch/hermes-agent" },
  { id: "opencode", name: "OpenCode", install: "npm install -g opencode" },
  { id: "codex", name: "Codex CLI", install: "npm install -g @openai/codex" },
  { id: "claude-code", name: "Claude Code", install: "npm install -g @anthropic-ai/claude-code" },
  { id: "kimi", name: "Kimi CLI", install: "npm install -g kimi-code" },
  { id: "aider", name: "Aider", install: "pip install aider-chat" },
  { id: "gemini-cli", name: "Gemini CLI", install: "npm install -g @google/gemini-cli" },
  { id: "antigravity-cli", name: "Antigravity CLI", install: "See antigravity.google/download" },
  { id: "grok-cli", name: "Grok Build CLI", install: "irm https://x.ai/cli/install.ps1 | iex" },
];

export type WizardStep = "agent" | "llm" | "tools" | "review";

export const WIZARD_STEPS: { id: WizardStep; label: string; hint: string }[] = [
  { id: "agent", label: "Agent", hint: "Pick the coding frontend detected on your machine" },
  { id: "llm", label: "Model", hint: "Green models are loaded in Ollama right now" },
  { id: "tools", label: "Tools", hint: "Optional — MCP git is safer than raw shell" },
  { id: "review", label: "Review", hint: "Check health, compare against existing profiles, then save or launch" },
];

export const RESEARCH_CATEGORIES = [
  { id: "mcp", label: "MCP Servers", icon: Server, chip: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400" },
  { id: "agents", label: "Agent Software", icon: Brain, chip: "border-sky-400/40 bg-sky-400/10 text-sky-400" },
  { id: "models", label: "AI Model Mgmt", icon: Box, chip: "border-amber-400/40 bg-amber-400/10 text-amber-500" },
  { id: "compression", label: "Compression", icon: Gauge, chip: "border-violet-400/40 bg-violet-400/10 text-violet-400" },
  { id: "prompts", label: "Prompt Tools", icon: Sparkles, chip: "border-pink-400/40 bg-pink-400/10 text-pink-400" },
  { id: "git", label: "Git Tools", icon: GitBranch, chip: "border-orange-400/40 bg-orange-400/10 text-orange-400" },
];

export function isModelLoaded(scan: any, modelId: string) {
  const loaded = normalizeLoadedModels(scan);
  return loaded.some((m: any) => m.name === modelId || m.name === `${modelId}:latest` || m.name?.startsWith(`${modelId}:`));
}

export function buildLlmOptions(scan: any) {
  const loaded = normalizeLoadedModels(scan);
  const seen = new Set<string>();
  const options = LLM_OPTIONS.map((l) => ({ ...l, loaded: isModelLoaded(scan, l.id) }));
  const localBackends = asScanArray(scan?.local_models?.backends);
  const lmStudioBackend = localBackends.find((b: any) => b.id === "lm-studio");
  const llamaBackend = localBackends.find((b: any) => b.id === "llamacpp");
  if (lmStudioBackend?.present) {
    const models = Array.isArray(lmStudioBackend.models) ? lmStudioBackend.models : [];
    for (const model of models.slice(0, 6).reverse()) {
      const id = String(model?.name || '').trim();
      if (!id || options.some((o) => o.id === id)) continue;
      options.unshift({
        id,
        name: `${id} · LM Studio`,
        context: model?.context_length || model?.context || lmStudioBackend.server?.context_size || 8192,
        backend: "lmstudio",
        mode: "local",
        loaded: Boolean(lmStudioBackend.server?.reachable),
      });
    }
  }
  if (llamaBackend?.present) {
    const ggufs = asScanArray(scan?.local_models?.discovered_ggufs);
    options.unshift({
      id: "llamacpp-local",
      name: `llama.cpp (${ggufs[0]?.name || "GGUF"})`,
      context: llamaBackend.server?.context_size || 8192,
      backend: "llamacpp",
      mode: "local",
      loaded: Boolean(llamaBackend.server?.reachable),
    });
  }
  for (const m of loaded) {
    const id = String(m.name || "").replace(/:latest$/, "");
    if (!id || seen.has(id) || options.some((o) => o.id === id)) continue;
    seen.add(id);
    options.unshift({ id, name: id, context: m.context_length || m.context || 8192, backend: "ollama", mode: "local", loaded: true });
  }
  return options;
}

export function buildAgentOptions(scan: any) {
  const coders = asScanArray<any>(scan?.coders);
  return [...AGENT_OPTIONS]
    .sort((a, b) => {
      const aOk = coders.find((c: any) => c.id === a.id)?.detection?.present ? 1 : 0;
      const bOk = coders.find((c: any) => c.id === b.id)?.detection?.present ? 1 : 0;
      return bOk - aOk;
    })
    .map((a) => ({
      ...a,
      present: Boolean(coders.find((c: any) => c.id === a.id)?.detection?.present),
    }));
}

export type LlmOption = ReturnType<typeof buildLlmOptions>[number];
export type AgentOption = ReturnType<typeof buildAgentOptions>[number];
