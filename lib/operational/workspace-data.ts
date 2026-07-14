import { prisma } from "@/lib/prisma";
import { requireAnyRole, requireLeadership, requireSessionUser } from "@/lib/authorization";

export async function requireChapterOperator() {
  return requireAnyRole(["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "LEADERSHIP"]);
}

export async function getChapterOperationsSummary() {
  const actor = await requireChapterOperator();
  const actorRecord = await prisma.user.findUnique({ where: { id: actor.id }, select: { chapterId: true } });
  const chapterId = actor.roles.includes("ADMIN") || actor.roles.includes("LEADERSHIP") ? undefined : actorRecord?.chapterId ?? undefined;
  const classWhere = chapterId ? { chapterId } : {};
  const [classes, waitlist, approvals, forms, support, announcements, actions, packets, interventions] = await Promise.all([
    prisma.classOffering.findMany({ where: classWhere, select: { id: true, title: true, startDate: true, meetingDays: true, meetingTime: true, deliveryMode: true, capacity: true, enrollmentOpen: true, instructorId: true, status: true, chapterId: true, template: { select: { title: true, interestArea: true } }, _count: { select: { enrollments: true, sessions: true } } }, orderBy: { startDate: "asc" }, take: 40 }),
    prisma.familyWaitlistEntry.findMany({ where: { offering: classWhere }, select: { id: true, status: true, offerExpiresAt: true, studentUser: { select: { name: true, email: true } }, offering: { select: { id: true, title: true } } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.guardianApprovalRequest.findMany({ where: { offering: classWhere }, select: { id: true, status: true, requestedAt: true, studentUser: { select: { name: true, email: true } }, guardianUser: { select: { name: true, email: true } }, offering: { select: { id: true, title: true, capacity: true } } }, orderBy: { requestedAt: "asc" }, take: 40 }),
    prisma.familyFormRequirement.findMany({ where: { offering: classWhere }, select: { id: true, status: true, dueAt: true, reason: true, blocksEnrollment: true, staffReviewRequired: true, studentUser: { select: { name: true, email: true } }, offering: { select: { id: true, title: true } }, version: { select: { id: true, version: true, template: { select: { title: true, formType: true } } } } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.familySupportRequest.findMany({ where: { offering: classWhere }, select: { id: true, category: true, externalStatus: true, internalRoutingTeam: true, internalSeverity: true, safetyFlag: true, description: true, createdAt: true, requesterUser: { select: { name: true, email: true } }, offering: { select: { id: true, title: true } }, responses: { select: { id: true, familyVisible: true, responseType: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 8 } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.classAnnouncement.findMany({ where: { offering: classWhere }, select: { id: true, title: true, status: true, audience: true, announcementType: true, publishedAt: true, offering: { select: { id: true, title: true } } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.actionItem.findMany({ where: chapterId ? { chapterId } : {}, select: { id: true, title: true, status: true, deadlineStart: true, operationalSourceKey: true, operationalIssueType: true, relatedEntityType: true, relatedEntityId: true, lead: { select: { name: true, email: true } } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    prisma.biweeklyActionPacket.findMany({ where: chapterId ? { chapterId } : {}, select: { id: true, state: true, periodStart: true, periodEnd: true, generatedAt: true, _count: { select: { items: true } } }, orderBy: { generatedAt: "desc" }, take: 12 }),
    prisma.leadershipIntervention.findMany({ where: chapterId ? { chapterId } : {}, select: { id: true, status: true, severity: true, note: true, sourceType: true, sourceId: true, dueAt: true, createdAt: true }, orderBy: { updatedAt: "desc" }, take: 40 }),
  ]);
  return { actor, classes, waitlist, approvals, forms, support, announcements, actions, packets, interventions };
}

export async function getFamilyFormAdminSummary() {
  await requireChapterOperator();
  const [templates, submissions] = await Promise.all([
    prisma.familyFormTemplate.findMany({ select: { id: true, key: true, title: true, formType: true, description: true, versions: { select: { id: true, version: true, effectiveAt: true, retiredAt: true, _count: { select: { requirements: true, submissions: true } } }, orderBy: { version: "desc" }, take: 5 } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.familyFormSubmission.findMany({ select: { id: true, status: true, staffReviewState: true, createdAt: true, reviewNote: true, studentUser: { select: { name: true, email: true } }, guardianUser: { select: { name: true, email: true } }, requirement: { select: { reason: true, offering: { select: { title: true } } } }, version: { select: { version: true, template: { select: { title: true } } } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return { templates, submissions };
}

export async function getInstructorClassWorkspace(classId: string) {
  const actor = await requireSessionUser();
  const offering = await prisma.classOffering.findUnique({ where: { id: classId }, select: { id: true, title: true, instructorId: true, meetingDays: true, meetingTime: true, deliveryMode: true, zoomLink: true, location: true, sessions: { select: { id: true, date: true, title: true, topic: true, isCancelled: true, attendance: { select: { id: true, studentId: true, status: true, notes: true } }, preparations: { select: { id: true, note: true, completedAt: true } } }, orderBy: { date: "asc" }, take: 12 }, enrollments: { where: { status: { in: ["ENROLLED", "COMPLETED"] } }, select: { student: { select: { id: true, name: true, email: true } }, status: true } } } });
  if (!offering) throw new Error("Class not found");
  if (offering.instructorId !== actor.id && !actor.roles.some((r) => ["ADMIN", "STAFF", "CHAPTER_PRESIDENT"].includes(r))) throw new Error("Unauthorized");
  return { actor, offering };
}

export async function getLeadershipSummary() {
  await requireLeadership();
  return prisma.leadershipIntervention.findMany({ select: { id: true, chapterId: true, status: true, severity: true, note: true, sourceType: true, sourceId: true, ownerId: true, dueAt: true, createdAt: true }, orderBy: { updatedAt: "desc" }, take: 80 });
}
