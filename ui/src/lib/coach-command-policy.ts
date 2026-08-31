export type CoachConfirmLevel = "auto" | "soft" | "hard";

/** Runtime-changing actions — always human-in-the-loop. */
const HARD = new Set([
  "launch",
  "launchProfile",
  "setMemory",
  "appendMemory",
  "switchProject",
  "setProviderStatus",
  "generateHandoff",
  "coachAction",
]);

/** Noticeable side effects — confirm, then run. */
const SOFT = new Set([
  "runScan",
  "generatePlan",
  "makePlan",
  "navigate",
  "getStatus",
]);

export function coachConfirmLevel(cmd: Record<string, unknown>): CoachConfirmLevel {
  const type = String(cmd.type || "");
  if (HARD.has(type)) return "hard";
  if (SOFT.has(type)) return "soft";
  return "auto";
}

export function coachCommandLabel(cmd: Record<string, unknown>): string {
  const type = String(cmd.type || "action");
  if (type === "launch" || type === "launchProfile") {
    const id = cmd.profileId || cmd.profile || cmd.id;
    return id ? `Launch profile ${id}` : "Launch profile";
  }
  if (type === "switchProject") return `Switch project to ${cmd.path || cmd.project || "selection"}`;
  if (type === "setMemory" || type === "appendMemory") return "Write to memory.md";
  if (type === "runScan") return "Run system scan";
  if (type === "makePlan" || type === "generatePlan") return "Generate launch plan";
  if (type === "navigate") return `Navigate to ${cmd.route || cmd.path || "/"}`;
  if (type === "coachAction") return `UI action: ${cmd.target || "action"}`;
  if (type === "setProviderStatus") return `Cooldown ${cmd.provider || "provider"}`;
  if (type === "generateHandoff") return "Generate handoff packet";
  if (type === "getStatus") return "Refresh status";
  if (type === "showMessage") return String(cmd.text || "Show message");
  if (type === "openUrl") return `Open ${cmd.url || "link"}`;
  return type;
}

export function coachConfirmMessage(cmd: Record<string, unknown>, level: CoachConfirmLevel): string {
  const label = coachCommandLabel(cmd);
  if (level === "hard") return `H00T executive action: ${label}. This changes command-center state. Approve?`;
  if (level === "soft") return `H00T proposes: ${label}. Approve to execute?`;
  return label;
}