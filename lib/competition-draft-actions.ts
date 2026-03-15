"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  hasCompetitionDraftOwnership,
  hasCompetitionPlanningDetails,
} from "@/lib/schema-compat";
import {
  type CompetitionPlanningDetails,
  normalizeCompetitionPlanningDetails,
} from "@/lib/instructor-builder-blueprints";

const COMPETITION_DRAFT_SCHEMA_MESSAGE =
  "Competition drafts will be available after the latest competition database migration is applied to this deployment.";

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

async function requireCompetitionDraftSupport() {
  if (!(await hasCompetitionDraftOwnership())) {
    throw new Error(COMPETITION_DRAFT_SCHEMA_MESSAGE);
  }
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

function parsePlanningDetails(formData: FormData): CompetitionPlanningDetails | null {
  const raw = getString(formData, "planningDetails", false);
  if (!raw) return null;

  try {
    return normalizeCompetitionPlanningDetails(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ─── Instructor Competition Drafts ────────────────────────────────────────────

export async function createCompetitionDraft(formData: FormData) {
  const session = await requireInstructor();
  await requireCompetitionDraftSupport();
  const supportsPlanningDetails = await hasCompetitionPlanningDetails();

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
  const planningDetails = parsePlanningDetails(formData);

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
      ...(supportsPlanningDetails && planningDetails
        ? { planningDetails: planningDetails as Prisma.InputJsonValue }
        : {}),
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
  await requireCompetitionDraftSupport();
  const supportsPlanningDetails = await hasCompetitionPlanningDetails();

  const competition = await prisma.seasonalCompetition.findUnique({
    where: { id },
    select: { createdById: true, status: true },
  });
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
  const planningDetails = parsePlanningDetails(formData);

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
      ...(supportsPlanningDetails && planningDetails
        ? { planningDetails: planningDetails as Prisma.InputJsonValue }
        : {}),
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
  await requireCompetitionDraftSupport();

  const competition = await prisma.seasonalCompetition.findUnique({
    where: { id },
    select: { createdById: true, status: true },
  });
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
  if (!(await hasCompetitionDraftOwnership())) {
    return [];
  }

  return prisma.seasonalCompetition.findMany({
    where: { createdById: session.user.id },
    select: {
      id: true,
      season: true,
      theme: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Admin: publish instructor draft ─────────────────────────────────────────

export async function publishCompetitionDraft(id: string) {
  await requireAdmin();

  const competition = await prisma.seasonalCompetition.findUnique({
    where: { id },
    select: { status: true },
  });
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
  if (!(await hasCompetitionDraftOwnership())) {
    return [];
  }

  return prisma.seasonalCompetition.findMany({
    where: {
      createdById: { not: null },
      status: "UPCOMING",
    },
    select: {
      id: true,
      season: true,
      theme: true,
      passionArea: true,
      rules: true,
      judgingCriteria: true,
      firstPlaceReward: true,
      secondPlaceReward: true,
      thirdPlaceReward: true,
      startDate: true,
      endDate: true,
      submissionDeadline: true,
      status: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// ─── Prep Timeline ────────────────────────────────────────────────────────────

export async function savePrepTimeline(
  competitionId: string,
  milestones: Array<{
    title: string;
    description?: string;
    dueDate: string;
    milestoneType: string;
    resources?: string;
    sortOrder: number;
  }>
) {
  await requireInstructor();

  const competition = await prisma.seasonalCompetition.findUnique({
    where: { id: competitionId },
    select: { id: true },
  });
  if (!competition) throw new Error("Competition not found");

  // Delete existing milestones and replace with new ones
  await prisma.competitionPrepMilestone.deleteMany({
    where: { competitionId },
  });

  if (milestones.length > 0) {
    await prisma.competitionPrepMilestone.createMany({
      data: milestones.map((m) => ({
        competitionId,
        title: m.title,
        description: m.description || null,
        dueDate: new Date(m.dueDate),
        milestoneType: m.milestoneType,
        resources: m.resources || null,
        sortOrder: m.sortOrder,
      })),
    });
  }

  revalidatePath("/instructor/competition-builder");
  return { success: true };
}

export async function getPrepTimeline(competitionId: string) {
  await requireInstructor();

  return prisma.competitionPrepMilestone.findMany({
    where: { competitionId },
    orderBy: { sortOrder: "asc" },
  });
}

// ─── Competition Submissions ──────────────────────────────────────────────────

export async function getCompetitionSubmissions(competitionId: string) {
  await requireInstructor();

  return prisma.competitionEntry.findMany({
    where: { competitionId },
    include: {
      student: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Review Actions ──────────────────────────────────────────────────────────

export async function getCompetitionById(id: string) {
  const session = await requireInstructor();

  const competition = await prisma.seasonalCompetition.findUnique({
    where: { id },
    select: {
      id: true,
      season: true,
      theme: true,
      passionArea: true,
      rules: true,
      startDate: true,
      endDate: true,
      submissionDeadline: true,
      votingEnabled: true,
      communityVoteWeight: true,
      firstPlaceReward: true,
      secondPlaceReward: true,
      thirdPlaceReward: true,
      judgingCriteria: true,
      status: true,
      createdById: true,
      createdBy: { select: { id: true, name: true } },
      reviewNotes: true,
      reviewedBy: { select: { id: true, name: true } },
      planningDetails: true,
      judges: { select: { id: true, name: true } },
    },
  });
  if (!competition) throw new Error("Competition not found");

  const roles = session.user.roles ?? [];
  const isCreator = competition.createdById === session.user.id;
  const isAdmin = roles.includes("ADMIN") || roles.includes("CHAPTER_LEAD");
  if (!isCreator && !isAdmin) {
    throw new Error("Not authorized to view this competition");
  }

  return competition;
}

export async function requestCompetitionRevision(id: string, notes: string) {
  const session = await requireInstructor();

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Only admins and chapter leads can request revisions");
  }

  await prisma.seasonalCompetition.update({
    where: { id },
    data: {
      status: "NEEDS_REVISION",
      reviewNotes: notes,
      reviewedById: session.user.id,
    },
  });

  revalidatePath("/instructor/competition-builder");
  return { success: true };
}

export async function approveCompetition(id: string) {
  const session = await requireInstructor();

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Only admins and chapter leads can approve competitions");
  }

  await prisma.seasonalCompetition.update({
    where: { id },
    data: {
      status: "OPEN_FOR_SUBMISSIONS",
      reviewNotes: null,
      reviewedById: session.user.id,
    },
  });

  revalidatePath("/instructor/competition-builder");
  revalidatePath("/competitions");
  return { success: true };
}

export async function scoreSubmission(
  entryId: string,
  score: number,
  feedback: string
) {
  await requireInstructor();

  if (score < 0 || score > 100) {
    throw new Error("Score must be between 0 and 100");
  }

  const entry = await prisma.competitionEntry.findUnique({
    where: { id: entryId },
    select: { id: true },
  });
  if (!entry) throw new Error("Submission not found");

  await prisma.competitionEntry.update({
    where: { id: entryId },
    data: {
      judgeScore: score,
      description: feedback,
    },
  });

  revalidatePath("/instructor/competition-builder/submissions");
  return { success: true };
}
