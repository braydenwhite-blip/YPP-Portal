import { hasRole, hasAdminSubtype, hasAnyAdminSubtype } from "@/lib/authorization-roles";
import type { SessionUser } from "@/lib/auth-supabase";

/**
 * People Strategy — confidential 360 feedback access rules (pure, no DB).
 *
 * One source of truth for "who may read the raw `responseBody` of a 360 feedback
 * response about a subject". The confidential-read tier is the same Leadership /
 * Board tier enforced server-side by `requireLeadership()` (see
 * `lib/people-strategy/feedback-requests.ts`); these predicates centralise the
 * rule so UI, loaders, and tests all agree, and so a subject can be shown a
 * REDACTED record (counts / status) without ever seeing the confidential text.
 *
 * Rules:
 *   - SUPER_ADMIN (org-owner / Board stand-in) can read ALL feedback responses.
 *   - Leadership (the Co-President / People Lead, AdminSubtype `LEADERSHIP`) can
 *     read responses per the People Dashboard policy.
 *   - A normal member CANNOT read confidential peer feedback about themselves.
 *   - A normal member CANNOT read feedback about anyone else.
 */

/** The minimal viewer identity needed to decide feedback-response access. */
export type FeedbackViewer = Pick<
  SessionUser,
  "id" | "roles" | "primaryRole" | "adminSubtypes"
>;

type RoleSubtypeViewer = Pick<SessionUser, "roles" | "primaryRole" | "adminSubtypes">;

/**
 * ADMIN with the `SUPER_ADMIN` subtype — the org-owner / Board stand-in who is a
 * privileged confidential viewer of everything in the People Strategy system.
 */
export function isSuperAdmin(viewer: RoleSubtypeViewer): boolean {
  return (
    hasRole(viewer.roles, "ADMIN", viewer.primaryRole) &&
    hasAdminSubtype(viewer.adminSubtypes, "SUPER_ADMIN")
  );
}

/**
 * ADMIN with the `LEADERSHIP` or `SUPER_ADMIN` subtype — the tier permitted to
 * read confidential 360 feedback (mirrors `requireLeadership()`).
 */
export function isFeedbackLeadership(viewer: RoleSubtypeViewer): boolean {
  return (
    hasRole(viewer.roles, "ADMIN", viewer.primaryRole) &&
    hasAnyAdminSubtype(viewer.adminSubtypes, ["LEADERSHIP", "SUPER_ADMIN"])
  );
}

/** The resolved access decision for a subject's confidential feedback responses. */
export type FeedbackResponseAccess =
  | { canRead: true; scope: "SUPER_ADMIN" | "LEADERSHIP" }
  | { canRead: false; reason: "SUBJECT_CONFIDENTIAL" | "NOT_AUTHORIZED" };

/**
 * Explainable access decision. SUPER_ADMIN always wins (sees everything);
 * Leadership reads per policy; the subject viewing their OWN feedback is denied
 * with `SUBJECT_CONFIDENTIAL` (so the UI can render a redacted record rather
 * than the raw text); everyone else is `NOT_AUTHORIZED`.
 */
export function feedbackResponseAccess(
  viewer: FeedbackViewer,
  subjectUserId: string
): FeedbackResponseAccess {
  if (isSuperAdmin(viewer)) return { canRead: true, scope: "SUPER_ADMIN" };
  if (isFeedbackLeadership(viewer)) return { canRead: true, scope: "LEADERSHIP" };
  if (viewer.id === subjectUserId) {
    return { canRead: false, reason: "SUBJECT_CONFIDENTIAL" };
  }
  return { canRead: false, reason: "NOT_AUTHORIZED" };
}

/**
 * Whether `viewer` may read the raw confidential responses about `subjectUserId`.
 * True only for the Leadership / Board tier (SUPER_ADMIN included). A subject can
 * never read their own confidential peer feedback unless they hold that tier.
 */
export function canReadFeedbackResponses(
  viewer: FeedbackViewer,
  subjectUserId: string
): boolean {
  return feedbackResponseAccess(viewer, subjectUserId).canRead;
}

/**
 * Strip the confidential `responseBody` when `viewer` is not permitted to read
 * it, leaving the surrounding metadata (month, submitted status, collaborator)
 * intact. Returns the row unchanged for authorised readers. Lets a surface show
 * "feedback received" status to a subject without leaking the text.
 */
export function redactFeedbackResponseBody<T extends { responseBody: string | null }>(
  viewer: FeedbackViewer,
  subjectUserId: string,
  response: T
): T {
  if (canReadFeedbackResponses(viewer, subjectUserId)) return response;
  return { ...response, responseBody: null };
}
