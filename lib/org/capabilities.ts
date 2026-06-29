/**
 * Ladder capabilities — the single mapping from a person's org-authority
 * (`ladder` + `internalLevel`) to what they can do. Every surface guard should
 * consult these booleans instead of re-deriving access from roles/subtypes, so
 * the ladder stays the one source of truth.
 *
 * PURE (no DB, no I/O) so it is client-safe and unit-testable. Numbers come from
 * the named thresholds in `lib/org/levels.ts` — never inline integers here.
 *
 * Key rules from the org spec:
 *  - The LEADERSHIP ladder inherits ALL instruction-ladder access at/above
 *    Chapter President ("Manager = everything from chapter president").
 *  - Officer and above (internal level >= 5) have universal access — nothing out
 *    of view — EXCEPT other officers' reviews, which are Board-only (level 7).
 *  - The instruction and leadership ladders share the integers 1–4; levels 5–7
 *    exist only on the leadership ladder, so `internalLevel >= 5` unambiguously
 *    means the leadership tier (matching the guards in lib/authorization.ts).
 */

import {
  OFFICER_MIN_LEVEL,
  LEAD_MIN_LEVEL,
  TOP_INTERNAL_LEVEL,
  type PersonAuthority,
} from "@/lib/org/levels";

/** Internal-level landmarks on each ladder (titles → levels in TITLE_AUTHORITY). */
const SENIOR_INSTRUCTOR_LEVEL = 2;
const LEAD_INSTRUCTOR_LEVEL = 3;
const CHAPTER_PRESIDENT_LEVEL = 4;

export interface LadderCapabilities {
  /** Be the accountable Lead on an action (else only Executing / Input). */
  canLeadActions: boolean;
  /** Mentor other instructors (see their data, draft reviews). */
  canMentorInstructors: boolean;
  /** Sit on the Instruction Committee — see/edit all instructors. */
  canAccessInstructionCommittee: boolean;
  /** Issue final approval on curriculum / instructor reviews. */
  canFinalApproveCurriculum: boolean;
  /** Access the chapter-scoped action tracker. */
  canAccessChapterActionTracker: boolean;
  /** Run chapter impact-presentation meetings. */
  canRunChapterImpactMeetings: boolean;
  /** Access the global action tracker (incl. impact meetings). */
  canAccessGlobalActionTracker: boolean;
  /** See the People view. */
  canViewPeopleView: boolean;
  /** See performance / review statistics for leadership (Officer+ only). */
  canSeeLeadershipPerformanceStats: boolean;
  /** Access the outreach databases (parent/student/staff/alumni/sponsor/partner). */
  canAccessOutreachDatabases: boolean;
  /** Universal access — nothing out of view (except officer reviews). */
  hasUniversalAccess: boolean;
  /** Create chapters/roles/people and change roles & titles. */
  canManageOrg: boolean;
  /** See reviews / feedback of officers (Board only). */
  canSeeOfficerReviews: boolean;
}

export function ladderCapabilities(
  authority: PersonAuthority | null | undefined
): LadderCapabilities {
  const level = authority?.internalLevel ?? 0;
  const isLeadership = authority?.ladder === "LEADERSHIP";
  const isInstruction = authority?.ladder === "INSTRUCTION";

  // Universal = Officer and above. (Only the leadership ladder reaches level 5+.)
  const universal = level >= OFFICER_MIN_LEVEL;

  // "Instruction-equivalent" level: how far up the instruction ladder this person
  // effectively sits for instruction-related access. Leadership-ladder members
  // inherit at least Chapter-President-level instruction access.
  const instructionLevel = isInstruction
    ? level
    : isLeadership
      ? Math.max(level, CHAPTER_PRESIDENT_LEVEL)
      : 0;

  return {
    canLeadActions: level >= LEAD_MIN_LEVEL,
    canMentorInstructors: universal || instructionLevel >= SENIOR_INSTRUCTOR_LEVEL,
    canAccessInstructionCommittee: universal || instructionLevel >= LEAD_INSTRUCTOR_LEVEL,
    canFinalApproveCurriculum: universal || instructionLevel >= LEAD_INSTRUCTOR_LEVEL,
    canAccessChapterActionTracker: universal || instructionLevel >= CHAPTER_PRESIDENT_LEVEL,
    canRunChapterImpactMeetings: universal || instructionLevel >= CHAPTER_PRESIDENT_LEVEL,
    // Any leadership rung (Manager+) gets the global tracker; instructors do not.
    canAccessGlobalActionTracker: universal || isLeadership,
    canViewPeopleView: universal || isLeadership,
    canSeeLeadershipPerformanceStats: universal,
    canAccessOutreachDatabases: universal || instructionLevel >= SENIOR_INSTRUCTOR_LEVEL,
    hasUniversalAccess: universal,
    canManageOrg: universal,
    canSeeOfficerReviews: level >= TOP_INTERNAL_LEVEL,
  };
}
