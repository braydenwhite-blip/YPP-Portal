"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireInstructor() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (
    !session?.user?.id ||
    (!roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_LEAD"))
  ) {
    throw new Error("Unauthorized – instructor role required");
  }
  return session;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!session?.user?.id || !roles.includes("ADMIN")) {
    throw new Error("Unauthorized – admin role required");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getBool(formData: FormData, key: string): boolean {
  return formData.get(key) === "true" || formData.get(key) === "on";
}

function getFloat(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const n = parseFloat(String(raw));
  return isNaN(n) ? fallback : n;
}

// ─── Instructor Competition Drafts ────────────────────────────────────────────

export async function createCompetitionDraft(formData: FormData) {
  const session = await requireInstructor();

  const season = getString(formData, "season");
  const theme = getString(formData, "theme");
  const passionArea = getString(formData, "passionArea", false) || null;
  const rules = getString(formData, "rules");
  const startDateRaw = getString(formData, "startDate");
  const endDateRaw = getString(formData, "endDate");
  const submissionDeadlineRaw = getString(formData, "submissionDeadline");
  const votingEnabled = getBool(formData, "votingEnabled");
  const communityVoteWeight = getFloat(formData, "communityVoteWeight", 0.3);
  const firstPlaceReward = getString(formData, "firstPlaceReward", false) || null;
  const secondPlaceReward = getString(formData, "secondPlaceReward", false) || null;
  const thirdPlaceReward = getString(formData, "thirdPlaceReward", false) || null;

  const judgingCriteriaRaw = getString(formData, "judgingCriteria", false);
  let judgingCriteria: object[] = [];
  try {
    judgingCriteria = judgingCriteriaRaw ? JSON.parse(judgingCriteriaRaw) : [];
  } catch {
    judgingCriteria = [];
  }

  const judgeIdsRaw = getString(formData, "judgeIds", false);
  const judgeIds: string[] = judgeIdsRaw
    ? judgeIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const competition = await prisma.seasonalCompetition.create({
    data: {
      season,
      theme,
      passionArea,
      rules,
      startDate: new Date(startDateRaw),
      endDate: new Date(endDateRaw),
      submissionDeadline: new Date(submissionDeadlineRaw),
      votingEnabled,
      communityVoteWeight,
      firstPlaceReward,
      secondPlaceReward,
      thirdPlaceReward,
      judgingCriteria,
      status: "UPCOMING",
      createdById: session.user.id,
      ...(judgeIds.length > 0
        ? {
            judges: {
              connect: judgeIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
  });

  revalidatePath("/instructor/competition-builder");
  return { success: true, competitionId: competition.id };
}

export async function updateCompetitionDraft(id: string, formData: FormData) {
  const session = await requireInstructor();

  const competition = await prisma.seasonalCompetition.findUnique({ where: { id } });
  if (!competition) throw new Error("Competition not found");
  if (
    competition.createdById !== session.user.id &&
    !(session.user.roles ?? []).includes("ADMIN")
  ) {
    throw new Error("Not authorized to edit this competition");
  }
  if (competition.status !== "UPCOMING") {
    throw new Error("Cannot edit a published competition");
  }

  const season = getString(formData, "season");
  const theme = getString(formData, "theme");
  const passionArea = getString(formData, "passionArea", false) || null;
  const rules = getString(formData, "rules");
  const startDateRaw = getString(formData, "startDate");
  const endDateRaw = getString(formData, "endDate");
  const submissionDeadlineRaw = getString(formData, "submissionDeadline");
  const votingEnabled = getBool(formData, "votingEnabled");
  const communityVoteWeight = getFloat(formData, "communityVoteWeight", 0.3);
  const firstPlaceReward = getString(formData, "firstPlaceReward", false) || null;
  const secondPlaceReward = getString(formData, "secondPlaceReward", false) || null;
  const thirdPlaceReward = getString(formData, "thirdPlaceReward", false) || null;

  const judgingCriteriaRaw = getString(formData, "judgingCriteria", false);
  let judgingCriteria: object[] = [];
  try {
    judgingCriteria = judgingCriteriaRaw ? JSON.parse(judgingCriteriaRaw) : [];
  } catch {
    judgingCriteria = [];
  }

  const judgeIdsRaw = getString(formData, "judgeIds", false);
  const judgeIds: string[] = judgeIdsRaw
    ? judgeIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  await prisma.seasonalCompetition.update({
    where: { id },
    data: {
      season,
      theme,
      passionArea,
      rules,
      startDate: new Date(startDateRaw),
      endDate: new Date(endDateRaw),
      submissionDeadline: new Date(submissionDeadlineRaw),
      votingEnabled,
      communityVoteWeight,
      firstPlaceReward,
      secondPlaceReward,
      thirdPlaceReward,
      judgingCriteria,
      judges: {
        set: judgeIds.map((id) => ({ id })),
      },
    },
  });

  revalidatePath("/instructor/competition-builder");
  return { success: true };
}

export async function deleteCompetitionDraft(id: string) {
  const session = await requireInstructor();

  const competition = await prisma.seasonalCompetition.findUnique({ where: { id } });
  if (!competition) throw new Error("Competition not found");
  if (
    competition.createdById !== session.user.id &&
    !(session.user.roles ?? []).includes("ADMIN")
  ) {
    throw new Error("Not authorized");
  }
  if (competition.status !== "UPCOMING") {
    throw new Error("Can only delete draft (UPCOMING) competitions");
  }

  await prisma.seasonalCompetition.delete({ where: { id } });
  revalidatePath("/instructor/competition-builder");
  return { success: true };
}

export async function getInstructorCompetitionDrafts() {
  const session = await requireInstructor();

  return prisma.seasonalCompetition.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Admin: publish instructor draft ─────────────────────────────────────────

export async function publishCompetitionDraft(id: string) {
  await requireAdmin();

  const competition = await prisma.seasonalCompetition.findUnique({ where: { id } });
  if (!competition) throw new Error("Competition not found");
  if (competition.status !== "UPCOMING") {
    throw new Error("Competition is not in draft/upcoming state");
  }

  await prisma.seasonalCompetition.update({
    where: { id },
    data: { status: "OPEN_FOR_SUBMISSIONS" },
  });

  revalidatePath("/admin/challenges");
  revalidatePath("/competitions");
  return { success: true };
}

// ─── Admin: list instructor-drafted competitions pending review ───────────────

export async function getPendingInstructorCompetitionDrafts() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!session?.user?.id || !roles.includes("ADMIN")) {
    throw new Error("Admin only");
  }

  return prisma.seasonalCompetition.findMany({
    where: {
      createdById: { not: null },
      status: "UPCOMING",
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
