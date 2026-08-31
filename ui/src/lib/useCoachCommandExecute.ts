import { useCallback } from "react";
import { coachConfirmLevel } from "@/lib/coach-command-policy";
import { useExecutiveControlOptional } from "@/context/ExecutiveControlContext";

type EmitAction = (target: string) => void;

type CoachExecuteOptions = {
  onStatus?: (msg: string | null) => void;
};

/**
 * Coach command entry: auto-run safe commands; soft/hard open HITL approval sheet.
 * Falls back to no-op if ExecutiveControlProvider is missing.
 */
export function useCoachCommandExecute(emitCoachAction?: EmitAction, options?: CoachExecuteOptions) {
  const executive = useExecutiveControlOptional();

  return useCallback(
    async (cmd: Record<string, unknown>) => {
      if (!executive) {
        options?.onStatus?.("Executive control unavailable");
        return;
      }
      const level = coachConfirmLevel(cmd);
      if (level === "auto") {
        options?.onStatus?.(`HOOT running ${String(cmd.type || "action")}…`);
        const ok = await executive.execute(cmd);
        options?.onStatus?.(ok ? null : "Command failed");
        return;
      }
      // HITL: enqueue + open unified approval sheet (no window.confirm)
      executive.enqueue([cmd], "coach");
      executive.openApproval(cmd);
      options?.onStatus?.("Waiting for approval…");
    },
    [executive, options, emitCoachAction],
  );
}
