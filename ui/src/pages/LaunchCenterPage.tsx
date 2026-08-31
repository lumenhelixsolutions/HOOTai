import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, FolderKanban, Layers3, PlayCircle, TerminalSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useCoach } from "@/context/CoachContext";
import { hootSignal } from '@/lib/h00t-signals';

export default function LaunchCenterPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [goal, setGoal] = useState("privacy");
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [audit, setAudit] = useState<any>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const toast = useToast();
  const { setPageContext, registerActionHandler } = useCoach();

  useEffect(() => {
    Promise.all([api.getProfiles(), api.getActiveProject().catch(() => null), api.getSessions().catch(() => ({ sessions: [] }))])
      .then(([profileData, activeData, sessionData]) => {
        setProfiles(profileData || []);
        setActiveProject(activeData || null);
        setSessions(sessionData?.sessions || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast.showToast("Failed to load launch center", "error");
      });
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    setPlanLoading(true);
    api.makePlan(goal)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch(() => {
        if (!cancelled) toast.showToast("Could not calculate plan recommendations", "warning");
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [goal, toast]);

  const runningSessions = useMemo(() => sessions.filter((session) => session.status === "running"), [sessions]);
  const recommended = plan?.recommended || [];
  const blocked = plan?.blocked || [];
  const launchCandidates = recommended.length > 0 ? recommended : profiles.filter((profile) => profile.state !== "BLOCKED").slice(0, 8);

  const reviewProfile = async (id: string) => {
    try {
      const result = await api.dryRun(id);
      setPreview({ id, result });
      if (result.audit?.warnings?.length || result.audit?.errors?.length) {
        setAudit({ id, audit: result.audit });
      } else {
        setAudit(null);
      }
    } catch (error: any) {
      toast.showToast(error.message || "Preview failed", "error");
    }
  };

  useEffect(() => {
    const auditWarn = Boolean(audit?.audit?.warnings?.length || audit?.audit?.errors?.length);
    setPageContext({
      recommendedCount: recommended.length,
      previewProfileId: preview?.id || null,
      stagedProfileId: preview?.id && !auditWarn ? preview.id : null,
      hasAuditWarnings: auditWarn,
      runningSessions: runningSessions.length,
    });
  }, [recommended.length, preview, audit, runningSessions.length, setPageContext]);

  const launchProfile = async (id: string, overrideReason?: string) => {
    setLaunchingId(id);
    try {
      const result = await api.launch(id, overrideReason);
      if (result.blocked) {
        setPageContext(hootSignal("launch:blocked", 6000));
        toast.showToast(result.message || "Launch blocked", "warning", 6000);
      } else if (result.session) {
        toast.showToast(`Launched ${result.session.profileName}`, "success");
        setSessions((prev) => [result.session, ...prev]);
      } else {
        toast.showToast("Launch request completed", "info");
      }
    } catch (error: any) {
      toast.showToast(error.message || "Launch failed", "error");
    } finally {
      setLaunchingId(null);
    }
  };

  const coachActionRef = useRef<(target: string) => void>(() => {});
  coachActionRef.current = (target) => {
    const topId = launchCandidates[0]?.id;
    if (target === "launch-review-first" && topId) reviewProfile(topId);
    if (target === "launch-staged-go" && preview?.id) launchProfile(preview.id);
  };

  useEffect(() => {
    return registerActionHandler((target) => coachActionRef.current(target));
  }, [registerActionHandler]);

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center opacity-55" aria-busy="true">
        Loading launch center…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="hoot-card-soft rounded-[22px] p-5 md:p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-2.5 text-[11px] uppercase tracking-[0.18em] opacity-45">Launch review</div>
            <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.04em] text-foreground md:text-[32px]">
              Dedicated launch review, not blind clicking.
            </h2>
            <p className="mb-0 mt-3 text-sm leading-relaxed opacity-70">
              This surface brings active project context, recommendation goals, audit explainability, script preview, and
              launch control into one place.
            </p>
          </div>
          <div className="grid min-w-[250px] gap-2.5 self-start">
            <MetaPill icon={FolderKanban} label={activeProject?.project?.name || "No active project"} tone="gold" />
            <MetaPill icon={Layers3} label={`${profiles.length} profiles loaded`} tone="slate" />
            <MetaPill icon={TerminalSquare} label={`${runningSessions.length} sessions running`} tone={runningSessions.length ? "green" : "slate"} />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-[18px] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hoot-card-soft rounded-[22px] p-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] opacity-40">Recommendation goal</div>
              <div className="font-serif text-xl font-semibold text-foreground">Choose the best launch path</div>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Recommendation goal">
              {[
                ["privacy", "Local-first"],
                ["fastest", "Fastest"],
                ["cheapest", "Cheapest"],
                ["heavy", "Heavy work"],
                ["audit", "Audit"],
                ["bypass_cooldown", "Bypass cooldown"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setGoal(value)}
                  role="radio"
                  aria-checked={goal === value}
                  className={`rounded-full border px-3 py-2 text-xs ${
                    goal === value ? "hoot-gold-chip font-semibold" : "border-border bg-foreground/[0.03] text-foreground/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {planLoading ? (
            <div className="rounded-2xl bg-foreground/[0.02] p-8 text-center opacity-55" aria-busy="true">
              Scoring profiles…
            </div>
          ) : (
            <div className="grid gap-3">
              {launchCandidates.map((profile: any) => (
                <ProfileLaunchCard
                  key={profile.id}
                  profile={profile}
                  launching={launchingId === profile.id}
                  onPreview={() => reviewProfile(profile.id)}
                  onLaunch={() => launchProfile(profile.id)}
                />
              ))}
              {launchCandidates.length === 0 && <div className="opacity-55">No launchable profiles found.</div>}
            </div>
          )}
        </section>

        <div className="grid gap-[18px]">
          <section className="hoot-card-soft rounded-[22px] p-5">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] opacity-40">Explainability</div>
            <div className="mb-3 font-serif text-lg font-semibold text-foreground">Audit posture</div>
            {audit ? (
              <div className="grid gap-3">
                <AuditBucket title="Errors" items={audit.audit?.errors || []} tone="red" emptyLabel="No blocking errors." />
                <AuditBucket title="Warnings" items={audit.audit?.warnings || []} tone="gold" emptyLabel="No warnings." />
                <AuditSuggestionList suggestions={audit.audit?.suggestions || []} />
                {(audit.audit?.warnings?.length || 0) > 0 && (
                  <button
                    onClick={() => launchProfile(audit.id, "User approved after reviewing warnings in Launch Center")}
                    className="hoot-gold-chip rounded-xl px-3.5 py-2.5 text-[13px] font-semibold"
                  >
                    Launch with explicit override
                  </button>
                )}
              </div>
            ) : (
              <BodyNote>Preview a profile to inspect warnings, blocking errors, suggestions, and the exact launch script.</BodyNote>
            )}
          </section>

          <section className="hoot-card-soft rounded-[22px] p-5">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] opacity-40">Script preview</div>
            <div className="mb-3 font-serif text-lg font-semibold text-foreground">What will actually run</div>
            {preview ? (
              <>
                <div className="mb-2.5 text-[13px] opacity-70">Profile: {preview.id}</div>
                <pre className="m-0 max-h-[340px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-[#0b0b0d] p-4 font-mono text-xs leading-relaxed text-zinc-100">
                  {preview.result?.script || "No script preview available."}
                </pre>
              </>
            ) : (
              <BodyNote>No preview loaded yet.</BodyNote>
            )}
          </section>
        </div>
      </div>

      {(blocked.length > 0 || runningSessions.length > 0) && (
        <div className="grid gap-[18px] md:grid-cols-2">
          <section className="rounded-[20px] border border-red-400/15 bg-red-400/[0.04] p-5">
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-red-400">Blocked for this goal</div>
            {blocked.slice(0, 5).map((profile: any) => (
              <div key={profile.id} className="flex items-center justify-between gap-2.5 border-b border-border py-2 last:border-b-0">
                <span className="text-foreground">{profile.name}</span>
                <span className="opacity-55">{profile.score}%</span>
              </div>
            ))}
          </section>
          <section className="hoot-card-soft rounded-[20px] p-5">
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] opacity-40">Running now</div>
            {runningSessions.length > 0 ? (
              runningSessions.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between gap-2.5 border-b border-border py-2 last:border-b-0">
                  <span className="text-foreground">{session.profileName}</span>
                  <Link to={`/terminal?session=${encodeURIComponent(session.id)}`} className="hoot-gold-text no-underline">
                    Monitor
                  </Link>
                </div>
              ))
            ) : (
              <BodyNote>No running sessions.</BodyNote>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

const PROFILE_STATE_CHIP: Record<string, string> = {
  READY: "border-emerald-400/25 bg-emerald-400/10 text-emerald-400",
  DEGRADED: "border-amber-400/25 bg-amber-400/10 text-amber-500",
  BLOCKED: "border-red-400/25 bg-red-400/10 text-red-400",
  UNKNOWN: "border-border bg-foreground/5 text-muted-foreground",
};

function ProfileLaunchCard({ profile, launching, onPreview, onLaunch }: { profile: any; launching: boolean; onPreview: () => void; onLaunch: () => void }) {
  const state = profile.state || "UNKNOWN";
  return (
    <div className="hoot-card-soft rounded-[18px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground">{profile.name}</div>
          <div className="mt-1 truncate font-mono text-[11px] opacity-40">{profile.id}</div>
        </div>
        <span className={`rounded-full border px-2.5 py-1.5 text-[11px] uppercase tracking-[0.08em] ${PROFILE_STATE_CHIP[state] || PROFILE_STATE_CHIP.UNKNOWN}`}>
          {state}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {profile.meta?.mode && <Chip text={profile.meta.mode} />}
        {profile.meta?.task_mode && <Chip text={profile.meta.task_mode} />}
        {profile.meta?.model && <Chip text={profile.meta.model} />}
        {profile.score !== undefined && <Chip text={`${profile.score}% fit`} highlight />}
      </div>
      {profile.reasons?.length > 0 && (
        <div className="hoot-card-soft mt-3 rounded-[14px] p-3">
          {profile.reasons.slice(0, 3).map((reason: string, index: number) => (
            <div key={index} className="text-xs leading-relaxed opacity-70">
              • {reason}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3.5 flex gap-2">
        <button onClick={onPreview} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-foreground/[0.04] px-3.5 py-2.5 text-[13px] text-foreground/90 hover:bg-foreground/[0.07]">
          <Eye size={14} /> Preview + audit
        </button>
        <button
          onClick={onLaunch}
          disabled={launching || state === "BLOCKED"}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2.5 text-[13px] text-emerald-400 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <PlayCircle size={14} /> {launching ? "Launching…" : "Launch"}
        </button>
      </div>
    </div>
  );
}

function AuditBucket({ title, items, tone, emptyLabel }: { title: string; items: string[]; tone: "red" | "gold"; emptyLabel: string }) {
  const frame = tone === "red" ? "border-red-400/15 bg-red-400/[0.05] text-red-400" : "border-[color-mix(in_srgb,var(--hoot-gold)_16%,transparent)] bg-[color-mix(in_srgb,var(--hoot-gold)_6%,transparent)] hoot-gold-text";
  return (
    <div className={`rounded-2xl border p-3.5 ${frame.split(" ").slice(0, 2).join(" ")}`}>
      <div className={`mb-2 text-[11px] uppercase tracking-[0.14em] ${tone === "red" ? "text-red-400" : "hoot-gold-text"}`}>{title}</div>
      {items.length > 0 ? (
        items.map((item, index) => (
          <div key={index} className="mb-1.5 text-[13px] leading-relaxed text-foreground">
            • {item}
          </div>
        ))
      ) : (
        <BodyNote>{emptyLabel}</BodyNote>
      )}
    </div>
  );
}

function AuditSuggestionList({ suggestions }: { suggestions: any[] }) {
  if (!suggestions.length) return <BodyNote>No suggested alternatives.</BodyNote>;
  return (
    <div className="hoot-card-soft rounded-2xl p-3.5">
      <div className="mb-2 text-[11px] uppercase tracking-[0.14em] opacity-40">Suggestions</div>
      {suggestions.map((suggestion: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-2.5 border-b border-border py-2 last:border-b-0">
          <span className="text-foreground">{suggestion.name || suggestion.id || "Alternative"}</span>
          {suggestion.score !== undefined && <span className="opacity-55">{suggestion.score}%</span>}
        </div>
      ))}
    </div>
  );
}

function MetaPill({ icon: Icon, label, tone }: { icon: any; label: string; tone: "green" | "gold" | "slate" }) {
  const toneClass = {
    green: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-400",
    gold: "hoot-gold-chip",
    slate: "border-border bg-foreground/5 text-muted-foreground",
  }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-2.5 text-xs ${toneClass}`}>
      <Icon size={14} />
      <span className="truncate">{label}</span>
    </div>
  );
}

function Chip({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <span className={`rounded-full border px-2.5 py-1.5 text-[11px] ${highlight ? "hoot-gold-chip" : "border-border bg-foreground/[0.03] text-foreground/80"}`}>
      {text}
    </span>
  );
}

function BodyNote({ children }: { children: React.ReactNode }) {
  return <div className='text-[13px] leading-relaxed opacity-65'>{children}</div>;
}
