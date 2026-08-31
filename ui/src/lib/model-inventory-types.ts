export type ModelAdvise = {
  kind: string;
  title: string;
  url?: string;
  detail?: string;
  command?: string;
  action?: string;
};

export type InventoryModel = {
  id: string;
  backend: string;
  name: string;
  path_or_tag: string;
  drive?: string | null;
  size_bytes: number;
  digest_or_id?: string | null;
  modified_at?: string | null;
  loaded?: boolean;
  family?: string;
  quant?: string | null;
  configured?: boolean;
  flags?: string[];
  used_by_profiles?: string[];
  used_by_projects?: string[];
  advise?: ModelAdvise[];
  bench?: {
    status: string;
    tokens_per_sec: number;
    latency_ms?: number;
    tier?: string;
  };
  duplicate_cluster?: string;
  weight_kind?: string;
  source_root?: string | null;
};

export type DuplicateCluster = {
  id: string;
  family: string;
  count: number;
  model_ids: string[];
  reason?: string;
};

export type AdviseFinding = {
  id: string;
  severity: string;
  title: string;
  detail?: string;
  model_ids?: string[];
};

export type ModelInventoryPayload = {
  ok?: boolean;
  schema: string;
  generated_at: string;
  mode?: "quick" | "exhaustive" | string;
  ollama?: { ok: boolean; host?: string; error?: string | null; count: number; loaded: number };
  coverage?: {
    mode?: string;
    drives_detected?: string[];
    hot_roots?: string[];
    files_total?: number;
    by_kind?: Record<string, number>;
    by_drive?: Record<string, number>;
    truncated?: boolean;
    duration_ms?: number;
  };
  counts: {
    total: number;
    ollama: number;
    gguf: number;
    lmstudio: number;
    safetensors?: number;
    other_weights?: number;
    duplicates: number;
    orphans: number;
    by_backend?: Record<string, number>;
  };
  models: InventoryModel[];
  duplicate_clusters: DuplicateCluster[];
  findings: AdviseFinding[];
  safetensors?: {
    schema: string;
    summary: {
      packages: number;
      files: number;
      keep: number;
      review: number;
      quarantine_candidates: number;
      total_bytes: number;
    };
    packages: Array<Record<string, unknown>>;
    policy?: Record<string, string>;
  };
};

export type IntegrationCandidate = {
  id: string;
  repo: string;
  repo_path: string;
  opportunity: string;
  integration_type: string;
  confidence: string;
  detail?: string;
  module_id?: string | null;
  mcp_id?: string | null;
  actions?: Array<{ label: string; type: string; target?: string; path?: string; method?: string }>;
};

export type IntegrationScanPayload = {
  ok?: boolean;
  schema: string;
  scanned_at: string;
  scope: string;
  repos: Array<{ path: string; name: string; has_git?: boolean }>;
  candidates: IntegrationCandidate[];
  counts: { repos: number; candidates: number; by_type?: Record<string, number> };
  policy?: Record<string, string>;
};

export type RtkStatus = {
  ok?: boolean;
  product?: string;
  preinstalled?: boolean;
  separate_install_required?: boolean;
  present: boolean;
  bundled?: boolean;
  path?: string | null;
  source?: string;
  version?: string | null;
  note?: string;
  message?: string;
  provisioned?: boolean;
};

/** Detect-only coding agent / gateway status (Vitals doctor). No auto-wiring. */
export type CodingAgentFinding = {
  id: string;
  severity: string;
  title: string;
  detail?: string;
};

export type CodingAgentsPayload = {
  ok?: boolean;
  schema: string;
  generated_at: string;
  policy?: { mode?: string; note?: string };
  summary: {
    claude_present: boolean;
    omniroute_listening: boolean;
    base_url_set: boolean;
    wired: boolean;
    opencode_present: boolean;
  };
  claude: {
    id: string;
    name: string;
    present: boolean;
    on_path?: boolean;
    path?: string | null;
    version?: string | null;
    home?: string | null;
    settings_path?: string | null;
    model?: string | null;
    context_length?: number | null;
    ollama_api_key_approved?: boolean;
    note?: string;
  };
  omniroute: {
    id: string;
    name: string;
    present: boolean;
    home?: string | null;
    ports?: {
      primary: number;
      secondary: number;
      primary_open: boolean;
      secondary_open: boolean;
    };
    listening: boolean;
    wired_to_claude?: boolean;
    note?: string;
  };
  base_url: {
    id: string;
    name: string;
    set: boolean;
    value?: string | null;
    points_at_omniroute?: boolean;
    note?: string;
  };
  opencode?: {
    id: string;
    name: string;
    present: boolean;
    on_path?: boolean;
    path?: string | null;
    version?: string | null;
    home?: string | null;
    note?: string;
  };
  findings: CodingAgentFinding[];
};
