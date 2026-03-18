import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const metadata = { title: "Write Review — Mentorship Program" };

export default async function WriteReviewPage({
  params,
}: {
  params: Promise<{ reflectionId: string }>;
}) {
  const { reflectionId } = await params;
  const reflection = await prisma.monthlySelfReflection.findUnique({
    where: { id: reflectionId },
    select: { menteeId: true },
  });

  if (!reflection) {
    notFound();
  }

  redirect(`/mentorship/reviews/${reflection.menteeId}`);
}
