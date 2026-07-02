import "server-only";

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import { computeExpectationProgress } from "@/lib/leadership/expectations";
import {
  getLeadershipContext,
  type LeadershipMentorView,
} from "@/lib/leadership-context";
import { getLanesForChair } from "@/lib/mentorship-chair-access";
import { isActionOverdue } from "@/lib/people-strategy/people-dashboard-selectors";
import { startOfDay } from "@/lib/leadership-action-center/dates";

import { deriveCycleDisplayState, type CycleDisplayState } from "./cycle-flow";
import { loadMyReviewInput, type MyReviewInput } from "./cycle-load";
import {
  buildMentorConsoleRows,
  resolveHubViews,
  type HubView,
  type MentorConsoleRow,
  type MentorRowInput,
} from "./hub";
import { loadDevelopmentFactsForPeople } from "./load";
import { deriveDevelopmentSignals } from "./signals";

/**
 * Mentorship hub — loaders for the three perspectives.
 *
 * Confidentiality: the mentee view only ever loads the signed-in person's own
 * data (their mentor, their input duties, their released summaries, their
 * coaching plan). The mentor console loads development facts ONLY for people
 * the viewer actually coaches — active program mentees plus reviewees on
 * cycles they run — mirroring the existing program rule that a mentor sees
 * their own mentees' ratings and review state.
 */

// ── Perspectives ─────────────────────────────────────────────────────────────

export async function loadHubViews(userId: string): Promise<HubView[]> {
  const [leadership, mentorCount, reviewerCycleCount] = await Promise.all([
    requireLeadership().catch(() => null),
    prisma.mentorship.count({ where: { mentorId: userId, status: "ACTIVE" } }),
    prisma.reviewCycle.count({
      where: { reviewerId: userId, state: { not: "COMPLETED" } },
    }),
  ]);
  return resolveHubViews({
    isLeadership: leadership != null,
    mentorsInProgram: mentorCount > 0,
    reviewsCycles: reviewerCycleCount > 0,
  });
}

// ── Mentee home ("My development") ───────────────────────────────────────────

export type MenteeHomeData = {
  mentor: LeadershipMentorView | null;
  stageLabel: string | null;
  nextStageLabel: string | null;
  input: MyReviewInput;
  /** Coaching-plan work the person owns (from reviews + follow-ups). */
  coachingActions: Array<{
    id: string;
    title: string;
    dueLabel: string;
    overdue: boolean;
    href: string;
  }>;
  openFollowUps: Array<{ id: string; title: string; meetingTitle: string; dueLabel: string | null }>;
  /** Their next scheduled review follow-up, if one exists. */
  nextCheckInLabel: string | null;
  /** "What ready for more looks like" — instructor expectation progress. */
  readiness: {
    seniorSummary: string;
    leadSummary: string;
    standingLabel: string;
  } | null;
  /** They're in the legacy mentorship program (show goals/reflection links). */
  inMentorshipProgram: boolean;
};

const STANDING_LABELS: Record<string, string> = {
  LEAD_READY: "Meeting Lead Instructor expectations",
  SENIOR_READY: "Meeting Senior Instructor expectations",
  BELOW_EXPECTATIONS: "Building toward Senior Instructor expectations",
  NO_CONTRIBUTIONS: "No leadership contributions yet — pick one up when ready",
};

export async function loadMenteeHome(userId: string): Promise<MenteeHomeData> {
  const today = startOfDay(new Date());

  const [ctx, input, actions, followUps, nextFollowUp, contributions] =
    await Promise.all([
      getLeadershipContext(userId),
      loadMyReviewInput(),
      prisma.actionItem.findMany({
        where: {
          leadId: userId,
          status: { notIn: ["COMPLETE", "DROPPED"] },
          sourceType: "REVIEW_CYCLE",
        },
        orderBy: { deadlineStart: "asc" },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          deadlineStart: true,
          deadlineEnd: true,
        },
      }),
      prisma.meetingFollowUp.findMany({
        where: { ownerId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: [{ dueDate: "asc" }],
        take: 6,
        select: {
          id: true,
          title: true,
          dueDate: true,
          meeting: { select: { title: true } },
        },
      }),
      prisma.reviewCycle.findFirst({
        where: {
          revieweeId: userId,
          state: "FOLLOW_UP",
          followUpDueAt: { not: null },
        },
        orderBy: { followUpDueAt: "asc" },
        select: { followUpDueAt: true },
      }),
      prisma.leadershipContribution.findMany({
        where: { instructorId: userId },
        select: {
          category: true,
          status: true,
          weight: true,
          isOwnership: true,
          reviewVisible: true,
        },
      }),
    ]);

  const isInstructorTrack =
    ctx?.user.primaryRole === "INSTRUCTOR" || ctx?.user.primaryRole === "MENTOR";
  const progress = isInstructorTrack
    ? computeExpectationProgress(contributions)
    : null;

  return {
    mentor: ctx?.primaryMentor ?? null,
    stageLabel: ctx?.stage?.label ?? null,
    nextStageLabel: ctx?.nextStage?.label ?? null,
    input,
    coachingActions: actions.map((action) => ({
      id: action.id,
      title: action.title,
      dueLabel: formatDueDate(action.deadlineEnd ?? action.deadlineStart),
      overdue: isActionOverdue({ ...action, departmentName: null }, today),
      href: `/actions/${action.id}`,
    })),
    openFollowUps: followUps.map((followUp) => ({
      id: followUp.id,
      title: followUp.title,
      meetingTitle: followUp.meeting.title,
      dueLabel: followUp.dueDate ? formatDueDate(followUp.dueDate) : null,
    })),
    nextCheckInLabel: nextFollowUp?.followUpDueAt
      ? formatDueDate(nextFollowUp.followUpDueAt)
      : null,
    readiness: progress
      ? {
          seniorSummary: progress.senior.summary,
          leadSummary: progress.lead.summary,
          standingLabel: STANDING_LABELS[progress.standing] ?? progress.standing,
        }
      : null,
    inMentorshipProgram: Boolean(ctx?.primaryMentor),
  };
}

// ── Mentor console ───────────────────────────────────────────────────────────

export type MentorConsoleData = {
  rows: MentorConsoleRow[];
  /** The viewer also has chair duties in the monthly loop. */
  showChairQueue: boolean;
};

export async function loadMentorConsole(
  userId: string,
  options: { isAdmin: boolean; adminSubtypes: string[] },
  now: Date = new Date()
): Promise<MentorConsoleData> {
  // The console is strictly the viewer's own coaching load — their active
  // program mentorships (NOT the admin-wide kanban) plus cycles they review.
  const [programMentorships, reviewerCycles] = await Promise.all([
    prisma.mentorship.findMany({
      where: { mentorId: userId, status: "ACTIVE" },
      select: {
        id: true,
        menteeId: true,
        cycleStage: true,
        mentee: { select: { name: true, email: true, primaryRole: true } },
      },
    }),
    prisma.reviewCycle.findMany({
      where: { reviewerId: userId, state: { not: "COMPLETED" } },
      select: {
        id: true,
        revieweeId: true,
        state: true,
        dueDate: true,
        selfInputSubmittedAt: true,
        synthesisSubmittedAt: true,
        followUpDueAt: true,
        releasedToRevieweeAt: true,
        completedAt: true,
        reviewee: { select: { name: true, email: true } },
        feedback: { select: { submittedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const cycleByReviewee = new Map<
    string,
    { id: string; displayState: CycleDisplayState; name: string }
  >();
  for (const cycle of reviewerCycles) {
    if (cycleByReviewee.has(cycle.revieweeId)) continue;
    cycleByReviewee.set(cycle.revieweeId, {
      id: cycle.id,
      name: cycle.reviewee.name || cycle.reviewee.email,
      displayState: deriveCycleDisplayState(
        {
          state: cycle.state,
          dueDate: cycle.dueDate,
          selfInputSubmittedAt: cycle.selfInputSubmittedAt,
          synthesisSubmittedAt: cycle.synthesisSubmittedAt,
          followUpDueAt: cycle.followUpDueAt,
          releasedToRevieweeAt: cycle.releasedToRevieweeAt,
          completedAt: cycle.completedAt,
          feedbackRequested: cycle.feedback.length,
          feedbackSubmitted: cycle.feedback.filter((f) => f.submittedAt).length,
        },
        now
      ),
    });
  }

  // People this viewer coaches: program mentees + reviewees on their cycles.
  const menteeIds = new Set<string>([
    ...programMentorships.map((m) => m.menteeId),
    ...cycleByReviewee.keys(),
  ]);

  // Facts access is scoped to the coaching relationship (see module doc).
  const factsById = await loadDevelopmentFactsForPeople(menteeIds, now);

  const inputs: MentorRowInput[] = [];
  for (const menteeId of menteeIds) {
    const facts = factsById.get(menteeId) ?? null;
    const mentorship =
      programMentorships.find((m) => m.menteeId === menteeId) ?? null;
    const cycle = cycleByReviewee.get(menteeId) ?? null;
    inputs.push({
      menteeId,
      menteeName:
        facts?.name ??
        mentorship?.mentee.name ??
        mentorship?.mentee.email ??
        cycle?.name ??
        "Unknown",
      contextLabel: facts?.contextLabel ?? mentorship?.mentee.primaryRole ?? null,
      signals: facts ? deriveDevelopmentSignals(facts) : [],
      cycle: cycle ? { id: cycle.id, displayState: cycle.displayState } : null,
      program: mentorship
        ? {
            mentorshipId: mentorship.id,
            kickoffPending: mentorship.cycleStage === "KICKOFF_PENDING",
            cycleStage: mentorship.cycleStage,
          }
        : null,
    });
  }

  const chairLanes = await getLanesForChair(userId, options.adminSubtypes);

  return {
    rows: buildMentorConsoleRows(inputs),
    showChairQueue: options.isAdmin || chairLanes.length > 0,
  };
}
