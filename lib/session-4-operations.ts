/**
 * @deprecated Session 6 split the operational aggregate into owned domain services.
 * Import from the specific service instead (for example `@/lib/instructor-assignment-service`).
 */
export { getInstructorReadiness, listEligibleInstructorCandidates, assignInstructor, removeInstructor } from "@/lib/instructor-assignment-service";
export { updateEnrollmentOperations } from "@/lib/staff-enrollment-service";
export { createWaitlistOffer, acceptStaffWaitlistOffer, declineWaitlistOffer, expireWaitlistOffers } from "@/lib/waitlist-operations-service";
export { decideGuardianApproval } from "@/lib/guardian-approval-service";
export { publishFamilyFormVersion, assignFamilyFormRequirement, reviewFamilyFormSubmission } from "@/lib/family-form-admin-service";
export { triageSupportRequest } from "@/lib/family-support-triage-service";
export { recordAttendance } from "@/lib/attendance-service";
export { updateSessionReadiness } from "@/lib/session-readiness-service";
export { upsertAnnouncement, publishAnnouncement } from "@/lib/class-announcement-service";
export { syncOperationalActionsForClass, resolveOperationalAction } from "@/lib/operational-action-sync-service";
export { persistBiweeklyActionPacket } from "@/lib/action-packet-service";
export { createImpactDecision } from "@/lib/impact-meeting-service";
export { createLeadershipIntervention } from "@/lib/leadership-intervention-service";
