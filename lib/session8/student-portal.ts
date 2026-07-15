import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canGuardianViewLearning, filterGuardianFacingRecord, filterStudentFacingRecord, getAccessibleStudentsForGuardian, requireGuardianAccessToStudent } from "@/lib/family-access";
import { FAMILY_ACTIVE_LEARNING_STATUSES, FAMILY_HISTORICAL_LEARNING_STATUSES, canReceiveSessionRouteLink } from "@/lib/family-enrollment-visibility";

const STUDENT_AUDIENCE_VALUES = ["ADMITTED_FAMILIES", "ALL", "STUDENTS"];

const now = () => new Date();
const safeOfferingInclude = { template: true, instructor: { select: { id: true, name: true, email: true } }, chapter: { select: { id: true, name: true } }, partner: { select: { id: true, name: true, type: true } }, sessions: { orderBy: [{ date: "asc" }, { startTime: "asc" }] }, announcements: { orderBy: { createdAt: "desc" }, take: 6 } } satisfies Prisma.ClassOfferingInclude;

export async function getStudentDashboard(studentId: string) {
  const [user, learning, support, certs, feedback] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, include: { profile: true } }),
    getStudentLearningHub(studentId),
    getStudentSupportHub(studentId),
    getStudentCertificates(studentId),
    getReleasedInstructorFeedback(studentId),
  ]);

  // Needs attention: forms due/overdue, open attendance review requests, pending guardian approvals.
  const openAttendanceRequests = support.filter((s: any) => s.category === "ATTENDANCE" && !["RESOLVED", "CLOSED"].includes(s.externalStatus));
  const needsAttention = [
    ...learning.forms.map((f: any) => ({ kind: "Form", title: f.version?.template?.title ?? "Required form", date: f.dueAt, status: f.status, href: `/student/forms/${f.id}` })),
    ...openAttendanceRequests.map((r: any) => ({ kind: "Attendance review", title: r.session?.topic ?? r.offering?.title ?? "Attendance review", date: r.createdAt, status: r.externalStatus, href: "/student/attendance" })),
    ...learning.approvals.map((a: any) => ({ kind: "Guardian approval", title: a.offering?.title ?? "Approval needed", date: a.requestedAt, status: a.status, href: "/student/learning" })),
    ...learning.waitlists.filter((w: any) => w.status === "OFFERED").map((w: any) => ({ kind: "Waitlist offer", title: w.offering?.title ?? "Waitlist offer", date: w.offerExpiresAt, status: w.status, href: "/student/learning" })),
  ];

  const nextUp = learning.schedule[0] ?? null;
  const recommendations = (await getStudentRecommendations(studentId)).slice(0, 2);
  const recentProgress = [...learning.completed.slice(0, 3), ...certs.slice(0, 2), ...feedback.slice(0, 2)];

  return {
    user,
    needsAttention,
    nextUp,
    learning,
    support: support.slice(0, 3),
    certificates: certs,
    feedback,
    recentProgress,
    recommendations,
  };
}

export async function getStudentLearningHub(studentId: string) {
  const enrollments = await prisma.classEnrollment.findMany({ where: { studentId }, include: { offering: { include: safeOfferingInclude } }, orderBy: { updatedAt: "desc" } });
  const forms = await (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: studentId, status: { in: ["REQUIRED", "IN_PROGRESS"] } }, include: { version: { include: { template: true } }, offering: { select: { id: true, title: true } } }, orderBy: [{ dueAt: "asc" }] }).catch(() => []);
  const approvals = await (prisma as any).guardianApprovalRequest.findMany({ where: { studentUserId: studentId, status: "PENDING" }, include: { offering: { select: { id: true, title: true } } }, orderBy: { requestedAt: "asc" } }).catch(() => []);
  const waitlists = await (prisma as any).familyWaitlistEntry.findMany({ where: { studentUserId: studentId }, include: { offering: { select: { id: true, title: true, startDate: true, timezone: true } } }, orderBy: { updatedAt: "desc" } }).catch(() => []);
  const active = enrollments.filter((e: any) => FAMILY_ACTIVE_LEARNING_STATUSES.includes(e.status));
  const completed = enrollments.filter((e: any) => FAMILY_HISTORICAL_LEARNING_STATUSES.includes(e.status) || e.completedAt);
  const schedule = active.flatMap((e: any) => e.offering.sessions.filter((s: any) => s.date >= now()).map((s: any) => ({ kind: "Class session", enrollment: e, session: s, title: s.topic, date: s.date, time: s.startTime, href: canReceiveSessionRouteLink(e.status) ? `/student/learning/sessions/${s.id}` : null, status: s.isCancelled ? "CANCELLED" : e.status, location: e.status === "WAITLISTED" ? "Shared after enrollment" : e.offering.deliveryMode === "VIRTUAL" ? "Authorized online link" : e.offering.locationName }))).sort((a: any, b: any) => +a.date - +b.date);

  // Applications: pending guardian approvals (already computed above) plus
  // active/offered waitlist entries — the two states where the student is
  // "applying" for a spot rather than already enrolled.
  const applications = [
    ...approvals.map((a: any) => ({ kind: "Guardian approval", title: a.offering?.title ?? "Approval needed", status: a.status, date: a.requestedAt, offeringId: a.offeringId, href: "/student/learning" })),
    ...waitlists.filter((w: any) => w.status === "ACTIVE" || w.status === "OFFERED").map((w: any) => ({ kind: "Waitlist", title: w.offering?.title ?? "Waitlist", status: w.status, date: w.offerExpiresAt ?? w.updatedAt, offeringId: w.offeringId, href: "/student/learning" })),
  ];

  const attention = [
    ...forms.map((f: any) => ({ kind: "Form", title: f.version?.template?.title ?? "Required form", date: f.dueAt, status: f.status, href: `/student/forms/${f.id}` })),
    ...approvals.map((a: any) => ({ kind: "Guardian approval", title: a.offering?.title ?? "Approval needed", date: a.requestedAt, status: a.status, href: "/student/learning" })),
    ...waitlists.filter((w: any) => w.status === "OFFERED").map((w: any) => ({ kind: "Waitlist offer", title: w.offering?.title ?? "Waitlist offer", date: w.offerExpiresAt, status: w.status, href: "/student/learning" })),
  ];
  return { active: active.map(filterStudentFacingRecord), completed: completed.map(filterStudentFacingRecord), applications, waitlists: waitlists.map(filterStudentFacingRecord), forms, approvals, schedule, attention };
}

export async function getStudentClassSpace(studentId: string, classId: string) {
  const row: any = await prisma.classEnrollment.findFirst({ where: { studentId, offeringId: classId, status: { in: ["ENROLLED", "WAITLISTED", "COMPLETED", "DROPPED"] as any } }, include: { offering: { include: safeOfferingInclude } } });
  if (!row) return null;

  const isLimited = row.status === "WAITLISTED" || row.status === "DROPPED";
  const isCompleted = row.status === "COMPLETED";

  const offering = isLimited
    ? {
        ...row.offering,
        sessions: row.offering.sessions.map((s: any) => ({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, isCancelled: s.isCancelled })),
        announcements: [],
      }
    : {
        ...row.offering,
        announcements: row.offering.announcements.filter((a: any) => (a.status === "PUBLISHED" || a.publishedAt != null) && STUDENT_AUDIENCE_VALUES.includes(a.audience)),
      };

  const attendance = isLimited ? [] : await prisma.classAttendanceRecord.findMany({ where: { studentId, session: { offeringId: classId } }, select: { sessionId: true, status: true, checkedInAt: true, notes: true }, orderBy: { checkedInAt: "desc" } });

  const certificate = isCompleted ? await prisma.certificate.findUnique({ where: { recipientId_offeringId: { recipientId: studentId, offeringId: classId } } }).catch(() => null) : null;
  const feedback = isLimited ? [] : await (prisma as any).instructorStudentFeedback.findMany({ where: { offeringId: classId, studentId, releasedToFamilyAt: { not: null } }, orderBy: { releasedToFamilyAt: "desc" } }).catch(() => []);

  return filterStudentFacingRecord({ enrollment: row, offering, attendance, certificate, feedback });
}

export async function getStudentSchedule(studentId: string) { return (await getStudentLearningHub(studentId)).schedule; }
export async function getStudentForms(studentId: string) { return (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: studentId }, include: { version: { include: { template: true } }, offering: { select: { id: true, title: true } }, submissions: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] }).catch(() => []); }
export async function getStudentFormRequirement(studentId: string, requirementId: string) {
  const req = await (prisma as any).familyFormRequirement.findFirst({ where: { id: requirementId, studentUserId: studentId }, include: { version: { include: { template: true } }, offering: { select: { id: true, title: true } }, submissions: { orderBy: { createdAt: "desc" } } } }).catch(() => null);
  return req;
}

export async function getStudentAttendance(studentId: string) {
  const [records, openRequests] = await Promise.all([
    prisma.classAttendanceRecord.findMany({ where: { studentId }, include: { session: { include: { offering: { select: { id: true, title: true, timezone: true } } } } }, orderBy: { checkedInAt: "desc" }, take: 80 }),
    (prisma as any).familySupportRequest.findMany({ where: { studentUserId: studentId, category: "ATTENDANCE", externalStatus: { in: ["SENT", "REVIEWING", "NEED_MORE_INFORMATION"] } }, select: { sessionId: true, externalStatus: true } }).catch(() => []),
  ]);
  const openBySession = new Map(openRequests.filter((r: any) => r.sessionId).map((r: any) => [r.sessionId, r.externalStatus]));
  return records.map((r: any) => ({ ...r, reviewRequestStatus: openBySession.get(r.sessionId) ?? null }));
}

export async function getStudentProgress(studentId: string) {
  const [completed, feedback, certificates, instructorFeedback, attendanceRecords] = await Promise.all([
    prisma.classEnrollment.findMany({ where: { studentId, OR: [{ status: "COMPLETED" as any }, { completedAt: { not: null } }] }, include: { offering: { include: safeOfferingInclude } }, orderBy: { completedAt: "desc" } }),
    prisma.classFeedback.findMany({ where: { studentId }, include: { offering: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" } }).catch(() => []),
    getStudentCertificates(studentId),
    getReleasedInstructorFeedback(studentId),
    prisma.classAttendanceRecord.findMany({ where: { studentId }, select: { status: true, session: { select: { offeringId: true, offering: { select: { title: true } } } } } }),
  ]);

  const attendanceByOffering = new Map<string, { present: number; total: number; title: string }>();
  for (const r of attendanceRecords as any[]) {
    const key = r.session?.offeringId;
    if (!key) continue;
    const entry = attendanceByOffering.get(key) ?? { present: 0, total: 0, title: r.session?.offering?.title ?? "Class" };
    entry.total += 1;
    if (r.status === "PRESENT" || r.status === "LATE") entry.present += 1;
    attendanceByOffering.set(key, entry);
  }
  const attendanceConsistency = Array.from(attendanceByOffering.entries()).map(([offeringId, v]) => ({ offeringId, ...v }));

  return {
    completed: completed.map(filterStudentFacingRecord),
    feedback: feedback.map(filterStudentFacingRecord),
    instructorFeedback,
    certificates,
    attendanceConsistency,
  };
}

export async function getReleasedInstructorFeedback(studentId: string) {
  return (prisma as any).instructorStudentFeedback.findMany({ where: { studentId, releasedToFamilyAt: { not: null } }, include: { offering: { select: { id: true, title: true } } }, orderBy: { releasedToFamilyAt: "desc" } }).catch(() => []);
}

export async function getStudentCertificates(studentId: string) {
  return prisma.certificate.findMany({ where: { recipientId: studentId }, include: { template: true, course: true, pathway: true, offering: { select: { id: true, title: true, template: { select: { title: true } } } } }, orderBy: { issuedAt: "desc" } });
}

export async function getStudentRecommendations(studentId: string) { const learning = await getStudentLearningHub(studentId); const interests = ((await prisma.user.findUnique({ where: { id: studentId }, include: { profile: true } })) as any)?.profile?.interests ?? []; const offerings = await (prisma as any).classOffering.findMany({ where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] }, enrollmentOpen: true, id: { notIn: learning.active.map((e: any) => e.offeringId) } }, include: safeOfferingInclude, orderBy: { startDate: "asc" }, take: 12 }).catch(() => []); return offerings.map((o: any) => filterStudentFacingRecord({ id: o.id, type: "class", title: o.title ?? o.template?.title, source: interests.length ? "Interest match" : "Upcoming YPP opportunity", reason: interests.length ? `Matches your saved interests: ${interests.slice(0, 2).join(", ")}` : "Open for your next YPP step", availability: o.capacity, eligibility: o.template?.learnerFitLabel ?? "Review details for fit", href: `/student/explore/${o.id}`, opportunityHref: `/student/explore/${o.id}`, passionId: null as string | null, createdAt: o.createdAt })); }
export async function getStudentSupportHub(studentId: string) { return (prisma as any).familySupportRequest.findMany({ where: { studentUserId: studentId }, include: { responses: { where: { familyVisible: true }, orderBy: { createdAt: "asc" } }, offering: { select: { id: true, title: true } }, session: { select: { id: true, topic: true, date: true } } }, orderBy: { createdAt: "desc" }, take: 30 }).catch(() => []); }

/**
 * Session-space read for the student portal, with proper enrollment
 * scoping and location/link visibility gated by canReceiveSessionRouteLink.
 * Distinguishes past vs future sessions so the caller can render each
 * differently.
 */
export async function getStudentSessionSpace(studentId: string, sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      offering: { include: { template: true, instructor: { select: { id: true, name: true } }, chapter: { select: { id: true, name: true } } } },
    },
  });
  if (!session) return null;

  const enrollment = await prisma.classEnrollment.findFirst({ where: { studentId, offeringId: session.offeringId, status: { in: ["ENROLLED", "COMPLETED"] as any } } });
  if (!enrollment) return null;
  if (!canReceiveSessionRouteLink(enrollment.status)) return null;

  const isPast = new Date(session.date) < now() || session.isCancelled;
  const attendance = await prisma.classAttendanceRecord.findFirst({ where: { studentId, sessionId } });

  const openReviewRequest = await (prisma as any).familySupportRequest.findFirst({
    where: { studentUserId: studentId, sessionId, category: "ATTENDANCE", externalStatus: { in: ["SENT", "REVIEWING", "NEED_MORE_INFORMATION"] } },
    select: { id: true, externalStatus: true },
  }).catch(() => null);

  const blockingForms = isPast ? [] : await (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: studentId, offeringId: session.offeringId, status: { in: ["REQUIRED", "IN_PROGRESS"] }, blocksAttendance: true }, include: { version: { include: { template: true } } } }).catch(() => []);

  const location = session.offering.deliveryMode === "VIRTUAL"
    ? (session.offering.zoomLink && !isPast && enrollment.status === "ENROLLED" ? session.offering.zoomLink : "Authorized online link")
    : session.offering.locationName ?? "Location pending";

  return filterStudentFacingRecord({ session, enrollment, isPast, attendance, openReviewRequest, blockingForms, location });
}

export async function getParentStudentPortal(guardianId: string, studentId?: string) {
  const rels = await getAccessibleStudentsForGuardian(guardianId);
  const viewableRels = rels.filter((r: any) => canGuardianViewLearning(r));
  const selected = studentId ?? viewableRels[0]?.studentUserId;
  if (selected) {
    const rel = await requireGuardianAccessToStudent(guardianId, selected);
    if (!canGuardianViewLearning(rel as any)) throw new Error("You do not have permission to view this student's learning.");
  }
  return { relationships: rels, selectedStudentId: selected, dashboard: selected ? await getStudentDashboard(selected) : null };
}
export async function getParentScopedProgress(guardianId: string) { const rels = (await getAccessibleStudentsForGuardian(guardianId)).filter((r: any) => canGuardianViewLearning(r)); return Promise.all(rels.map(async r => ({ relationship: r, progress: await getStudentProgress(r.studentUserId) }))); }
export async function getParentScopedAttendance(guardianId: string) { const rels = (await getAccessibleStudentsForGuardian(guardianId)).filter((r: any) => canGuardianViewLearning(r)); return Promise.all(rels.map(async r => ({ relationship: r, attendance: await getStudentAttendance(r.studentUserId) }))); }
export async function getParentScopedRecommendations(guardianId: string) { const rels = (await getAccessibleStudentsForGuardian(guardianId)).filter((r: any) => canGuardianViewLearning(r)); return Promise.all(rels.map(async r => ({ relationship: r, recommendations: (await getStudentRecommendations(r.studentUserId)).map(filterGuardianFacingRecord) }))); }
export async function getParentScopedCertificates(guardianId: string) { const rels = (await getAccessibleStudentsForGuardian(guardianId)).filter((r: any) => canGuardianViewLearning(r)); return Promise.all(rels.map(async r => ({ relationship: r, certificates: (await getStudentCertificates(r.studentUserId)).map(filterGuardianFacingRecord) }))); }
