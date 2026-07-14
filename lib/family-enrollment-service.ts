import { prisma } from "@/lib/prisma";
import { canGuardianApproveEnrollment, canGuardianManageEnrollment, requireGuardianAccessToStudent } from "@/lib/family-access";

export type FamilyActor = { userId: string; role: "STUDENT" | "GUARDIAN" };
export type EnrollmentAction = "ENROLL" | "REQUEST_GUARDIAN_APPROVAL" | "APPLY" | "JOIN_WAITLIST" | "LEAVE_WAITLIST" | "ACCEPT_WAITLIST_OFFER" | "EXPRESS_INTEREST" | "NONE";

export async function getFamilyOpportunity(offeringId: string, studentId?: string) {
  const offering = await (prisma as any).classOffering.findUnique({
    where: { id: offeringId },
    include: { template: true, instructor: { select: { id: true, name: true } }, chapter: { select: { id: true, name: true } }, partner: { select: { id: true, name: true } }, sessions: { orderBy: [{ date: "asc" }, { startTime: "asc" }] }, familyEnrollmentConfig: true, enrollments: studentId ? { where: { studentId } } : false, guardianApprovalRequests: studentId ? { where: { studentUserId: studentId, status: "PENDING" } } : false, familyWaitlistEntries: studentId ? { where: { studentUserId: studentId } } : false },
  });
  return offering;
}

function gradeFromProfile(profile: any): number | null {
  const raw = profile?.gradeLevel ?? profile?.grade ?? profile?.currentGrade;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function ageFromProfile(profile: any): number | null {
  const dob = profile?.dateOfBirth ?? profile?.birthdate;
  if (!dob) return null;
  const d = new Date(dob); if (Number.isNaN(+d)) return null;
  const now = new Date(); let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age;
}
export function plainEnrollmentStatus(status?: string | null) {
  if (status === "ENROLLED") return "You are enrolled";
  if (status === "WAITLISTED") return "You are on the waitlist";
  if (status === "COMPLETED") return "This class has ended";
  if (status === "DROPPED") return "You are no longer enrolled";
  return "Not enrolled yet";
}

export async function evaluateFamilyEnrollment(studentId: string, offeringId: string) {
  const [student, offering] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, include: { profile: true } }),
    getFamilyOpportunity(offeringId, studentId),
  ]);
  if (!student || !offering) return { state: "BLOCKED", explanation: "We could not find this opportunity.", action: "NONE" as EnrollmentAction, blockingReason: "missing", requiredForms: [], capacityState: "unknown", existingParticipationState: null, guardianRequired: false };
  const config = offering.familyEnrollmentConfig;
  const mode = config?.mode ?? (!offering.enrollmentOpen ? "CLOSED" : "DIRECT");
  const existing = offering.enrollments?.[0];
  const waitlist = offering.familyWaitlistEntries?.[0];
  const approval = offering.guardianApprovalRequests?.[0];
  if (existing?.status === "ENROLLED" || existing?.status === "COMPLETED") return { state: "ALREADY_PARTICIPATING", explanation: plainEnrollmentStatus(existing.status), action: "NONE" as EnrollmentAction, existingParticipationState: existing.status, requiredForms: [], capacityState: "enrolled", guardianRequired: false };
  const grade = gradeFromProfile(student.profile), age = ageFromProfile(student.profile);
  if (config?.minGrade && grade !== null && grade < config.minGrade) return { state: "BLOCKED", explanation: `This opportunity is for students in grades ${config.minGrade}${config.maxGrade ? `–${config.maxGrade}` : " and up"}.`, action: "NONE" as EnrollmentAction, blockingReason: "grade", requiredForms: [], capacityState: "open", existingParticipationState: existing?.status ?? null, guardianRequired: false };
  if (config?.maxGrade && grade !== null && grade > config.maxGrade) return { state: "BLOCKED", explanation: `This opportunity is for students in grades ${config.minGrade ?? "younger"}–${config.maxGrade}.`, action: "NONE" as EnrollmentAction, blockingReason: "grade", requiredForms: [], capacityState: "open", existingParticipationState: existing?.status ?? null, guardianRequired: false };
  if ((config?.minAge || config?.maxAge) && age === null) return { state: "BLOCKED", explanation: "Please add the student’s birth date before enrolling so YPP can confirm this opportunity is a good fit.", action: "NONE" as EnrollmentAction, blockingReason: "age_missing", requiredForms: [], capacityState: "open", existingParticipationState: existing?.status ?? null, guardianRequired: false };
  if (config?.minAge && age !== null && age < config.minAge) return { state: "BLOCKED", explanation: config.maxAge ? `This opportunity is for students ages ${config.minAge}–${config.maxAge}.` : `This opportunity is for students age ${config.minAge} and older.`, action: "NONE" as EnrollmentAction, blockingReason: "age", requiredForms: [], capacityState: "open", existingParticipationState: existing?.status ?? null, guardianRequired: false };
  if (config?.maxAge && age !== null && age > config.maxAge) return { state: "BLOCKED", explanation: config.minAge ? `This opportunity is for students ages ${config.minAge}–${config.maxAge}.` : `This opportunity is for students age ${config.maxAge} or younger.`, action: "NONE" as EnrollmentAction, blockingReason: "age", requiredForms: [], capacityState: "open", existingParticipationState: existing?.status ?? null, guardianRequired: false };
  if (mode === "CLOSED" || !offering.enrollmentOpen) return { state: "CLOSED", explanation: "Applications are currently closed.", action: "NONE" as EnrollmentAction, blockingReason: "closed", requiredForms: [], capacityState: "closed", existingParticipationState: existing?.status ?? null, guardianRequired: false };
  if (mode === "INVITATION_ONLY") return { state: "INVITATION_REQUIRED", explanation: "This opportunity requires an invitation.", action: "NONE" as EnrollmentAction, blockingReason: "invitation", requiredForms: [], capacityState: "restricted", existingParticipationState: null, guardianRequired: false };
  if (mode === "EXTERNAL_PARTNER_PLACEMENT") return { state: "EXTERNAL_PLACEMENT", explanation: "This opportunity is placed through a YPP partner.", action: "NONE" as EnrollmentAction, blockingReason: "external", requiredForms: [], capacityState: "restricted", existingParticipationState: null, guardianRequired: false };
  if (mode === "APPLICATION_REQUIRED") return { state: "APPLICATION", explanation: "This opportunity uses an application. You can start or continue it now.", action: "APPLY" as EnrollmentAction, requiredForms: [], capacityState: "application", existingParticipationState: null, guardianRequired: false, applicationUrl: config?.applicationUrl ?? "/applications" };
  if (mode === "STUDENT_INTEREST") return { state: "INTEREST", explanation: "You can express interest and YPP will follow up.", action: "EXPRESS_INTEREST" as EnrollmentAction, requiredForms: [], capacityState: "interest", existingParticipationState: null, guardianRequired: false };
  const activeCount = await (prisma as any).classEnrollment.count({ where: { offeringId, status: "ENROLLED" } });
  const full = activeCount >= offering.capacity;
  if (waitlist?.status === "OFFERED") return { state: "WAITLIST_OFFER", explanation: "You have a waitlist offer. Please respond before the deadline.", action: "ACCEPT_WAITLIST_OFFER" as EnrollmentAction, requiredForms: [], capacityState: "offer", existingParticipationState: "WAITLISTED", guardianRequired: false, offerExpiresAt: waitlist.offerExpiresAt };
  if (waitlist?.status === "ACTIVE" || existing?.status === "WAITLISTED") return { state: "WAITLISTED", explanation: "You are on the waitlist. YPP will contact your family if a seat opens.", action: "LEAVE_WAITLIST" as EnrollmentAction, requiredForms: [], capacityState: "waitlist", existingParticipationState: "WAITLISTED", guardianRequired: false };
  if (full || mode === "WAITLIST") return { state: "WAITLIST_AVAILABLE", explanation: "This class is full, but you can join the waitlist.", action: "JOIN_WAITLIST" as EnrollmentAction, requiredForms: [], capacityState: "full", existingParticipationState: null, guardianRequired: false };
  if (approval) return { state: "WAITING_FOR_GUARDIAN", explanation: "A parent or guardian needs to approve this.", action: "NONE" as EnrollmentAction, requiredForms: [], capacityState: "open", existingParticipationState: null, guardianRequired: true };
  if (config?.requiresGuardianApproval || mode === "GUARDIAN_APPROVAL_REQUIRED") return { state: "NEEDS_GUARDIAN", explanation: "A parent or guardian needs to approve this.", action: "REQUEST_GUARDIAN_APPROVAL" as EnrollmentAction, requiredForms: [], capacityState: "open", existingParticipationState: null, guardianRequired: true };
  return { state: "ELIGIBLE", explanation: "You can enroll now.", action: "ENROLL" as EnrollmentAction, requiredForms: [], capacityState: "open", existingParticipationState: null, guardianRequired: false };
}

export async function enrollDirect(studentId: string, offeringId: string, actor: FamilyActor) {
  const evaluation = await evaluateFamilyEnrollment(studentId, offeringId);
  if (evaluation.action !== "ENROLL" && evaluation.action !== "ACCEPT_WAITLIST_OFFER") throw new Error(evaluation.explanation);
  return prisma.$transaction(async (tx: any) => {
    const offering = await tx.classOffering.findUnique({ where: { id: offeringId }, select: { capacity: true } });
    const count = await tx.classEnrollment.count({ where: { offeringId, status: "ENROLLED" } });
    if (count >= offering.capacity) throw new Error("This class is full, but you can join the waitlist.");
    const enrollment = await tx.classEnrollment.upsert({ where: { studentId_offeringId: { studentId, offeringId } }, update: { status: "ENROLLED", droppedAt: null }, create: { studentId, offeringId, status: "ENROLLED", outcomesAchieved: [] } });
    await tx.classOfferingTimelineEvent.create({ data: { offeringId, actorId: actor.userId, kind: "ENROLLMENT_STATUS_CHANGED", summary: "Family portal enrollment confirmed", payload: { studentId, source: "family_portal" } } }).catch(() => null);
    return { enrollment, message: "You are enrolled. Check My Learning for the next session." };
  });
}

export async function requestGuardianApproval(studentId: string, offeringId: string, requestedById: string) {
  const evaluation = await evaluateFamilyEnrollment(studentId, offeringId);
  if (evaluation.action !== "REQUEST_GUARDIAN_APPROVAL") throw new Error(evaluation.explanation);
  return (prisma as any).guardianApprovalRequest.upsert({ where: { studentUserId_offeringId_status: { studentUserId: studentId, offeringId, status: "PENDING" } }, update: { requestedById }, create: { studentUserId: studentId, offeringId, requestedById, auditMetadata: { source: "student_portal" } } });
}

export async function decideGuardianApproval(guardianId: string, requestId: string, decision: "APPROVED" | "DECLINED", note?: string) {
  const request = await (prisma as any).guardianApprovalRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") throw new Error("This approval request is no longer pending.");
  const rel = await requireGuardianAccessToStudent(guardianId, request.studentUserId);
  if (!canGuardianApproveEnrollment(rel as any)) throw new Error("You do not have permission to approve enrollment.");
  if (decision === "DECLINED") return (prisma as any).guardianApprovalRequest.update({ where: { id: requestId }, data: { status: "DECLINED", guardianUserId: guardianId, decisionById: guardianId, decidedAt: new Date(), decisionNote: note } });
  return prisma.$transaction(async (tx: any) => {
    await tx.guardianApprovalRequest.update({ where: { id: requestId }, data: { status: "APPROVED", guardianUserId: guardianId, decisionById: guardianId, decidedAt: new Date(), decisionNote: note } });
    const count = await tx.classEnrollment.count({ where: { offeringId: request.offeringId, status: "ENROLLED" } });
    const offering = await tx.classOffering.findUnique({ where: { id: request.offeringId }, select: { capacity: true } });
    if (count >= offering.capacity) throw new Error("This class filled before approval was completed. Please join the waitlist.");
    return tx.classEnrollment.upsert({ where: { studentId_offeringId: { studentId: request.studentUserId, offeringId: request.offeringId } }, update: { status: "ENROLLED", droppedAt: null }, create: { studentId: request.studentUserId, offeringId: request.offeringId, status: "ENROLLED", outcomesAchieved: [] } });
  });
}

export async function joinWaitlist(studentId: string, offeringId: string, actor: FamilyActor) {
  const evaluation = await evaluateFamilyEnrollment(studentId, offeringId);
  if (evaluation.action !== "JOIN_WAITLIST") throw new Error(evaluation.explanation);
  const entry = await (prisma as any).familyWaitlistEntry.upsert({ where: { studentUserId_offeringId: { studentUserId: studentId, offeringId } }, update: { status: "ACTIVE", leftAt: null, createdById: actor.userId }, create: { studentUserId: studentId, offeringId, createdById: actor.userId, audits: { create: { actorUserId: actor.userId, action: "JOINED" } } } });
  await (prisma as any).classEnrollment.upsert({ where: { studentId_offeringId: { studentId, offeringId } }, update: { status: "WAITLISTED" }, create: { studentId, offeringId, status: "WAITLISTED", outcomesAchieved: [] } });
  return entry;
}
export async function leaveWaitlist(studentId: string, offeringId: string, actorUserId: string) {
  return prisma.$transaction(async (tx: any) => {
    const entry = await tx.familyWaitlistEntry.findUnique({ where: { studentUserId_offeringId: { studentUserId: studentId, offeringId } } });
    if (!entry || !["ACTIVE", "OFFERED"].includes(entry.status)) throw new Error("There is no active waitlist entry to leave.");
    let enrollment = null;
    if (typeof tx.classEnrollment.findUnique === "function") enrollment = await tx.classEnrollment.findUnique({ where: { studentId_offeringId: { studentId, offeringId } } }).catch(() => null);
    if (!enrollment && typeof tx.classEnrollment.findFirst === "function") enrollment = await tx.classEnrollment.findFirst({ where: { studentId, offeringId } });
    const updatedEntry = await tx.familyWaitlistEntry.update({ where: { id: entry.id }, data: { status: "LEFT", leftAt: new Date(), offerExpiresAt: null, decidedById: actorUserId, audits: { create: { actorUserId, action: entry.status === "OFFERED" ? "OFFER_WITHDRAWN" : "LEFT" } } } });
    if (enrollment?.status === "WAITLISTED") {
      await tx.classEnrollment.update({ where: { id: enrollment.id }, data: { status: "DROPPED", droppedAt: new Date() } });
      await tx.classOfferingTimelineEvent.create({ data: { offeringId, actorId: actorUserId, kind: "ENROLLMENT_STATUS_CHANGED", summary: "Family left waitlist", payload: { studentId, previousStatus: "WAITLISTED", newStatus: "DROPPED", waitlistEntryId: entry.id } } }).catch(() => null);
    }
    return updatedEntry;
  });
}
export async function acceptWaitlistOffer(studentId: string, offeringId: string, actor: FamilyActor) {
  const entry = await (prisma as any).familyWaitlistEntry.findUnique({ where: { studentUserId_offeringId: { studentUserId: studentId, offeringId } } });
  if (!entry || entry.status !== "OFFERED") throw new Error("There is no waitlist offer to accept.");
  if (entry.offerExpiresAt && entry.offerExpiresAt < new Date()) { await (prisma as any).familyWaitlistEntry.update({ where: { id: entry.id }, data: { status: "EXPIRED", audits: { create: { actorUserId: actor.userId, action: "EXPIRED" } } } }); throw new Error("This waitlist offer has expired."); }
  const result = await enrollDirect(studentId, offeringId, actor);
  await (prisma as any).familyWaitlistEntry.update({ where: { id: entry.id }, data: { status: "ACCEPTED", decidedById: actor.userId, audits: { create: { actorUserId: actor.userId, action: "ACCEPTED" } } } });
  return result;
}
export async function declineWaitlistOffer(studentId: string, offeringId: string, actorUserId: string) {
  const entry = await (prisma as any).familyWaitlistEntry.findUnique({ where: { studentUserId_offeringId: { studentUserId: studentId, offeringId } } });
  if (!entry || entry.status !== "OFFERED") throw new Error("There is no waitlist offer to decline.");
  return (prisma as any).familyWaitlistEntry.update({ where: { id: entry.id }, data: { status: "DECLINED", decidedById: actorUserId, audits: { create: { actorUserId, action: "DECLINED" } } } });
}
export async function assertGuardianCanManageEnrollment(guardianId: string, studentId: string) { const rel = await requireGuardianAccessToStudent(guardianId, studentId); if (!canGuardianManageEnrollment(rel as any)) throw new Error("You do not have permission to manage enrollment."); return rel; }
