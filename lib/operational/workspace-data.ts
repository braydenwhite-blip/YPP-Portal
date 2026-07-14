import { prisma } from "@/lib/prisma";
import { qaHarnessEnabled } from "@/lib/qa-auth-harness";
import { requireAnyRole, requireLeadership, requireSessionUser } from "@/lib/authorization";

export async function requireChapterOperator() {
  return requireAnyRole(["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "LEADERSHIP"]);
}

export async function getChapterOperationsSummary() {
  const actor = await requireChapterOperator();
  if (qaHarnessEnabled() && actor.id.startsWith("qa-")) return qaChapterOperationsSummary(actor);
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
  const actor = await requireChapterOperator();
  if (qaHarnessEnabled() && actor.id.startsWith("qa-")) return qaFamilyFormAdminSummary();
  const [templates, submissions] = await Promise.all([
    prisma.familyFormTemplate.findMany({ select: { id: true, key: true, title: true, formType: true, description: true, versions: { select: { id: true, version: true, effectiveAt: true, retiredAt: true, _count: { select: { requirements: true, submissions: true } } }, orderBy: { version: "desc" }, take: 5 } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.familyFormSubmission.findMany({ select: { id: true, status: true, staffReviewState: true, createdAt: true, reviewNote: true, studentUser: { select: { name: true, email: true } }, guardianUser: { select: { name: true, email: true } }, requirement: { select: { reason: true, offering: { select: { title: true } } } }, version: { select: { version: true, template: { select: { title: true } } } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return { templates, submissions };
}

export async function getInstructorClassWorkspace(classId: string) {
  const actor = await requireSessionUser();
  const offering = await (prisma as any).classOffering.findUnique({ where: { id: classId }, include: { sessions: { include: { attendance: true, preparations: true }, orderBy: { date: "asc" }, take: 12 }, enrollments: { where: { status: { in: ["ENROLLED", "COMPLETED"] } }, include: { student: { select: { id: true, name: true, email: true } } } } } });
  if (!offering) throw new Error("Class not found");
  if (offering.instructorId !== actor.id && !actor.roles.some((r) => ["ADMIN", "STAFF", "CHAPTER_PRESIDENT"].includes(r))) throw new Error("Unauthorized");
  return { actor, offering };
}

export async function getLeadershipSummary() {
  const actor = await requireLeadership();
  if (qaHarnessEnabled() && actor.id.startsWith("qa-")) return qaChapterOperationsSummary(actor).then((s) => s.interventions);
  return prisma.leadershipIntervention.findMany({ select: { id: true, chapterId: true, status: true, severity: true, note: true, sourceType: true, sourceId: true, ownerId: true, dueAt: true, createdAt: true }, orderBy: { updatedAt: "desc" }, take: 80 });
}


async function qaChapterOperationsSummary(actor: Awaited<ReturnType<typeof requireChapterOperator>>) {
  const offering = { id: "qa-class-ready", title: "QA Operational Music Lab", startDate: new Date("2026-08-01T15:00:00Z"), meetingDays: ["Saturday"], meetingTime: "10:00", deliveryMode: "ONLINE", capacity: 1, enrollmentOpen: true, instructorId: null, status: "ACTIVE", chapterId: "qa-chapter", template: { title: "Music Lab", interestArea: "Music" }, _count: { enrollments: 0, sessions: 1 } };
  return {
    actor,
    classes: [offering],
    waitlist: [{ id: "qa-waitlist", status: "OFFERED", offerExpiresAt: new Date("2026-08-02T15:00:00Z"), studentUser: { name: "QA Student", email: "session5-student@ypp.test" }, offering: { id: offering.id, title: offering.title } }],
    approvals: [{ id: "qa-approval", status: "PENDING", requestedAt: new Date("2026-07-14T00:00:00Z"), studentUser: { name: "QA Student", email: "session5-student@ypp.test" }, guardianUser: { name: "QA Guardian", email: "session5-guardian@ypp.test" }, offering: { id: offering.id, title: offering.title, capacity: 1 } }],
    forms: [],
    support: [{ id: "qa-support", category: "LOGISTICS", externalStatus: "WAITING_FOR_STAFF", internalRoutingTeam: "CHAPTER", internalSeverity: "MEDIUM", safetyFlag: false, description: "QA family needs class logistics clarification.", createdAt: new Date("2026-07-14T00:00:00Z"), requesterUser: { name: "QA Guardian", email: "session5-guardian@ypp.test" }, offering: { id: offering.id, title: offering.title }, responses: [{ id: "qa-response-family", familyVisible: true, responseType: "FAMILY_RESPONSE", body: "We will confirm details today.", createdAt: new Date("2026-07-14T01:00:00Z") }, { id: "qa-response-internal", familyVisible: false, responseType: "INTERNAL_NOTE", body: "Internal safeguarding/private note stays staff-only.", createdAt: new Date("2026-07-14T01:05:00Z") }] }],
    announcements: [{ id: "qa-announcement", title: "QA class reminder", status: "PUBLISHED", audience: "ADMITTED_FAMILIES", announcementType: "CLASS_REMINDER", publishedAt: new Date("2026-07-14T02:00:00Z"), offering: { id: offering.id, title: offering.title } }],
    actions: [{ id: "qa-action", title: "Resolve missing instructor", status: "OPEN", deadlineStart: new Date("2026-07-20T00:00:00Z"), operationalSourceKey: "class:qa-class-ready:missing-instructor", operationalIssueType: "MISSING_INSTRUCTOR", relatedEntityType: "CLASS", relatedEntityId: offering.id, lead: { name: "QA Chapter President", email: "session5-president@ypp.test" } }],
    packets: [{ id: "qa-packet", state: "DRAFT", periodStart: new Date("2026-07-01T00:00:00Z"), periodEnd: new Date("2026-07-15T00:00:00Z"), generatedAt: new Date("2026-07-14T00:00:00Z"), _count: { items: 1 } }],
    interventions: [{ id: "qa-intervention", status: "OPEN", severity: "HIGH", note: "QA leadership intervention for unresolved operational blocker.", sourceType: "CLASS", sourceId: offering.id, dueAt: new Date("2026-07-21T00:00:00Z"), createdAt: new Date("2026-07-14T00:00:00Z") }],
  };
}

function qaFamilyFormAdminSummary() {
  return {
    templates: [{ id: "qa-template", key: "qa-consent", title: "QA Guardian Consent", formType: "CONSENT", description: "Deterministic QA form template", versions: [{ id: "qa-version", version: 1, effectiveAt: new Date("2026-07-14T00:00:00Z"), retiredAt: null, _count: { requirements: 1, submissions: 1 } }] }],
    submissions: [{ id: "qa-submission", status: "SUBMITTED", staffReviewState: "PENDING", createdAt: new Date("2026-07-14T03:00:00Z"), reviewNote: null, studentUser: { name: "QA Student", email: "session5-student@ypp.test" }, guardianUser: { name: "QA Guardian", email: "session5-guardian@ypp.test" }, requirement: { reason: "Required for QA class", offering: { title: "QA Operational Music Lab" } }, version: { version: 1, template: { title: "QA Guardian Consent" } } }],
  };
}
