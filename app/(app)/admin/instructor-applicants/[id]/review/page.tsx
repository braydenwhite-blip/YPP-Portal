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
import skin from "@/components/ui-v2/portal-skin.module.css";

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
    <div className={skin.portalSkin}>
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
    </div>
  );
}
