/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — mentee dashboard state.
 *
 * Derives which lifecycle state a mentee is in so /my-mentor can render the right
 * "command center" view. Read-only (plain async). Crucially, the mentee never
 * sees internal mentor rankings — only whether their application is received,
 * under review, matched, or complete.
 *
 * @deprecated Orphaned (zero consumers) — the live hub uses `MenteeDevelopmentBrief`.
 * Superseded by the unified Mentorship workspace (`lib/mentorship/workspace.ts`).
 * Scheduled for removal in the consolidation V2 cleanup; do not add new callers.
 */

import { prisma } from "@/lib/prisma";

export type MenteeStateKind =
  | "matched" // D — active mentorship
  | "completed" // E — completed mentorship / alumni
  | "reviewing" // C — recommendations generated / under review
  | "applied" // B — application submitted, not yet reviewed
  | "none"; // A — has not applied

export interface MenteeMentorshipView {
  state: MenteeStateKind;
  application: {
    status: string;
    goals: string | null;
    interests: string[];
    preferredExpertise: string[];
    createdAt: string;
    hasRecommendations: boolean;
  } | null;
  alumni: { graduationYear: number | null; college: string | null } | null;
  matched: {
    mentorshipId: string;
    mentorName: string | null;
    mentorExpertise: { slug: string; name: string }[];
    kickoffCompletedAt: string | null;
    status: string;
  } | null;
  goals: {
    application: string | null;
    careerGoal: string | null;
    leadershipGoal: string | null;
  };
}

/** Compute the mentee's current mentorship lifecycle view. */
export async function getMenteeMentorshipView(
  userId: string
): Promise<MenteeMentorshipView> {
  const [activeMentorship, completedMentorship, openApplication, alumni, profile] =
    await Promise.all([
      prisma.mentorship.findFirst({
        where: { menteeId: userId, status: "ACTIVE" },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          status: true,
          kickoffCompletedAt: true,
          mentor: {
            select: {
              id: true,
              name: true,
              mentorExpertise: {
                select: {
                  expertiseArea: { select: { slug: true, name: true, isActive: true } },
                },
              },
            },
          },
        },
      }),
      prisma.mentorship.findFirst({
        where: { menteeId: userId, status: "COMPLETE" },
        orderBy: { endDate: "desc" },
        select: { id: true },
      }),
      prisma.mentorshipApplication.findFirst({
        where: { applicantId: userId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          goals: true,
          interests: true,
          preferredExpertise: true,
          createdAt: true,
        },
      }),
      prisma.alumniProfile.findUnique({
        where: { userId },
        select: { graduationYear: true, college: true },
      }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { careerGoal: true, leadershipGoal: true },
      }),
    ]);

  let hasRecommendations = false;
  if (openApplication) {
    const count = await prisma.mentorshipMatchRecommendation.count({
      where: {
        mentorshipApplicationId: openApplication.id,
        status: { not: "SUPERSEDED" },
      },
    });
    hasRecommendations = count > 0;
  }

  let state: MenteeStateKind;
  if (activeMentorship) state = "matched";
  else if (alumni || completedMentorship) state = "completed";
  else if (openApplication)
    state =
      hasRecommendations || openApplication.status === "UNDER_REVIEW"
        ? "reviewing"
        : "applied";
  else state = "none";

  return {
    state,
    application: openApplication
      ? {
          status: openApplication.status,
          goals: openApplication.goals,
          interests: openApplication.interests,
          preferredExpertise: openApplication.preferredExpertise,
          createdAt: openApplication.createdAt.toISOString(),
          hasRecommendations,
        }
      : null,
    alumni: alumni
      ? { graduationYear: alumni.graduationYear, college: alumni.college }
      : null,
    matched: activeMentorship
      ? {
          mentorshipId: activeMentorship.id,
          mentorName: activeMentorship.mentor?.name ?? null,
          mentorExpertise: (activeMentorship.mentor?.mentorExpertise ?? [])
            .filter((e) => e.expertiseArea.isActive)
            .map((e) => ({ slug: e.expertiseArea.slug, name: e.expertiseArea.name })),
          kickoffCompletedAt: activeMentorship.kickoffCompletedAt
            ? activeMentorship.kickoffCompletedAt.toISOString()
            : null,
          status: activeMentorship.status,
        }
      : null,
    goals: {
      application: openApplication?.goals ?? null,
      careerGoal: profile?.careerGoal ?? null,
      leadershipGoal: profile?.leadershipGoal ?? null,
    },
  };
}
