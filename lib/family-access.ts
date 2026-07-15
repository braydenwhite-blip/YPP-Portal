import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, hasRole, type SessionUser } from "@/lib/authorization";

const ACTIVE = { relationshipStatus: "ACTIVE", revokedAt: null } as const;

type GuardianRelationship = {
  id: string; studentUserId: string; guardianUserId: string; relationshipType: string;
  isPrimaryContact: boolean; isEmergencyContact: boolean; relationshipStatus: string;
  canViewLearning: boolean; canManageEnrollment: boolean; canApproveEnrollment: boolean; canSignForms: boolean;
  canUpdateContactInformation: boolean; canManageCommunicationPreferences: boolean; canSubmitSupportRequests: boolean;
  canReceiveProgramNotifications: boolean; verificationState: string; verifiedAt: Date | null; revokedAt: Date | null;
  studentUser?: { id: string; name: string; email: string; primaryRole: string; profile?: any };
};

export type PortalUser = SessionUser & { portalRoles: string[] };

export function getPortalRoles(user: Pick<SessionUser, "roles" | "primaryRole">) {
  const roles = new Set([user.primaryRole ?? "", ...(user.roles ?? [])].filter(Boolean));
  return ["STUDENT", "PARENT", "ADMIN", "STAFF"].filter((role) => roles.has(role));
}

export async function requirePortalUser(): Promise<PortalUser> {
  const user = await requireSessionUser();
  const portalRoles = getPortalRoles(user);
  if (portalRoles.length === 0) redirect("/home");
  return { ...user, portalRoles };
}

export async function requireStudentPortalUser() {
  const user = await requirePortalUser();
  if (!hasRole(user.roles, "STUDENT", user.primaryRole) && !hasRole(user.roles, "ADMIN", user.primaryRole)) redirect("/parent");
  return user;
}

export async function requireGuardianPortalUser() {
  const user = await requirePortalUser();
  if (!hasRole(user.roles, "PARENT", user.primaryRole) && !hasRole(user.roles, "ADMIN", user.primaryRole)) redirect("/student");
  return user;
}

export async function getAccessibleStudentsForGuardian(guardianUserId: string) {
  const relationships = await (prisma as any).studentGuardianRelationship.findMany({
    where: { guardianUserId, ...ACTIVE },
    include: { studentUser: { select: { id: true, name: true, email: true, primaryRole: true, profile: true } } },
    orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
  }) as GuardianRelationship[];

  if (relationships.length > 0) return relationships;

  const legacy = await (prisma as any).parentStudent.findMany({
    where: { parentId: guardianUserId, approvalStatus: "APPROVED", archivedAt: null },
    include: { student: { select: { id: true, name: true, email: true, primaryRole: true, profile: true } } },
  });
  return legacy.map((link: any) => ({
    id: `legacy:${link.id}`, studentUserId: link.studentId, guardianUserId, relationshipType: link.relationship,
    relationshipStatus: "ACTIVE", isPrimaryContact: link.isPrimary, isEmergencyContact: false,
    canViewLearning: true, canManageEnrollment: true, canApproveEnrollment: true, canSignForms: true,
    canUpdateContactInformation: true, canManageCommunicationPreferences: true, canSubmitSupportRequests: true,
    canReceiveProgramNotifications: true, verificationState: "VERIFIED", verifiedAt: link.reviewedAt, revokedAt: null,
    studentUser: link.student,
  })) as GuardianRelationship[];
}

export async function requireGuardianAccessToStudent(guardianUserId: string, studentUserId: string) {
  const students = await getAccessibleStudentsForGuardian(guardianUserId);
  const relationship = students.find((r) => r.studentUserId === studentUserId);
  if (!relationship) throw new Error("You do not have access to this student.");
  return relationship;
}

export const canGuardianViewLearning = (r: Pick<GuardianRelationship, "canViewLearning" | "revokedAt" | "relationshipStatus">) => r.relationshipStatus === "ACTIVE" && !r.revokedAt && r.canViewLearning;
export const canGuardianManageEnrollment = (r: GuardianRelationship) => canGuardianViewLearning(r) && r.canManageEnrollment;
export const canGuardianApproveEnrollment = (r: GuardianRelationship) => canGuardianViewLearning(r) && r.canApproveEnrollment;
export const canGuardianSignForms = (r: GuardianRelationship) => canGuardianViewLearning(r) && r.canSignForms;
export const canGuardianManageCommunicationPreferences = (r: GuardianRelationship) => canGuardianViewLearning(r) && r.canManageCommunicationPreferences;

export function canGuardianUpdateProfileField(r: GuardianRelationship, field: string) {
  return canGuardianViewLearning(r) && r.canUpdateContactInformation && ["parentEmail", "parentPhone", "city", "stateProvince"].includes(field);
}

export function canStudentUpdateProfileField(studentUserId: string, actorUserId: string, field: string) {
  return studentUserId === actorUserId && ["interests", "learningStyle", "primaryGoal", "careerGoal", "leadershipGoal"].includes(field);
}

export function filterStudentFacingRecord<T extends Record<string, any>>(record: T) {
  const { instructorNotes, reviewerNote, blockerNote, reviewNotes, internalNotes, score, safeguardingNotes, ...safe } = record;
  return safe;
}
export const filterGuardianFacingRecord = filterStudentFacingRecord;
