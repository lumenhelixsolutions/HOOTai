export type ProjectOverview = {
  project: { name: string; path: string; type: string };
  brain: { present: boolean; timestamp: string | null; files: Record<string, boolean> };
  next_best_move: string | null;
  working: string | null;
  blockers: string | null;
  excerpt: string | null;
};

export type BridgeHealth = {
  id: string;
  label: string;
  endpoint: string;
  port?: number;
  service_url?: string;
  status: "verified" | "ready" | "online" | "incomplete" | "unknown";
  modules_ready?: boolean;
  e2e_script?: boolean;
  e2e_script_path?: string;
  last_e2e?: {
    ok: boolean;
    finished_at: string | null;
    shot_count?: number | null;
    pushed?: boolean;
    files_written?: number | null;
    stitched?: boolean;
    error: string | null;
  } | null;
  cineforge_online?: boolean;
  cineforge_health_url?: string;
  lab_online?: boolean;
  lab_version?: number | null;
  lab_health_url?: string;
  sidecar_online?: boolean;
  sidecar_health_url?: string;
};

export type PipelineOverview = {
  version: number;
  generated_at: string;
  milestone_version: string | null;
  milestones: Array<{ id: number; name: string; status: string; projects: string }>;
  bridges: Array<{ from: string; to: string; label: string; endpoint: string }>;
  bridge_health: BridgeHealth[];
  integration_matrix: Array<{ project: string; rtk: string; mcp: string; llamacpp: string; role: string }>;
  projects: Array<{
    name: string;
    path: string;
    type: string;
    active: boolean;
    brain: { present: boolean; timestamp: string | null; has_pipeline_overview: boolean; has_current_state: boolean };
    pipeline_excerpt: string | null;
  }>;
  active_project: ProjectOverview | null;
  port_registry?: Array<{ port: number; service: string; url: string }>;
  sources: Record<string, string | null | Record<string, string>>;
};