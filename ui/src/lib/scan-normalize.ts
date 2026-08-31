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

/** Parse `ollama list` table into installed model names. */
export function parseOllamaListRaw(raw: unknown): string[] {
  const names: string[] = [];
  if (!raw) return names;
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^NAME\s+/i.test(trimmed)) continue;
    const name = trimmed.split(/\s+/)[0];
    if (name) names.push(name);
  }
  return names;
}

export function normalizeLoadedModels(scan: any): Array<Record<string, unknown>> {
  const raw = scan?.ollama?.loaded_models;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "name" in raw) return [raw];
  return parseOllamaPsRaw(scan?.ollama?.ps_raw);
}

/**
 * Coerce PowerShell-JSON arrays: real arrays, single objects, or numeric-key maps.
 * Empty object `{}` (common PS empty-array artifact) becomes `[]`.
 */
export function asScanArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return [];
  if (keys.every((k) => /^\d+$/.test(k))) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => obj[k] as T);
  }
  // Single hashtable serialized without array wrapper
  return [value as T];
}

/** Primary GPU display name from scan (`hardware.gpu[]`, not top-level `gpu`). */
export function getPrimaryGpuName(scan: any): string | undefined {
  const gpus = asScanArray<{ name?: string }>(scan?.hardware?.gpu ?? scan?.gpu);
  const name = gpus.find((g) => g?.name)?.name;
  return name ? String(name).trim() : undefined;
}

export function getLocalBackend(scan: any, id: string): Record<string, unknown> | undefined {
  const backends = asScanArray<Record<string, unknown>>(scan?.local_models?.backends);
  return backends.find((b) => b?.id === id);
}
