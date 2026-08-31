/** Node-testable mirror of ui/src/lib/h00t-ascii emotion triggers — keep in sync */

const SIGNAL_EMOTIONS = {
  'module:syncing': { mood: 'syncing', caption: 'Syncing CE skills…', triggerId: 'module:syncing' },
  'module:installing': { mood: 'installing', caption: 'Installing module…', triggerId: 'module:installing' },
  'module:install-fail': { mood: 'error', caption: 'Install failed', triggerId: 'module:install-fail' },
  'module:ready': { mood: 'proud', caption: 'CE pack ready', triggerId: 'module:ready' },
  'launch:blocked': { mood: 'alert', caption: 'Launch blocked', triggerId: 'launch:blocked' },
  'burn:savings': { mood: 'proud', caption: 'RTK saving tokens', triggerId: 'burn:savings' },
  'radar:external': { mood: 'alert', caption: 'Agents outside HOOT', triggerId: 'radar:external' },
};

function activeHootSignal(pc) {
  const signal = pc.hootSignal;
  const at = Number(pc.hootSignalAt) || 0;
  const ttl = Number(pc.hootSignalTtl) || 0;
  if (!signal || !at || !ttl) return null;
  if (Date.now() - at > ttl) return null;
  return signal;
}

function resolveHootEmotion(ctx) {
  const pc = ctx.pageContext || {};
  const path = ctx.pathname;
  const signal = activeHootSignal(pc);
  if (signal && SIGNAL_EMOTIONS[signal]) return SIGNAL_EMOTIONS[signal];
  if (ctx.hasError) return { mood: 'error', caption: 'Something broke', triggerId: 'error' };
  if (Number(pc.agentRadarExternal) > 0) {
    return { mood: 'alert', caption: `${pc.agentRadarExternal} outside HOOT`, triggerId: 'radar:external' };
  }
  if (path === '/modules' && pc.modulesTab === 'agents') {
    return { mood: 'curious', caption: 'Browsing agents', triggerId: 'path:modules-agents' };
  }
  if ((path === '/builder' || path === '/stack') && Number(pc.stackScore) >= 80) {
    return { mood: 'proud', caption: `Stack ${pc.stackScore}%`, triggerId: 'stack:strong' };
  }
  return { mood: 'idle', caption: null, triggerId: 'idle' };
}

function resolveHootMoodFromContext(ctx) {
  return resolveHootEmotion(ctx).mood;
}

module.exports = { activeHootSignal, resolveHootEmotion, resolveHootMoodFromContext };