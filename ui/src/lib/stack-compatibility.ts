import { asScanArray, normalizeLoadedModels } from "@/lib/scan-normalize";
import { AGENT_OPTIONS, LLM_OPTIONS, type LlmOption, type StackNode } from "./stack-options";

export interface StackIssue {
  /** Node this issue belongs to; null = whole-stack issue. */
  nodeId: string | null;
  severity: "block" | "warn";
  text: string;
  penalty: number;
}

export interface StackAnalysis {
  score: number;
  issues: StackIssue[];
}

/**
 * Live stack compatibility. Combines environment checks (scan-driven) with
 * compatibility-rules.json (served by /api/compatibility-rules). The server
 * remains authoritative at launch time; this mirrors its rules for instant,
 * node-linked feedback while composing.
 */
export function analyzeStack(
  nodes: StackNode[],
  scan: any,
  llmOptions: LlmOption[],
  vaultKeys: Set<string>,
  rules: any,
): StackAnalysis {
  const issues: StackIssue[] = [];
  let score = 100;
  const push = (issue: Omit<StackIssue, "penalty"> & { penalty: number }) => {
    issues.push(issue);
    score -= issue.penalty;
  };

  if (!scan) return { score: 0, issues: [{ nodeId: null, severity: "warn", text: "No scan available — run Readiness first for live compatibility.", penalty: 0 }] };

  const llmNode = nodes.find((n) => n.type === "llm");
  const chosenLlm = llmNode
    ? llmOptions.find((l) => l.id === llmNode.config.model) || LLM_OPTIONS.find((l) => l.id === llmNode.config.model)
    : null;

  for (const node of nodes) {
    if (node.type === "llm") {
      const llm = llmOptions.find((l) => l.id === node.config.model) || LLM_OPTIONS.find((l) => l.id === node.config.model);
      if (!llm) continue;
      if (llm.mode === "local") {
        if (llm.backend === "llamacpp") {
          const llamaBackend = asScanArray(scan.local_models?.backends).find((b: any) => b.id === "llamacpp");
          if (!llamaBackend?.present) push({ nodeId: node.id, severity: "block", text: "llama.cpp binary not detected — set path in Settings", penalty: 30 });
          else if (!llamaBackend.server?.reachable) push({ nodeId: node.id, severity: "warn", text: "llama-server not reachable — start it before launch", penalty: 15 });
        } else {
          const ollama = scan.tools?.ollama;
          if (!ollama?.present) push({ nodeId: node.id, severity: "block", text: `Ollama not installed — required for ${llm.name}`, penalty: 30 });
          else {
            const loaded = normalizeLoadedModels(scan);
            const isLoaded = loaded.some((m: any) => m.name === llm.id || m.name === `${llm.id}:latest`);
            if (!isLoaded) push({ nodeId: node.id, severity: "warn", text: `${llm.name} is not loaded. Run: ollama pull ${llm.id}`, penalty: 15 });
          }
        }
        const vramGB = (scan.hardware?.gpu?.[0]?.memory_total_mb || 0) / 1024;
        if (llm.context >= 64000 && vramGB < 8) push({ nodeId: node.id, severity: "warn", text: `${llm.name} needs 8GB+ VRAM. You have ${vramGB.toFixed(1)}GB.`, penalty: 20 });
      }
      if (llm.mode === "cloud") {
        const keyNames = llm.backend === "google" ? ["GEMINI_API_KEY", "GOOGLE_API_KEY"] : [`${String(llm.backend).toUpperCase()}_API_KEY`];
        const hasKey = keyNames.some((k) => (scan.env as any)?.[k]?.present || vaultKeys.has(k));
        if (!hasKey) push({ nodeId: node.id, severity: "block", text: `Missing ${keyNames[0]} — run scan or set in Settings (vault auto-imports from .env)`, penalty: 25 });
      }
    }

    if (node.type === "agent") {
      const agent = AGENT_OPTIONS.find((a) => a.id === node.config.agent);
      if (!agent) continue;
      const coder = asScanArray(scan.coders).find((c: any) => c.id === node.config.agent);
      if (!coder?.detection?.present) push({ nodeId: node.id, severity: "warn", text: `${agent.name} not detected. Install: ${agent.install}`, penalty: 20 });

      // compatibility-rules.json: per-agent context floors (e.g. hermes).
      const agentRule = rules?.rules?.[node.config.agent];
      if (agentRule?.minimum_context && chosenLlm && chosenLlm.context < agentRule.minimum_context) {
        push({
          nodeId: node.id,
          severity: "block",
          text: `${agent.name} requires ${agentRule.minimum_context.toLocaleString()}+ context (rules v${rules?.version || "?"}); ${chosenLlm.name} provides ${chosenLlm.context.toLocaleString()}.`,
          penalty: 25,
        });
      }
    }
  }

  if (nodes.length === 0) {
    push({ nodeId: null, severity: "block", text: "Stack is empty — add at least one node", penalty: 100 });
  } else {
    if (!nodes.some((n) => n.type === "llm")) push({ nodeId: null, severity: "block", text: "No LLM selected — every stack needs a model", penalty: 20 });
    if (!nodes.some((n) => n.type === "agent")) push({ nodeId: null, severity: "warn", text: "No agent selected — add an agent frontend", penalty: 10 });
  }

  return { score: Math.max(0, score), issues };
}

/** Capability advisory from compatibility-rules.json modelCapabilities. */
export function modelCapability(rules: any, modelId: string | undefined | null): { tier: string; warnings: string[]; description: string } | null {
  if (!modelId || !rules?.modelCapabilities) return null;
  const cap = rules.modelCapabilities[modelId] || rules.modelCapabilities[String(modelId).replace(/:latest$/, "")];
  if (!cap) return null;
  return { tier: cap.max_tier || "unknown", warnings: cap.warnings || [], description: cap.description || "" };
}

export interface ProfileDiff {
  profile: any;
  sameAgent: boolean;
  sameModel: boolean;
  sameMode: boolean;
  exactDuplicate: boolean;
  similarity: number;
}

/** Closest existing profile to the composed stack, for the Review step. */
export function diffAgainstProfiles(
  profiles: any[],
  composed: { agentId?: string; modelId?: string; mode?: string },
): ProfileDiff | null {
  if (!profiles?.length) return null;
  let best: ProfileDiff | null = null;
  for (const profile of profiles) {
    const meta = profile.meta || {};
    const sameAgent = Boolean(composed.agentId && (meta.command === composed.agentId || profile.id?.includes(composed.agentId)));
    const sameModel = Boolean(composed.modelId && meta.model === composed.modelId);
    const sameMode = Boolean(composed.mode && meta.mode === composed.mode);
    const similarity = (sameAgent ? 2 : 0) + (sameModel ? 2 : 0) + (sameMode ? 1 : 0);
    if (similarity === 0) continue;
    const diff: ProfileDiff = { profile, sameAgent, sameModel, sameMode, exactDuplicate: sameAgent && sameModel && sameMode, similarity };
    if (!best || similarity > best.similarity) best = diff;
  }
  return best;
}
