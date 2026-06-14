import { EntityActionPanel } from "@/components/work/entity-action-panel";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import {
  formatInstructorOpsDate,
  formatInstructorOpsDateTime,
  formatInstructorOpsLabel,
  getInstructorOpsProfile,
} from "@/lib/instructor-ops";
import {
  isActionTrackerEnabled,
  isLeadershipRolesEnabled,
  isOperationsHubEnabled,
  isQuarterlyReviewsEnabled,
} from "@/lib/feature-flags";
import { getLatestQuarterlyReview } from "@/lib/people-strategy/quarterly-review-actions";
import { loadInstructorLeadership } from "@/lib/leadership/queries";
import { getOperationalContextForEntity } from "@/lib/people-strategy/operational-context-queries";
import { toActionLite } from "@/lib/people-strategy/operational-digest";
import {
  loadAdvisorCaseload,
  loadQuarterlyReviewHistory,
  loadUpcomingSessions,
} from "@/lib/people/instructor-record";
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
export const metadata = { title: "Instructor record — Pathways Portal" };

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

const CLASS_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  IN_PROGRESS: "success",
  COMPLETED: "neutral",
  CANCELLED: "danger",
};

/**
 * Instructor full-360 (Knowledge OS V2, plan §11) — the one page answering
 * "what does this instructor carry, and what do they need next?": identity,
 * current/past classes, upcoming sessions, reviews and interviews, mentorship,
 * leadership contributions, advisor caseload, open work, and activity — all
 * concrete facts, no bare performance labels (§19). Deep admin tooling (tags,
 * notes, tasks, the quarterly review form) lives at ./manage.
 */
export default async function AdminInstructorRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const now = new Date();
  const quarterlyEnabled = isQuarterlyReviewsEnabled();
  const leadershipEnabled = isLeadershipRolesEnabled();
  const operationsEnabled = isOperationsHubEnabled() && isActionTrackerEnabled();

  const [profile, leadership, latestReview, reviewHistory, caseload, upcomingSessions] =
    await Promise.all([
      getInstructorOpsProfile(id),
      leadershipEnabled ? loadInstructorLeadership(id) : Promise.resolve(null),
      quarterlyEnabled ? getLatestQuarterlyReview(id) : Promise.resolve(null),
      quarterlyEnabled ? loadQuarterlyReviewHistory(id) : Promise.resolve([]),
      loadAdvisorCaseload(id, now),
      loadUpcomingSessions(id, now),
    ]);
  if (!profile) notFound();

  const opsContext = operationsEnabled
    ? await getOperationalContextForEntity("USER", id, {
        id: session?.user?.id ?? "",
        roles,
        primaryRole: session?.user?.primaryRole ?? null,
        adminSubtypes: session?.user?.adminSubtypes ?? [],
      })
    : null;

  const { record, user, readiness } = profile;
  const classOfferings = asArray(user.classOfferingsInstructed);
  const currentClasses = classOfferings.filter((c: any) =>
    ["PUBLISHED", "IN_PROGRESS"].includes(c.status)
  );
  const pastClasses = classOfferings.filter(
    (c: any) => !["PUBLISHED", "IN_PROGRESS"].includes(c.status)
  );
  const legacyCourses = asArray(user.courses);
  const coInstructorAssignments = asArray(user.coInstructorAssignments);
  const mentorPair = asArray(user.menteePairs).find((p: any) => p.status === "ACTIVE");
  const mentees = asArray(user.mentorPairs).filter((p: any) => p.status === "ACTIVE");
  const instructorApplications = asArray(user.instructorApplications);
  const interviewReviews = instructorApplications.flatMap((application: any) =>
    asArray(application.interviewReviews).map((review: any, index: number) => ({
      id: `${application.id}-interview-${index}`,
      recommendation: review.recommendation,
      overallRating: review.overallRating,
      submittedAt: review.submittedAt,
    }))
  );
  const activeContributions = (leadership?.contributions ?? []).filter(
    (c) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(c.status)
  );

  const actionLites = (opsContext?.actions ?? []).map((a) => toActionLite(a, now));
  const openActions = actionLites.filter(
    (a) => a.status !== "COMPLETE" && a.status !== "DROPPED"
  );
  const overdueActions = openActions.filter((a) => a.overdue);
  const recentMeetings = (opsContext?.meetings ?? []).slice(0, 5);

  // Activity: application timeline events + growth events, newest first.
  const activity = [
    ...instructorApplications.flatMap((application: any) =>
      asArray(application.timeline).map((event: any) => ({
        id: event.id,
        title: formatInstructorOpsLabel(event.kind),
        detail: event.actor?.name ?? null,
        atISO: event.createdAt,
      }))
    ),
    ...asArray(user.instructorGrowthEvents).map((event: any) => ({
      id: event.id,
      title: event.title,
      detail: formatInstructorOpsLabel(event.status),
      atISO: event.occurredAt,
    })),
  ]
    .sort((a, b) => new Date(b.atISO).getTime() - new Date(a.atISO).getTime())
    .slice(0, 12);

  // The concrete next step (never a bare flag): attention queue first, then
  // onboarding blockers, then a missing first review.
  const attentionFlag = record.attentionFlags[0] ?? null;
  const missingRequirement = readiness.missingRequirements[0] ?? null;
  const nextStep = attentionFlag
    ? {
        title: attentionFlag.title,
        detail: attentionFlag.detail,
        // Some flags self-link to this record; send those to the admin tools.
        href:
          attentionFlag.href === `/admin/instructors/${id}`
            ? `/admin/instructors/${id}/manage`
            : attentionFlag.href,
      }
    : missingRequirement
      ? {
          title: missingRequirement.title,
          detail: missingRequirement.detail,
          href: missingRequirement.href,
        }
      : quarterlyEnabled && !latestReview
        ? {
            title: "Schedule the first quarterly review",
            detail: "No review is on record for this instructor yet.",
            href: `/admin/instructors/${id}/manage/strategy#quarterly-review`,
          }
        : null;

  const facts: KeyFact[] = [
    {
      label: "Current classes",
      value: String(currentClasses.length),
      detail: record.currentLoadLabel,
      href: "#classes",
    },
    {
      label: "Training",
      value: `${record.trainingCompleted}/${record.trainingTotal}`,
      detail: "required modules complete",
    },
    ...(quarterlyEnabled
      ? [
          {
            label: "Last review",
            value: latestReview
              ? latestReview.quarter
              : "None on record",
            detail: latestReview
              ? formatInstructorOpsDate(latestReview.createdAt)
              : undefined,
            href: "#reviews",
          },
        ]
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
    ...(caseload.length > 0
      ? [
          {
            label: "Advisees",
            value: String(caseload.length),
            detail: caseload.some((row) => row.overdue)
              ? `${caseload.filter((row) => row.overdue).length} check-in overdue`
              : undefined,
            tone: caseload.some((row) => row.overdue)
              ? ("attention" as const)
              : undefined,
            href: "#caseload",
          },
        ]
      : []),
    ...(mentorPair
      ? [
          {
            label: "Mentor",
            value: mentorPair.mentor.name ?? mentorPair.mentor.email,
            href: "#mentorship",
          },
        ]
      : []),
  ];

  const identityLine = [
    record.email,
    record.phone,
    record.chapterName,
    record.roles.map((r: string) => formatInstructorOpsLabel(r)).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <ProfileHeader
        name={record.name}
        eyebrow="Instructor record"
        identityLine={identityLine}
        avatarUrl={record.avatarUrl}
        backHref="/people?role=instructor"
        backLabel="People · Instructors"
        badges={
          <StatusBadge
            tone={record.needsAttention ? "warning" : "success"}
            title={record.stageDetail}
          >
            {record.stageLabel}
          </StatusBadge>
        }
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
            {record.application ? (
              <ButtonLink
                href={`/admin/instructor-applicants/${record.application.id}`}
                size="md"
              >
                Open application
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/admin/instructors/${id}/manage`} size="md">
              Manage
            </ButtonLink>
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
            {nextStep.detail ? (
              <p className="m-0 text-[12.5px] text-ink-muted">{nextStep.detail}</p>
            ) : null}
          </div>
          <ButtonLink href={nextStep.href} size="sm">
            Go to it →
          </ButtonLink>
        </div>
      ) : null}

      <RecordSection
        id="classes"
        title="Classes"
        description="Lead-instructed class offerings, current first."
        action={
          <ButtonLink href="/admin/classes" variant="ghost" size="sm">
            Class operations →
          </ButtonLink>
        }
      >
        {currentClasses.length === 0 && pastClasses.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">
            No class offerings assigned yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {currentClasses.map((offering: any) => (
              <ClassRow key={offering.id} offering={offering} />
            ))}
            {pastClasses.length > 0 ? (
              <>
                <p className="m-0 mt-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Past classes
                </p>
                {pastClasses.map((offering: any) => (
                  <ClassRow key={offering.id} offering={offering} />
                ))}
              </>
            ) : null}
          </div>
        )}
        {(legacyCourses.length > 0 || coInstructorAssignments.length > 0) && (
          <div className="mt-4 border-t border-line-soft pt-3">
            <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Legacy courses & co-instructor roles
            </p>
            <div className="flex flex-wrap gap-2 text-[13px] text-ink-muted">
              {legacyCourses.map((course: any) => (
                <span key={course.id}>
                  {course.title} ({course._count.enrollments} enrolled)
                </span>
              ))}
              {coInstructorAssignments.map((assignment: any) => (
                <span key={assignment.id}>
                  {assignment.course.title} · {formatInstructorOpsLabel(assignment.role)}
                </span>
              ))}
            </div>
          </div>
        )}
      </RecordSection>

      {upcomingSessions.length > 0 ? (
        <RecordSection
          id="sessions"
          title="Upcoming sessions"
          description="Next scheduled sessions across current classes."
        >
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {upcomingSessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-[8px] bg-surface-soft px-3.5 py-2.5"
              >
                <span className="text-[13.5px] font-semibold text-ink">
                  {s.topic}
                  <span className="ml-2 font-normal text-ink-muted">
                    {s.offering.title}
                  </span>
                </span>
                <span className="text-[12.5px] text-ink-muted">
                  {formatInstructorOpsDate(s.dateISO)} · {s.startTime}
                </span>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}

      <RecordSection
        id="reviews"
        title="Reviews & interviews"
        description="Quarterly reviews, application history, and interview outcomes — concrete records, not a performance label."
        action={
          quarterlyEnabled ? (
            <ButtonLink
              href={`/admin/instructors/${id}/manage/strategy#quarterly-review`}
              variant="ghost"
              size="sm"
            >
              Submit review →
            </ButtonLink>
          ) : undefined
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Quarterly reviews
            </p>
            {!quarterlyEnabled ? (
              <p className="m-0 text-[13px] text-ink-muted">
                Quarterly reviews are not enabled.
              </p>
            ) : latestReview ? (
              <div className="flex flex-col gap-2">
                <div className="rounded-[8px] border border-line-soft bg-surface-soft px-3.5 py-3">
                  <p className="m-0 text-[13.5px] font-semibold text-ink">
                    {latestReview.quarter} · {formatInstructorOpsLabel(latestReview.decision)}
                  </p>
                  <p className="m-0 text-[12.5px] text-ink-muted">
                    Performance {formatInstructorOpsLabel(latestReview.performanceRating)} ·
                    Potential {formatInstructorOpsLabel(latestReview.potentialRating)} ·{" "}
                    {formatInstructorOpsDate(latestReview.createdAt)}
                  </p>
                  {latestReview.notes ? (
                    <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-ink">
                      {latestReview.notes}
                    </p>
                  ) : null}
                </div>
                {reviewHistory.slice(1).map((review) => (
                  <p key={review.id} className="m-0 text-[12.5px] text-ink-muted">
                    {review.quarter} · {formatInstructorOpsLabel(review.decision)} ·{" "}
                    {formatInstructorOpsDate(review.createdAtISO)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[13px] text-ink-muted">
                No quarterly review on record yet.
              </p>
            )}
          </div>
          <div>
            <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Applications & interviews
            </p>
            {instructorApplications.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-muted">
                No instructor application records.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {instructorApplications.map((application: any) => (
                  <a
                    key={application.id}
                    href={`/admin/instructor-applicants/${application.id}`}
                    className="rounded-[8px] border border-line-soft px-3.5 py-2.5 transition-colors hover:border-brand-400"
                  >
                    <p className="m-0 text-[13.5px] font-semibold text-ink">
                      {formatInstructorOpsLabel(application.applicationTrack)} ·{" "}
                      {formatInstructorOpsLabel(application.status)}
                    </p>
                    <p className="m-0 text-[12px] text-ink-muted">
                      Updated {formatInstructorOpsDate(application.updatedAt)}
                    </p>
                  </a>
                ))}
                {interviewReviews.map((review: any) => (
                  <p key={review.id} className="m-0 text-[12.5px] text-ink-muted">
                    Interview: {formatInstructorOpsLabel(review.recommendation ?? "completed")}
                    {review.overallRating ? ` · rated ${review.overallRating}` : ""}
                    {review.submittedAt
                      ? ` · ${formatInstructorOpsDate(review.submittedAt)}`
                      : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </RecordSection>

      {(mentorPair || mentees.length > 0 || activeContributions.length > 0) && (
        <RecordSection
          id="mentorship"
          title="Mentorship & leadership"
          description="Mentor relationships and leadership contributions beyond teaching."
        >
          <div className="flex flex-col gap-4">
            {(mentorPair || mentees.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {mentorPair ? (
                  <EntityChip
                    type="person"
                    id={mentorPair.mentor.id}
                    label={mentorPair.mentor.name ?? mentorPair.mentor.email}
                    sublabel="Mentor"
                    href={`/people/${mentorPair.mentor.id}`}
                  />
                ) : null}
                {mentees.map((pair: any) => (
                  <EntityChip
                    key={pair.id}
                    type="person"
                    id={pair.mentee.id}
                    label={pair.mentee.name ?? pair.mentee.email}
                    sublabel="Mentee"
                    href={`/people/${pair.mentee.id}`}
                  />
                ))}
              </div>
            )}
            {activeContributions.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {activeContributions.map((contribution) => (
                  <li
                    key={contribution.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-[8px] bg-surface-soft px-3.5 py-2.5"
                  >
                    <span className="text-[13.5px] font-semibold text-ink">
                      {contribution.title}
                      {contribution.relatedLabel ? (
                        <span className="ml-2 font-normal text-ink-muted">
                          {contribution.relatedLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2 text-[12.5px] text-ink-muted">
                      <StatusBadge
                        tone={contribution.status === "NEEDS_ATTENTION" ? "warning" : "neutral"}
                      >
                        {formatInstructorOpsLabel(contribution.status)}
                      </StatusBadge>
                      since {formatInstructorOpsDate(contribution.startDate)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </RecordSection>
      )}

      {caseload.length > 0 ? (
        <RecordSection
          id="caseload"
          title="Advisor caseload"
          description="Assigned advisees with check-in state — overdue first (plan §12)."
          action={
            <ButtonLink
              href={`/people?role=student&advisor=${id}`}
              variant="ghost"
              size="sm"
            >
              View caseload in People →
            </ButtonLink>
          }
        >
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {caseload.map((row) => (
              <li
                key={row.assignmentId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] bg-surface-soft px-3.5 py-2.5"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <EntityChip
                    type="person"
                    id={row.student.id}
                    label={row.student.name}
                    href={`/admin/students/${row.student.id}`}
                  />
                  {row.overdue ? (
                    <StatusBadge tone="danger">Check-in overdue</StatusBadge>
                  ) : null}
                  {row.needsFollowUp ? (
                    <StatusBadge tone="warning" title={row.followUpNote ?? undefined}>
                      Follow-up flagged
                    </StatusBadge>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-[12.5px] text-ink-muted">
                  <span>
                    Last check-in:{" "}
                    {row.lastCheckInISO
                      ? formatInstructorOpsDate(row.lastCheckInISO)
                      : "never"}
                  </span>
                  <span>
                    Next:{" "}
                    {row.nextCheckInISO
                      ? formatInstructorOpsDate(row.nextCheckInISO)
                      : "not scheduled"}
                  </span>
                  <a
                    href={`/my-advisees/${row.assignmentId}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Advising workspace →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}

      {operationsEnabled && opsContext ? (
        <RecordSection
          id="work"
          title="Action operating panel"
          description="The action work linked to this instructor — what's open, what's stuck, and the suggested next move — plus the meetings they were discussed in."
        >
          <div className="grid items-start gap-4 lg:grid-cols-2">
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
              entityLabel={record.name}
              now={now}
            />
            <div className="flex flex-col gap-2">
              <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                Meetings mentioned in
              </p>
              {recentMeetings.length === 0 ? (
                <p className="m-0 text-[13px] text-ink-muted">
                  No tracked meetings yet.
                </p>
              ) : (
                recentMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="rounded-[8px] bg-surface-soft px-3.5 py-2.5"
                  >
                    <p className="m-0 text-[13.5px] font-semibold text-ink">
                      {meeting.title}
                    </p>
                    <p className="m-0 text-[12px] text-ink-muted">
                      {formatInstructorOpsDate(meeting.startISO)} ·{" "}
                      {meeting.categoryLabel}
                      {meeting.decisionCount > 0
                        ? ` · ${meeting.decisionCount} decision${meeting.decisionCount === 1 ? "" : "s"}`
                        : ""}
                      {meeting.openFollowUps > 0
                        ? ` · ${meeting.openFollowUps} open follow-up${meeting.openFollowUps === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </RecordSection>
      ) : null}

      {activity.length > 0 ? (
        <RecordSection
          id="activity"
          title="Recent activity"
          description="Application events and growth milestones, newest first."
        >
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {activity.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-1.5 text-[13px] last:border-b-0"
              >
                <span className="font-medium text-ink">
                  {event.title}
                  {event.detail ? (
                    <span className="ml-2 font-normal text-ink-muted">{event.detail}</span>
                  ) : null}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {formatInstructorOpsDateTime(event.atISO)}
                </span>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}
    </div>
  );
}

function ClassRow({ offering }: { offering: any }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-line-soft px-3.5 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <EntityChip
          type="class"
          id={offering.id}
          label={offering.title}
          href={`/admin/classes/${offering.id}`}
        />
        <StatusBadge tone={CLASS_STATUS_TONE[offering.status] ?? "neutral"}>
          {formatInstructorOpsLabel(offering.status)}
        </StatusBadge>
      </div>
      <span className="text-[12.5px] text-ink-muted">
        {[
          offering.template?.interestArea,
          offering.semester,
          `${offering._count?.enrollments ?? 0} enrolled`,
          offering.approval
            ? `Approval: ${formatInstructorOpsLabel(offering.approval.status)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
}
