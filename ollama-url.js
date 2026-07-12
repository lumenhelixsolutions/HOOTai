/**
 * Normalize Ollama base URLs for client fetch calls.
 * OLLAMA_HOST is often set to a bind address (0.0.0.0) — not valid for outbound HTTP.
 */

const DEFAULT_OLLAMA_BASE = 'http://127.0.0.1:11434';

function resolveOllamaBaseUrl(input) {
  let raw = String(input ?? '').trim();
  if (!raw) return DEFAULT_OLLAMA_BASE;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname === '0.0.0.0') url.hostname = '127.0.0.1';
      return url.origin.replace(/\/$/, '');
    } catch {
      return DEFAULT_OLLAMA_BASE;
    }
  }

  if (raw.includes(':') && !raw.includes('://')) {
    const idx = raw.lastIndexOf(':');
    const host = raw.slice(0, idx);
    const port = raw.slice(idx + 1) || '11434';
    const resolvedHost = host === '0.0.0.0' ? '127.0.0.1' : host;
    return `http://${resolvedHost}:${port}`.replace(/\/$/, '');
  }

  const host = raw === '0.0.0.0' ? '127.0.0.1' : raw;
  return `http://${host}:11434`.replace(/\/$/, '');
}

module.exports = {
  DEFAULT_OLLAMA_BASE,
  resolveOllamaBaseUrl,
};