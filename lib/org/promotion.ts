/**
 * Pure promotion preview (Phase 8 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 * Given a person's current state and a proposed change, compute the
 * before-saving diff the proposal requires: level/title/ladder movement, access
 * being added vs removed (reusing the Phase 2 access explainer), committee
 * changes, chapter/cohort/mentor changes, and the unresolved "setup items" that
 * feed the Promotion Setup queue. No DB — `promotion-actions.ts` gathers state
 * and applies the change non-destructively.
 */

import {
  TITLE_AUTHORITY,
  type CanonicalTitle,
  type Ladder,
  type PersonAuthority,
} from "@/lib/org/levels";
import { summarizePersonAccess } from "@/lib/org/access-explainer";

export interface PersonPromotionState {
  name: string;
  title: CanonicalTitle | null;
  internalLevel: number | null;
  ladder: Ladder | null;
  chapterId: string | null;
  cohortId: string | null;
  committees: string[];
  hasPrimaryMentor: boolean;
}

export interface PromotionChange {
  /** The new canonical title (may equal the current one for a lateral move). */
  newTitle: CanonicalTitle | null;
  /** undefined = unchanged; null/string = set/clear. */
  newChapterId?: string | null;
  newCohortId?: string | null;
  addCommittees?: string[];
  removeCommittees?: string[];
  /** When set, a new primary mentor is being assigned as part of the promotion. */
  assignMentorId?: string | null;
  effectiveDate: string;
  reason?: string | null;
}

export type PromotionDirection = "promotion" | "lateral" | "demotion" | "none";

export interface PromotionSetupItem {
  code: "chapter" | "mentor" | "committee";
  label: string;
}

export interface PromotionPreview {
  titleFrom: CanonicalTitle | null;
  titleTo: CanonicalTitle | null;
  levelFrom: number | null;
  levelTo: number | null;
  ladderFrom: Ladder | null;
  ladderTo: Ladder | null;
  direction: PromotionDirection;
  accessAdded: string[];
  accessRemoved: string[];
  committeesAdded: string[];
  committeesRemoved: string[];
  chapterChanged: boolean;
  cohortChanged: boolean;
  mentorChanging: boolean;
  setupItems: PromotionSetupItem[];
  setupComplete: boolean;
}

function authorityFor(
  title: CanonicalTitle | null,
  fallbackLevel: number | null,
  fallbackLadder: Ladder | null
): PersonAuthority {
  if (title) {
    const m = TITLE_AUTHORITY[title];
    return {
      title,
      ladder: m.ladder,
      ladderLevel: m.ladderLevel,
      internalLevel: m.internalLevel,
      source: "TITLE",
    };
  }
  return {
    title: null,
    ladder: fallbackLadder,
    ladderLevel: null,
    internalLevel: fallbackLevel,
    source: fallbackLevel != null ? "PERSISTED" : "UNKNOWN",
  };
}

function deriveDirection(
  from: number | null,
  to: number | null,
  titleChanged: boolean
): PromotionDirection {
  if (from != null && to != null) {
    if (to > from) return "promotion";
    if (to < from) return "demotion";
    return titleChanged ? "lateral" : "none";
  }
  return titleChanged ? "lateral" : "none";
}

function diffStatements(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((s) => !beforeSet.has(s)),
    removed: before.filter((s) => !afterSet.has(s)),
  };
}

/** Compute the non-destructive promotion preview. */
export function buildPromotionPreview(
  current: PersonPromotionState,
  change: PromotionChange
): PromotionPreview {
  const beforeAuthority = authorityFor(current.title, current.internalLevel, current.ladder);
  const afterAuthority = authorityFor(change.newTitle, current.internalLevel, current.ladder);

  // Committees after the change.
  const add = change.addCommittees ?? [];
  const remove = new Set(change.removeCommittees ?? []);
  const afterCommittees = Array.from(
    new Set([...current.committees.filter((c) => !remove.has(c)), ...add])
  );
  const committeesAdded = add.filter((c) => !current.committees.includes(c));
  const committeesRemoved = (change.removeCommittees ?? []).filter((c) =>
    current.committees.includes(c)
  );

  // Access diff via the Phase 2 explainer (authority + committees only — mentees
  // and action assignments are unaffected by a promotion).
  const beforeFacts = summarizePersonAccess({
    name: current.name,
    authority: beforeAuthority,
    committees: current.committees,
  }).map((f) => f.statement);
  const afterFacts = summarizePersonAccess({
    name: current.name,
    authority: afterAuthority,
    committees: afterCommittees,
  }).map((f) => f.statement);
  const { added: accessAdded, removed: accessRemoved } = diffStatements(beforeFacts, afterFacts);

  const afterChapterId =
    change.newChapterId !== undefined ? change.newChapterId : current.chapterId;
  const afterHasMentor = change.assignMentorId ? true : current.hasPrimaryMentor;

  // Unresolved setup items for the Promotion Setup queue.
  const setupItems: PromotionSetupItem[] = [];
  if (change.newTitle === "Chapter President" && !afterChapterId) {
    setupItems.push({ code: "chapter", label: "Assign a chapter (required for Chapter President)." });
  }
  if (
    !afterHasMentor &&
    afterAuthority.internalLevel != null &&
    afterAuthority.internalLevel < 5
  ) {
    setupItems.push({ code: "mentor", label: "Assign a primary mentor." });
  }

  const titleChanged = current.title !== change.newTitle;

  return {
    titleFrom: current.title,
    titleTo: change.newTitle,
    levelFrom: beforeAuthority.internalLevel,
    levelTo: afterAuthority.internalLevel,
    ladderFrom: beforeAuthority.ladder,
    ladderTo: afterAuthority.ladder,
    direction: deriveDirection(beforeAuthority.internalLevel, afterAuthority.internalLevel, titleChanged),
    accessAdded,
    accessRemoved,
    committeesAdded,
    committeesRemoved,
    chapterChanged: change.newChapterId !== undefined && change.newChapterId !== current.chapterId,
    cohortChanged: change.newCohortId !== undefined && change.newCohortId !== current.cohortId,
    mentorChanging: Boolean(change.assignMentorId),
    setupItems,
    setupComplete: setupItems.length === 0,
  };
}
