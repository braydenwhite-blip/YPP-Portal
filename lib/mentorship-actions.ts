"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ProgressStatus } from "@prisma/client";

// ============================================
// MENTEE MANAGEMENT
// ============================================

export async function getMyMentees() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isMentor = user?.roles.some(
    (r) => r.role === "MENTOR" || r.role === "CHAPTER_LEAD" || r.role === "ADMIN"
  );

  if (!isMentor) {
    throw new Error("Only mentors can view mentees");
  }

  return prisma.mentorship.findMany({
    where: {
      mentorId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      mentee: {
        include: {
          profile: true,
          chapter: true,
          goals: {
            include: {
              template: true,
              progress: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
          reflectionSubmissions: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            include: {
              form: true,
            },
          },
          trainings: {
            include: { module: true },
          },
          courses: {
            include: {
              enrollments: { select: { id: true } },
            },
          },
        },
      },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });
}

export async function getMenteeDetail(menteeId: string) {
  const session = await getServerSession(authOptions);
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
        include: {
          mentor: { select: { id: true, name: true, email: true } },
          checkIns: {
            orderBy: { createdAt: "desc" },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isMentor = user?.roles.some(
    (r) => r.role === "MENTOR" || r.role === "CHAPTER_LEAD" || r.role === "ADMIN"
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const mentorshipId = formData.get("mentorshipId") as string;
  const notes = formData.get("notes") as string;
  const rating = parseInt(formData.get("rating") as string) || null;

  // Verify the mentorship exists and user is the mentor
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const mentorship = await prisma.mentorship.findFirst({
    where: {
      menteeId,
      OR: [{ mentorId: session.user.id }, { mentee: { id: session.user.id } }],
    },
    include: {
      checkIns: {
        orderBy: { createdAt: "desc" },
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
      include: {
        checkIns: {
          orderBy: { createdAt: "desc" },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const mentorship = await prisma.mentorship.findFirst({
    where: {
      menteeId: session.user.id,
      status: "ACTIVE",
    },
    include: {
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
      },
    },
  });

  return mentorship;
}

// ============================================
// MENTORSHIP STATS
// ============================================

export async function getMentorshipStats() {
  const session = await getServerSession(authOptions);
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
