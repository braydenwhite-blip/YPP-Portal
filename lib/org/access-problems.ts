/**
 * Access Problems — records a user SHOULD be able to open (by role / relationship)
 * but a guard currently denies. Directly targets the proposal's bug: "Officers
 * cannot click into or view records such as interview reviews."
 *
 * Phase 2 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. PURE: a caller probes
 * the live guards (the `actual` result of trying to open each record) and states
 * the `expected` access (from authority/relationship). This function reports the
 * mismatches. It doubles as the guard-coverage test oracle described in the plan.
 */

export interface AccessProbe {
  /** Resource family, e.g. "interview_review", "chapter", "review_spine". */
  resourceType: string;
  resourceId: string;
  /** Human label for the queue row. */
  label: string;
  /** Should this user be able to open it, per role/relationship? */
  expected: boolean;
  /** Could they actually open it (the live guard's verdict)? */
  actual: boolean;
  /** Why access was expected (feeds the queue row + "Why This Person Has Access"). */
  expectedReason?: string;
}

export interface AccessProblem {
  resourceType: string;
  resourceId: string;
  label: string;
  reason: string;
}

/**
 * Returns the probes where access was expected but denied — the Access Problems
 * queue. (expected && !actual). Everything else is healthy and omitted.
 */
export function detectAccessProblems(probes: AccessProbe[]): AccessProblem[] {
  const problems: AccessProblem[] = [];
  for (const probe of probes) {
    if (probe.expected && !probe.actual) {
      problems.push({
        resourceType: probe.resourceType,
        resourceId: probe.resourceId,
        label: probe.label,
        reason:
          probe.expectedReason ??
          "You should be able to open this based on your role or relationship, but access was denied.",
      });
    }
  }
  return problems;
}

/** True when any probe shows expected-but-denied access. */
export function hasAccessProblems(probes: AccessProbe[]): boolean {
  return probes.some((p) => p.expected && !p.actual);
}
