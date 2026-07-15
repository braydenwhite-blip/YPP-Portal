"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, requireOfficer } from "@/lib/authorization";
import { requireStudentPortalUser } from "@/lib/family-access";
import { updateSessionReadiness } from "@/lib/session-readiness-service";

const ATTENDANCE_OPEN_STATUSES = ["SENT", "REVIEWING", "NEED_MORE_INFORMATION"] as const;

const SubmitAttendanceIssueSchema = z.object({
  sessionId: z.string().min(1),
  details: z.string().min(1).max(1000),
});

/**
 * A student disputing/requesting review of an attendance record for a
 * session in one of their own classes. Persists as a FamilySupportRequest
 * (category ATTENDANCE) so it flows through the same triage the family
 * portal uses. Deduped: an already-open ATTENDANCE request for the same
 * session returns { ok:true, duplicate:true } instead of creating a second.
 */
export async function submitAttendanceIssue(formData: FormData) {
  const user = await requireStudentPortalUser();
  const input = SubmitAttendanceIssueSchema.parse({
    sessionId: String(formData.get("sessionId") ?? ""),
    details: String(formData.get("details") ?? "").slice(0, 1000),
  });

  const session = await prisma.classSession.findFirst({
    where: { id: input.sessionId, offering: { enrollments: { some: { studentId: user.id } } } },
    select: { id: true, offeringId: true },
  });
  if (!session) throw new Error("You do not have access to this session.");

  const existing = await (prisma as any).familySupportRequest.findFirst({
    where: {
      studentUserId: user.id,
      sessionId: session.id,
      category: "ATTENDANCE",
      externalStatus: { in: ATTENDANCE_OPEN_STATUSES as unknown as string[] },
    },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/student/attendance");
    revalidatePath("/student/support");
    return { ok: true, duplicate: true, requestId: existing.id };
  }

  const request = await (prisma as any).familySupportRequest.create({
    data: {
      requesterUserId: user.id,
      requesterRole: "STUDENT",
      studentUserId: user.id,
      offeringId: session.offeringId,
      sessionId: session.id,
      category: "ATTENDANCE",
      description: input.details,
      externalStatus: "SENT",
      histories: { create: { status: "SENT", actorUserId: user.id } },
    },
  });

  revalidatePath("/student/attendance");
  revalidatePath("/student/support");
  return { ok: true, duplicate: false, requestId: request.id };
}

const ExpressRecommendationInterestSchema = z.object({
  passionId: z.string().min(1).optional(),
});

/**
 * Records "I'm interested" against a real StudentInterest row when the
 * recommendation actually maps to a passion area. When it doesn't (e.g. the
 * recommendation is a class offering with no passion mapping), this returns
 * { recorded:false } and callers should present a real link to the
 * opportunity instead of a fake confirmation.
 */
export async function expressRecommendationInterest(formData: FormData) {
  const user = await requireSessionUser();
  const input = ExpressRecommendationInterestSchema.parse({
    passionId: String(formData.get("passionId") ?? "") || undefined,
  });

  if (!input.passionId) {
    return { ok: true, recorded: false };
  }

  const passion = await (prisma as any).passionArea.findUnique({ where: { id: input.passionId }, select: { id: true } });
  if (!passion) return { ok: true, recorded: false };

  await (prisma as any).studentInterest.upsert({
    where: { studentId_passionId: { studentId: user.id, passionId: input.passionId } },
    create: { studentId: user.id, passionId: input.passionId, level: "EXPLORING" },
    update: { lastActiveAt: new Date() },
  });

  revalidatePath("/student/recommendations");
  return { ok: true, recorded: true };
}
export async function confirmInstructorAvailability(formData: FormData){ const user=await requireSessionUser(); const note=String(formData.get("note")??"").slice(0,1000); await (prisma as any).instructorGrowthEvent.create({data:{userId:user.id, type:"AVAILABILITY_UPDATED", summary:"Instructor availability updated", details:note}}).catch(()=>null); revalidatePath("/instructor/availability"); }
/**
 * Granular per-item session-readiness confirmation. Replaces the old
 * one-click all-green version: only the items whose checkboxes were
 * submitted are marked reviewed, and completedAt is only set once all three
 * are true (mirrors updateSessionReadiness semantics — this delegates to
 * that service so the attribution/authorization logic lives in one place,
 * including co-instructor support via requireInstructorAssigned).
 */
export async function confirmSessionReady(formData: FormData){
  const user = await requireSessionUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  const lessonReviewed = formData.get("lessonReviewed") === "on";
  const materialsReviewed = formData.get("materialsReviewed") === "on";
  const studentContextReviewed = formData.get("studentContextReviewed") === "on";
  const session = await prisma.classSession.findUnique({ where: { id: sessionId }, select: { offeringId: true } });
  if (!session) throw new Error("Session not found");
  await updateSessionReadiness(
    { userId: user.id, roles: user.roles },
    sessionId,
    {
      note,
      lessonReviewed,
      materialsReviewed,
      studentContextReviewed,
      confirmReady: lessonReviewed && materialsReviewed && studentContextReviewed,
    },
  );
  revalidatePath(`/instructor/classes/${session.offeringId}`);
  revalidatePath(`/instructor/classes/${session.offeringId}/sessions/${sessionId}`);
}
export async function createOperationalAction(formData: FormData){ const user=await requireOfficer(); const title=String(formData.get("title")??"").slice(0,200); if(!title) return; await (prisma as any).actionItem.create({data:{title, description:String(formData.get("description")??""), ownerId:String(formData.get("ownerId")??user.id), createdById:user.id, status:"OPEN", priority:String(formData.get("priority")??"MEDIUM")}}).catch(()=>null); revalidatePath("/chapter/weekly-plan"); revalidatePath("/chapter/workload"); }
export async function updateLaunchDecision(formData: FormData){ await requireOfficer(); const offeringId=String(formData.get("offeringId")??""); const summary=String(formData.get("summary")??"Launch decision updated"); if(!offeringId) return; await prisma.classOfferingTimelineEvent.create({data:{offeringId, kind:"NOTE", summary, payload:{session8:true}} as any}); revalidatePath(`/chapter/classes/${offeringId}/launch`); }
