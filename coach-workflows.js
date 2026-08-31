/**
 * coach-workflows.js — multi-step operator workflows (Season C1).
 * Each step is a coach command; mutations still require HITL Approve.
 */

const WORKFLOWS = [
  {
    id: 'prepare-local-audit',
    title: 'Prepare local audit launch',
    description: 'Scan machine → open Launch → ready Session watch. Mutations need your Approve.',
    tags: ['scan', 'launch', 'safe'],
    steps: [
      {
        id: 'go-scan',
        title: 'Open Readiness',
        command: { type: 'navigate', route: '/scan' },
        bind: 'nav:/scan',
      },
      {
        id: 'run-scan',
        title: 'Propose system scan',
        command: { type: 'runScan' },
        bind: 'action:run-scan',
      },
      {
        id: 'go-launch',
        title: 'Open Launch Center',
        command: { type: 'navigate', route: '/launch' },
        bind: 'nav:/launch',
      },
      {
        id: 'go-session',
        title: 'Open Session monitor',
        command: { type: 'navigate', route: '/terminal' },
        bind: 'nav:/terminal',
      },
    ],
  },
  {
    id: 'brain-health-check',
    title: 'Local brain health check',
    description: 'Vitals overview → re-detect agents → status refresh path.',
    tags: ['brain', 'vitals'],
    steps: [
      {
        id: 'go-vitals',
        title: 'Open Vitals',
        command: { type: 'navigate', route: '/vitals' },
        bind: 'nav:/vitals',
      },
      {
        id: 'status',
        title: 'Fetch operator status',
        command: { type: 'getStatus' },
        bind: 'action:get-status',
      },
      {
        id: 'memory',
        title: 'Read memory (read-only)',
        command: { type: 'readMemory' },
        bind: 'action:read-memory',
      },
    ],
  },
  {
    id: 'trust-review',
    title: 'Trust & spend review',
    description: 'Approvals log → Token Ledger → Activity.',
    tags: ['trust', 'spend'],
    steps: [
      {
        id: 'go-approvals',
        title: 'Open Approvals',
        command: { type: 'navigate', route: '/approvals' },
        bind: 'nav:/approvals',
      },
      {
        id: 'go-burn',
        title: 'Open Token Ledger',
        command: { type: 'navigate', route: '/burn' },
        bind: 'nav:/burn',
      },
      {
        id: 'go-activity',
        title: 'Open Activity',
        command: { type: 'navigate', route: '/activity' },
        bind: 'nav:/activity',
      },
    ],
  },
];

function listWorkflows() {
  return WORKFLOWS.map(({ id, title, description, tags, steps }) => ({
    id,
    title,
    description,
    tags: tags || [],
    stepCount: steps.length,
    steps: steps.map((s) => ({
      id: s.id,
      title: s.title,
      commandType: s.command?.type,
      bind: s.bind || null,
    })),
  }));
}

function getWorkflow(id) {
  return WORKFLOWS.find((w) => w.id === id) || null;
}

/**
 * Expand workflow into executable coach commands (HITL queue payload).
 */
function startWorkflow(id, { source = 'workflow' } = {}) {
  const wf = getWorkflow(id);
  if (!wf) return { ok: false, error: `Unknown workflow: ${id}` };
  const commands = wf.steps.map((s, i) => ({
    ...s.command,
    _workflow: wf.id,
    _stepId: s.id,
    _stepIndex: i,
    _stepTitle: s.title,
    _bind: s.bind || null,
    _source: source,
  }));
  return {
    ok: true,
    workflow: {
      id: wf.id,
      title: wf.title,
      description: wf.description,
      stepCount: commands.length,
    },
    commands,
    binds: wf.steps.map((s) => s.bind).filter(Boolean),
  };
}

module.exports = {
  WORKFLOWS,
  listWorkflows,
  getWorkflow,
  startWorkflow,
};
