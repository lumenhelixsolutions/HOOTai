export type BenchRow = {
  model: string;
  status: string;
  latency_ms: number;
  tokens_per_sec: number;
  note: string;
  backend?: string;
  updated_at: string | null;
};

export type BenchValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  row_count: number;
  tiers?: Record<string, number>;
  thresholds?: { fast: number; ok: number };
};

export type BenchResultsPayload = {
  path: string;
  rows: BenchRow[];
  updated_at: string | null;
  validation?: BenchValidation;
};

export type BenchRunResult = BenchResultsPayload & {
  ok?: boolean;
  error?: string;
};