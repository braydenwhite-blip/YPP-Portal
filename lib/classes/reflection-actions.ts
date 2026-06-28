"use server";

// Class Runtime OS (Phase 5) — the post-session reflection workflow. It is more
// than a text box: a reflection that raises a concern (instructor needs CP help,
// or a logistics problem) surfaces to the Chapter President as a real,
// deduped ActionItem; completion clears the class's "reflection due" state; and
// the entry feeds Recent Activity. Permission-safe (same rule as attendance) and
// idempotent (upsert by session).

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { canManageClassAttendance } from "@/lib/classes/attendance";
import { SubmitReflectionSchema, reflectionRaisesConcern } from "@/lib/classes/reflection";

const CONFIRMED_RIA = ["INSTRUCTOR_CONFIRMED", "CHAPTER_CONFIRMED", "FULLY_CONFIRMED"];

export type ReflectionResult = { ok: true } | { ok: false; error: string };

export async function submitSessionReflection(input: unknown): Promise<ReflectionResult> {
  const parsed = SubmitReflectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  let viewer;
  try {
    viewer = await requireSessionUser();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const classSession = await prisma.classSession.findUnique({
    where: { id: data.sessionId },
    select: { offeringId: true, offering: { select: { instructorId: true, chapterId: true, title: true } } },
  });
  if (!classSession || classSession.offeringId !== data.offeringId) {
    return { ok: false, error: "Session not found for this class" };
  }

  const chapterCtx = await getChapterViewerContext();
  const coInstructor = await prisma.regularInstructorAssignment.findFirst({
    where: { offeringId: data.offeringId, instructorId: viewer.id, status: { in: CONFIRMED_RIA } },
    select: { id: true },
  });
  const allowed = canManageClassAttendance(
    { id: viewer.id, roles: viewer.roles },
    { instructorId: classSession.offering.instructorId, chapterId: classSession.offering.chapterId },
    {
      isConfirmedCoInstructor: Boolean(coInstructor),
      managesChapter:
        chapterCtx.isLeadership ||
        (chapterCtx.ledChapterId != null && chapterCtx.ledChapterId === classSession.offering.chapterId),
    }
  );
  if (!allowed) return { ok: false, error: "You can't reflect on this class" };

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

  // Concern → a deduped, chapter-scoped ActionItem the CP will see (best-effort,
  // never blocks the reflection). Mirrors lib/chapters/operating-actions.ts.
  if (reflectionRaisesConcern(payload) && classSession.offering.chapterId) {
    const chapterId = classSession.offering.chapterId;
    const sourceId = `reflection-concern:${data.sessionId}`;
    try {
      const existing = await prisma.actionItem.findFirst({
        where: { chapterId, sourceId, status: { not: "COMPLETE" } },
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
      // best-effort
    }
  }

  revalidatePath(`/instructor/classes/${data.offeringId}`);
  revalidatePath("/instructor/classes");
  revalidatePath("/chapter/operating");
  return { ok: true };
}
