"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type WeeklyTopic = {
  week?: number;
  topic?: string;
  milestone?: string;
  materials?: string;
};

type IntroVideoProvider = "YOUTUBE" | "VIMEO" | "LOOM" | "CUSTOM";
const INTRO_VIDEO_PROVIDERS = new Set<IntroVideoProvider>([
  "YOUTUBE",
  "VIMEO",
  "LOOM",
  "CUSTOM",
]);

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

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

// ============================================
// CLASS TEMPLATE ACTIONS
// ============================================

export async function createClassTemplate(formData: FormData) {
  const session = await requireInstructor();

  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const interestArea = getString(formData, "interestArea");
  const difficultyLevel = getString(formData, "difficultyLevel") as
    | "LEVEL_101"
    | "LEVEL_201"
    | "LEVEL_301"
    | "LEVEL_401";
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

  const deliveryModesRaw = getString(formData, "deliveryModes", false);
  const deliveryModes = deliveryModesRaw
    ? deliveryModesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["VIRTUAL"];

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

  const template = await prisma.classTemplate.create({
    data: {
      title,
      description,
      interestArea,
      difficultyLevel,
      prerequisites,
      weeklyTopics,
      learningOutcomes,
      estimatedHours,
      durationWeeks,
      sessionsPerWeek,
      minStudents,
      maxStudents,
      idealSize,
      sizeNotes: sizeNotes || null,
      deliveryModes,
      createdById: session.user.id,
    },
  });

  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/classes/catalog");
  return { success: true, id: template.id };
}

export async function updateClassTemplate(formData: FormData) {
  const session = await requireInstructor();
  const id = getString(formData, "id");

  const existing = await prisma.classTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("Template not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized to edit this template");
  }

  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const interestArea = getString(formData, "interestArea");
  const difficultyLevel = getString(formData, "difficultyLevel") as
    | "LEVEL_101"
    | "LEVEL_201"
    | "LEVEL_301"
    | "LEVEL_401";
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

  const deliveryModesRaw = getString(formData, "deliveryModes", false);
  const deliveryModes = deliveryModesRaw
    ? deliveryModesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["VIRTUAL"];

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

  await prisma.classTemplate.update({
    where: { id },
    data: {
      title,
      description,
      interestArea,
      difficultyLevel,
      prerequisites,
      weeklyTopics,
      learningOutcomes,
      estimatedHours,
      durationWeeks,
      sessionsPerWeek,
      minStudents,
      maxStudents,
      idealSize,
      sizeNotes: sizeNotes || null,
      deliveryModes,
      isPublished,
    },
  });

  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/classes/catalog");
  return { success: true };
}

export async function deleteClassTemplate(id: string) {
  const session = await requireInstructor();

  const existing = await prisma.classTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("Template not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized to delete this template");
  }

  await prisma.classTemplate.delete({ where: { id } });
  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/classes/catalog");
  return { success: true };
}

export async function publishClassTemplate(id: string) {
  const session = await requireInstructor();

  const existing = await prisma.classTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error("Template not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized");
  }

  await prisma.classTemplate.update({
    where: { id },
    data: { isPublished: true },
  });

  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/classes/catalog");
  return { success: true };
}

// ============================================
// CLASS OFFERING ACTIONS
// ============================================

export async function createClassOffering(formData: FormData) {
  const session = await requireInstructor();

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
  const chapterId = getString(formData, "chapterId", false);
  const introVideo = normalizeIntroVideoFields(formData);

  const send24Hr = formData.get("send24HrReminder") !== "false";
  const send1Hr = formData.get("send1HrReminder") !== "false";

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid date format");
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
      chapterId: chapterId || null,
      semester: semester || null,
      ...introVideo,
    },
  });

  // Auto-generate sessions from the template
  const template = await prisma.classTemplate.findUnique({
    where: { id: templateId },
  });

  if (template) {
    const weeklyTopics = (template.weeklyTopics as Array<{
      week?: number;
      topic?: string;
      milestone?: string;
      outcomes?: string[];
    }>) || [];

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

    const [startTimeStr, endTimeStr] = meetingTime.split("-").map((s) => s.trim());

    // Generate sessions based on duration and meeting days
    const totalWeeks = template.durationWeeks;
    let sessionNumber = 1;
    const current = new Date(startDate);

    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };
    const meetingDayNumbers = meetingDays.map((d) => dayMap[d] ?? -1).filter((d) => d >= 0);

    for (let week = 0; week < totalWeeks; week++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + week * 7);

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + dayOffset);

        if (day > endDate) break;
        if (!meetingDayNumbers.includes(day.getDay())) continue;

        const weekTopic = weeklyTopics.find((t) => t.week === week + 1);
        sessions.push({
          offeringId: offering.id,
          sessionNumber,
          date: day,
          startTime: startTimeStr || "16:00",
          endTime: endTimeStr || "18:00",
          topic: weekTopic?.topic || `Session ${sessionNumber}`,
          learningOutcomes: weekTopic?.outcomes || [],
          milestone: weekTopic?.milestone || null,
        });
        sessionNumber++;
      }
    }

    if (sessions.length > 0) {
      await prisma.classSession.createMany({ data: sessions });
    }
  }

  revalidatePath("/classes/catalog");
  revalidatePath("/instructor/curriculum-builder");
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
  const introVideo = normalizeIntroVideoFields(formData);
  const status = getString(formData, "status", false) as
    | "DRAFT"
    | "PUBLISHED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "";

  const send24Hr = formData.get("send24HrReminder") !== "false";
  const send1Hr = formData.get("send1HrReminder") !== "false";

  await prisma.classOffering.update({
    where: { id },
    data: {
      title,
      meetingDays,
      meetingTime,
      deliveryMode,
      locationName: locationName || null,
      locationAddress: locationAddress || null,
      zoomLink: zoomLink || null,
      capacity,
      send24HrReminder: send24Hr,
      send1HrReminder: send1Hr,
      ...(status ? { status } : {}),
      semester: semester || null,
      ...introVideo,
    },
  });

  revalidatePath("/classes/catalog");
  revalidatePath(`/classes/${id}`);
  return { success: true };
}

export async function publishClassOffering(id: string) {
  const session = await requireInstructor();

  const existing = await prisma.classOffering.findUnique({ where: { id } });
  if (!existing) throw new Error("Offering not found");

  const roles = session.user?.roles ?? [];
  if (existing.instructorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized");
  }

  await prisma.classOffering.update({
    where: { id },
    data: { status: "PUBLISHED", enrollmentOpen: true },
  });

  revalidatePath("/classes/catalog");
  revalidatePath(`/classes/${id}`);
  return { success: true };
}

// ============================================
// ENROLLMENT ACTIONS
// ============================================

export async function enrollInClass(offeringId: string) {
  const session = await requireAuth();
  const studentId = session.user.id;

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

  revalidatePath(`/classes/${offeringId}`);
  revalidatePath("/classes/schedule");
  return { success: true, waitlisted: isWaitlisted };
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

  revalidatePath(`/classes/${offeringId}`);
  revalidatePath("/classes/schedule");
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
    select: { offeringId: true },
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

  revalidatePath(`/classes/${classSession.offeringId}`);
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

  revalidatePath(`/classes/${offeringId}`);
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
}) {
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

  return prisma.classOffering.findMany({
    where,
    include: {
      template: true,
      instructor: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
          sessions: true,
        },
      },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function getMyClassSchedule(userId: string) {
  return prisma.classEnrollment.findMany({
    where: {
      studentId: userId,
      status: { in: ["ENROLLED", "WAITLISTED"] },
    },
    include: {
      offering: {
        include: {
          template: true,
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
  return prisma.classTemplate.findMany({
    where: { createdById: instructorId },
    include: {
      _count: { select: { offerings: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getInstructorOfferings(instructorId: string) {
  return prisma.classOffering.findMany({
    where: { instructorId },
    include: {
      template: true,
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
  return prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: {
      template: {
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      },
      instructor: { select: { id: true, name: true, email: true } },
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
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
        },
      },
    },
  });
}
