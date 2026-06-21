/**
 * "Why This Person Has Access" — turns a person's authority + relationships +
 * assignments into the plain-language access statements the proposal asks for.
 *
 * Phase 2 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. PURE (no DB): the
 * server gatherer (`lib/org/access-summary.ts`) collects the facts, this turns
 * them into statements. Mirrors the proposal's example bullets exactly, e.g.
 * "Can view Jackson because Jackson is assigned as their mentee."
 */

import {
  TOP_INTERNAL_LEVEL,
  OFFICER_MIN_LEVEL,
  LEAD_MIN_LEVEL,
  canLeadAction,
  type PersonAuthority,
} from "@/lib/org/levels";

export type AccessFactKind = "grant" | "limit";

export interface AccessFact {
  kind: AccessFactKind;
  /** Stable machine code (for grouping / tests), e.g. "mentee", "chapter_president". */
  code: string;
  /** Plain-language sentence shown to administrators. */
  statement: string;
}

export interface PersonAccessInput {
  name: string;
  authority: PersonAuthority;
  /** Chapter this person presides over, when they are a Chapter President. */
  chapter?: { id: string; name?: string | null } | null;
  isChapterPresident?: boolean;
  /** Active mentees assigned to this person. */
  mentees?: Array<{ id: string; name: string }>;
  /** Committee names this person belongs to (e.g. "Instruction Committee"). */
  committees?: string[];
  /** Action assignments held by this person. */
  actionAssignments?: Array<{
    id: string;
    title?: string | null;
    role: "LEAD" | "EXECUTING" | "INPUT";
  }>;
}

const ROLE_WORD: Record<"LEAD" | "EXECUTING" | "INPUT", string> = {
  LEAD: "Lead",
  EXECUTING: "Executing",
  INPUT: "Input",
};

function authorityStatements(name: string, authority: PersonAuthority): AccessFact[] {
  const facts: AccessFact[] = [];
  const { title, ladder, internalLevel } = authority;

  if (internalLevel == null) return facts;

  if (internalLevel >= TOP_INTERNAL_LEVEL) {
    facts.push({
      kind: "grant",
      code: "board_universal",
      statement: `Can access everything in the portal because they are a ${title ?? "Board Member"}.`,
    });
    return facts;
  }

  if (internalLevel >= OFFICER_MIN_LEVEL) {
    facts.push({
      kind: "grant",
      code: "officer_universal",
      statement: `Has universal operational access across the portal because they are an ${title ?? "Officer"}.`,
    });
  }

  // Leadership ladder unlocks the global Action Tracker (proposal: "Can access
  // the global Action Tracker because they are a Manager.").
  if (ladder === "LEADERSHIP" && internalLevel < OFFICER_MIN_LEVEL) {
    facts.push({
      kind: "grant",
      code: "global_action_tracker",
      statement: `Can access the global Action Tracker because they are a ${title ?? "Manager"}.`,
    });
  }

  // Lead Instructors (and above on the instruction ladder) see instructional
  // data for all instructors.
  if (ladder === "INSTRUCTION" && internalLevel >= LEAD_MIN_LEVEL) {
    facts.push({
      kind: "grant",
      code: "instruction_all_instructors",
      statement: `Can view and edit instructional data for all instructors because they are a ${title ?? "Lead Instructor"}.`,
    });
  }

  return facts;
}

/** Committees implied by the person's title (Lead Instructors ARE on the Instruction Committee). */
function impliedCommittees(authority: PersonAuthority): string[] {
  if (authority.title === "Lead Instructor" || authority.title === "Chapter President") {
    return ["Instruction Committee"];
  }
  return [];
}

function committeeStatement(committee: string): AccessFact {
  if (/instruction committee/i.test(committee)) {
    return {
      kind: "grant",
      code: "instruction_committee",
      statement: "Can approve curriculum because they are a member of the Instruction Committee.",
    };
  }
  return {
    kind: "grant",
    code: "committee",
    statement: `Has ${committee} permissions because they are a member of the ${committee}.`,
  };
}

/**
 * Build the ordered list of access facts for a person. Grants first, then
 * limits (the things they explicitly cannot do), each as a plain sentence.
 */
export function summarizePersonAccess(input: PersonAccessInput): AccessFact[] {
  const facts: AccessFact[] = [];

  facts.push(...authorityStatements(input.name, input.authority));

  // Lead eligibility — a grant when level >= 3, a limit otherwise.
  const lead = canLeadAction(input.authority);
  facts.push(
    lead.eligible
      ? {
          kind: "grant",
          code: "action_lead",
          statement:
            "Can be the accountable Lead on actions because this role is lead-eligible.",
        }
      : {
          kind: "limit",
          code: "action_lead",
          statement:
            "Can help execute actions or give input, but should not be the accountable Lead until promoted to a lead-eligible role.",
        }
  );

  if (input.isChapterPresident && input.chapter) {
    const where = input.chapter.name ? ` of ${input.chapter.name}` : "";
    facts.push({
      kind: "grant",
      code: "chapter_president",
      statement: `Can view and manage this chapter because they are the Chapter President${where}.`,
    });
  }

  for (const mentee of input.mentees ?? []) {
    facts.push({
      kind: "grant",
      code: "mentee",
      statement: `Can view ${mentee.name} because ${mentee.name} is assigned as their mentee.`,
    });
  }

  const committees = Array.from(
    new Set([...(input.committees ?? []), ...impliedCommittees(input.authority)])
  );
  for (const committee of committees) {
    facts.push(committeeStatement(committee));
  }

  for (const assignment of input.actionAssignments ?? []) {
    const what = assignment.title ? `“${assignment.title}”` : "this action";
    facts.push({
      kind: "grant",
      code: "action_assignment",
      statement: `Can view ${what} because they are assigned as ${ROLE_WORD[assignment.role]}.`,
    });
  }

  // Review approval reach — surfaced as a grant or a clear limit.
  const level = input.authority.internalLevel;
  if (level == null) {
    facts.push({
      kind: "limit",
      code: "review_approval",
      statement: "Review approval path still needs role setup before this person can give final approval.",
    });
  } else if (level <= 1) {
    facts.push({
      kind: "limit",
      code: "review_approval",
      statement: "Can draft or receive reviews, but cannot give final approval yet.",
    });
  } else if (level >= TOP_INTERNAL_LEVEL) {
    facts.push({
      kind: "grant",
      code: "review_approval",
      statement: "Can approve any review, including officer review routes that require Board approval.",
    });
  } else {
    facts.push({
      kind: "grant",
      code: "review_approval",
      statement: "Can give final approval to reviews for people in roles below theirs.",
    });
  }

  return facts;
}
