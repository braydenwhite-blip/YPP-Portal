import { EntityActionPanel } from "@/components/work/entity-action-panel";
import { EntityWorkflowCard } from "@/components/workflow-engine/entity-workflow-card";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import {
  isActionTrackerEnabled,
  isOperationsHubEnabled,
} from "@/lib/feature-flags";
import { getOperationalContextForEntity } from "@/lib/people-strategy/operational-context-queries";
import { toActionLite } from "@/lib/people-strategy/operational-digest";
import { loadStudentRecord } from "@/lib/people/student-record";
import {
  ButtonLink,
  EntityChip,
  KeyFactsGrid,
  ProfileHeader,
  RecordSection,
  StatusBadge,
  type KeyFact,
  type StatusTone,
} from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Student record — Pathways Portal" };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pretty(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

const ADVISING_STATUS_TONE: Record<string, StatusTone> = {
  ENGAGED: "success",
  NEEDS_ATTENTION: "warning",
  INACTIVE: "neutral",
  READY_FOR_NEXT: "info",
};

const ENROLLMENT_TONE: Record<string, StatusTone> = {
  ENROLLED: "success",
  WAITLISTED: "info",
  DROPPED: "neutral",
  COMPLETED: "neutral",
};

/**
 * Student full-360 (Knowledge OS V2, plan §12) — identity, enrolled classes,
 * mentor and parent/guardian links, open work, and — front and center — the
 * advisor relationship: assignment, check-in cadence and dates, overdue
 * state, follow-up flag, next steps, recommendations, and recent advising
 * notes. Concrete facts only; "student health/risk" labels are banned (§19).
 */
export default async function AdminStudentRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const now = new Date();
  const student = await loadStudentRecord(id, now);
  if (!student) notFound();

  const operationsEnabled = isOperationsHubEnabled() && isActionTrackerEnabled();
  const opsContext = operationsEnabled
    ? await getOperationalContextForEntity("USER", id, {
        id: session?.user?.id ?? "",
        roles,
        primaryRole: session?.user?.primaryRole ?? null,
        adminSubtypes: session?.user?.adminSubtypes ?? [],
      })
    : null;
  const actionLites = (opsContext?.actions ?? []).map((a) => toActionLite(a, now));
  const openActions = actionLites.filter(
    (a) => a.status !== "COMPLETE" && a.status !== "DROPPED"
  );
  const overdueActions = openActions.filter((a) => a.overdue);

  const advising = student.advising;
  const activeClasses = student.classes.filter((c) => c.status === "ENROLLED");
  const pastClasses = student.classes.filter((c) => c.status !== "ENROLLED");

  // Concrete next step: the advisor relationship drives it (plan §12).
  const nextStep = !advising
    ? {
        title: "Assign an advisor",
        detail: "This student has no active advisor assignment.",
        href: "/admin/leadership",
      }
    : advising.overdue
      ? {
          title: "Log an advisor check-in",
          detail: `Check-in was due ${fmtDate(advising.nextCheckInISO)} (every ${advising.checkInCadenceDays} days).`,
          href: `/my-advisees/${advising.assignmentId}`,
        }
      : advising.needsFollowUp
        ? {
            title: "Resolve the advisor follow-up",
            detail: advising.followUpNote ?? "The advisor flagged this student for follow-up.",
            href: `/my-advisees/${advising.assignmentId}`,
          }
        : null;

  const headerBadges = (
    <>
      {!advising ? <StatusBadge tone="danger">No advisor</StatusBadge> : null}
      {advising?.overdue ? (
        <StatusBadge
          tone="danger"
          title={`Next check-in was due ${fmtDate(advising.nextCheckInISO)}`}
        >
          Check-in overdue
        </StatusBadge>
      ) : null}
      {advising?.needsFollowUp ? (
        <StatusBadge tone="warning" title={advising.followUpNote ?? undefined}>
          Follow-up flagged
        </StatusBadge>
      ) : null}
    </>
  );

  const facts: KeyFact[] = [
    {
      label: "Advisor",
      value: advising ? advising.advisor.name : "None assigned",
      tone: advising ? undefined : "attention",
      href: "#advisor",
    },
    ...(advising
      ? [
          {
            label: "Last check-in",
            value: advising.lastCheckInISO
              ? fmtDate(advising.lastCheckInISO)
              : "Never",
            href: "#advisor",
          },
          {
            label: "Next check-in",
            value: advising.nextCheckInISO
              ? fmtDate(advising.nextCheckInISO)
              : "Not scheduled",
            detail: advising.overdue ? "overdue" : undefined,
            tone: advising.overdue ? ("attention" as const) : undefined,
            href: "#advisor",
          },
        ]
      : []),
    {
      label: "Classes enrolled",
      value: String(activeClasses.length),
      detail:
        pastClasses.length > 0 ? `${pastClasses.length} past` : undefined,
      href: "#classes",
    },
    ...(student.mentor
      ? [{ label: "Mentor", value: student.mentor.name, href: "#relationships" }]
      : []),
    ...(operationsEnabled
      ? [
          {
            label: "Open actions",
            value: String(openActions.length),
            detail:
              overdueActions.length > 0
                ? `${overdueActions.length} overdue`
                : undefined,
            tone: overdueActions.length > 0 ? ("attention" as const) : undefined,
            href: "#work",
          },
        ]
      : []),
  ];

  const identityLine = [
    student.email,
    student.grade ? `Grade ${student.grade}` : null,
    student.school,
    student.chapterName,
    `Joined ${fmtDate(student.joinedAtISO)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <ProfileHeader
        name={student.name}
        eyebrow="Student record"
        identityLine={identityLine}
        avatarUrl={student.avatarUrl}
        backHref="/people?role=student"
        backLabel="People · Students"
        badges={headerBadges}
        actions={
          <>
            {operationsEnabled ? (
              <ButtonLink
                href={`/actions/new?relatedType=USER&relatedId=${id}`}
                variant="primary"
                size="md"
              >
                Create action
              </ButtonLink>
            ) : null}
            {advising ? (
              <ButtonLink href={`/my-advisees/${advising.assignmentId}`} size="md">
                Advising workspace
              </ButtonLink>
            ) : (
              <ButtonLink href="/admin/leadership" size="md">
                Assign advisor
              </ButtonLink>
            )}
          </>
        }
      />

      <KeyFactsGrid facts={facts} />

      {nextStep ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warning-700/25 bg-warning-100/40 px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-warning-700">
              Next step
            </p>
            <p className="m-0 text-[14.5px] font-semibold text-ink">{nextStep.title}</p>
            <p className="m-0 text-[12.5px] text-ink-muted">{nextStep.detail}</p>
          </div>
          <ButtonLink href={nextStep.href} size="sm">
            Go to it →
          </ButtonLink>
        </div>
      ) : null}

      <RecordSection
        id="advisor"
        title="Advisor"
        description="The advising relationship: who, the check-in rhythm, and what this student needs next."
        action={
          advising ? (
            <ButtonLink
              href={`/my-advisees/${advising.assignmentId}`}
              variant="ghost"
              size="sm"
            >
              Log check-in / open workspace →
            </ButtonLink>
          ) : (
            <ButtonLink href="/admin/leadership" variant="ghost" size="sm">
              Assign an advisor →
            </ButtonLink>
          )
        }
      >
        {!advising ? (
          <p className="m-0 text-[13.5px] text-ink">
            No active advisor assignment.{" "}
            <span className="text-ink-muted">
              Assign one from the leadership dashboard — students without advisors
              surface in People and the attention queue until then.
            </span>
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <EntityChip
                type="person"
                id={advising.advisor.id}
                label={advising.advisor.name}
                sublabel="Advisor"
                href={`/admin/instructors/${advising.advisor.id}`}
              />
              <StatusBadge
                tone={ADVISING_STATUS_TONE[advising.advisingStatus] ?? "neutral"}
              >
                {pretty(advising.advisingStatus)}
              </StatusBadge>
              <span className="text-[12.5px] text-ink-muted">
                Advising since {fmtDate(advising.startDateISO)} · check-ins every{" "}
                {advising.checkInCadenceDays} days
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-[8px] bg-surface-soft px-3.5 py-2.5">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Last check-in
                </p>
                <p className="m-0 text-[13.5px] font-semibold text-ink">
                  {advising.lastCheckInISO ? fmtDate(advising.lastCheckInISO) : "Never"}
                </p>
              </div>
              <div className="rounded-[8px] bg-surface-soft px-3.5 py-2.5">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Next check-in
                </p>
                <p
                  className={
                    advising.overdue
                      ? "m-0 text-[13.5px] font-semibold text-danger-700"
                      : "m-0 text-[13.5px] font-semibold text-ink"
                  }
                >
                  {advising.nextCheckInISO
                    ? `${fmtDate(advising.nextCheckInISO)}${advising.overdue ? " · overdue" : ""}`
                    : "Not scheduled"}
                </p>
              </div>
              <div className="rounded-[8px] bg-surface-soft px-3.5 py-2.5">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Follow-up
                </p>
                <p className="m-0 text-[13.5px] font-semibold text-ink">
                  {advising.needsFollowUp ? "Flagged" : "None open"}
                </p>
                {advising.followUpNote ? (
                  <p className="m-0 text-[12px] text-ink-muted">{advising.followUpNote}</p>
                ) : null}
              </div>
            </div>

            {advising.nextSteps ? (
              <div>
                <p className="m-0 mb-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Next steps (advisor&apos;s summary)
                </p>
                <p className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
                  {advising.nextSteps}
                </p>
              </div>
            ) : null}

            {advising.recommendations.length > 0 ? (
              <div>
                <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Recommendations
                </p>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {advising.recommendations.map((rec) => (
                    <li
                      key={rec.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-[8px] border border-line-soft px-3.5 py-2.5"
                    >
                      <span className="text-[13.5px] font-semibold text-ink">
                        {rec.href ? (
                          <a href={rec.href} className="text-brand-700 hover:underline">
                            {rec.title}
                          </a>
                        ) : (
                          rec.title
                        )}
                        <span className="ml-2 font-normal text-ink-muted">
                          {pretty(rec.kind)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-[12px] text-ink-muted">
                        <StatusBadge
                          tone={rec.status === "COMPLETED" ? "success" : "neutral"}
                        >
                          {pretty(rec.status)}
                        </StatusBadge>
                        {fmtDate(rec.createdAtISO)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {advising.notes.length > 0 ? (
              <div>
                <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Recent advising notes
                </p>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {advising.notes.map((note) => (
                    <li key={note.id} className="rounded-[8px] bg-surface-soft px-3.5 py-2.5">
                      <p className="m-0 text-[12px] text-ink-muted">
                        {pretty(note.kind)} · {note.authorName} ·{" "}
                        {fmtDate(note.createdAtISO)}
                      </p>
                      <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-ink">
                        {note.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </RecordSection>

      <RecordSection
        id="classes"
        title="Classes"
        description="Class enrollments with attendance — current first."
      >
        {student.classes.length === 0 && student.legacyCourses.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">No enrollments yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {[...activeClasses, ...pastClasses].map((row) => (
              <div
                key={row.enrollmentId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft px-3.5 py-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <EntityChip
                    type="class"
                    id={row.offering.id}
                    label={row.offering.title}
                    href={`/admin/classes/${row.offering.id}`}
                  />
                  <StatusBadge tone={ENROLLMENT_TONE[row.status] ?? "neutral"}>
                    {pretty(row.status)}
                  </StatusBadge>
                </div>
                <span className="text-[12.5px] text-ink-muted">
                  {[
                    row.offering.semester,
                    row.leadInstructor ? `Instructor: ${row.leadInstructor.name}` : null,
                    row.sessionTotal > 0
                      ? `Attended ${row.sessionsAttended}/${row.sessionTotal} sessions`
                      : null,
                    `Enrolled ${fmtDate(row.enrolledAtISO)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ))}
            {student.legacyCourses.length > 0 ? (
              <div className="mt-1 border-t border-line-soft pt-3">
                <p className="m-0 mb-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Legacy courses
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                  {student.legacyCourses.map((course) => (
                    <span key={course.enrollmentId}>
                      {course.courseTitle} · {pretty(course.status)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </RecordSection>

      {(student.mentor || student.parents.length > 0 || student.certificateCount > 0) && (
        <RecordSection
          id="relationships"
          title="Mentorship & family"
          description="Mentor relationship and approved parent/guardian links."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {student.mentor ? (
                <EntityChip
                  type="person"
                  id={student.mentor.id}
                  label={student.mentor.name}
                  sublabel={`Mentor since ${fmtDate(student.mentor.sinceISO)}`}
                  href={`/people/${student.mentor.id}`}
                />
              ) : null}
              {student.parents.map((parent) => (
                <EntityChip
                  key={parent.id}
                  type="person"
                  id={parent.id}
                  label={parent.name}
                  sublabel={parent.relationship}
                  href={`/people/${parent.id}`}
                />
              ))}
            </div>
            {student.certificateCount > 0 ? (
              <p className="m-0 text-[13px] text-ink-muted">
                {student.certificateCount} certificate
                {student.certificateCount === 1 ? "" : "s"} earned.
              </p>
            ) : null}
          </div>
        </RecordSection>
      )}

      {operationsEnabled && opsContext ? (
        <RecordSection
          id="work"
          title="Action operating panel"
          description="The action work linked to this student — what's open, what's stuck, and the suggested next move."
        >
          <EntityActionPanel
            actions={opsContext.actions}
            viewer={{
              id: session?.user?.id ?? "",
              roles,
              primaryRole: session?.user?.primaryRole ?? null,
              adminSubtypes: session?.user?.adminSubtypes ?? [],
            }}
            entityType="USER"
            entityId={id}
            entityLabel={student.name}
            now={now}
          />
        </RecordSection>
      ) : null}

      {/* Advising workflow — the active playbook (if any) running for this
          student, with stage, health reason, and next step, so advising
          never stalls silently. Pinned to the student-advising template so the
          card resolves + starts ONLY the advising playbook, never an unrelated
          workflow sharing this person's USER subject. */}
      <EntityWorkflowCard
        entityType="USER"
        entityId={id}
        templateKey="student-advising"
        title="Advising workflow"
      />

    </div>
  );
}
