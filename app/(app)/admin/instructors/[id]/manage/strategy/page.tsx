import { redirect } from "next/navigation";

import { OperationalContextPanel } from "@/components/people-strategy/operational-context-panel";
import { OperationalTimeline } from "@/components/people-strategy/operational-timeline";
import { deriveOperationalTimeline } from "@/lib/people-strategy/operational-timeline";
import { deriveStrategicEntityContext } from "@/lib/people-strategy/strategic-entity-context";
import { StrategicEntityPanel } from "@/components/people-strategy/strategic-entity-panel";
import { ProvisionalStatusCard } from "@/components/people-strategy/provisional-status-card";
import { QuarterlyReviewForm } from "@/components/people-strategy/quarterly-review-form";
import { MemberPeopleStrategySection } from "@/components/people-strategy/member-people-strategy-section";
import {
  ContributionList,
  ExpectationProgressCard,
  ReviewEvidenceCard,
} from "@/components/leadership/leadership-section";
import { AssignContributionForm } from "@/components/leadership/assign-forms";
import { SectionHeading } from "../_components/parts";
import { loadManageStrategyData } from "../_components/loaders";

export const dynamic = "force-dynamic";

export default async function InstructorManageStrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadManageStrategyData(id);
  if (!data) redirect("/");

  const {
    flags,
    leadership,
    latestQuarterlyReview,
    peopleStrategy,
    opsContext,
    canCreatePersonAction,
    feedbackResponses,
    feedbackStatus,
    provisionalStatus,
  } = data;

  return (
    <>
      {flags.leadershipRolesEnabled && leadership ? (
        <section id="leadership" className="card instructor-profile-section">
          <SectionHeading
            title="Leadership & contributions"
            detail="Roles beyond teaching and promotion evidence."
          />
          <div
            className="instructor-profile-two-column"
            style={{ alignItems: "start", marginBottom: 16 }}
          >
            <ExpectationProgressCard progress={leadership.progress} />
            <ReviewEvidenceCard evidence={leadership.evidence} />
          </div>
          {leadership.advisorStats.activeAdvisees > 0 ? (
            <p style={{ fontSize: 13, marginTop: 0 }}>
              <strong>Student Advisor:</strong> {leadership.advisorStats.activeAdvisees}{" "}
              assigned student
              {leadership.advisorStats.activeAdvisees === 1 ? "" : "s"} ·{" "}
              {leadership.advisorStats.checkInsLogged} check-ins ·{" "}
              {leadership.advisorStats.recommendationsMade} recommendations
            </p>
          ) : null}
          <div style={{ marginBottom: 16 }}>
            <AssignContributionForm instructors={[]} fixedInstructorId={id} />
          </div>
          <ContributionList data={leadership} canManage canAct />
        </section>
      ) : null}

      {flags.peopleDashboardEnabled && peopleStrategy ? (
        <MemberPeopleStrategySection
          data={peopleStrategy}
          feedbackResponses={feedbackResponses}
          feedbackStatus={feedbackStatus}
          canSeeFeedback={flags.viewerIsLeadershipOrBoard}
          quarterlyFormAvailable={flags.quarterlyReviewsEnabled}
        />
      ) : null}

      {flags.operationsEnabled && opsContext ? (
        <OperationalContextPanel
          title="Linked actions & meetings"
          subtitle="Work tied to this instructor"
          health={opsContext.health}
          meetings={opsContext.meetings}
          actions={opsContext.actions}
          openFollowUps={opsContext.openFollowUps}
          recentDecisions={opsContext.recentDecisions}
          canCreate={canCreatePersonAction}
          createActionHref={`/actions/new?relatedType=USER&relatedId=${id}`}
          createMeetingHref={`/actions/meetings/new?relatedType=USER&relatedId=${id}`}
          emptyActionsHint="No Action Tracker items are linked to this instructor yet."
          emptyMeetingsHint="This instructor hasn't been the focus of a tracked meeting yet."
        />
      ) : null}

      {flags.operationsEnabled && opsContext && flags.strategicInitiativesEnabled ? (
        <div style={{ marginTop: 14 }}>
          <StrategicEntityPanel
            context={deriveStrategicEntityContext({
              actions: opsContext.actions,
              meetings: opsContext.meetings,
            })}
          />
        </div>
      ) : null}

      {flags.operationsEnabled && opsContext ? (
        <OperationalTimeline
          events={deriveOperationalTimeline({
            meetings: opsContext.meetings,
            actions: opsContext.actions,
            decisions: opsContext.recentDecisions,
            followUps: opsContext.openFollowUps,
          })}
          compact
          createActionHref={`/actions/new?relatedType=USER&relatedId=${id}`}
          createMeetingHref={`/actions/meetings/new?relatedType=USER&relatedId=${id}`}
        />
      ) : null}

      {flags.provisionalEnabled && provisionalStatus ? (
        <section id="provisional" className="card instructor-profile-section">
          <SectionHeading
            title="Provisional status"
            detail="3-month confirmation clock for new hires."
          />
          <ProvisionalStatusCard
            userId={id}
            canConfirm={flags.canSubmitQuarterlyReview}
            quarterlyFormAvailable={flags.quarterlyReviewsEnabled}
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
      ) : null}

      {flags.quarterlyReviewsEnabled ? (
        <section id="quarterly-review" className="card instructor-profile-section">
          <SectionHeading
            title="Quarterly review"
            detail="Performance and potential placement."
          />
          <QuarterlyReviewForm
            userId={id}
            canSubmit={flags.canSubmitQuarterlyReview}
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
      ) : null}
    </>
  );
}
