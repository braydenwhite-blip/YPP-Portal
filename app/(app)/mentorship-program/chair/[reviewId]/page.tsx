import { redirect } from "next/navigation";

export const metadata = { title: "Approve Review — Mentorship Program" };

export default async function LegacyChairReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  redirect(`/mentorship/chair/${reviewId}`);
}
