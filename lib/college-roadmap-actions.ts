"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { CollegeStage } from "@prisma/client";
import { STAGE_ORDER, STAGE_CONFIG } from "@/lib/college-roadmap-config";

const TASK_TEMPLATES: Record<CollegeStage, { title: string; description: string; category: string; isRequired: boolean }[]> = {
  EXPLORING: [
    { title: "Take a career interests assessment", description: "Complete a personality/interest quiz (e.g., Myers-Briggs, Holland Code)", category: "Research", isRequired: true },
    { title: "Research 5 potential career paths", description: "Explore what education each path requires", category: "Research", isRequired: true },
    { title: "Meet with YPP College Advisor", description: "Schedule an intro meeting with your assigned college advisor", category: "Research", isRequired: true },
    { title: "Visit a college campus (virtual or in-person)", description: "Get a feel for college life and environment", category: "Visits", isRequired: false },
    { title: "Shadow a professional in a field of interest", description: "Arrange job shadow through YPP alumni network", category: "Research", isRequired: false },
  ],
  BUILDING_PROFILE: [
    { title: "Join 2-3 extracurricular activities", description: "Choose activities that align with your interests and show commitment", category: "Research", isRequired: true },
    { title: "Take a leadership role in at least one activity", description: "Officer, captain, or team lead positions strengthen applications", category: "Research", isRequired: true },
    { title: "Volunteer 50+ hours in community service", description: "Document all service hours for college applications", category: "Research", isRequired: false },
    { title: "Identify teachers for recommendation letters", description: "Build relationships with 2-3 teachers who know you well", category: "Research", isRequired: true },
    { title: "Maintain GPA above 3.0", description: "Monitor academic performance each semester", category: "Academic", isRequired: true },
    { title: "Complete the PSAT", description: "Practice for SAT and compete for National Merit Scholarship", category: "Testing", isRequired: false },
  ],
  TEST_PREP: [
    { title: "Research SAT vs. ACT format", description: "Take a practice test for both to determine which is better for you", category: "Testing", isRequired: true },
    { title: "Create a 3-month study plan", description: "Schedule 30+ minutes of test prep per day", category: "Testing", isRequired: true },
    { title: "Take official SAT or ACT (first attempt)", description: "Register at least 6 weeks in advance", category: "Testing", isRequired: true },
    { title: "Review results and target improvement areas", description: "Focus additional prep on weakest sections", category: "Testing", isRequired: false },
    { title: "Take SAT/ACT a second time if needed", description: "Most students improve on second attempt", category: "Testing", isRequired: false },
    { title: "Research test-optional policies", description: "Know which target schools require or recommend scores", category: "Research", isRequired: false },
  ],
  COLLEGE_LIST: [
    { title: "Research 15-20 colleges", description: "Vary by selectivity: 3 reaches, 5 targets, 5 likely, 2+ safety schools", category: "Research", isRequired: true },
    { title: "Create a comparison spreadsheet", description: "Track location, cost, majors, acceptance rate, financial aid", category: "Research", isRequired: true },
    { title: "Attend college fairs", description: "Virtual or in-person — great for gathering information", category: "Visits", isRequired: false },
    { title: "Schedule campus visits for top 5 schools", description: "Visit before applying if possible to confirm fit", category: "Visits", isRequired: false },
    { title: "Finalize application list (10-12 colleges)", description: "Balance ambition with strategy", category: "Research", isRequired: true },
    { title: "Research honors programs and scholarships", description: "Note merit aid requirements for each school", category: "Financial", isRequired: false },
  ],
  APPLICATIONS: [
    { title: "Create Common App / Coalition App account", description: "Most schools use one of these platforms", category: "Essays", isRequired: true },
    { title: "Write Common App personal statement", description: "650-word essay — start early, multiple drafts", category: "Essays", isRequired: true },
    { title: "Request recommendation letters", description: "Ask teachers and counselor at least 6 weeks in advance", category: "Essays", isRequired: true },
    { title: "Complete supplemental essays", description: "\"Why this college\" essays for each school", category: "Essays", isRequired: true },
    { title: "Submit Early Action/Early Decision applications", description: "Deadline typically Nov 1-15 — higher acceptance rates", category: "Essays", isRequired: false },
    { title: "Review applications with college advisor", description: "Get feedback before submitting", category: "Essays", isRequired: true },
    { title: "Submit all remaining applications by Jan 1", description: "Regular decision deadline is usually Jan 1-15", category: "Essays", isRequired: true },
    { title: "Send official test scores and transcripts", description: "Request from your school counselor", category: "Academic", isRequired: true },
  ],
  FINANCIAL_AID: [
    { title: "Complete FAFSA on October 1 (earliest date)", description: "Opens October 1 each year — file ASAP for best aid", category: "Financial", isRequired: true },
    { title: "Complete CSS Profile if required", description: "Some private schools require this additional form", category: "Financial", isRequired: false },
    { title: "Research and apply for 5+ scholarships", description: "Use Scholarship.com, Fastweb, local foundations", category: "Financial", isRequired: true },
    { title: "Compare financial aid packages", description: "Once acceptances arrive, compare net cost at each school", category: "Financial", isRequired: true },
    { title: "Appeal financial aid if needed", description: "You can negotiate — especially if you have competing offers", category: "Financial", isRequired: false },
  ],
  DECISION: [
    { title: "Create pros/cons list for top 3 schools", description: "Academic fit, social fit, cost, location, career resources", category: "Research", isRequired: true },
    { title: "Attend admitted students day at top choices", description: "Meet current students and faculty before deciding", category: "Visits", isRequired: false },
    { title: "Make final decision and submit enrollment deposit", description: "Deadline is typically May 1 (National Decision Day)", category: "Research", isRequired: true },
    { title: "Notify other colleges of your decision", description: "Decline other acceptances politely", category: "Research", isRequired: true },
    { title: "Request final transcript be sent", description: "Your school counselor sends this after graduation", category: "Academic", isRequired: true },
  ],
  TRANSITION: [
    { title: "Complete housing application and roommate survey", description: "Apply early for best housing options", category: "Research", isRequired: true },
    { title: "Register for orientation", description: "Usually required; confirms your enrollment", category: "Research", isRequired: true },
    { title: "Connect with future roommate", description: "Reach out on social media, coordinate what to bring", category: "Research", isRequired: false },
    { title: "Research AP/dual enrollment credit transfer", description: "Know which credits will transfer to save time and money", category: "Academic", isRequired: false },
    { title: "Set up student email and portal accounts", description: "Access course registration and financial aid info", category: "Research", isRequired: true },
    { title: "Attend YPP Alumni networking event", description: "Connect with YPP alumni at or near your college", category: "Research", isRequired: false },
    { title: "Create a college budget", description: "Plan for tuition, housing, food, books, and personal expenses", category: "Financial", isRequired: true },
  ],
};

// ============================================
// FETCH
// ============================================

export async function getMyRoadmap() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  const roadmap = await prisma.collegeReadinessRoadmap.findUnique({
    where: { userId },
    include: {
      tasks: {
        orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  return roadmap;
}

/**
 * Get roadmap data enriched with stage config and progress.
 */
export async function getMyRoadmapData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  let roadmap = await prisma.collegeReadinessRoadmap.findUnique({
    where: { userId },
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  // Auto-create roadmap if it doesn't exist
  if (!roadmap) {
    roadmap = await prisma.collegeReadinessRoadmap.create({
      data: {
        userId,
        currentStage: "EXPLORING",
        tasks: {
          create: TASK_TEMPLATES.EXPLORING.map((t, i) => ({ ...t, stage: "EXPLORING" as CollegeStage, sortOrder: i })),
        },
      },
      include: { tasks: { orderBy: [{ sortOrder: "asc" }] } },
    });
  }

  // Compute per-stage progress
  const stageProgress = STAGE_ORDER.map((stage) => {
    const stageTasks = roadmap!.tasks.filter((t) => t.stage === stage);
    const completed = stageTasks.filter((t) => t.completedAt !== null).length;
    return {
      stage,
      ...STAGE_CONFIG[stage],
      total: stageTasks.length,
      completed,
      percentComplete: stageTasks.length > 0 ? Math.round((completed / stageTasks.length) * 100) : 0,
      isCurrentStage: stage === roadmap!.currentStage,
      isUnlocked: STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf(roadmap!.currentStage),
    };
  });

  return {
    id: roadmap.id,
    currentStage: roadmap.currentStage,
    currentStageConfig: STAGE_CONFIG[roadmap.currentStage],
    graduationYear: roadmap.graduationYear,
    dreamColleges: roadmap.dreamColleges,
    intendedMajors: roadmap.intendedMajors,
    tasks: roadmap.tasks.map((t) => ({
      id: t.id,
      stage: t.stage,
      stageConfig: STAGE_CONFIG[t.stage],
      title: t.title,
      description: t.description,
      category: t.category,
      isRequired: t.isRequired,
      completedAt: t.completedAt?.toISOString() ?? null,
      dueDate: t.dueDate?.toISOString() ?? null,
      notes: t.notes,
      sortOrder: t.sortOrder,
    })),
    stageProgress,
    overallProgress: Math.round(
      (roadmap.tasks.filter((t) => t.completedAt !== null).length / Math.max(roadmap.tasks.length, 1)) * 100
    ),
  };
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Toggle a task's completion status.
 */
export async function toggleRoadmapTask(taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;

  const task = await prisma.collegeRoadmapTask.findUnique({
    where: { id: taskId },
    include: { roadmap: { select: { userId: true } } },
  });

  if (!task) throw new Error("Task not found");
  if (task.roadmap.userId !== userId) throw new Error("Unauthorized");

  await prisma.collegeRoadmapTask.update({
    where: { id: taskId },
    data: { completedAt: task.completedAt ? null : new Date() },
  });

  revalidatePath("/college-advisor/roadmap");
}

/**
 * Add a custom task to the roadmap.
 */
export async function addRoadmapTask(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const stageRaw = String(formData.get("stage") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "Research").trim();
  const dueDateRaw = formData.get("dueDate");

  if (!title) throw new Error("Title is required");
  if (!Object.values(CollegeStage).includes(stageRaw as CollegeStage)) {
    throw new Error("Invalid stage");
  }

  const roadmap = await prisma.collegeReadinessRoadmap.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!roadmap) throw new Error("Roadmap not found");

  await prisma.collegeRoadmapTask.create({
    data: {
      roadmapId: roadmap.id,
      stage: stageRaw as CollegeStage,
      title,
      description: description || null,
      category,
      dueDate: dueDateRaw ? new Date(String(dueDateRaw)) : null,
      isRequired: false,
    },
  });

  revalidatePath("/college-advisor/roadmap");
  return { success: true };
}

/**
 * Update task notes.
 */
export async function updateTaskNotes(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const taskId = String(formData.get("taskId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const task = await prisma.collegeRoadmapTask.findUnique({
    where: { id: taskId },
    include: { roadmap: { select: { userId: true } } },
  });

  if (!task || task.roadmap.userId !== userId) throw new Error("Not found");

  await prisma.collegeRoadmapTask.update({
    where: { id: taskId },
    data: { notes: notes || null },
  });

  revalidatePath("/college-advisor/roadmap");
  return { success: true };
}

/**
 * Advance the user to the next stage, loading template tasks for that stage.
 */
export async function advanceRoadmapStage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;

  const roadmap = await prisma.collegeReadinessRoadmap.findUnique({
    where: { userId },
    select: { id: true, currentStage: true },
  });

  if (!roadmap) throw new Error("Roadmap not found");

  const currentIdx = STAGE_ORDER.indexOf(roadmap.currentStage);
  if (currentIdx >= STAGE_ORDER.length - 1) throw new Error("Already at final stage");

  const nextStage = STAGE_ORDER[currentIdx + 1];
  const templates = TASK_TEMPLATES[nextStage] ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.collegeReadinessRoadmap.update({
      where: { id: roadmap.id },
      data: { currentStage: nextStage },
    });

    if (templates.length > 0) {
      await tx.collegeRoadmapTask.createMany({
        data: templates.map((t, i) => ({
          roadmapId: roadmap.id,
          ...t,
          stage: nextStage,
          sortOrder: i,
          isTemplate: true,
        })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/college-advisor/roadmap");
  return { success: true, newStage: nextStage };
}

/**
 * Update roadmap profile info (graduation year, dream colleges, majors).
 */
export async function updateRoadmapProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const graduationYearRaw = formData.get("graduationYear");
  const graduationYear = graduationYearRaw ? parseInt(String(graduationYearRaw), 10) : null;
  const dreamColleges = formData
    .getAll("dreamColleges")
    .map(String)
    .filter(Boolean);
  const intendedMajors = formData
    .getAll("intendedMajors")
    .map(String)
    .filter(Boolean);

  const roadmap = await prisma.collegeReadinessRoadmap.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!roadmap) throw new Error("Roadmap not found");

  await prisma.collegeReadinessRoadmap.update({
    where: { id: roadmap.id },
    data: {
      graduationYear: graduationYear ?? undefined,
      dreamColleges,
      intendedMajors,
    },
  });

  revalidatePath("/college-advisor/roadmap");
  return { success: true };
}
