import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInstructorCompetitionDrafts } from "@/lib/competition-draft-actions";
import { getActivePassionAreas } from "@/lib/passion-lab-actions";
import { prisma } from "@/lib/prisma";
import { CompetitionBuilderClient } from "./client";

export default async function CompetitionBuilderPage() {
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

  // Fetch instructor's chapter from DB (chapterId is not in session type)
  const instructor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { chapterId: true },
  });

  const [drafts, passionAreas, chapterUsers] = await Promise.all([
    getInstructorCompetitionDrafts(),
    getActivePassionAreas(),
    instructor?.chapterId
      ? prisma.user.findMany({
          where: {
            chapterId: instructor.chapterId,
            primaryRole: { in: ["INSTRUCTOR", "ADMIN", "STAFF", "CHAPTER_LEAD"] },
          },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <CompetitionBuilderClient
      existingDrafts={drafts}
      passionAreas={passionAreas}
      chapterUsers={chapterUsers}
    />
  );
}
