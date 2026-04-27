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
  getNotificationSnapshot,
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
  const [application, queue, draft, notificationSnapshot, recentEvent, supersededCount] =
    await Promise.all([
      getApplicationForFinalReview(id),
      getChairQueueNeighbors(id),
      getChairDraft(id, actor.id),
      getNotificationSnapshot(id),
      prisma.instructorApplicationTimelineEvent.findFirst({
        where: {
          applicationId: id,
          createdAt: {
            gte: new Date(
              Date.now() - RECENT_TIMELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000
            ),
          },
        },
        select: { id: true },
      }),
      prisma.instructorApplicationChairDecision.count({
        where: { applicationId: id, supersededAt: { not: null } },
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

  return (
    <FinalReviewCockpit
      application={application}
      queue={queue}
      initialDraft={draft}
      notificationSnapshot={notificationSnapshot}
      isCrossChapter={isCrossChapter}
      hasRecentTimelineActivity={Boolean(recentEvent)}
      hasPriorSupersededDecision={supersededCount > 0}
      actorId={actor.id}
    />
  );
}
