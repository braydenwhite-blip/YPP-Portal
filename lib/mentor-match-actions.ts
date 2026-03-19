"use server";

import { MentorshipType, SupportRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
import {
  scoreSupportMatch,
} from "@/lib/mentorship-hub";
import {
  getAdminMentorshipLaneForUser,
  getMentorshipTypeForAdminLane,
  getRemainingGapLabelsAfterAssignment,
  getSupportRoleGapLabels,
  getSupportRoleLabel,
  getSupportRolesPresent,
  type AdminMentorshipLane,
} from "@/lib/mentorship-admin-helpers";
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
  | "CHAIR"
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

export interface MentorMatchGroup {
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteeChapter: string | null;
  menteeRole: string;
  lane: AdminMentorshipLane;
  type: MentorshipType;
  supportRole: MatchSupportRole;
  currentMentorName: string | null;
  currentTrackName: string | null;
  currentRoles: string[];
  missingRoles: string[];
  remainingGapsAfterApproval: string[];
  candidates: MentorMatchSuggestion[];
}

export async function computeMentorMatches(
  lane: AdminMentorshipLane,
  supportRole: MatchSupportRole = "PRIMARY_MENTOR",
  menteeId?: string
) {
  await requireAdmin();

  const type = getMentorshipTypeForAdminLane(lane);
  const laneWhere = getLaneWhere(lane);

  const potentialMentees = await prisma.user.findMany({
    where: {
      ...laneWhere,
      ...(menteeId ? { id: menteeId } : {}),
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
            menteePairs: {
              some: {
                status: "ACTIVE",
                type,
              },
            },
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
      roles: {
        select: { role: true },
      },
      menteePairs: {
        where: { status: "ACTIVE", type },
        orderBy: { startDate: "desc" },
        take: 1,
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
            },
          },
          track: {
            select: {
              id: true,
              name: true,
            },
          },
          chair: {
            select: {
              id: true,
              name: true,
            },
          },
          circleMembers: {
            where: { isActive: true },
            select: {
              role: true,
            },
          },
        },
      },
      supportCircleForMentees: {
        where: { isActive: true },
        select: { role: true },
      },
    },
    orderBy: { name: "asc" },
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
            chairedMentorships: {
              where: { status: "ACTIVE" },
            },
            supportCircleMemberships: {
              where: { isActive: true },
            },
          },
        });

  const groupedSuggestions: MentorMatchGroup[] = [];

  for (const mentee of potentialMentees) {
    const candidates: MentorMatchSuggestion[] = [];
    const activeMentorship = mentee.menteePairs[0] ?? null;
    const rolesPresent = getSupportRolesPresent({
      mentorAssigned: Boolean(activeMentorship?.mentorId),
      chairAssigned: Boolean(activeMentorship?.chairId),
      circleRoles: activeMentorship?.circleMembers.map((member) => member.role) ?? [],
    });

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
          : mentor.mentorPairs.length +
            mentor.supportCircleMemberships.length +
            (supportRole === "CHAIR" ? mentor.chairedMentorships.length : 0);
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

      candidates.push({
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
      });
    }

    candidates.sort((left, right) => right.matchScore - left.matchScore);

    groupedSuggestions.push({
      menteeId: mentee.id,
      menteeName: mentee.name,
      menteeEmail: mentee.email,
      menteeChapter: mentee.chapter?.name ?? null,
      menteeRole: mentee.primaryRole,
      lane: getAdminMentorshipLaneForUser({
        primaryRole: mentee.primaryRole,
        roles: mentee.roles.map((role) => role.role),
      }),
      type,
      supportRole,
      currentMentorName: activeMentorship?.mentor.name ?? null,
      currentTrackName: activeMentorship?.track?.name ?? null,
      currentRoles: rolesPresent.map((role) => getSupportRoleLabel(role)),
      missingRoles: getSupportRoleGapLabels(rolesPresent),
      remainingGapsAfterApproval: getRemainingGapLabelsAfterAssignment({
        rolesPresent,
        supportRole: supportRole as SupportRole,
      }),
      candidates: candidates.slice(0, 3),
    });
  }

  groupedSuggestions.sort((left, right) => {
    const leftBest = left.candidates[0]?.matchScore ?? Number.NEGATIVE_INFINITY;
    const rightBest =
      right.candidates[0]?.matchScore ?? Number.NEGATIVE_INFINITY;
    return rightBest - leftBest;
  });

  return groupedSuggestions;
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

function getLaneWhere(lane: AdminMentorshipLane) {
  if (lane === "STUDENTS") {
    return {
      OR: [{ roles: { some: { role: "STUDENT" } } }, { primaryRole: "STUDENT" }],
    };
  }

  if (lane === "INSTRUCTORS") {
    return {
      OR: [
        { roles: { some: { role: "INSTRUCTOR" } } },
        { primaryRole: "INSTRUCTOR" },
      ],
    };
  }

  return {
    primaryRole: {
      in: ["CHAPTER_LEAD", "ADMIN", "STAFF"],
    },
  };
}
