"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { awardXp } from "@/lib/xp";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

// ============================================
// COHORT MANAGEMENT (Admin)
// ============================================

export async function getCohorts() {
  await requireAuth();
  return prisma.incubatorCohort.findMany({
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { applications: true, projects: true } },
    },
  });
}

export async function getActiveCohort() {
  await requireAuth();
  return prisma.incubatorCohort.findFirst({
    where: { status: { in: ["ACCEPTING_APPLICATIONS", "IN_PROGRESS", "SHOWCASE_PHASE"] } },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { applications: true, projects: true } },
    },
  });
}

export async function getCohortById(cohortId: string) {
  await requireAuth();
  return prisma.incubatorCohort.findUnique({
    where: { id: cohortId },
    include: {
      applications: {
        include: { student: { select: { id: true, name: true, email: true, level: true } } },
        orderBy: { createdAt: "desc" },
      },
      projects: {
        include: {
          student: { select: { id: true, name: true, level: true } },
          mentors: { include: { mentor: { select: { id: true, name: true } } } },
          _count: { select: { updates: true, pitchFeedback: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { applications: true, projects: true, mentorAssignments: true } },
    },
  });
}

export async function createCohort(formData: FormData) {
  await requireAuth();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const season = formData.get("season") as string;
  const year = parseInt(formData.get("year") as string) || new Date().getFullYear();
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const showcaseDate = formData.get("showcaseDate") ? new Date(formData.get("showcaseDate") as string) : null;
  const applicationOpen = formData.get("applicationOpen") ? new Date(formData.get("applicationOpen") as string) : null;
  const applicationClose = formData.get("applicationClose") ? new Date(formData.get("applicationClose") as string) : null;
  const maxProjects = parseInt(formData.get("maxProjects") as string) || 20;
  const passionAreasRaw = formData.get("passionAreas") as string;
  const passionAreas = passionAreasRaw ? passionAreasRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  if (!name || !startDate || !endDate) {
    throw new Error("Name, start date, and end date are required");
  }

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
      passionAreas,
    },
  });

  revalidatePath("/incubator");
  revalidatePath("/admin/incubator");
  return cohort;
}

export async function updateCohortStatus(cohortId: string, status: string) {
  await requireAuth();
  await prisma.incubatorCohort.update({
    where: { id: cohortId },
    data: { status: status as any },
  });
  revalidatePath("/incubator");
  revalidatePath("/admin/incubator");
}

// ============================================
// APPLICATIONS (Students)
// ============================================

export async function getMyApplications() {
  const session = await requireAuth();
  return prisma.incubatorApplication.findMany({
    where: { studentId: session.user.id },
    include: {
      cohort: { select: { id: true, name: true, season: true, year: true, status: true, startDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function applyToIncubator(formData: FormData) {
  const session = await requireAuth();

  const cohortId = formData.get("cohortId") as string;
  const projectTitle = formData.get("projectTitle") as string;
  const projectIdea = formData.get("projectIdea") as string;
  const passionArea = formData.get("passionArea") as string;
  const whyThisProject = formData.get("whyThisProject") as string;
  const priorExperience = formData.get("priorExperience") as string || null;
  const goals = formData.get("goals") as string;
  const needsMentor = formData.get("needsMentor") !== "false";
  const mentorPreference = formData.get("mentorPreference") as string || null;

  if (!cohortId || !projectTitle || !projectIdea || !passionArea || !whyThisProject || !goals) {
    throw new Error("All required fields must be filled out");
  }

  // Check cohort is accepting applications
  const cohort = await prisma.incubatorCohort.findUnique({ where: { id: cohortId } });
  if (!cohort || cohort.status !== "ACCEPTING_APPLICATIONS") {
    throw new Error("This cohort is not accepting applications");
  }

  // Check not already applied
  const existing = await prisma.incubatorApplication.findUnique({
    where: { cohortId_studentId: { cohortId, studentId: session.user.id } },
  });
  if (existing) throw new Error("You have already applied to this cohort");

  const application = await prisma.incubatorApplication.create({
    data: {
      cohortId,
      studentId: session.user.id,
      projectTitle,
      projectIdea,
      passionArea,
      whyThisProject,
      priorExperience,
      goals,
      needsMentor,
      mentorPreference,
    },
  });

  await awardXp(session.user.id, 20, "incubator_application", { cohortId });

  revalidatePath("/incubator");
  return application;
}

export async function reviewApplication(applicationId: string, status: string, reviewNote?: string) {
  const session = await requireAuth();

  const app = await prisma.incubatorApplication.update({
    where: { id: applicationId },
    data: {
      status: status as any,
      reviewedById: session.user.id,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
    },
  });

  // If accepted, create the incubator project
  if (status === "ACCEPTED") {
    const application = await prisma.incubatorApplication.findUnique({
      where: { id: applicationId },
    });
    if (application) {
      // Also create a ProjectTracker
      const tracker = await prisma.projectTracker.create({
        data: {
          studentId: application.studentId,
          passionId: application.passionArea,
          title: application.projectTitle,
          description: application.projectIdea,
          status: "PLANNING",
          visibility: "PUBLIC",
          tags: [application.passionArea, "incubator"],
        },
      });

      await prisma.incubatorProject.create({
        data: {
          cohortId: application.cohortId,
          studentId: application.studentId,
          projectTrackerId: tracker.id,
          title: application.projectTitle,
          description: application.projectIdea,
          passionArea: application.passionArea,
          currentPhase: "IDEATION",
        },
      });

      await awardXp(application.studentId, 50, "incubator_accepted", { cohortId: application.cohortId });
    }
  }

  revalidatePath("/incubator");
  revalidatePath("/admin/incubator");
  return app;
}

// ============================================
// INCUBATOR PROJECTS
// ============================================

export async function getMyIncubatorProjects() {
  const session = await requireAuth();
  return prisma.incubatorProject.findMany({
    where: { studentId: session.user.id },
    include: {
      cohort: { select: { id: true, name: true, season: true, year: true, status: true, showcaseDate: true } },
      mentors: { include: { mentor: { select: { id: true, name: true } } } },
      _count: { select: { updates: true, pitchFeedback: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getIncubatorProject(projectId: string) {
  await requireAuth();
  return prisma.incubatorProject.findUnique({
    where: { id: projectId },
    include: {
      student: { select: { id: true, name: true, level: true, email: true } },
      cohort: true,
      mentors: { include: { mentor: { select: { id: true, name: true } } } },
      updates: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      pitchFeedback: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getAllIncubatorProjects(cohortId?: string) {
  await requireAuth();
  return prisma.incubatorProject.findMany({
    where: cohortId ? { cohortId } : {},
    include: {
      student: { select: { id: true, name: true, level: true } },
      cohort: { select: { id: true, name: true } },
      mentors: { include: { mentor: { select: { name: true } } } },
      _count: { select: { updates: true, pitchFeedback: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function advancePhase(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");
  if (project.studentId !== session.user.id) throw new Error("Not your project");

  const phases: string[] = ["IDEATION", "PLANNING", "BUILDING", "FEEDBACK", "POLISHING", "SHOWCASE"];
  const currentIdx = phases.indexOf(project.currentPhase);
  if (currentIdx >= phases.length - 1) throw new Error("Already at final phase");

  const nextPhase = phases[currentIdx + 1];
  const completionField = `${project.currentPhase.toLowerCase()}Complete`;

  await prisma.incubatorProject.update({
    where: { id: projectId },
    data: {
      currentPhase: nextPhase as any,
      [completionField]: true,
    },
  });

  // Award XP for phase completion
  const phaseXp: Record<string, number> = {
    IDEATION: 25, PLANNING: 30, BUILDING: 50, FEEDBACK: 20, POLISHING: 30, SHOWCASE: 75,
  };
  await awardXp(session.user.id, phaseXp[project.currentPhase] || 25, "incubator_phase_complete", {
    projectId,
    phase: project.currentPhase,
  });

  revalidatePath(`/incubator/project/${projectId}`);
  revalidatePath("/incubator");
}

export async function updateProjectShowcase(projectId: string, formData: FormData) {
  const session = await requireAuth();

  const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
  if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

  const pitchVideoUrl = formData.get("pitchVideoUrl") as string || null;
  const pitchDeckUrl = formData.get("pitchDeckUrl") as string || null;
  const finalShowcaseUrl = formData.get("finalShowcaseUrl") as string || null;

  await prisma.incubatorProject.update({
    where: { id: projectId },
    data: { pitchVideoUrl, pitchDeckUrl, finalShowcaseUrl },
  });

  revalidatePath(`/incubator/project/${projectId}`);
}

// ============================================
// UPDATES / CHECK-INS
// ============================================

export async function postUpdate(projectId: string, formData: FormData) {
  const session = await requireAuth();

  const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
  if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const phase = project.currentPhase;
  const hoursSpent = parseFloat(formData.get("hoursSpent") as string) || null;
  const mediaUrlsRaw = formData.get("mediaUrls") as string;
  const mediaUrls = mediaUrlsRaw ? mediaUrlsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

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

  await awardXp(session.user.id, 10, "incubator_update", { projectId });

  revalidatePath(`/incubator/project/${projectId}`);
  return update;
}

// ============================================
// MENTOR ASSIGNMENT (Admin)
// ============================================

export async function assignMentor(projectId: string, mentorId: string, role?: string) {
  await requireAuth();

  const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  await prisma.incubatorMentor.create({
    data: {
      cohortId: project.cohortId,
      projectId,
      mentorId,
      role: role || "MENTOR",
    },
  });

  revalidatePath(`/incubator/project/${projectId}`);
  revalidatePath("/admin/incubator");
}

export async function removeMentor(assignmentId: string) {
  await requireAuth();
  await prisma.incubatorMentor.delete({ where: { id: assignmentId } });
  revalidatePath("/admin/incubator");
}

export async function getAvailableMentors() {
  await requireAuth();
  return prisma.user.findMany({
    where: {
      OR: [
        { primaryRole: "INSTRUCTOR" },
        { primaryRole: "MENTOR" },
        { roles: { some: { role: { in: ["INSTRUCTOR", "MENTOR"] } } } },
      ],
    },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
  });
}

// ============================================
// PITCH FEEDBACK
// ============================================

export async function submitPitchFeedback(projectId: string, formData: FormData) {
  const session = await requireAuth();

  const clarityScore = parseInt(formData.get("clarityScore") as string) || null;
  const passionScore = parseInt(formData.get("passionScore") as string) || null;
  const executionScore = parseInt(formData.get("executionScore") as string) || null;
  const impactScore = parseInt(formData.get("impactScore") as string) || null;
  const scores = [clarityScore, passionScore, executionScore, impactScore].filter(Boolean) as number[];
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const strengths = formData.get("strengths") as string || null;
  const improvements = formData.get("improvements") as string || null;
  const encouragement = formData.get("encouragement") as string || null;

  const feedback = await prisma.pitchFeedback.create({
    data: {
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

  revalidatePath(`/incubator/project/${projectId}`);
  return feedback;
}

// ============================================
// RESOURCE REQUESTS (Uses existing model)
// ============================================

export async function getProjectResourceRequests(projectId: string) {
  await requireAuth();
  const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  return prisma.resourceRequest.findMany({
    where: { projectId: project.projectTrackerId || undefined, studentId: project.studentId },
    orderBy: { requestedAt: "desc" },
  });
}

export async function requestResource(formData: FormData) {
  const session = await requireAuth();

  const projectId = formData.get("incubatorProjectId") as string;
  const project = await prisma.incubatorProject.findUnique({ where: { id: projectId } });
  if (!project || project.studentId !== session.user.id) throw new Error("Not your project");

  const itemName = formData.get("itemName") as string;
  const description = formData.get("description") as string;
  const reason = formData.get("reason") as string;
  const estimatedCost = parseFloat(formData.get("estimatedCost") as string) || null;

  if (!itemName || !description || !reason) throw new Error("All fields required");

  return prisma.resourceRequest.create({
    data: {
      studentId: session.user.id,
      projectId: project.projectTrackerId,
      passionId: project.passionArea,
      itemName,
      description,
      reason,
      estimatedCost,
      status: "PENDING",
    },
  });
}

// ============================================
// STATS & OVERVIEW
// ============================================

export async function getIncubatorStats() {
  await requireAuth();

  const [totalProjects, activeProjects, totalUpdates, showcaseReady] = await Promise.all([
    prisma.incubatorProject.count(),
    prisma.incubatorProject.count({ where: { currentPhase: { not: "SHOWCASE" } } }),
    prisma.incubatorUpdate.count(),
    prisma.incubatorProject.count({ where: { showcaseComplete: true } }),
  ]);

  return { totalProjects, activeProjects, totalUpdates, showcaseReady };
}
