/**
 * C.O.R.E. — HOOT-mediated LLM calls (Coach, Advisor, /api/core/query).
 */

const path = require('path');
const { AccessDeniedException } = require('./errors');
const { resolveCoreClient } = require('./bridge');
const { resolveCoreDir } = require('./storage');
const {
  evaluateBudgetNotifications,
  notifyBudgetHardStop,
} = require('./notifications');
const { refreshPricing, isStale } = require('./pricing-fetch');
const { loadPricing } = require('./pricing');

const PROVIDER_MAP = {
  gemini: 'gemini',
  openai: 'openai',
  anthropic: 'anthropic',
  claude: 'anthropic',
  ollama: 'ollama',
  llamacpp: 'ollama',
  local: 'ollama',
  custom: 'ollama',
};

function resolveProjectId(projectRef) {
  if (!projectRef) return 'default';
  if (typeof projectRef === 'string') {
    if (projectRef.includes(path.sep)) return path.basename(projectRef) || projectRef;
    return projectRef;
  }
  if (projectRef.path) return path.basename(projectRef.path) || projectRef.path;
  if (projectRef.name) return projectRef.name;
  return 'default';
}

function mapProvider(provider) {
  const key = String(provider || 'gemini').toLowerCase();
  return PROVIDER_MAP[key] || key;
}

const LOCAL_PROVIDERS = new Set(['ollama', 'llamacpp', 'lmstudio', 'lm-studio', 'local', 'custom']);

function isLocalMappedProvider(provider) {
  const key = String(provider || '').toLowerCase();
  return LOCAL_PROVIDERS.has(key) || LOCAL_PROVIDERS.has(mapProvider(key));
}

/**
 * Refresh OpenRouter pricing when stale. Local brains skip network by default so
 * chat never blocks on openrouter.ai (OOTBIJS: local golden path must work offline).
 */
async function ensureFreshPricing(client, { skipNetwork = false, timeoutMs = 2500 } = {}) {
  const coreDir = client.coreDir || resolveCoreDir();
  const pricing = loadPricing(coreDir);
  if (skipNetwork || !isStale(pricing)) return pricing;
  try {
    const result = await Promise.race([
      refreshPricing(coreDir),
      new Promise((_, reject) => setTimeout(() => reject(new Error('pricing refresh timeout')), timeoutMs)),
    ]);
    if (result?.pricing) client.gateway.pricing = result.pricing;
    return result?.pricing || pricing;
  } catch {
    return pricing;
  }
}

/**
 * Route a mediated LLM call through C.O.R.E. pipeline.
 */
async function mediatedLlmCall({
  client,
  prompt,
  projectRef,
  provider,
  model,
  apiKey,
  endpoint,
  messages,
  contents,
  tags = [],
  source = 'mediated',
  cache = true,
  compress = true,
  budget = true,
  temperature,
  max_tokens,
  tools,
  tool_choice,
} = {}) {
  const coreClient = resolveCoreClient(client);
  const projectId = resolveProjectId(projectRef);
  const mappedProvider = mapProvider(provider);

  await ensureFreshPricing(coreClient, { skipNetwork: isLocalMappedProvider(provider) || isLocalMappedProvider(mappedProvider) });

  const modelConfig = {
    provider: mappedProvider,
    model,
    api_key: apiKey,
    endpoint,
    customEndpoint: endpoint,
    messages,
    contents,
    temperature,
    max_tokens,
    tools,
    tool_choice,
    tags: [...tags, source, 'mediated'],
    cache,
    budget,
    compress,
  };

  try {
    const result = await coreClient.query({
      prompt: prompt || messages?.[messages.length - 1]?.content || '',
      project_id: projectId,
      model_config: modelConfig,
      tags: modelConfig.tags,
    });

    const coreDir = coreClient.coreDir;
    evaluateBudgetNotifications(coreDir, projectId, { pricing: coreClient.getPricing() });

    return {
      text: result.text,
      usage: result.usage,
      meta: result.meta,
      project_id: projectId,
      blocked: false,
    };
  } catch (err) {
    if (err instanceof AccessDeniedException) {
      notifyBudgetHardStop(coreClient.coreDir, err, { source });
      return {
        text: '',
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        meta: { blocked: true, reason: err.message, details: err.details },
        project_id: projectId,
        blocked: true,
        error: err,
      };
    }
    throw err;
  }
}

async function mediatedRawCall(params = {}) {
  const coreClient = resolveCoreClient(params.client);
  const projectId = resolveProjectId(params.projectRef);
  const mappedProvider = mapProvider(params.provider);

  await ensureFreshPricing(coreClient, {
    skipNetwork: isLocalMappedProvider(params.provider) || isLocalMappedProvider(mappedProvider),
  });

  try {
    const response = await coreClient.gateway.execute(
      params.prompt || params.messages?.[params.messages.length - 1]?.content || '',
      projectId,
      {
        provider: mappedProvider,
        model: params.model,
        api_key: params.apiKey,
        endpoint: params.endpoint,
        customEndpoint: params.endpoint,
        messages: params.messages,
        contents: params.contents,
        tools: params.tools,
        tool_choice: params.tool_choice,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        tags: [...(params.tags || []), params.source || 'mediated', 'mediated'],
        cache: params.cache === true,
        budget: params.budget !== false,
        compress: params.compress !== false,
      },
    );

    evaluateBudgetNotifications(coreClient.coreDir, projectId, { pricing: coreClient.getPricing() });

    return {
      ...response,
      project_id: projectId,
      blocked: false,
    };
  } catch (err) {
    if (err instanceof AccessDeniedException) {
      notifyBudgetHardStop(coreClient.coreDir, err, { source: params.source || 'mediated' });
      return {
        text: '',
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        tool_calls: [],
        message: { role: 'assistant', content: '' },
        blocked: true,
        error: err,
        project_id: projectId,
      };
    }
    throw err;
  }
}

module.exports = {
  resolveProjectId,
  mapProvider,
  isLocalMappedProvider,
  mediatedLlmCall,
  mediatedRawCall,
  ensureFreshPricing,
};