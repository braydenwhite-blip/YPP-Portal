"use server";
import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/authorization";
import { assignInstructor } from "@/lib/instructor-assignment-service";
import { updateEnrollmentOperations } from "@/lib/staff-enrollment-service";
import { createWaitlistOffer, declineWaitlistOffer } from "@/lib/waitlist-operations-service";
import { decideGuardianApproval } from "@/lib/guardian-approval-service";
import { publishFamilyFormVersion, assignFamilyFormRequirement, reviewFamilyFormSubmission } from "@/lib/family-form-admin-service";
import { triageSupportRequest } from "@/lib/family-support-triage-service";
import { recordAttendance } from "@/lib/attendance-service";
import { updateSessionReadiness } from "@/lib/session-readiness-service";
import { upsertAnnouncement, publishAnnouncement } from "@/lib/class-announcement-service";
import { syncOperationalActionsForClass } from "@/lib/operational-action-sync";
import { persistBiweeklyActionPacket } from "@/lib/action-packet-service";
import { createImpactDecision } from "@/lib/impact-meeting-service";
import { createLeadershipIntervention } from "@/lib/leadership-intervention-service";

async function actor() { const u = await requireSessionUser(); return { userId: u.id, roles: u.roles }; }
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const date = (fd: FormData, key: string) => text(fd, key) ? new Date(text(fd, key)) : undefined;

export async function assignInstructorFromWorkspace(fd: FormData) { await assignInstructor(await actor(), text(fd,"offeringId"), text(fd,"instructorId"), text(fd,"reason"), fd.get("overrideReadiness")==="on"); revalidatePath("/chapter/instructors"); }
export async function enrollmentOperationFromWorkspace(fd: FormData) { await updateEnrollmentOperations(await actor(), text(fd,"offeringId"), { enrollmentOpen: text(fd,"enrollmentOpen") ? text(fd,"enrollmentOpen")==="true" : undefined, capacity: text(fd,"capacity") ? Number(text(fd,"capacity")) : undefined, studentId: text(fd,"studentId") || undefined, removeEnrollmentId: text(fd,"removeEnrollmentId") || undefined, reason: text(fd,"reason") }); revalidatePath("/chapter/enrollment"); }
export async function waitlistOfferFromWorkspace(fd: FormData) { await createWaitlistOffer(await actor(), text(fd,"waitlistId"), date(fd,"expiresAt") ?? new Date(Date.now()+72*3600_000), text(fd,"note")); revalidatePath("/chapter/enrollment/waitlists"); }
export async function waitlistDeclineFromWorkspace(fd: FormData) { await declineWaitlistOffer(await actor(), text(fd,"waitlistId"), text(fd,"note")); revalidatePath("/chapter/enrollment/waitlists"); }
export async function guardianDecisionFromWorkspace(fd: FormData) { await decideGuardianApproval(await actor(), text(fd,"requestId"), text(fd,"decision")==="DECLINED" ? "DECLINED" : "APPROVED", text(fd,"note")); revalidatePath("/chapter/enrollment/approvals"); }
export async function publishFormVersionFromWorkspace(fd: FormData) { const fields = text(fd,"fieldsJson") ? JSON.parse(text(fd,"fieldsJson")) : { fields: [] }; await publishFamilyFormVersion(await actor(), text(fd,"templateId"), fields); revalidatePath("/operations/family-forms"); }
export async function assignFormRequirementFromWorkspace(fd: FormData) { await assignFamilyFormRequirement(await actor(), { versionId: text(fd,"versionId"), studentUserId: text(fd,"studentUserId"), offeringId: text(fd,"offeringId"), dueAt: date(fd,"dueAt"), reason: text(fd,"reason"), blocksEnrollment: fd.get("blocksEnrollment")==="on", blocksAttendance: fd.get("blocksAttendance")==="on", staffReviewRequired: fd.get("staffReviewRequired")==="on" }); revalidatePath("/operations/family-forms"); }
export async function reviewFormSubmissionFromWorkspace(fd: FormData) { await reviewFamilyFormSubmission(await actor(), text(fd,"submissionId"), text(fd,"decision") as "APPROVED"|"CORRECTION_REQUESTED"|"WAIVED", text(fd,"note")); revalidatePath("/operations/family-forms/submissions"); }
export async function triageSupportFromWorkspace(fd: FormData) { await triageSupportRequest(await actor(), text(fd,"requestId"), { ownerId: text(fd,"ownerId") || undefined, team: text(fd,"team") || undefined, category: text(fd,"category") || undefined, severity: text(fd,"severity") || undefined, status: text(fd,"status") || "REVIEWING", note: text(fd,"note"), internalComment: text(fd,"internalComment"), familyResponse: text(fd,"familyResponse"), safety: fd.get("safety")==="on" }); revalidatePath("/operations/family-support"); }
export async function attendanceFromWorkspace(classId: string, fd: FormData) { await recordAttendance(await actor(), text(fd,"sessionId"), JSON.parse(text(fd,"recordsJson") || "[]"), fd.get("finalize") === "on"); revalidatePath(`/instructor/classes/${classId}/attendance`); }
export async function readinessFromWorkspace(classId: string, fd: FormData) { await updateSessionReadiness(await actor(), text(fd,"sessionId"), { note: text(fd,"note"), lessonReviewed: fd.get("lessonReviewed")==="on", materialsReviewed: fd.get("materialsReviewed")==="on", studentContextReviewed: fd.get("studentContextReviewed")==="on", confirmReady: fd.get("confirmReady")==="on" }); revalidatePath(`/instructor/classes/${classId}/preparation`); }
export async function announcementFromWorkspace(fd: FormData) { const row = await upsertAnnouncement(await actor(), text(fd,"offeringId"), { title: text(fd,"title"), body: text(fd,"body"), announcementType: text(fd,"announcementType"), audience: text(fd,"audience"), status: "DRAFT" }); if (fd.get("publish")==="on") await publishAnnouncement(await actor(), row.id); revalidatePath("/chapter/announcements"); }
export async function syncActionFromWorkspace(fd: FormData) { await syncOperationalActionsForClass(text(fd,"offeringId")); revalidatePath("/chapter/actions"); }
export async function generatePacketFromWorkspace(fd: FormData) { await persistBiweeklyActionPacket(await actor(), text(fd,"chapterId"), date(fd,"periodStart") ?? new Date(), date(fd,"periodEnd") ?? new Date()); revalidatePath("/chapter/packets"); }
export async function impactDecisionFromWorkspace(fd: FormData) { await createImpactDecision(await actor(), text(fd,"meetingId"), { decision: text(fd,"decision"), rationale: text(fd,"rationale"), ownerId: text(fd,"ownerId") || undefined, chapterId: text(fd,"chapterId"), dueAt: date(fd,"dueAt"), relatedEntityType: text(fd,"relatedEntityType") || undefined, relatedEntityId: text(fd,"relatedEntityId") || undefined }); revalidatePath("/chapter/impact"); }
export async function leadershipInterventionFromWorkspace(fd: FormData) { await createLeadershipIntervention(await actor(), { chapterId: text(fd,"chapterId"), sourceType: text(fd,"sourceType"), sourceId: text(fd,"sourceId"), ownerId: text(fd,"ownerId") || undefined, severity: text(fd,"severity") || "MEDIUM", note: text(fd,"note"), actionItemId: text(fd,"actionItemId") || undefined, dueAt: date(fd,"dueAt") }); revalidatePath("/leadership/interventions"); }
