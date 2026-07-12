import Link from "next/link";

import { ButtonLink, EmptyStateV2 } from "@/components/ui-v2";
import type {
  InstructorTeachingWorkspace,
  TeachingClass,
  TeachingSession,
} from "@/lib/classes/instructor-workspace";

type ScheduledSession = { teachingClass: TeachingClass; session: TeachingSession };

function sessionLabel(item: ScheduledSession) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: item.teachingClass.timezone,
    timeZoneName: "short",
  }).format(item.session.state.startsAt);
}

export function InstructorScheduleView({ workspace }: { workspace: InstructorTeachingWorkspace }) {
  const all = workspace.activeClasses.flatMap((teachingClass) =>
    teachingClass.sessions
      .filter((session) => !session.isCancelled)
      .map((session) => ({ teachingClass, session }))
  );
  const upcoming = all
    .filter((item) => item.session.state.lifecycle === "before" || item.session.state.lifecycle === "during")
    .sort((a, b) => a.session.state.startsAt.getTime() - b.session.state.startsAt.getTime());
  const recent = all
    .filter((item) => item.session.state.lifecycle === "after")
    .sort((a, b) => b.session.state.startsAt.getTime() - a.session.state.startsAt.getTime())
    .slice(0, 12);

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 pb-20 pt-7 sm:px-6 lg:px-8 lg:pt-10">
      <header>
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.09em] text-brand-700">Teaching</p>
        <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">Schedule</h1>
        <p className="m-0 mt-2 max-w-3xl text-[14px] leading-6 text-ink-muted">
          Your assigned teaching sessions only. Interview, mentorship, and general YPP events stay out of this calendar.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="m-0 text-[19px] font-semibold text-ink">Upcoming sessions</h2>
        {upcoming.length === 0 ? (
          <div className="mt-4">
            <EmptyStateV2 title="No upcoming teaching session" body="Open a class to review its past sessions or finish its schedule." />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-line-card overflow-hidden rounded-[18px] border border-line-card bg-surface shadow-card">
            {upcoming.map((item) => <ScheduleRow key={item.session.id} item={item} />)}
          </div>
        )}
      </section>

      {recent.length > 0 ? (
        <details className="mt-8 rounded-[14px] border border-line-card bg-surface">
          <summary className="cursor-pointer px-5 py-4 text-[14px] font-semibold text-ink">Recent sessions ({recent.length})</summary>
          <div className="divide-y divide-line-card border-t border-line-card">
            {recent.map((item) => <ScheduleRow key={item.session.id} item={item} compact />)}
          </div>
        </details>
      ) : null}
    </main>
  );
}

function ScheduleRow({ item, compact = false }: { item: ScheduledSession; compact?: boolean }) {
  const { teachingClass, session } = item;
  return (
    <article className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-[12.5px] font-semibold text-brand-700">{sessionLabel(item)}</p>
          <h3 className="m-0 mt-1.5 text-[16px] font-semibold text-ink">{teachingClass.title}</h3>
          <p className="m-0 mt-0.5 text-[13px] text-ink-muted">Session {session.sessionNumber}: {session.topic}</p>
          {!compact ? (
            <div className="mt-3 grid gap-1 text-[12.5px] text-ink-muted sm:grid-cols-2 sm:gap-x-6">
              <p className="m-0"><strong className="font-semibold text-ink">Where:</strong> {teachingClass.locationLabel}</p>
              <p className="m-0"><strong className="font-semibold text-ink">Preparation:</strong> {session.state.preparation.complete ? "Complete" : session.state.preparation.incompleteReasons[0]}</p>
            </div>
          ) : null}
        </div>
        <ButtonLink href={session.state.action.href} variant={session.state.action.rank <= 1 ? "primary" : "secondary"} size="sm" className="self-start">
          {session.state.action.label}
        </ButtonLink>
      </div>
    </article>
  );
}

