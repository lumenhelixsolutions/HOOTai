const { describe, it } = require('node:test');
const assert = require('node:assert');
const { resolveOllamaBaseUrl, DEFAULT_OLLAMA_BASE } = require('../ollama-url');

describe('ollama-url', () => {
  it('defaults when empty', () => {
    assert.strictEqual(resolveOllamaBaseUrl(), DEFAULT_OLLAMA_BASE);
    assert.strictEqual(resolveOllamaBaseUrl(''), DEFAULT_OLLAMA_BASE);
  });

  it('maps bare 0.0.0.0 to localhost', () => {
    assert.strictEqual(resolveOllamaBaseUrl('0.0.0.0'), 'http://127.0.0.1:11434');
  });

  it('maps 0.0.0.0:port to localhost', () => {
    assert.strictEqual(resolveOllamaBaseUrl('0.0.0.0:11434'), 'http://127.0.0.1:11434');
  });

  it('maps http://0.0.0.0:11434 to localhost', () => {
    assert.strictEqual(resolveOllamaBaseUrl('http://0.0.0.0:11434'), 'http://127.0.0.1:11434');
  });

  it('preserves valid full URLs', () => {
    assert.strictEqual(resolveOllamaBaseUrl('http://127.0.0.1:11434'), 'http://127.0.0.1:11434');
    assert.strictEqual(resolveOllamaBaseUrl('http://192.168.1.10:11434/'), 'http://192.168.1.10:11434');
  });

  it('adds scheme to host:port', () => {
    assert.strictEqual(resolveOllamaBaseUrl('127.0.0.1:11434'), 'http://127.0.0.1:11434');
  });
});