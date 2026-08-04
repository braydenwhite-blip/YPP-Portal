import { redirect } from "next/navigation";

import { ChairReviewDetail } from "@/components/mentorship/chair/chair-review-detail";
import { getSessionUser } from "@/lib/auth-supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chair Review — YPP Mentorship" };

/**
 * Dedicated chair review packet for a single MentorGoalReview.
 * Notification links land here after "Send Review to Chair".
 */
export default async function ChairReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const viewer = await getSessionUser();
  const { reviewId } = await params;
  if (!viewer) {
    redirect(`/login?next=/mentorship/chair/${encodeURIComponent(reviewId)}`);
  }

  return <ChairReviewDetail reviewId={reviewId} />;
}
