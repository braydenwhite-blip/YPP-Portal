import { prisma } from "@/lib/prisma";
import { auditOperationalEvent } from "@/lib/operational-audit-service";
import { notifyOperational } from "@/lib/operational-notification-service";
import { canOverrideReadiness, requireOfferingScope, type Session4Actor } from "@/lib/operational-permissions";
import { resolveOperationalAction } from "@/lib/operational-action-sync-service";

export async function getInstructorReadiness(instructorId: string) {
  const [app, interview, prep] = await Promise.all([
    (prisma as any).instructorApplication.findFirst({ where: { userId: instructorId }, orderBy: { createdAt: "desc" } }).catch(() => null),
    (prisma as any).instructorInterviewReview.findFirst({ where: { instructorId }, orderBy: { createdAt: "desc" } }).catch(() => null),
    (prisma as any).instructorJourney.findUnique({ where: { userId: instructorId } }).catch(() => null),
  ]);
  const missing: string[] = [];
  if (app && !["APPROVED", "ACCEPTED", "HIRED"].includes(app.status)) missing.push("Application not approved");
  if (!interview) missing.push("Interview incomplete");
  if (prep && !["COMPLETE", "COMPLETED"].includes(prep.status ?? prep.onboardingStatus ?? "")) missing.push("Onboarding incomplete");
  return { ready: missing.length === 0, missing, applicationStatus: app?.status ?? null, interviewComplete: Boolean(interview), onboardingStatus: prep?.status ?? null };
}

export async function listEligibleInstructorCandidates(offeringId: string) {
  const offering = await (prisma as any).classOffering.findUnique({ where: { id: offeringId }, include: { template: true } });
  const users = await (prisma as any).user.findMany({ where: { roles: { some: { role: "INSTRUCTOR" } } }, take: 25, orderBy: { name: "asc" } });
  return Promise.all(users.map(async (u: any) => ({ id: u.id, name: u.name, email: u.email, readiness: await getInstructorReadiness(u.id), programFit: offering?.template?.interestArea ? `Matched to ${offering.template.interestArea} review` : "General instructor" })));
}

export async function assignInstructor(actor: Session4Actor, offeringId: string, instructorId: string, reason: string, overrideReadiness = false) {
  if (!reason?.trim()) throw new Error("Assignment reason is required");
  await requireOfferingScope(actor, offeringId);
  const readiness = await getInstructorReadiness(instructorId);
  if (!readiness.ready && (!overrideReadiness || !canOverrideReadiness(actor.roles))) throw new Error(`Instructor readiness incomplete: ${readiness.missing.join(", ")}`);
  return (prisma as any).$transaction(async (tx: any) => {
    const before = await tx.classOffering.findUnique({ where: { id: offeringId }, select: { instructorId: true, title: true } });
    await tx.classOffering.update({ where: { id: offeringId }, data: { instructorId } });
    await tx.instructorAssignmentHistory.updateMany({ where: { offeringId, active: true }, data: { active: false, removedAt: new Date() } }).catch(() => null);
    await tx.instructorAssignmentHistory.create({ data: { offeringId, previousInstructorId: before?.instructorId ?? null, newInstructorId: instructorId, actorUserId: actor.userId, reason, readinessOverride: overrideReadiness, readinessSnapshot: readiness } }).catch(() => null);
    await tx.classOfferingTimelineEvent.create({ data: { offeringId, actorId: actor.userId, kind: "INSTRUCTOR_REASSIGNED", summary: before?.instructorId ? "Instructor reassigned" : "Instructor assigned", payload: { previousInstructorId: before?.instructorId, newInstructorId: instructorId, reason, readiness } } });
    await auditOperationalEvent({ actorUserId: actor.userId, action: before?.instructorId ? "INSTRUCTOR_REASSIGNED" : "INSTRUCTOR_ASSIGNED", sourceType: "CLASS_OFFERING", sourceId: offeringId, previousState: before, newState: { instructorId }, reason });
    await notifyOperational({ userId: instructorId, eventType: "INSTRUCTOR_CLASS_ASSIGNED", title: "You were assigned to a class", body: before?.title ?? "A YPP class was assigned to you.", link: `/instructor/classes/${offeringId}`, relatedEntityType: "CLASS_OFFERING", relatedEntityId: offeringId, dedupeKey: `class-assigned:${offeringId}:${instructorId}`, operational: true });
    await resolveOperationalAction(offeringId, "INSTRUCTOR_MISSING", actor.userId);
    return { ok: true };
  });
}

export async function removeInstructor(actor: Session4Actor, offeringId: string, reason: string) {
  if (!reason?.trim()) throw new Error("Removal reason is required");
  await requireOfferingScope(actor, offeringId);
  return (prisma as any).$transaction(async (tx: any) => {
    const before = await tx.classOffering.findUnique({ where: { id: offeringId }, select: { instructorId: true } });
    await tx.classOffering.update({ where: { id: offeringId }, data: { instructorId: null } });
    await tx.instructorAssignmentHistory.updateMany({ where: { offeringId, active: true }, data: { active: false, removedAt: new Date() } }).catch(() => null);
    await tx.instructorAssignmentHistory.create({ data: { offeringId, previousInstructorId: before?.instructorId, newInstructorId: null, actorUserId: actor.userId, reason, active: false, removedAt: new Date() } }).catch(() => null);
    await tx.classOfferingTimelineEvent.create({ data: { offeringId, actorId: actor.userId, kind: "INSTRUCTOR_REASSIGNED", summary: "Instructor removed", payload: { previousInstructorId: before?.instructorId, reason } } });
    await auditOperationalEvent({ actorUserId: actor.userId, action: "INSTRUCTOR_REMOVED", sourceType: "CLASS_OFFERING", sourceId: offeringId, previousState: before, newState: { instructorId: null }, reason });
    return { ok: true };
  });
}
