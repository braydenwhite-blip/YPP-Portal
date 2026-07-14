import type { ClassEnrollmentStatus } from "@prisma/client";

export const UPCOMING_SESSION_ACCESS_STATUSES: readonly ClassEnrollmentStatus[] = ["ENROLLED"];
export const COMPLETED_SESSION_ACCESS_STATUSES: readonly ClassEnrollmentStatus[] = ["ENROLLED", "COMPLETED"];
export const ATTENDANCE_VISIBLE_STATUSES: readonly ClassEnrollmentStatus[] = ["ENROLLED", "COMPLETED"];
export const JOIN_LINK_VISIBLE_STATUSES: readonly ClassEnrollmentStatus[] = ["ENROLLED"];
export const FAMILY_ACTIVE_LEARNING_STATUSES: readonly ClassEnrollmentStatus[] = ["ENROLLED"];
export const FAMILY_HISTORICAL_LEARNING_STATUSES: readonly ClassEnrollmentStatus[] = ["COMPLETED"];

export function canAccessSessionDetail(status: ClassEnrollmentStatus, sessionDate: Date, now = new Date()) {
  if (sessionDate >= now) return UPCOMING_SESSION_ACCESS_STATUSES.includes(status);
  return COMPLETED_SESSION_ACCESS_STATUSES.includes(status);
}
export function canViewAttendance(status: ClassEnrollmentStatus) { return ATTENDANCE_VISIBLE_STATUSES.includes(status); }
export function canViewJoinLogistics(status: ClassEnrollmentStatus, sessionDate: Date, now = new Date()) { return sessionDate >= now && JOIN_LINK_VISIBLE_STATUSES.includes(status); }
export function canReceiveSessionRouteLink(status: ClassEnrollmentStatus) { return status === "ENROLLED" || status === "COMPLETED"; }
export function isFamilyLearningVisible(status: ClassEnrollmentStatus) { return FAMILY_ACTIVE_LEARNING_STATUSES.includes(status) || FAMILY_HISTORICAL_LEARNING_STATUSES.includes(status); }
