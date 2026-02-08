"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { createSystemNotification } from "@/lib/notification-actions";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ============================================
// Helper: get or create template
// ============================================

async function getOrCreateTemplate(
  type: "COURSE_COMPLETION" | "PATHWAY_COMPLETION" | "TRAINING_COMPLETION",
  name: string
) {
  let template = await prisma.certificateTemplate.findFirst({
    where: { type, isActive: true },
  });

  if (!template) {
    template = await prisma.certificateTemplate.create({
      data: { name, type, isActive: true },
    });
  }

  return template;
}

// ============================================
// CHECK & AUTO-ISSUE COURSE COMPLETION CERT
// ============================================

export async function checkAndIssueCourseCompletion(
  userId: string,
  courseId: string
) {
  // Check enrollment status
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId, status: "COMPLETED" },
  });

  if (!enrollment) return null;

  // Check if already has cert
  const existing = await prisma.certificate.findFirst({
    where: {
      recipientId: userId,
      courseId,
      template: { type: "COURSE_COMPLETION" },
    },
  });

  if (existing) return existing;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return null;

  const template = await getOrCreateTemplate(
    "COURSE_COMPLETION",
    "Course Completion Certificate"
  );

  const certificate = await prisma.certificate.create({
    data: {
      templateId: template.id,
      recipientId: userId,
      courseId,
      title: `${course.title} - Course Completion`,
      description: `Successfully completed ${course.title}`,
    },
  });

  // Notify the user
  await createSystemNotification(
    userId,
    "COURSE_UPDATE",
    "Certificate Earned!",
    `Congratulations! You've earned a certificate for completing ${course.title}.`,
    `/certificates`
  );

  return certificate;
}

// ============================================
// CHECK & AUTO-ISSUE PATHWAY COMPLETION CERT
// ============================================

export async function checkAndIssuePathwayCompletion(
  userId: string,
  pathwayId: string
) {
  // Get all steps in the pathway
  const pathway = await prisma.pathway.findUnique({
    where: { id: pathwayId },
    include: {
      steps: { include: { course: true } },
    },
  });

  if (!pathway || pathway.steps.length === 0) return null;

  // Check if user has completed all courses in the pathway
  const courseIds = pathway.steps.map((s) => s.courseId);
  const completedEnrollments = await prisma.enrollment.findMany({
    where: {
      userId,
      courseId: { in: courseIds },
      status: "COMPLETED",
    },
  });

  if (completedEnrollments.length < courseIds.length) return null;

  // Check if cert already exists
  const existing = await prisma.certificate.findFirst({
    where: {
      recipientId: userId,
      pathwayId,
      template: { type: "PATHWAY_COMPLETION" },
    },
  });

  if (existing) return existing;

  const template = await getOrCreateTemplate(
    "PATHWAY_COMPLETION",
    "Pathway Completion Certificate"
  );

  const certificate = await prisma.certificate.create({
    data: {
      templateId: template.id,
      recipientId: userId,
      pathwayId,
      title: `${pathway.name} - Pathway Completion`,
      description: `Successfully completed the ${pathway.name} pathway`,
    },
  });

  await createSystemNotification(
    userId,
    "COURSE_UPDATE",
    "Pathway Certificate Earned!",
    `Congratulations! You've completed the ${pathway.name} pathway and earned a certificate.`,
    `/certificates`
  );

  return certificate;
}

// ============================================
// CHECK & AUTO-ISSUE TRAINING COMPLETION CERT
// ============================================

export async function checkAndIssueTrainingCompletion(userId: string) {
  // Get all required training modules
  const requiredModules = await prisma.trainingModule.findMany({
    where: { required: true },
    select: { id: true },
  });

  if (requiredModules.length === 0) return null;

  // Check user's completed assignments
  const completedAssignments = await prisma.trainingAssignment.findMany({
    where: {
      userId,
      moduleId: { in: requiredModules.map((m) => m.id) },
      status: "COMPLETE",
    },
  });

  if (completedAssignments.length < requiredModules.length) return null;

  // Check if cert already exists
  const existing = await prisma.certificate.findFirst({
    where: {
      recipientId: userId,
      template: { type: "TRAINING_COMPLETION" },
    },
  });

  if (existing) return existing;

  const template = await getOrCreateTemplate(
    "TRAINING_COMPLETION",
    "Instructor Training Completion"
  );

  const certificate = await prisma.certificate.create({
    data: {
      templateId: template.id,
      recipientId: userId,
      title: "Instructor Training Completion",
      description: "Successfully completed all required instructor training modules",
    },
  });

  await createSystemNotification(
    userId,
    "COURSE_UPDATE",
    "Training Certificate Earned!",
    "Congratulations! You've completed all required training modules and earned your certification.",
    `/certificates`
  );

  return certificate;
}

// ============================================
// MARK ENROLLMENT COMPLETE & AUTO-CERT
// ============================================

export async function markEnrollmentComplete(formData: FormData) {
  await requireAuth();

  const enrollmentId = formData.get("enrollmentId") as string;
  if (!enrollmentId) throw new Error("Missing enrollmentId");

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: { include: { pathwaySteps: true } } },
  });

  if (!enrollment) throw new Error("Enrollment not found");

  // Update enrollment status
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "COMPLETED" },
  });

  // Auto-issue course completion certificate
  await checkAndIssueCourseCompletion(enrollment.userId, enrollment.courseId);

  // Check if this completes any pathways
  for (const step of enrollment.course.pathwaySteps) {
    await checkAndIssuePathwayCompletion(enrollment.userId, step.pathwayId);
  }

  // Check training completion if applicable
  await checkAndIssueTrainingCompletion(enrollment.userId);
}
