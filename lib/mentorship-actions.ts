"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { ProgressStatus } from "@prisma/client";
import { recomputeMentorshipCycleStage, getCurrentCycleMonth } from "@/lib/mentorship-cycle";
import { emitReflectionWindowOpened } from "@/lib/mentorship-notifications";
import { logger } from "@/lib/logger";
import {
  MENTORSHIP_CHECK_IN_SELECT,
  MENTORSHIP_LEGACY_ROOT_SELECT,
} from "@/lib/mentorship-read-fragments";

// ============================================
// MENTEE MANAGEMENT
// ============================================

export async function getMyMentees() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isMentor = user?.roles.some(
    (r) => r.role === "MENTOR" || r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN"
  );

  if (!isMentor) {
    throw new Error("Only mentors can view mentees");
  }

  return prisma.mentorship.findMany({
    where: {
      mentorId: session.user.id,
      status: "ACTIVE",
    },
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          profile: {
            select: {
              bio: true,
              avatarUrl: true,
              interests: true,
            },
          },
          chapter: {
            select: {
              id: true,
              name: true,
            },
          },
          goals: {
            select: {
              id: true,
              userId: true,
              templateId: true,
              targetDate: true,
              timetable: true,
              createdAt: true,
              updatedAt: true,
              template: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  roleType: true,
                  mentorshipProgramGroup: true,
                  chapterId: true,
                  isActive: true,
                  sortOrder: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              progress: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  goalId: true,
                  monthlyReviewId: true,
                  submittedById: true,
                  forUserId: true,
                  status: true,
                  comments: true,
                  createdAt: true,
                },
              },
            },
          },
          reflectionSubmissions: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: {
              id: true,
              userId: true,
              formId: true,
              month: true,
              submittedAt: true,
              form: {
                select: {
                  id: true,
                  title: true,
                  roleType: true,
                  isActive: true,
                },
              },
            },
          },
          trainings: {
            select: {
              id: true,
              userId: true,
              moduleId: true,
              cohortId: true,
              status: true,
              completedAt: true,
              createdAt: true,
              updatedAt: true,
              module: {
                select: {
                  id: true,
                  title: true,
                  sortOrder: true,
                },
              },
            },
          },
          courses: {
            select: {
              id: true,
              title: true,
              enrollments: {
                select: { id: true },
              },
            },
          },
        },
      },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: MENTORSHIP_CHECK_IN_SELECT,
      },
    },
  });
}

export async function getMenteeDetail(menteeId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");

  // Check if current user is the mentor for this mentee
  const mentorship = await prisma.mentorship.findFirst({
    where: {
      mentorId: session.user.id,
      menteeId,
      status: "ACTIVE",
    },
  });

  if (!mentorship && !isAdmin) {
    throw new Error("You are not the mentor for this user");
  }

  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    include: {
      profile: true,
      chapter: true,
      roles: true,
      goals: {
        include: {
          template: true,
          progress: {
            orderBy: { createdAt: "desc" },
            include: {
              submittedBy: { select: { id: true, name: true } },
            },
          },
        },
      },
      reflectionSubmissions: {
        orderBy: { submittedAt: "desc" },
        include: {
          form: true,
          responses: {
            include: { question: true },
            orderBy: { question: { sortOrder: "asc" } },
          },
        },
      },
      trainings: {
        include: { module: true },
        orderBy: { module: { sortOrder: "asc" } },
      },
      courses: {
        include: {
          enrollments: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
      approvals: {
        include: { levels: true },
      },
      awards: {
        orderBy: { awardedAt: "desc" },
      },
      menteePairs: {
        select: {
          ...MENTORSHIP_LEGACY_ROOT_SELECT,
          mentor: { select: { id: true, name: true, email: true } },
          checkIns: {
            orderBy: { createdAt: "desc" },
            select: MENTORSHIP_CHECK_IN_SELECT,
          },
        },
      },
    },
  });

  return mentee;
}

// ============================================
// PROGRESS FEEDBACK
// ============================================

export async function submitProgressFeedback(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isMentor = user?.roles.some(
    (r) => r.role === "MENTOR" || r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN"
  );

  if (!isMentor) {
    throw new Error("Only mentors can submit progress feedback");
  }

  const goalId = formData.get("goalId") as string;
  const forUserId = formData.get("forUserId") as string;
  const status = formData.get("status") as ProgressStatus;
  const comments = formData.get("comments") as string;

  // Verify the goal exists and belongs to the user
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!goal || goal.userId !== forUserId) {
    throw new Error("Invalid goal");
  }

  const progressUpdate = await prisma.progressUpdate.create({
    data: {
      goalId,
      submittedById: session.user.id,
      forUserId,
      status,
      comments,
    },
  });

  revalidatePath(`/mentorship/mentees/${forUserId}`);
  revalidatePath("/mentorship/mentees");
  revalidatePath("/goals");
  return progressUpdate;
}

// ============================================
// CHECK-INS
// ============================================

export async function addMentorshipCheckIn(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const mentorshipId = formData.get("mentorshipId") as string;
  const notes = formData.get("notes") as string;
  const rating = parseInt(formData.get("rating") as string) || null;

  // Verify the mentorship exists and user is the mentor
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: { id: true, mentorId: true, menteeId: true },
  });

  if (!mentorship) {
    throw new Error("Mentorship not found");
  }

  if (mentorship.mentorId !== session.user.id) {
    // Check if admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { roles: true },
    });
    if (!user?.roles.some((r) => r.role === "ADMIN")) {
      throw new Error("Only the assigned mentor can add check-ins");
    }
  }

  const checkIn = await prisma.mentorshipCheckIn.create({
    data: {
      mentorshipId,
      notes,
      rating,
    },
  });

  revalidatePath(`/mentorship/mentees/${mentorship.menteeId}`);
  revalidatePath("/mentorship/mentees");
  return checkIn;
}

export async function getMentorshipCheckIns(menteeId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const mentorship = await prisma.mentorship.findFirst({
    where: {
      menteeId,
      OR: [{ mentorId: session.user.id }, { mentee: { id: session.user.id } }],
    },
    select: {
      id: true,
      menteeId: true,
      checkIns: {
        orderBy: { createdAt: "desc" },
        select: MENTORSHIP_CHECK_IN_SELECT,
      },
    },
  });

  // Also allow admin access
  if (!mentorship) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { roles: true },
    });
    if (!user?.roles.some((r) => r.role === "ADMIN")) {
      throw new Error("Unauthorized");
    }

    const allMentorships = await prisma.mentorship.findMany({
      where: { menteeId },
      select: {
        checkIns: {
          orderBy: { createdAt: "desc" },
          select: MENTORSHIP_CHECK_IN_SELECT,
        },
      },
    });

    return allMentorships.flatMap((m) => m.checkIns);
  }

  return mentorship.checkIns;
}

// ============================================
// MENTOR CONTACT INFO
// ============================================

export async function getMyMentor() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const mentorship = await prisma.mentorship.findFirst({
    where: {
      menteeId: session.user.id,
      status: "ACTIVE",
    },
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: {
            select: { bio: true, avatarUrl: true },
          },
        },
      },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: MENTORSHIP_CHECK_IN_SELECT,
      },
    },
  });

  return mentorship;
}

// ============================================
// MENTORSHIP STATS
// ============================================

export async function getMentorshipStats() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  if (!isAdmin) {
    throw new Error("Only admins can view mentorship stats");
  }

  const totalMentorships = await prisma.mentorship.count();
  const activeMentorships = await prisma.mentorship.count({
    where: { status: "ACTIVE" },
  });

  const recentCheckIns = await prisma.mentorshipCheckIn.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  const progressUpdates = await prisma.progressUpdate.groupBy({
    by: ["status"],
    _count: true,
  });

  return {
    totalMentorships,
    activeMentorships,
    recentCheckIns,
    progressUpdates,
  };
}

// ============================================
// KICKOFF (Phase 0.9)
// ============================================

/**
 * Mark a mentorship's kickoff meeting complete. Only the assigned mentor or
 * an admin may call this. Flips cycleStage to REFLECTION_DUE and fires the
 * REFLECTION_WINDOW_OPENED notification to the mentee.
 */
export async function markKickoffComplete(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const mentorshipId = String(formData.get("mentorshipId") ?? "");
  if (!mentorshipId) throw new Error("Missing mentorshipId");

  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      mentorId: true,
      menteeId: true,
      kickoffCompletedAt: true,
      status: true,
    },
  });
  if (!mentorship) throw new Error("Mentorship not found");
  if (mentorship.mentorId !== userId && !isAdmin) {
    throw new Error("Only the assigned mentor or an admin may mark kickoff complete");
  }
  if (mentorship.kickoffCompletedAt) {
    logger.info({ mentorshipId, userId }, "markKickoffComplete: already complete — no-op");
    return;
  }
  if (mentorship.status !== "ACTIVE") {
    throw new Error("Kickoff only applies to active mentorships");
  }

  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: { kickoffCompletedAt: new Date() },
  });

  try {
    await recomputeMentorshipCycleStage(mentorshipId);
  } catch (err) {
    logger.warn({ err, mentorshipId }, "markKickoffComplete: cycleStage recompute failed");
  }

  const { cycleMonth } = getCurrentCycleMonth();
  await emitReflectionWindowOpened({
    menteeId: mentorship.menteeId,
    ctx: { cycleNumber: 1, cycleMonth },
  });

  revalidatePath(`/mentorship/mentees/${mentorship.menteeId}`);
  revalidatePath("/mentorship/mentees");
  revalidatePath("/mentorship");
}
