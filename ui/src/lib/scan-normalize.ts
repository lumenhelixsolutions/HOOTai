/** Normalize scan fields that PowerShell JSON may emit as `{}` instead of `[]`. */

export function parseOllamaPsRaw(raw: unknown): Array<Record<string, unknown>> {
  const models: Array<Record<string, unknown>> = [];
  if (!raw) return models;
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^NAME\s+/i.test(trimmed)) continue;
    const m = /^(\S+)\s+(\S+)\s+(.+?)\s+((?:\d+%\/\d+%|\d+%)\s+\S+(?:\/\S+)?)\s+(\d{3,6})\s+(.+)$/.exec(trimmed);
    if (m) {
      models.push({
        name: m[1],
        id: m[2],
        size: m[3].trim(),
        processor: m[4],
        context: Number(m[5]),
        until: m[6],
      });
    } else {
      models.push({ name: trimmed.split(/\s+/)[0], raw: trimmed, context: null });
    }
  }
  return models;
}

export function normalizeLoadedModels(scan: any): Array<Record<string, unknown>> {
  const raw = scan?.ollama?.loaded_models;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "name" in raw) return [raw];
  return parseOllamaPsRaw(scan?.ollama?.ps_raw);
}

export function asScanArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  return [];
}