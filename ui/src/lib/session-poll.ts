/** Portfolio / intelligence views refresh on this cadence while the tab is open. */
export const SESSION_POLL_MS = 30 * 60 * 1000;

export function isPageVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export const SESSION_REFRESH_EVENT = "hoot:session-refresh";

export function dispatchSessionRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_REFRESH_EVENT));
}