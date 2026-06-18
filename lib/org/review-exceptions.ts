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

/**
 * Returns the matching exception when `mentor` is allowed to self-finalize a
 * review whose subject (mentee) is `mentee`, or null when none applies.
 */
export function findSelfFinalizeException(
  mentor: PersonRef,
  mentee: PersonRef,
  now: Date = new Date()
): SelfFinalizeException | null {
  for (const exception of SELF_FINALIZE_EXCEPTIONS) {
    if (!exceptionIsActive(exception, now)) continue;
    if (!refsMatch(exception.mentor, mentor)) continue;
    if (exception.mentees.some((m) => refsMatch(m, mentee))) return exception;
  }
  return null;
}
