import Link from "next/link";

import { ButtonLink, CardV2 } from "@/components/ui-v2";
import type {
  InstructorTeachingWorkspace,
  TeachingClass,
  TeachingSession,
} from "@/lib/classes/instructor-workspace";
import { InstructorRequestCompletion } from "@/components/instructor/instructor-request-completion";

function dateTimeLabel(session: TeachingSession, timezone: string) {
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(session.state.startsAt);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(session.state.startsAt);
  return `${date} at ${time}`;
}

function shortSessionLabel(session: TeachingSession, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(session.state.startsAt);
}

function greeting(name: string) {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${salutation}, ${name}.` : `${salutation}.`;
}

export function InstructorTeachingHome({
  name,
  workspace,
}: {
  name: string;
  workspace: InstructorTeachingWorkspace;
}) {
  const next = workspace.nextClass;
  const priority = workspace.priorityAction;
  const otherClasses = workspace.activeClasses.filter(
    (teachingClass) => teachingClass.id !== next?.teachingClass.id
  );

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-7 sm:px-6 lg:px-8 lg:pt-10">
      <header className="max-w-3xl">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.09em] text-brand-700">
          Instructor home
        </p>
        <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">
          {greeting(name)}
        </h1>
        <p className="m-0 mt-2 text-[15px] leading-6 text-ink-muted">
          Your next class, the exact preparation it needs, and anything still waiting on you.
        </p>
      </header>

      {next ? (
        <section className="mt-7 overflow-hidden rounded-[18px] border border-line-card bg-surface shadow-card">
          <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
            <div className="p-5 sm:p-7 lg:p-8">
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Next class</p>
              <h2 className="m-0 mt-2 text-[25px] font-semibold tracking-[-0.025em] text-ink sm:text-[30px]">
                {next.teachingClass.title}
              </h2>
              <p className="m-0 mt-1 text-[16px] font-medium text-brand-800">
                Session {next.session.sessionNumber}: {next.session.topic}
              </p>

              <dl className="mt-6 grid gap-4 text-[13.5px] sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-ink-muted">When</dt>
                  <dd className="m-0 mt-1 leading-5 text-ink">
                    {dateTimeLabel(next.session, next.teachingClass.timezone)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-muted">Where</dt>
                  <dd className="m-0 mt-1 leading-5 text-ink">{next.teachingClass.locationLabel}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-muted">Students</dt>
                  <dd className="m-0 mt-1 leading-5 text-ink">
                    {next.session.expectedStudentIds.length} expected
                  </dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-line-card pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="m-0 text-[13px] font-bold text-ink">Preparation</h3>
                  <span className={next.session.state.preparation.complete ? "text-[12px] font-semibold text-complete-700" : "text-[12px] font-semibold text-progress-700"}>
                    {next.session.state.preparation.complete ? "Complete" : `${next.session.state.preparation.incompleteReasons.length} item${next.session.state.preparation.incompleteReasons.length === 1 ? "" : "s"} incomplete`}
                  </span>
                </div>
                {next.session.state.preparation.complete ? (
                  <p className="m-0 mt-2 text-[13.5px] leading-5 text-ink-muted">
                    You reviewed the lesson, materials, location, and permitted student context.
                  </p>
                ) : (
                  <ul className="m-0 mt-2 space-y-1.5 pl-5 text-[13px] leading-5 text-ink-muted">
                    {next.session.state.preparation.incompleteReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>

              {next.session.materials.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
                  {next.session.materials.slice(0, 4).map((material) =>
                    material.href ? (
                      <Link key={material.key} href={material.href} className="font-semibold text-brand-700 hover:underline">
                        {material.label}
                      </Link>
                    ) : (
                      <span key={material.key} className="text-ink-muted">{material.label}</span>
                    )
                  )}
                </div>
              ) : null}

              {next.teachingClass.roster.some(
                (student) =>
                  next.session.expectedStudentIds.includes(student.studentId) &&
                  (student.signupGoal || student.signupNote || student.instructorNotes)
              ) ? (
                <div className="mt-5 border-l-2 border-brand-200 pl-3">
                  <p className="m-0 text-[12px] font-semibold text-ink">Permitted student context</p>
                  <ul className="m-0 mt-1.5 space-y-1 pl-4 text-[12.5px] leading-5 text-ink-muted">
                    {next.teachingClass.roster
                      .filter(
                        (student) =>
                          next.session.expectedStudentIds.includes(student.studentId) &&
                          (student.signupGoal || student.signupNote || student.instructorNotes)
                      )
                      .slice(0, 2)
                      .map((student) => (
                        <li key={student.studentId}>
                          <strong className="font-semibold text-ink">{student.name}:</strong>{" "}
                          {student.instructorNotes ?? student.signupNote ?? student.signupGoal}
                        </li>
                      ))}
                  </ul>
                  <Link href={`/instructor/classes/${next.teachingClass.id}?session=${next.session.id}#before`} className="mt-2 inline-flex text-[12.5px] font-semibold text-brand-700 hover:underline">
                    Review all context
                  </Link>
                </div>
              ) : null}
            </div>

            <aside className="border-t border-line-card bg-surface-soft p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">Do this next</p>
              {priority ? (
                <>
                  <h2 className="m-0 mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink">
                    {priority.title}
                  </h2>
                  {priority.className ? (
                    <p className="m-0 mt-1 text-[12.5px] font-semibold text-ink-muted">{priority.className}</p>
                  ) : null}
                  <p className="m-0 mt-3 text-[13.5px] leading-6 text-ink-muted">{priority.reason}</p>
                  <ButtonLink href={priority.href} variant="primary" size="lg" className="mt-6 w-full sm:w-auto">
                    {priority.label}
                  </ButtonLink>
                </>
              ) : (
                <>
                  <h2 className="m-0 mt-2 text-[20px] font-semibold text-ink">Nothing is waiting on you</h2>
                  <p className="m-0 mt-3 text-[13.5px] leading-6 text-ink-muted">
                    Your recorded teaching responsibilities are complete for now.
                  </p>
                </>
              )}
            </aside>
          </div>
        </section>
      ) : (
        <FirstTeachingState workspace={workspace} />
      )}

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <div className="min-w-0">
          <section>
            <SectionHeading
              title={next ? "Other teaching" : "My teaching"}
              detail={next
                ? "Other active responsibilities, each shown once with its next real action."
                : "Each active class appears once, with the next real responsibility stated in plain language."}
              href="/instructor/classes"
              linkLabel="All classes"
            />
            <div className="mt-4 divide-y divide-line-card overflow-hidden rounded-[16px] border border-line-card bg-surface">
              {otherClasses.length > 0 ? (
                otherClasses.map((teachingClass) => (
                  <TeachingClassRow key={teachingClass.id} teachingClass={teachingClass} />
                ))
              ) : (
                <p className="m-0 p-5 text-[13.5px] text-ink-muted">
                  {next
                    ? "Your next class above is your only active teaching responsibility."
                    : "No active classes are assigned to you."}
                </p>
              )}
            </div>
          </section>

          <section className="mt-10">
            <SectionHeading
              title="Students needing attention"
              detail="Only students with a concrete reason and a follow-up you can complete are shown."
              href="/instructor/students"
              linkLabel="Open students"
            />
            <div className="mt-4 divide-y divide-line-card overflow-hidden rounded-[16px] border border-line-card bg-surface">
              {workspace.studentsNeedingAttention.length > 0 ? (
                workspace.studentsNeedingAttention.slice(0, 5).map((item) => (
                  <div key={item.key} className="p-4 sm:flex sm:items-start sm:justify-between sm:gap-5 sm:p-5">
                    <div>
                      <p className="m-0 text-[14px] font-semibold text-ink">{item.studentName}</p>
                      <p className="m-0 mt-0.5 text-[12px] font-medium text-ink-muted">{item.className}</p>
                      <p className="m-0 mt-2 text-[13px] leading-5 text-ink-muted">{item.reason}</p>
                      <p className="m-0 mt-1 text-[13px] font-medium text-ink">Next: {item.expectedAction}</p>
                    </div>
                    <Link href={item.href} className="mt-3 inline-flex shrink-0 text-[13px] font-semibold text-brand-700 hover:underline sm:mt-0">
                      Complete follow-up
                    </Link>
                  </div>
                ))
              ) : (
                <p className="m-0 p-5 text-[13.5px] text-ink-muted">
                  No student has an unresolved attendance or required-work reason right now.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-8">
          <section>
            <SectionHeading title="YPP requests" detail="Class-related work leadership assigned directly to you." />
            <CardV2 padding="none" className="mt-4 overflow-hidden shadow-none">
              {workspace.leadershipRequests.length > 0 ? (
                <div className="divide-y divide-line-card">
                  {workspace.leadershipRequests.map((request) => (
                    <InstructorRequestCompletion key={request.id} request={request} />
                  ))}
                </div>
              ) : (
                <p className="m-0 p-4 text-[13px] leading-5 text-ink-muted">
                  Leadership is not waiting on any recorded class request from you.
                </p>
              )}
            </CardV2>
          </section>

          <section>
            <SectionHeading title="How teaching is going" detail="Specific completion evidence, not a mystery score." />
            <CardV2 padding="md" className="mt-4 shadow-none">
              {workspace.evidence.sessionsHeld > 0 ? (
                <ul className="m-0 space-y-3 p-0 text-[13px] leading-5 text-ink-muted [list-style:none]">
                  <li>
                    <strong className="font-semibold text-ink">Attendance:</strong>{" "}
                    complete for {workspace.evidence.attendanceComplete} of {workspace.evidence.sessionsHeld} held sessions.
                  </li>
                  <li>
                    <strong className="font-semibold text-ink">Session recaps:</strong>{" "}
                    {workspace.evidence.recapsComplete} of {workspace.evidence.sessionsHeld} submitted.
                  </li>
                  <li>
                    <strong className="font-semibold text-ink">Student evidence:</strong>{" "}
                    {workspace.evidence.feedbackCount > 0
                      ? `${workspace.evidence.feedbackCount} feedback response${workspace.evidence.feedbackCount === 1 ? "" : "s"}; ${workspace.evidence.recommendCount} would recommend their class.`
                      : "No class feedback has been submitted yet."}
                  </li>
                </ul>
              ) : (
                <p className="m-0 text-[13px] leading-5 text-ink-muted">
                  Evidence appears after your first recorded class session.
                </p>
              )}
            </CardV2>
          </section>
        </aside>
      </div>
    </main>
  );
}

function FirstTeachingState({ workspace }: { workspace: InstructorTeachingWorkspace }) {
  const action = workspace.priorityAction;
  return (
    <section className="mt-7 rounded-[18px] border border-line-card bg-surface p-6 shadow-card sm:p-8">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">Teaching home</p>
      <h2 className="m-0 mt-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">
        {workspace.classes.length === 0
          ? "No class is assigned yet"
          : action
            ? "One responsibility still needs you"
            : "No upcoming session is scheduled"}
      </h2>
      <p className="m-0 mt-3 max-w-2xl text-[14px] leading-6 text-ink-muted">
        {workspace.classes.length === 0
          ? "When YPP assigns your first class, its schedule, roster, lesson, materials, and next action will appear here automatically."
          : action
            ? "There is no future session on the calendar, but the recorded work below still needs to be completed."
            : "Your assigned classes are listed below. Open a class to review its existing sessions or finish its schedule."}
      </p>
      {action ? (
        <div className="mt-6 max-w-2xl border-l-2 border-progress-500 pl-4">
          <p className="m-0 text-[13px] font-semibold text-ink">Do this next: {action.title}</p>
          <p className="m-0 mt-1 text-[13px] leading-5 text-ink-muted">{action.reason}</p>
          <ButtonLink href={action.href} variant="primary" size="md" className="mt-4">
            {action.label}
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );
}

function TeachingClassRow({ teachingClass }: { teachingClass: TeachingClass }) {
  return (
    <article className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/instructor/classes/${teachingClass.id}`} className="text-[15px] font-semibold text-ink hover:text-brand-700 hover:underline">
            {teachingClass.title}
          </Link>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            {teachingClass.nextSession
              ? `Next: ${shortSessionLabel(teachingClass.nextSession, teachingClass.timezone)} · ${teachingClass.nextSession.topic}`
              : "No upcoming session scheduled"}
          </p>
          <p className="m-0 mt-2 text-[13px] leading-5 text-ink-muted">{teachingClass.stateReason}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-medium text-ink-muted">
            {teachingClass.leadershipRequests.length > 0 ? (
              <span>{teachingClass.leadershipRequests.length} YPP request{teachingClass.leadershipRequests.length === 1 ? "" : "s"} waiting</span>
            ) : null}
            {teachingClass.studentAttention.length > 0 ? (
              <span>{teachingClass.studentAttention.length} student follow-up{teachingClass.studentAttention.length === 1 ? "" : "s"}</span>
            ) : null}
          </div>
        </div>
        <ButtonLink
          href={teachingClass.primaryAction?.href ?? `/instructor/classes/${teachingClass.id}`}
          variant={teachingClass.primaryAction ? "secondary" : "ghost"}
          size="sm"
          className="self-start"
        >
          {teachingClass.primaryAction?.label ?? "Open class"}
        </ButtonLink>
      </div>
    </article>
  );
}

function SectionHeading({
  title,
  detail,
  href,
  linkLabel,
}: {
  title: string;
  detail: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="m-0 text-[19px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        <p className="m-0 mt-1 text-[13px] leading-5 text-ink-muted">{detail}</p>
      </div>
      {href && linkLabel ? (
        <Link href={href} className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
