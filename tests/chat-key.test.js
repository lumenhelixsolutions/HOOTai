const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testVaultPath = path.join(os.tmpdir(), `hoot-chat-key-test-${process.pid}.json`);
process.env.AGENTDOCK_KEY_VAULT_FILE = testVaultPath;

describe('resolveChatApiKey', () => {
  let kv;
  let chat;
  let backup = null;
  const savedGemini = process.env.GEMINI_API_KEY;

  before(() => {
    delete require.cache[require.resolve('../key-vault')];
    delete require.cache[require.resolve('../chat')];
    kv = require('../key-vault');
    chat = require('../chat');
    if (fs.existsSync(kv.VAULT_FILE)) backup = fs.readFileSync(kv.VAULT_FILE, 'utf8');
    if (fs.existsSync(kv.VAULT_FILE)) fs.unlinkSync(kv.VAULT_FILE);
    delete process.env.GEMINI_API_KEY;
  });

  after(() => {
    if (fs.existsSync(kv.VAULT_FILE)) fs.unlinkSync(kv.VAULT_FILE);
    if (backup) fs.writeFileSync(kv.VAULT_FILE, backup, 'utf8');
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    else delete process.env.GEMINI_API_KEY;
  });

  it('returns undefined for local providers', () => {
    assert.strictEqual(chat.resolveChatApiKey({ apiKey: 'stale', effectiveProvider: 'ollama' }), undefined);
    assert.strictEqual(chat.resolveChatApiKey({ apiKey: 'stale', effectiveProvider: 'llamacpp' }), undefined);
  });

  it('prefers vault key over stale client key', () => {
    kv.setVaultKey('GEMINI_API_KEY', 'vault-gemini-key', 'manual', { force: true });
    assert.strictEqual(
      chat.resolveChatApiKey({ apiKey: 'stale-browser-key', effectiveProvider: 'gemini' }),
      'vault-gemini-key',
    );
    kv.deleteVaultKey('GEMINI_API_KEY');
  });

  it('falls back to trimmed client key when vault empty', () => {
    assert.strictEqual(
      chat.resolveChatApiKey({ apiKey: '  client-key-ok12  ', effectiveProvider: 'gemini' }),
      'client-key-ok12',
    );
  });
});