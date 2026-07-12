export type TokenLedgerDay = {
  date: string;
  total_tokens: number;
  codex: {
    total_tokens: number;
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
    reasoning_output_tokens?: number;
    threads?: number;
    token_count_events?: number;
    first_event_at?: string | null;
    last_event_at?: string | null;
  };
  claude: {
    total_tokens: number;
    exact_logged_tokens: number;
    estimated_chat_tokens: number;
    exact_calls?: number;
    coverage_status?: string;
  };
  chatgpt: {
    total_tokens: number;
    estimated_chat_tokens: number;
    export_estimated_tokens?: number;
    activity_estimated_tokens?: number;
    coverage_status?: string;
  };
};

export type TokenLedgerKeyMoment = {
  date: string;
  label: string;
  driver: string;
  total_tokens: number;
  codex_tokens: number;
  claude_tokens: number;
  chatgpt_tokens: number;
};

export type TokenLedgerWorkGroup = {
  name: string;
  note: string;
  share: number;
  total_tokens: number;
  examples: Array<{ date: string; label: string; tokens: number }>;
};

export type TokenLedgerPayload = {
  version: number;
  metadata: {
    current: {
      last_hour: {
        total_tokens: number;
        window_start?: string;
        window_end?: string;
        basis?: string;
      };
      day_to_date: {
        date: string;
        total_tokens: number;
        codex_tokens: number;
        claude_tokens: number;
        chatgpt_tokens: number;
        basis?: string;
      };
    };
    equivalents: {
      assumptions: Record<string, unknown>;
      water: { ai_gallons: number; almond_latte_equivalent: number };
      electricity: { ai_kwh: number; netflix_big_screen_movie_equivalent: number };
      code: { gross_loc_equivalent: number; engineer_years_mid: number };
    };
    first_day: string;
    last_day: string;
    today: string;
    generated_at: string;
    timezone: string;
    refresh_mode: string;
    refresh_note: string;
    totals_are: string;
    scale: { thresholds: number[]; domain: number[]; transform: string; method: string };
    sources: { codex_roots: string[]; claude_csv: string | null; chatgpt_csv: string | null };
    key_moments: TokenLedgerKeyMoment[];
    work_breakdown: { method: string; groups: TokenLedgerWorkGroup[] };
    configured: boolean;
    empty: boolean;
  };
  days: TokenLedgerDay[];
  config?: {
    timezone: string;
    codex_roots: string[];
    claude_csv: string | null;
    chatgpt_csv: string | null;
  };
};

export type LedgerRange = "90" | "180" | "365" | "all";

export const LEDGER_ROWS = [
  { key: "total" as const, label: "Total", note: "Codex + Claude + ChatGPT" },
  { key: "codex" as const, label: "Codex", note: "local Codex logs" },
  { key: "claude" as const, label: "Claude", note: "exact + estimated chat" },
  { key: "chatgpt" as const, label: "ChatGPT", note: "export + activity estimate" },
];