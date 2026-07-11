import {
  viewerRelationshipRole,
} from "@/lib/mentorship/selectors";
import type {
  MentorshipRelationshipFact,
  MentorshipViewModelInput,
} from "@/lib/mentorship/view-model";

import { buildReasonString } from "./ranking";
import { buildResolutionActions, pickPrimaryResolution } from "./resolution";
import {
  emptyQueueSignals,
  type QueueEntityRef,
  type QueueInline,
  type QueueItem,
  type QueueSeverity,
  type QueueSignals,
  type QueueTone,
  QUEUE_ITEM_TYPE_LABELS,
} from "./types";

/**
 * Fold canonical mentorship state into queue loops (Calm Mentorship, Phase 10).
 *
 * Mirrors the Phase-1 focus selectors but emits EVERY open loop (not just the
 * single top focus) as a `QueueItem`, so a mentor / chair / admin closes their
 * mentorship work from the same My-Queue runner as the rest of the portal. Pure:
 * no DB, no clock except the injected `now`; the server loader maps Prisma rows
 * into the Phase-1 fact shape and calls this. Each loop maps 1:1 to a real
 * record and a real completion condition — when the underlying state clears, the
 * loop disappears on the next read. The only inline-completable loop is an
 * overdue commitment (the mentor can mark it done in place); the rest route to
 * the record that owns their mutation.
 */

const ID_PREFIX = "ment:";

function baseSignals(overrides: Partial<QueueSignals>): QueueSignals {
  return { ...emptyQueueSignals(), ...overrides };
}

function makeItem(input: {
  id: string;
  title: string;
  severity: QueueSeverity;
  tone: QueueTone;
  why: string;
  recommendedMove: string;
  resolveLabel: string;
  href: string;
  signals: QueueSignals;
  source: QueueEntityRef | null;
  relatedPerson: QueueEntityRef | null;
  statusLabel: string;
  dueISO?: string | null;
  inline?: QueueInline | null;
}): QueueItem {
  const { resolutions, actions } = buildResolutionActions({
    href: input.href,
    type: "mentorship",
    signals: input.signals,
    resolveLabel: input.resolveLabel,
  });
  const primaryKey = pickPrimaryResolution(input.signals, resolutions);
  const primaryAction = actions[primaryKey] ?? actions.resolve!;
  const secondaryActions = resolutions
    .filter((key) => key !== primaryKey)
    .map((key) => actions[key]!)
    .filter(Boolean);

  return {
    id: input.id,
    type: "mentorship",
    typeLabel: QUEUE_ITEM_TYPE_LABELS.mentorship,
    title: input.title,
    severity: input.severity,
    tone: input.tone,
    source: input.source,
    ownerName: null,
    ownerId: null,
    relatedMeeting: null,
    relatedInitiative: null,
    relatedPerson: input.relatedPerson,
    why: input.why,
    recommendedMove: input.recommendedMove,
    primaryAction,
    secondaryActions,
    resolutions,
    inline: input.inline ?? null,
    statusLabel: input.statusLabel,
    ageLabel: null,
    dueISO: input.dueISO ?? null,
    createdISO: null,
    updatedISO: null,
    signals: input.signals,
    reason: buildReasonString(input.signals),
    score: 0,
    href: input.href,
  };
}

function nextUpcomingSession(fact: MentorshipRelationshipFact, now: Date) {
  return fact.sessions
    .filter(
      (s) => !s.completedISO && !s.cancelledISO && Date.parse(s.scheduledISO) >= now.getTime()
    )
    .sort((a, b) => Date.parse(a.scheduledISO) - Date.parse(b.scheduledISO))[0];
}

function loopsForFact(
  input: MentorshipViewModelInput,
  fact: MentorshipRelationshipFact,
  now: Date
): QueueItem[] {
  const { viewer } = input;
  const role = viewerRelationshipRole(viewer, fact);
  if (role === "none" || fact.status !== "ACTIVE") return [];

  // The queue is officer-tier only, so the loops here are the mentor / chair /
  // admin responsibilities — never the mentee's own reflection.
  const mentorSide = role === "mentor" || role === "admin";
  const chairSide = role === "chair" || role === "admin" || viewer.userId === fact.chairId;
  const detailHref = `/mentorship/people/${fact.menteeId}`;
  const source: QueueEntityRef = {
    type: "mentorship",
    id: fact.id,
    label: fact.menteeName,
  };
  const relatedPerson: QueueEntityRef = {
    type: "person",
    id: fact.menteeId,
    label: fact.menteeName,
  };
  const common = { source, relatedPerson };
  const out: QueueItem[] = [];

  if (mentorSide && fact.reviewChangesRequested) {
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}changes_requested:${fact.id}`,
        title: `Revise ${fact.menteeName}'s review`,
        severity: "high",
        tone: "danger",
        why: `The chair requested changes on ${fact.menteeName}'s review.`,
        recommendedMove: "Revise the review and resubmit it for approval.",
        resolveLabel: "Open review",
        href: `/mentorship/people/${fact.menteeId}?section=reviews&panel=draft`,
        signals: baseSignals({ mine: true, missingNextStep: true }),
        statusLabel: "Changes requested",
      })
    );
  }

  if (mentorSide && fact.reviewDue) {
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}review:${fact.id}`,
        title: `Review ${fact.menteeName}`,
        severity: "high",
        tone: "warning",
        why: `${fact.menteeName} submitted a reflection — your review is due.`,
        recommendedMove: "Write this cycle's monthly review.",
        resolveLabel: "Start review",
        href: `/mentorship/people/${fact.menteeId}?section=reviews&panel=draft`,
        signals: baseSignals({ mine: true }),
        statusLabel: "Review due",
      })
    );
  }

  if (chairSide && fact.reviewPendingChairApproval) {
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}chair_approval:${fact.id}`,
        title: `Approve ${fact.mentorName}'s review of ${fact.menteeName}`,
        severity: "high",
        tone: "warning",
        why: `A review for ${fact.menteeName} is waiting for chair approval.`,
        recommendedMove: "Review and approve, or request changes.",
        resolveLabel: "Open approvals",
        href: `/mentorship/people/${fact.menteeId}?section=reviews&panel=approve`,
        signals: baseSignals({ mine: true }),
        statusLabel: "Awaiting approval",
      })
    );
  }

  if (mentorSide && !fact.kickoffCompleted) {
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}kickoff:${fact.id}`,
        title: `Kick off with ${fact.menteeName}`,
        severity: "medium",
        tone: "info",
        why: "Hold the kickoff to start this mentorship's cycle.",
        recommendedMove: "Schedule and complete the kickoff session.",
        resolveLabel: "Plan kickoff",
        href: detailHref,
        signals: baseSignals({ mine: true, missingNextStep: true }),
        statusLabel: "Kickoff pending",
      })
    );
  }

  const next = nextUpcomingSession(fact, now);
  if (next) {
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}session:${fact.id}:${next.id}`,
        title: `Session with ${fact.menteeName}`,
        severity: "low",
        tone: "info",
        why: "Your next mentorship session is coming up — come prepared.",
        recommendedMove: "Review their goals before the session.",
        resolveLabel: "View session",
        href: detailHref + "?section=check-ins",
        signals: baseSignals({ mine: true, connectedToMeeting: true, quickWin: true }),
        statusLabel: "Upcoming session",
        dueISO: next.scheduledISO,
      })
    );
  }

  for (const commitment of fact.commitments) {
    const overdue =
      commitment.status !== "COMPLETE" &&
      !!commitment.dueISO &&
      Date.parse(commitment.dueISO) < now.getTime();
    if (!overdue) continue;
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}commitment:${commitment.id}`,
        title: commitment.title,
        severity: "high",
        tone: "danger",
        why: `An overdue commitment for ${fact.menteeName} needs to be closed out.`,
        recommendedMove: "Mark it complete, or update it if the plan changed.",
        resolveLabel: "Update commitment",
        href: detailHref,
        signals: baseSignals({
          overdue: true,
          mine: commitment.ownerId === viewer.userId,
        }),
        statusLabel: "Overdue commitment",
        dueISO: commitment.dueISO,
        inline: {
          kind: "mentorship_commitment",
          actionItemId: commitment.id,
          menteeId: fact.menteeId,
          title: commitment.title,
        },
      })
    );
  }

  for (const support of fact.support) {
    if (support.status !== "OPEN" || support.assignedToId !== viewer.userId) continue;
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}support:${support.id}`,
        title: support.title,
        severity: "high",
        tone: "warning",
        why: `An open support request from ${fact.menteeName} is assigned to you.`,
        recommendedMove: "Respond to the request or route it to the right supporter.",
        resolveLabel: "Open request",
        href: "/mentorship/feedback",
        signals: baseSignals({ mine: true, missingNextStep: true }),
        statusLabel: "Open support request",
      })
    );
  }

  for (const feedback of fact.feedback) {
    if (!feedback.awaitingResponse || feedback.responderId !== viewer.userId) continue;
    out.push(
      makeItem({
        ...common,
        id: `${ID_PREFIX}feedback:${feedback.id}`,
        title: `Respond to ${fact.menteeName}'s feedback request`,
        severity: "medium",
        tone: "info",
        why: "A feedback request is waiting for your response.",
        recommendedMove: "Write a short, specific response.",
        resolveLabel: "Respond",
        href: "/mentorship/feedback",
        signals: baseSignals({ mine: true }),
        statusLabel: "Pending feedback",
        dueISO: feedback.requestedISO,
      })
    );
  }

  return out;
}

/** Every open mentorship loop for the viewer, across their relationships. Pure. */
export function queueItemsFromMentorshipFacts(
  input: MentorshipViewModelInput,
  now: Date
): QueueItem[] {
  return input.relationships.flatMap((fact) => loopsForFact(input, fact, now));
}

// --- Mentorship 2 application loops (admin matching pipeline) ----------------

/** The lite slice of an M2 application the queue needs (decoupled from queries). */
export type MentorshipApplicationLoopFact = {
  id: string;
  applicantName: string;
  bucket: "new" | "needsRecommendations" | "hasRecommendations" | "shortlisted" | "held";
};

const M2_NEEDS_RECS = new Set(["new", "needsRecommendations"]);
const M2_DECISION = new Set(["hasRecommendations", "shortlisted"]);

/**
 * Fold open M2 applications into matching loops: ones that still need scored
 * recommendations, and ones with live recommendations waiting on an approve
 * decision. `held` applications are intentionally not loops (they were parked).
 * Pure; the loader passes only applications the officer may act on.
 */
export function queueItemsFromMentorshipApplications(
  applications: MentorshipApplicationLoopFact[]
): QueueItem[] {
  const out: QueueItem[] = [];
  for (const app of applications) {
    const href = `/admin/mentorship/applications/${app.id}`;
    const source: QueueEntityRef = { type: "applicant", id: app.id, label: app.applicantName };
    if (M2_NEEDS_RECS.has(app.bucket)) {
      out.push(
        makeItem({
          id: `${ID_PREFIX}m2_needs_recs:${app.id}`,
          title: `Match ${app.applicantName}`,
          severity: "medium",
          tone: "info",
          why: `${app.applicantName}'s mentorship application has no scored recommendations yet.`,
          recommendedMove: "Generate scored mentor recommendations.",
          resolveLabel: "Open application",
          href,
          signals: baseSignals({ mine: true, missingNextStep: true }),
          source,
          relatedPerson: null,
          statusLabel: "Needs recommendations",
        })
      );
    } else if (M2_DECISION.has(app.bucket)) {
      out.push(
        makeItem({
          id: `${ID_PREFIX}m2_decision:${app.id}`,
          title: `Approve a mentor for ${app.applicantName}`,
          severity: "medium",
          tone: "warning",
          why: `Scored mentors are waiting on a match decision for ${app.applicantName}.`,
          recommendedMove: "Approve the top match, or shortlist / hold.",
          resolveLabel: "Open application",
          href,
          signals: baseSignals({ mine: true }),
          source,
          relatedPerson: null,
          statusLabel: "Decision needed",
        })
      );
    }
  }
  return out;
}
