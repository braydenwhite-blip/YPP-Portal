import type { Prisma } from "@prisma/client";

import {
  getHiringActor,
  isAdmin,
  isChapterLead,
  isHiringChair,
  type HiringActor,
} from "@/lib/chapter-hiring-permissions";

const SEARCHABLE_INTERVIEW_ROUNDS = [1, 2, 3, 4] as const;

/**
 * Shared read filter for instructor applications in list/search contexts.
 * Record pages and server actions still perform their own authoritative
 * assertion after loading the individual application.
 */
export function instructorApplicationVisibilityWhereForActor(
  actor: HiringActor
): Prisma.InstructorApplicationWhereInput {
  if (isAdmin(actor) || isHiringChair(actor)) {
    return {};
  }

  const visibleApplications: Prisma.InstructorApplicationWhereInput[] = [
    { applicantId: actor.id },
    { reviewerId: actor.id },
    ...SEARCHABLE_INTERVIEW_ROUNDS.map((round) => ({
      AND: [
        { interviewRound: round },
        {
          interviewerAssignments: {
            some: {
              interviewerId: actor.id,
              removedAt: null,
              round,
            },
          },
        },
      ],
    })),
  ];

  if (isChapterLead(actor)) {
    if (actor.chapterId) {
      visibleApplications.push({ applicant: { chapterId: actor.chapterId } });
    }
    visibleApplications.push({ applicant: { chapterId: null } });
  }

  return { OR: visibleApplications };
}

export async function instructorApplicationVisibilityWhere(
  viewerId: string
): Promise<Prisma.InstructorApplicationWhereInput | null> {
  const actor = await getHiringActor(viewerId).catch(() => null);
  if (!actor) return null;
  return instructorApplicationVisibilityWhereForActor(actor);
}
