"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { ProgressStatus, RoleType } from "@prisma/client";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  return session;
}

async function requireMentorOrAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized - Mentor or Admin access required");
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

// ============================================
// GOAL TEMPLATE ACTIONS (Admin only)
// ============================================

export async function createGoalTemplate(formData: FormData) {
  await requireAdmin();

  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const roleType = getString(formData, "roleType") as RoleType;
  const chapterId = getString(formData, "chapterId", false);
  const sortOrder = Number(getString(formData, "sortOrder", false) || "0");

  await prisma.goalTemplate.create({
    data: {
      title,
      description: description || null,
      roleType,
      chapterId: chapterId || null,
      sortOrder,
      isActive: true
    }
  });

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
}

export async function updateGoalTemplate(formData: FormData) {
  await requireAdmin();

  const templateId = getString(formData, "templateId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const isActive = formData.get("isActive") === "on";
  const sortOrder = Number(getString(formData, "sortOrder", false) || "0");

  await prisma.goalTemplate.update({
    where: { id: templateId },
    data: {
      title,
      description: description || null,
      isActive,
      sortOrder
    }
  });

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
}

export async function deleteGoalTemplate(formData: FormData) {
  await requireAdmin();

  const templateId = getString(formData, "templateId");

  // Check if there are any goals using this template
  const goalsCount = await prisma.goal.count({
    where: { templateId }
  });

  if (goalsCount > 0) {
    // Soft delete by deactivating
    await prisma.goalTemplate.update({
      where: { id: templateId },
      data: { isActive: false }
    });
  } else {
    // Hard delete if no goals exist
    await prisma.goalTemplate.delete({
      where: { id: templateId }
    });
  }

  revalidatePath("/admin/goals");
}

// ============================================
// GOAL ASSIGNMENT ACTIONS (Admin only)
// ============================================

export async function assignGoalToUser(formData: FormData) {
  await requireAdmin();

  const templateId = getString(formData, "templateId");
  const userId = getString(formData, "userId");
  const targetDate = getString(formData, "targetDate", false);
  const timetable = getString(formData, "timetable", false);

  // Check if user already has this goal
  const existing = await prisma.goal.findFirst({
    where: { templateId, userId }
  });

  if (existing) {
    throw new Error("User already has this goal assigned");
  }

  await prisma.goal.create({
    data: {
      templateId,
      userId,
      targetDate: targetDate ? new Date(targetDate) : null,
      timetable: timetable || null
    }
  });

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
  revalidatePath("/mentorship");
}

export async function assignGoalsToUserByRole(formData: FormData) {
  await requireAdmin();

  const userId = getString(formData, "userId");
  const roleType = getString(formData, "roleType") as RoleType;

  // Get all active templates for this role
  const templates = await prisma.goalTemplate.findMany({
    where: {
      roleType,
      isActive: true
    },
    orderBy: { sortOrder: "asc" }
  });

  // Get existing goals for user
  const existingGoals = await prisma.goal.findMany({
    where: { userId },
    select: { templateId: true }
  });
  const existingTemplateIds = new Set(existingGoals.map((g) => g.templateId));

  // Create goals for templates not yet assigned
  const newGoals = templates
    .filter((t) => !existingTemplateIds.has(t.id))
    .map((template, index) => ({
      templateId: template.id,
      userId,
      timetable: `Timetable ${index + 1}`
    }));

  if (newGoals.length > 0) {
    await prisma.goal.createMany({
      data: newGoals
    });
  }

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
}

export async function removeGoalFromUser(formData: FormData) {
  await requireAdmin();

  const goalId = getString(formData, "goalId");

  // Check if there are any progress updates
  const updatesCount = await prisma.progressUpdate.count({
    where: { goalId }
  });

  if (updatesCount > 0) {
    throw new Error("Cannot remove goal with existing progress updates");
  }

  await prisma.goal.delete({
    where: { id: goalId }
  });

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
}

// ============================================
// PROGRESS UPDATE ACTIONS (Mentor/Admin)
// ============================================

export async function submitProgressUpdate(formData: FormData) {
  const session = await requireMentorOrAdmin();
  const submittedById = session.user.id;

  const goalId = getString(formData, "goalId");
  const forUserId = getString(formData, "forUserId");
  const status = getString(formData, "status") as ProgressStatus;
  const comments = getString(formData, "comments", false);

  // Validate status
  if (!["BEHIND_SCHEDULE", "GETTING_STARTED", "ON_TRACK", "ABOVE_AND_BEYOND"].includes(status)) {
    throw new Error("Invalid progress status");
  }

  // Verify mentor has access to this mentee
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: submittedById,
        menteeId: forUserId,
        status: "ACTIVE"
      }
    });

    if (!mentorship) {
      throw new Error("You are not assigned as mentor for this user");
    }
  }

  await prisma.progressUpdate.create({
    data: {
      goalId,
      submittedById,
      forUserId,
      status,
      comments: comments || null
    }
  });

  revalidatePath("/goals");
  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${forUserId}`);
}

export async function submitBulkProgressUpdates(formData: FormData) {
  const session = await requireMentorOrAdmin();
  const submittedById = session.user.id;

  const forUserId = getString(formData, "forUserId");
  const overallComments = getString(formData, "overallComments", false);

  // Get all goal updates from form
  const updates: Array<{ goalId: string; status: ProgressStatus; comments: string }> = [];

  // Parse form data for each goal
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("goal_") && key.endsWith("_status")) {
      const goalId = key.replace("goal_", "").replace("_status", "");
      const status = value as ProgressStatus;
      const comments = (formData.get(`goal_${goalId}_comments`) as string) || "";

      if (status && ["BEHIND_SCHEDULE", "GETTING_STARTED", "ON_TRACK", "ABOVE_AND_BEYOND"].includes(status)) {
        updates.push({ goalId, status, comments });
      }
    }
  }

  if (updates.length === 0) {
    throw new Error("No valid progress updates provided");
  }

  // Verify mentor has access
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: submittedById,
        menteeId: forUserId,
        status: "ACTIVE"
      }
    });

    if (!mentorship) {
      throw new Error("You are not assigned as mentor for this user");
    }
  }

  // Create all progress updates
  await prisma.progressUpdate.createMany({
    data: updates.map((update) => ({
      goalId: update.goalId,
      submittedById,
      forUserId,
      status: update.status,
      comments: update.comments || overallComments || null
    }))
  });

  revalidatePath("/goals");
  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${forUserId}`);
}

// ============================================
// QUERY HELPERS
// ============================================

export async function getUserGoalsWithProgress(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: {
      template: true,
      progress: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          submittedBy: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { template: { sortOrder: "asc" } }
  });

  return goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    description: goal.template.description,
    timetable: goal.timetable,
    targetDate: goal.targetDate,
    latestStatus: goal.progress[0]?.status ?? null,
    latestComments: goal.progress[0]?.comments ?? null,
    lastUpdatedAt: goal.progress[0]?.createdAt ?? null,
    lastUpdatedBy: goal.progress[0]?.submittedBy?.name ?? null
  }));
}

export async function getMenteeGoalsForFeedback(menteeId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId: menteeId },
    include: {
      template: true,
      progress: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    },
    orderBy: { template: { sortOrder: "asc" } }
  });

  return goals;
}
