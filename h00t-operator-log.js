/**
 * HOOT operator audit log — tool calls, blocked attempts, native loop rounds.
 */

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 500;

function readLog(logPath) {
  try {
    const raw = fs.readFileSync(logPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.entries) ? data : { version: 1, entries: [] };
  } catch {
    return { version: 1, entries: [] };
  }
}

function appendOperatorLog(logPath, entry) {
  const log = readLog(logPath);
  const row = {
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  log.entries.unshift(row);
  if (log.entries.length > MAX_ENTRIES) log.entries.length = MAX_ENTRIES;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
  return row;
}

function listOperatorLog(logPath, limit = 50) {
  const log = readLog(logPath);
  return log.entries.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

module.exports = { appendOperatorLog, listOperatorLog, readLog, MAX_ENTRIES };