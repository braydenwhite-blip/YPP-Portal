import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInstructorPassionLabs, getActivePassionAreas } from "@/lib/passion-lab-actions";
import { prisma } from "@/lib/prisma";
import { PassionLabBuilderClient } from "./client";

export default async function PassionLabBuilderPage() {
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

  const [passionLabs, passionAreas, instructor] = await Promise.all([
    getInstructorPassionLabs(),
    getActivePassionAreas(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { chapterId: true } }),
  ]);

  return (
    <PassionLabBuilderClient
      existingLabs={passionLabs}
      passionAreas={passionAreas}
      chapterId={instructor?.chapterId ?? null}
    />
  );
}
