import { redirect } from "next/navigation";

export const metadata = { title: "Quarterly Review — YPP Mentorship" };

export default async function LegacyQuarterlyReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  redirect(`/mentorship/quarterly/${reviewId}`);
}
