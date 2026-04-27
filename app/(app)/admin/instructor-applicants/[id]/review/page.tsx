import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { canSeeChairQueue, getHiringActor } from "@/lib/chapter-hiring-permissions";
import {
  isFinalReviewV2Enabled,
  isInstructorApplicantWorkflowV1Enabled,
} from "@/lib/feature-flags";
import {
  getApplicationForFinalReview,
  getChairDraft,
  getChairQueueNeighbors,
  getDecisionAuditChain,
  getNotificationSnapshot,
  getReviewSignalsForApplication,
} from "@/lib/final-review-queries";
import { prisma } from "@/lib/prisma";
import FinalReviewCockpit from "@/components/instructor-applicants/final-review/FinalReviewCockpit";

export const dynamic = "force-dynamic";

const RECENT_TIMELINE_WINDOW_DAYS = 14;

export default async function FinalReviewCockpitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFinalReviewV2Enabled()) {
    const { id } = await params;
    redirect(`/admin/instructor-applicants/chair-queue/${id}`);
  }

  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");

  if (!isInstructorApplicantWorkflowV1Enabled()) {
    redirect("/admin/instructor-applicants");
  }

  const actor = await getHiringActor(session.user.id);
  if (!canSeeChairQueue(actor)) {
    redirect("/admin/instructor-applicants");
  }

  const { id } = await params;
  const [
    application,
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

  const isCrossChapter = Boolean(
    actor.chapterId &&
      application.applicant.chapterId &&
      actor.chapterId !== application.applicant.chapterId
  );
  const isSuperAdmin = actorAdminSubtypes.some((s) => s.subtype === "SUPER_ADMIN");

  return (
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
    />
  );
}
