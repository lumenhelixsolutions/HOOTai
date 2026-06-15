export type CoachApprovalEntry = {
  type: string;
  ok: boolean;
  profileId: string | null;
  project: string | null;
  blocked: boolean;
  error: string | null;
  at: string;
};

export type CoachApprovalsPayload = {
  path: string;
  rows: CoachApprovalEntry[];
  count: number;
  phase4Ready: boolean;
};