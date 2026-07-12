import Link from "next/link";

import { ButtonLink, EmptyStateV2 } from "@/components/ui-v2";
import type { InstructorTeachingWorkspace } from "@/lib/classes/instructor-workspace";

export function InstructorMaterialsView({ workspace }: { workspace: InstructorTeachingWorkspace }) {
  const classesWithSessions = workspace.activeClasses.filter((teachingClass) => teachingClass.sessions.length > 0);
  return (
    <main className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-7 sm:px-6 lg:px-8 lg:pt-10">
      <header>
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.09em] text-brand-700">Teaching</p>
        <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-[34px]">Materials</h1>
        <p className="m-0 mt-2 max-w-3xl text-[14px] leading-6 text-ink-muted">
          Lesson plans, slides, activities, worksheets, and class supplies are grouped by the session where they are used.
        </p>
      </header>

      {classesWithSessions.length === 0 ? (
        <div className="mt-8">
          <EmptyStateV2 title="No session materials yet" body="Materials appear here after an assigned class has scheduled sessions." />
        </div>
      ) : (
        <div className="mt-8 space-y-7">
          {classesWithSessions.map((teachingClass) => (
            <section key={teachingClass.id}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="m-0 text-[19px] font-semibold text-ink">{teachingClass.title}</h2>
                  <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{teachingClass.scheduleLabel}</p>
                </div>
                <Link href={`/instructor/classes/${teachingClass.id}#before`} className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline">Open class</Link>
              </div>

              <div className="mt-4 divide-y divide-line-card overflow-hidden rounded-[16px] border border-line-card bg-surface">
                {teachingClass.sessions.filter((session) => !session.isCancelled).map((session) => (
                  <article key={session.id} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="m-0 text-[14px] font-semibold text-ink">Session {session.sessionNumber}: {session.topic}</p>
                        <p className="m-0 mt-1 text-[12px] text-ink-muted">
                          {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: teachingClass.timezone }).format(session.state.startsAt)}
                        </p>
                        {session.materials.length > 0 ? (
                          <ul className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-2 p-0 text-[12.5px] [list-style:none]">
                            {session.materials.map((material) => (
                              <li key={material.key}>
                                {material.href ? (
                                  <Link href={material.href} className="font-semibold text-brand-700 hover:underline">{material.label}</Link>
                                ) : (
                                  <span className="text-ink-muted">{material.label}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="m-0 mt-3 text-[12.5px] leading-5 text-progress-800">No teaching materials are attached to this session or class.</p>
                        )}
                      </div>
                      <ButtonLink href={`/instructor/classes/${teachingClass.id}?session=${session.id}#before`} variant={session.state.preparation.complete ? "ghost" : "secondary"} size="sm" className="self-start">
                        {session.state.preparation.complete ? "Review lesson" : "Finish preparation"}
                      </ButtonLink>
                    </div>
                  </article>
                ))}
              </div>

              {teachingClass.lessonPlans.some((plan) => !teachingClass.sessions.some((session) => session.lessonPlan?.id === plan.id)) ? (
                <details className="mt-3 rounded-[12px] border border-line-card bg-surface-soft">
                  <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-ink">Unlinked lesson plans</summary>
                  <div className="border-t border-line-card px-4 py-3 text-[12.5px] text-ink-muted">
                    {teachingClass.lessonPlans
                      .filter((plan) => !teachingClass.sessions.some((session) => session.lessonPlan?.id === plan.id))
                      .map((plan) => <p key={plan.id} className="m-0 py-1">{plan.title} · {plan.totalMinutes} min</p>)}
                    <p className="m-0 mt-2">Open a session’s preparation check to connect the correct plan.</p>
                  </div>
                </details>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

