import { redirect } from "next/navigation";

import { getReviewForChair } from "@/lib/goal-review-actions";

export const metadata = { title: "Approve Review — Mentorship Program" };

/**
 * Legacy chair-approval URL. The decision now happens inline on the mentee's
 * /people/[id] page (?panel=approve); getReviewForChair re-checks the
 * viewer's lane-chair/admin authority before we reveal which mentee the
 * review belongs to, mirroring /mentorship/chair/[reviewId].
 */
export default async function LegacyChairReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const review = await getReviewForChair(reviewId);
  if (!review) redirect("/mentorship");
  redirect(`/people/${review.menteeId}?section=review&panel=approve`);
}
