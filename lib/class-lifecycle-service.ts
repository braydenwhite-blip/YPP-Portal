import { prisma } from "@/lib/prisma";

type Owner = "CHAPTER" | "INSTRUCTOR" | "FAMILY" | "STAFF" | "LEADERSHIP";
export type ClassLifecycleStage = "needs_setup" | "needs_instructor" | "recruiting_students" | "family_actions_pending" | "ready_to_launch" | "active" | "needs_follow_up" | "completed" | "cancelled" | "next_session_planning";
export type ClassLifecycleBlocker = { code: string; label: string; owner: Owner; count?: number; dueAt?: Date | null; href?: string };
export type ClassLifecycleView = { offeringId: string; title: string; chapterId: string | null; stage: ClassLifecycleStage; lane: string; blocker: ClassLifecycleBlocker | null; nextAction: string; owner: Owner; counts: { enrolled: number; waitlisted: number; pendingApprovals: number; incompleteForms: number; openSupport: number; sessionsMissingAttendance: number }; nextSession: { id: string; date: Date; topic: string | null; locationReady: boolean; joinReady: boolean } | null };

const LANE_LABELS: Record<ClassLifecycleStage, string> = { needs_setup: "Needs setup", needs_instructor: "Needs instructor", recruiting_students: "Recruiting students", family_actions_pending: "Family actions pending", ready_to_launch: "Ready to launch", active: "Active now", needs_follow_up: "Needs follow-up", completed: "Completed", cancelled: "Completed", next_session_planning: "Next session planning" };

export function deriveClassLifecycle(offering: any, now = new Date()): ClassLifecycleView {
  const sessions = [...(offering.sessions ?? [])].sort((a:any,b:any)=>+new Date(a.date)-+new Date(b.date));
  const nextSession = sessions.find((s:any)=>new Date(s.date) >= now && !s.isCancelled) ?? null;
  const pastSessions = sessions.filter((s:any)=>new Date(s.date) < now && !s.isCancelled);
  const enrolled = (offering.enrollments ?? []).filter((e:any)=>e.status === "ENROLLED");
  const waitlisted = (offering.enrollments ?? []).filter((e:any)=>e.status === "WAITLISTED");
  const pendingApprovals = (offering.guardianApprovalRequests ?? []).filter((r:any)=>r.status === "PENDING");
  const incompleteForms = (offering.familyFormRequirements ?? []).filter((f:any)=>["REQUIRED", "IN_PROGRESS", "CORRECTION_REQUESTED"].includes(f.status));
  const openSupport = (offering.familySupportRequests ?? []).filter((r:any)=>!["RESOLVED", "CLOSED"].includes(r.status));
  const sessionsMissingAttendance = pastSessions.filter((s:any)=>!(s.attendance?.length)).length;
  const hasInstructor = Boolean(offering.instructorId || offering.instructor?.id);
  const firstSession = sessions.find((s:any)=>!s.isCancelled) ?? null;
  const locationReady = Boolean((nextSession?.locationName || offering.locationName || offering.deliveryMode === "VIRTUAL") && (offering.deliveryMode !== "VIRTUAL" || offering.zoomLink || nextSession?.zoomLink));
  let stage: ClassLifecycleStage = "recruiting_students";
  let blocker: ClassLifecycleBlocker | null = null;
  if (offering.status === "CANCELLED") { stage = "cancelled"; blocker = null; }
  else if (offering.status === "COMPLETED") { stage = sessions.length && !nextSession ? "next_session_planning" : "completed"; blocker = { code: "PLAN_NEXT_SESSION", label: "Decide whether this class runs again", owner: "CHAPTER" }; }
  else if (!firstSession || !offering.familyEnrollmentConfig) { stage = "needs_setup"; blocker = { code: "SETUP_INCOMPLETE", label: !firstSession ? "Add class sessions" : "Configure family enrollment", owner: "CHAPTER" }; }
  else if (!hasInstructor) { stage = "needs_instructor"; blocker = { code: "INSTRUCTOR_MISSING", label: "Instructor not assigned", owner: "CHAPTER" }; }
  else if (pendingApprovals.length || incompleteForms.length) { stage = "family_actions_pending"; blocker = { code: pendingApprovals.length ? "GUARDIAN_APPROVALS_PENDING" : "FORMS_INCOMPLETE", label: pendingApprovals.length ? `${pendingApprovals.length} guardian approvals pending` : `${incompleteForms.length} forms incomplete`, owner: "FAMILY", count: pendingApprovals.length || incompleteForms.length }; }
  else if (sessionsMissingAttendance || openSupport.length) { stage = "needs_follow_up"; blocker = { code: sessionsMissingAttendance ? "ATTENDANCE_MISSING" : "SUPPORT_OPEN", label: sessionsMissingAttendance ? `${sessionsMissingAttendance} sessions need attendance` : `${openSupport.length} support requests need response`, owner: sessionsMissingAttendance ? "INSTRUCTOR" : "STAFF", count: sessionsMissingAttendance || openSupport.length }; }
  else if (offering.status === "IN_PROGRESS") { stage = "active"; blocker = null; }
  else if (!locationReady) { stage = "needs_setup"; blocker = { code: "LOCATION_MISSING", label: "First session location or join link missing", owner: "CHAPTER" }; }
  else if (enrolled.length < (offering.template?.minStudents ?? 1)) { stage = "recruiting_students"; blocker = { code: "STUDENTS_NEEDED", label: `Recruit ${Math.max(1, (offering.template?.minStudents ?? 1) - enrolled.length)} more students`, owner: "CHAPTER" }; }
  else { stage = "ready_to_launch"; blocker = null; }
  const owner = blocker?.owner ?? (stage === "active" ? "INSTRUCTOR" : "CHAPTER");
  return { offeringId: offering.id, title: offering.title, chapterId: offering.chapterId ?? null, stage, lane: LANE_LABELS[stage], blocker, owner, nextAction: blocker?.label ?? (stage === "active" ? "Teach the next session and keep attendance current" : "Launch class"), counts: { enrolled: enrolled.length, waitlisted: waitlisted.length, pendingApprovals: pendingApprovals.length, incompleteForms: incompleteForms.length, openSupport: openSupport.length, sessionsMissingAttendance }, nextSession: nextSession ? { id: nextSession.id, date: nextSession.date, topic: nextSession.topic ?? null, locationReady, joinReady: Boolean(nextSession.zoomLink || offering.zoomLink) } : null };
}

export async function getChapterClassPipeline(chapterId: string) {
  const offerings = await (prisma as any).classOffering.findMany({ where: { chapterId }, include: classOperationsInclude(), orderBy: [{ startDate: "asc" }] });
  const items = offerings.map((offering: any) => ({ ...deriveClassLifecycle(offering), href: `/chapter/classes/${offering.id}`, partner: offering.partner?.name ?? null, instructor: offering.instructor?.name ?? null, enrollmentMode: offering.familyEnrollmentConfig?.mode ?? "DIRECT" }));
  return Object.entries(LANE_LABELS).map(([stage, label]) => ({ stage, label, items: items.filter((item: any) => item.stage === stage) }));
}
export function classOperationsInclude() { return { template: true, chapter: true, partner: true, instructor: { select: { id: true, name: true, email: true } }, sessions: { include: { attendance: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }, enrollments: { include: { student: { select: { id: true, name: true, email: true, profile: true } } } }, guardianApprovalRequests: true, familyWaitlistEntries: true, familyFormRequirements: true, familySupportRequests: { include: { responses: true } }, announcements: true, timeline: { orderBy: { createdAt: "desc" }, take: 20 } }; }
export async function getClassOperations(offeringId: string) { const offering = await (prisma as any).classOffering.findUnique({ where: { id: offeringId }, include: classOperationsInclude() }); if (!offering) return null; return { offering, lifecycle: deriveClassLifecycle(offering) }; }
