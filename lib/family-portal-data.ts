import { prisma } from "@/lib/prisma";
import { filterGuardianFacingRecord, filterStudentFacingRecord, getAccessibleStudentsForGuardian, requireGuardianAccessToStudent } from "@/lib/family-access";

export async function getStudentPortalHome(studentId: string) {
  const [user, classEnrollments, enrollments, intakeCases] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, include: { profile: true } }),
    prisma.classEnrollment.findMany({ where: { studentId, status: { in: ["ENROLLED", "WAITLISTED"] as any } }, include: { offering: { include: { sessions: { where: { date: { gte: new Date() }, isCancelled: false }, orderBy: { date: "asc" }, take: 1 }, instructors: { include: { instructor: { select: { name: true } } } }, template: true } } }, take: 6 }),
    prisma.enrollment.findMany({ where: { userId: studentId }, include: { course: { include: { leadInstructor: { select: { name: true } } } } }, take: 6 }),
    prisma.studentIntakeCase.findMany({ where: { studentUserId: studentId, status: { notIn: ["ARCHIVED"] as any } }, orderBy: { updatedAt: "desc" }, take: 3 }),
  ]);
  const upcoming = classEnrollments.flatMap((e: any) => e.offering.sessions.map((s: any) => ({ enrollment: e, session: s }))).sort((a:any,b:any)=>+a.session.date-+b.session.date)[0] ?? null;
  return { user, classEnrollments: classEnrollments.map(filterStudentFacingRecord), enrollments: enrollments.map(filterStudentFacingRecord), intakeCases: intakeCases.map(filterStudentFacingRecord), upcoming };
}

export async function getParentPortalHome(guardianId: string) {
  const relationships = await getAccessibleStudentsForGuardian(guardianId);
  const studentIds = relationships.map((r) => r.studentUserId);
  const [classEnrollments, intakeCases] = await Promise.all([
    prisma.classEnrollment.findMany({ where: { studentId: { in: studentIds }, status: { in: ["ENROLLED", "WAITLISTED"] as any } }, include: { student: { select: { id: true, name: true } }, offering: { include: { sessions: { where: { date: { gte: new Date() }, isCancelled: false }, orderBy: { date: "asc" }, take: 1 }, instructors: { include: { instructor: { select: { name: true } } } }, template: true } } }, take: 20 }),
    prisma.studentIntakeCase.findMany({ where: { parentId: guardianId, status: { notIn: ["ARCHIVED"] as any } }, include: { studentUser: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);
  return { relationships, classEnrollments: classEnrollments.map(filterGuardianFacingRecord), intakeCases: intakeCases.map(filterGuardianFacingRecord) };
}

export async function getParentStudentOverview(guardianId: string, studentId: string) {
  const relationship = await requireGuardianAccessToStudent(guardianId, studentId);
  const home = await getStudentPortalHome(studentId);
  const attendance = await prisma.classAttendanceRecord.findMany({ where: { studentId }, select: { status: true, checkedInAt: true, session: { select: { topic: true, date: true } } }, orderBy: { checkedInAt: "desc" }, take: 8 });
  return { relationship, ...home, attendance };
}

export async function getStudentLearning(studentId: string) {
  const now = new Date();
  const enrollments = await prisma.classEnrollment.findMany({ where: { studentId }, include: { offering: { include: { template: true, instructor: { select: { name: true } }, chapter: { select: { name: true } }, partner: { select: { name: true } }, sessions: { orderBy: [{ date: "asc" }, { startTime: "asc" }] }, announcements: { orderBy: { createdAt: "desc" }, take: 5 } } } }, orderBy: { updatedAt: "desc" } });
  const forms = await (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: studentId, status: { in: ["REQUIRED", "IN_PROGRESS"] } }, include: { version: { include: { template: true } }, offering: true }, take: 10 }).catch(() => []);
  const approvals = await (prisma as any).guardianApprovalRequest.findMany({ where: { studentUserId: studentId, status: "PENDING" }, include: { offering: true }, take: 10 }).catch(() => []);
  const active = enrollments.filter((e: any) => ["ENROLLED", "WAITLISTED"].includes(e.status));
  const completed = enrollments.filter((e: any) => e.status === "COMPLETED" || e.completedAt);
  const upcoming = active.flatMap((e: any) => e.offering.sessions.filter((s: any) => s.date >= now).map((s: any) => ({ enrollment: e, session: s }))).sort((a: any,b: any)=>+a.session.date-+b.session.date).slice(0, 10);
  return { active: active.map(filterStudentFacingRecord), completed: completed.map(filterStudentFacingRecord), upcoming, needsAttention: { forms, approvals } };
}

export async function getStudentClassDetail(studentId: string, offeringId: string) {
  const enrollment = await prisma.classEnrollment.findFirst({ where: { studentId, offeringId, status: { in: ["ENROLLED", "WAITLISTED", "COMPLETED"] as any } }, include: { offering: { include: { template: true, instructor: { select: { name: true } }, chapter: { select: { name: true } }, partner: { select: { name: true } }, sessions: { orderBy: [{ date: "asc" }, { startTime: "asc" } ] }, announcements: { orderBy: { createdAt: "desc" } } } } } });
  if (!enrollment) return null;
  const attendance = await prisma.classAttendanceRecord.findMany({ where: { studentId, session: { offeringId } }, select: { sessionId: true, status: true } });
  return filterStudentFacingRecord({ enrollment, attendance, offering: enrollment.offering });
}
export async function getStudentSessionDetail(studentId: string, sessionId: string) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId }, include: { offering: { include: { template: true, instructor: { select: { name: true } }, sessions: { orderBy: { date: "asc" } }, announcements: { orderBy: { createdAt: "desc" }, take: 3 } } }, attendance: { where: { studentId } } } });
  if (!session) return null;
  const enrollment = await prisma.classEnrollment.findFirst({ where: { studentId, offeringId: session.offeringId, status: { in: ["ENROLLED", "WAITLISTED", "COMPLETED"] as any } } });
  if (!enrollment) return null;
  return filterStudentFacingRecord({ session, enrollment });
}

export async function getFamilyOpportunities(studentId?: string) {
  const offerings = await (prisma as any).classOffering.findMany({ where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] }, enrollmentOpen: true }, include: { template: true, instructor: { select: { name: true } }, chapter: { select: { name: true } }, familyEnrollmentConfig: true, sessions: { orderBy: { date: "asc" }, take: 1 }, enrollments: studentId ? { where: { studentId } } : false, familyWaitlistEntries: studentId ? { where: { studentUserId: studentId } } : false, guardianApprovalRequests: studentId ? { where: { studentUserId: studentId, status: "PENDING" } } : false }, orderBy: { startDate: "asc" }, take: 50 });
  return offerings.map(filterStudentFacingRecord);
}

export async function getParentForms(guardianId: string) {
  const relationships = await getAccessibleStudentsForGuardian(guardianId); const ids = relationships.map((r) => r.studentUserId);
  const requirements = await (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: { in: ids } }, include: { studentUser: { select: { id: true, name: true } }, version: { include: { template: true } }, offering: { select: { id: true, title: true } }, submissions: { include: { signatures: true }, orderBy: { createdAt: "desc" } } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] }).catch(() => []);
  return { relationships, requirements };
}
export async function getFamilySupportRequests(userId: string, role: "STUDENT" | "GUARDIAN") {
  const where = role === "STUDENT" ? { studentUserId: userId } : { requesterUserId: userId };
  return (prisma as any).familySupportRequest.findMany({ where, include: { responses: { where: { familyVisible: true }, orderBy: { createdAt: "asc" } }, studentUser: { select: { id: true, name: true } }, offering: { select: { id: true, title: true } }, session: { select: { id: true, topic: true, date: true } } }, orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []);
}
export async function getParentSchedule(guardianId: string, studentId?: string) {
  const relationships = await getAccessibleStudentsForGuardian(guardianId); const allowed = relationships.map((r)=>r.studentUserId); const ids = studentId && allowed.includes(studentId) ? [studentId] : allowed;
  const [enrollments, forms, waitlists] = await Promise.all([
    prisma.classEnrollment.findMany({ where: { studentId: { in: ids }, status: { in: ["ENROLLED", "WAITLISTED"] as any } }, include: { student: { select: { id: true, name: true } }, offering: { include: { instructor: { select: { name: true } }, sessions: { orderBy: { date: "asc" } } } } } }),
    (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: { in: ids }, dueAt: { not: null }, status: { in: ["REQUIRED", "IN_PROGRESS"] } }, include: { studentUser: { select: { id: true, name: true } }, version: { include: { template: true } } } }).catch(() => []),
    (prisma as any).familyWaitlistEntry.findMany({ where: { studentUserId: { in: ids }, offerExpiresAt: { not: null }, status: "OFFERED" }, include: { studentUser: { select: { id: true, name: true } }, offering: { select: { id: true, title: true } } } }).catch(() => []),
  ]);
  return { relationships, enrollments: enrollments.map(filterGuardianFacingRecord), forms, waitlists };
}
export async function getParentSettingsData(guardianId: string) {
  const relationships = await getAccessibleStudentsForGuardian(guardianId); const ids = relationships.map((r)=>r.studentUserId); const gp = await (prisma as any).guardianProfile.findUnique({ where: { userId: guardianId } });
  const [contacts, prefs] = await Promise.all([ (prisma as any).emergencyContact.findMany({ where: { studentUserId: { in: ids }, archivedAt: null }, include: { studentUser: { select: { id: true, name: true } } }, orderBy: [{ priority: "asc" }] }), gp ? (prisma as any).communicationPreference.findMany({ where: { guardianProfileId: gp.id } }) : [] ]);
  return { relationships, contacts, preferences: prefs };
}
export async function getPendingGuardianApprovals(guardianId: string) { const rels = await getAccessibleStudentsForGuardian(guardianId); const ids = rels.filter((r:any)=>r.canApproveEnrollment).map((r)=>r.studentUserId); return (prisma as any).guardianApprovalRequest.findMany({ where: { studentUserId: { in: ids }, status: "PENDING" }, include: { studentUser: { select: { name: true } }, offering: { select: { title: true } } }, orderBy: { requestedAt: "asc" } }).catch(()=>[]); }
