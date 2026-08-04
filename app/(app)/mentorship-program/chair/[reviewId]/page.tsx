import { redirect } from "next/navigation";

import { getReviewForChair } from "@/lib/goal-review-actions";

export const metadata = { title: "Approve Review — Mentorship Program" };

/**
 * Legacy chair-approval URL → dedicated chair review page.
 */
export default async function LegacyChairReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const review = await getReviewForChair(reviewId);
  if (!review) redirect("/mentorship/chair");
  redirect(`/mentorship/chair/${review.id}`);
}
