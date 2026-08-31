const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  operatorLaunchOk,
  isBlockedCommand,
  normalizeType,
  executeCoachCommand,
  formatEvidenceBlock,
} = require('../coach-operator');
const { resolveHootBrain, parseOllamaListRaw, bestLoadedOperatorModel } = require('../h00t-brain');
const { resolveProviderKey, isLocalProvider } = require('../key-vault');

describe('coach-operator policy', () => {
  it('operatorLaunchOk allows safe-audit and read-only profiles', () => {
    assert.strictEqual(operatorLaunchOk({ id: 'local-safe-audit', meta: { task_mode: 'read-only' } }), true);
    assert.strictEqual(operatorLaunchOk({ id: 'local-security-audit', meta: { task_mode: 'safe-audit' } }), true);
  });

  it('operatorLaunchOk blocks coding and refactor profiles', () => {
    assert.strictEqual(operatorLaunchOk({ id: 'local-heavy-refactor', meta: { task_mode: 'refactor' } }), false);
    assert.strictEqual(operatorLaunchOk({ id: 'local-code-assist', meta: { task_mode: 'coding' } }), false);
    assert.strictEqual(operatorLaunchOk({ id: 'local-heavy-refactor-deepseek-16b', meta: { task_mode: 'heavy-refactor' } }), false);
  });

  it('blocks shell and write commands', () => {
    assert.strictEqual(isBlockedCommand({ type: 'shell' }), true);
    assert.strictEqual(isBlockedCommand({ type: 'writeFile' }), true);
    assert.strictEqual(isBlockedCommand({ type: 'exec' }), true);
    assert.strictEqual(isBlockedCommand({ type: 'navigate' }), false);
    assert.strictEqual(isBlockedCommand({ type: 'runScan' }), false);
  });

  it('normalizes legacy command aliases', () => {
    assert.strictEqual(normalizeType({ type: 'launch' }), 'launchProfile');
    assert.strictEqual(normalizeType({ type: 'generatePlan' }), 'makePlan');
    assert.strictEqual(normalizeType({ type: 'setMemory' }), 'appendMemory');
  });

  it('formatEvidenceBlock builds structured memory entry', () => {
    const block = formatEvidenceBlock({ title: 'Test blocker', kind: 'blocker', observed: 'Ollama missing' });
    assert.strictEqual(block.status, 'blocker');
    assert.ok(block.reason.includes('HOOT operator'));
  });
});

describe('coach-operator execution', () => {
  const memory = [];
  const deps = {
    lastScan: { tools: { ollama: { present: true } } },
    activeProject: 'D:\\projects\\demo',
    sessions: new Map(),
    readMemory: () => '# Memory\n',
    appendMemory: (entry) => memory.push(entry),
    setActiveProject: (p) => ({ active: p, projects: [] }),
    buildPlan: (goal) => ({ goal, recommended: [] }),
    listProfiles: () => [
      { id: 'local-safe-audit', name: 'Safe Audit', meta: { task_mode: 'read-only' }, body: '```powershell launch\necho hi\n```' },
      { id: 'local-heavy-refactor', name: 'Heavy', meta: { task_mode: 'refactor' }, body: '```powershell launch\necho hi\n```' },
    ],
    getProfile: (id) => deps.listProfiles().find((p) => p.id === id),
    evaluateProfile: () => ({ state: 'READY', score: 90 }),
    auditProfile: () => ({ warnings: [], errors: [] }),
    extractLaunchScript: (body) => (/```powershell launch\n([\s\S]*?)```/.exec(body)?.[1] || null),
    injectLaunchContext: (s) => s,
    isBlockedByMemory: () => null,
    createSession: (profile, script) => ({ id: 's-test', profileId: profile.id, profileName: profile.name, status: 'running', output: '' }),
    publicSession: (s) => s,
    runScanner: async () => ({ tools: { ollama: { present: true } } }),
    getPrefabInventory: async () => ({ version: 1 }),
    activityToday: () => ({ date: '2026-06-10', events: 0 }),
  };

  it('navigate returns route', async () => {
    const res = await executeCoachCommand({ type: 'navigate', route: '/scan' }, deps);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.route, '/scan');
  });

  it('appendMemory appends structured block', async () => {
    memory.length = 0;
    const res = await executeCoachCommand({ type: 'appendMemory', title: 'Note', observed: 'scan ok' }, deps);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(memory.length, 1);
    assert.strictEqual(memory[0].title, 'Note');
  });

  it('launchProfile blocks refactor profiles', async () => {
    const res = await executeCoachCommand({ type: 'launchProfile', profileId: 'local-heavy-refactor' }, deps);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.blocked, true);
  });

  it('launchProfile allows safe-audit when script present', async () => {
    const res = await executeCoachCommand({ type: 'launchProfile', profileId: 'local-safe-audit' }, deps);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.launched, true);
    assert.strictEqual(res.route, '/terminal');
  });

  it('coachAction rejects unknown targets', async () => {
    const res = await executeCoachCommand({ type: 'coachAction', target: 'rm-rf' }, deps);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.blocked, true);
  });

  it('coachAction allows scan-run', async () => {
    const res = await executeCoachCommand({ type: 'coachAction', target: 'scan-run' }, deps);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.target, 'scan-run');
  });

  it('coachAction normalizes stack template alias', async () => {
    const res = await executeCoachCommand({ type: 'coachAction', target: 'stack-template-local-audit' }, deps);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.target, 'template-local-audit');
  });

  it('coachAction allows modules-auto-sync', async () => {
    const res = await executeCoachCommand({ type: 'coachAction', target: 'modules-auto-sync' }, deps);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.target, 'modules-auto-sync');
  });
});

describe('hoot-brain resolver', () => {
  it('parseOllamaListRaw extracts model names', () => {
    const raw = 'NAME ID SIZE\nllama3.2:3b abc 2GB\nqwen2.5:7b def 4GB';
    const models = parseOllamaListRaw(raw);
    assert.deepStrictEqual(models, ['llama3.2:3b', 'qwen2.5:7b']);
  });

  it('bestLoadedOperatorModel prefers gemma then llama3.2', () => {
    const model = bestLoadedOperatorModel({
      ollama: { list_raw: 'NAME\nhermes3:8b\nllama3.2:3b\n' },
    });
    assert.strictEqual(model, 'llama3.2:3b');
    const gemma = bestLoadedOperatorModel({
      ollama: { list_raw: 'NAME\nllama3.2:3b\ngemma4:latest\n' },
    });
    assert.strictEqual(gemma, 'gemma4:latest');
  });

  it('resolveHootBrain picks ollama when present with installed model', () => {
    const brain = resolveHootBrain({
      scan: { tools: { ollama: { present: true } }, ollama: { list_raw: 'NAME\nqwen2.5:7b\n' } },
      settings: { localInference: { ollama: { host: 'http://127.0.0.1:11434' } }, hoot_brain: { mode: 'auto' } },
    });
    assert.strictEqual(brain.provider, 'ollama');
    assert.strictEqual(brain.available, true);
    assert.ok(brain.model);
  });

  it('resolveProviderKey treats ollama as local', () => {
    assert.strictEqual(resolveProviderKey('ollama'), '__local__');
    assert.strictEqual(isLocalProvider('ollama'), true);
  });
});