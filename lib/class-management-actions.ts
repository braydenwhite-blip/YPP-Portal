"use server";

import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertCanPublishOffering } from "@/lib/instructor-readiness";
import {
  createCompatibleClassTemplate,
  getClassTemplateCapabilities,
  getClassTemplateSelect,
} from "@/lib/class-template-compat";
import {
  type CurriculumEngagementStrategy,
  normalizeCurriculumEngagementStrategy,
} from "@/lib/instructor-builder-blueprints";
import { getLegacyLearnerFitCopy } from "@/lib/learner-fit";
import { syncCurriculumApprovalWorkflow } from "@/lib/workflow";
import { syncInstructorGrowthSignalsForInstructor } from "@/lib/instructor-growth-service";

type WeeklyTopic = {
  week?: number;
  topic?: string;
  milestone?: string;
  materials?: string;
  outcomes?: string[];
  [key: string]: unknown;
};

type IntroVideoProvider = "YOUTUBE" | "VIMEO" | "LOOM" | "CUSTOM";
const INTRO_VIDEO_PROVIDERS = new Set<IntroVideoProvider>([
  "YOUTUBE",
  "VIMEO",
  "LOOM",
  "CUSTOM",
]);

async function syncInstructorGrowthSafe(instructorId: string) {
  await syncInstructorGrowthSignalsForInstructor(instructorId).catch(() => null);
}

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireInstructor() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (
    !session?.user?.id ||
    (!roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_PRESIDENT"))
  ) {
    throw new Error("Unauthorized – instructor role required");
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

function getInt(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? fallback : n;
}

function getStringList(formData: FormData, key: string): string[] {
  const values = formData
    .getAll(key)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function inferIntroVideoProvider(videoUrl: string): IntroVideoProvider | null {
  try {
    const parsed = new URL(videoUrl);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host.endsWith("youtube.com")) return "YOUTUBE";
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "VIMEO";
    if (host === "loom.com" || host.endsWith(".loom.com")) return "LOOM";

    return "CUSTOM";
  } catch {
    return null;
  }
}

function isSupportedIntroVideoUrl(videoUrl: string, provider: IntroVideoProvider): boolean {
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();

  if (provider === "YOUTUBE") {
    return host === "youtu.be" || host.endsWith("youtube.com");
  }
  if (provider === "VIMEO") {
    return host === "vimeo.com" || host.endsWith(".vimeo.com");
  }
  if (provider === "LOOM") {
    return host === "loom.com" || host.endsWith(".loom.com");
  }

  // CUSTOM lets instructors use self-hosted or other supported embeds.
  return true;
}

function normalizeIntroVideoFields(formData: FormData) {
  const introVideoTitle = getString(formData, "introVideoTitle", false);
  const introVideoDescription = getString(formData, "introVideoDescription", false);
  const introVideoUrl = getString(formData, "introVideoUrl", false);
  const introVideoThumbnail = getString(formData, "introVideoThumbnail", false);
  const introVideoProviderRaw = getString(formData, "introVideoProvider", false);

  if (!introVideoUrl) {
    return {
      introVideoTitle: null,
      introVideoDescription: null,
      introVideoProvider: null,
      introVideoUrl: null,
      introVideoThumbnail: null,
    };
  }

  let provider: IntroVideoProvider | null = null;
  if (introVideoProviderRaw && INTRO_VIDEO_PROVIDERS.has(introVideoProviderRaw as IntroVideoProvider)) {
    provider = introVideoProviderRaw as IntroVideoProvider;
  } else {
    provider = inferIntroVideoProvider(introVideoUrl);
  }

  if (!provider) {
    throw new Error("Please choose a valid intro video provider.");
  }

  if (!isSupportedIntroVideoUrl(introVideoUrl, provider)) {
    throw new Error("Intro video URL does not match the selected provider.");
  }

  return {
    introVideoTitle: introVideoTitle || null,
    introVideoDescription: introVideoDescription || null,
    introVideoProvider: provider,
    introVideoUrl,
    introVideoThumbnail: introVideoThumbnail || null,
  };
}

function revalidateStudentClassSurfaces(offeringId: string) {
  revalidatePath("/curriculum");
  revalidatePath("/curriculum/recommended");
  revalidatePath(`/curriculum/${offeringId}`);
  revalidatePath("/curriculum/schedule");
  revalidatePath("/my-classes");
  revalidatePath("/my-chapter");
}

type SessionBuildInput = {
  offeringId: string;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
  durationWeeks: number;
  weeklyTopics: WeeklyTopic[];
};

async function getAssignableChapterIdsForUser(userId: string, roles: string[]) {
  if (roles.includes("ADMIN")) {
    const chapters = await prisma.chapter.findMany({
      select: { id: true },
    });
    return new Set(chapters.map((chapter) => chapter.id));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true },
  });

  return new Set(user?.chapterId ? [user.chapterId] : []);
}

async function assertChapterAssignmentAllowed(userId: string, roles: string[], chapterId: string | null) {
  if (!chapterId) return;

  const allowedChapterIds = await getAssignableChapterIdsForUser(userId, roles);
  if (!allowedChapterIds.has(chapterId)) {
    throw new Error("You can only post pathway-serving chapter classes inside your allowed chapter.");
  }
}

async function validatePathwayLink({
  templateId,
  chapterId,
  pathwayId,
  pathwayStepId,
}: {
  templateId: string;
  chapterId: string | null;
  pathwayId: string | null;
  pathwayStepId: string | null;
}) {
  if (!pathwayId && !pathwayStepId) {
    return null;
  }

  if (!chapterId) {
    throw new Error("Pathway-serving class offerings must be attached to a chapter.");
  }

  if (!pathwayId || !pathwayStepId) {
    throw new Error("Choose both a pathway and a specific pathway step for a pathway-serving class.");
  }

  const step = await prisma.pathwayStep.findUnique({
    where: { id: pathwayStepId },
    select: {
      id: true,
      pathwayId: true,
      classTemplateId: true,
    },
  });

  if (!step || step.pathwayId !== pathwayId) {
    throw new Error("That pathway step does not belong to the selected pathway.");
  }

  if (!step.classTemplateId) {
    throw new Error("This pathway step has not been migrated to a class template yet.");
  }

  if (step.classTemplateId !== templateId) {
    throw new Error("The selected class template does not match the selected pathway step.");
  }

  return step;
}

function validateDeliveryRequirements(params: {
  deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  chapterId: string | null;
  locationName: string;
  locationAddress: string;
  zoomLink: string;
}) {
  const { deliveryMode, chapterId, locationName, locationAddress, zoomLink } = params;

  if (deliveryMode === "IN_PERSON") {
    if (!chapterId) {
      throw new Error("In-person offerings must be assigned to a chapter.");
    }
    if (!locationName || !locationAddress) {
      throw new Error("In-person offerings must include a location name and address.");
    }
  }

  if (deliveryMode === "VIRTUAL" || deliveryMode === "HYBRID") {
    if (!zoomLink) {
      throw new Error("Virtual and hybrid offerings must include a meeting link.");
    }
  }
}

function buildOfferingSessions(input: SessionBuildInput) {
  const sessions: {
    offeringId: string;
    sessionNumber: number;
    date: Date;
    startTime: string;
    endTime: string;
    topic: string;
    learningOutcomes: string[];
    milestone: string | null;
  }[] = [];

  const [startTimeStr, endTimeStr] = input.meetingTime.split("-").map((value) => value.trim());
  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const meetingDayNumbers = input.meetingDays
    .map((day) => dayMap[day] ?? -1)
    .filter((day) => day >= 0);

  let sessionNumber = 1;
  for (let week = 0; week < input.durationWeeks; week += 1) {
    const weekStart = new Date(input.startDate);
    weekStart.setDate(weekStart.getDate() + week * 7);

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + dayOffset);

      if (day > input.endDate) {
        break;
      }

      if (!meetingDayNumbers.includes(day.getDay())) {
        continue;
      }

      const weekTopic = input.weeklyTopics.find((topic) => topic.week === week + 1);
      sessions.push({
        offeringId: input.offeringId,
        sessionNumber,
        date: day,
        startTime: startTimeStr || "16:00",
        endTime: endTimeStr || "18:00",
        topic: weekTopic?.topic || `Session ${sessionNumber}`,
        learningOutcomes: weekTopic?.outcomes || [],
        milestone: weekTopic?.milestone || null,
      });
      sessionNumber += 1;
    }
  }

  return sessions;
}

async function rebuildOfferingSessions(params: {
  offeringId: string;
  templateId: string;
  startDate: Date;
  endDate: Date;
  meetingDays: string[];
  meetingTime: string;
}) {
  const [template, existingSessions] = await Promise.all([
    prisma.classTemplate.findUnique({
      where: { id: params.templateId },
      select: {
        durationWeeks: true,
        weeklyTopics: true,
      },
    }),
    prisma.classSession.findMany({
      where: { offeringId: params.offeringId },
      select: {
        id: true,
        attendance: {
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  if (!template) {
    return;
  }

  const hasRecordedAttendance = existingSessions.some((session) => session.attendance.length > 0);
  if (hasRecordedAttendance) {
    throw new Error("This class already has attendance records, so its generated session schedule cannot be rebuilt automatically.");
  }

  const weeklyTopics = (template.weeklyTopics as WeeklyTopic[] | null) ?? [];
  const sessions = buildOfferingSessions({
    offeringId: params.offeringId,
    startDate: params.startDate,
    endDate: params.endDate,
    meetingDays: params.meetingDays,
    meetingTime: params.meetingTime,
    durationWeeks: template.durationWeeks,
    weeklyTopics,
  });

  await prisma.classSession.deleteMany({
    where: { offeringId: params.offeringId },
  });

  if (sessions.length > 0) {
    await prisma.classSession.createMany({
      data: sessions,
    });
  }
}

// ============================================
// CLASS TEMPLATE ACTIONS
// ============================================

export async function createClassTemplate(formData: FormData) {
  const session = await requireInstructor();
  const capabilities = await getClassTemplateCapabilities();

  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const interestArea = getString(formData, "interestArea");
  const difficultyLevel = (getString(formData, "difficultyLevel", false) || "LEVEL_101") as
    | "LEVEL_101"
    | "LEVEL_201"
    | "LEVEL_301"
    | "LEVEL_401";
  const learnerFitFallback = getLegacyLearnerFitCopy(difficultyLevel);
  const learnerFitLabel = getString(formData, "learnerFitLabel", false) || learnerFitFallback.label;
  const learnerFitDescription =
    getString(formData, "learnerFitDescription", false) || learnerFitFallback.description;
  const durationWeeks = getInt(formData, "durationWeeks", 8);
  const sessionsPerWeek = getInt(formData, "sessionsPerWeek", 1);
  const estimatedHours = getInt(formData, "estimatedHours", 0);
  const minStudents = getInt(formData, "minStudents", 3);
  const maxStudents = getInt(formData, "maxStudents", 25);
  const idealSize = getInt(formData, "idealSize", 12);
  const sizeNotes = getString(formData, "sizeNotes", false);

  // Parse JSON fields
  const prerequisitesRaw = getString(formData, "prerequisites", false);
  const prerequisites = prerequisitesRaw
    ? prerequisitesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const outcomesRaw = getString(formData, "learningOutcomes", false);
  const learningOutcomes = outcomesRaw
    ? outcomesRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const deliveryModes = getStringList(formData, "deliveryModes");

  const weeklyTopicsRaw = getString(formData, "weeklyTopics", false);
  let weeklyTopics: WeeklyTopic[] = [];
  if (weeklyTopicsRaw) {
    try {
      const parsed: unknown = JSON.parse(weeklyTopicsRaw);
      weeklyTopics = Array.isArray(parsed) ? (parsed as WeeklyTopic[]) : [];
    } catch {
      weeklyTopics = [];
    }
  }

  // New YPP curriculum template fields
  const targetAgeGroup = getString(formData, "targetAgeGroup", false);
  const classDurationMin = getInt(formData, "classDurationMin", 0);
  const engagementStrategyRaw = getString(formData, "engagementStrategy", false);
  let engagementStrategy: CurriculumEngagementStrategy | null = null;
  if (engagementStrategyRaw) {
    try {
      engagementStrategy = normalizeCurriculumEngagementStrategy(
        JSON.parse(engagementStrategyRaw)
      );
    } catch {
      engagementStrategy = null;
    }
  }

  const template = await createCompatibleClassTemplate(prisma, capabilities, {
    title,
    description: description || "",
    interestArea,
    difficultyLevel,
    learnerFitLabel,
    learnerFitDescription,
    prerequisites,
    weeklyTopics: weeklyTopics as Prisma.InputJsonValue,
    learningOutcomes,
    estimatedHours,
    durationWeeks,
    sessionsPerWeek,
    minStudents,
    maxStudents,
    idealSize,
    sizeNotes: sizeNotes || null,
    deliveryModes: deliveryModes.length > 0 ? deliveryModes : ["VIRTUAL"],
    targetAgeGroup: targetAgeGroup || null,
    classDurationMin: classDurationMin || null,
    engagementStrategy: engagementStrategy as Prisma.InputJsonValue | null,
    createdById: session.user.id,
  });

  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/curriculum");
  return { success: true, id: template.id };
}

export async function submitCurriculumForReview(formData: FormData) {
  const session = await requireInstructor();
  const capabilities = await getClassTemplateCapabilities();
  const id = getString(formData, "id");

  if (!capabilities.hasReviewWorkflow) {
    throw new Error("Curriculum review will be available after the latest database migration is applied.");
  }

  const existing = await prisma.classTemplate.findUnique({
    where: { id },
    select: { createdById: true, submissionStatus: true },
  });
  if (!existing) throw new Error("Template not found");
  if (existing.createdById !== session.user.id) throw new Error("Not authorized");
  if (existing.submissionStatus === "SUBMITTED" || existing.submissionStatus === "APPROVED") {
    throw new Error("Already submitted or approved");
  }

  await prisma.classTemplate.update({
    where: { id },
    data: { submissionStatus: "SUBMITTED", submittedAt: new Date() },
    select: { id: true },
  });

  await syncCurriculumApprovalWorkflow(id);
  await syncInstructorGrowthSafe(session.user.id);

  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/instructor/workspace");
  revalidatePath("/admin/curricula");
}

export async function updateClassTemplate(formData: FormData) {
  const session = await requireInstructor();
  const capabilities = await getClassTemplateCapabilities();
  const id = getString(formData, "id");

  const existing = await prisma.classTemplate.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!existing) throw new Error("Template not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized to edit this template");
  }

  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const interestArea = getString(formData, "interestArea");
  const difficultyLevel = (getString(formData, "difficultyLevel", false) || "LEVEL_101") as
    | "LEVEL_101"
    | "LEVEL_201"
    | "LEVEL_301"
    | "LEVEL_401";
  const learnerFitFallback = getLegacyLearnerFitCopy(difficultyLevel);
  const learnerFitLabel = getString(formData, "learnerFitLabel", false) || learnerFitFallback.label;
  const learnerFitDescription =
    getString(formData, "learnerFitDescription", false) || learnerFitFallback.description;
  const durationWeeks = getInt(formData, "durationWeeks", 8);
  const sessionsPerWeek = getInt(formData, "sessionsPerWeek", 1);
  const estimatedHours = getInt(formData, "estimatedHours", 0);
  const minStudents = getInt(formData, "minStudents", 3);
  const maxStudents = getInt(formData, "maxStudents", 25);
  const idealSize = getInt(formData, "idealSize", 12);
  const sizeNotes = getString(formData, "sizeNotes", false);
  const isPublished = formData.get("isPublished") === "true";

  const prerequisitesRaw = getString(formData, "prerequisites", false);
  const prerequisites = prerequisitesRaw
    ? prerequisitesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const outcomesRaw = getString(formData, "learningOutcomes", false);
  const learningOutcomes = outcomesRaw
    ? outcomesRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const deliveryModes = getStringList(formData, "deliveryModes");

  const weeklyTopicsRaw = getString(formData, "weeklyTopics", false);
  let weeklyTopics: WeeklyTopic[] = [];
  if (weeklyTopicsRaw) {
    try {
      const parsed: unknown = JSON.parse(weeklyTopicsRaw);
      weeklyTopics = Array.isArray(parsed) ? (parsed as WeeklyTopic[]) : [];
    } catch {
      weeklyTopics = [];
    }
  }

  const targetAgeGroup = getString(formData, "targetAgeGroup", false);
  const classDurationMin = getInt(formData, "classDurationMin", 0);
  const engagementStrategyRaw = getString(formData, "engagementStrategy", false);
  let engagementStrategy: CurriculumEngagementStrategy | null = null;
  if (engagementStrategyRaw) {
    try {
      engagementStrategy = normalizeCurriculumEngagementStrategy(
        JSON.parse(engagementStrategyRaw)
      );
    } catch {
      engagementStrategy = null;
    }
  }

  await prisma.classTemplate.update({
    where: { id },
    data: {
      title,
      description: description || "",
      interestArea,
      difficultyLevel,
      prerequisites,
      weeklyTopics: weeklyTopics as Prisma.InputJsonValue,
      learningOutcomes,
      estimatedHours,
      durationWeeks,
      sessionsPerWeek,
      minStudents,
      maxStudents,
      idealSize,
      sizeNotes: sizeNotes || null,
      deliveryModes: deliveryModes.length > 0 ? deliveryModes : ["VIRTUAL"],
      ...(capabilities.hasLearnerFitFields
        ? {
            learnerFitLabel,
            learnerFitDescription,
          }
        : {}),
      isPublished,
      ...(capabilities.hasAdvancedCurriculumFields
        ? {
            targetAgeGroup: targetAgeGroup || null,
            classDurationMin: classDurationMin || null,
            ...(engagementStrategy
              ? { engagementStrategy: engagementStrategy as Prisma.InputJsonValue }
              : {}),
          }
        : {}),
    },
    select: { id: true },
  });

  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/curriculum");
  return { success: true };
}

export async function deleteClassTemplate(id: string) {
  const session = await requireInstructor();

  const existing = await prisma.classTemplate.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!existing) throw new Error("Template not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized to delete this template");
  }

  await prisma.classTemplate.delete({
    where: { id },
    select: { id: true },
  });
  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/curriculum");
  return { success: true };
}

export async function publishClassTemplate(id: string) {
  const session = await requireInstructor();

  const existing = await prisma.classTemplate.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!existing) throw new Error("Template not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized");
  }

  await prisma.classTemplate.update({
    where: { id },
    data: { isPublished: true },
    select: { id: true },
  });

  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/curriculum");
  return { success: true };
}

// ============================================
// CLASS OFFERING ACTIONS
// ============================================

export async function createClassOffering(formData: FormData) {
  const session = await requireInstructor();
  const roles = session.user?.roles ?? [];

  const templateId = getString(formData, "templateId");
  const title = getString(formData, "title");
  const startDateStr = getString(formData, "startDate");
  const endDateStr = getString(formData, "endDate");
  const meetingTime = getString(formData, "meetingTime");
  const deliveryMode = getString(formData, "deliveryMode") as
    | "IN_PERSON"
    | "VIRTUAL"
    | "HYBRID";
  const capacity = getInt(formData, "capacity", 25);
  const semester = getString(formData, "semester", false);

  const meetingDaysRaw = getString(formData, "meetingDays", false);
  const meetingDays = meetingDaysRaw
    ? meetingDaysRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const locationName = getString(formData, "locationName", false);
  const locationAddress = getString(formData, "locationAddress", false);
  const zoomLink = getString(formData, "zoomLink", false);
  const chapterId = getString(formData, "chapterId", false) || null;
  const pathwayId = getString(formData, "pathwayId", false) || null;
  const pathwayStepId = getString(formData, "pathwayStepId", false) || null;
  const introVideo = normalizeIntroVideoFields(formData);

  const send24Hr = formData.get("send24HrReminder") !== "false";
  const send1Hr = formData.get("send1HrReminder") !== "false";

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid date format");
  }

  await assertChapterAssignmentAllowed(session.user.id, roles, chapterId);
  validateDeliveryRequirements({
    deliveryMode,
    chapterId,
    locationName,
    locationAddress,
    zoomLink,
  });

  const [pathwayStep, template] = await Promise.all([
    validatePathwayLink({
      templateId,
      chapterId,
      pathwayId,
      pathwayStepId,
    }),
    prisma.classTemplate.findUnique({
      where: { id: templateId },
      select: {
        deliveryModes: true,
      },
    }),
  ]);

  if (!template) {
    throw new Error("Class template not found.");
  }

  if (!template.deliveryModes.includes(deliveryMode)) {
    throw new Error("This class template does not support the selected delivery mode.");
  }

  // Create the offering
  const offering = await prisma.classOffering.create({
    data: {
      templateId,
      instructorId: session.user.id,
      title,
      startDate,
      endDate,
      meetingDays,
      meetingTime,
      deliveryMode,
      locationName: locationName || null,
      locationAddress: locationAddress || null,
      zoomLink: zoomLink || null,
      capacity,
      send24HrReminder: send24Hr,
      send1HrReminder: send1Hr,
      status: "DRAFT",
      chapterId,
      pathwayStepId,
      semester: semester || null,
      ...introVideo,
    },
  });

  await rebuildOfferingSessions({
    offeringId: offering.id,
    templateId,
    startDate,
    endDate,
    meetingDays,
    meetingTime,
  });

  if (pathwayStep && pathwayId && chapterId) {
    await prisma.chapterPathway.upsert({
      where: {
        chapterId_pathwayId: {
          chapterId,
          pathwayId,
        },
      },
      create: {
        chapterId,
        pathwayId,
        isAvailable: true,
        runStatus: "ACTIVE",
        ownerId: session.user.id,
      },
      update: {
        isAvailable: true,
        runStatus: "ACTIVE",
        ownerId: session.user.id,
      },
    });
  }

  await syncInstructorGrowthSafe(session.user.id);
  revalidatePath("/curriculum");
  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/my-chapter");
  return { success: true, id: offering.id };
}

export async function updateClassOffering(formData: FormData) {
  const session = await requireInstructor();
  const id = getString(formData, "id");

  const existing = await prisma.classOffering.findUnique({ where: { id } });
  if (!existing) throw new Error("Offering not found");

  const roles = session.user?.roles ?? [];
  if (existing.instructorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized");
  }

  const title = getString(formData, "title");
  const startDateStr = getString(formData, "startDate");
  const endDateStr = getString(formData, "endDate");
  const meetingTime = getString(formData, "meetingTime");
  const deliveryMode = getString(formData, "deliveryMode") as
    | "IN_PERSON"
    | "VIRTUAL"
    | "HYBRID";
  const capacity = getInt(formData, "capacity", 25);
  const semester = getString(formData, "semester", false);

  const meetingDaysRaw = getString(formData, "meetingDays", false);
  const meetingDays = meetingDaysRaw
    ? meetingDaysRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const locationName = getString(formData, "locationName", false);
  const locationAddress = getString(formData, "locationAddress", false);
  const zoomLink = getString(formData, "zoomLink", false);
  const chapterId = getString(formData, "chapterId", false) || null;
  const pathwayId = getString(formData, "pathwayId", false) || null;
  const pathwayStepId = getString(formData, "pathwayStepId", false) || null;
  const introVideo = normalizeIntroVideoFields(formData);
  const status = getString(formData, "status", false) as
    | "DRAFT"
    | "PUBLISHED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "";

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid date format");
  }

  await assertChapterAssignmentAllowed(session.user.id, roles, chapterId);
  validateDeliveryRequirements({
    deliveryMode,
    chapterId,
    locationName,
    locationAddress,
    zoomLink,
  });

  const [pathwayStep, template] = await Promise.all([
    validatePathwayLink({
      templateId: existing.templateId,
      chapterId,
      pathwayId,
      pathwayStepId,
    }),
    prisma.classTemplate.findUnique({
      where: { id: existing.templateId },
      select: {
        deliveryModes: true,
      },
    }),
  ]);

  if (!template) {
    throw new Error("Class template not found.");
  }

  if (!template.deliveryModes.includes(deliveryMode)) {
    throw new Error("This class template does not support the selected delivery mode.");
  }

  const movesIntoLiveState =
    (status === "PUBLISHED" || status === "IN_PROGRESS") &&
    existing.status !== "PUBLISHED" &&
    existing.status !== "IN_PROGRESS";

  if (movesIntoLiveState) {
    await assertCanPublishOffering(existing.instructorId, existing.templateId, existing.id);
  }

  const send24Hr = formData.get("send24HrReminder") !== "false";
  const send1Hr = formData.get("send1HrReminder") !== "false";

  await prisma.classOffering.update({
    where: { id },
    data: {
      title,
      startDate,
      endDate,
      meetingDays,
      meetingTime,
      deliveryMode,
      locationName: locationName || null,
      locationAddress: locationAddress || null,
      zoomLink: zoomLink || null,
      chapterId,
      pathwayStepId,
      capacity,
      send24HrReminder: send24Hr,
      send1HrReminder: send1Hr,
      ...(status ? { status } : {}),
      semester: semester || null,
      ...introVideo,
    },
  });

  const scheduleChanged =
    existing.startDate.getTime() !== startDate.getTime() ||
    existing.endDate.getTime() !== endDate.getTime() ||
    existing.meetingTime !== meetingTime ||
    existing.meetingDays.join("|") !== meetingDays.join("|");

  if (scheduleChanged) {
    await rebuildOfferingSessions({
      offeringId: id,
      templateId: existing.templateId,
      startDate,
      endDate,
      meetingDays,
      meetingTime,
    });
  }

  if (pathwayStep && pathwayId && chapterId) {
    await prisma.chapterPathway.upsert({
      where: {
        chapterId_pathwayId: {
          chapterId,
          pathwayId,
        },
      },
      create: {
        chapterId,
        pathwayId,
        isAvailable: true,
        runStatus: "ACTIVE",
        ownerId: session.user.id,
      },
      update: {
        isAvailable: true,
        runStatus: "ACTIVE",
        ownerId: session.user.id,
      },
    });
  }

  await syncInstructorGrowthSafe(existing.instructorId);
  revalidatePath("/curriculum");
  revalidatePath(`/curriculum/${id}`);
  revalidatePath("/my-chapter");
  return { success: true };
}

export async function publishClassOffering(id: string) {
  const session = await requireInstructor();

  const existing = await prisma.classOffering.findUnique({
    where: { id },
    select: {
      id: true,
      instructorId: true,
      templateId: true,
      chapterId: true,
      pathwayStepId: true,
      deliveryMode: true,
      locationName: true,
      locationAddress: true,
      zoomLink: true,
    },
  });
  if (!existing) throw new Error("Offering not found");

  const roles = session.user?.roles ?? [];
  if (existing.instructorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized");
  }

  validateDeliveryRequirements({
    deliveryMode: existing.deliveryMode,
    chapterId: existing.chapterId,
    locationName: existing.locationName || "",
    locationAddress: existing.locationAddress || "",
    zoomLink: existing.zoomLink || "",
  });

  await assertCanPublishOffering(existing.instructorId, existing.templateId, existing.id);

  await prisma.classOffering.update({
    where: { id },
    data: { status: "PUBLISHED", enrollmentOpen: true },
  });

  await syncInstructorGrowthSafe(existing.instructorId);
  revalidatePath("/curriculum");
  revalidatePath(`/curriculum/${id}`);
  revalidatePath("/my-chapter");
  return { success: true };
}

// ============================================
// ENROLLMENT ACTIONS
// ============================================

export async function enrollInClass(offeringId: string) {
  const session = await requireAuth();
  const studentId = session.user.id;

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      chapterId: true,
    },
  });

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: {
      enrollments: { where: { status: "ENROLLED" } },
      _count: { select: { enrollments: true } },
    },
  });

  if (!offering) throw new Error("Class not found");
  if (!offering.enrollmentOpen) throw new Error("Enrollment is closed");
  if (offering.status !== "PUBLISHED" && offering.status !== "IN_PROGRESS") {
    throw new Error("Class is not accepting enrollment");
  }

  if (
    offering.chapterId &&
    student?.chapterId &&
    offering.chapterId !== student.chapterId &&
    !(session.user.roles ?? []).includes("ADMIN") &&
    !(session.user.roles ?? []).includes("STAFF")
  ) {
    const approvedFallback = await prisma.pathwayFallbackRequest.findFirst({
      where: {
        studentId,
        targetOfferingId: offeringId,
        status: "APPROVED",
      },
      select: { id: true },
    });

    if (!approvedFallback) {
      throw new Error("This partner-chapter class needs an approved fallback request before you can enroll.");
    }
  }

  // Check if already enrolled
  const existingEnrollment = await prisma.classEnrollment.findUnique({
    where: { studentId_offeringId: { studentId, offeringId } },
  });

  if (existingEnrollment && existingEnrollment.status === "ENROLLED") {
    throw new Error("Already enrolled in this class");
  }

  // Check capacity
  const enrolledCount = offering.enrollments.length;
  const isWaitlisted = enrolledCount >= offering.capacity;

  if (existingEnrollment) {
    // Re-enroll (previously dropped)
    await prisma.classEnrollment.update({
      where: { id: existingEnrollment.id },
      data: {
        status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
        enrolledAt: new Date(),
        droppedAt: null,
        waitlistPosition: isWaitlisted ? enrolledCount - offering.capacity + 1 : null,
      },
    });
  } else {
    await prisma.classEnrollment.create({
      data: {
        studentId,
        offeringId,
        status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
        waitlistPosition: isWaitlisted ? enrolledCount - offering.capacity + 1 : null,
      },
    });
  }

  revalidateStudentClassSurfaces(offeringId);
  return { success: true, waitlisted: isWaitlisted };
}

/**
 * Instructor-initiated enrollment for a specific student.
 * Used by cohort enrollment and instructor-managed enrollment panels.
 * Skips if the student is already enrolled (idempotent).
 */
export async function enrollStudentInOffering(
  studentId: string,
  offeringId: string
): Promise<{ success: boolean; waitlisted: boolean; skipped: boolean }> {
  await requireInstructor();

  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: { enrollments: { where: { status: "ENROLLED" } } },
  });

  if (!offering) throw new Error("Class offering not found");

  // Idempotent: skip if already actively enrolled
  const existing = await prisma.classEnrollment.findUnique({
    where: { studentId_offeringId: { studentId, offeringId } },
  });

  if (existing && (existing.status === "ENROLLED" || existing.status === "WAITLISTED")) {
    return { success: true, waitlisted: existing.status === "WAITLISTED", skipped: true };
  }

  const enrolledCount = offering.enrollments.length;
  const isWaitlisted = enrolledCount >= offering.capacity;

  if (existing) {
    await prisma.classEnrollment.update({
      where: { id: existing.id },
      data: {
        status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
        enrolledAt: new Date(),
        droppedAt: null,
        waitlistPosition: isWaitlisted ? enrolledCount - offering.capacity + 1 : null,
      },
    });
  } else {
    await prisma.classEnrollment.create({
      data: {
        studentId,
        offeringId,
        status: isWaitlisted ? "WAITLISTED" : "ENROLLED",
        waitlistPosition: isWaitlisted ? enrolledCount - offering.capacity + 1 : null,
      },
    });
  }

  revalidateStudentClassSurfaces(offeringId);
  return { success: true, waitlisted: isWaitlisted, skipped: false };
}

export async function dropClass(offeringId: string) {
  const session = await requireAuth();
  const studentId = session.user.id;

  const enrollment = await prisma.classEnrollment.findUnique({
    where: { studentId_offeringId: { studentId, offeringId } },
  });

  if (!enrollment) throw new Error("Not enrolled in this class");

  await prisma.classEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status: "DROPPED",
      droppedAt: new Date(),
    },
  });

  // If someone was waitlisted, promote them
  const nextWaitlisted = await prisma.classEnrollment.findFirst({
    where: { offeringId, status: "WAITLISTED" },
    orderBy: { waitlistPosition: "asc" },
  });

  if (nextWaitlisted) {
    await prisma.classEnrollment.update({
      where: { id: nextWaitlisted.id },
      data: { status: "ENROLLED", waitlistPosition: null },
    });
  }

  revalidateStudentClassSurfaces(offeringId);
  return { success: true };
}

// ============================================
// SESSION & ATTENDANCE ACTIONS
// ============================================

export async function recordClassAttendance(formData: FormData) {
  const session = await requireInstructor();

  const sessionId = getString(formData, "sessionId");
  const studentId = getString(formData, "studentId");
  const status = getString(formData, "status") as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  const notes = getString(formData, "notes", false);

  await prisma.classAttendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    create: {
      sessionId,
      studentId,
      status,
      notes: notes || null,
    },
    update: {
      status,
      notes: notes || null,
    },
  });

  // Update enrollment attendance count
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      offeringId: true,
      offering: {
        select: {
          instructorId: true,
        },
      },
    },
  });

  if (classSession && status === "PRESENT") {
    const attendedCount = await prisma.classAttendanceRecord.count({
      where: {
        studentId,
        status: "PRESENT",
        session: { offeringId: classSession.offeringId },
      },
    });

    await prisma.classEnrollment.updateMany({
      where: { studentId, offeringId: classSession.offeringId },
      data: { sessionsAttended: attendedCount },
    });
  }

  if (classSession?.offering.instructorId) {
    await syncInstructorGrowthSafe(classSession.offering.instructorId);
  }

  revalidatePath("/instructor/curriculum-builder");
  return { success: true };
}

export async function updateClassSession(formData: FormData) {
  const session = await requireInstructor();
  const id = getString(formData, "id");

  const classSession = await prisma.classSession.findUnique({
    where: { id },
    include: { offering: true },
  });

  if (!classSession) throw new Error("Session not found");

  const roles = session.user?.roles ?? [];
  if (
    classSession.offering.instructorId !== session.user.id &&
    !roles.includes("ADMIN")
  ) {
    throw new Error("Not authorized");
  }

  const topic = getString(formData, "topic", false);
  const description = getString(formData, "description", false);
  const milestone = getString(formData, "milestone", false);
  const materialsUrl = getString(formData, "materialsUrl", false);
  const recordingUrl = getString(formData, "recordingUrl", false);
  const isCancelled = formData.get("isCancelled") === "true";
  const cancelReason = getString(formData, "cancelReason", false);

  const outcomesRaw = getString(formData, "learningOutcomes", false);
  const learningOutcomes = outcomesRaw
    ? outcomesRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : undefined;

  await prisma.classSession.update({
    where: { id },
    data: {
      ...(topic ? { topic } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(milestone !== undefined ? { milestone: milestone || null } : {}),
      ...(materialsUrl !== undefined ? { materialsUrl: materialsUrl || null } : {}),
      ...(recordingUrl !== undefined ? { recordingUrl: recordingUrl || null } : {}),
      ...(learningOutcomes ? { learningOutcomes } : {}),
      isCancelled,
      ...(cancelReason ? { cancelReason } : {}),
    },
  });

  revalidatePath(`/curriculum/${classSession.offeringId}`);
  return { success: true };
}

// ============================================
// LEARNING OUTCOME TRACKING
// ============================================

export async function markOutcomeAchieved(
  offeringId: string,
  studentId: string,
  outcome: string
) {
  const session = await requireInstructor();

  const enrollment = await prisma.classEnrollment.findUnique({
    where: { studentId_offeringId: { studentId, offeringId } },
  });

  if (!enrollment) throw new Error("Student not enrolled");

  const currentOutcomes = enrollment.outcomesAchieved || [];
  if (currentOutcomes.includes(outcome)) {
    return { success: true, alreadyAchieved: true };
  }

  await prisma.classEnrollment.update({
    where: { id: enrollment.id },
    data: {
      outcomesAchieved: [...currentOutcomes, outcome],
    },
  });

  revalidatePath(`/curriculum/${offeringId}`);
  return { success: true };
}

// ============================================
// QUERY HELPERS (for use in server components)
// ============================================

export async function getClassCatalog(filters?: {
  interestArea?: string;
  difficultyLevel?: string;
  deliveryMode?: string;
  semester?: string;
  search?: string;
  userId?: string;
}) {
  const capabilities = await getClassTemplateCapabilities();
  const where: Record<string, unknown> = {
    status: { in: ["PUBLISHED", "IN_PROGRESS"] },
  };

  if (filters?.interestArea) {
    where.template = { ...((where.template as Record<string, unknown>) || {}), interestArea: filters.interestArea };
  }
  if (filters?.difficultyLevel) {
    where.template = { ...((where.template as Record<string, unknown>) || {}), difficultyLevel: filters.difficultyLevel };
  }
  if (filters?.deliveryMode) {
    where.deliveryMode = filters.deliveryMode;
  }
  if (filters?.semester) {
    where.semester = filters.semester;
  }
  if (filters?.search) {
    where.title = { contains: filters.search, mode: "insensitive" };
  }

  const user = filters?.userId
    ? await prisma.user.findUnique({
        where: { id: filters.userId },
        select: { chapterId: true },
      })
    : null;

  const offerings = await prisma.classOffering.findMany({
    where,
    include: {
      template: {
        select: getClassTemplateSelect({
          includeLearnerFit: capabilities.hasLearnerFitFields,
          includeWorkflow: capabilities.hasReviewWorkflow,
        }),
      },
      instructor: { select: { id: true, name: true, email: true } },
      chapter: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
        },
      },
      pathwayStep: {
        select: {
          id: true,
          stepOrder: true,
          pathwayId: true,
          pathway: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      sessions: {
        where: { date: { gte: new Date() }, isCancelled: false },
        orderBy: { date: "asc" },
        take: 1,
        select: { date: true, startTime: true, topic: true },
      },
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
          sessions: true,
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { title: "asc" }],
  });

  if (!user?.chapterId) {
    return offerings;
  }

  return offerings.sort((left, right) => {
    const leftScore = Number(left.chapterId === user.chapterId);
    const rightScore = Number(right.chapterId === user.chapterId);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.startDate.getTime() - right.startDate.getTime();
  });
}

export async function getMyClassSchedule(userId: string) {
  const capabilities = await getClassTemplateCapabilities();
  return prisma.classEnrollment.findMany({
    where: {
      studentId: userId,
      status: { in: ["ENROLLED", "WAITLISTED"] },
    },
    include: {
      offering: {
        include: {
          template: {
            select: getClassTemplateSelect({
              includeLearnerFit: capabilities.hasLearnerFitFields,
              includeWorkflow: capabilities.hasReviewWorkflow,
            }),
          },
          instructor: { select: { id: true, name: true } },
          sessions: {
            orderBy: { date: "asc" },
            where: { isCancelled: false },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });
}

export async function getInstructorTemplates(instructorId: string) {
  const capabilities = await getClassTemplateCapabilities();
  return prisma.classTemplate.findMany({
    where: { createdById: instructorId },
    select: getClassTemplateSelect({
      includeCounts: true,
      includeLearnerFit: capabilities.hasLearnerFitFields,
      includeWorkflow: capabilities.hasReviewWorkflow,
    }),
    orderBy: { updatedAt: "desc" },
  });
}

export async function getInstructorOfferings(instructorId: string) {
  const capabilities = await getClassTemplateCapabilities();
  return prisma.classOffering.findMany({
    where: { instructorId },
    include: {
      approval: {
        select: {
          status: true,
          requestNotes: true,
          reviewNotes: true,
          requestedAt: true,
          reviewedAt: true,
        },
      },
      template: {
        select: getClassTemplateSelect({
          includeLearnerFit: capabilities.hasLearnerFitFields,
          includeWorkflow: capabilities.hasReviewWorkflow,
        }),
      },
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
          sessions: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getClassOfferingDetail(offeringId: string) {
  const capabilities = await getClassTemplateCapabilities();
  return prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: {
      template: {
        select: getClassTemplateSelect({
          includeCreatedBy: true,
          includeLearnerFit: capabilities.hasLearnerFitFields,
          includeWorkflow: capabilities.hasReviewWorkflow,
        }),
      },
      instructor: { select: { id: true, name: true, email: true } },
      chapter: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
        },
      },
      pathwayStep: {
        select: {
          id: true,
          stepOrder: true,
          pathwayId: true,
          pathway: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
      sessions: {
        orderBy: { sessionNumber: "asc" },
        include: {
          _count: { select: { attendance: true } },
        },
      },
      enrollments: {
        include: {
          student: { select: { id: true, name: true, email: true } },
        },
        orderBy: { enrolledAt: "asc" },
      },
      announcements: {
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      },
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
        },
      },
    },
  });
}

// ============================================
// ANNOUNCEMENTS
// ============================================

export async function postClassAnnouncement(formData: FormData) {
  const session = await requireInstructor();
  const offeringId = getString(formData, "offeringId");
  const title = getString(formData, "title");
  const body = getString(formData, "body");
  const isPinned = formData.get("isPinned") === "true";

  // Verify the instructor owns this offering (or is admin)
  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    select: { instructorId: true },
  });
  if (!offering) throw new Error("Class not found");
  const roles = session.user.roles ?? [];
  if (offering.instructorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }

  await prisma.classAnnouncement.create({
    data: {
      offeringId,
      authorId: session.user.id,
      title,
      body,
      isPinned,
    },
  });

  revalidatePath(`/curriculum/${offeringId}`);
  return { success: true };
}

export async function deleteClassAnnouncement(announcementId: string) {
  const session = await requireInstructor();

  const announcement = await prisma.classAnnouncement.findUnique({
    where: { id: announcementId },
    include: { offering: { select: { instructorId: true } } },
  });
  if (!announcement) throw new Error("Announcement not found");
  const roles = session.user.roles ?? [];
  if (announcement.authorId !== session.user.id && announcement.offering.instructorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }

  await prisma.classAnnouncement.delete({ where: { id: announcementId } });
  revalidatePath(`/curriculum/${announcement.offeringId}`);
  return { success: true };
}

export async function generateICalForMyClasses(userId: string): Promise<string> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { studentId: userId, status: "ENROLLED" },
    include: {
      offering: {
        include: {
          instructor: { select: { name: true } },
          template: { select: { title: true, description: true } },
          sessions: {
            where: { isCancelled: false },
            orderBy: { date: "asc" },
          },
        },
      },
    },
  });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YPP Portal//Class Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:My YPP Classes`,
    `X-WR-TIMEZONE:America/New_York`,
  ];

  for (const enrollment of enrollments) {
    const offering = enrollment.offering;
    for (const s of offering.sessions) {
      const startDt = new Date(s.date);
      const [startH, startM] = s.startTime.split(":").map(Number);
      startDt.setHours(startH, startM, 0, 0);
      const endDt = new Date(s.date);
      const [endH, endM] = s.endTime.split(":").map(Number);
      endDt.setHours(endH, endM, 0, 0);

      const formatDt = (d: Date) =>
        d
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:ypp-session-${s.id}@ypp-portal`);
      lines.push(`DTSTAMP:${formatDt(new Date())}`);
      lines.push(`DTSTART:${formatDt(startDt)}`);
      lines.push(`DTEND:${formatDt(endDt)}`);
      lines.push(`SUMMARY:${offering.title} - Session ${s.sessionNumber}: ${s.topic}`);
      lines.push(`DESCRIPTION:Instructor: ${offering.instructor.name}\\n${s.description || ""}`);
      if (offering.zoomLink) {
        lines.push(`URL:${offering.zoomLink}`);
        lines.push(`LOCATION:${offering.zoomLink}`);
      }
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
