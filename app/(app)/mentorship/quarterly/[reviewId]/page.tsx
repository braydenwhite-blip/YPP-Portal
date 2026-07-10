import { redirect } from "next/navigation";

import { getQuarterlyReviewData } from "@/lib/goal-review-actions";

/**
 * Retired: the quarterly review packet now lives inside the same Review &
 * G&R flow on /people/[id] as the monthly cycle — one engine, one page, for
 * both cadences. getQuarterlyReviewData() re-runs its existing auth check,
 * so this redirect never leaks a mentee's identity to an unauthorized viewer.
 */
export default async function QuarterlyReviewRedirect({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  const data = await getQuarterlyReviewData(reviewId);
  if (!data) redirect("/mentorship");

  redirect(`/people/${data.mentee.id}?section=review&panel=approve`);
}
