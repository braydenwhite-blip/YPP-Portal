import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const metadata = { title: "Approve Review — Mentorship Program" };

export default async function ChairReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  const [canonicalReview, legacyReview] = await Promise.all([
    prisma.monthlyGoalReview.findUnique({
      where: { id: reviewId },
      select: { menteeId: true },
    }),
    prisma.mentorGoalReview.findUnique({
      where: { id: reviewId },
      select: { menteeId: true },
    }),
  ]);

  const menteeId = canonicalReview?.menteeId ?? legacyReview?.menteeId ?? null;
  if (!menteeId) {
    notFound();
  }

  redirect(`/mentorship/reviews/${menteeId}`);
}
