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
