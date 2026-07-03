import "server-only";

import type { SessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { defaultGrowthEventTitle, isGrowthEventType } from "@/lib/growth/events";
import {
  loadDevelopmentRecord,
  type DevelopmentRecord,
} from "@/lib/development/record";
import {
  loadGrowthHierarchy,
  loadPersonGrowthTimeline,
  type LoadedHierarchy,
} from "@/lib/growth/queries";

import { hasMentorshipCommandAccess } from "./command-access";
import {
  getLatestCoachingPlan,
  getMyReleasedCoachingPlan,
  type CoachingPlan,
} from "./person-extras";
import { loadParticipationsForUser } from "./cycle-load";
import { STAGE_META } from "./cycle-constants";

/**
 * The unified Mentorship workspace loader — one person's complete development
 * journey assembled from the existing engine (no parallel data stores).
 *
 * Two access tiers:
 *   - "leadership"   → full record incl. leadership-confidential data
 *                      (`loadDevelopmentRecord`, coaching plans, review cycles).
 *   - "relationship" → the assigned mentor/chair, or the person themselves; a
 *                      scoped, relationship-safe view (conversation records,
 *                      released reviews, sessions, growth plan, opportunities)
 *                      with NO confidential internals — never calls the
 *                      leadership-gated loaders.
 *
 * Access is restricted to the assigned owner: admin, leadership/board, the
 * mentor/chair on the ACTIVE pairing, or the person themselves. A viewer's OWN
 * record is always the relationship tier — nobody sees their own confidential
 * succession/potential ratings. Non-leadership relationship viewers only see
 * check-ins from the mentorship they own.
 */

const TONE_ORDER = ["danger", "warning", "info", "brand", "success", "neutral"] as const;
export type WorkspaceTone = (typeof TONE_ORDER)[number];

export type WorkspaceAccessLevel = "leadership" | "relationship";

export type ConversationRecordView = {
  id: string;
  kind: string;
  occurredAtISO: string;
  dateLabel: string;
  authorName: string | null;
  participantNames: string[];
  rating: number | null;
  wins: string | null;
  challenges: string | null;
  discussion: string | null;
  decisions: string | null;
  commitments: string | null;
  notes: string;
  followUpISO: string | null;
  followUpLabel: string | null;
  followUpOverdue: boolean;
};

export type WorkspaceTimelineEvent = {
  atISO: string;
  dateLabel: string;
  kind: string;
  label: string;
  detail: string | null;
  tone: WorkspaceTone;
};

export type WorkspaceOpportunity = {
  id: string;
  source: "computed" | "recommended";
  kind: string;
  title: string;
  detail: string | null;
  href: string | null;
  reason: string | null;
  status: string;
};

export type WorkspaceParticipant = { id: string; name: string };

export type WorkspaceNextAction = { label: string; href: string; reason: string | null };

export type MentorshipWorkspace = {
  person: { id: string; name: string; email: string; contextLabel: string | null };
  accessLevel: WorkspaceAccessLevel;
  isSelf: boolean;
  canRecordCheckIn: boolean;
  activeMentorshipId: string | null;
  participantOptions: WorkspaceParticipant[];
  overview: {
    mentorName: string | null;
    statusLabel: string;
    currentFocus: string | null;
    nextAction: WorkspaceNextAction | null;
    upcomingFollowUp: { label: string; dateLabel: string } | null;
    coachingPlan: CoachingPlan | null;
    record: DevelopmentRecord | null;
  };
  developmentPlan: {
    hierarchy: LoadedHierarchy;
    totalGoals: number;
    activeGoals: number;
    achievedGoals: number;
    progressPct: number;
    progressBasis: "actions" | "goals" | "none";
    progressLabel: string;
  };
  checkIns: ConversationRecordView[];
  timeline: WorkspaceTimelineEvent[];
  opportunities: WorkspaceOpportunity[];
  relationships: {
    primaryMentorName: string | null;
    startedAtLabel: string | null;
    lastConversationLabel: string | null;
    cadenceLabel: string | null;
    upcomingFollowUps: number;
    reviewCycles: Array<{ id: string; name: string; stageLabel: string }>;
  };
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  CHAPTER_PRESIDENT: "Chapter President",
  HIRING_CHAIR: "Hiring Chair",
  INSTRUCTOR: "Instructor",
  MENTOR: "Mentor",
};

/**
 * Growth-event source types that are safe to surface in the scoped
 * (relationship/self) timeline. Anything else — or any event whose type isn't a
 * registered growth type — is skipped and rendered from the registry default
 * title (never the raw emitter text), so a future emitter can't leak confidential
 * strings into a non-leadership view. Leadership sees everything.
 */
const GROWTH_SAFE_SOURCE_TYPES = new Set([
  "mentorship",
  "class",
  "classOffering",
  "certificate",
  "leadership",
  "leadershipContribution",
  "chapter",
  "project",
]);

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dateLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Whole-day relative label, computed midnight-to-midnight in UTC (no time-of-day skew). */
function relativeDayLabel(d: Date, todayMidnightMs: number): string {
  const days = Math.round((utcMidnight(d) - todayMidnightMs) / DAY_MS);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}

function firstLine(text: string | null): string | null {
  if (!text) return null;
  const line = text.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0);
  return line ? line.slice(0, 160) : null;
}

type WorkspaceAccess = {
  level: WorkspaceAccessLevel;
  isSelf: boolean;
  isAdmin: boolean;
  ownsRelationship: boolean;
  canRecordCheckIn: boolean;
  activeMentorship: {
    id: string;
    mentorId: string;
    chairId: string | null;
    startDate: Date;
    status: string;
    mentor: { name: string | null; email: string };
    chair: { name: string | null; email: string } | null;
  } | null;
};

/** Access + record target for a workspace, or null when the viewer is denied. */
export async function resolveWorkspaceAccess(
  viewer: SessionUser,
  personId: string
): Promise<WorkspaceAccess | null> {
  const isSelf = viewer.id === personId;
  const isAdmin = viewer.roles.includes("ADMIN");
  const [leadership, activeMentorship] = await Promise.all([
    hasMentorshipCommandAccess(viewer),
    prisma.mentorship.findFirst({
      where: { menteeId: personId, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        mentorId: true,
        chairId: true,
        startDate: true,
        status: true,
        mentor: { select: { name: true, email: true } },
        chair: { select: { name: true, email: true } },
      },
    }),
  ]);

  const ownsRelationship =
    !!activeMentorship &&
    (viewer.id === activeMentorship.mentorId || viewer.id === activeMentorship.chairId);

  // Restricted to the assigned owner: admin, leadership/board, the mentor/chair
  // on the active pairing, or the person themselves. (No chapter-wide access.)
  const hasAccess = isAdmin || leadership || ownsRelationship || isSelf;
  if (!hasAccess) return null;

  // A viewer's OWN record is always the relationship tier — never expose one's
  // own leadership-confidential succession/potential ratings or unreleased plans.
  const level: WorkspaceAccessLevel = leadership && !isSelf ? "leadership" : "relationship";

  const canRecordCheckIn =
    !!activeMentorship && (isAdmin || (leadership && !isSelf) || ownsRelationship || isSelf);

  return {
    level,
    isSelf,
    isAdmin,
    ownsRelationship,
    canRecordCheckIn,
    activeMentorship,
  };
}

export async function loadMentorshipWorkspace(
  viewer: SessionUser,
  personId: string
): Promise<MentorshipWorkspace | null> {
  const access = await resolveWorkspaceAccess(viewer, personId);
  if (!access) return null;

  const now = new Date();
  const todayMs = utcMidnight(now);

  const person = await prisma.user.findUnique({
    where: { id: personId },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      archivedAt: true,
      chapter: { select: { name: true } },
    },
  });
  if (!person || person.archivedAt) return null;

  const isLeadership = access.level === "leadership";
  // Full check-in history is visible to leadership, admins, and the person
  // themselves. An assigned mentor/chair sees only the pairing they own, so a
  // prior mentor's private notes never surface to a later one.
  const isFullScope = isLeadership || access.isAdmin || access.isSelf;
  const checkInWhere =
    isFullScope || !access.activeMentorship
      ? { OR: [{ subjectId: personId }, { mentorship: { menteeId: personId } }] }
      : { mentorshipId: access.activeMentorship.id };

  const [
    checkInRows,
    hierarchy,
    growthOpportunities,
    advisingRecs,
    releasedReviews,
    sessions,
    growthTimeline,
  ] = await Promise.all([
    prisma.mentorshipCheckIn.findMany({
      where: checkInWhere,
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: {
        id: true,
        kind: true,
        occurredAt: true,
        rating: true,
        wins: true,
        challenges: true,
        discussion: true,
        decisions: true,
        commitments: true,
        notes: true,
        participantIds: true,
        followUpDate: true,
        author: { select: { name: true, email: true } },
      },
    }),
    loadGrowthHierarchy(personId),
    prisma.growthOpportunity.findMany({
      where: { userId: personId, status: { in: ["SUGGESTED", "IN_PROGRESS"] } },
      orderBy: { score: "desc" },
      take: 12,
      select: { id: true, kind: true, title: true, detail: true, href: true, reason: true, status: true },
    }),
    prisma.advisingRecommendation.findMany({
      where: {
        assignment: { studentId: personId, isActive: true },
        status: { in: ["SUGGESTED", "IN_PROGRESS"] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, kind: true, title: true, detail: true, href: true, status: true },
    }),
    prisma.mentorGoalReview.findMany({
      where: { menteeId: personId, releasedToMenteeAt: { not: null } },
      orderBy: { releasedToMenteeAt: "desc" },
      take: 8,
      select: {
        id: true,
        cycleMonth: true,
        overallRating: true,
        releasedToMenteeAt: true,
        mentor: { select: { name: true, email: true } },
      },
    }),
    prisma.mentorshipSession.findMany({
      where: { mentorship: { menteeId: personId }, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        completedAt: true,
        title: true,
        mentorship: { select: { mentor: { select: { name: true, email: true } } } },
      },
    }),
    isGrowthOsEnabled()
      ? loadPersonGrowthTimeline(personId, { take: 40 })
      : Promise.resolve({ events: [], nextCursor: null }),
  ]);

  // Leadership-only enrichments — the confidential record, review cycles, and
  // the full (incl. unreleased) coaching plan.
  const [record, participations, coachingPlan] = isLeadership
    ? await Promise.all([
        loadDevelopmentRecord(personId, now).catch(() => null),
        loadParticipationsForUser(personId).catch(() => []),
        getLatestCoachingPlan(personId).catch(() => null),
      ])
    : [null, [], await getMyReleasedCoachingPlan(personId).catch(() => null)];

  // --- Participants: resolve ids across all check-ins to names. ---
  const participantIds = Array.from(
    new Set(checkInRows.flatMap((row) => row.participantIds))
  );
  const participantUsers = participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const nameById = new Map(
    participantUsers.map((u) => [u.id, u.name || u.email] as const)
  );

  const checkIns: ConversationRecordView[] = checkInRows.map((row) => {
    const followUpOverdue =
      !!row.followUpDate && utcMidnight(row.followUpDate) < todayMs;
    return {
      id: row.id,
      kind: row.kind,
      occurredAtISO: row.occurredAt.toISOString(),
      dateLabel: dateLabel(row.occurredAt),
      authorName: row.author?.name || row.author?.email || null,
      participantNames: row.participantIds
        .map((id) => nameById.get(id))
        .filter((n): n is string => Boolean(n)),
      rating: row.rating,
      wins: row.wins,
      challenges: row.challenges,
      discussion: row.discussion,
      decisions: row.decisions,
      commitments: row.commitments,
      notes: row.notes,
      followUpISO: row.followUpDate?.toISOString() ?? null,
      followUpLabel: row.followUpDate ? relativeDayLabel(row.followUpDate, todayMs) : null,
      followUpOverdue,
    };
  });

  // --- Timeline ---
  const timeline: WorkspaceTimelineEvent[] = [];
  if (isLeadership && record) {
    for (const event of record.timeline) {
      timeline.push({
        atISO: event.atISO,
        dateLabel: event.dateLabel,
        kind: event.kind,
        label: event.label,
        detail: event.detail,
        tone: event.tone,
      });
    }
  } else {
    for (const row of checkInRows) {
      timeline.push({
        atISO: row.occurredAt.toISOString(),
        dateLabel: dateLabel(row.occurredAt),
        kind: "conversation",
        label: row.author?.name
          ? `Check-in with ${row.author.name}`
          : "Check-in logged",
        detail: firstLine(row.discussion || row.wins || row.notes),
        tone: "brand",
      });
    }
    for (const review of releasedReviews) {
      if (!review.releasedToMenteeAt) continue;
      timeline.push({
        atISO: review.releasedToMenteeAt.toISOString(),
        dateLabel: dateLabel(review.releasedToMenteeAt),
        kind: "mentor-review",
        label: "Mentor review released",
        detail: review.mentor
          ? `Mentor: ${review.mentor.name || review.mentor.email}`
          : null,
        tone: "success",
      });
    }
    for (const session of sessions) {
      if (!session.completedAt) continue;
      timeline.push({
        atISO: session.completedAt.toISOString(),
        dateLabel: dateLabel(session.completedAt),
        kind: "session",
        label: session.title || "Mentorship session",
        detail: session.mentorship?.mentor
          ? `With ${session.mentorship.mentor.name || session.mentorship.mentor.email}`
          : null,
        tone: "info",
      });
    }
  }

  // Merge durable growth events (dark until ENABLE_GROWTH_OS). Skip source types
  // the derived timeline already owns; for the scoped tier, only surface known,
  // benign milestone types and render the registry's canonical title (never the
  // raw emitter text) so no future emitter can leak confidential strings.
  for (const event of growthTimeline.events) {
    if (event.sourceType === "mentorship-checkin") continue; // owned by the derived path
    // Scoped tier: only known, benign milestone types, rendered from the registry's
    // canonical title (never raw emitter text) so no future emitter leaks strings.
    let label = event.title;
    if (!isLeadership) {
      if (!isGrowthEventType(event.type)) continue;
      const safeSource = !event.sourceType || GROWTH_SAFE_SOURCE_TYPES.has(event.sourceType);
      if (!safeSource) continue;
      label = defaultGrowthEventTitle(event.type);
    }
    timeline.push({
      atISO: event.occurredAt.toISOString(),
      dateLabel: dateLabel(event.occurredAt),
      kind: "growth",
      label,
      detail: isLeadership ? event.description : null,
      tone: "brand",
    });
  }
  timeline.sort((a, b) => b.atISO.localeCompare(a.atISO));

  // --- Development plan rollup ---
  let totalGoals = 0;
  let activeGoals = 0;
  let achievedGoals = 0;
  let totalActions = 0;
  let doneActions = 0;
  const countGoal = (goal: LoadedHierarchy["looseGoals"][number]) => {
    totalGoals += 1;
    if (goal.status === "ACHIEVED") achievedGoals += 1;
    else if (goal.status === "ACTIVE") activeGoals += 1;
    const actions = [
      ...goal.directActions,
      ...goal.milestones.flatMap((m) => m.actions),
    ];
    for (const action of actions) {
      totalActions += 1;
      if (action.completedAt != null || action.status === "DONE") doneActions += 1;
    }
  };
  for (const vision of hierarchy.visions) vision.goals.forEach(countGoal);
  hierarchy.looseGoals.forEach(countGoal);

  let progressBasis: "actions" | "goals" | "none";
  let progressPct: number;
  let progressLabel: string;
  if (totalActions > 0) {
    progressBasis = "actions";
    progressPct = Math.round((doneActions / totalActions) * 100);
    progressLabel = `${doneActions} of ${totalActions} actions complete`;
  } else if (totalGoals > 0) {
    progressBasis = "goals";
    progressPct = Math.round((achievedGoals / totalGoals) * 100);
    progressLabel = `${achievedGoals} of ${totalGoals} goals achieved`;
  } else {
    progressBasis = "none";
    progressPct = 0;
    progressLabel = "No plan yet";
  }

  // --- Opportunities (computed + human-recommended) ---
  const opportunities: WorkspaceOpportunity[] = [
    ...growthOpportunities.map((o) => ({
      id: o.id,
      source: "computed" as const,
      kind: o.kind,
      title: o.title,
      detail: o.detail,
      href: o.href,
      reason: o.reason,
      status: o.status,
    })),
    ...advisingRecs.map((r) => ({
      id: r.id,
      source: "recommended" as const,
      kind: r.kind,
      title: r.title,
      detail: r.detail,
      href: r.href,
      reason: null,
      status: r.status,
    })),
  ];

  // --- Relationships summary ---
  const lastConversation = checkInRows[0]?.occurredAt ?? null;
  const upcomingFollowUps = checkInRows
    .filter((r) => r.followUpDate && utcMidnight(r.followUpDate) >= todayMs)
    .sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime());
  const nextFollowUp = upcomingFollowUps[0]?.followUpDate ?? null;

  // Most recent check-in that set a follow-up date drives the "follow up now" nudge.
  const latestWithFollowUp = checkInRows.find((r) => r.followUpDate);
  const followUpIsOverdue =
    !!latestWithFollowUp?.followUpDate &&
    utcMidnight(latestWithFollowUp.followUpDate) < todayMs;

  let cadenceLabel: string | null = null;
  if (checkInRows.length >= 2) {
    const recent = checkInRows.slice(0, 6);
    let gapSum = 0;
    for (let i = 0; i < recent.length - 1; i += 1) {
      gapSum += recent[i].occurredAt.getTime() - recent[i + 1].occurredAt.getTime();
    }
    const avgDays = Math.round(gapSum / (recent.length - 1) / DAY_MS);
    cadenceLabel = avgDays > 0 ? `About every ${avgDays} days` : null;
  } else if (access.activeMentorship) {
    cadenceLabel = "Monthly review cycle";
  }

  const reviewCycles = participations.map((p) => ({
    id: p.cycleId,
    name: p.cycleName,
    stageLabel: STAGE_META[p.stage]?.label ?? p.stage,
  }));

  // --- Overview ---
  const currentFocus =
    firstLine(coachingPlan?.planOfAction ?? null) ??
    firstLine(checkInRows[0]?.discussion ?? checkInRows[0]?.commitments ?? null);

  const workspaceBase = `/mentorship/people/${personId}`;
  const toSectionHref = (href: string): string =>
    href === workspaceBase ? `${workspaceBase}?section=check-ins` : href;

  let nextAction: WorkspaceNextAction | null = null;
  if (isLeadership && record) {
    nextAction = {
      label: record.nextStep.label,
      href: toSectionHref(record.nextStep.href),
      reason: record.nextStep.reason ?? null,
    };
  } else if (followUpIsOverdue && latestWithFollowUp?.followUpDate) {
    nextAction = {
      label: "Follow up now",
      href: `${workspaceBase}?section=check-ins`,
      reason: `Follow-up was due ${dateLabel(latestWithFollowUp.followUpDate)}`,
    };
  } else if (access.canRecordCheckIn) {
    nextAction = {
      label: "Log a check-in",
      href: `${workspaceBase}?section=check-ins`,
      reason: lastConversation
        ? `Last conversation ${dateLabel(lastConversation)}`
        : "No check-ins logged yet",
    };
  }

  const roleLabel = ROLE_LABELS[person.primaryRole] ?? person.primaryRole;
  const contextLabel = person.chapter?.name
    ? `${roleLabel} · ${person.chapter.name}`
    : roleLabel;

  const participantOptions: WorkspaceParticipant[] = [];
  if (access.activeMentorship) {
    participantOptions.push({ id: personId, name: person.name || person.email });
    participantOptions.push({
      id: access.activeMentorship.mentorId,
      name: access.activeMentorship.mentor.name || access.activeMentorship.mentor.email,
    });
    if (access.activeMentorship.chairId && access.activeMentorship.chair) {
      participantOptions.push({
        id: access.activeMentorship.chairId,
        name: access.activeMentorship.chair.name || access.activeMentorship.chair.email,
      });
    }
  }

  return {
    person: {
      id: person.id,
      name: person.name || person.email,
      email: person.email,
      contextLabel,
    },
    accessLevel: access.level,
    isSelf: access.isSelf,
    canRecordCheckIn: access.canRecordCheckIn,
    activeMentorshipId: access.activeMentorship?.id ?? null,
    participantOptions,
    overview: {
      mentorName:
        access.activeMentorship?.mentor.name ||
        access.activeMentorship?.mentor.email ||
        null,
      statusLabel: access.activeMentorship ? "Active mentorship" : "No active mentorship",
      currentFocus,
      nextAction,
      upcomingFollowUp: nextFollowUp
        ? { label: "Upcoming follow-up", dateLabel: dateLabel(nextFollowUp) }
        : null,
      coachingPlan,
      record,
    },
    developmentPlan: {
      hierarchy,
      totalGoals,
      activeGoals,
      achievedGoals,
      progressPct,
      progressBasis,
      progressLabel,
    },
    checkIns,
    timeline,
    opportunities,
    relationships: {
      primaryMentorName:
        access.activeMentorship?.mentor.name ||
        access.activeMentorship?.mentor.email ||
        null,
      startedAtLabel: access.activeMentorship
        ? dateLabel(access.activeMentorship.startDate)
        : null,
      lastConversationLabel: lastConversation ? dateLabel(lastConversation) : null,
      cadenceLabel,
      upcomingFollowUps: upcomingFollowUps.length,
      reviewCycles,
    },
  };
}
