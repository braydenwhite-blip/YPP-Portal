import { redirect } from "next/navigation";

import { getReviewForChair } from "@/lib/goal-review-actions";

export const metadata = { title: "Approve Review — Mentorship Program" };

/**
 * Legacy chair-approval URL. Redirects to the mentee's Mentorship workspace
 * approval panel (`/mentorship/people/[id]?panel=approve`).
 */
export default async function LegacyChairReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const review = await getReviewForChair(reviewId);
  if (!review) redirect("/mentorship");
  redirect(`/mentorship/people/${review.menteeId}?section=reviews&panel=approve`);
}
