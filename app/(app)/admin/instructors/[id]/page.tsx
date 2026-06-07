import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  formatInstructorOpsDate,
  formatInstructorOpsDateTime,
  formatInstructorOpsLabel,
  getInstructorOpsProfile,
} from "@/lib/instructor-ops";
import { loadInstructorProfileDetail, listAllTags } from "@/lib/instructor-ops-actions";
import {
  completenessTone,
  type InstructorCompleteness,
} from "@/lib/instructor-completeness";
import {
  isProvisionalClockEnabled,
  isPeopleDashboardEnabled,
  isQuarterlyReviewsEnabled,
  isActionTrackerEnabled,
  isOperationsHubEnabled,
} from "@/lib/feature-flags";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";
import { canCreateAction } from "@/lib/people-strategy/action-permissions";
import { LinkedActionsPanel } from "@/components/people-strategy/linked-actions-panel";
import { getLatestQuarterlyReview } from "@/lib/people-strategy/quarterly-review-actions";
import { loadProvisionalStatus } from "@/lib/people-strategy/provisional";
import { loadMemberPeopleStrategy } from "@/lib/people-strategy/member-people-detail";
import { ProvisionalStatusCard } from "@/components/people-strategy/provisional-status-card";
import {
  getFeedbackRequestStatusForSubject,
  getFeedbackResponsesForSubject,
  isLeadershipOrBoard,
  type FeedbackRequestStatus,
  type SubjectFeedbackResponse,
} from "@/lib/people-strategy/feedback-requests";
import { QuarterlyReviewForm } from "@/components/people-strategy/quarterly-review-form";
import { MemberPeopleStrategySection } from "@/components/people-strategy/member-people-strategy-section";
import { TagsEditor, NotesEditor, TasksEditor } from "./profile-editor";

export const dynamic = "force-dynamic";

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export default async function AdminInstructorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const quarterlyReviewsEnabled = isQuarterlyReviewsEnabled();
  const peopleDashboardEnabled = isPeopleDashboardEnabled();
  const provisionalEnabled = isProvisionalClockEnabled();

  // Leadership/Board check drives both the Quarterly Review submit affordance and the
  // confidential feedback block. The server actions re-enforce `requireLeadership()`.
  const viewerIsLeadershipOrBoard = session?.user ? isLeadershipOrBoard(session.user) : false;

  const [profile, detail, allTags, latestQuarterlyReview, peopleStrategy] =
    await Promise.all([
      getInstructorOpsProfile(id),
      loadInstructorProfileDetail(id),
      listAllTags(),
      quarterlyReviewsEnabled ? getLatestQuarterlyReview(id) : Promise.resolve(null),
      peopleDashboardEnabled
        ? loadMemberPeopleStrategy(id, {
            id: session?.user?.id ?? "",
            roles: session?.user?.roles ?? [],
            primaryRole: session?.user?.primaryRole ?? null,
            adminSubtypes: session?.user?.adminSubtypes ?? [],
          })
        : Promise.resolve(null),
    ]);
  if (!profile) {
    notFound();
  }

  // People Strategy Operating System — Action Tracker items linked to this
  // person. Additive + double-flagged; visibility-filtered for the viewer.
  const operationsEnabled = isOperationsHubEnabled() && isActionTrackerEnabled();
  const operationsViewer = {
    id: session?.user?.id ?? "",
    roles,
    primaryRole: session?.user?.primaryRole ?? null,
    adminSubtypes: session?.user?.adminSubtypes ?? [],
  };
  const personActions = operationsEnabled
    ? await getActionsForEntity("USER", id, operationsViewer)
    : [];
  const canCreatePersonAction = canCreateAction(operationsViewer);

  // Confidential feedback responses — ONLY for Leadership/Board. The loader enforces
  // `requireLeadership()` itself; the guard + catch here keep the page resilient for
  // non-Leadership admins (who see everything else but not this block).
  let feedbackResponses: SubjectFeedbackResponse[] | null = null;
  if (peopleDashboardEnabled && viewerIsLeadershipOrBoard) {
    feedbackResponses = await getFeedbackResponsesForSubject(id).catch(() => null);
  }

  // Feedback request STATUS (counts + last requested/submitted dates only — no
  // response bodies), safe to show to any admin viewing this page. Null when the
  // emails feature is off.
  const feedbackStatus: FeedbackRequestStatus | null =
    peopleDashboardEnabled ? await getFeedbackRequestStatusForSubject(id) : null;

  // Provisional 3-month confirmation clock (ENABLE_PROVISIONAL_CLOCK). Loaded
  // independently of the People Dashboard so the badge/countdown shows on any
  // hire's profile. The loader returns a "not provisional" status when off.
  const provisionalStatus = provisionalEnabled
    ? await loadProvisionalStatus(id)
    : null;

  // Quarterly Review submission is leadership-gated (Leadership / Board) per the role
  // hierarchy; non-Leadership admins still see the latest review read-only. The server
  // action re-enforces `requireLeadership()` regardless of this UI flag.
  const canSubmitQuarterlyReview = viewerIsLeadershipOrBoard;

  const { record, user, readiness } = profile;
  const instructorApplications = asArray(user.instructorApplications);
  const classOfferings = asArray(user.classOfferingsInstructed);
  const courses = asArray(user.courses);
  const coInstructorAssignments = asArray(user.coInstructorAssignments);
  const teachingPermissions = asArray(user.teachingPermissions);
  const instructorCertifications = asArray(user.instructorCertifications);
  const menteePairs = asArray(user.menteePairs);
  const mentorPairs = asArray(user.mentorPairs);
  const instructorGrowthEvents = asArray(user.instructorGrowthEvents);
  const activeApplication = instructorApplications[0] ?? null;
  const applicationTimelineEvents = instructorApplications.flatMap((application: any) =>
    asArray(application.timeline).map((event: any) => ({
      ...event,
      applicationId: application.id,
    }))
  );
  const reviewActivity = instructorApplications.flatMap((application: any) => [
    ...asArray(application.applicationReviews).map((review: any, index: number) => ({
      id: `${application.id}-app-review-${index}`,
      title: "Application review",
      summary: review.summary ?? "No summary recorded.",
    })),
    ...asArray(application.interviewReviews).map((review: any, index: number) => ({
      id: `${application.id}-interview-review-${index}`,
      title: "Interview review",
      summary:
        review.recommendation || review.overallRating
          ? `${formatInstructorOpsLabel(review.recommendation ?? "Interview")}: ${
              review.overallRating ?? "No rating"
            }`
          : "No summary recorded.",
    })),
  ]);

  return (
    <div className="instructor-ops-page instructor-profile-page">
      <div className="instructor-profile-hero">
        <div className="instructor-profile-identity">
          <div className="instructor-profile-avatar" aria-hidden="true">
            {record.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- small admin avatar, not page-critical.
              <img src={record.avatarUrl} alt="" />
            ) : (
              record.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <div className="instructor-profile-breadcrumbs">
              <Link href="/admin/instructors">Database</Link>
              <span>/</span>
              <Link href="/admin/instructors/hub">Pipeline hub</Link>
            </div>
            <p className="badge">{record.stageLabel}</p>
            <h1 className="page-title">{record.name}</h1>
            <p className="page-subtitle">
              {record.email} | {record.chapterName} | {record.stageDetail}
            </p>
          </div>
        </div>
        <div className="instructor-profile-actions">
          {record.application && (
            <Link href={`/admin/instructor-applicants/${record.application.id}`} className="button secondary">
              Open application
            </Link>
          )}
          <Link href="/admin/instructors/attention" className="button secondary">
            Attention inbox
          </Link>
          <Link href="/admin/instructors" className="button">
            Back to database
          </Link>
        </div>
      </div>

      <div className="grid four instructor-ops-metrics">
        <ProfileMetric label="Stage" value={record.stageLabel} detail={record.currentLoadLabel} />
        <ProfileMetric
          label="Assignments"
          value={String(record.activeAssignmentCount)}
          detail={`${record.assignmentCount} total`}
        />
        <ProfileMetric
          label="Training"
          value={`${record.trainingPercent}%`}
          detail={`${record.trainingCompleted}/${record.trainingTotal} modules`}
        />
        <ProfileMetric
          label="Attention"
          value={String(record.attentionFlags.length)}
          detail={record.attentionFlags[0]?.title ?? "No active flags"}
        />
      </div>

      <CompletenessBanner completeness={record.completeness} />

      <nav className="instructor-profile-tabs" aria-label="Instructor profile sections">
        <a href="#overview">Overview</a>
        <a href="#pipeline">Pipeline</a>
        <a href="#assignments">Assignments</a>
        <a href="#mentorship">Mentorship</a>
        {peopleDashboardEnabled && peopleStrategy && <a href="#people-strategy">People Strategy</a>}
        {provisionalEnabled && <a href="#provisional">Provisional</a>}
        {quarterlyReviewsEnabled && <a href="#quarterly-review">Quarterly Review</a>}
        <a href="#activity">Notes/Activity</a>
      </nav>

      <section id="overview" className="card instructor-profile-section">
        <SectionHeading title="Overview" detail="Identity, contact, tags, categories, and leadership signals." />
        <div className="instructor-profile-two-column">
          <InfoGrid
            items={[
              ["Email", record.email],
              ["Phone", record.phone ?? "Not recorded"],
              ["Chapter", record.chapterName],
              ["Location", record.chapterLocation ?? user.profile?.city ?? "Not recorded"],
              ["School", user.profile?.school ?? activeApplication?.schoolName ?? "Not recorded"],
              ["Roles", record.roles.join(", ") || "None"],
            ]}
          />
          <div>
            <TagsEditor
              userId={id}
              initialTags={detail.tags}
              allTags={allTags.map((t) => ({
                id: t.id,
                namespace: t.namespace,
                label: t.label,
                color: t.color,
              }))}
            />
            <div className="instructor-profile-signal-grid" style={{ marginTop: 16 }}>
              <Signal label="Mentor eligible" value={record.mentorEligible ? "Yes" : "No"} />
              <Signal label="Workshop eligible" value={record.workshopEligible ? "Yes" : "No"} />
              <Signal label="Leadership track" value={record.leadershipTrack ? "Yes" : "No"} />
              <Signal label="Growth tier" value={record.growthTier ? formatInstructorOpsLabel(record.growthTier) : "Not started"} />
            </div>
          </div>
        </div>
      </section>

      <section id="pipeline" className="card instructor-profile-section">
        <SectionHeading title="Pipeline" detail="How this person got to the current board stage." />
        <div className="instructor-profile-two-column">
          <div>
            <h3>Current operations stage</h3>
            <div className="instructor-profile-stage-card">
              <span className={`pill ${record.needsAttention ? "pill-attention" : "pill-purple"}`}>
                {record.stageLabel}
              </span>
              <strong>{record.stageDetail}</strong>
              <span>
                Latest activity: {formatInstructorOpsDateTime(record.latestActivityAt)}
              </span>
            </div>

            <h3 style={{ marginTop: 18 }}>Attention flags</h3>
            {record.attentionFlags.length === 0 ? (
              <p className="instructor-profile-muted">No active attention flags.</p>
            ) : (
              <div className="instructor-ops-attention-list">
                {record.attentionFlags.map((flag) => (
                  <Link key={flag.kind} href={flag.href} className={`instructor-ops-attention-item is-${flag.tone}`}>
                    <strong>{flag.title}</strong>
                    <span>{flag.detail}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3>Readiness and onboarding</h3>
            <InfoGrid
              items={[
                ["Readiness complete", readiness.baseReadinessComplete ? "Yes" : "No"],
                ["Can request offering approval", readiness.canRequestOfferingApproval ? "Yes" : "No"],
                ["Training complete", readiness.trainingComplete ? "Yes" : "No"],
                ["Interview status", formatInstructorOpsLabel(readiness.interviewStatus)],
                ["Onboarding profile", record.onboardingComplete ? "Complete" : "Incomplete"],
                ["Subtype", formatInstructorOpsLabel(readiness.instructorSubtype)],
              ]}
            />
            {readiness.missingRequirements.length > 0 && (
              <div className="instructor-profile-blocker-list">
                {readiness.missingRequirements.map((requirement) => (
                  <Link key={requirement.code} href={requirement.href}>
                    <strong>{requirement.title}</strong>
                    <span>{requirement.detail}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="instructor-profile-history">
          <h3>Application history</h3>
          {instructorApplications.length === 0 ? (
            <p className="instructor-profile-muted">No instructor application records found.</p>
          ) : (
            instructorApplications.map((application: any) => (
              <Link key={application.id} href={`/admin/instructor-applicants/${application.id}`} className="instructor-profile-history-row">
                <span>{formatInstructorOpsLabel(application.status)}</span>
                <strong>{formatInstructorOpsLabel(application.applicationTrack)}</strong>
                <small>Updated {formatInstructorOpsDate(application.updatedAt)}</small>
              </Link>
            ))
          )}
        </div>
      </section>

      <section id="assignments" className="card instructor-profile-section">
        <SectionHeading title="Assignments" detail="Classes, legacy courses, co-instructor roles, and teaching permissions." />
        <div className="instructor-profile-assignment-grid">
          <div>
            <h3>Class offerings</h3>
            <div className="instructor-profile-stack">
              {classOfferings.length === 0 ? (
                <p className="instructor-profile-muted">No class offerings assigned.</p>
              ) : (
                classOfferings.map((offering: any) => (
                  <Link key={offering.id} href={`/admin/classes/${offering.id}`} className="instructor-profile-assignment-row">
                    <strong>{offering.title}</strong>
                    <span>
                      {formatInstructorOpsLabel(offering.status)} | {offering.template.interestArea}
                    </span>
                    <small>
                      Approval: {formatInstructorOpsLabel(offering.approval?.status ?? "NOT_REQUESTED")}
                    </small>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <h3>Courses and co-instructor roles</h3>
            <div className="instructor-profile-stack">
              {courses.map((course: any) => (
                <div key={course.id} className="instructor-profile-assignment-row">
                  <strong>{course.title}</strong>
                  <span>{course.interestArea} | {course._count.enrollments} enrollments</span>
                </div>
              ))}
              {coInstructorAssignments.map((assignment: any) => (
                <div key={assignment.id} className="instructor-profile-assignment-row">
                  <strong>{assignment.course.title}</strong>
                  <span>{formatInstructorOpsLabel(assignment.role)} | Co-instructor</span>
                </div>
              ))}
              {courses.length === 0 && coInstructorAssignments.length === 0 && (
                <p className="instructor-profile-muted">No legacy course assignments found.</p>
              )}
            </div>
          </div>
        </div>

        <div className="instructor-profile-history">
          <h3>Teaching permissions and certifications</h3>
          <div className="instructor-profile-permission-grid">
            {teachingPermissions.map((permission: any) => (
              <div key={permission.id} className="instructor-profile-mini-row">
                <strong>{formatInstructorOpsLabel(permission.level)}</strong>
                <span>Granted {formatInstructorOpsDate(permission.grantedAt)}</span>
              </div>
            ))}
            {instructorCertifications.map((certification: any) => (
              <div key={certification.id} className="instructor-profile-mini-row">
                <strong>{certification.certType}</strong>
                <span>
                  {formatInstructorOpsLabel(certification.status)}
                  {certification.expiresAt ? ` | Expires ${formatInstructorOpsDate(certification.expiresAt)}` : ""}
                </span>
              </div>
            ))}
            {teachingPermissions.length === 0 && instructorCertifications.length === 0 && (
              <p className="instructor-profile-muted">No permissions or certifications recorded.</p>
            )}
          </div>
        </div>
      </section>

      <section id="mentorship" className="card instructor-profile-section">
        <SectionHeading title="Mentorship" detail="Mentor assignment, mentor capacity, and leadership readiness." />
        <div className="instructor-profile-two-column">
          <div>
            <h3>As mentee</h3>
            {menteePairs.length === 0 ? (
              <p className="instructor-profile-muted">No instructor mentor assigned.</p>
            ) : (
              <div className="instructor-profile-stack">
                {menteePairs.map((pair: any) => (
                  <div key={pair.id} className="instructor-profile-assignment-row">
                    <strong>{pair.mentor.name}</strong>
                    <span>{pair.mentor.email}</span>
                    <small>{formatInstructorOpsLabel(pair.status)} since {formatInstructorOpsDate(pair.startDate)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3>As mentor</h3>
            {mentorPairs.length === 0 ? (
              <p className="instructor-profile-muted">No instructor mentees assigned.</p>
            ) : (
              <div className="instructor-profile-stack">
                {mentorPairs.map((pair: any) => (
                  <div key={pair.id} className="instructor-profile-assignment-row">
                    <strong>{pair.mentee.name}</strong>
                    <span>{pair.mentee.email}</span>
                    <small>{formatInstructorOpsLabel(pair.status)} since {formatInstructorOpsDate(pair.startDate)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {peopleDashboardEnabled && peopleStrategy && (
        <MemberPeopleStrategySection
          data={peopleStrategy}
          feedbackResponses={feedbackResponses}
          feedbackStatus={feedbackStatus}
          canSeeFeedback={viewerIsLeadershipOrBoard}
          quarterlyFormAvailable={quarterlyReviewsEnabled}
        />
      )}

      {operationsEnabled && (
        <LinkedActionsPanel
          actions={personActions}
          heading="Linked actions for this person"
          createHref={`/actions/new?relatedType=USER&relatedId=${id}`}
          createLabel="Create action for this person"
          canCreate={canCreatePersonAction}
          emptyHint="No Action Tracker items are linked to this person yet."
        />
      )}

      {provisionalEnabled && provisionalStatus && (
        <section id="provisional" className="card instructor-profile-section">
          <SectionHeading
            title="Provisional status"
            detail="3-month confirmation clock for new hires. Confirm at Month 3 via the Quarterly Review workflow to clear provisional status."
          />
          <ProvisionalStatusCard
            userId={id}
            canConfirm={viewerIsLeadershipOrBoard}
            quarterlyFormAvailable={quarterlyReviewsEnabled}
            status={{
              isProvisional: provisionalStatus.isProvisional,
              confirmed: provisionalStatus.confirmed,
              startDate: provisionalStatus.startDate?.toISOString() ?? null,
              confirmedAt: provisionalStatus.confirmedAt?.toISOString() ?? null,
              monthThreeDate: provisionalStatus.monthThreeDate?.toISOString() ?? null,
              daysRemaining: provisionalStatus.daysRemaining,
              atMonthThree: provisionalStatus.atMonthThree,
              percentElapsed: provisionalStatus.percentElapsed,
            }}
          />
        </section>
      )}

      {quarterlyReviewsEnabled && (
        <section id="quarterly-review" className="card instructor-profile-section">
          <SectionHeading
            title="Quarterly Review"
            detail="Performance x Potential succession placement. The matrix label is computed, never stored."
          />
          <QuarterlyReviewForm
            userId={id}
            canSubmit={canSubmitQuarterlyReview}
            latestReview={
              latestQuarterlyReview
                ? {
                    quarter: latestQuarterlyReview.quarter,
                    performanceRating: latestQuarterlyReview.performanceRating,
                    potentialRating: latestQuarterlyReview.potentialRating,
                    decision: latestQuarterlyReview.decision,
                    notes: latestQuarterlyReview.notes,
                    successionFlag: latestQuarterlyReview.successionFlag,
                    matrixLabel: latestQuarterlyReview.matrixLabel,
                    createdAt: latestQuarterlyReview.createdAt.toISOString(),
                  }
                : null
            }
          />
        </section>
      )}

      <section id="activity" className="card instructor-profile-section">
        <SectionHeading title="Notes/Activity" detail="Admin notes, open tasks, application events, and growth events." />

        <div className="instructor-profile-activity-grid" style={{ marginBottom: 24 }}>
          <NotesEditor userId={id} initialNotes={detail.notes} />
          <TasksEditor userId={id} initialTasks={detail.tasks} />
        </div>

        <div className="instructor-profile-activity-grid">
          <div>
            <h3>Application activity</h3>
            <div className="instructor-profile-stack">
              {applicationTimelineEvents.length === 0 ? (
                <p className="instructor-profile-muted">No application timeline events found.</p>
              ) : (
                applicationTimelineEvents.map((event: any) => (
                  <div key={event.id} className="instructor-profile-activity-row">
                    <strong>{formatInstructorOpsLabel(event.kind)}</strong>
                    <span>
                      {event.actor?.name ? `${event.actor.name} | ` : ""}
                      {formatInstructorOpsDateTime(event.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3>Review notes and growth</h3>
            <div className="instructor-profile-stack">
              {reviewActivity.map((activity: any) => (
                <div key={activity.id} className="instructor-profile-activity-row">
                  <strong>{activity.title}</strong>
                  <span>{activity.summary}</span>
                </div>
              ))}
              {instructorGrowthEvents.map((event: any) => (
                <div key={event.id} className="instructor-profile-activity-row">
                  <strong>{event.title}</strong>
                  <span>
                    {formatInstructorOpsLabel(event.status)} | {event.xpAmount} XP | {formatInstructorOpsDate(event.occurredAt)}
                  </span>
                </div>
              ))}
              {reviewActivity.length === 0 && instructorGrowthEvents.length === 0 && (
                <p className="instructor-profile-muted">No review notes or growth events found.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfileMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card instructor-ops-metric">
      <span className="kpi" style={{ fontSize: value.length > 8 ? 22 : undefined }}>
        {value}
      </span>
      <span className="kpi-label">{label}</span>
      <span>{detail}</span>
    </div>
  );
}

function CompletenessBanner({
  completeness,
}: {
  completeness: InstructorCompleteness;
}) {
  const tone = completenessTone(completeness.score);
  const palette =
    tone === "success"
      ? { bg: "#f0fdf4", border: "#bbf7d0", fg: "#166534" }
      : tone === "warning"
        ? { bg: "#fffbeb", border: "#fde68a", fg: "#854d0e" }
        : { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b" };

  return (
    <section
      className="card"
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: palette.fg, minWidth: 64 }}>
        {completeness.score}%
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 600, color: palette.fg }}>
          Profile completeness
        </div>
        {completeness.missing.length === 0 ? (
          <div style={{ fontSize: 13, color: palette.fg }}>
            All tracked fields are on file.
          </div>
        ) : (
          <div style={{ fontSize: 13, color: palette.fg, display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            <span>Missing:</span>
            {completeness.missing.map((m) => (
              <span
                key={m.code}
                style={{
                  padding: "1px 8px",
                  borderRadius: 9999,
                  background: "rgba(0,0,0,0.05)",
                  fontWeight: 600,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="instructor-ops-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="instructor-profile-info-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
