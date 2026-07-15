/**
 * Review-routing exceptions — explicit, configurable carve-outs that let a
 * mentor finalize a review they drafted WITHOUT a higher-level approver.
 *
 * Phase 1 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. The proposal is
 * explicit that these are "configured as explicit review-routing exceptions,
 * NOT permanently hardcoded into the general permission system" — so they live
 * here as editable data, separate from `lib/org/review-routing.ts` (the rules).
 *
 * Current exceptions:
 *   - Sam may self-finalize reviews for Aveena, Brayden, and Sanvi.
 *   - Zach may self-finalize reviews for Ian and Anthea.
 *   - Aveena's reviews for Jackson, Jennifer, Alina, and Wesley require Board approval.
 *   - Ian's review for Milo requires Board approval.
 *   - Brayden's reviews for top instructors require Board approval.
 *
 * NOTE: entries are keyed by a `PersonRef` (id and/or name). Until Phase 4
 * seeds stable user ids, the `name` fields below are placeholders to be replaced
 * with ids; matching is case-insensitive on either id or name so both work.
 */

export interface PersonRef {
  id?: string | null;
  name?: string | null;
}

export interface SelfFinalizeException {
  /** The mentor/author who may finalize their own draft for these mentees. */
  mentor: PersonRef;
  /** Mentees whose reviews `mentor` may finalize without another approver. */
  mentees: PersonRef[];
  /** When the exception takes effect (ISO date). Absent = always in effect. */
  effectiveFrom?: string;
  note?: string;
}

export interface BoardApprovalReviewRoute {
  /** The mentor/author whose drafts use this approval route. */
  mentor: PersonRef;
  /** Specific mentees whose reviews need Board approval. */
  mentees?: PersonRef[];
  /** Applies when the subject is a top instructor under this mentor. */
  topInstructionMentees?: boolean;
  /** When the route takes effect (ISO date). Absent = always in effect. */
  effectiveFrom?: string;
  note?: string;
}

export const SELF_FINALIZE_EXCEPTIONS: SelfFinalizeException[] = [
  {
    mentor: { name: "Sam" },
    mentees: [{ name: "Aveena" }, { name: "Brayden" }, { name: "Sanvi" }],
    note: "Sam conducts and finalizes these reviews without additional approval.",
  },
  {
    mentor: { name: "Zach" },
    mentees: [{ name: "Ian" }, { name: "Anthea" }],
    note: "Zach conducts and finalizes these reviews without additional approval.",
  },
];

export const BOARD_APPROVAL_REVIEW_ROUTES: BoardApprovalReviewRoute[] = [
  {
    mentor: { name: "Aveena" },
    mentees: [
      { name: "Jackson" },
      { name: "Jennifer" },
      { name: "Alina" },
      { name: "Wesley" },
    ],
    note: "This review route requires Board approval.",
  },
  {
    mentor: { name: "Ian" },
    mentees: [{ name: "Milo" }],
    note: "This review route requires Board approval.",
  },
  {
    mentor: { name: "Brayden" },
    topInstructionMentees: true,
    note: "Brayden's reviews for top instructors require Board approval.",
  },
];

function refToken(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return value.trim().toLowerCase();
}

/** True when two PersonRefs identify the same person (by id, else by name). */
export function refsMatch(a: PersonRef, b: PersonRef): boolean {
  const aId = refToken(a.id);
  const bId = refToken(b.id);
  if (aId && bId) return aId === bId;
  const aName = refToken(a.name);
  const bName = refToken(b.name);
  return Boolean(aName && bName && aName === bName);
}

function exceptionIsActive(exception: SelfFinalizeException, now: Date): boolean {
  if (!exception.effectiveFrom) return true;
  const from = new Date(exception.effectiveFrom);
  if (Number.isNaN(from.getTime())) return true;
  return now >= from;
}

function boardRouteIsActive(route: BoardApprovalReviewRoute, now: Date): boolean {
  if (!route.effectiveFrom) return true;
  const from = new Date(route.effectiveFrom);
  if (Number.isNaN(from.getTime())) return true;
  return now >= from;
}

/**
 * Returns the matching exception when `mentor` is allowed to self-finalize a
 * review whose subject (mentee) is `mentee`, or null when none applies.
 */
export function findSelfFinalizeException(
  mentor: PersonRef,
  mentee: PersonRef,
  now: Date = new Date(),
  exceptions: SelfFinalizeException[] = SELF_FINALIZE_EXCEPTIONS
): SelfFinalizeException | null {
  for (const exception of exceptions) {
    if (!exceptionIsActive(exception, now)) continue;
    if (!refsMatch(exception.mentor, mentor)) continue;
    if (exception.mentees.some((m) => refsMatch(m, mentee))) return exception;
  }
  return null;
}

/**
 * Returns the matching Board-approval route when `mentor` drafted a review for
 * `mentee`, or null when the standard role comparison can decide the approver.
 */
export function findBoardApprovalReviewRoute(
  mentor: PersonRef,
  mentee: PersonRef,
  subjectAuthority?: { ladder?: string | null; internalLevel?: number | null } | null,
  now: Date = new Date(),
  routes: BoardApprovalReviewRoute[] = BOARD_APPROVAL_REVIEW_ROUTES
): BoardApprovalReviewRoute | null {
  for (const route of routes) {
    if (!boardRouteIsActive(route, now)) continue;
    if (!refsMatch(route.mentor, mentor)) continue;
    if (route.mentees?.some((m) => refsMatch(m, mentee))) return route;
    if (
      route.topInstructionMentees &&
      subjectAuthority?.ladder === "INSTRUCTION" &&
      (subjectAuthority.internalLevel ?? 0) >= 3
    ) {
      return route;
    }
  }
  return null;
}
