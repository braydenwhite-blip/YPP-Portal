"use server";

// Class Runtime OS (Phase 5) — the post-session reflection workflow. It is more
// than a text box: a reflection that raises a concern (instructor needs CP help,
// or a logistics problem) surfaces to the Chapter President as a real,
// deduped ActionItem; completion clears the class's "reflection due" state; and
// the entry feeds Recent Activity. Permission-safe (same rule as attendance) and
// idempotent (upsert by session).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SubmitReflectionSchema, reflectionRaisesConcern } from "@/lib/classes/reflection";
import { requireTeachingSessionAccess } from "@/lib/classes/instructor-access";
import { sessionDateTime } from "@/lib/classes/instructor-state";
import { canTeachOffering } from "@/lib/classes/instructor-access";
import { upsertInstructorRequestedStudentFollowUp } from "@/lib/classes/student-follow-up-records";

export type ReflectionResult = { ok: true } | { ok: false; error: string };

export async function submitSessionReflection(input: unknown): Promise<ReflectionResult> {
  const parsed = SubmitReflectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  let access;
  try {
    access = await requireTeachingSessionAccess(data.sessionId, data.offeringId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unauthorized" };
  }
  const { viewer, classSession } = access;
  if (classSession.isCancelled) return { ok: false, error: "A cancelled session does not need a recap" };
  const startsAt = sessionDateTime(classSession.date, classSession.startTime, classSession.offering.timezone);
  const rawEnd = sessionDateTime(classSession.date, classSession.endTime, classSession.offering.timezone);
  const endsAt = rawEnd.getTime() > startsAt.getTime()
    ? rawEnd
    : new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000);
  if (Date.now() < endsAt.getTime()) {
    return { ok: false, error: "Submit the recap after the session ends" };
  }

  const expectedRoster = await prisma.classEnrollment.findMany({
      where: {
        offeringId: data.offeringId,
        status: { not: "WAITLISTED" },
        enrolledAt: { lte: endsAt },
        OR: [{ droppedAt: null }, { droppedAt: { gt: startsAt } }],
      },
      select: { studentId: true },
    });
  const attendanceRecorded = expectedRoster.length > 0
    ? await prisma.classAttendanceRecord.count({
        where: {
          sessionId: data.sessionId,
          studentId: { in: expectedRoster.map((enrollment) => enrollment.studentId) },
        },
      })
    : 0;
  if (expectedRoster.length > 0 && attendanceRecorded < expectedRoster.length) {
    return {
      ok: false,
      error: `Finish attendance first (${attendanceRecorded} of ${expectedRoster.length} students recorded)`,
    };
  }

  let followUpStudent: { student: { name: string | null } } | null = null;
  if (data.followUpStudentId) {
    if (!(await canTeachOffering(viewer.id, data.offeringId))) {
      return { ok: false, error: "Only an assigned instructor can create a student follow-up" };
    }
    followUpStudent = await prisma.classEnrollment.findUnique({
      where: {
        studentId_offeringId: {
          studentId: data.followUpStudentId,
          offeringId: data.offeringId,
        },
      },
      select: { student: { select: { name: true } } },
    });
    if (!followUpStudent) {
      return { ok: false, error: "That student is not connected to this class" };
    }
  }

  const clean = (s?: string) => (s && s.trim() ? s.trim() : null);
  const payload = {
    offeringId: data.offeringId,
    instructorId: viewer.id,
    instructorName: viewer.name ?? viewer.email ?? null,
    wentWell: clean(data.wentWell),
    struggled: clean(data.struggled),
    studentToWatch: clean(data.studentToWatch),
    changeNextTime: clean(data.changeNextTime),
    logisticsIssue: clean(data.logisticsIssue),
    needsCpHelp: Boolean(data.needsCpHelp),
    confidence: data.confidence ?? null,
  };

  try {
    await prisma.classSessionReflection.upsert({
      where: { sessionId: data.sessionId },
      create: { sessionId: data.sessionId, ...payload },
      update: payload,
    });
  } catch {
    return { ok: false, error: "Could not save the reflection" };
  }

  if (data.followUpStudentId && followUpStudent && payload.struggled) {
    try {
      await upsertInstructorRequestedStudentFollowUp({
        offeringId: data.offeringId,
        sessionId: data.sessionId,
        studentId: data.followUpStudentId,
        studentName: followUpStudent.student.name,
        className: classSession.offering.title,
        chapterId: classSession.offering.chapterId,
        instructorId: viewer.id,
        reason: payload.struggled,
      });
    } catch {
      return { ok: false, error: "The recap was saved, but the student follow-up could not be created" };
    }
  }

  // Concern → one deduped, chapter-scoped ActionItem. A failed handoff is
  // reported explicitly so the instructor is never told leadership was
  // notified when no real request exists.
  if (reflectionRaisesConcern(payload)) {
    if (!classSession.offering.chapterId) {
      return {
        ok: false,
        error: "The recap was saved, but this class has no chapter to receive the help request",
      };
    }
    const chapterId = classSession.offering.chapterId;
    const sourceId = `reflection-concern:${data.sessionId}`;
    try {
      const existing = await prisma.actionItem.findFirst({
        where: { chapterId, sourceId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "OVERDUE", "BLOCKED"] } },
        select: { id: true },
      });
      if (!existing) {
        const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { presidentId: true } });
        const leadId = chapter?.presidentId ?? viewer.id;
        await prisma.actionItem.create({
          data: {
            title: `${classSession.offering.title}: ${payload.needsCpHelp ? "instructor requested help" : "logistics issue flagged"}`,
            description: payload.needsCpHelp
              ? payload.struggled ?? "Instructor requested CP help in a session reflection."
              : `Logistics issue: ${payload.logisticsIssue}`,
            goalCategory: "Class runtime",
            leadId,
            createdById: viewer.id,
            status: "NOT_STARTED",
            priority: "MEDIUM",
            visibility: "ALL_LEADERSHIP",
            deadlineStart: new Date(),
            chapterId,
            sourceType: "ENTITY",
            sourceId,
            relatedEntityType: "CLASS_OFFERING",
            relatedEntityId: data.offeringId,
            assignments: { create: [{ userId: leadId, role: "LEAD" }, { userId: leadId, role: "EXECUTING" }] },
          },
        });
      }
    } catch {
      return {
        ok: false,
        error: "The recap was saved, but the leadership follow-up could not be created",
      };
    }
  }

  revalidatePath(`/instructor/classes/${data.offeringId}`);
  revalidatePath("/instructor/classes");
  revalidatePath("/chapter");
  return { ok: true };
}
