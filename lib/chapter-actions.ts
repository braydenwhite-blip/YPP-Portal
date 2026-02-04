"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { RoleType } from "@prisma/client";

// ============================================
// CHAPTER DASHBOARD DATA
// ============================================

export async function getChapterDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Only Chapter Presidents and Admins can access this");
  }

  const chapterId = user?.chapterId;
  if (!chapterId) throw new Error("User is not assigned to a chapter");

  // Get chapter details with all related data
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          createdAt: true,
        },
      },
      courses: {
        include: {
          leadInstructor: {
            select: { id: true, name: true },
          },
          enrollments: {
            select: { id: true },
          },
        },
      },
      events: {
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: "asc" },
        take: 5,
      },
      positions: {
        where: { isOpen: true },
        include: {
          _count: { select: { applications: true } },
        },
      },
      announcements: {
        where: { isActive: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
      },
    },
  });

  // Calculate stats
  const instructors = chapter?.users.filter(
    (u) => u.primaryRole === "INSTRUCTOR"
  );
  const students = chapter?.users.filter((u) => u.primaryRole === "STUDENT");
  const mentors = chapter?.users.filter((u) => u.primaryRole === "MENTOR");

  // Get recent enrollments
  const recentEnrollments = await prisma.enrollment.findMany({
    where: {
      course: { chapterId },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: {
      user: { select: { id: true, name: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    chapter,
    stats: {
      totalInstructors: instructors?.length || 0,
      totalStudents: students?.length || 0,
      totalMentors: mentors?.length || 0,
      totalCourses: chapter?.courses.length || 0,
      upcomingEvents: chapter?.events.length || 0,
      openPositions: chapter?.positions.length || 0,
    },
    instructors,
    students,
    recentEnrollments,
  };
}

// ============================================
// CHAPTER INSTRUCTORS
// ============================================

export async function getChapterInstructors() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const chapterId = user?.chapterId;

  return prisma.user.findMany({
    where: {
      chapterId: isAdmin ? undefined : chapterId,
      primaryRole: "INSTRUCTOR",
    },
    include: {
      profile: true,
      courses: {
        include: {
          enrollments: { select: { id: true } },
        },
      },
      goals: {
        include: {
          template: true,
          progress: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      trainings: {
        include: { module: true },
      },
      approvals: {
        include: { levels: true },
      },
      reflectionSubmissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        include: { form: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getInstructorDetail(instructorId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = currentUser?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = currentUser?.roles.some(
    (r) => r.role === "CHAPTER_LEAD"
  );
  const isMentor = currentUser?.roles.some((r) => r.role === "MENTOR");

  if (!isAdmin && !isChapterLead && !isMentor) {
    throw new Error("Unauthorized");
  }

  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    include: {
      profile: true,
      chapter: true,
      courses: {
        include: {
          enrollments: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
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
      trainings: {
        include: { module: true },
        orderBy: { module: { sortOrder: "asc" } },
      },
      approvals: {
        include: { levels: true },
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
      menteePairs: {
        include: {
          mentor: { select: { id: true, name: true, email: true } },
        },
      },
      awards: {
        orderBy: { awardedAt: "desc" },
      },
    },
  });

  // Verify chapter access for chapter leads
  if (
    isChapterLead &&
    !isAdmin &&
    instructor?.chapterId !== currentUser?.chapterId
  ) {
    throw new Error("You can only view instructors in your chapter");
  }

  return instructor;
}

// ============================================
// CHAPTER STUDENTS
// ============================================

export async function getChapterStudents() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const chapterId = user?.chapterId;

  return prisma.user.findMany({
    where: {
      chapterId: isAdmin ? undefined : chapterId,
      primaryRole: "STUDENT",
    },
    include: {
      profile: true,
      enrollments: {
        include: {
          course: {
            select: { id: true, title: true, format: true },
          },
        },
      },
      menteePairs: {
        include: {
          mentor: { select: { id: true, name: true } },
        },
      },
      feedbackGiven: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { name: "asc" },
  });
}

// ============================================
// CHAPTER UPDATES
// ============================================

export async function getChapterUpdates() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.chapterId) throw new Error("User is not assigned to a chapter");

  return prisma.chapterUpdate.findMany({
    where: {
      chapterId: user.chapterId,
      OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: user.primaryRole } }],
    },
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
  });
}

export async function createChapterUpdate(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Only Chapter Presidents can create updates");
  }

  const chapterId = user?.chapterId;
  if (!chapterId) throw new Error("User is not assigned to a chapter");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const isPinned = formData.get("isPinned") === "true";
  const targetRolesRaw = formData.get("targetRoles") as string;
  const targetRoles = targetRolesRaw
    ? (targetRolesRaw.split(",") as RoleType[])
    : [];

  const update = await prisma.chapterUpdate.create({
    data: {
      chapterId,
      authorId: session.user.id,
      title,
      content,
      isPinned,
      targetRoles,
    },
  });

  revalidatePath("/chapter/updates");
  return update;
}

export async function deleteChapterUpdate(updateId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const update = await prisma.chapterUpdate.findUnique({
    where: { id: updateId },
  });

  if (!update) throw new Error("Update not found");

  // Chapter leads can only delete their own chapter's updates
  if (isChapterLead && !isAdmin && update.chapterId !== user?.chapterId) {
    throw new Error("Unauthorized");
  }

  await prisma.chapterUpdate.delete({
    where: { id: updateId },
  });

  revalidatePath("/chapter/updates");
}

// ============================================
// CHAPTER MARKETING
// ============================================

export async function getChapterMarketing() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const chapterId = user?.chapterId;
  if (!chapterId) throw new Error("User is not assigned to a chapter");

  const stats = await prisma.marketingStats.findMany({
    where: { chapterId },
    orderBy: { month: "desc" },
    take: 12,
  });

  const goals = await prisma.marketingGoal.findMany({
    where: { chapterId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return { stats, goals };
}

export async function addMarketingStats(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const chapterId = user?.chapterId;
  if (!chapterId) throw new Error("User is not assigned to a chapter");

  const monthStr = formData.get("month") as string;
  const month = new Date(monthStr);
  const socialReach = parseInt(formData.get("socialReach") as string) || 0;
  const newInquiries = parseInt(formData.get("newInquiries") as string) || 0;
  const enrollments = parseInt(formData.get("enrollments") as string) || 0;
  const notes = formData.get("notes") as string;

  const stats = await prisma.marketingStats.upsert({
    where: {
      chapterId_month: { chapterId, month },
    },
    create: {
      chapterId,
      month,
      socialReach,
      newInquiries,
      enrollments,
      notes,
    },
    update: {
      socialReach,
      newInquiries,
      enrollments,
      notes,
    },
  });

  revalidatePath("/chapter/marketing");
  return stats;
}

export async function addMarketingGoal(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const chapterId = user?.chapterId;
  if (!chapterId) throw new Error("User is not assigned to a chapter");

  const metric = formData.get("metric") as string;
  const target = parseInt(formData.get("target") as string);
  const deadlineStr = formData.get("deadline") as string;
  const deadline = deadlineStr ? new Date(deadlineStr) : null;

  const goal = await prisma.marketingGoal.create({
    data: {
      chapterId,
      metric,
      target,
      deadline,
    },
  });

  revalidatePath("/chapter/marketing");
  return goal;
}

// ============================================
// CHAPTER APPLICANTS
// ============================================

export async function getChapterApplicants() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  const chapterId = user?.chapterId;

  return prisma.application.findMany({
    where: {
      position: {
        chapterId: isAdmin ? undefined : chapterId,
      },
    },
    include: {
      applicant: {
        select: { id: true, name: true, email: true },
      },
      position: {
        select: { id: true, title: true, type: true },
      },
      interviewSlots: {
        orderBy: { scheduledAt: "asc" },
      },
      decision: true,
    },
    orderBy: { submittedAt: "desc" },
  });
}

// ============================================
// ADMIN CHAPTER MANAGEMENT
// ============================================

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin only");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

export async function createChapter(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const city = getString(formData, "city", false);
  const region = getString(formData, "region", false);
  const partnerSchool = getString(formData, "partnerSchool", false);
  const programNotes = getString(formData, "programNotes", false);

  await prisma.chapter.create({
    data: {
      name,
      city: city || null,
      region: region || null,
      partnerSchool: partnerSchool || null,
      programNotes: programNotes || null
    }
  });

  revalidatePath("/admin/chapters");
  revalidatePath("/chapters");
}

export async function updateChapter(formData: FormData) {
  await requireAdmin();

  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const city = getString(formData, "city", false);
  const region = getString(formData, "region", false);
  const partnerSchool = getString(formData, "partnerSchool", false);
  const programNotes = getString(formData, "programNotes", false);

  await prisma.chapter.update({
    where: { id },
    data: {
      name,
      city: city || null,
      region: region || null,
      partnerSchool: partnerSchool || null,
      programNotes: programNotes || null
    }
  });

  revalidatePath("/admin/chapters");
  revalidatePath("/chapters");
}

export async function deleteChapter(formData: FormData) {
  await requireAdmin();

  const id = getString(formData, "id");

  // Check if chapter has users
  const usersCount = await prisma.user.count({ where: { chapterId: id } });
  if (usersCount > 0) {
    throw new Error("Cannot delete chapter with existing users. Remove users first.");
  }

  // Delete related records
  await prisma.announcement.deleteMany({ where: { chapterId: id } });
  await prisma.position.deleteMany({ where: { chapterId: id } });
  await prisma.event.deleteMany({ where: { chapterId: id } });
  await prisma.course.updateMany({ where: { chapterId: id }, data: { chapterId: null } });
  await prisma.goalTemplate.deleteMany({ where: { chapterId: id } });
  await prisma.marketingStats.deleteMany({ where: { chapterId: id } });
  await prisma.marketingGoal.deleteMany({ where: { chapterId: id } });
  await prisma.chapterUpdate.deleteMany({ where: { chapterId: id } });

  // Delete chapter
  await prisma.chapter.delete({ where: { id } });

  revalidatePath("/admin/chapters");
  revalidatePath("/chapters");
}
