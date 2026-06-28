"use client";

// One class's command surface for the instructor. Identity + runtime up top,
// then the two core workflows — attendance roll-call (submit once) and the
// post-session reflection — followed by roster signals and feedback. Mobile-first
// and frictionless; every mutation gives inline success/error state.

import { useEffect, useMemo, useState, useTransition } from "react";

import { CardV2, StatusBadge, Button, ButtonLink, cn, type StatusTone } from "@/components/ui-v2";
import { shortDate } from "@/lib/chapters/format";
import { submitClassAttendance } from "@/lib/classes/attendance-actions";
import { submitSessionReflection } from "@/lib/classes/reflection-actions";
import { ATTENDANCE_STATUSES, type AttendanceStatusValue } from "@/lib/classes/attendance";
import type { ClassRuntimeHealth } from "@/lib/classes/class-runtime";
import type { CockpitClassDetail } from "@/lib/classes/instructor-cockpit";

const HEALTH_TONE: Record<ClassRuntimeHealth, StatusTone> = {
  healthy: "success",
  watch: "info",
  at_risk: "warning",
  critical: "danger",
  unknown: "neutral",
};
const BLOCKER_TONE: Record<"critical" | "warning" | "info", StatusTone> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};
const STATUS_SHORT: Record<AttendanceStatusValue, string> = { PRESENT: "P", ABSENT: "A", LATE: "L", EXCUSED: "E" };

type Detail = CockpitClassDetail;

export function InstructorClassDetailView({ detail }: { detail: Detail }) {
  const r = detail.runtime;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <a href="/instructor/classes" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
        ← My Classes
      </a>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-bold text-ink">{detail.title}</h1>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            {detail.scheduleLabel} · {detail.locationLabel}
            {detail.ageRange ? ` · Ages ${detail.ageRange.replace(/-/g, "–")}` : ""}
          </p>
        </div>
        <StatusBadge tone={HEALTH_TONE[r.health]} withDot>
          {r.stageLabel}
        </StatusBadge>
      </div>

      {/* Recommended next + blockers */}
      <CardV2 className="mt-4">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-700">Next up</p>
        <p className="m-0 mt-1 text-[14px] font-semibold text-ink">{r.nextStep.text}</p>
        {r.blockers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.blockers.map((b) => (
              <StatusBadge key={b.key} tone={BLOCKER_TONE[b.severity]}>
                {b.label}
              </StatusBadge>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-line-card pt-3">
          <Mini label="Enrolled" value={`${r.evidence.enrolled}`} />
          <Mini label="Sessions" value={`${r.evidence.sessionsHeld}/${r.evidence.sessionsTotal}`} />
          <Mini label="Attendance" value={r.evidence.attendancePercent != null ? `${r.evidence.attendancePercent}%` : "—"} />
          <Mini label="Feedback" value={`${r.evidence.feedbackCount}`} />
        </div>
      </CardV2>

      <AttendancePanel detail={detail} />
      <ReflectionPanel detail={detail} />
      <RosterPanel detail={detail} />
      <FeedbackPanel detail={detail} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[16px] font-bold leading-none text-ink">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</div>
    </div>
  );
}

// --- Attendance roll-call ---------------------------------------------------

function AttendancePanel({ detail }: { detail: Detail }) {
  const markableSessions = useMemo(
    () => detail.sessions.filter((s) => !s.isCancelled).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [detail.sessions]
  );
  const defaultSession = detail.attendanceDueSession?.id ?? markableSessions[0]?.id ?? "";
  const [sessionId, setSessionId] = useState(defaultSession);
  const session = markableSessions.find((s) => s.id === sessionId) ?? null;

  const [marks, setMarks] = useState<Record<string, AttendanceStatusValue>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });

  // Pre-fill from the selected session's existing marks (default PRESENT).
  useEffect(() => {
    const existing = new Map((session?.marks ?? []).map((m) => [m.studentId, m.status as AttendanceStatusValue]));
    const next: Record<string, AttendanceStatusValue> = {};
    for (const stu of detail.roster) next[stu.studentId] = existing.get(stu.studentId) ?? "PRESENT";
    setMarks(next);
    setNotes({});
    setState({ kind: "idle" });
  }, [session, detail.roster]);

  const roster = detail.roster.filter((s) => s.status === "ENROLLED" || s.status === "COMPLETED");

  function submit() {
    if (!session) return;
    startTransition(async () => {
      const res = await submitClassAttendance({
        offeringId: detail.id,
        sessionId: session.id,
        marks: roster.map((s) => ({ studentId: s.studentId, status: marks[s.studentId] ?? "PRESENT", note: notes[s.studentId] || undefined })),
      });
      setState(res.ok ? { kind: "done", msg: `Saved ${res.recorded} ✓` } : { kind: "error", msg: res.error });
    });
  }

  return (
    <section id="attendance" className="mt-5 scroll-mt-4">
      <CardV2 padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-card px-4 py-3">
          <h2 className="m-0 text-[14px] font-bold text-ink">Attendance</h2>
          {session && (
            <StatusBadge tone={session.attendanceRecorded ? "success" : "warning"}>
              {session.attendanceRecorded ? "Submitted" : "Not recorded"}
            </StatusBadge>
          )}
        </div>

        {markableSessions.length === 0 || roster.length === 0 ? (
          <p className="m-0 px-4 py-4 text-[13px] text-ink-muted">
            {roster.length === 0 ? "No students are enrolled yet." : "No sessions to record yet."}
          </p>
        ) : (
          <div className="px-4 py-3">
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
              Session
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink outline-none focus:border-brand-400"
              >
                {markableSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Session {s.sessionNumber} · {shortDate(s.date)}
                    {s.attendanceRecorded ? " (recorded)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
              {roster.map((stu) => (
                <li key={stu.studentId} className="flex items-center justify-between gap-2 rounded-[9px] border border-line-card bg-surface-soft px-2.5 py-1.5">
                  <span className="min-w-0 truncate text-[13px] font-medium text-ink">{stu.name}</span>
                  <div className="flex shrink-0 gap-1">
                    {ATTENDANCE_STATUSES.map((st) => {
                      const active = (marks[stu.studentId] ?? "PRESENT") === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          aria-label={st}
                          onClick={() => setMarks((m) => ({ ...m, [stu.studentId]: st }))}
                          className={cn(
                            "size-7 rounded-[7px] text-[12px] font-bold transition-colors",
                            active
                              ? st === "PRESENT"
                                ? "bg-complete-600 text-white"
                                : st === "ABSENT"
                                  ? "bg-blocked-600 text-white"
                                  : "bg-progress-600 text-white"
                              : "border border-line-card bg-surface text-ink-muted hover:border-brand-400"
                          )}
                        >
                          {STATUS_SHORT[st]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-end gap-2">
              {state.kind === "done" && <span className="text-[12.5px] font-semibold text-complete-700">{state.msg}</span>}
              {state.kind === "error" && <span className="text-[12.5px] font-semibold text-blocked-700">{state.msg}</span>}
              <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={pending}>
                Submit attendance
              </Button>
            </div>
          </div>
        )}
      </CardV2>
    </section>
  );
}

// --- Reflection -------------------------------------------------------------

function ReflectionPanel({ detail }: { detail: Detail }) {
  const pastSessions = useMemo(
    () => detail.sessions.filter((s) => !s.isCancelled).sort((a, b) => b.date.getTime() - a.date.getTime()),
    [detail.sessions]
  );
  const defaultSession = detail.reflectionDueSession?.id ?? pastSessions[0]?.id ?? "";
  const [sessionId, setSessionId] = useState(defaultSession);
  const [wentWell, setWentWell] = useState("");
  const [struggled, setStruggled] = useState("");
  const [changeNextTime, setChangeNextTime] = useState("");
  const [logisticsIssue, setLogisticsIssue] = useState("");
  const [needsCpHelp, setNeedsCpHelp] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; msg?: string }>({ kind: "idle" });

  if (pastSessions.length === 0) return null;

  function submit() {
    startTransition(async () => {
      const res = await submitSessionReflection({
        offeringId: detail.id,
        sessionId,
        wentWell: wentWell || undefined,
        struggled: struggled || undefined,
        changeNextTime: changeNextTime || undefined,
        logisticsIssue: logisticsIssue || undefined,
        needsCpHelp,
      });
      setState(res.ok ? { kind: "done", msg: "Reflection saved ✓" } : { kind: "error", msg: res.error });
    });
  }

  return (
    <section id="reflection" className="mt-5 scroll-mt-4">
      <CardV2 padding="none" className="overflow-hidden">
        <div className="border-b border-line-card px-4 py-3">
          <h2 className="m-0 text-[14px] font-bold text-ink">Post-session reflection</h2>
          <p className="m-0 mt-0.5 text-[12px] text-ink-muted">A few lines — it feeds the chapter, not a homework grade.</p>
        </div>
        <div className="flex flex-col gap-2.5 px-4 py-3">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
            Session
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink outline-none focus:border-brand-400"
            >
              {pastSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Session {s.sessionNumber} · {shortDate(s.date)}
                  {s.reflectionDone ? " (reflected)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Field label="What worked?" value={wentWell} onChange={setWentWell} />
          <Field label="What did students struggle with?" value={struggled} onChange={setStruggled} />
          <Field label="What should change next time?" value={changeNextTime} onChange={setChangeNextTime} />
          <Field label="Any logistics problems?" value={logisticsIssue} onChange={setLogisticsIssue} />
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <input type="checkbox" checked={needsCpHelp} onChange={(e) => setNeedsCpHelp(e.target.checked)} className="size-4" />
            I need help from my Chapter President
          </label>
          <div className="flex items-center justify-end gap-2">
            {state.kind === "done" && <span className="text-[12.5px] font-semibold text-complete-700">{state.msg}</span>}
            {state.kind === "error" && <span className="text-[12.5px] font-semibold text-blocked-700">{state.msg}</span>}
            <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={pending}>
              Submit reflection
            </Button>
          </div>
        </div>
      </CardV2>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-1.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400"
      />
    </label>
  );
}

// --- Roster + feedback (read) ----------------------------------------------

function RosterPanel({ detail }: { detail: Detail }) {
  if (detail.roster.length === 0) return null;
  return (
    <section className="mt-5">
      <CardV2 padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-card px-4 py-3">
          <h2 className="m-0 text-[14px] font-bold text-ink">Roster</h2>
          {detail.signalSummary.atRiskCount > 0 && (
            <StatusBadge tone="warning">{detail.signalSummary.atRiskCount} at risk</StatusBadge>
          )}
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {detail.roster.map((s) => (
            <li key={s.studentId} className="flex items-center justify-between gap-2 border-b border-line-card px-4 py-2.5 last:border-0">
              <span className="min-w-0 truncate text-[13px] font-medium text-ink">{s.name}</span>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {s.signals.slice(0, 2).map((sig) => (
                  <StatusBadge key={sig.key} tone={sig.category === "risk" ? "warning" : sig.category === "positive" ? "success" : "neutral"}>
                    {sig.label}
                  </StatusBadge>
                ))}
                {s.status === "DROPPED" && <StatusBadge tone="danger">Dropped</StatusBadge>}
              </div>
            </li>
          ))}
        </ul>
      </CardV2>
    </section>
  );
}

function FeedbackPanel({ detail }: { detail: Detail }) {
  if (detail.feedback.length === 0) return null;
  return (
    <section className="mt-5">
      <CardV2 padding="none" className="overflow-hidden">
        <div className="border-b border-line-card px-4 py-3">
          <h2 className="m-0 text-[14px] font-bold text-ink">Feedback</h2>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {detail.feedback.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 border-b border-line-card px-4 py-2.5 last:border-0">
              <span className="text-[13px] font-medium text-ink">{f.studentName ?? "A student"}</span>
              <span className="text-[13px] font-bold text-progress-700">{"★".repeat(Math.max(0, Math.min(5, f.rating)))}</span>
            </li>
          ))}
        </ul>
      </CardV2>
    </section>
  );
}
