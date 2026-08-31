export type HootErrorPayload = {
  message: string;
  source: string;
  fix?: string;
};

let reporter: ((err: HootErrorPayload) => void) | null = null;

export function setHootErrorReporter(fn: ((err: HootErrorPayload) => void) | null) {
  reporter = fn;
}

export function hootReportError(err: HootErrorPayload) {
  reporter?.(err);
}

const AUTO_REPORT_PATHS = ["/api/launch/", "/api/chat"];

export function shouldAutoReport(path: string, status: number): boolean {
  if (status < 400) return false;
  return AUTO_REPORT_PATHS.some((p) => path.startsWith(p) || path.includes(p));
}