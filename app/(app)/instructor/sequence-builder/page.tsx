import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInstructorSequences } from "@/lib/sequence-actions";
import { getInstructorPassionLabs } from "@/lib/passion-lab-actions";
import { prisma } from "@/lib/prisma";
import { SequenceBuilderClient } from "./client";

export default async function SequenceBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("CHAPTER_LEAD")
  ) {
    redirect("/dashboard");
  }

  const [sequences, passionLabs, approvedTemplates] = await Promise.all([
    getInstructorSequences(),
    getInstructorPassionLabs(),
    prisma.classTemplate.findMany({
      where: {
        createdById: session.user.id,
        submissionStatus: "APPROVED",
      },
      select: { id: true, title: true, interestArea: true, difficultyLevel: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <SequenceBuilderClient
      sequences={sequences as any}
      approvedTemplates={approvedTemplates}
      passionLabs={passionLabs}
    />
  );
}
