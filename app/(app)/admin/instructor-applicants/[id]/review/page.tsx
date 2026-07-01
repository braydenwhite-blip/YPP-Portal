import { notFound, redirect } from "next/navigation";

import { getHiringActor, isAdmin } from "@/lib/chapter-hiring-permissions";
import { isInstructorApplicantWorkflowV1Enabled } from "@/lib/feature-flags";
import { requireChairPage } from "@/lib/page-guards";
import {
  getApplicantEvidenceRecord,
  getApplicationForFinalReview,
  getChairDraft,
  getChairQueueNeighbors,
  getDecisionAuditChain,
  getNotificationSnapshot,
  getReviewSignalsForApplication,
} from "@/lib/final-review-queries";
import { prisma } from "@/lib/prisma";
import {
  canMakeFinalApplicantDecision,
  getActiveChair,
  NON_CHAIR_DECISION_MESSAGE,
} from "@/lib/active-chair";
import FinalReviewCockpit from "@/components/instructor-applicants/final-review/FinalReviewCockpit";
import { EntityWorkflowCard } from "@/components/workflow-engine/entity-workflow-card";

export const dynamic = "force-dynamic";

const RECENT_TIMELINE_WINDOW_DAYS = 14;

export default async function FinalReviewCockpitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireChairPage();
  const actor = await getHiringActor(sessionUser.id);

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    redirect(isAdmin(actor) ? "/admin/instructor-applicants" : "/");
  }

  const { id } = await params;
  const [
    application,
    evidence,
    queue,
    draft,
    notificationSnapshot,
    auditChain,
    reviewSignals,
    recentEvent,
    supersededCount,
    actorAdminSubtypes,
  ] = await Promise.all([
    getApplicationForFinalReview(id),
    getApplicantEvidenceRecord(id),
    getChairQueueNeighbors(id),
    getChairDraft(id, actor.id),
    getNotificationSnapshot(id),
    getDecisionAuditChain(id),
    getReviewSignalsForApplication(id),
    prisma.instructorApplicationTimelineEvent.findFirst({
      where: {
        applicationId: id,
        createdAt: {
          gte: new Date(Date.now() - RECENT_TIMELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    }),
    prisma.instructorApplicationChairDecision.count({
      where: { applicationId: id, supersededAt: { not: null } },
    }),
    prisma.userAdminSubtype.findMany({
      where: { userId: actor.id },
      select: { subtype: true },
    }),
  ]);

  if (!application) {
    notFound();
  }

  // Final-decision authority is the single active Chair, resolved by identity.
  // Other authorized viewers (admins, reviewers) still see the full evidence
  // record but cannot submit or change the final decision.
  const activeChair = await getActiveChair();
  const canMakeFinalDecision = canMakeFinalApplicantDecision(
    { id: actor.id },
    activeChair
  );

  const isCrossChapter = Boolean(
    actor.chapterId &&
      application.applicant.chapterId &&
      actor.chapterId !== application.applicant.chapterId
  );
  const isSuperAdmin = actorAdminSubtypes.some((s) => s.subtype === "SUPER_ADMIN");

  return (
    <>
      {/* Hiring workflow — rendered outside FinalReviewCockpit because that
          cockpit is a client component and EntityWorkflowCard is an async
          server component; the cockpit's layout is a full custom UI with no
          ReactNode slot, so this is placed just above it rather than
          prop-drilled in. */}
      <div className="mx-auto w-full max-w-[1400px] px-6 pt-6">
        <EntityWorkflowCard
          entityType="INSTRUCTOR_APPLICATION"
          entityId={id}
          chapterId={application.applicant.chapterId ?? null}
          title="Hiring workflow"
        />
      </div>
      <FinalReviewCockpit
        application={application}
        queue={queue}
        initialDraft={draft}
        notificationSnapshot={notificationSnapshot}
        auditChain={auditChain}
        reviewSignals={reviewSignals}
        isCrossChapter={isCrossChapter}
        hasRecentTimelineActivity={Boolean(recentEvent)}
        hasPriorSupersededDecision={supersededCount > 0}
        isSuperAdmin={isSuperAdmin}
        actorId={actor.id}
        canMakeFinalDecision={canMakeFinalDecision}
        activeChairName={activeChair?.name ?? activeChair?.email ?? null}
        decisionLockMessage={NON_CHAIR_DECISION_MESSAGE}
        evidence={evidence}
      />
    </>
  );
}
