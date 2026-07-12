import type { LedgerRange, TokenLedgerDay, TokenLedgerPayload } from "./token-ledger-types";

export function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function formatDate(value: string, opts: { weekday?: "short"; year?: boolean } = {}) {
  return parseDate(value).toLocaleDateString("en-US", {
    weekday: opts.weekday,
    month: "short",
    day: "numeric",
    year: opts.year ? "numeric" : undefined,
  });
}

export function formatClock(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatNumber(value: number) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${n}`;
}

export function formatExact(value: number) {
  return Number(value || 0).toLocaleString("en-US");
}

export function formatShare(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function getValue(day: TokenLedgerDay | undefined, key: "total" | "codex" | "claude" | "chatgpt") {
  if (!day) return 0;
  if (key === "total") return Number(day.total_tokens || 0);
  return Number(day[key]?.total_tokens || 0);
}

export function rangeDates(data: TokenLedgerPayload, currentRange: LedgerRange): [Date, Date] {
  const last = parseDate(data.metadata.last_day);
  const first = parseDate(data.metadata.first_day);
  if (currentRange === "all") return [first, last];
  const days = Number(currentRange);
  const requestedStart = addDays(last, -(days - 1));
  return [requestedStart < first ? first : requestedStart, last];
}

export function daysBetween(data: TokenLedgerPayload, start: Date, end: Date) {
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const out: TokenLedgerDay[] = [];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const key = isoDate(date);
    out.push(
      byDate.get(key) || {
        date: key,
        total_tokens: 0,
        codex: { total_tokens: 0 },
        claude: { total_tokens: 0, exact_logged_tokens: 0, estimated_chat_tokens: 0 },
        chatgpt: { total_tokens: 0, estimated_chat_tokens: 0 },
      },
    );
  }
  return out;
}

export function levelFor(value: number, thresholds: number[]) {
  if (!value) return 0;
  if (value <= thresholds[0]) return 1;
  if (value <= thresholds[1]) return 2;
  if (value <= thresholds[2]) return 3;
  if (value <= thresholds[3]) return 4;
  return 5;
}

export function sumDays(days: TokenLedgerDay[], key: "total" | "codex" | "claude" | "chatgpt") {
  return days.reduce((sum, day) => sum + getValue(day, key), 0);
}

export function previousDays(data: TokenLedgerPayload, endDate: string, count: number) {
  const end = parseDate(endDate);
  return daysBetween(data, addDays(end, -(count - 1)), end);
}

export function rowStats(data: TokenLedgerPayload, key: "total" | "codex" | "claude" | "chatgpt") {
  const todayKey = data.metadata.today;
  const todayDay = data.days.find((d) => d.date === todayKey);
  const last7 = previousDays(data, todayKey, 7);
  const last30 = previousDays(data, todayKey, 30);
  const activeDays = data.days.filter((day) => getValue(day, key) > 0).length;
  const peak = data.days.reduce((best, day) => (getValue(day, key) > getValue(best, key) ? day : best), data.days[0]);
  const sparkDays = data.days.slice(-30);
  return {
    today: getValue(todayDay, key),
    last7: sumDays(last7, key),
    last30: sumDays(last30, key),
    activeDays,
    peak,
    sparkValues: sparkDays.map((day) => getValue(day, key)),
  };
}

export function sparkPath(values: number[], width = 118, height = 26, yMax?: number) {
  const max = Math.max(yMax ?? Math.max(...values, 1), 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function movingAverage(days: TokenLedgerDay[], key: "total" | "codex" | "claude" | "chatgpt", windowSize = 30) {
  return days.map((day, index) => {
    const sample = days.slice(Math.max(0, index - windowSize + 1), index + 1);
    const total = sumDays(sample, key);
    return {
      date: day.date,
      value: total / sample.length,
      total,
      days: sample.length,
      daily: getValue(day, key),
    };
  });
}

export function logLinePath(
  series: Array<{ value: number }>,
  width: number,
  height: number,
  yMin: number,
  yMax: number,
) {
  const logMin = Math.log10(Math.max(1, yMin));
  const logMax = Math.log10(Math.max(1, yMax));
  const span = Math.max(0.0001, logMax - logMin);
  const yFor = (value: number) => height - ((Math.log10(Math.max(1, value)) - logMin) / span) * height;
  return series
    .map((point, index) => {
      const x = (index / Math.max(1, series.length - 1)) * width;
      const y = yFor(point.value);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

const CELL_COLORS = [
  "rgba(255,255,255,0.04)",
  "rgba(255,176,66,0.12)",
  "rgba(255,176,66,0.28)",
  "rgba(255,176,66,0.45)",
  "rgba(255,176,66,0.62)",
  "rgba(255,176,66,0.82)",
];

export function cellBackground(level: number) {
  return CELL_COLORS[Math.max(0, Math.min(5, level))];
}