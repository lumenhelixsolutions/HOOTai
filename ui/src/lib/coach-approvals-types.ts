export type CoachApprovalEntry = {
  type: string;
  ok: boolean;
  profileId: string | null;
  project: string | null;
  blocked: boolean;
  error: string | null;
  at: string;
  dryRun?: boolean;
  launched?: boolean;
  tier?: string | null;
  score?: number | null;
};

export type CoachApprovalSummary = {
  window: number;
  total: number;
  okCount: number;
  blockedCount: number;
  graphRuns: number;
  graphDryRuns: number;
  successRate: number;
  byType: Record<string, number>;
  byProfile: Record<string, number>;
  byTier: Record<string, number>;
  phase4Ready: boolean;
};

export type CoachApprovalsPayload = {
  path: string;
  rows: CoachApprovalEntry[];
  count: number;
  phase4Ready: boolean;
  summary?: CoachApprovalSummary;
};

export type CoachGraphRunResult = {
  ok: boolean;
  status: number;
  profileId: string;
  dryRun: boolean;
  launched: boolean;
  error: string | null;
  config: { min_score?: number; tier?: string; graph?: string } | null;
  state: Record<string, unknown> | null;
  sidecar: string;
};

export type CoachGraphStatus = {
  ok: boolean;
  sidecar: { online: boolean; status: number; base: string; error?: string };
};