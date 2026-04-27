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
} from "@/lib/final-review-queries";
import FinalReviewCockpit from "@/components/instructor-applicants/final-review/FinalReviewCockpit";

export const dynamic = "force-dynamic";

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
  const [application, queue, draft] = await Promise.all([
    getApplicationForFinalReview(id),
    getChairQueueNeighbors(id),
    getChairDraft(id, actor.id),
  ]);

  if (!application) {
    notFound();
  }

  return (
    <FinalReviewCockpit
      application={application}
      queue={queue}
      initialDraft={draft}
      actorId={actor.id}
    />
  );
}
