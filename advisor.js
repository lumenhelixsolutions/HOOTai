/**
 * HOOT Operations Advisor
 * Multi-provider AI assistant: Gemini, OpenAI, and custom OpenAI-compatible endpoints.
 * Falls back to rule-based intelligence when no API key or on error.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ADVISOR_LOG = path.join(ROOT, 'logs', 'advisor.log');
const { mediatedLlmCall } = require('./core/mediated');
const { AccessDeniedException } = require('./core/errors');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function nowStamp() { return new Date().toISOString(); }
function logAdvisor(msg) {
  const line = `[${nowStamp()}] ${msg}\n`;
  fs.appendFileSync(ADVISOR_LOG, line, 'utf8');
}

function getApiKey() {
  try {
    const { getVaultKey } = require('./key-vault');
    return getVaultKey('GEMINI_API_KEY') || getVaultKey('GOOGLE_API_KEY')
      || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  } catch {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  }
}

/* ── Generic HTTP(S) JSON POST ── */
function postJSON(endpointUrl, headers, body, timeoutMs = 30000) {
  const url = new URL(endpointUrl);
  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout: timeoutMs,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

/* ── Gemini ── */
async function geminiChat(contents, model = 'gemini-2.0-flash', apiKey) {
  const key = apiKey || getApiKey();
  if (!key) throw new Error('No GEMINI_API_KEY or GOOGLE_API_KEY');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = JSON.stringify({ contents, generationConfig: { temperature: 0.3, maxOutputTokens: 4096 } });
  const json = await postJSON(endpoint, {}, body);
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/* ── OpenAI ── */
async function openaiChat(messages, model = 'gpt-4o-mini', apiKey) {
  const key = apiKey || process.env.OPENAI_API_KEY || null;
  if (!key) throw new Error('No OPENAI_API_KEY');
  const body = JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 4096 });
  const json = await postJSON('https://api.openai.com/v1/chat/completions', { 'Authorization': `Bearer ${key}` }, body);
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.choices?.[0]?.message?.content || '';
}

/* ── Custom OpenAI-compatible endpoint ── */
async function customChat(endpoint, apiKey, model, messages) {
  if (!endpoint) throw new Error('No custom endpoint URL');
  const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
  const body = JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 4096 });
  const json = await postJSON(endpoint, headers, body);
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';
}

/* ── Ollama (local OpenAI-compatible) ── */
function ollamaEndpointUrl(endpoint) {
  const base = String(endpoint || 'http://127.0.0.1:11434').replace(/\/$/, '');
  return base.endsWith('/v1/chat/completions') ? base : `${base}/v1/chat/completions`;
}

async function ollamaChatCompletion(endpoint, model, messages, options = {}) {
  if (!endpoint) throw new Error('No Ollama endpoint');
  const payload = {
    model: model || 'llama3.2:3b',
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 4096,
    stream: false,
  };
  if (options.tools?.length) {
    payload.tools = options.tools;
    payload.tool_choice = options.tool_choice || 'auto';
  }
  const body = JSON.stringify(payload);
  const json = await postJSON(ollamaEndpointUrl(endpoint), {}, body, 120000);
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  const choice = json.choices?.[0];
  return {
    content: choice?.message?.content || '',
    message: choice?.message || { role: 'assistant', content: '' },
    tool_calls: choice?.message?.tool_calls || [],
    raw: json,
  };
}

async function ollamaChat(endpoint, model, messages) {
  const res = await ollamaChatCompletion(endpoint, model, messages);
  return res.content || '';
}

/* ── llama.cpp server (OpenAI-compatible) ── */
async function llamacppChat(endpoint, model, messages) {
  return customChat(endpoint, null, model || 'default', messages);
}

/* ── Provider dispatcher ── */
async function providerChat({ provider, model, apiKey, customEndpoint, contents, messages }) {
  switch (provider) {
    case 'gemini':
      return geminiChat(contents, model || 'gemini-2.0-flash', apiKey);
    case 'openai':
      return openaiChat(messages, model || 'gpt-4o-mini', apiKey);
    case 'ollama':
      return ollamaChat(customEndpoint, model, messages);
    case 'llamacpp':
      return llamacppChat(customEndpoint, model, messages);
    case 'lmstudio':
    case 'lm-studio':
      return customChat(customEndpoint, null, model || 'local-model', messages);
    case 'custom':
      return customChat(customEndpoint, apiKey, model || 'default', messages);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/* ── Content conversion helpers ── */
function toGeminiContents(chatMessages) {
  // chatMessages: [{role:'system'|'user'|'model'|'assistant', text}]
  const contents = [];
  let systemText = '';
  const history = [];
  for (const m of chatMessages) {
    if (m.role === 'system') { systemText += m.text + '\n'; continue; }
    const role = m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
    history.push({ role, text: m.text });
  }
  if (systemText) {
    contents.push({ role: 'user', parts: [{ text: systemText + '\n---\nConversation history:\n' + history.map(m => `${m.role}: ${m.text}`).join('\n') }] });
  } else {
    for (const m of history) contents.push({ role: m.role, parts: [{ text: m.text }] });
  }
  return contents;
}

function toOpenAIMessages(chatMessages) {
  const out = [];
  for (const m of chatMessages) {
    if (m.role === 'system') out.push({ role: 'system', content: m.text });
    else if (m.role === 'user') out.push({ role: 'user', content: m.text });
    else out.push({ role: 'assistant', content: m.text });
  }
  return out;
}

function buildSystemContext(scan, project, profiles, sessions) {
  const localBackends = (scan?.local_models?.backends || []).filter(b => b.present);
  const ctx = {
    timestamp: nowStamp(),
    system: scan?.system || {},
    hardware: scan?.hardware || {},
    activeProject: project || null,
    installedAgents: (scan?.coders || []).filter(c => c.detection?.present).map(c => c.id),
    missingAgents: (scan?.coders || []).filter(c => !c.detection?.present).map(c => c.id),
    envKeys: Object.entries(scan?.env || {}).filter(([_, v]) => v?.present).map(([k]) => k),
    ollamaLoaded: scan?.ollama?.loaded_models || [],
    ollamaPresent: scan?.tools?.ollama?.present || false,
    localBackends: localBackends.map(b => ({ id: b.id, name: b.name, modelCount: b.model_count })),
    discoveredGgufs: (scan?.local_models?.discovered_ggufs || []).map(g => g.name),
    activeSessions: (sessions || []).map(s => ({ id: s.id, profile: s.profileId, status: s.status })),
  };
  return ctx;
}

function ruleBasedAdvice(ctx, question) {
  const lines = [];
  const { activeProject, installedAgents, missingAgents, envKeys, ollamaLoaded, ollamaPresent } = ctx;

  lines.push('=== HOOT Operations Report ===');
  lines.push('');

  const hw = ctx.hardware || {};
  const gpu = (hw.gpu || [])[0] || {};
  lines.push(`💻 System: ${hw.cpu || 'unknown'} | ${hw.ram_gb || '?'} GB RAM | ${gpu.name || 'no GPU detected'}`);
  lines.push('');

  if (activeProject) {
    lines.push(`📁 Active Project: ${activeProject.name} (${activeProject.type})`);
    if (!activeProject.hasGit) {
      lines.push('   ⚠️  NO GIT REPO — Run: git init && git add -A && git commit -m "init"');
      lines.push('   🔗 Then create a GitHub repo and: git remote add origin <url> && git push -u origin main');
    } else if (!activeProject.git?.hasRemote) {
      lines.push('   ⚠️  NO UPSTREAM REMOTE — Your work is only on this machine.');
      lines.push('   🔗 Create GitHub repo, then: git remote add origin <url> && git push -u origin main');
    } else if (!activeProject.git?.clean) {
      lines.push(`   📦 ${activeProject.git.uncommitted} uncommitted changes — git status to review`);
    } else {
      lines.push('   ✅ Git clean, remote connected');
    }
    lines.push('');
  } else {
    lines.push('📁 No active project selected. Choose one from the dropdown above.');
    lines.push('');
  }

  if (ollamaPresent) {
    if (ollamaLoaded.length) {
      lines.push(`🦙 Ollama running with ${ollamaLoaded.length} model(s):`);
      for (const m of ollamaLoaded) lines.push(`   • ${m.name} @ context ${m.context}`);
    } else {
      lines.push('🦙 Ollama is installed but NO MODELS are loaded.');
      lines.push('   💡 Run: ollama pull llama3.1:8b && ollama run llama3.1:8b');
      lines.push('   💡 Or for 64K context: ollama pull llama3.1:8b-instruct-q8_0');
    }
  } else {
    lines.push('🦙 Ollama NOT DETECTED — required for all local/private profiles');
    lines.push('   📥 Download: https://ollama.com/download/windows');
    lines.push('   💡 After install, run: ollama serve');
  }
  const localBackends = ctx.localBackends || [];
  if (localBackends.length) {
    lines.push('🏠 Other Local Backends Detected:');
    for (const b of localBackends) {
      lines.push(`   • ${b.name}${b.modelCount ? ' (' + b.modelCount + ' models)' : ''}`);
    }
  }
  const ggufs = ctx.discoveredGgufs || [];
  if (ggufs.length) {
    lines.push('📦 Discovered .gguf files:');
    for (const g of ggufs.slice(0, 5)) lines.push(`   • ${g}`);
  }
  lines.push('');

  if (installedAgents.length) {
    lines.push(`✅ Installed Agents: ${installedAgents.join(', ')}`);
  } else {
    lines.push('❌ No agent CLIs detected on PATH');
  }
  lines.push('');

  if (missingAgents.length) {
    lines.push('📥 Missing Agents — Install Commands:');
    const catalog = readJSON(path.join(ROOT, 'coders-catalog.json'), { tools: [] });
    for (const agentId of missingAgents) {
      const tool = catalog.tools.find(t => t.id === agentId || t.command === agentId);
      if (tool) {
        const installCmd = tool.install_windows || tool.install_guide || 'See official docs';
        lines.push(`   • ${tool.name}: ${installCmd}`);
        lines.push(`     Docs: ${tool.official}`);
      } else {
        lines.push(`   • ${agentId}: not in catalog`);
      }
    }
    lines.push('');
  }

  const keyMap = {
    'OPENAI_API_KEY': ['codex', 'OpenAI Codex CLI'],
    'ANTHROPIC_API_KEY': ['claude-code', 'Claude Code'],
    'MOONSHOT_API_KEY': ['kimi', 'Kimi CLI'],
    'GEMINI_API_KEY': ['gemini-cli', 'Gemini CLI'],
    'OPENROUTER_API_KEY': ['opencode', 'OpenCode (OpenRouter mode)'],
  };
  const loadedKeys = envKeys.filter(k => keyMap[k]);
  const missingKeyTools = [];
  for (const [key, [toolId, name]] of Object.entries(keyMap)) {
    if (!envKeys.includes(key) && missingAgents.includes(toolId)) {
      missingKeyTools.push({ key, name });
    }
  }

  if (loadedKeys.length) {
    lines.push(`🔑 API Keys Loaded: ${loadedKeys.join(', ')}`);
  }
  if (missingKeyTools.length) {
    lines.push('📝 API Keys Needed:');
    for (const { key, name } of missingKeyTools) {
      lines.push(`   • ${key} → ${name}`);
    }
  }
  lines.push('');

  if (activeProject) {
    lines.push('🎯 Recommended Stacks for this project:');
    if (activeProject.type === 'ue5') {
      lines.push('   Local:  local-safe-audit (private C++ review)');
      lines.push('   Cloud:  cloud-heavy-refactor-claude (Blueprint/C++ refactor)');
      lines.push('   Hybrid: hybrid-bug-hunt-aider (Git-aware bug hunting)');
    } else if (activeProject.type === 'node') {
      lines.push('   Local:  local-safe-audit (keep code private)');
      lines.push('   Cloud:  cloud-patch-test-codex (fast JS/TS fixes)');
      lines.push('   Hybrid: hybrid-code-review-gemini (large file handling)');
    } else if (activeProject.type === 'python') {
      lines.push('   Local:  local-performance (local profiling)');
      lines.push('   Cloud:  cloud-heavy-refactor-claude (big refactors)');
      lines.push('   Hybrid: hybrid-patch-test-aider (Git patch loops)');
    } else {
      lines.push('   Local:  local-safe-audit (start safe & private)');
      lines.push('   Cloud:  cloud-heavy-refactor-claude (powerful cloud work)');
      lines.push('   Hybrid: hybrid-patch-test-opencode (flexible routing)');
    }
    lines.push('');
  }

  lines.push('🔧 Troubleshooting:');
  if (!ollamaPresent) {
    lines.push('   • Ollama missing → Install from https://ollama.com/download/windows');
  } else if (!ollamaLoaded.length) {
    lines.push('   • No models loaded → ollama pull llama3.1:8b');
    lines.push('   • For 64K context → ollama pull llama3.1:8b-instruct-q8_0');
  }
  if (missingAgents.includes('hermes') && ollamaPresent) {
    lines.push('   • Hermes missing → npm install -g @nousresearch/hermes-agent');
  }
  if (installedAgents.includes('claude') && !envKeys.includes('ANTHROPIC_API_KEY')) {
    lines.push('   • Claude installed but no ANTHROPIC_API_KEY → set env var or run claude login');
  }
  lines.push('');

  if (ctx.activeSessions?.length) {
    lines.push(`📊 Active Sessions: ${ctx.activeSessions.length}`);
    for (const s of ctx.activeSessions) lines.push(`   • ${s.profile} — ${s.status}`);
  } else {
    lines.push('📊 No active sessions. Select a profile and click Launch + Monitor.');
  }

  lines.push('');
  lines.push('💡 Tip: Click the 🤖 AI Assistant button bottom-right for interactive help.');

  return { source: 'rule-based', advice: lines.join('\n'), actions: [] };
}

async function advisorAnalyze({
  scan,
  project,
  profiles,
  sessions,
  question,
  useGemini = true,
  provider = 'gemini',
  model,
  apiKey,
  customEndpoint,
  coreClient,
}) {
  logAdvisor(`Analyzing: project=${project?.name || 'none'}, question=${question || 'none'}, provider=${provider}`);
  const ctx = buildSystemContext(scan, project, profiles, sessions);
  const fallback = ruleBasedAdvice(ctx, question);

  const effectiveProvider = provider || 'gemini';
  const hasKey = apiKey || (effectiveProvider === 'gemini' ? getApiKey() : (effectiveProvider === 'openai' ? process.env.OPENAI_API_KEY : !!customEndpoint));

  if (!useGemini || !hasKey) {
    logAdvisor('No API key for provider; returning rule-based advice.');
    return { ...fallback, geminiAvailable: false, provider: effectiveProvider };
  }

  try {
    const systemPrompt = `You are HOOT Operations Advisor (My Ops OWL), a proactive local AI command center. You help users orchestrate coding agents on their machine. Be concise, actionable, and technically specific.`;
    const userPrompt = `System State:\n${JSON.stringify(ctx, null, 2)}\n\nUser Question: ${question || 'What should I do next? Give me proactive recommendations.'}`;

    let text = '';
    if (effectiveProvider === 'gemini') {
      const contents = [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }];
      const res = await mediatedLlmCall({
        client: coreClient,
        projectRef: project,
        provider: 'gemini',
        model: model || 'gemini-2.0-flash',
        apiKey,
        contents,
        prompt: userPrompt,
        tags: ['advisor'],
        source: 'advisor',
      });
      if (res.blocked) {
        logAdvisor(`Budget blocked: ${res.meta?.reason || 'hard-stop'}`);
        return {
          ...fallback,
          geminiAvailable: true,
          geminiError: res.meta?.reason || 'Budget hard-stop',
          provider: effectiveProvider,
          coreBlocked: true,
        };
      }
      text = res.text;
    } else {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];
      const res = await mediatedLlmCall({
        client: coreClient,
        projectRef: project,
        provider: effectiveProvider,
        model,
        apiKey,
        endpoint: customEndpoint,
        messages,
        prompt: userPrompt,
        tags: ['advisor'],
        source: 'advisor',
      });
      if (res.blocked) {
        logAdvisor(`Budget blocked: ${res.meta?.reason || 'hard-stop'}`);
        return {
          ...fallback,
          geminiAvailable: true,
          geminiError: res.meta?.reason || 'Budget hard-stop',
          provider: effectiveProvider,
          coreBlocked: true,
        };
      }
      text = res.text;
    }

    logAdvisor('AI response received.');
    return { source: effectiveProvider, advice: text, fallback: fallback.advice, geminiAvailable: true, provider: effectiveProvider };
  } catch (e) {
    logAdvisor(`AI error: ${e.message}`);
    const blocked = e instanceof AccessDeniedException;
    return {
      ...fallback,
      geminiAvailable: true,
      geminiError: e.message,
      provider: effectiveProvider,
      coreBlocked: blocked,
    };
  }
}

module.exports = {
  advisorAnalyze,
  geminiChat,
  openaiChat,
  customChat,
  ollamaChat,
  ollamaChatCompletion,
  ollamaEndpointUrl,
  llamacppChat,
  providerChat,
  toGeminiContents,
  toOpenAIMessages,
  getApiKey,
  buildSystemContext,
  postJSON,
};
