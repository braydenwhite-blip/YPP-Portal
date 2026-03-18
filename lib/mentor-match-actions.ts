"use server";

import { MentorshipType, SupportRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import {
  scoreSupportMatch,
} from "@/lib/mentorship-hub";
import {
  assignSupportCircleMember,
} from "@/lib/mentorship-hub-actions";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

type MatchSupportRole =
  | "PRIMARY_MENTOR"
  | "SPECIALIST_MENTOR"
  | "COLLEGE_ADVISOR"
  | "ALUMNI_ADVISOR";

export interface MentorMatchSuggestion {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  mentorChapter: string | null;
  mentorInterests: string[];
  mentorCurrentMentees: number;
  mentorAvailability: string | null;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteeChapter: string | null;
  menteeInterests: string[];
  matchScore: number;
  matchReasons: string[];
  type: MentorshipType;
  supportRole: MatchSupportRole;
}

export async function computeMentorMatches(
  type: "INSTRUCTOR" | "STUDENT",
  supportRole: MatchSupportRole = "PRIMARY_MENTOR"
) {
  await requireAdmin();

  const menteeRole = type === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT";

  const potentialMentees = await prisma.user.findMany({
    where: {
      roles: { some: { role: menteeRole } },
      ...(supportRole === "PRIMARY_MENTOR"
        ? {
            NOT: {
              menteePairs: {
                some: {
                  status: "ACTIVE",
                  type,
                },
              },
            },
          }
        : {
            NOT: {
              supportCircleForMentees: {
                some: {
                  role: supportRole as SupportRole,
                  isActive: true,
                },
              },
            },
          }),
    },
    include: {
      profile: true,
      chapter: true,
      menteePairs: {
        where: { status: "ACTIVE" },
      },
      supportCircleForMentees: {
        where: { isActive: true },
      },
    },
  });

  if (potentialMentees.length === 0) {
    return [];
  }

  const mentorPool =
    supportRole === "COLLEGE_ADVISOR"
      ? await prisma.collegeAdvisor.findMany({
          where: { isActive: true },
          include: {
            user: {
              include: {
                profile: true,
                chapter: true,
              },
            },
            advisees: {
              where: { endDate: null },
            },
          },
        })
      : await prisma.user.findMany({
          where:
            supportRole === "ALUMNI_ADVISOR"
              ? {
                  alumniProfile: {
                    isNot: null,
                  },
                }
              : {
                  roles: {
                    some: {
                      role: {
                        in: ["MENTOR", "INSTRUCTOR", "CHAPTER_LEAD", "ADMIN", "STAFF"],
                      },
                    },
                  },
                },
          include: {
            profile: true,
            chapter: true,
            mentorPairs: {
              where: { status: "ACTIVE" },
            },
            supportCircleMemberships: {
              where: { isActive: true },
            },
          },
        });

  const suggestions: MentorMatchSuggestion[] = [];

  for (const mentee of potentialMentees) {
    let bestMatch: MentorMatchSuggestion | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const mentorCandidate of mentorPool) {
      const mentor =
        supportRole === "COLLEGE_ADVISOR"
          ? (mentorCandidate as any).user
          : (mentorCandidate as any);

      if (mentor.id === mentee.id) {
        continue;
      }

      const mentorInterests = mentor.profile?.interests ?? [];
      const menteeInterests = mentee.profile?.interests ?? [];
      const currentLoad =
        supportRole === "COLLEGE_ADVISOR"
          ? (mentorCandidate as any).advisees.length
          : mentor.mentorPairs.length + mentor.supportCircleMemberships.length;
      const availability =
        supportRole === "COLLEGE_ADVISOR"
          ? (mentorCandidate as any).availability
          : mentor.profile?.mentorAvailability ?? null;
      const capacity =
        supportRole === "COLLEGE_ADVISOR" ? null : mentor.profile?.mentorCapacity ?? null;

      const result = scoreSupportMatch({
        supportRole: supportRole as SupportRole,
        mentorInterests,
        menteeInterests,
        sameChapter: Boolean(mentee.chapterId && mentor.chapterId && mentee.chapterId === mentor.chapterId),
        currentLoad,
        capacity,
        availability,
        hasProfile: Boolean(mentor.profile?.bio),
      });

      if (result.score > bestScore) {
        bestScore = result.score;
        bestMatch = {
          mentorId: mentor.id,
          mentorName: mentor.name,
          mentorEmail: mentor.email,
          mentorChapter: mentor.chapter?.name ?? null,
          mentorInterests,
          mentorCurrentMentees: currentLoad,
          mentorAvailability: availability,
          menteeId: mentee.id,
          menteeName: mentee.name,
          menteeEmail: mentee.email,
          menteeChapter: mentee.chapter?.name ?? null,
          menteeInterests,
          matchScore: result.score,
          matchReasons: result.reasons,
          type,
          supportRole,
        };
      }
    }

    if (bestMatch) {
      suggestions.push(bestMatch);
    }
  }

  suggestions.sort((a, b) => b.matchScore - a.matchScore);
  return suggestions;
}

export async function approveMentorMatch(formData: FormData) {
  await requireAdmin();

  const mentorId = String(formData.get("mentorId") ?? "").trim();
  const menteeId = String(formData.get("menteeId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() as MentorshipType;
  const supportRole =
    (String(formData.get("supportRole") ?? "").trim() as MatchSupportRole) ||
    "PRIMARY_MENTOR";

  if (!mentorId || !menteeId || !type) {
    throw new Error("Missing required fields");
  }

  const assignmentFormData = new FormData();
  assignmentFormData.set("menteeId", menteeId);
  assignmentFormData.set("userId", mentorId);
  assignmentFormData.set("role", supportRole);
  assignmentFormData.set("notes", "Created via layered mentor match");
  await assignSupportCircleMember(assignmentFormData);

  revalidatePath("/admin/mentor-match");
  revalidatePath("/admin/mentorship-program");
  revalidatePath("/mentorship");
}
