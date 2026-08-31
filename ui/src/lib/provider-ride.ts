/** ProviderRide — types for doctor matrix + sealed credentials */

export type ProviderRideBackend = {
  id: string;
  ok: boolean;
  status: string;
  detail?: string;
};

export type ProviderRideChannel = {
  id: string;
  label: string;
  status: string;
  health: string;
  active_backend: string;
  eta?: string | null;
  cooldown_until?: string | null;
  session?: boolean;
  backends?: ProviderRideBackend[];
  fixes?: string[];
  booth?: Array<{ target: string; url: string }>;
};

export type ProviderRideReport = {
  version?: number;
  available?: boolean;
  brand?: string;
  score?: string;
  ok?: number;
  total?: number;
  session_provider?: string | null;
  alternates?: string[];
  channels?: Record<string, ProviderRideChannel>;
  fixes?: string[];
  matrix_line?: string;
  bridge_installed?: boolean;
  error?: string;
  credentials?: {
    entry_count?: number;
    cipher?: string;
    master_key_present?: boolean;
    state_dir?: string;
  };
};

export type ProviderRideCredItem = {
  id: string;
  kind?: string;
  provider?: string;
  label?: string;
  masked?: string;
  source?: string;
  updated_at?: string;
  present?: boolean;
};

export type ProviderRideCredCatalog = {
  provider: string;
  label: string;
  local?: boolean;
  kinds: Array<{ kind: string; label?: string; env_names?: string[] }>;
};

export type ProviderRideCredentialsResponse = {
  ok?: boolean;
  brand?: string;
  items?: ProviderRideCredItem[];
  catalog?: ProviderRideCredCatalog[];
  entry_count?: number;
  cipher?: string;
  master_key_present?: boolean;
  presence?: Record<string, { api_key?: boolean; session?: boolean; cookie?: boolean }>;
  keyVault?: { cipher?: string; note?: string };
  error?: string;
};

export function channelTone(status: string): "green" | "amber" | "red" | "slate" {
  const s = String(status || "").toLowerCase();
  if (s === "active" || s === "ok") return "green";
  if (s === "cooldown") return "amber";
  if (s === "missing" || s === "down" || s === "error") return "red";
  return "slate";
}

export function scoreTone(score?: string): "green" | "amber" | "red" | "slate" {
  if (!score || !score.includes("/")) return "slate";
  const [a, b] = score.split("/").map(Number);
  if (!b) return "slate";
  const r = a / b;
  if (r >= 0.75) return "green";
  if (r >= 0.4) return "amber";
  return "red";
}
