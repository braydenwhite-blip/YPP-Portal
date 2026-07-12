import Link from "next/link";

import { ButtonLink, EmptyStateV2 } from "@/components/ui-v2";
import type {
  InstructorTeachingWorkspace,
  TeachingClass,
} from "@/lib/classes/instructor-workspace";

function nextLabel(teachingClass: TeachingClass) {
  if (!teachingClass.nextSession) return "No upcoming session scheduled";
  const session = teachingClass.nextSession;
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: teachingClass.timezone,
  }).format(session.state.startsAt);
  return `${when} · Session ${session.sessionNumber}: ${session.topic}`;
}

export function InstructorClassesList({ workspace }: { workspace: InstructorTeachingWorkspace }) {
  return (
    <main className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-7 sm:px-6 lg:px-8 lg:pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.09em] text-brand-700">Teaching</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">Classes</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-ink-muted">
            Every class you have accepted responsibility for, shown once with its next session and next required action.
          </p>
        </div>
        <ButtonLink href="/" variant="ghost" size="sm">Back to instructor home</ButtonLink>
      </header>

      {workspace.activeClasses.length === 0 ? (
        <div className="mt-8">
          <EmptyStateV2
            title="No active classes assigned"
            body="A class appears here after you are assigned as the lead instructor or accept a teaching assignment."
          />
        </div>
      ) : (
        <section className="mt-8 divide-y divide-line-card overflow-hidden rounded-[18px] border border-line-card bg-surface shadow-card">
          {workspace.activeClasses.map((teachingClass) => (
            <ClassResponsibility key={teachingClass.id} teachingClass={teachingClass} />
          ))}
        </section>
      )}

      {workspace.completedClasses.length > 0 ? (
        <details className="mt-8 rounded-[14px] border border-line-card bg-surface">
          <summary className="cursor-pointer px-5 py-4 text-[14px] font-semibold text-ink">
            Completed classes ({workspace.completedClasses.length})
          </summary>
          <div className="divide-y divide-line-card border-t border-line-card">
            {workspace.completedClasses.map((teachingClass) => (
              <ClassResponsibility key={teachingClass.id} teachingClass={teachingClass} compact />
            ))}
          </div>
        </details>
      ) : null}
    </main>
  );
}

function ClassResponsibility({
  teachingClass,
  compact = false,
}: {
  teachingClass: TeachingClass;
  compact?: boolean;
}) {
  const prep = teachingClass.nextSession?.state.preparation;
  return (
    <article className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/instructor/classes/${teachingClass.id}`} className="text-[18px] font-semibold tracking-[-0.015em] text-ink hover:text-brand-700 hover:underline">
              {teachingClass.title}
            </Link>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {teachingClass.status.replaceAll("_", " ").toLowerCase()}
            </span>
          </div>
          <p className="m-0 mt-2 text-[13px] font-medium text-ink">{nextLabel(teachingClass)}</p>
          {!compact ? (
            <>
              <p className="m-0 mt-2 text-[13.5px] leading-5 text-ink-muted">{teachingClass.stateReason}</p>
              <dl className="mt-4 grid gap-3 text-[12.5px] sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-ink-muted">Preparation</dt>
                  <dd className="m-0 mt-1 text-ink">
                    {prep ? (prep.complete ? "Complete" : prep.incompleteReasons[0]) : "No upcoming session"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-muted">YPP waiting</dt>
                  <dd className="m-0 mt-1 text-ink">
                    {teachingClass.leadershipRequests.length > 0
                      ? `${teachingClass.leadershipRequests.length} recorded request${teachingClass.leadershipRequests.length === 1 ? "" : "s"}`
                      : "Nothing recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-muted">Student follow-up</dt>
                  <dd className="m-0 mt-1 text-ink">
                    {teachingClass.studentAttention.length > 0
                      ? `${teachingClass.studentAttention.length} actionable reason${teachingClass.studentAttention.length === 1 ? "" : "s"}`
                      : "None open"}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
        </div>
        <ButtonLink
          href={teachingClass.primaryAction?.href ?? `/instructor/classes/${teachingClass.id}`}
          variant={teachingClass.primaryAction ? "primary" : "secondary"}
          size="md"
          className="self-start"
        >
          {teachingClass.primaryAction?.label ?? "View class recap"}
        </ButtonLink>
      </div>
    </article>
  );
}

