/**
 * Global executive control: HITL queue + approval sheet state.
 * Mutations propose here; nothing runs until Approve on the sheet.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import {
  coachCommandLabel,
  coachConfirmLevel,
  coachConfirmMessage,
  type CoachConfirmLevel,
} from "@/lib/coach-command-policy";
import { useCoach } from "@/context/CoachContext";
import { useToast } from "@/components/Toast";
import { dispatchSessionRefresh } from "@/lib/session-poll";
import { trackMetric } from '@/lib/h00t-metrics';

export type PendingActionStatus = "pending" | "running" | "done" | "denied" | "failed";

export type PendingAction = {
  id: string;
  command: Record<string, unknown>;
  level: CoachConfirmLevel;
  label: string;
  message: string;
  source: string;
  createdAt: number;
  status: PendingActionStatus;
  error?: string;
  bind?: string | null;
};

type ExecutiveControlValue = {
  queue: PendingAction[];
  pendingCount: number;
  /** Command currently in the approval sheet (null = closed) */
  sheetAction: PendingAction | null;
  /** Screen bind target e.g. nav:/scan — for highlight pulse */
  highlightBind: string | null;
  setHighlightBind: (bind: string | null) => void;
  enqueue: (commands: Array<Record<string, unknown>>, source?: string) => PendingAction[];
  openApproval: (commandOrId: Record<string, unknown> | string) => void;
  closeSheet: () => void;
  deny: (id: string) => void;
  approve: (id: string) => Promise<boolean>;
  /** Direct execute (auto-level or after sheet confirm) */
  execute: (cmd: Record<string, unknown>, opts?: { actionId?: string }) => Promise<boolean>;
  clearFinished: () => void;
  /** Season C1 — start multi-step workflow into HITL queue */
  startWorkflow: (workflowId: string) => Promise<boolean>;
};

function bindFromCommand(cmd: Record<string, unknown>): string | null {
  if (cmd._bind) return String(cmd._bind);
  if (cmd.type === "navigate" && cmd.route) return `nav:${cmd.route}`;
  if (cmd.type === "coachAction" && cmd.target) return `action:${cmd.target}`;
  if (cmd.type === "runScan") return "action:run-scan";
  return null;
}

function logHitlClient(payload: Record<string, unknown>) {
  void api.logCoachHitl(payload).catch(() => {});
}

const ExecutiveControlContext = createContext<ExecutiveControlValue | null>(null);

function cmdKey(cmd: Record<string, unknown>) {
  return `${cmd.type || ""}:${cmd.profileId || cmd.id || ""}:${cmd.route || ""}:${cmd.target || ""}:${cmd.path || ""}`;
}

function makeId() {
  return `exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ExecutiveControlProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { emitCoachAction, setHootStatus, setCoachOpen } = useCoach();
  const toast = useToast();
  const [queue, setQueue] = useState<PendingAction[]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [highlightBind, setHighlightBind] = useState<string | null>(null);
  const executingRef = useRef(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseBind = useCallback((bind: string | null) => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightBind(bind);
    if (bind) {
      highlightTimer.current = setTimeout(() => setHighlightBind(null), 6000);
    }
  }, []);

  const sheetAction = useMemo(
    () => (sheetId ? queue.find((a) => a.id === sheetId) || null : null),
    [queue, sheetId],
  );

  const pendingCount = useMemo(
    () => queue.filter((a) => a.status === "pending" || a.status === "running").length,
    [queue],
  );

  const enqueue = useCallback((commands: Array<Record<string, unknown>>, source = 'coach') => {
    const created: PendingAction[] = [];
    setQueue((prev) => {
      const next = [...prev];
      for (const command of commands) {
        if (!command?.type) continue;
        const level = coachConfirmLevel(command);
        // Auto commands don't sit in HITL queue — still can execute via workflow start
        if (level === "auto") continue;
        const key = cmdKey(command);
        const existing = next.find(
          (a) => a.status === "pending" && cmdKey(a.command) === key,
        );
        if (existing) {
          created.push(existing);
          continue;
        }
        const bind = bindFromCommand(command);
        const stepTitle = command._stepTitle ? String(command._stepTitle) : null;
        const action: PendingAction = {
          id: makeId(),
          command: { ...command },
          level,
          label: stepTitle || coachCommandLabel(command),
          message: coachConfirmMessage(command, level),
          source,
          createdAt: Date.now(),
          status: "pending",
          bind,
        };
        next.unshift(action);
        created.push(action);
        logHitlClient({
          type: "propose",
          decision: "proposed",
          source,
          route: command.route,
          target: command.target,
          label: action.label,
          workflow: command._workflow,
          stepId: command._stepId,
          bind,
        });
        trackMetric("propose");
        if (command.type === "runScan") trackMetric("scan_propose");
      }
      return next.slice(0, 40);
    });
    return created;
  }, []);

  const openApproval = useCallback(
    (commandOrId: Record<string, unknown> | string) => {
      if (typeof commandOrId === "string") {
        setSheetId(commandOrId);
        const found = queue.find((a) => a.id === commandOrId);
        if (found?.bind) pulseBind(found.bind);
        return;
      }
      const level = coachConfirmLevel(commandOrId);
      if (level === "auto") {
        void executeRef.current?.(commandOrId);
        return;
      }
      const added = enqueue([commandOrId], "coach");
      const id = added[0]?.id;
      if (id) setSheetId(id);
      const bind = bindFromCommand(commandOrId);
      if (bind) pulseBind(bind);
    },
    [enqueue, pulseBind, queue],
  );

  const closeSheet = useCallback(() => setSheetId(null), []);

  const deny = useCallback((id: string) => {
    const action = queue.find((a) => a.id === id);
    setQueue((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "denied" as const } : a)),
    );
    setSheetId((cur) => (cur === id ? null : cur));
    if (action) {
      logHitlClient({
        type: "deny",
        decision: "denied",
        source: action.source,
        route: action.command.route,
        target: action.command.target,
        label: action.label,
        workflow: action.command._workflow,
        stepId: action.command._stepId,
        bind: action.bind,
      });
      trackMetric("deny");
    }
    setHootStatus("Action denied");
    setTimeout(() => setHootStatus(null), 2000);
  }, [queue, setHootStatus]);

  const execute = useCallback(
    async (cmd: Record<string, unknown>, opts?: { actionId?: string }) => {
      if (executingRef.current) return false;
      executingRef.current = true;
      const actionId = opts?.actionId;
      if (actionId) {
        setQueue((prev) =>
          prev.map((a) => (a.id === actionId ? { ...a, status: "running" as const, error: undefined } : a)),
        );
      }
      const label = coachCommandLabel(cmd);
      setHootStatus(`Executing ${label}…`);
      try {
        const res = await api.coachExecute(cmd);
        const last = res.results?.[res.results.length - 1] as Record<string, unknown> | undefined;
        if (last && last.ok === false) {
          const err = String(last.error || "Command blocked");
          if (actionId) {
            setQueue((prev) =>
              prev.map((a) => (a.id === actionId ? { ...a, status: "failed" as const, error: err } : a)),
            );
          }
          toast.showToast(err, "error");
          setHootStatus(err);
          return false;
        }
        if (res.route) {
          navigate(res.route);
          pulseBind(`nav:${res.route}`);
        }
        if (res.target) {
          emitCoachAction(String(res.target));
          pulseBind(`action:${res.target}`);
        }
        if (res.message) toast.showToast(String(res.message), "success");
        if (res.launched) {
          toast.showToast(
            `Launched ${(res.session as { profileName?: string })?.profileName || "session"}`,
            "success",
          );
          navigate("/terminal");
          pulseBind("nav:/terminal");
        } else if (last?.type === "runScan") {
          toast.showToast("Scan complete", "success");
          navigate("/scan");
          pulseBind("nav:/scan");
          dispatchSessionRefresh();
        } else {
          toast.showToast(`${label} done`, "success");
          const b = bindFromCommand(cmd);
          if (b) pulseBind(b);
        }
        if (actionId) {
          setQueue((prev) =>
            prev.map((a) => (a.id === actionId ? { ...a, status: "done" as const } : a)),
          );
        }
        setSheetId((cur) => (cur === actionId ? null : cur));
        setHootStatus(null);
        trackMetric("approve");
        trackMetric("useful");
        return true;
      } catch (e) {
        const err = e instanceof Error ? e.message : "Execute failed";
        if (actionId) {
          setQueue((prev) =>
            prev.map((a) => (a.id === actionId ? { ...a, status: "failed" as const, error: err } : a)),
          );
        }
        // Soft fallbacks for offline / routing
        switch (cmd.type) {
          case "launch":
          case "launchProfile":
            navigate("/profiles");
            break;
          case "runScan":
            navigate("/scan");
            break;
          case "switchProject":
            navigate("/");
            break;
          case "showMessage":
            toast.showToast(String(cmd.text || ""), "info");
            break;
          case "openUrl":
            window.open(String(cmd.url || ""), "_blank");
            break;
          default:
            toast.showToast(err, "error");
        }
        setHootStatus(err);
        return false;
      } finally {
        executingRef.current = false;
      }
    },
    [emitCoachAction, navigate, pulseBind, setHootStatus, toast],
  );

  const executeRef = useRef(execute);
  executeRef.current = execute;

  const approve = useCallback(
    async (id: string) => {
      const action = queue.find((a) => a.id === id);
      if (!action) return false;
      return execute(action.command, { actionId: id });
    },
    [queue, execute],
  );

  const clearFinished = useCallback(() => {
    setQueue((prev) => prev.filter((a) => a.status === "pending" || a.status === "running"));
  }, []);

  const startWorkflow = useCallback(
    async (workflowId: string) => {
      try {
        const res = await api.startCoachWorkflow(workflowId);
        if (!res.ok || !res.commands?.length) {
          toast.showToast(res.error || "Workflow failed", "error");
          return false;
        }
        const created = enqueue(res.commands, `workflow:${workflowId}`);
        // Auto-run read-only steps (getStatus, readMemory) immediately
        for (const cmd of res.commands) {
          if (coachConfirmLevel(cmd) === "auto") {
            await execute(cmd);
          }
        }
        const firstPending = created.find((a) => a.status === "pending");
        if (firstPending) {
          setSheetId(firstPending.id);
          if (firstPending.bind) pulseBind(firstPending.bind);
        }
        setCoachOpen(true);
        trackMetric("workflow");
        toast.showToast(
          `Workflow: ${res.workflow?.title || workflowId} · ${res.commands.length} steps`,
          "info",
        );
        return true;
      } catch (e) {
        toast.showToast(e instanceof Error ? e.message : "Workflow start failed", "error");
        return false;
      }
    },
    [enqueue, execute, pulseBind, setCoachOpen, toast],
  );

  const value = useMemo<ExecutiveControlValue>(
    () => ({
      queue,
      pendingCount,
      sheetAction,
      highlightBind,
      setHighlightBind: pulseBind,
      enqueue,
      openApproval,
      closeSheet,
      deny,
      approve,
      execute,
      clearFinished,
      startWorkflow,
    }),
    [
      queue,
      pendingCount,
      sheetAction,
      highlightBind,
      pulseBind,
      enqueue,
      openApproval,
      closeSheet,
      deny,
      approve,
      execute,
      clearFinished,
      startWorkflow,
    ],
  );

  // silence unused — setCoachOpen available for future "open coach on deny"
  void setCoachOpen;

  return (
    <ExecutiveControlContext.Provider value={value}>{children}</ExecutiveControlContext.Provider>
  );
}

export function useExecutiveControl() {
  const ctx = useContext(ExecutiveControlContext);
  if (!ctx) throw new Error("useExecutiveControl requires ExecutiveControlProvider");
  return ctx;
}

/** Safe hook when provider may be absent (tests). */
export function useExecutiveControlOptional() {
  return useContext(ExecutiveControlContext);
}
