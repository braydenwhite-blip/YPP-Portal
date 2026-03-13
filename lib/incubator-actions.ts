"use server";

import { Prisma, type IncubatorPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { awardXp } from "@/lib/xp";
import { createNotification } from "@/lib/notifications";
import {
  buildLaunchSlug,
  canAdvancePhase,
  getDefaultMilestonesForCohort,
  getNextPendingMilestone,
  getPhaseProgress,
  INCUBATOR_PHASES,
} from "@/lib/incubator-workflow";

type DbClient = Prisma.TransactionClient | typeof prisma;

const PHASE_XP: Record<IncubatorPhase, number> = {
  IDEATION: 25,
  PLANNING: 30,
  BUILDING: 50,
  FEEDBACK: 20,
  POLISHING: 30,
  SHOWCASE: 75,
};

const INCUBATOR_TABLES = new Set(
  [
    "IncubatorCohort",
    "IncubatorApplication",
    "IncubatorProject",
    "IncubatorMentor",
    "IncubatorUpdate",
    "IncubatorMilestoneTemplate",
    "IncubatorMilestone",
    "PitchFeedback",
  ].flatMap((tableName) => [tableName, `public.${tableName}`])
);

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

function extractRoleSet(session: any): Set<string> {
  const roles = new Set<string>();
  const primaryRole = session?.user?.primaryRole;
  if (typeof primaryRole === "string" && primaryRole) {
    roles.add(primaryRole);
  }

  const rawRoles = session?.user?.roles;
  if (Array.isArray(rawRoles)) {
    for (const role of rawRoles) {
      if (typeof role === "string" && role) roles.add(role);
      if (role && typeof role === "object" && typeof role.role === "string") {
        roles.add(role.role);
      }
    }
  }

  return roles;
}

function hasAnyRole(session: any, requiredRoles: string[]): boolean {
  const roleSet = extractRoleSet(session);
  return requiredRoles.some((role) => roleSet.has(role));
}

async function requireAnyRole(requiredRoles: string[]) {
  const session = await requireAuth();
  if (!hasAnyRole(session, requiredRoles)) {
    throw new Error("Unauthorized");
  }
  return session;
}

function isMissingIncubatorTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as { code?: string; meta?: { table?: string } };
  return (
    prismaError.code === "P2021" &&
    typeof prismaError.meta?.table === "string" &&
    INCUBATOR_TABLES.has(prismaError.meta.table)
  );
}

function readFallback<T>(error: unknown, fallbackValue: T): T {
  if (!isMissingIncubatorTableError(error)) throw error;
  return fallbackValue;
}

function rethrowIncubatorSetupError(error: unknown): never {
  if (isMissingIncubatorTableError(error)) {
    throw new Error(
      "Incubator is not enabled in this database yet. Run `prisma migrate deploy` to create incubator tables, then try again."
    );
  }
  throw error;
}

function parseStringList(value: FormDataEntryValue | null): string[] {
  const raw = typeof value === "string" ? value : "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function revalidateIncubatorSurfaces(projectId?: string, slug?: string | null) {
  revalidatePath("/incubator");
  revalidatePath("/admin/incubator");
  revalidatePath("/mentor/incubator");
  revalidatePath("/showcase");
  revalidatePath("/incubator/launches");
  if (projectId) {
    revalidatePath(`/incubator/project/${projectId}`);
  }
  if (slug) {
    revalidatePath(`/incubator/launches/${slug}`);
  }
}

async function getPassionName(passionId: string | null | undefined, fallback?: string | null) {
  if (!passionId) {
    return fallback ?? null;
  }

  const passion = await prisma.passionArea
    .findUnique({
      where: { id: passionId },
      select: { name: true },
    })
    .catch(() => null);

  return passion?.name ?? fallback ?? passionId;
}

async function ensureCohortTemplates(db: DbClient, cohortId: string) {
  const existing = await db.incubatorMilestoneTemplate.count({ where: { cohortId } });
  if (existing > 0) {
    return db.incubatorMilestoneTemplate.findMany({
      where: { cohortId },
      orderBy: [{ phase: "asc" }, { order: "asc" }],
    });
  }

  const templates = getDefaultMilestonesForCohort().map((template) => ({
    cohortId,
    phase: template.phase,
    title: template.title,
    description: template.description,
    deliverableLabel: template.deliverableLabel ?? null,
    dueDayOffset: template.dueDayOffset,
    order: template.order,
    requiresMentorApproval: template.requiresMentorApproval ?? false,
    requiredForPhase: true,
  }));

  await db.incubatorMilestoneTemplate.createMany({
    data: templates,
  });

  return db.incubatorMilestoneTemplate.findMany({
    where: { cohortId },
    orderBy: [{ phase: "asc" }, { order: "asc" }],
  });
}

async function seedProjectMilestones(db: DbClient, projectId: string) {
  const project = await db.incubatorProject.findUnique({
    where: { id: projectId },
    include: {
      cohort: { select: { startDate: true } },
      milestones: { select: { id: true }, take: 1 },
    },
  });

  if (!project || project.milestones.length > 0) {
    return;
  }

  const templates = await ensureCohortTemplates(db, project.cohortId);
  await db.incubatorMilestone.createMany({
    data: templates.map((template) => ({
      projectId,
      templateId: template.id,
      phase: template.phase,
      title: template.title,
      description: template.description,
      deliverableLabel: template.deliverableLabel,
      order: template.order,
      dueDate:
        template.dueDayOffset != null
          ? new Date(project.cohort.startDate.getTime() + template.dueDayOffset * 24 * 60 * 60 * 1000)
          : null,
      requiresMentorApproval: template.requiresMentorApproval,
      requiredForPhase: template.requiredForPhase,
      status: "NOT_STARTED",
      artifactUrls: [],
    })),
  });
}

async function awardProjectXp(studentId: string, projectId: string | null, amount: number, reason: string, meta?: Record<string, unknown>) {
  await awardXp(studentId, amount, reason, meta);
  if (projectId) {
    await prisma.incubatorProject
      .update({
        where: { id: projectId },
        data: { xpEarned: { increment: amount } },
      })
      .catch(() => null);
  }
}

async function syncProjectPhase(db: DbClient, projectId: string) {
  const project = await db.incubatorProject.findUnique({
    where: { id: projectId },
    include: {
      mentors: {
        where: { isActive: true },
        orderBy: { assignedAt: "asc" },
        select: { assignedAt: true },
      },
      milestones: {
        select: {
          phase: true,
          status: true,
          requiredForPhase: true,
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  const data: Record<string, unknown> = {
    mentorAssignedAt: project.mentors[0]?.assignedAt ?? null,
  };

  const completionField = `${project.currentPhase.toLowerCase()}Complete` as const;
  const phaseReady = canAdvancePhase(project.currentPhase, project.milestones);

  if (!phaseReady) {
    return db.incubatorProject.update({
      where: { id: projectId },
      data,
    });
  }

  const currentIndex = INCUBATOR_PHASES.indexOf(project.currentPhase);
  if (currentIndex >= 0) {
    data[completionField] = true;
  }

  if (project.currentPhase === "SHOWCASE") {
    data.showcaseComplete = true;
  } else if (currentIndex >= 0 && currentIndex < INCUBATOR_PHASES.length - 1) {
    data.currentPhase = INCUBATOR_PHASES[currentIndex + 1];
  }

  return db.incubatorProject.update({
    where: { id: projectId },
    data: data as Prisma.IncubatorProjectUpdateInput,
  });
}

async function maybeAwardPhaseXp(projectId: string, studentId: string, previousPhase: IncubatorPhase, updatedPhase: IncubatorPhase) {
  if (previousPhase === updatedPhase) {
    return;
  }

  await awardProjectXp(
    studentId,
    projectId,
    PHASE_XP[previousPhase] ?? 20,
    "incubator_phase_complete",
    { projectId, phase: previousPhase }
  );
}

async function ensureUniquePublicSlug(baseSlug: string) {
  const stableBase = baseSlug || "incubator-launch";
  let candidate = stableBase;
  let suffix = 2;

  while (await prisma.incubatorProject.findUnique({ where: { publicSlug: candidate } })) {
    candidate = `${stableBase}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function enrichProject<T extends {
  currentPhase: IncubatorPhase;
  mentors: Array<{ isActive: boolean }>;
  mentorRequired: boolean;
  milestones: Array<{
    id?: string;
    phase: IncubatorPhase;
    status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "APPROVED";
    title?: string;
    description?: string | null;
    deliverableLabel?: string | null;
    order: number;
    requiredForPhase: boolean;
    dueDate?: Date | null;
  }>;
  updates?: Array<{ createdAt: Date }>;
}>(project: T) {
  const activeMentors = project.mentors.filter((mentor) => mentor.isActive);
  const nextMilestone = getNextPendingMilestone(project.milestones);
  const currentPhaseProgress = getPhaseProgress(project.currentPhase, project.milestones);
  const latestUpdate = project.updates?.[0]?.createdAt ?? null;
  const needsWeeklyCheckIn =
    !latestUpdate || Date.now() - latestUpdate.getTime() > 7 * 24 * 60 * 60 * 1000;

  return {
    ...project,
    activeMentorCount: activeMentors.length,
    mentorBlocked: project.mentorRequired && activeMentors.length === 0,
    nextMilestone,
    currentPhaseProgress,
    needsWeeklyCheckIn,
  };
}

async function createAcceptanceArtifacts(
  tx: Prisma.TransactionClient,
  applicationId: string,
  reviewerId: string,
  mentorId: string,
  reviewNote: string | undefined,
  reviewRubric?: Record<string, number | null | undefined>
) {
  const application = await tx.incubatorApplication.findUnique({
    where: { id: applicationId },
    include: {
      cohort: true,
      acceptedProject: { select: { id: true } },
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  if (application.status === "ACCEPTED") {
    throw new Error("This application has already been accepted");
  }

  if (application.acceptedProject) {
    throw new Error("This application already has a project");
  }

  const now = new Date();
  const projectCount = await tx.incubatorProject.count({
    where: { cohortId: application.cohortId },
  });

  if (projectCount >= application.cohort.maxProjects) {
    throw new Error("This cohort is already full");
  }

  const passionName = application.passionArea;

  const tracker = await tx.projectTracker.create({
    data: {
      studentId: application.studentId,
      passionId: application.passionId ?? application.passionArea,
      title: application.projectTitle,
      description: application.projectIdea,
      status: "PLANNING",
      visibility: "PRIVATE",
      tags: [passionName ?? application.passionArea, "incubator"],
    },
  });

  const updatedApplication = await tx.incubatorApplication.update({
    where: { id: applicationId },
    data: {
      status: "ACCEPTED",
      reviewedById: reviewerId,
      reviewNote: reviewNote || null,
      reviewRubric: reviewRubric ? (reviewRubric as Prisma.InputJsonValue) : Prisma.DbNull,
      reviewedAt: now,
    },
  });

  const project = await tx.incubatorProject.create({
    data: {
      cohortId: application.cohortId,
      studentId: application.studentId,
      projectTrackerId: tracker.id,
      applicationId: application.id,
      title: application.projectTitle,
      description: application.projectIdea,
      passionArea: passionName ?? application.passionArea,
      passionId: application.passionId,
      currentPhase: "IDEATION",
      mentorRequired: true,
      mentorAssignedAt: now,
      launchTitle: application.projectTitle,
      launchSummary: application.projectIdea,
      targetAudience: application.goals,
    },
  });

  await tx.incubatorMentor.create({
    data: {
      cohortId: application.cohortId,
      projectId: project.id,
      mentorId,
      role: "MENTOR",
      notes: reviewNote || null,
    },
  });

  await ensureCohortTemplates(tx, application.cohortId);
  await seedProjectMilestones(tx, project.id);

  return {
    application: updatedApplication,
    project,
    tracker,
    passionName,
  };
}

// ============================================
// COHORT MANAGEMENT (Admin)
// ============================================

export async function getCohorts() {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
  try {
    return await prisma.incubatorCohort.findMany({
      orderBy: { startDate: "desc" },
      include: {
        _count: {
          select: {
            applications: true,
            projects: true,
            milestoneTemplates: true,
          },
        },
      },
    });
  } catch (error) {
    return readFallback(error, []);
  }
}

export async function getActiveCohort() {
  await requireAuth();
  try {
    const cohort = await prisma.incubatorCohort.findFirst({
      where: { status: { in: ["ACCEPTING_APPLICATIONS", "IN_PROGRESS", "SHOWCASE_PHASE"] } },
      orderBy: { startDate: "desc" },
      include: {
        milestoneTemplates: {
          orderBy: [{ phase: "asc" }, { order: "asc" }],
        },
        _count: { select: { applications: true, projects: true } },
      },
    });

    if (cohort) {
      await ensureCohortTemplates(prisma, cohort.id);
      return prisma.incubatorCohort.findUnique({
        where: { id: cohort.id },
        include: {
          milestoneTemplates: {
            orderBy: [{ phase: "asc" }, { order: "asc" }],
          },
          _count: { select: { applications: true, projects: true } },
        },
      });
    }

    return null;
  } catch (error) {
    return readFallback(error, null);
  }
}

export async function getCohortById(cohortId: string) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
  try {
    await ensureCohortTemplates(prisma, cohortId);

    return await prisma.incubatorCohort.findUnique({
      where: { id: cohortId },
      include: {
        milestoneTemplates: {
          orderBy: [{ phase: "asc" }, { order: "asc" }],
        },
        applications: {
          include: {
            student: { select: { id: true, name: true, email: true, level: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        projects: {
          include: {
            student: { select: { id: true, name: true, level: true } },
            mentors: {
              include: { mentor: { select: { id: true, name: true, email: true } } },
            },
            milestones: {
              orderBy: [{ phase: "asc" }, { order: "asc" }],
            },
            updates: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { createdAt: true, title: true },
            },
            _count: { select: { updates: true, pitchFeedback: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { applications: true, projects: true, mentorAssignments: true } },
      },
    });
  } catch (error) {
    return readFallback(error, null);
  }
}

export async function createCohort(formData: FormData) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const season = String(formData.get("season") || "").trim() || null;
  const year = parseInt(String(formData.get("year") || ""), 10) || new Date().getFullYear();
  const startDate = parseOptionalDate(formData.get("startDate"));
  const endDate = parseOptionalDate(formData.get("endDate"));
  const showcaseDate = parseOptionalDate(formData.get("showcaseDate"));
  const applicationOpen = parseOptionalDate(formData.get("applicationOpen"));
  const applicationClose = parseOptionalDate(formData.get("applicationClose"));
  const maxProjects = parseInt(String(formData.get("maxProjects") || ""), 10) || 20;
  const passionAreaIds = parseStringList(formData.get("passionAreaIds") ?? formData.get("passionAreas"));

  if (!name || !startDate || !endDate) {
    throw new Error("Name, start date, and end date are required");
  }

  if (endDate <= startDate) {
    throw new Error("End date must be after start date");
  }

  try {
    const cohort = await prisma.incubatorCohort.create({
      data: {
        name,
        description,
        season,
        year,
        startDate,
        endDate,
        showcaseDate,
        applicationOpen,
        applicationClose,
        maxProjects,
        passionAreas: passionAreaIds,
        passionAreaIds,
      },
    });

    await ensureCohortTemplates(prisma, cohort.id);
    revalidateIncubatorSurfaces();
    return cohort;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function updateCohortStatus(cohortId: string, status: string) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
  try {
    await prisma.incubatorCohort.update({
      where: { id: cohortId },
      data: { status: status as any },
    });
    revalidateIncubatorSurfaces();
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

// ============================================
// APPLICATIONS (Students)
// ============================================

export async function getMyApplications() {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);
  try {
    return await prisma.incubatorApplication.findMany({
      where: { studentId: session.user.id },
      include: {
        cohort: {
          select: {
            id: true,
            name: true,
            season: true,
            year: true,
            status: true,
            startDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    return readFallback(error, []);
  }
}

export async function applyToIncubator(formData: FormData) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  const cohortId = String(formData.get("cohortId") || "").trim();
  const projectTitle = String(formData.get("projectTitle") || "").trim();
  const projectIdea = String(formData.get("projectIdea") || "").trim();
  const passionId = String(formData.get("passionId") || "").trim();
  const whyThisProject = String(formData.get("whyThisProject") || "").trim();
  const priorExperience = String(formData.get("priorExperience") || "").trim() || null;
  const goals = String(formData.get("goals") || "").trim();
  const needsMentor = String(formData.get("needsMentor") || "true") !== "false";
  const mentorPreference = String(formData.get("mentorPreference") || "").trim() || null;

  if (!cohortId || !projectTitle || !projectIdea || !passionId || !whyThisProject || !goals) {
    throw new Error("All required fields must be filled out");
  }

  try {
    const now = new Date();
    const cohort = await prisma.incubatorCohort.findUnique({ where: { id: cohortId } });
    if (!cohort || cohort.status !== "ACCEPTING_APPLICATIONS") {
      throw new Error("This cohort is not accepting applications");
    }

    if (cohort.applicationOpen && now < cohort.applicationOpen) {
      throw new Error("Applications for this cohort are not open yet");
    }

    if (cohort.applicationClose && now > cohort.applicationClose) {
      throw new Error("Applications for this cohort are closed");
    }

    if (cohort.passionAreaIds.length > 0 && !cohort.passionAreaIds.includes(passionId)) {
      throw new Error("This cohort is not open to that passion area");
    }

    const existing = await prisma.incubatorApplication.findUnique({
      where: { cohortId_studentId: { cohortId, studentId: session.user.id } },
    });
    if (existing) throw new Error("You have already applied to this cohort");

    const currentProjects = await prisma.incubatorProject.count({
      where: { cohortId },
    });
    if (currentProjects >= cohort.maxProjects) {
      throw new Error("This cohort is already full");
    }

    const passionLabel = await getPassionName(passionId, passionId);
    const application = await prisma.incubatorApplication.create({
      data: {
        cohortId,
        studentId: session.user.id,
        projectTitle,
        projectIdea,
        passionArea: passionLabel ?? passionId,
        passionId,
        whyThisProject,
        priorExperience,
        goals,
        needsMentor,
        mentorPreference,
      },
    });

    await awardXp(session.user.id, 20, "incubator_application", { cohortId });
    await createNotification({
      userId: session.user.id,
      type: "SYSTEM",
      title: "Incubator application submitted",
      body: `Your application for "${projectTitle}" is in review.`,
      link: "/incubator",
    });

    revalidateIncubatorSurfaces();
    return application;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function reviewApplication(input: {
  applicationId: string;
  status: "ACCEPTED" | "WAITLISTED" | "REJECTED";
  reviewNote?: string;
  mentorId?: string | null;
  rubric?: {
    vision?: number | null;
    readiness?: number | null;
    commitment?: number | null;
  };
}) {
  const session = await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);

  try {
    const application = await prisma.incubatorApplication.findUnique({
      where: { id: input.applicationId },
      include: { acceptedProject: { select: { id: true } } },
    });

    if (!application) {
      throw new Error("Application not found");
    }

    if (input.status === "ACCEPTED") {
      if (!input.mentorId) {
        throw new Error("Choose a mentor before accepting this project");
      }

      const result = await prisma.$transaction((tx) =>
        createAcceptanceArtifacts(
          tx,
          input.applicationId,
          session.user.id,
          input.mentorId as string,
          input.reviewNote,
          input.rubric
        )
      );

      await awardProjectXp(
        result.project.studentId,
        result.project.id,
        50,
        "incubator_accepted",
        { cohortId: result.project.cohortId }
      );

      await Promise.all([
        createNotification({
          userId: result.project.studentId,
          type: "SYSTEM",
          title: "You are in the incubator",
          body: `Your project "${result.project.title}" was accepted and your mentor is assigned.`,
          link: `/incubator/project/${result.project.id}`,
        }),
        createNotification({
          userId: input.mentorId as string,
          type: "SYSTEM",
          title: "New incubator project assigned",
          body: `You have been assigned to mentor "${result.project.title}".`,
          link: `/mentor/incubator`,
        }),
      ]);

      revalidateIncubatorSurfaces(result.project.id);
      return result;
    }

    const updated = await prisma.incubatorApplication.update({
      where: { id: input.applicationId },
      data: {
        status: input.status,
        reviewedById: session.user.id,
        reviewNote: input.reviewNote || null,
        reviewRubric: input.rubric ? (input.rubric as Prisma.InputJsonValue) : Prisma.DbNull,
        reviewedAt: new Date(),
      },
    });

    await createNotification({
      userId: application.studentId,
      type: "SYSTEM",
      title:
        input.status === "WAITLISTED"
          ? "Incubator application waitlisted"
          : "Incubator application update",
      body:
        input.status === "WAITLISTED"
          ? `Your project "${application.projectTitle}" is waitlisted for now.`
          : `Your application for "${application.projectTitle}" was not accepted this round.`,
      link: "/incubator",
    });

    revalidateIncubatorSurfaces();
    return updated;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

// ============================================
// INCUBATOR PROJECTS
// ============================================

async function getProjectQuery(projectId: string) {
  const project = await prisma.incubatorProject.findUnique({
    where: { id: projectId },
    include: {
      application: {
        select: {
          reviewRubric: true,
          goals: true,
          mentorPreference: true,
          whyThisProject: true,
        },
      },
      student: { select: { id: true, name: true, level: true, email: true } },
      cohort: {
        select: {
          id: true,
          name: true,
          season: true,
          year: true,
          status: true,
          startDate: true,
          endDate: true,
          showcaseDate: true,
        },
      },
      mentors: {
        include: {
          mentor: { select: { id: true, name: true, email: true, primaryRole: true } },
        },
        orderBy: { assignedAt: "asc" },
      },
      milestones: {
        orderBy: [{ phase: "asc" }, { order: "asc" }],
      },
      updates: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      pitchFeedback: {
        include: { reviewer: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (project && project.milestones.length === 0) {
    await seedProjectMilestones(prisma, project.id);
    return getProjectQuery(projectId);
  }

  return project;
}

export async function getMyIncubatorProjects() {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);
  try {
    let projects = await prisma.incubatorProject.findMany({
      where: { studentId: session.user.id },
      include: {
        cohort: {
          select: {
            id: true,
            name: true,
            season: true,
            year: true,
            status: true,
            showcaseDate: true,
          },
        },
        mentors: {
          include: { mentor: { select: { id: true, name: true } } },
          orderBy: { assignedAt: "asc" },
        },
        milestones: {
          orderBy: [{ phase: "asc" }, { order: "asc" }],
        },
        updates: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        },
        _count: { select: { updates: true, pitchFeedback: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const missingMilestones = projects.filter((project) => project.milestones.length === 0);
    if (missingMilestones.length > 0) {
      await Promise.all(missingMilestones.map((project) => seedProjectMilestones(prisma, project.id)));
      projects = await prisma.incubatorProject.findMany({
        where: { studentId: session.user.id },
        include: {
          cohort: {
            select: {
              id: true,
              name: true,
              season: true,
              year: true,
              status: true,
              showcaseDate: true,
            },
          },
          mentors: {
            include: { mentor: { select: { id: true, name: true } } },
            orderBy: { assignedAt: "asc" },
          },
          milestones: {
            orderBy: [{ phase: "asc" }, { order: "asc" }],
          },
          updates: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          },
          _count: { select: { updates: true, pitchFeedback: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return projects.map((project) => enrichProject(project));
  } catch (error) {
    return readFallback(error, []);
  }
}

export async function getIncubatorProject(projectId: string) {
  const session = await requireAuth();
  try {
    const project = await getProjectQuery(projectId);

    if (!project) {
      return null;
    }

    const privileged = hasAnyRole(session, ["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
    const isAssignedMentor = project.mentors.some(
      (assignment) => assignment.mentorId === session.user.id && assignment.isActive
    );
    const isOwner = project.studentId === session.user.id;

    if (!isOwner && !privileged && !isAssignedMentor) {
      throw new Error("Unauthorized");
    }

    return enrichProject(project);
  } catch (error) {
    return readFallback(error, null);
  }
}

export async function getAllIncubatorProjects(cohortId?: string) {
  const session = await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD", "MENTOR", "STUDENT"]);
  try {
    const privileged = hasAnyRole(session, ["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
    const mentorOnly = !privileged && hasAnyRole(session, ["MENTOR"]);
    const whereClause: Prisma.IncubatorProjectWhereInput = mentorOnly
      ? {
          ...(cohortId ? { cohortId } : {}),
          mentors: {
            some: {
              mentorId: session.user.id,
              isActive: true,
            },
          },
        }
      : cohortId
        ? { cohortId }
        : {};

    const projects = await prisma.incubatorProject.findMany({
      where: whereClause,
      include: {
        student: { select: { id: true, name: true, level: true } },
        cohort: { select: { id: true, name: true } },
        mentors: {
          include: { mentor: { select: { name: true } } },
          orderBy: { assignedAt: "asc" },
        },
        milestones: {
          orderBy: [{ phase: "asc" }, { order: "asc" }],
        },
        updates: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        },
        _count: { select: { updates: true, pitchFeedback: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return projects.map((project) => enrichProject(project));
  } catch (error) {
    return readFallback(error, []);
  }
}

export async function advancePhase(projectId: string) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  try {
    const project = await prisma.incubatorProject.findUnique({
      where: { id: projectId },
      include: {
        mentors: { where: { isActive: true }, select: { id: true } },
        milestones: {
          select: { phase: true, status: true, requiredForPhase: true },
        },
      },
    });
    if (!project) throw new Error("Project not found");
    if (project.studentId !== session.user.id) throw new Error("Not your project");
    if (project.mentorRequired && project.mentors.length === 0) {
      throw new Error("Your mentor must be assigned before you unlock the next phase");
    }
    if (!canAdvancePhase(project.currentPhase, project.milestones)) {
      throw new Error("Finish the current phase milestones before moving on");
    }

    const currentIdx = INCUBATOR_PHASES.indexOf(project.currentPhase);
    if (currentIdx >= INCUBATOR_PHASES.length - 1) {
      throw new Error("Already at the final phase");
    }

    const completionField = `${project.currentPhase.toLowerCase()}Complete` as const;
    await prisma.incubatorProject.update({
      where: { id: projectId },
      data: {
        currentPhase: INCUBATOR_PHASES[currentIdx + 1],
        [completionField]: true,
      },
    });

    await awardProjectXp(session.user.id, projectId, PHASE_XP[project.currentPhase] ?? 20, "incubator_phase_complete", {
      projectId,
      phase: project.currentPhase,
    });

    revalidateIncubatorSurfaces(projectId);
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function submitMilestone(projectId: string, milestoneId: string, formData: FormData) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  try {
    const project = await prisma.incubatorProject.findUnique({
      where: { id: projectId },
      include: {
        mentors: {
          where: { isActive: true },
          select: { mentorId: true },
        },
      },
    });
    if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

    const milestone = await prisma.incubatorMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) throw new Error("Milestone not found");

    const submissionNote = String(formData.get("submissionNote") || "").trim();
    const artifactUrls = parseStringList(formData.get("artifactUrls"));

    if (!submissionNote && artifactUrls.length === 0) {
      throw new Error("Add a short note or at least one link before submitting");
    }

    const previousPhase = project.currentPhase;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.incubatorMilestone.update({
        where: { id: milestoneId },
        data: {
          submissionNote: submissionNote || null,
          artifactUrls,
          submittedAt: new Date(),
          completedAt: new Date(),
          status: milestone.requiresMentorApproval ? "SUBMITTED" : "APPROVED",
          approvedAt: milestone.requiresMentorApproval ? null : new Date(),
          approvedById: milestone.requiresMentorApproval ? null : session.user.id,
        },
      });

      return syncProjectPhase(tx, projectId);
    });

    if (!milestone.requiresMentorApproval) {
      await awardProjectXp(session.user.id, projectId, 15, "incubator_milestone_complete", {
        projectId,
        milestoneId,
      });
    }

    if (milestone.requiresMentorApproval && project.mentors.length > 0) {
      await Promise.all(
        project.mentors.map((mentor) =>
          createNotification({
            userId: mentor.mentorId,
            type: "SYSTEM",
            title: "Incubator milestone ready for review",
            body: `"${project.title}" has a milestone waiting for mentor approval.`,
            link: `/mentor/incubator`,
          })
        )
      );
    }

    if (updated) {
      await maybeAwardPhaseXp(projectId, project.studentId, previousPhase, updated.currentPhase);
    }

    revalidateIncubatorSurfaces(projectId);
    return updated;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function approveMilestone(projectId: string, milestoneId: string) {
  const session = await requireAnyRole(["ADMIN", "INSTRUCTOR", "MENTOR", "CHAPTER_LEAD"]);

  try {
    const project = await prisma.incubatorProject.findUnique({
      where: { id: projectId },
      include: {
        mentors: {
          where: { isActive: true },
          select: { mentorId: true },
        },
      },
    });

    if (!project) throw new Error("Project not found");

    const privileged = hasAnyRole(session, ["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
    const isAssignedMentor = project.mentors.some((mentor) => mentor.mentorId === session.user.id);
    if (!privileged && !isAssignedMentor) {
      throw new Error("You are not assigned to review this milestone");
    }

    const milestone = await prisma.incubatorMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) throw new Error("Milestone not found");

    const previousPhase = project.currentPhase;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.incubatorMilestone.update({
        where: { id: milestoneId },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: session.user.id,
          completedAt: milestone.completedAt ?? new Date(),
        },
      });

      return syncProjectPhase(tx, projectId);
    });

    await Promise.all([
      awardProjectXp(project.studentId, projectId, 15, "incubator_milestone_approved", {
        projectId,
        milestoneId,
      }),
      createNotification({
        userId: project.studentId,
        type: "MENTOR_FEEDBACK",
        title: "Milestone approved",
        body: `A mentor approved your progress in "${project.title}".`,
        link: `/incubator/project/${projectId}`,
      }),
    ]);

    if (updated) {
      await maybeAwardPhaseXp(projectId, project.studentId, previousPhase, updated.currentPhase);
    }

    revalidateIncubatorSurfaces(projectId);
    return updated;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function updateProjectShowcase(projectId: string, formData: FormData) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  try {
    const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

    const pitchVideoUrl = String(formData.get("pitchVideoUrl") || "").trim() || null;
    const pitchDeckUrl = String(formData.get("pitchDeckUrl") || "").trim() || null;
    const finalShowcaseUrl = String(formData.get("finalShowcaseUrl") || "").trim() || null;
    const launchTitle = String(formData.get("launchTitle") || "").trim() || null;
    const launchTagline = String(formData.get("launchTagline") || "").trim() || null;
    const launchSummary = String(formData.get("launchSummary") || "").trim() || null;
    const problemStatement = String(formData.get("problemStatement") || "").trim() || null;
    const solutionSummary = String(formData.get("solutionSummary") || "").trim() || null;
    const targetAudience = String(formData.get("targetAudience") || "").trim() || null;
    const buildHighlights = parseStringList(formData.get("buildHighlights"));
    const launchGalleryUrls = parseStringList(formData.get("launchGalleryUrls"));
    const demoUrl = String(formData.get("demoUrl") || "").trim() || null;
    const repositoryUrl = String(formData.get("repositoryUrl") || "").trim() || null;
    const waitlistUrl = String(formData.get("waitlistUrl") || "").trim() || null;

    await prisma.incubatorProject.update({
      where: { id: projectId },
      data: {
        pitchVideoUrl,
        pitchDeckUrl,
        finalShowcaseUrl,
        launchTitle,
        launchTagline,
        launchSummary,
        problemStatement,
        solutionSummary,
        targetAudience,
        buildHighlights,
        launchGalleryUrls,
        demoUrl,
        repositoryUrl,
        waitlistUrl,
      },
    });

    revalidateIncubatorSurfaces(projectId, project.publicSlug);
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function submitProjectLaunch(projectId: string) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  try {
    const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

    if (!project.launchTitle || !project.launchSummary || !project.problemStatement || !project.solutionSummary) {
      throw new Error("Complete the launch story before submitting for approval");
    }

    await prisma.incubatorProject.update({
      where: { id: projectId },
      data: {
        launchStatus: "SUBMITTED",
        launchSubmittedAt: new Date(),
      },
    });

    await createNotification({
      userId: session.user.id,
      type: "SYSTEM",
      title: "Launch submitted",
      body: `Your launch page for "${project.title}" is ready for staff review.`,
      link: `/incubator/project/${projectId}`,
    });

    revalidateIncubatorSurfaces(projectId, project.publicSlug);
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function approveProjectLaunch(projectId: string) {
  const session = await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);

  try {
    const project = await prisma.incubatorProject.findUnique({
      where: { id: projectId },
      include: {
        student: { select: { name: true } },
      },
    });
    if (!project) throw new Error("Project not found");
    if (project.launchStatus !== "SUBMITTED") {
      throw new Error("This launch is not waiting for approval");
    }

    const baseSlug = buildLaunchSlug(project.launchTitle || project.title, project.student.name);
    const publicSlug = await ensureUniquePublicSlug(baseSlug);

    await prisma.incubatorProject.update({
      where: { id: projectId },
      data: {
        launchStatus: "APPROVED",
        publicSlug,
        launchApprovedAt: new Date(),
        launchApprovedById: session.user.id,
      },
    });

    await createNotification({
      userId: project.studentId,
      type: "SYSTEM",
      title: "Launch approved",
      body: `Your project "${project.title}" is now live in incubator launches.`,
      link: `/incubator/project/${projectId}`,
    });

    revalidateIncubatorSurfaces(projectId, publicSlug);
    return publicSlug;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

// ============================================
// UPDATES / CHECK-INS
// ============================================

export async function postUpdate(projectId: string, formData: FormData) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  try {
    const project = await prisma.incubatorProject.findUnique({
      where: { id: projectId },
      include: {
        mentors: {
          where: { isActive: true },
          select: { mentorId: true },
        },
      },
    });
    if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

    const title = String(formData.get("title") || "").trim();
    const content = String(formData.get("content") || "").trim();
    const phase = project.currentPhase;
    const hoursSpent = parseFloat(String(formData.get("hoursSpent") || "")) || null;
    const mediaUrls = parseStringList(formData.get("mediaUrls"));

    if (!title || !content) throw new Error("Title and content are required");

    const update = await prisma.incubatorUpdate.create({
      data: {
        projectId,
        authorId: session.user.id,
        title,
        content,
        phase,
        hoursSpent,
        mediaUrls,
      },
    });

    await awardProjectXp(session.user.id, projectId, 10, "incubator_update", { projectId });

    if (project.mentors.length > 0) {
      await Promise.all(
        project.mentors.map((mentor) =>
          createNotification({
            userId: mentor.mentorId,
            type: "SYSTEM",
            title: "New incubator update posted",
            body: `"${project.title}" has a new progress update.`,
            link: `/mentor/incubator`,
          })
        )
      );
    }

    revalidateIncubatorSurfaces(projectId, project.publicSlug);
    return update;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

// ============================================
// MENTOR ASSIGNMENT (Admin)
// ============================================

export async function assignMentor(projectId: string, mentorId: string, role?: string) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);

  try {
    const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    await prisma.incubatorMentor.upsert({
      where: {
        projectId_mentorId: {
          projectId,
          mentorId,
        },
      },
      update: {
        isActive: true,
        role: role || "MENTOR",
      },
      create: {
        cohortId: project.cohortId,
        projectId,
        mentorId,
        role: role || "MENTOR",
      },
    });

    await prisma.incubatorProject.update({
      where: { id: projectId },
      data: { mentorAssignedAt: new Date() },
    });

    await createNotification({
      userId: mentorId,
      type: "SYSTEM",
      title: "New incubator project assigned",
      body: `You have been assigned to mentor "${project.title}".`,
      link: "/mentor/incubator",
    });

    revalidateIncubatorSurfaces(projectId, project.publicSlug);
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function removeMentor(assignmentId: string) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
  try {
    const assignment = await prisma.incubatorMentor.findUnique({
      where: { id: assignmentId },
      select: { projectId: true },
    });
    await prisma.incubatorMentor.delete({ where: { id: assignmentId } });

    if (assignment?.projectId) {
      const activeMentorCount = await prisma.incubatorMentor.count({
        where: { projectId: assignment.projectId, isActive: true },
      });
      if (activeMentorCount === 0) {
        await prisma.incubatorProject.update({
          where: { id: assignment.projectId },
          data: { mentorAssignedAt: null },
        });
      }
      revalidateIncubatorSurfaces(assignment.projectId);
    } else {
      revalidateIncubatorSurfaces();
    }
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

export async function getAvailableMentors() {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
  return prisma.user.findMany({
    where: {
      OR: [
        { primaryRole: "INSTRUCTOR" },
        { primaryRole: "MENTOR" },
        { roles: { some: { role: { in: ["INSTRUCTOR", "MENTOR"] } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      _count: {
        select: {
          incubatorMentoring: true,
          officeHoursHosted: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getMentorIncubatorWorkspace() {
  const session = await requireAnyRole(["MENTOR", "ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
  try {
    const privileged = hasAnyRole(session, ["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]) && !hasAnyRole(session, ["MENTOR"]);
    const projects = await prisma.incubatorProject.findMany({
      where: privileged
        ? {}
        : {
            mentors: {
              some: {
                mentorId: session.user.id,
                isActive: true,
              },
            },
          },
      include: {
        student: { select: { id: true, name: true, level: true } },
        cohort: { select: { id: true, name: true, showcaseDate: true } },
        mentors: {
          include: { mentor: { select: { id: true, name: true } } },
          orderBy: { assignedAt: "asc" },
        },
        milestones: {
          orderBy: [{ phase: "asc" }, { order: "asc" }],
        },
        updates: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, title: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const enriched = projects.map((project) => enrichProject(project));
    const staleProjects = enriched.filter(
      (project) =>
        !project.updates[0]?.createdAt ||
        Date.now() - project.updates[0].createdAt.getTime() > 7 * 24 * 60 * 60 * 1000
    );
    const pendingMilestones = enriched.flatMap((project) =>
      project.milestones
        .filter((milestone) => milestone.status === "SUBMITTED")
        .map((milestone) => ({
          projectId: project.id,
          projectTitle: project.title,
          studentName: project.student.name,
          milestone,
        }))
    );
    const launchQueue = enriched.filter((project) => project.launchStatus === "SUBMITTED");

    return {
      projects: enriched,
      staleProjects,
      pendingMilestones,
      launchQueue,
    };
  } catch (error) {
    return readFallback(error, {
      projects: [],
      staleProjects: [],
      pendingMilestones: [],
      launchQueue: [],
    });
  }
}

// ============================================
// PITCH FEEDBACK
// ============================================

export async function submitPitchFeedback(projectId: string, formData: FormData) {
  const session = await requireAnyRole(["ADMIN", "INSTRUCTOR", "MENTOR", "CHAPTER_LEAD"]);

  const clarityScore = parseInt(String(formData.get("clarityScore") || ""), 10) || null;
  const passionScore = parseInt(String(formData.get("passionScore") || ""), 10) || null;
  const executionScore = parseInt(String(formData.get("executionScore") || ""), 10) || null;
  const impactScore = parseInt(String(formData.get("impactScore") || ""), 10) || null;
  const scores = [clarityScore, passionScore, executionScore, impactScore].filter(Boolean) as number[];
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const strengths = String(formData.get("strengths") || "").trim() || null;
  const improvements = String(formData.get("improvements") || "").trim() || null;
  const encouragement = String(formData.get("encouragement") || "").trim() || null;

  try {
    const project = await prisma.incubatorProject.findUnique({
      where: { id: projectId },
      include: {
        mentors: {
          select: { mentorId: true, isActive: true },
        },
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.studentId === session.user.id) {
      throw new Error("Students cannot submit feedback on their own project");
    }

    const privileged = hasAnyRole(session, ["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
    const isAssignedMentor = project.mentors.some(
      (assignment) => assignment.mentorId === session.user.id && assignment.isActive
    );
    if (!privileged && !isAssignedMentor) {
      throw new Error("Unauthorized");
    }

    const feedback = await prisma.pitchFeedback.upsert({
      where: {
        projectId_reviewerId: {
          projectId,
          reviewerId: session.user.id,
        },
      },
      update: {
        clarityScore,
        passionScore,
        executionScore,
        impactScore,
        overallScore,
        strengths,
        improvements,
        encouragement,
      },
      create: {
        projectId,
        reviewerId: session.user.id,
        clarityScore,
        passionScore,
        executionScore,
        impactScore,
        overallScore,
        strengths,
        improvements,
        encouragement,
      },
    });

    await createNotification({
      userId: project.studentId,
      type: "MENTOR_FEEDBACK",
      title: "New pitch feedback",
      body: `Someone left launch feedback on "${project.title}".`,
      link: `/incubator/project/${projectId}`,
    });

    revalidateIncubatorSurfaces(projectId, project.publicSlug);
    return feedback;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

// ============================================
// RESOURCE REQUESTS (Uses existing model)
// ============================================

export async function getProjectResourceRequests(projectId: string) {
  const session = await requireAuth();
  try {
    const project = await prisma.incubatorProject.findUnique({
      where: { id: projectId },
      include: {
        mentors: {
          select: { mentorId: true, isActive: true },
        },
      },
    });
    if (!project) throw new Error("Project not found");

    const privileged = hasAnyRole(session, ["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);
    const isAssignedMentor = project.mentors.some(
      (assignment) => assignment.mentorId === session.user.id && assignment.isActive
    );
    const isOwner = project.studentId === session.user.id;
    if (!isOwner && !privileged && !isAssignedMentor) {
      throw new Error("Unauthorized");
    }

    return await prisma.resourceRequest.findMany({
      where: { projectId: project.projectTrackerId || undefined, studentId: project.studentId },
      orderBy: { requestedAt: "desc" },
    });
  } catch (error) {
    return readFallback(error, []);
  }
}

export async function requestResource(formData: FormData) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  try {
    const projectId = String(formData.get("incubatorProjectId") || "").trim();
    const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

    const itemName = String(formData.get("itemName") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const reason = String(formData.get("reason") || "").trim();
    const estimatedCost = parseFloat(String(formData.get("estimatedCost") || "")) || null;

    if (!itemName || !description || !reason) throw new Error("All fields required");

    const request = await prisma.resourceRequest.create({
      data: {
        studentId: session.user.id,
        projectId: project.projectTrackerId,
        passionId: project.passionId ?? project.passionArea,
        itemName,
        description,
        reason,
        estimatedCost,
        status: "PENDING",
      },
    });

    revalidateIncubatorSurfaces(projectId, project.publicSlug);
    return request;
  } catch (error) {
    rethrowIncubatorSetupError(error);
  }
}

// ============================================
// PUBLIC LAUNCHES
// ============================================

export async function getPublicIncubatorLaunches() {
  try {
    return await prisma.incubatorProject.findMany({
      where: { launchStatus: "APPROVED" },
      include: {
        student: { select: { id: true, name: true, level: true } },
        mentors: {
          where: { isActive: true },
          include: {
            mentor: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
      },
      orderBy: [{ launchApprovedAt: "desc" }, { updatedAt: "desc" }],
    });
  } catch (error) {
    return readFallback(error, []);
  }
}

export async function getPublicIncubatorLaunchBySlug(slug: string) {
  try {
    return await prisma.incubatorProject.findFirst({
      where: {
        publicSlug: slug,
        launchStatus: "APPROVED",
      },
      include: {
        student: { select: { id: true, name: true, level: true } },
        cohort: { select: { id: true, name: true, showcaseDate: true } },
        mentors: {
          where: { isActive: true },
          include: {
            mentor: { select: { id: true, name: true, primaryRole: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
        updates: {
          take: 3,
          orderBy: { createdAt: "desc" },
          select: { title: true, content: true, createdAt: true },
        },
      },
    });
  } catch (error) {
    return readFallback(error, null);
  }
}

// ============================================
// STATS & OVERVIEW
// ============================================

export async function getIncubatorStats() {
  await requireAuth();

  try {
    const [totalProjects, activeProjects, totalUpdates, showcaseReady] = await Promise.all([
      prisma.incubatorProject.count(),
      prisma.incubatorProject.count({ where: { currentPhase: { not: "SHOWCASE" } } }),
      prisma.incubatorUpdate.count(),
      prisma.incubatorProject.count({ where: { launchStatus: "APPROVED" } }),
    ]);

    return { totalProjects, activeProjects, totalUpdates, showcaseReady };
  } catch (error) {
    return readFallback(error, {
      totalProjects: 0,
      activeProjects: 0,
      totalUpdates: 0,
      showcaseReady: 0,
    });
  }
}
