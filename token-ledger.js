/**
 * HOOT Token Ledger — multi-provider burn ingest + analytics (Burn v2).
 * Matches Nate sepia dashboard tokenBurnData shape; local-only ingest.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  version: 1,
  timezone: 'America/Los_Angeles',
  codex_roots: [],
  claude_csv: null,
  chatgpt_csv: null,
  chatgpt_export_dir: null,
  estimation_priors: {
    claude_heavy_user_mid: 0,
  },
};

const FERMI_ASSUMPTIONS = {
  tokens_per_query_equivalent: 1000,
  ai_water_gallons_per_query: 8.5e-5,
  ai_energy_wh_per_query: 0.34,
  almond_milk_liters_per_latte: 0.295735,
  almond_milk_water_liters_per_liter: 371,
  netflix_big_screen_kwh_per_movie: 0.45,
  tokens_per_loc: 15,
  net_loc_per_engineer_year: 10000,
  net_loc_per_engineer_year_low: 5000,
  net_loc_per_engineer_year_high: 20000,
  notes: [
    'Query-equivalent means 1,000 total tokens, used only to bridge token volume to published per-query estimates.',
    'Almond latte assumes 10 fluid ounces of almond milk in a 12 ounce latte.',
    'LOC is gross code-sized text equivalent, not shipped production code.',
  ],
};

const WORK_FAMILY_RULES = [
  { id: 'automations', name: 'Automations + browser/computer-use ops', note: 'tool-using workflows where Codex keeps state, UI, and policy context alive', patterns: [/computer[- ]?use/i, /browser/i, /playwright/i, /selenium/i, /support[- ]?monitor/i, /automation/i] },
  { id: 'client_planning', name: 'Client planning docs + quantitative models', note: 'long-context plans, decks, spreadsheets, transcripts, and executive rewrites', patterns: [/client/i, /deck/i, /spreadsheet/i, /model/i, /planning/i, /financial/i] },
  { id: 'editorial', name: 'Editorial, video, and public writing', note: 'source reading, transcript synthesis, editorial passes, and script conversion', patterns: [/youtube/i, /transcript/i, /editorial/i, /script/i, /video/i] },
  { id: 'hiring', name: 'Hiring + candidate assessment', note: 'candidate evidence reviews and hiring memos', patterns: [/candidate/i, /hiring/i, /resume/i, /interview/i] },
  { id: 'dashboards', name: 'Visual artifacts + dashboards/decks', note: 'rendered artifacts, dashboard work, slide polish, and browser verification', patterns: [/dashboard/i, /vercel/i, /deploy/i, /tufte/i] },
  { id: 'personal', name: 'Personal/admin + file search', note: 'local retrieval, trip/admin work, and personal planning', patterns: [/personal/i, /admin/i, /trip/i, /file search/i] },
];

function formatDateInTimeZone(date = new Date(), timeZone = 'UTC') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    if (map.year && map.month && map.day) return `${map.year}-${map.month}-${map.day}`;
  } catch { /* fall back */ }
  return date.toISOString().slice(0, 10);
}

function isoDate(d = new Date(), timeZone = 'UTC') {
  return formatDateInTimeZone(d instanceof Date ? d : new Date(d), timeZone);
}

function expandHome(p) {
  if (!p || typeof p !== 'string') return p;
  if (p.startsWith('~/')) return path.join(process.env.HOME || process.env.USERPROFILE || '', p.slice(2));
  return p;
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadConfig(configFile) {
  const raw = readJSON(configFile, null);
  if (!raw) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...raw };
}

function saveConfig(configFile, config) {
  writeJSON(configFile, { ...config, version: 1, updated_at: new Date().toISOString() });
}

function loadCache(cacheFile) {
  return readJSON(cacheFile, { version: 1, days: [], file_mtimes: {}, imported_at: null });
}

function saveCache(cacheFile, cache) {
  writeJSON(cacheFile, { ...cache, version: 1, saved_at: new Date().toISOString() });
}

function emptyCodexDay(date) {
  return {
    date,
    total_tokens: 0,
    input_tokens: 0,
    cached_input_tokens: 0,
    uncached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    token_count_events: 0,
    threads: new Set(),
    first_event_at: null,
    last_event_at: null,
  };
}

function emptyClaudeDay(date) {
  return {
    date,
    total_tokens: 0,
    exact_logged_tokens: 0,
    estimated_chat_tokens: 0,
    chat_est_low: 0,
    chat_est_mid: 0,
    chat_est_high: 0,
    exact_calls: 0,
    chat_ui_visits: 0,
    distinct_chat_urls: 0,
    coverage_status: 'not_configured',
    chat_estimation_method: null,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    input_tokens: 0,
    output_tokens: 0,
  };
}

function emptyChatGptDay(date) {
  return {
    date,
    total_tokens: 0,
    estimated_chat_tokens: 0,
    estimate_low: 0,
    estimate_mid: 0,
    estimate_high: 0,
    export_estimated_tokens: 0,
    export_context_tokens: 0,
    export_output_tokens: 0,
    export_assistant_messages: 0,
    export_conversations: 0,
    activity_estimated_tokens: 0,
    activity_est_low: 0,
    activity_est_mid: 0,
    activity_est_high: 0,
    browser_visits: 0,
    conversation_url_visits: 0,
    distinct_chat_urls: 0,
    app_conversation_files: 0,
    app_cache_files: 0,
    app_cache_signal_bytes: 0,
    coverage_status: 'not_configured',
    estimation_method: null,
    latest_export_message_day: null,
  };
}

function finalizeCodexDay(row) {
  const threads = row.threads instanceof Set ? row.threads.size : Number(row.threads) || 0;
  return {
    date: row.date,
    total_tokens: row.total_tokens,
    input_tokens: row.input_tokens,
    cached_input_tokens: row.cached_input_tokens,
    uncached_input_tokens: row.uncached_input_tokens,
    output_tokens: row.output_tokens,
    reasoning_output_tokens: row.reasoning_output_tokens,
    token_count_events: row.token_count_events,
    threads,
    first_event_at: row.first_event_at,
    last_event_at: row.last_event_at,
  };
}

function parseCsv(text) {
  const source = String(text || '').replace(/^﻿/, '');
  if (!source.trim()) return [];
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\r') {
      continue;
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  return rows.slice(1)
    .filter((cols) => cols.some((value) => String(value || '').trim()))
    .map((cols) => {
      const out = {};
      headers.forEach((h, i) => {
        out[h] = cols[i] ?? '';
      });
      return out;
    });
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractTokenFields(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const usage = obj.usage || obj.token_usage || obj.metrics || obj;
  const input = num(usage.input_tokens ?? usage.prompt_tokens ?? obj.input_tokens);
  const output = num(usage.output_tokens ?? usage.completion_tokens ?? obj.output_tokens);
  const cached = num(usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? obj.cached_input_tokens);
  const reasoning = num(usage.reasoning_output_tokens ?? obj.reasoning_output_tokens);
  const total = num(usage.total_tokens ?? obj.total_tokens ?? input + output);
  if (total <= 0 && input <= 0 && output <= 0) return null;
  const ts = obj.timestamp || obj.created_at || obj.at || obj.time || null;
  const thread = obj.thread_id || obj.thread || obj.session_id || obj.conversation_id || null;
  const prompt = obj.prompt || obj.user_message || obj.text || obj.path || '';
  return { input, output, cached, reasoning, total: total || input + output, ts, thread, prompt: String(prompt) };
}

function eventDay(ts, fallbackDate, timeZone = 'UTC') {
  if (!ts) return fallbackDate;
  const s = String(ts);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    return isoDate(new Date(s), timeZone);
  } catch {
    return fallbackDate;
  }
}

function walkFiles(root, acc = []) {
  if (!root || !fs.existsSync(root)) return acc;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    if (/\.(jsonl?|ndjson)$/i.test(root)) acc.push(root);
    return acc;
  }
  for (const name of fs.readdirSync(root)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    walkFiles(path.join(root, name), acc);
  }
  return acc;
}

function ingestCodexRoots(roots, { fileMtimes = {}, recentOnly = false, recentCutoffMs = Date.now() - 7 * 86400000, timeZone = 'UTC' } = {}) {
  const byDay = new Map();
  const sessions = [];
  const events = [];
  const mtimes = { ...fileMtimes };

  for (const rawRoot of roots || []) {
    const root = expandHome(rawRoot);
    for (const file of walkFiles(root)) {
      let mtime = 0;
      try {
        mtime = fs.statSync(file).mtimeMs;
        mtimes[file] = mtime;
      } catch {
        continue;
      }
      if (recentOnly && mtime < recentCutoffMs && fileMtimes[file]) continue;

      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
      let sessionTokens = 0;
      let sessionPrompt = '';
      let sessionDate = null;
      let sessionLabel = path.basename(file, path.extname(file));

      for (const line of lines) {
        let obj;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        const fields = extractTokenFields(obj);
        if (!fields) continue;
        const day = eventDay(fields.ts, isoDate(new Date(), timeZone), timeZone);
        if (!byDay.has(day)) byDay.set(day, emptyCodexDay(day));
        const row = byDay.get(day);
        row.input_tokens += fields.input;
        row.output_tokens += fields.output;
        row.cached_input_tokens += fields.cached;
        row.uncached_input_tokens += Math.max(0, fields.input - fields.cached);
        row.reasoning_output_tokens += fields.reasoning;
        row.total_tokens += fields.total;
        row.token_count_events += 1;
        if (fields.thread) row.threads.add(String(fields.thread));
        if (fields.ts) {
          if (!row.first_event_at || fields.ts < row.first_event_at) row.first_event_at = fields.ts;
          if (!row.last_event_at || fields.ts > row.last_event_at) row.last_event_at = fields.ts;
        }
        sessionTokens += fields.total;
        sessionDate = day;
        if (fields.prompt) sessionPrompt = fields.prompt;
        events.push({ ...fields, day, file });
      }

      if (sessionTokens > 0) {
        sessions.push({
          date: sessionDate,
          label: sessionLabel,
          tokens: sessionTokens,
          prompt: sessionPrompt,
          file,
        });
      }
    }
  }

  return { byDay, sessions, events, mtimes };
}

function ingestClaudeCsv(csvPath, transactions = [], timeZone = 'UTC') {
  const byDay = new Map();
  const file = expandHome(csvPath);
  if (file && fs.existsSync(file)) {
    const rows = parseCsv(fs.readFileSync(file, 'utf8'));
    for (const row of rows) {
      const date = eventDay(row.date, null, timeZone);
      if (!date) continue;
      if (!byDay.has(date)) byDay.set(date, emptyClaudeDay(date));
      const d = byDay.get(date);
      const input = num(row.input_tokens);
      const output = num(row.output_tokens);
      const cacheRead = num(row.cache_read_input_tokens);
      const cacheCreate = num(row.cache_creation_input_tokens);
      const calls = num(row.calls);
      d.input_tokens += input;
      d.output_tokens += output;
      d.cache_read_input_tokens += cacheRead;
      d.cache_creation_input_tokens += cacheCreate;
      d.exact_calls += calls;
      d.exact_logged_tokens += input + output;
      d.total_tokens = d.exact_logged_tokens + d.estimated_chat_tokens;
      d.coverage_status = 'csv_exact';
      d.chat_estimation_method = 'csv_ingest';
    }
  }

  for (const tx of transactions || []) {
    const date = eventDay(tx.timestamp, null, timeZone);
    if (!date) continue;
    if (!byDay.has(date)) byDay.set(date, emptyClaudeDay(date));
    const d = byDay.get(date);
    const input = num(tx.input_tokens);
    const output = num(tx.output_tokens);
    if (input + output <= 0) continue;
    d.input_tokens += input;
    d.output_tokens += output;
    d.exact_logged_tokens += input + output;
    d.exact_calls += 1;
    d.total_tokens = d.exact_logged_tokens + d.estimated_chat_tokens;
    d.coverage_status = 'hoot_transactions';
    d.chat_estimation_method = 'core_transactions';
  }

  return byDay;
}

function ingestChatGptCsv(csvPath, timeZone = 'UTC') {
  const byDay = new Map();
  const file = expandHome(csvPath);
  if (!file || !fs.existsSync(file)) return byDay;
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const date = eventDay(row.date, null, timeZone);
    if (!date) continue;
    if (!byDay.has(date)) byDay.set(date, emptyChatGptDay(date));
    const d = byDay.get(date);
    const est = num(row.estimated_tokens);
    const exportTok = num(row.export_tokens);
    const activity = num(row.activity_tokens);
    d.estimated_chat_tokens = est || activity || exportTok;
    d.export_estimated_tokens = exportTok;
    d.activity_estimated_tokens = activity || est;
    d.estimate_mid = est;
    d.estimate_low = Math.round(est * 0.3);
    d.estimate_high = Math.round(est * 2.8);
    d.activity_est_mid = d.activity_estimated_tokens;
    d.activity_est_low = Math.round(d.activity_estimated_tokens * 0.3);
    d.activity_est_high = Math.round(d.activity_estimated_tokens * 2.8);
    d.total_tokens = d.estimated_chat_tokens;
    d.coverage_status = 'csv_estimate';
    d.estimation_method = 'csv_ingest';
  }
  return byDay;
}

function mergeDayMaps(codexByDay, claudeByDay, chatgptByDay) {
  const dates = new Set([
    ...codexByDay.keys(),
    ...claudeByDay.keys(),
    ...chatgptByDay.keys(),
  ]);
  const days = [...dates].sort();
  return days.map((date) => {
    const codexRaw = codexByDay.get(date) || emptyCodexDay(date);
    const codex = finalizeCodexDay(codexRaw);
    const claude = { ...(claudeByDay.get(date) || emptyClaudeDay(date)) };
    const chatgpt = { ...(chatgptByDay.get(date) || emptyChatGptDay(date)) };
    claude.total_tokens = claude.exact_logged_tokens + claude.estimated_chat_tokens;
    chatgpt.total_tokens = chatgpt.estimated_chat_tokens || chatgpt.activity_estimated_tokens || chatgpt.export_estimated_tokens;
    return {
      date,
      total_tokens: codex.total_tokens + claude.total_tokens + chatgpt.total_tokens,
      codex,
      claude,
      chatgpt,
    };
  });
}

function classifySession(prompt, label) {
  const text = `${prompt} ${label}`;
  for (const rule of WORK_FAMILY_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return { id: rule.id, name: rule.name, note: rule.note };
    }
  }
  return { id: 'other', name: 'Other / mixed local work', note: 'small sessions that do not cleanly fall into a dominant work family' };
}

function buildWorkBreakdown(sessions, days) {
  const claudeTotal = days.reduce((s, d) => s + num(d.claude.total_tokens), 0);
  const chatgptTotal = days.reduce((s, d) => s + num(d.chatgpt.total_tokens), 0);
  const groups = new Map();

  for (const session of sessions) {
    const family = classifySession(session.prompt, session.label);
    if (!groups.has(family.id)) {
      groups.set(family.id, {
        name: family.name,
        note: family.note,
        total_tokens: 0,
        examples: [],
      });
    }
    const g = groups.get(family.id);
    g.total_tokens += session.tokens;
    g.examples.push({ date: session.date, label: session.label, tokens: session.tokens });
  }

  if (claudeTotal > 0) {
    groups.set('claude_chat', {
      name: 'Claude Chat / long-context baseline',
      note: 'exact logged Claude usage plus estimated Claude Chat where exact chat tokens are unavailable',
      total_tokens: claudeTotal,
      examples: days.filter((d) => d.claude.total_tokens > 0).slice(-2).map((d) => ({
        date: d.date,
        label: 'Claude usage',
        tokens: d.claude.total_tokens,
      })),
    });
  }
  if (chatgptTotal > 0) {
    groups.set('chatgpt_chat', {
      name: 'ChatGPT chat baseline',
      note: 'estimated ChatGPT conversation volume from export context replay plus browser/app activity',
      total_tokens: chatgptTotal,
      examples: days.filter((d) => d.chatgpt.total_tokens > 0).slice(-1).map((d) => ({
        date: d.date,
        label: 'ChatGPT estimate',
        tokens: d.chatgpt.total_tokens,
      })),
    });
  }

  const list = [...groups.values()].sort((a, b) => b.total_tokens - a.total_tokens);
  const grand = list.reduce((s, g) => s + g.total_tokens, 0) || 1;
  return {
    method: 'Codex groups are heuristic classifications from session prompts and paths; Claude and ChatGPT are separated because most chat content is not locally classifiable.',
    groups: list.map((g) => ({
      ...g,
      share: g.total_tokens / grand,
      examples: (g.examples || []).sort((a, b) => b.tokens - a.tokens).slice(0, 3),
    })),
  };
}

function buildKeyMoments(days, limit = 10) {
  return [...days]
    .sort((a, b) => b.total_tokens - a.total_tokens)
    .slice(0, limit)
    .map((day) => {
      const codex = day.codex.total_tokens;
      const claude = day.claude.total_tokens;
      const chatgpt = day.chatgpt.total_tokens;
      let label = 'Mixed provider day';
      let driver = 'Multiple tools contributed to the daily total.';
      if (codex > claude && codex > chatgpt) {
        label = codex > 100000000 ? 'Codex context spike' : 'Codex-heavy day';
        driver = `Codex accounted for ${Math.round(codex / 1e6)}M tokens${claude + chatgpt > 0 ? ', with chat lanes present' : ''}.`;
      } else if (claude > codex && claude > chatgpt) {
        label = 'Claude-heavy day';
        driver = 'Claude exact or estimated chat dominated the daily burn.';
      } else if (chatgpt > codex && chatgpt > claude) {
        label = 'ChatGPT estimate day';
        driver = 'ChatGPT export/activity estimate dominated the daily burn.';
      }
      return {
        date: day.date,
        label,
        driver,
        total_tokens: day.total_tokens,
        codex_tokens: codex,
        claude_tokens: claude,
        chatgpt_tokens: chatgpt,
      };
    });
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const rank = Math.min(sorted.length - 1, Math.max(0, (p / 100) * (sorted.length - 1)));
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const weight = rank - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function buildScale(days) {
  const values = (days || []).map((d) => num(d.total_tokens)).filter((v) => v > 0);
  if (!values.length) {
    return {
      thresholds: [1e3, 1e4, 1e5, 1e6, 1e7],
      domain: [0, 1e7],
      transform: 'log10',
      method: 'default fallback',
    };
  }
  const peak = Math.max(...values);
  const p50 = percentile(values, 50);
  const p75 = percentile(values, 75);
  const p90 = percentile(values, 90);
  const p95 = percentile(values, 95);
  return {
    thresholds: [p50, p75, p90, p95, peak].map((v) => Math.max(1, Math.round(v))),
    domain: [0, Math.max(peak, 1)],
    transform: 'log10',
    method: 'daily token volume percentiles',
  };
}

function buildEquivalents(totalTokens) {
  const total = Math.max(0, num(totalTokens));
  const queryEquivalents = total / FERMI_ASSUMPTIONS.tokens_per_query_equivalent;
  const aiGallons = queryEquivalents * FERMI_ASSUMPTIONS.ai_water_gallons_per_query;
  const aiKwh = (queryEquivalents * FERMI_ASSUMPTIONS.ai_energy_wh_per_query) / 1000;
  const almondLattes = aiGallons * 3.78541 / (FERMI_ASSUMPTIONS.almond_milk_liters_per_latte * FERMI_ASSUMPTIONS.almond_milk_water_liters_per_liter);
  const grossLoc = total / FERMI_ASSUMPTIONS.tokens_per_loc;
  return {
    assumptions: { ...FERMI_ASSUMPTIONS },
    query_equivalents: queryEquivalents,
    water: {
      ai_gallons: aiGallons,
      almond_latte_equivalent: almondLattes,
    },
    electricity: {
      ai_kwh: aiKwh,
      netflix_big_screen_movie_equivalent: aiKwh / FERMI_ASSUMPTIONS.netflix_big_screen_kwh_per_movie,
    },
    code: {
      gross_loc_equivalent: grossLoc,
      engineer_years_mid: grossLoc / FERMI_ASSUMPTIONS.net_loc_per_engineer_year,
      engineer_years_low: grossLoc / FERMI_ASSUMPTIONS.net_loc_per_engineer_year_high,
      engineer_years_high: grossLoc / FERMI_ASSUMPTIONS.net_loc_per_engineer_year_low,
    },
  };
}

function buildCurrent(codexEvents, days, today) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const recent = (codexEvents || []).filter((e) => {
    if (!e.ts) return false;
    const t = new Date(e.ts).getTime();
    return t >= hourAgo && t <= now;
  });
  const lastHour = recent.reduce(
    (acc, e) => {
      acc.total_tokens += e.total;
      acc.input_tokens += e.input;
      acc.cached_input_tokens += e.cached;
      acc.output_tokens += e.output;
      acc.reasoning_output_tokens += e.reasoning;
      acc.token_count_events += 1;
      if (e.thread) acc.threads.add(String(e.thread));
      return acc;
    },
    {
      window_minutes: 60,
      window_start: new Date(hourAgo).toISOString(),
      window_end: new Date(now).toISOString(),
      total_tokens: 0,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      threads: new Set(),
      token_count_events: 0,
      basis: 'Exact local Codex events',
    },
  );
  lastHour.threads = lastHour.threads.size;

  const todayDay = days.find((d) => d.date === today) || null;
  return {
    last_hour: lastHour,
    day_to_date: {
      date: today,
      total_tokens: todayDay?.total_tokens || 0,
      codex_tokens: todayDay?.codex?.total_tokens || 0,
      claude_tokens: todayDay?.claude?.total_tokens || 0,
      chatgpt_tokens: todayDay?.chatgpt?.total_tokens || 0,
      basis: 'Codex rescanned + chat lanes from configured CSVs',
    },
  };
}

function importTokenBurnData(payload) {
  if (!payload || !Array.isArray(payload.days)) return null;
  return {
    metadata: payload.metadata || {},
    days: payload.days,
    imported: true,
  };
}

function ingestAll({ config, cache, mode = 'full', transactions = [] }) {
  const recentOnly = mode === 'fast_recent' && (cache?.days?.length > 0);
  const codex = ingestCodexRoots(config.codex_roots, {
    fileMtimes: cache?.file_mtimes || {},
    recentOnly,
    timeZone: config.timezone,
  });
  const claudeByDay = ingestClaudeCsv(config.claude_csv, transactions, config.timezone);
  const chatgptByDay = ingestChatGptCsv(config.chatgpt_csv, config.timezone);

  let days;
  let sessions = codex.sessions;
  if (recentOnly) {
    const merged = mergeDayMaps(codex.byDay, claudeByDay, chatgptByDay);
    const byDate = new Map((cache.days || []).map((d) => [d.date, d]));
    for (const d of merged) byDate.set(d.date, d);
    days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

    const cachedSessions = Array.isArray(cache.sessions) ? cache.sessions : [];
    const recentFiles = new Set((codex.sessions || []).map((s) => s.file).filter(Boolean));
    sessions = [
      ...cachedSessions.filter((s) => !s?.file || !recentFiles.has(s.file)),
      ...codex.sessions,
    ].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')) || Number(b?.tokens || 0) - Number(a?.tokens || 0));
  } else {
    days = mergeDayMaps(codex.byDay, claudeByDay, chatgptByDay);
  }

  return {
    days,
    sessions,
    codexEvents: codex.events,
    file_mtimes: codex.mtimes,
    refresh_mode: recentOnly ? 'fast_recent' : 'full',
    refresh_note: recentOnly
      ? 'Fast path: reuse cached historical days; rescan recently modified Codex files and reload CSV lanes.'
      : 'Full rebuild from configured Codex roots and CSV paths.',
  };
}

function buildTokenLedger({
  stateDir,
  configFile,
  cacheFile,
  refresh = false,
  mode = 'full',
  transactions = [],
  importPayload = null,
  hootRoot = null,
  autoDiscover = false,
} = {}) {
  const config = loadConfig(configFile || path.join(stateDir, 'token-ledger-config.json'));
  const cache = loadCache(cacheFile || path.join(stateDir, 'token-ledger-cache.json'));

  // Auto-attach discovered multi-source roots when refreshing footprint
  let footprintDiscover = null;
  if (autoDiscover || refresh) {
    footprintDiscover = discoverLedgerSources({ hootRoot: hootRoot || path.dirname(stateDir) });
    const extraRoots = [];
    for (const s of footprintDiscover.sources || []) {
      if (!s.present || !s.enabled_default) continue;
      if (s.id === 'codex') continue; // already via codex_roots
      for (const r of s.roots || []) extraRoots.push(r);
    }
    if (extraRoots.length) {
      const existing = new Set((config.codex_roots || []).map((p) => path.normalize(expandHome(p))));
      const merged = [...(config.codex_roots || [])];
      for (const r of extraRoots) {
        const n = path.normalize(expandHome(r));
        if (!existing.has(n)) {
          existing.add(n);
          merged.push(r);
        }
      }
      config.codex_roots = merged;
    }
  }

  let ingest;
  if (importPayload) {
    const imported = importTokenBurnData(importPayload);
    ingest = {
      days: imported.days,
      sessions: [],
      codexEvents: [],
      file_mtimes: cache.file_mtimes || {},
      refresh_mode: 'import',
      refresh_note: 'Loaded from imported tokenBurnData JSON.',
    };
    if (imported.metadata) {
      cache.imported_metadata = imported.metadata;
    }
  } else if (!refresh && cache.days?.length > 0 && !config.force_rebuild) {
    ingest = {
      days: cache.days,
      sessions: cache.sessions || [],
      codexEvents: [],
      file_mtimes: cache.file_mtimes || {},
      refresh_mode: 'cache',
      refresh_note: 'Serving cached ledger. Pass refresh=1 to rebuild.',
    };
  } else {
    ingest = ingestAll({ config, cache, mode, transactions });
    saveCache(cacheFile || path.join(stateDir, 'token-ledger-cache.json'), {
      days: ingest.days,
      sessions: ingest.sessions,
      file_mtimes: ingest.file_mtimes,
      refresh_mode: ingest.refresh_mode,
    });
  }

  const days = ingest.days || [];
  const today = isoDate(new Date(), config.timezone);
  const firstDay = days[0]?.date || today;
  const lastDay = days[days.length - 1]?.date || today;
  const totalAll = days.reduce((s, d) => s + d.total_tokens, 0);

  const metadata = {
    current: buildCurrent(ingest.codexEvents, days, today),
    equivalents: buildEquivalents(totalAll),
    first_day: firstDay,
    last_day: lastDay,
    today,
    generated_at: new Date().toISOString(),
    timezone: config.timezone,
    refresh_mode: ingest.refresh_mode,
    refresh_note: ingest.refresh_note,
    totals_are: 'token volume; Claude Chat and ChatGPT are estimated when exact chat usage is unavailable',
    scale: buildScale(days),
    sources: {
      codex_roots: config.codex_roots || [],
      claude_csv: config.claude_csv || null,
      chatgpt_csv: config.chatgpt_csv || null,
      footprint: footprintDiscover || cache.footprint || null,
    },
    key_moments: buildKeyMoments(days),
    work_breakdown: buildWorkBreakdown(ingest.sessions, days),
    configured: Boolean((config.codex_roots || []).length || config.claude_csv || config.chatgpt_csv),
    empty: days.length === 0 || totalAll === 0,
    footprint_summary: footprintDiscover?.summary || null,
  };

  if (footprintDiscover) {
    cache.footprint = footprintDiscover;
  }

  if (cache.imported_metadata && ingest.refresh_mode === 'import') {
    Object.assign(metadata, cache.imported_metadata, {
      generated_at: metadata.generated_at,
      refresh_mode: 'import',
    });
  }

  return {
    version: 1,
    metadata,
    days,
    config: {
      timezone: config.timezone,
      codex_roots: config.codex_roots,
      claude_csv: config.claude_csv,
      chatgpt_csv: config.chatgpt_csv,
    },
  };
}

function discoverDefaultPaths(homeDir) {
  const home = homeDir || process.env.HOME || process.env.USERPROFILE || '';
  const candidates = {
    codex_roots: [
      path.join(home, '.codex', 'sessions'),
      path.join(home, '.codex', 'logs'),
    ].filter((p) => fs.existsSync(p)),
    claude_csv: [
      path.join(home, 'exports', 'claude-usage.csv'),
      path.join(home, 'Downloads', 'claude-usage.csv'),
    ].find((p) => fs.existsSync(p)) || null,
    chatgpt_csv: [
      path.join(home, 'exports', 'chatgpt-usage.csv'),
      path.join(home, 'Downloads', 'chatgpt-usage.csv'),
    ].find((p) => fs.existsSync(p)) || null,
  };
  return candidates;
}

const LEDGER_SOURCE_SPECS = [
  { id: 'codex', label: 'Codex', roots: (h) => [path.join(h, '.codex', 'sessions'), path.join(h, '.codex', 'logs')] },
  { id: 'claude', label: 'Claude Code', roots: (h) => [path.join(h, '.claude')] },
  { id: 'gemini', label: 'Gemini CLI', roots: (h) => [path.join(h, '.gemini')] },
  { id: 'grok', label: 'Grok CLI / Grok Build', roots: (h) => [path.join(h, '.grok')] },
  { id: 'cursor', label: 'Cursor', roots: (h) => [path.join(h, '.cursor'), path.join(h, 'AppData', 'Roaming', 'Cursor', 'User')] },
  { id: 'hoot', label: 'HOOT kernel', roots: (_h, hootRoot) => hootRoot ? [path.join(hootRoot, 'state'), path.join(hootRoot, 'logs')] : [] },
];

function countJsonlShallow(root, { maxFiles = 200, maxDepth = 4 } = {}) {
  let files = 0;
  let tokensProbe = 0;
  let newest = 0;
  const start = Date.now();
  function walk(dir, depth) {
    if (files >= maxFiles || Date.now() - start > 8000 || depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (files >= maxFiles) break;
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      const full = path.join(dir, ent.name);
      try {
        if (ent.isDirectory()) walk(full, depth + 1);
        else if (ent.isFile() && /\.(jsonl?|ndjson)$/i.test(ent.name)) {
          files += 1;
          try {
            const st = fs.statSync(full);
            if (st.mtimeMs > newest) newest = st.mtimeMs;
            // Sample first 30 lines for token fields
            const sample = fs.readFileSync(full, 'utf8').split(/\r?\n/).slice(0, 40);
            for (const line of sample) {
              if (!line) continue;
              try {
                const fields = extractTokenFields(JSON.parse(line));
                if (fields) tokensProbe += fields.total;
              } catch { /* skip */ }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }
  if (root && fs.existsSync(root)) walk(root, 0);
  return { files, tokens_probe: tokensProbe, newest_mtime: newest || null };
}

/**
 * Discover local AI usage log roots across the machine (read-only).
 */
function discoverLedgerSources({ homeDir, hootRoot } = {}) {
  const home = homeDir || process.env.HOME || process.env.USERPROFILE || '';
  const sources = [];
  for (const spec of LEDGER_SOURCE_SPECS) {
    const roots = (spec.roots(home, hootRoot) || []).filter((p) => p && fs.existsSync(p));
    if (!roots.length) {
      sources.push({
        id: spec.id,
        label: spec.label,
        present: false,
        roots: [],
        files: 0,
        tokens_probe: 0,
        newest_mtime: null,
      });
      continue;
    }
    let files = 0;
    let tokensProbe = 0;
    let newest = 0;
    for (const root of roots) {
      const c = countJsonlShallow(root);
      files += c.files;
      tokensProbe += c.tokens_probe;
      if (c.newest_mtime && c.newest_mtime > newest) newest = c.newest_mtime;
    }
    sources.push({
      id: spec.id,
      label: spec.label,
      present: true,
      roots,
      files,
      tokens_probe: tokensProbe,
      newest_mtime: newest || null,
      enabled_default: files > 0 || spec.id === 'codex' || spec.id === 'hoot',
    });
  }
  const defaults = discoverDefaultPaths(home);
  return {
    schema: 'hoot.ledger_discover.v1',
    discovered_at: new Date().toISOString(),
    home,
    sources,
    csv: {
      claude_csv: defaults.claude_csv,
      chatgpt_csv: defaults.chatgpt_csv,
    },
    summary: {
      sources_present: sources.filter((s) => s.present).length,
      files: sources.reduce((n, s) => n + s.files, 0),
      tokens_probe: sources.reduce((n, s) => n + s.tokens_probe, 0),
    },
  };
}

/**
 * Ingest generic JSONL token events from multi-source roots into codex-shaped day map
 * (shared total_tokens lane tagged via sessions label).
 */
function ingestMultiSourceRoots(sourceRoots, opts = {}) {
  // sourceRoots: [{ id, roots: string[] }]
  const allRoots = [];
  const sourceByRoot = new Map();
  for (const s of sourceRoots || []) {
    for (const r of s.roots || []) {
      const exp = expandHome(r);
      allRoots.push(exp);
      sourceByRoot.set(path.normalize(exp), s.id);
    }
  }
  const result = ingestCodexRoots(allRoots, opts);
  // Tag sessions with source id when path matches
  for (const sess of result.sessions || []) {
    if (!sess.file) continue;
    let src = 'unknown';
    const fileNorm = path.normalize(sess.file);
    for (const [root, id] of sourceByRoot) {
      if (fileNorm.startsWith(root)) { src = id; break; }
    }
    sess.source = src;
  }
  return result;
}

function updateConfig(configFile, patch) {
  const current = loadConfig(configFile);
  const next = { ...current, ...patch, version: 1 };
  saveConfig(configFile, next);
  return next;
}

module.exports = {
  buildTokenLedger,
  ingestCodexRoots,
  ingestClaudeCsv,
  ingestChatGptCsv,
  mergeDayMaps,
  buildScale,
  buildKeyMoments,
  buildWorkBreakdown,
  buildEquivalents,
  importTokenBurnData,
  loadConfig,
  saveConfig,
  updateConfig,
  discoverDefaultPaths,
  discoverLedgerSources,
  ingestMultiSourceRoots,
  classifySession,
  FERMI_ASSUMPTIONS,
  WORK_FAMILY_RULES,
  LEDGER_SOURCE_SPECS,
};
