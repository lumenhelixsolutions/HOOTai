/**
 * C.O.R.E. — Local Ollama adapter (OpenAI-compatible endpoint).
 */

const { BaseProvider } = require('./base');
const { ProviderError } = require('../errors');

function ollamaEndpointUrl(endpoint) {
  const base = String(endpoint || 'http://127.0.0.1:11434').replace(/\/$/, '');
  return base.endsWith('/v1/chat/completions') ? base : `${base}/v1/chat/completions`;
}

class LocalModelAdapter extends BaseProvider {
  constructor({ postJSON, defaultEndpoint } = {}) {
    super('ollama');
    this.postJSON = postJSON;
    this.defaultEndpoint = defaultEndpoint || 'http://127.0.0.1:11434';
  }

  async execute(prompt, projectId, modelConfig = {}) {
    const endpoint = modelConfig.endpoint || modelConfig.customEndpoint || this.defaultEndpoint;
    const model = modelConfig.model || 'llama3.2:3b';
    const messages = modelConfig.messages || [{ role: 'user', content: String(prompt) }];
    const body = JSON.stringify({
      model,
      messages,
      temperature: modelConfig.temperature ?? 0.3,
      max_tokens: modelConfig.max_tokens ?? 4096,
      stream: false,
    });
    const started = Date.now();
    let json;
    try {
      json = await this.postJSON(
        ollamaEndpointUrl(endpoint),
        {},
        body,
        modelConfig.timeout_ms ?? 120000,
      );
    } catch (err) {
      throw new ProviderError(err.message, this.id, err);
    }
    if (json.error) throw new ProviderError(json.error.message || JSON.stringify(json.error), this.id);
    const choice = json.choices?.[0];
    const text = choice?.message?.content || choice?.text || '';
    const usage = this.normalizeUsage(json.usage, { prompt, responseText: text });
    return {
      text,
      usage,
      raw: json,
      message: choice?.message || { role: 'assistant', content: text },
      tool_calls: choice?.message?.tool_calls || [],
      latency_ms: Date.now() - started,
      ttft_ms: Date.now() - started,
      model_id: model,
      provider: this.id,
      project_id: projectId,
    };
  }
}

module.exports = { LocalModelAdapter, ollamaEndpointUrl };