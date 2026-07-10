import { redirect } from "next/navigation";

import { getReviewForChair } from "@/lib/goal-review-actions";

/**
 * Retired: chair approval is now an in-page panel on /people/[id] (the
 * "Approve" control inside the Active Review Cycle flow) — the chair
 * approves a coherent packet without leaving the person's page, not on a
 * separate destination. getReviewForChair() re-runs the same
 * chair-or-admin authorization check this page always had, so this redirect
 * never leaks which mentee a reviewId belongs to to an unauthorized viewer.
 */
export default async function ChairReviewDetailRedirect({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  const review = await getReviewForChair(reviewId);
  if (!review) redirect("/mentorship");

  redirect(`/mentorship/people/${review.menteeId}?section=reviews&panel=approve`);
}
