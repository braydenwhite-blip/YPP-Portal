import { prisma } from "@/lib/prisma";

/**
 * Returns ranked instructors for a given pathway and student user.
 * Priority:
 *   1. Instructors with explicit InstructorPathwaySpec for this pathway
 *   2. Instructors in the same chapter
 *   3. All other active instructors
 * Within each tier, sort by ascending mentee count (less busy first).
 */
export async function getSuggestedMentorsForPathway(
  userId: string,
  pathwayId: string
): Promise<{ id: string; name: string; chapterName: string | null; bio: string | null; menteeCount: number; isSpecialist: boolean }[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true },
  });

  // Pathway specialists
  const specialists = await prisma.instructorPathwaySpec.findMany({
    where: { pathwayId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          chapterId: true,
          chapter: { select: { name: true } },
          profile: { select: { bio: true } },
          menteePairs: { select: { id: true } },
        },
      },
    },
  }).catch(() => [] as any[]);

  const specialistIds = new Set(specialists.map((s: any) => s.user.id));

  // Same-chapter instructors (non-specialist)
  const chapterInstructors = user?.chapterId
    ? await prisma.user.findMany({
        where: {
          primaryRole: "INSTRUCTOR",
          chapterId: user.chapterId,
          id: { notIn: [...specialistIds] },
        },
        select: {
          id: true,
          name: true,
          chapterId: true,
          chapter: { select: { name: true } },
          profile: { select: { bio: true } },
          menteePairs: { select: { id: true } },
        },
        take: 10,
      })
    : [];

  const allMentors = [
    ...specialists.map((s: any) => ({ ...s.user, isSpecialist: true })),
    ...chapterInstructors.map((u: any) => ({ ...u, isSpecialist: false })),
  ];

  return allMentors
    .map((m: any) => ({
      id: m.id,
      name: m.name,
      chapterName: m.chapter?.name ?? null,
      bio: m.profile?.bio ?? null,
      menteeCount: m.menteePairs?.length ?? 0,
      isSpecialist: m.isSpecialist,
    }))
    .sort((a: any, b: any) => {
      if (a.isSpecialist !== b.isSpecialist) return a.isSpecialist ? -1 : 1;
      return a.menteeCount - b.menteeCount;
    });
}
