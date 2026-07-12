"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button, ButtonLink, CardV2, cn } from "@/components/ui-v2";
import { submitClassAttendance } from "@/lib/classes/attendance-actions";
import { ATTENDANCE_STATUSES, type AttendanceStatusValue } from "@/lib/classes/attendance";
import { saveSessionPreparation } from "@/lib/classes/preparation-actions";
import { submitSessionReflection } from "@/lib/classes/reflection-actions";
import { flagInstructorStudentFollowUp } from "@/lib/classes/student-follow-up-actions";
import type {
  TeachingClass,
  TeachingSession,
} from "@/lib/classes/instructor-workspace";

const STATUS_SHORT: Record<AttendanceStatusValue, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  EXCUSED: "E",
};

type InlineState = { kind: "idle" | "done" | "error"; message?: string };

export function InstructorClassDetailView({
  detail,
  initialSessionId,
}: {
  detail: TeachingClass;
  initialSessionId?: string | null;
}) {
  const sessions = useMemo(
    () => [...detail.sessions].sort((a, b) => a.state.startsAt.getTime() - b.state.startsAt.getTime()),
    [detail.sessions]
  );
  const fallbackSession =
    sessions.find((session) => session.state.action.rank <= 1 && !session.isCancelled) ??
    detail.nextSession ??
    [...sessions].reverse().find((session) => !session.isCancelled) ??
    sessions[0] ??
    null;
  const requestedSession = sessions.find((session) => session.id === initialSessionId) ?? null;
  const [sessionId, setSessionId] = useState(requestedSession?.id ?? fallbackSession?.id ?? "");
  const session = sessions.find((item) => item.id === sessionId) ?? fallbackSession;

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-7 sm:px-6 lg:px-8 lg:pt-10">
        <Link href="/instructor/classes" className="text-[13px] font-semibold text-brand-700 hover:underline">← Classes</Link>
        <CardV2 className="mt-6">
          <h1 className="m-0 text-[24px] font-semibold text-ink">{detail.title}</h1>
          <p className="m-0 mt-2 text-[14px] text-ink-muted">No class sessions are scheduled yet.</p>
          {detail.canManageSettings ? (
            <ButtonLink href={`/instructor/class-settings?offering=${detail.id}`} variant="primary" size="md" className="mt-5">
              Add the class schedule
            </ButtonLink>
          ) : (
            <p className="m-0 mt-4 text-[13px] text-ink-muted">The lead instructor or YPP must add the class schedule.</p>
          )}
        </CardV2>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-7 sm:px-6 lg:px-8 lg:pt-10">
      <Link href="/instructor/classes" className="text-[13px] font-semibold text-brand-700 hover:underline">← Classes</Link>

      <header className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">Teaching workspace</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">{detail.title}</h1>
          <p className="m-0 mt-2 text-[13.5px] text-ink-muted">
            {detail.scheduleLabel} · {detail.locationLabel} · {session.expectedStudentIds.length} students in this session
          </p>
        </div>
        <label className="flex min-w-[260px] flex-col gap-1 text-[12px] font-semibold text-ink-muted">
          Session workspace
          <select
            value={session.id}
            onChange={(event) => setSessionId(event.target.value)}
            className="h-10 rounded-[9px] border border-line-card bg-surface px-3 text-[13px] font-medium text-ink outline-none focus:border-brand-400"
          >
            {sessions.map((item) => (
              <option key={item.id} value={item.id}>
                Session {item.sessionNumber}: {item.topic}{item.isCancelled ? " (cancelled)" : ""}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="mt-7 rounded-[16px] border border-brand-200 bg-brand-50/50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">Next action</p>
          <h2 className="m-0 mt-1.5 text-[19px] font-semibold text-ink">{session.state.action.title}</h2>
          <p className="m-0 mt-2 max-w-3xl text-[13.5px] leading-5 text-ink-muted">{session.state.action.reason}</p>
        </div>
        <ButtonLink href={session.state.action.href} variant="primary" size="md" className="mt-4 shrink-0 sm:mt-0">
          {session.state.action.label}
        </ButtonLink>
      </section>

      <nav aria-label="Session lifecycle" className="mt-6 flex gap-1 overflow-x-auto rounded-[11px] border border-line-card bg-surface p-1">
        {[
          ["before", "Before class"],
          ["during", "During class"],
          ["after", "After class"],
          ["students", "Students"],
        ].map(([href, label]) => (
          <a key={href} href={`#${href}`} className="min-w-max flex-1 rounded-[8px] px-4 py-2 text-center text-[13px] font-semibold text-ink-muted hover:bg-surface-soft hover:text-brand-700">
            {label}
          </a>
        ))}
      </nav>

      <section id="before" className="scroll-mt-4 pt-10">
        <LifecycleHeading step="Before class" title="Know the lesson and arrive ready" detail="The exact lesson, materials, location, and permitted student context for this session." />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
          <div className="space-y-5">
            <LessonBrief detail={detail} session={session} />
            <StudentContext detail={detail} session={session} />
          </div>
          <div className="space-y-5">
            <PreparationEditor detail={detail} session={session} />
            <LocationPanel detail={detail} />
          </div>
        </div>
      </section>

      <section id="during" className="scroll-mt-4 pt-12">
        <LifecycleHeading step="During class" title="Teach without leaving this page" detail="Open the lesson and materials, then record the whole roster in one pass." />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
          <MaterialsPanel detail={detail} session={session} />
          <AttendancePanel detail={detail} session={session} />
        </div>
        <div className="mt-5 max-w-3xl">
          <DuringFollowUpPanel detail={detail} session={session} />
        </div>
      </section>

      <section id="after" className="scroll-mt-4 pt-12">
        <LifecycleHeading step="After class" title="Close the loop while it is fresh" detail="Submit the shortest useful recap, record follow-ups, and flag operational help once." />
        <div className="mt-5">
          <ReflectionPanel detail={detail} session={session} />
        </div>
      </section>

      <section id="students" className="scroll-mt-4 pt-12">
        <LifecycleHeading step="Students" title="Roster and actionable attention" detail="Class-permitted context stays with the roster. Students are flagged only for a recorded reason." />
        <RosterPanel detail={detail} />
      </section>
    </main>
  );
}

function LifecycleHeading({ step, title, detail }: { step: string; title: string; detail: string }) {
  return (
    <header>
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">{step}</p>
      <h2 className="m-0 mt-1.5 text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="m-0 mt-1.5 max-w-3xl text-[13.5px] leading-5 text-ink-muted">{detail}</p>
    </header>
  );
}

function SessionDate({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: detail.timezone,
    timeZoneName: "short",
  }).format(session.state.startsAt);
  return <>{date}</>;
}

function LessonBrief({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  return (
    <CardV2 padding="lg" className="shadow-none">
      <p className="m-0 text-[12px] font-semibold text-ink-muted"><SessionDate detail={detail} session={session} /></p>
      <h3 className="m-0 mt-2 text-[20px] font-semibold text-ink">Session {session.sessionNumber}: {session.topic}</h3>
      {session.description ? <p className="m-0 mt-3 whitespace-pre-wrap text-[13.5px] leading-6 text-ink-muted">{session.description}</p> : null}
      {session.milestone ? (
        <p className="m-0 mt-4 border-l-2 border-brand-300 pl-3 text-[13px] leading-5 text-ink"><strong>Milestone:</strong> {session.milestone}</p>
      ) : null}
      {session.learningOutcomes.length > 0 ? (
        <div className="mt-5">
          <h4 className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-muted">Students should leave able to</h4>
          <ul className="m-0 mt-2 space-y-1.5 pl-5 text-[13px] leading-5 text-ink-muted">
            {session.learningOutcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
          </ul>
        </div>
      ) : null}
      {session.lessonPlan ? (
        <div className="mt-6 border-t border-line-card pt-5">
          <h4 className="m-0 text-[14px] font-semibold text-ink">{session.lessonPlan.title}</h4>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{session.lessonPlan.totalMinutes} minutes · {session.lessonPlan.activities.length} activities</p>
          <ol className="m-0 mt-4 space-y-3 p-0 [list-style:none]">
            {session.lessonPlan.activities.map((activity, index) => (
              <li key={activity.id} className="grid grid-cols-[24px_1fr] gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">{index + 1}</span>
                <div>
                  <p className="m-0 text-[13px] font-semibold text-ink">{activity.title} · {activity.durationMin} min</p>
                  {activity.description ? <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted">{activity.description}</p> : null}
                  {activity.resources ? <p className="m-0 mt-1 text-[12px] leading-5 text-ink-muted"><strong>Resource:</strong> {activity.resources}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </CardV2>
  );
}

function PreparationEditor({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  const router = useRouter();
  const [lessonPlanId, setLessonPlanId] = useState(session.lessonPlan?.id ?? "");
  const [notesUrl, setNotesUrl] = useState(session.notesUrl ?? "");
  const [materialsUrl, setMaterialsUrl] = useState(session.materialsUrl ?? "");
  const [preparationNote, setPreparationNote] = useState(session.preparation?.note ?? "");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InlineState>({ kind: "idle" });

  useEffect(() => {
    setLessonPlanId(session.lessonPlan?.id ?? "");
    setNotesUrl(session.notesUrl ?? "");
    setMaterialsUrl(session.materialsUrl ?? "");
    setPreparationNote(session.preparation?.note ?? "");
    setState({ kind: "idle" });
  }, [session]);

  function save(markComplete: boolean) {
    startTransition(async () => {
      const result = await saveSessionPreparation({
        offeringId: detail.id,
        sessionId: session.id,
        lessonPlanId,
        notesUrl,
        materialsUrl,
        preparationNote,
        markComplete,
      });
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      setState({ kind: "done", message: markComplete ? "Preparation complete." : "Preparation links saved." });
      router.refresh();
    });
  }

  return (
    <CardV2 padding="md" className="shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[15px] font-semibold text-ink">Preparation check</h3>
          <p className="m-0 mt-1 text-[12px] leading-5 text-ink-muted">All four facts must be true before this session is complete.</p>
        </div>
        <span className={session.state.preparation.complete ? "text-[12px] font-semibold text-complete-700" : "text-[12px] font-semibold text-progress-700"}>
          {session.state.preparation.complete ? "Complete" : "Incomplete"}
        </span>
      </div>
      <ul className="m-0 mt-4 space-y-2 p-0 [list-style:none]">
        {session.state.preparation.checks.map((check) => (
          <li key={check.key} className="flex gap-2.5 text-[12.5px] leading-5">
            <span aria-hidden className={check.complete ? "mt-0.5 text-complete-700" : "mt-0.5 text-progress-700"}>{check.complete ? "✓" : "○"}</span>
            <span>
              <strong className="font-semibold text-ink">{check.label}</strong>
              {!check.complete ? <span className="block text-ink-muted">{check.reason}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-3 border-t border-line-card pt-4">
        <label className="block text-[12px] font-semibold text-ink-muted">
          Exact lesson plan
          <select value={lessonPlanId} onChange={(event) => setLessonPlanId(event.target.value)} className="mt-1 h-9 w-full rounded-[8px] border border-line-card bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400">
            <option value="">Use the session instructions below</option>
            {detail.lessonPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
          </select>
        </label>
        <UrlField label="Lesson notes or slide deck URL" value={notesUrl} onChange={setNotesUrl} />
        <UrlField label="Activity or worksheet URL" value={materialsUrl} onChange={setMaterialsUrl} />
        <label className="block text-[12px] font-semibold text-ink-muted">
          Private preparation note (optional)
          <textarea value={preparationNote} onChange={(event) => setPreparationNote(event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-[8px] border border-line-card bg-surface px-2.5 py-2 text-[13px] font-normal text-ink outline-none focus:border-brand-400" />
        </label>
      </div>

      {state.kind !== "idle" ? <p role="status" className={cn("m-0 mt-3 text-[12px] font-semibold", state.kind === "done" ? "text-complete-700" : "text-blocked-700")}>{state.message}</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => save(false)} disabled={pending}>Save links</Button>
        <Button variant="primary" size="sm" onClick={() => save(true)} loading={pending}>Mark preparation complete</Button>
      </div>
    </CardV2>
  );
}

function UrlField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[12px] font-semibold text-ink-muted">
      {label}
      <input type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://" className="mt-1 h-9 w-full rounded-[8px] border border-line-card bg-surface px-2.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400" />
    </label>
  );
}

function LocationPanel({ detail }: { detail: TeachingClass }) {
  return (
    <CardV2 padding="md" className="shadow-none">
      <h3 className="m-0 text-[15px] font-semibold text-ink">Where class happens</h3>
      <p className="m-0 mt-2 text-[13px] font-medium text-ink">{detail.locationLabel}</p>
      {detail.locationAddress ? <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{detail.locationAddress}</p> : null}
      {detail.arrivalInstructions ? <p className="m-0 mt-3 whitespace-pre-wrap text-[12.5px] leading-5 text-ink-muted">{detail.arrivalInstructions}</p> : null}
      {detail.zoomLink ? <a href={detail.zoomLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[13px] font-semibold text-brand-700 hover:underline">Open meeting link ↗</a> : null}
      {detail.locationLabel.includes("missing") ? (
        detail.canManageSettings
          ? <ButtonLink href={`/instructor/class-settings?offering=${detail.id}`} variant="secondary" size="sm" className="mt-4">Add location</ButtonLink>
          : <p className="m-0 mt-3 text-[12.5px] text-progress-800">The lead instructor or YPP must add the location.</p>
      ) : null}
    </CardV2>
  );
}

function StudentContext({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  const roster = detail.roster.filter((student) => session.expectedStudentIds.includes(student.studentId));
  const context = roster.filter((student) => student.signupGoal || student.signupNote || student.instructorNotes);
  return (
    <CardV2 padding="none" className="overflow-hidden shadow-none">
      <div className="border-b border-line-card px-5 py-4">
        <h3 className="m-0 text-[15px] font-semibold text-ink">Permitted student context</h3>
        <p className="m-0 mt-1 text-[12px] text-ink-muted">Only class signup context and class-scoped instructor notes are shown.</p>
      </div>
      {context.length > 0 ? (
        <div className="divide-y divide-line-card">
          {context.map((student) => (
            <div key={student.studentId} className="px-5 py-4">
              <p className="m-0 text-[13.5px] font-semibold text-ink">{student.name}</p>
              {student.signupGoal ? <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted"><strong>Goal:</strong> {student.signupGoal}</p> : null}
              {student.signupNote ? <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted"><strong>Signup note:</strong> {student.signupNote}</p> : null}
              {student.instructorNotes ? <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted"><strong>Teaching note:</strong> {student.instructorNotes}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 px-5 py-4 text-[13px] text-ink-muted">No class-permitted student context is recorded for this roster.</p>
      )}
    </CardV2>
  );
}

function MaterialsPanel({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  return (
    <CardV2 padding="md" className="shadow-none">
      <h3 className="m-0 text-[15px] font-semibold text-ink">Teaching materials</h3>
      {session.materials.length > 0 ? (
        <ul className="m-0 mt-4 space-y-3 p-0 [list-style:none]">
          {session.materials.map((material) => (
            <li key={material.key}>
              {material.href ? (
                <Link href={material.href} className="text-[13px] font-semibold text-brand-700 hover:underline">{material.label}</Link>
              ) : (
                <p className="m-0 text-[13px] font-semibold text-ink">{material.label}</p>
              )}
              {material.detail ? <p className="m-0 mt-0.5 text-[12px] leading-5 text-ink-muted">{material.detail}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-[13px] leading-5 text-ink-muted">No materials are attached. Add them in the preparation check before class.</p>
      )}
      {detail.zoomLink && session.state.lifecycle === "during" ? <a href={detail.zoomLink} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-9 items-center rounded-[9px] bg-brand-700 px-4 text-[13px] font-semibold text-white">Join class now ↗</a> : null}
    </CardV2>
  );
}

function AttendancePanel({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  const router = useRouter();
  const roster = useMemo(
    () => detail.roster.filter((student) => session.expectedStudentIds.includes(student.studentId)),
    [detail.roster, session.expectedStudentIds]
  );
  const [marks, setMarks] = useState<Record<string, AttendanceStatusValue>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InlineState>({ kind: "idle" });
  const attendanceOpen = session.state.lifecycle === "during" || session.state.lifecycle === "after";

  useEffect(() => {
    const existing = new Map(session.attendanceMarks.map((mark) => [mark.studentId, mark]));
    setMarks(Object.fromEntries(roster.map((student) => [student.studentId, (existing.get(student.studentId)?.status as AttendanceStatusValue | undefined) ?? "PRESENT"])));
    setNotes(Object.fromEntries(roster.map((student) => [student.studentId, existing.get(student.studentId)?.note ?? ""])));
    setState({ kind: "idle" });
  }, [roster, session]);

  function submit() {
    startTransition(async () => {
      const result = await submitClassAttendance({
        offeringId: detail.id,
        sessionId: session.id,
        marks: roster.map((student) => ({
          studentId: student.studentId,
          status: marks[student.studentId] ?? "PRESENT",
          note: notes[student.studentId] ?? "",
        })),
      });
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      setState({ kind: "done", message: `Attendance saved for ${result.recorded} student${result.recorded === 1 ? "" : "s"}.` });
      router.refresh();
    });
  }

  return (
    <CardV2 padding="none" className="overflow-hidden shadow-none">
      <div className="flex items-start justify-between gap-3 border-b border-line-card px-4 py-4 sm:px-5">
        <div>
          <h3 className="m-0 text-[15px] font-semibold text-ink">Roll call</h3>
          <p className="m-0 mt-1 text-[12px] text-ink-muted">P present · A absent · L late · E excused</p>
        </div>
        <span className={session.state.attendance === "complete" || session.state.attendance === "not_required" ? "text-[12px] font-semibold text-complete-700" : "text-[12px] font-semibold text-progress-700"}>
          {session.state.attendance === "not_required" ? "Not required" : session.state.attendance === "complete" ? "Complete" : session.state.attendance === "partial" ? "Partial" : "Not recorded"}
        </span>
      </div>
      {roster.length === 0 ? (
        <p className="m-0 px-5 py-5 text-[13px] text-ink-muted">No student was enrolled for this session, so attendance is not required.</p>
      ) : (
        <div>
          <ul className="m-0 divide-y divide-line-card p-0 [list-style:none]">
            {roster.map((student) => (
              <li key={student.studentId} className="px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 truncate text-[13px] font-medium text-ink">{student.name}</span>
                  <div className="flex shrink-0 gap-1">
                    {ATTENDANCE_STATUSES.map((status) => {
                      const active = marks[student.studentId] === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          aria-label={`${student.name}: ${status.toLowerCase()}`}
                          aria-pressed={active}
                          disabled={!attendanceOpen || pending}
                          onClick={() => setMarks((current) => ({ ...current, [student.studentId]: status }))}
                          className={cn(
                            "size-8 rounded-[7px] text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            active
                              ? status === "PRESENT"
                                ? "bg-complete-600 text-white"
                                : status === "ABSENT"
                                  ? "bg-blocked-600 text-white"
                                  : "bg-progress-600 text-white"
                              : "border border-line-card bg-surface text-ink-muted hover:border-brand-400"
                          )}
                        >
                          {STATUS_SHORT[status]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input
                  value={notes[student.studentId] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [student.studentId]: event.target.value }))}
                  disabled={!attendanceOpen || pending}
                  aria-label={`Attendance note for ${student.name}`}
                  placeholder="Optional attendance note"
                  className="mt-2 h-8 w-full rounded-[7px] border border-line-card bg-surface px-2.5 text-[12.5px] text-ink outline-none focus:border-brand-400 disabled:bg-surface-soft"
                />
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-card px-4 py-3 sm:px-5">
            <p role="status" className={cn("m-0 text-[12px]", state.kind === "error" ? "font-semibold text-blocked-700" : state.kind === "done" ? "font-semibold text-complete-700" : "text-ink-muted")}>
              {state.message ?? (attendanceOpen ? "Review the roster, then save once." : "Attendance opens when the session starts.")}
            </p>
            <Button variant="primary" size="sm" onClick={submit} loading={pending} disabled={!attendanceOpen || pending}>Save attendance</Button>
          </div>
        </div>
      )}
    </CardV2>
  );
}

function DuringFollowUpPanel({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  const router = useRouter();
  const roster = detail.roster.filter((student) => session.expectedStudentIds.includes(student.studentId));
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InlineState>({ kind: "idle" });
  const canFlag = !session.isCancelled && (session.state.lifecycle === "during" || session.state.lifecycle === "after");

  useEffect(() => {
    setStudentId("");
    setReason("");
    setState({ kind: "idle" });
  }, [session]);

  function flag() {
    startTransition(async () => {
      const result = await flagInstructorStudentFollowUp({
        offeringId: detail.id,
        sessionId: session.id,
        studentId,
        reason,
      });
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      setState({ kind: "done", message: "Follow-up flagged. It is now on your Students page." });
      setReason("");
      router.refresh();
    });
  }

  return (
    <CardV2 padding="md" className="shadow-none">
      <h3 className="m-0 text-[15px] font-semibold text-ink">Flag a student for later</h3>
      <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted">Save the concern now without leaving attendance. Complete the check-in later from Students.</p>
      {roster.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-end">
          <label className="block text-[12px] font-semibold text-ink-muted">
            Student
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!canFlag || pending} className="mt-1 h-9 w-full rounded-[8px] border border-line-card bg-surface px-2.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400 disabled:bg-surface-soft">
              <option value="">Choose a student</option>
              {roster.map((student) => <option key={student.studentId} value={student.studentId}>{student.name}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-ink-muted">
            What needs follow-up?
            <input value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canFlag || pending} placeholder="Example: Check in about the group activity." className="mt-1 h-9 w-full rounded-[8px] border border-line-card bg-surface px-2.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400 disabled:bg-surface-soft" />
          </label>
          <Button variant="secondary" size="sm" onClick={flag} loading={pending} disabled={!canFlag || pending || !studentId || reason.trim().length < 3}>Flag for later</Button>
        </div>
      ) : (
        <p className="m-0 mt-3 text-[13px] text-ink-muted">There is no session roster to flag.</p>
      )}
      <p role="status" className={cn("m-0 mt-3 text-[12px]", state.kind === "error" ? "font-semibold text-blocked-700" : state.kind === "done" ? "font-semibold text-complete-700" : "text-ink-muted")}>
        {state.message ?? (canFlag ? "Nothing is created until you choose a student and describe the reason." : "Follow-up flags open when the session starts.")}
      </p>
    </CardV2>
  );
}

function ReflectionPanel({ detail, session }: { detail: TeachingClass; session: TeachingSession }) {
  const router = useRouter();
  const [wentWell, setWentWell] = useState(session.reflection?.wentWell ?? "");
  const [struggled, setStruggled] = useState(session.reflection?.struggled ?? "");
  const [followUpStudentId, setFollowUpStudentId] = useState("");
  const [changeNextTime, setChangeNextTime] = useState(session.reflection?.changeNextTime ?? "");
  const [logisticsIssue, setLogisticsIssue] = useState(session.reflection?.logisticsIssue ?? "");
  const [needsCpHelp, setNeedsCpHelp] = useState(session.reflection?.needsCpHelp ?? false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InlineState>({ kind: "idle" });
  const canSubmit = session.state.lifecycle === "after" && (session.state.attendance === "complete" || session.state.attendance === "not_required");

  useEffect(() => {
    setWentWell(session.reflection?.wentWell ?? "");
    setStruggled(session.reflection?.struggled ?? "");
    setFollowUpStudentId("");
    setChangeNextTime(session.reflection?.changeNextTime ?? "");
    setLogisticsIssue(session.reflection?.logisticsIssue ?? "");
    setNeedsCpHelp(session.reflection?.needsCpHelp ?? false);
    setState({ kind: "idle" });
  }, [session]);

  function submit() {
    startTransition(async () => {
      const result = await submitSessionReflection({
        offeringId: detail.id,
        sessionId: session.id,
        wentWell,
        struggled,
        followUpStudentId: followUpStudentId || undefined,
        changeNextTime,
        logisticsIssue,
        needsCpHelp,
      });
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      setState({ kind: "done", message: "Session recap saved." });
      router.refresh();
    });
  }

  return (
    <CardV2 padding="lg" className="max-w-3xl shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="m-0 text-[16px] font-semibold text-ink">Session recap</h3>
          <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted">Specific enough that another instructor could understand what happened and what comes next.</p>
        </div>
        <span className={session.reflection ? "text-[12px] font-semibold text-complete-700" : "text-[12px] font-semibold text-progress-700"}>{session.reflection ? "Submitted" : "Not submitted"}</span>
      </div>
      <div className="mt-5 space-y-4">
        <RecapField label="What happened and what did students learn?" value={wentWell} onChange={setWentWell} placeholder="Example: Students built their first working loop. Most could explain why it repeats; we will revisit nested loops next time." />
        <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
          <label className="block text-[12px] font-semibold text-ink-muted">
            Student to follow up with (optional)
            <select value={followUpStudentId} onChange={(event) => setFollowUpStudentId(event.target.value)} className="mt-1 h-9 w-full rounded-[8px] border border-line-card bg-surface px-2.5 text-[13px] font-normal text-ink outline-none focus:border-brand-400">
              <option value="">General class concern</option>
              {detail.roster.filter((student) => session.expectedStudentIds.includes(student.studentId)).map((student) => <option key={student.studentId} value={student.studentId}>{student.name}</option>)}
            </select>
            <span className="mt-1 block font-normal leading-5">Choosing a student creates one follow-up on the Students page.</span>
          </label>
          <RecapField label="Who or what needs follow-up? (optional)" value={struggled} onChange={setStruggled} placeholder="Name the learning need or class concern and the next step." />
        </div>
        <details className="rounded-[10px] border border-line-card bg-surface-soft">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-ink">Add teaching or operations detail</summary>
          <div className="space-y-4 border-t border-line-card px-4 py-4">
            <RecapField label="What will you change next time?" value={changeNextTime} onChange={setChangeNextTime} />
            <RecapField label="Material, room, technology, or operational issue" value={logisticsIssue} onChange={setLogisticsIssue} />
            <label className="flex items-start gap-2.5 text-[13px] leading-5 text-ink">
              <input type="checkbox" checked={needsCpHelp} onChange={(event) => setNeedsCpHelp(event.target.checked)} className="mt-0.5 size-4" />
              <span>I need help from my Chapter President. This creates one leadership follow-up from this recap.</span>
            </label>
          </div>
        </details>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className={cn("m-0 text-[12px]", state.kind === "error" ? "font-semibold text-blocked-700" : state.kind === "done" ? "font-semibold text-complete-700" : "text-ink-muted")}>
          {state.message ?? (canSubmit ? "One useful note is required." : session.state.lifecycle !== "after" ? "The recap opens after class ends." : "Finish attendance before the recap.")}
        </p>
        <Button variant="primary" size="md" onClick={submit} loading={pending} disabled={!canSubmit || pending}>{session.reflection ? "Update recap" : "Submit recap"}</Button>
      </div>
    </CardV2>
  );
}

function RecapField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-[12px] font-semibold text-ink-muted">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder={placeholder} className="mt-1 w-full resize-y rounded-[8px] border border-line-card bg-surface px-3 py-2 text-[13px] font-normal leading-5 text-ink outline-none focus:border-brand-400" />
    </label>
  );
}

function RosterPanel({ detail }: { detail: TeachingClass }) {
  return (
    <div className="mt-5 divide-y divide-line-card overflow-hidden rounded-[16px] border border-line-card bg-surface">
      {detail.roster.map((student) => {
        const attention = detail.studentAttention.filter((item) => item.studentId === student.studentId);
        return (
          <article id={`student-${student.studentId}`} key={student.studentId} className="scroll-mt-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="m-0 text-[14px] font-semibold text-ink">{student.name}</h3>
                <p className="m-0 mt-0.5 text-[12px] text-ink-muted">{student.status.toLowerCase()}</p>
                {student.signupGoal ? <p className="m-0 mt-2 text-[12.5px] leading-5 text-ink-muted"><strong>Class goal:</strong> {student.signupGoal}</p> : null}
                {student.signupNote ? <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted"><strong>Signup note:</strong> {student.signupNote}</p> : null}
                {student.instructorNotes ? <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted"><strong>Teaching note:</strong> {student.instructorNotes}</p> : null}
                {attention.map((item) => <p key={item.key} className="m-0 mt-2 text-[12.5px] leading-5 text-progress-800"><strong>Needs attention:</strong> {item.reason}</p>)}
              </div>
              {attention.length > 0 ? <ButtonLink href={`/instructor/students?class=${detail.id}#student-${student.studentId}`} variant="secondary" size="sm" className="self-start">Complete follow-up</ButtonLink> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
