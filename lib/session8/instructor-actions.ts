"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { requireInstructorAssigned, canPublishAnnouncement, type Session4Actor } from "@/lib/operational-permissions";
import { issueClassCompletionCertificate } from "@/lib/session8/certificates";
import { upsertAnnouncement, publishAnnouncement } from "@/lib/class-announcement-service";

async function actorFor(user: { id: string; roles: string[] }): Promise<Session4Actor> {
  const full = await prisma.user.findUnique({ where: { id: user.id }, select: { chapterId: true } });
  return { userId: user.id, roles: user.roles, chapterIds: full?.chapterId ? [full.chapterId] : [] };
}

/* ------------------------------------------------------------------ */
/* Task 2: class completion + certificates                            */
/* ------------------------------------------------------------------ */

const CompleteClassSchema = z.object({ offeringId: z.string().min(1) });

export type CompleteClassResult =
  | { ok: true; completedCount: number; certificatesIssued: number; certificatesUnavailable: boolean }
  | { ok: false; error: string };

export async function completeClassAndIssueCertificates(formData: FormData): Promise<CompleteClassResult> {
  const user = await requireSessionUser();
  const input = CompleteClassSchema.parse({ offeringId: String(formData.get("offeringId") ?? "") });
  const actor = await actorFor(user);
  await requireInstructorAssigned(actor, input.offeringId);

  const offering = await prisma.classOffering.findUnique({
    where: { id: input.offeringId },
    include: { sessions: true, enrollments: true },
  });
  if (!offering) return { ok: false, error: "Class not found." };

  const lastSessionDate = offering.sessions.reduce((max: Date | null, s: any) => (!max || new Date(s.date) > max ? new Date(s.date) : max), null as Date | null);
  if (!lastSessionDate || lastSessionDate >= new Date()) {
    return { ok: false, error: "This class hasn't ended yet — completion is available after the last session date." };
  }

  const activeEnrollments = offering.enrollments.filter((e: any) => e.status === "ENROLLED");
  if (activeEnrollments.length === 0 && offering.enrollments.every((e: any) => e.status !== "COMPLETED")) {
    return { ok: false, error: "No enrolled students to complete." };
  }

  const completedIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const e of activeEnrollments) {
      await tx.classEnrollment.update({ where: { id: e.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      completedIds.push(e.studentId);
    }
  });

  const alreadyCompletedIds = offering.enrollments.filter((e: any) => e.status === "COMPLETED").map((e: any) => e.studentId);
  const allCompletedStudentIds = Array.from(new Set([...completedIds, ...alreadyCompletedIds]));

  let certificatesIssued = 0;
  let certificatesUnavailable = false;
  for (const studentId of allCompletedStudentIds) {
    try {
      await issueClassCompletionCertificate(input.offeringId, studentId, user.id);
      certificatesIssued++;
    } catch (err: any) {
      if (String(err?.message ?? "").includes("No active course-completion certificate template")) {
        certificatesUnavailable = true;
      }
    }
  }

  revalidatePath(`/instructor/classes/${input.offeringId}`);
  revalidatePath(`/student/classes/${input.offeringId}`);

  return { ok: true, completedCount: completedIds.length, certificatesIssued, certificatesUnavailable };
}

/* ------------------------------------------------------------------ */
/* Task 2: instructor -> family feedback                              */
/* ------------------------------------------------------------------ */

const UpsertFeedbackSchema = z.object({
  offeringId: z.string().min(1),
  studentId: z.string().min(1),
  body: z.string().min(1).max(4000),
  strengths: z.string().max(2000).optional(),
  growthAreas: z.string().max(2000).optional(),
});

export async function upsertInstructorStudentFeedback(formData: FormData) {
  const user = await requireSessionUser();
  const input = UpsertFeedbackSchema.parse({
    offeringId: String(formData.get("offeringId") ?? ""),
    studentId: String(formData.get("studentId") ?? ""),
    body: String(formData.get("body") ?? ""),
    strengths: String(formData.get("strengths") ?? "") || undefined,
    growthAreas: String(formData.get("growthAreas") ?? "") || undefined,
  });
  const actor = await actorFor(user);
  await requireInstructorAssigned(actor, input.offeringId);

  const enrolled = await prisma.classEnrollment.findFirst({ where: { offeringId: input.offeringId, studentId: input.studentId } });
  if (!enrolled) throw new Error("Student is not enrolled in this class.");

  const existing = await (prisma as any).instructorStudentFeedback.findFirst({ where: { offeringId: input.offeringId, studentId: input.studentId, instructorId: user.id } });
  if (existing) {
    await (prisma as any).instructorStudentFeedback.update({ where: { id: existing.id }, data: { body: input.body, strengths: input.strengths, growthAreas: input.growthAreas } });
  } else {
    await (prisma as any).instructorStudentFeedback.create({ data: { offeringId: input.offeringId, studentId: input.studentId, instructorId: user.id, body: input.body, strengths: input.strengths, growthAreas: input.growthAreas } });
  }

  revalidatePath(`/instructor/classes/${input.offeringId}`);
}

const ReleaseFeedbackSchema = z.object({ feedbackId: z.string().min(1) });

export async function releaseInstructorFeedback(formData: FormData) {
  const user = await requireSessionUser();
  const input = ReleaseFeedbackSchema.parse({ feedbackId: String(formData.get("feedbackId") ?? "") });
  const feedback = await (prisma as any).instructorStudentFeedback.findUnique({ where: { id: input.feedbackId } });
  if (!feedback) throw new Error("Feedback not found.");
  const actor = await actorFor(user);
  await requireInstructorAssigned(actor, feedback.offeringId);

  await (prisma as any).instructorStudentFeedback.update({ where: { id: input.feedbackId }, data: { releasedToFamilyAt: new Date() } });
  revalidatePath(`/instructor/classes/${feedback.offeringId}`);
}

/* ------------------------------------------------------------------ */
/* Task 4: instructor follow-ups                                      */
/* ------------------------------------------------------------------ */

const CreateFollowUpSchema = z.object({
  sessionId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export async function createInstructorFollowUp(formData: FormData) {
  const user = await requireSessionUser();
  const input = CreateFollowUpSchema.parse({
    sessionId: String(formData.get("sessionId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    priority: (String(formData.get("priority") ?? "MEDIUM") as any) || "MEDIUM",
  });

  const session = await prisma.classSession.findUnique({ where: { id: input.sessionId }, include: { offering: { select: { id: true, title: true } } } });
  if (!session) throw new Error("Session not found.");
  const actor = await actorFor(user);
  await requireInstructorAssigned(actor, session.offeringId);

  const description = [
    input.description,
    `Class: ${session.offering.title}`,
    `Session date: ${new Date(session.date).toISOString().slice(0, 10)}`,
  ].filter(Boolean).join("\n");

  await (prisma as any).actionItem.create({
    data: {
      title: input.title,
      description,
      status: "NOT_STARTED",
      priority: input.priority,
      deadlineStart: new Date(),
      leadId: user.id,
      createdById: user.id,
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: session.offeringId,
      sourceType: "FOLLOW_UP",
    },
  });

  revalidatePath("/instructor");
  revalidatePath(`/instructor/classes/${session.offeringId}`);
  revalidatePath(`/instructor/classes/${session.offeringId}/sessions/${input.sessionId}`);
}

const ResolveFollowUpSchema = z.object({ actionItemId: z.string().min(1) });

export async function resolveInstructorFollowUp(formData: FormData) {
  const user = await requireSessionUser();
  const input = ResolveFollowUpSchema.parse({ actionItemId: String(formData.get("actionItemId") ?? "") });
  const item = await (prisma as any).actionItem.findUnique({ where: { id: input.actionItemId } });
  if (!item) throw new Error("Follow-up not found.");
  if (item.leadId !== user.id) throw new Error("Only the owner can resolve this follow-up.");

  await (prisma as any).actionItem.update({ where: { id: input.actionItemId }, data: { status: "COMPLETE", completedAt: new Date() } });
  revalidatePath("/instructor");
}

/* ------------------------------------------------------------------ */
/* Task 5: instructor announcements                                   */
/* ------------------------------------------------------------------ */

const UpsertClassAnnouncementSchema = z.object({
  offeringId: z.string().min(1),
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  announcementType: z.string().min(1),
});

export async function upsertClassAnnouncement(formData: FormData) {
  const user = await requireSessionUser();
  const input = UpsertClassAnnouncementSchema.parse({
    offeringId: String(formData.get("offeringId") ?? ""),
    id: String(formData.get("id") ?? "") || undefined,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    announcementType: String(formData.get("announcementType") ?? "ROUTINE"),
  });
  const actor = await actorFor(user);
  const row = await upsertAnnouncement(actor, input.offeringId, {
    id: input.id,
    title: input.title,
    body: input.body,
    announcementType: input.announcementType,
    audience: "ADMITTED_FAMILIES",
    status: "DRAFT",
  });

  const canPublishNow = canPublishAnnouncement(actor.roles, input.announcementType);
  if (canPublishNow) {
    await publishAnnouncement(actor, row.id);
  }

  revalidatePath(`/instructor/classes/${input.offeringId}`);
  return { ok: true, published: canPublishNow };
}

/* ------------------------------------------------------------------ */
/* Task 6: attendance review requests                                 */
/* ------------------------------------------------------------------ */

const RespondToReviewSchema = z.object({
  requestId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export async function respondToAttendanceReview(formData: FormData) {
  const user = await requireSessionUser();
  const input = RespondToReviewSchema.parse({
    requestId: String(formData.get("requestId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });

  const request = await (prisma as any).familySupportRequest.findUnique({ where: { id: input.requestId }, select: { id: true, offeringId: true, category: true } });
  if (!request || request.category !== "ATTENDANCE" || !request.offeringId) throw new Error("Attendance review request not found.");
  const actor = await actorFor(user);
  await requireInstructorAssigned(actor, request.offeringId);

  await (prisma as any).familySupportResponse.create({
    data: {
      requestId: input.requestId,
      authorUserId: user.id,
      body: input.body,
      responseType: "FAMILY_VISIBLE",
      familyVisible: true,
    },
  });

  revalidatePath(`/instructor/classes/${request.offeringId}`);
}
