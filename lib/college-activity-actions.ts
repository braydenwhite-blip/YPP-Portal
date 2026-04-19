"use server";

import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { ActivityCategory } from "@prisma/client";
import { ACTIVITY_CATEGORY_CONFIG } from "@/lib/college-activity-config";

// Private alias for internal use
const CATEGORY_CONFIG = ACTIVITY_CATEGORY_CONFIG;

// ============================================
// FETCH
// ============================================

export async function getMyActivities() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  const activities = await prisma.collegeActivity.findMany({
    where: { userId },
    include: {
      milestones: { orderBy: { date: "asc" } },
    },
    orderBy: [{ isYppActivity: "desc" }, { sortOrder: "asc" }],
  });

  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    categoryConfig: CATEGORY_CONFIG[a.category],
    organization: a.organization,
    role: a.role,
    description: a.description,
    hoursPerWeek: a.hoursPerWeek,
    weeksPerYear: a.weeksPerYear,
    yearsInvolved: a.yearsInvolved,
    startDate: a.startDate?.toISOString() ?? null,
    endDate: a.endDate?.toISOString() ?? null,
    isOngoing: a.isOngoing,
    impactStatement: a.impactStatement,
    advisorNotes: a.advisorNotes,
    isYppActivity: a.isYppActivity,
    sortOrder: a.sortOrder,
    milestones: a.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date?.toISOString() ?? null,
      description: m.description,
    })),
  }));
}

/**
 * Generate Common App format export (top 10 activities).
 */
export async function generateCommonAppExport(userId?: string) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const targetUserId = userId ?? (session.user.id as string);

  // Advisors/admins can export for any student; students only for themselves
  const roles = session.user.roles ?? [];
  const isAdminOrAdvisor =
    roles.includes("ADMIN") || roles.includes("STAFF") || roles.includes("CHAPTER_PRESIDENT");
  if (targetUserId !== session.user.id && !isAdminOrAdvisor) return null;

  const activities = await prisma.collegeActivity.findMany({
    where: { userId: targetUserId },
    orderBy: [{ isYppActivity: "desc" }, { sortOrder: "asc" }],
    take: 10,
  });

  return activities.map((a, i) => ({
    position: i + 1,
    activityType: CATEGORY_CONFIG[a.category]?.commonAppCategory ?? "Other",
    positionTitle: (a.role ?? "Participant").slice(0, 50),
    organizationName: (a.organization ?? a.name).slice(0, 100),
    description: (a.description ?? "").slice(0, 150),
    isCurrentlyInvolved: a.isOngoing,
    participationGrades: a.yearsInvolved
      ? `${Math.max(9, 12 - (a.yearsInvolved - 1))}-12`
      : "12",
    hoursPerWeek: a.hoursPerWeek ?? 0,
    weeksPerYear: a.weeksPerYear ?? 36,
  }));
}

/**
 * Auto-populate YPP activities from portal data (mentorship, awards, etc.).
 */
export async function populateYppActivities() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;

  const [mentorships, summary] = await Promise.all([
    prisma.mentorship.findMany({
      where: { menteeId: userId },
      select: {
        ...MENTORSHIP_LEGACY_ROOT_SELECT,
        selfReflections: { select: { id: true } },
      },
    }),
    prisma.achievementPointSummary.findUnique({
      where: { userId },
      select: { totalPoints: true, currentTier: true },
    }),
  ]);

  const existingYpp = await prisma.collegeActivity.findMany({
    where: { userId, isYppActivity: true },
    select: { name: true },
  });
  const existingNames = new Set(existingYpp.map((a) => a.name));

  const toCreate: Array<{
    userId: string;
    name: string;
    category: ActivityCategory;
    organization: string;
    role: string;
    description: string;
    isYppActivity: boolean;
    isOngoing: boolean;
    hoursPerWeek: number;
    weeksPerYear: number;
    startDate: Date | null;
  }> = [];

  // YPP Mentorship Program
  if (!existingNames.has("YPP Mentorship Program")) {
    const activeMentorship = mentorships.find((m) => m.status === "ACTIVE");
    if (activeMentorship) {
      const totalCycles = mentorships.reduce((sum, m) => sum + m.selfReflections.length, 0);
      toCreate.push({
        userId,
        name: "YPP Mentorship Program",
        category: "LEADERSHIP",
        organization: "Young Professionals Program",
        role: "Mentee — Mentorship Achievement Program",
        description: `Active participant in YPP's structured mentorship program. Completed ${totalCycles} monthly reflection cycles with achievement-based goal tracking.${summary?.currentTier ? ` Earned ${summary.currentTier} tier (${summary.totalPoints} pts).` : ""}`.slice(0, 150),
        isYppActivity: true,
        isOngoing: true,
        hoursPerWeek: 2,
        weeksPerYear: 36,
        startDate: activeMentorship.startDate,
      });
    }
  }

  if (toCreate.length === 0) {
    return { success: true, created: 0 };
  }

  // Get or create roadmap for the user to set sortOrder
  const existingCount = await prisma.collegeActivity.count({ where: { userId } });

  await prisma.collegeActivity.createMany({
    data: toCreate.map((item, i) => ({
      ...item,
      sortOrder: existingCount + i,
    })),
  });

  revalidatePath("/college-advisor/activities");
  return { success: true, created: toCreate.length };
}

// ============================================
// MUTATIONS
// ============================================

export async function createActivity(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const name = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const organization = String(formData.get("organization") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const hoursPerWeekRaw = formData.get("hoursPerWeek");
  const weeksPerYearRaw = formData.get("weeksPerYear");
  const yearsInvolvedRaw = formData.get("yearsInvolved");
  const startDateRaw = formData.get("startDate");
  const isOngoingRaw = formData.get("isOngoing");
  const impactStatement = String(formData.get("impactStatement") ?? "").trim();

  if (!name) throw new Error("Activity name is required");
  if (!Object.values(ActivityCategory).includes(categoryRaw as ActivityCategory)) {
    throw new Error("Invalid category");
  }

  const existingCount = await prisma.collegeActivity.count({ where: { userId } });

  await prisma.collegeActivity.create({
    data: {
      userId,
      name,
      category: categoryRaw as ActivityCategory,
      organization: organization || null,
      role: role || null,
      description: description || null,
      hoursPerWeek: hoursPerWeekRaw ? parseFloat(String(hoursPerWeekRaw)) : null,
      weeksPerYear: weeksPerYearRaw ? parseInt(String(weeksPerYearRaw), 10) : null,
      yearsInvolved: yearsInvolvedRaw ? parseInt(String(yearsInvolvedRaw), 10) : null,
      startDate: startDateRaw ? new Date(String(startDateRaw)) : null,
      isOngoing: isOngoingRaw === "true",
      impactStatement: impactStatement || null,
      sortOrder: existingCount,
    },
  });

  revalidatePath("/college-advisor/activities");
  return { success: true };
}

export async function updateActivity(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const impactStatement = String(formData.get("impactStatement") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const hoursPerWeekRaw = formData.get("hoursPerWeek");
  const weeksPerYearRaw = formData.get("weeksPerYear");

  const activity = await prisma.collegeActivity.findUnique({ where: { id } });
  if (!activity || activity.userId !== userId) throw new Error("Not found");

  await prisma.collegeActivity.update({
    where: { id },
    data: {
      name: name || undefined,
      description: description || null,
      impactStatement: impactStatement || null,
      role: role || null,
      hoursPerWeek: hoursPerWeekRaw ? parseFloat(String(hoursPerWeekRaw)) : undefined,
      weeksPerYear: weeksPerYearRaw ? parseInt(String(weeksPerYearRaw), 10) : undefined,
    },
  });

  revalidatePath("/college-advisor/activities");
  return { success: true };
}

export async function deleteActivity(activityId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;

  const activity = await prisma.collegeActivity.findUnique({ where: { id: activityId } });
  if (!activity || activity.userId !== userId) throw new Error("Not found");
  if (activity.isYppActivity) throw new Error("YPP activities cannot be deleted manually");

  await prisma.collegeActivity.delete({ where: { id: activityId } });
  revalidatePath("/college-advisor/activities");
  return { success: true };
}

export async function addMilestone(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const activityId = String(formData.get("activityId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dateRaw = formData.get("date");

  if (!title) throw new Error("Milestone title is required");

  const activity = await prisma.collegeActivity.findUnique({ where: { id: activityId } });
  if (!activity || activity.userId !== userId) throw new Error("Not found");

  await prisma.activityMilestone.create({
    data: {
      activityId,
      title,
      description: description || null,
      date: dateRaw ? new Date(String(dateRaw)) : null,
    },
  });

  revalidatePath("/college-advisor/activities");
  return { success: true };
}
