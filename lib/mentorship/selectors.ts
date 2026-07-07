import type {
  ActiveGoal,
  CurrentUserRole,
  MentorshipFocusKind,
  MentorshipFocusTone,
  MentorshipPermissions,
  MentorshipRelationshipFact,
  MentorshipRelationshipSummary,
  MentorshipRole,
  MentorshipViewerContext,
  MentorshipViewModel,
  MentorshipViewModelInput,
  NextMentorshipFocus,
  PendingFeedback,
  SessionSummary,
  UnresolvedCommitment,
} from "./view-model";

/**
 * Pure selectors that turn normalized mentorship facts into the canonical
 * view-model. No Prisma, no IO — deterministic given (input, now), so every
 * branch is unit-testable. The loader (later phase) maps Prisma rows to the
 * *Fact inputs and calls `buildMentorshipViewModel`.
 */

const ROLE_PRECEDENCE: MentorshipRole[] = ["admin", "mentor", "chair", "mentee"];

/** Lower weight = more urgent; ties broken by the earliest `sortKey`. */
const FOCUS_WEIGHT: Record<MentorshipFocusKind, number> = {
  changes_requested: 1,
  review: 2,
  chair_approval: 2,
  kickoff: 3,
  reflection: 4,
  session: 5,
  commitment: 6,
  feedback: 7,
  support: 8,
};

/** The viewer's role for a single relationship (not their overall role). */
export function viewerRelationshipRole(
  viewer: MentorshipViewerContext,
  fact: MentorshipRelationshipFact
): MentorshipRole {
  if (viewer.userId === fact.mentorId) return "mentor";
  if (viewer.userId === fact.chairId) return "chair";
  if (viewer.userId === fact.menteeId) return "mentee";
  if (viewer.isAdmin) return "admin";
  if (viewer.isChair) return "chair";
  return "none";
}

/** The viewer's overall mentorship standing across all their relationships. */
export function resolveMentorshipRole(
  viewer: MentorshipViewerContext,
  relationships: MentorshipRelationshipFact[]
): CurrentUserRole {
  const roles = new Set<MentorshipRole>();
  if (viewer.isAdmin) roles.add("admin");
  if (viewer.isChair) roles.add("chair");
  for (const fact of relationships) {
    if (fact.mentorId === viewer.userId) roles.add("mentor");
    if (fact.menteeId === viewer.userId) roles.add("mentee");
    if (fact.chairId === viewer.userId) roles.add("chair");
  }

  const ordered = ROLE_PRECEDENCE.filter((role) => roles.has(role));
  return {
    role: ordered[0] ?? "none",
    roles: ordered,
    isDualRole: roles.has("mentor") && roles.has("mentee"),
  };
}

type FocusCandidate = NextMentorshipFocus & { weight: number; sortKey: number };

function candidate(
  kind: MentorshipFocusKind,
  relationshipId: string,
  title: string,
  reason: string,
  ctaLabel: string,
  ctaHref: string,
  tone: MentorshipFocusTone,
  now: Date,
  sortKey?: number
): FocusCandidate {
  return {
    kind,
    relationshipId,
    title,
    reason,
    ctaLabel,
    ctaHref,
    tone,
    inline: null,
    weight: FOCUS_WEIGHT[kind],
    sortKey: sortKey ?? now.getTime(),
  };
}

function detailHref(role: MentorshipRole, menteeId: string): string {
  // The `/mentorship/mentees/[id]` route resolves `[id]` as the mentee's USER
  // id (RelationshipWorkspace looks the mentee up by it and calls notFound()
  // otherwise). Pass `fact.menteeId`, never `fact.id` (the mentorship/relation
  // id) — that mismatch 404s every Calm-mode roster row and focus CTA. Mirrors
  // the canonical builder in lib/queue/from-mentorship.ts.
  return role === "mentee" ? "/mentorship?view=me" : `/mentorship/people/${menteeId}`;
}

function upcomingSession(fact: MentorshipRelationshipFact, now: Date) {
  return fact.sessions
    .filter((s) => !s.completedISO && !s.cancelledISO && Date.parse(s.scheduledISO) >= now.getTime())
    .sort((a, b) => Date.parse(a.scheduledISO) - Date.parse(b.scheduledISO))[0];
}

function isOverdue(dueISO: string | null, now: Date): boolean {
  return !!dueISO && Date.parse(dueISO) < now.getTime();
}

function candidatesForFact(
  viewer: MentorshipViewerContext,
  fact: MentorshipRelationshipFact,
  now: Date
): FocusCandidate[] {
  const role = viewerRelationshipRole(viewer, fact);
  if (role === "none" || fact.status !== "ACTIVE") return [];

  const mentorSide = role === "mentor" || role === "admin";
  const chairSide = role === "chair" || role === "admin" || viewer.userId === fact.chairId;
  const menteeSide = role === "mentee";
  const otherName = menteeSide ? fact.mentorName : fact.menteeName;
  const href = detailHref(role, fact.menteeId);
  const out: FocusCandidate[] = [];

  if (mentorSide && fact.reviewChangesRequested) {
    out.push(
      candidate(
        "changes_requested",
        fact.id,
        "Revise your review",
        `The chair requested changes on ${fact.menteeName}'s review.`,
        "Open review",
        href,
        "attention",
        now
      )
    );
  }
  if (mentorSide && fact.reviewDue) {
    out.push(
      candidate(
        "review",
        fact.id,
        `Review ${fact.menteeName}`,
        `${fact.menteeName} submitted a reflection — your review is due.`,
        "Start review",
        href,
        "attention",
        now
      )
    );
  }
  if (chairSide && fact.reviewPendingChairApproval) {
    out.push(
      candidate(
        "chair_approval",
        fact.id,
        `Approve ${fact.mentorName}'s review`,
        `A review for ${fact.menteeName} is waiting for chair approval.`,
        "Open approvals",
        "/mentorship/reviews",
        "attention",
        now
      )
    );
  }
  if (mentorSide && !fact.kickoffCompleted) {
    out.push(
      candidate(
        "kickoff",
        fact.id,
        `Kick off with ${fact.menteeName}`,
        "Hold the kickoff to start this mentorship.",
        "Plan kickoff",
        href,
        "brand",
        now
      )
    );
  }
  if (menteeSide && fact.reflectionDue) {
    out.push(
      candidate(
        "reflection",
        fact.id,
        "Submit this month's reflection",
        "Your reflection opens this cycle's review.",
        "Open reflection",
        "/mentorship?view=me&section=reflection",
        "brand",
        now
      )
    );
  }

  const next = upcomingSession(fact, now);
  if (next) {
    out.push(
      candidate(
        "session",
        fact.id,
        `Session with ${otherName}`,
        "Your next mentorship session is coming up.",
        "View session",
        menteeSide ? "/mentorship?view=me&section=schedule" : "/mentorship/schedule",
        "brand",
        now,
        Date.parse(next.scheduledISO)
      )
    );
  }

  const overdueCommitment = fact.commitments.find(
    (c) => c.status !== "COMPLETE" && c.ownerId === viewer.userId && isOverdue(c.dueISO, now)
  );
  if (overdueCommitment) {
    out.push(
      candidate(
        "commitment",
        fact.id,
        overdueCommitment.title,
        "An overdue commitment needs to be closed out.",
        "Update commitment",
        href,
        "attention",
        now,
        Date.parse(overdueCommitment.dueISO as string)
      )
    );
  }

  const feedback = fact.feedback.find((f) => f.awaitingResponse && f.responderId === viewer.userId);
  if (feedback) {
    out.push(
      candidate(
        "feedback",
        fact.id,
        "Respond to feedback",
        "A feedback request is waiting for your response.",
        "Respond",
        "/mentorship/feedback",
        "brand",
        now,
        Date.parse(feedback.requestedISO)
      )
    );
  }

  const support = fact.support.find((s) => s.status === "OPEN" && s.assignedToId === viewer.userId);
  if (support) {
    out.push(
      candidate(
        "support",
        fact.id,
        support.title,
        "An open support request is assigned to you.",
        "Open request",
        "/mentorship/feedback",
        "attention",
        now
      )
    );
  }

  return out;
}

function stripCandidate(candidate: FocusCandidate): NextMentorshipFocus {
  const { weight: _weight, sortKey: _sortKey, ...focus } = candidate;
  void _weight;
  void _sortKey;
  return focus;
}

/** The single highest-priority next move for the viewer, or null. */
export function selectNextFocus(input: MentorshipViewModelInput, now: Date): NextMentorshipFocus | null {
  const candidates = input.relationships.flatMap((fact) =>
    candidatesForFact(input.viewer, fact, now)
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.weight - b.weight || a.sortKey - b.sortKey);
  return stripCandidate(candidates[0]);
}

function toSummary(
  viewer: MentorshipViewerContext,
  fact: MentorshipRelationshipFact
): MentorshipRelationshipSummary {
  const role = viewerRelationshipRole(viewer, fact);
  return {
    id: fact.id,
    mentorId: fact.mentorId,
    mentorName: fact.mentorName,
    menteeId: fact.menteeId,
    menteeName: fact.menteeName,
    viewerRole: role,
    status: fact.status,
    cycleStage: fact.cycleStage,
    cycleNumber: fact.cycleNumber,
    colorStatus: fact.releasedColorStatus,
    href: detailHref(role, fact.menteeId),
  };
}

function collectSessions(
  viewer: MentorshipViewerContext,
  facts: MentorshipRelationshipFact[]
): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  for (const fact of facts) {
    const role = viewerRelationshipRole(viewer, fact);
    const href = role === "mentee" ? "/mentorship?view=me&section=schedule" : "/mentorship/schedule";
    for (const session of fact.sessions) {
      if (session.cancelledISO) continue;
      sessions.push({
        id: session.id,
        relationshipId: fact.id,
        type: session.type,
        title: session.title,
        whenISO: session.scheduledISO,
        status: session.completedISO ? "completed" : "upcoming",
        href,
      });
    }
  }
  return sessions.sort((a, b) => Date.parse(a.whenISO) - Date.parse(b.whenISO));
}

function collectGoals(facts: MentorshipRelationshipFact[]): ActiveGoal[] {
  return facts.flatMap((fact) =>
    fact.goals
      .filter((goal) => goal.progressState !== "DONE")
      .map((goal) => ({
        id: goal.id,
        relationshipId: fact.id,
        title: goal.title,
        color: goal.color,
        progressState: goal.progressState,
        dueISO: goal.dueISO,
      }))
  );
}

function collectCommitments(facts: MentorshipRelationshipFact[]): UnresolvedCommitment[] {
  return facts.flatMap((fact) =>
    fact.commitments
      .filter((commitment) => commitment.status !== "COMPLETE")
      .map((commitment) => ({
        id: commitment.id,
        relationshipId: fact.id,
        title: commitment.title,
        status: commitment.status,
        ownerId: commitment.ownerId,
        ownerName: commitment.ownerName,
        dueISO: commitment.dueISO,
      }))
  );
}

function collectPendingFeedback(
  viewer: MentorshipViewerContext,
  facts: MentorshipRelationshipFact[]
): PendingFeedback[] {
  return facts.flatMap((fact) =>
    fact.feedback
      .filter((f) => f.awaitingResponse && f.responderId === viewer.userId)
      .map((f) => ({
        id: f.id,
        relationshipId: fact.id,
        kind: f.kind,
        requestedISO: f.requestedISO,
        href: "/mentorship/feedback",
      }))
  );
}

function derivePermissions(role: CurrentUserRole): MentorshipPermissions {
  const has = (r: MentorshipRole) => role.roles.includes(r);
  const officer = has("admin") || has("chair") || has("mentor");
  return {
    canViewPrivateNotes: officer,
    canRequestFeedback: officer,
    canRespondFeedback: officer,
    canUpdateGoals: officer,
    canCreateCommitment: officer || has("mentee"),
    canScheduleSession: officer,
    canCompleteSession: officer,
    canAssign: has("admin"),
    canReassign: has("admin") || has("chair"),
  };
}

/** Build the canonical mentorship view-model for a viewer. Pure. */
export function buildMentorshipViewModel(
  input: MentorshipViewModelInput,
  now: Date
): MentorshipViewModel {
  const { viewer, relationships } = input;
  const involved = relationships.filter(
    (fact) => viewerRelationshipRole(viewer, fact) !== "none"
  );
  const role = resolveMentorshipRole(viewer, relationships);

  return {
    role,
    relationships: involved.map((fact) => toSummary(viewer, fact)),
    focus: selectNextFocus(input, now),
    sessions: collectSessions(viewer, involved),
    goals: collectGoals(involved),
    commitments: collectCommitments(involved),
    pendingFeedback: collectPendingFeedback(viewer, involved),
    permissions: derivePermissions(role),
  };
}
