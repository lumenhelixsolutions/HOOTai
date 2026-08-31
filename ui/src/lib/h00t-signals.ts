/** Emit reactive HOOT emotion bursts via pageContext */
export function hootSignal(signal: string, ttlMs = 4000) {
  return {
    hootSignal: signal,
    hootSignalAt: Date.now(),
    hootSignalTtl: ttlMs,
  };
}