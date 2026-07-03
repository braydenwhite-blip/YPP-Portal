import "server-only";

import type { SessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { hasMentorshipMenteeAccess } from "@/lib/mentorship-access";
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
 * Two access tiers (Mentorship consolidation V1):
 *   - "leadership"   → full record incl. leadership-confidential data
 *                      (`loadDevelopmentRecord`, coaching plans, review cycles).
 *   - "relationship" → the person's own mentor/chair; a scoped, relationship-safe
 *                      view (conversation records, released reviews, sessions,
 *                      the growth plan, opportunities) with NO confidential
 *                      internals — never calls the leadership-gated loaders.
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

export type MentorshipWorkspace = {
  person: { id: string; name: string; email: string; contextLabel: string | null };
  accessLevel: WorkspaceAccessLevel;
  canRecordCheckIn: boolean;
  activeMentorshipId: string | null;
  participantOptions: WorkspaceParticipant[];
  overview: {
    mentorName: string | null;
    statusLabel: string;
    currentFocus: string | null;
    nextAction: { label: string; href: string } | null;
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
  };
  checkIns: ConversationRecordView[];
  timeline: WorkspaceTimelineEvent[];
  opportunities: WorkspaceOpportunity[];
  relationships: {
    primaryMentorName: string | null;
    startedAtLabel: string | null;
    lastConversationLabel: string | null;
    cadenceLabel: string | null;
    outstandingCommitments: number;
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

const DAY_MS = 24 * 60 * 60 * 1000;

function dateLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function relativeDayLabel(d: Date, now: Date): string {
  const days = Math.round((d.getTime() - now.getTime()) / DAY_MS);
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

/** Access + record target for a workspace, or null when the viewer is denied. */
export async function resolveWorkspaceAccess(
  viewer: SessionUser,
  personId: string
): Promise<{
  level: WorkspaceAccessLevel;
  canRecordCheckIn: boolean;
  activeMentorship: {
    id: string;
    mentorId: string;
    chairId: string | null;
    startDate: Date;
    status: string;
    mentor: { name: string | null; email: string };
  } | null;
} | null> {
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
      },
    }),
  ]);

  const ownsRelationship =
    !!activeMentorship &&
    (viewer.id === activeMentorship.mentorId || viewer.id === activeMentorship.chairId);

  const relationship =
    isAdmin ||
    ownsRelationship ||
    (await hasMentorshipMenteeAccess(viewer.id, viewer.roles, personId));

  if (!leadership && !relationship) return null;

  const canRecordCheckIn = !!activeMentorship && (isAdmin || leadership || ownsRelationship);

  return {
    level: leadership ? "leadership" : "relationship",
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
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

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
      where: { OR: [{ subjectId: personId }, { mentorship: { menteeId: personId } }] },
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
      !!row.followUpDate && row.followUpDate.getTime() < startOfToday.getTime();
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
      followUpLabel: row.followUpDate ? relativeDayLabel(row.followUpDate, now) : null,
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
  // the derived timeline already owns to avoid double-counting.
  const COVERED_SOURCE_TYPES = new Set(["mentorship-checkin"]);
  for (const event of growthTimeline.events) {
    if (event.sourceType && COVERED_SOURCE_TYPES.has(event.sourceType)) continue;
    timeline.push({
      atISO: event.occurredAt.toISOString(),
      dateLabel: dateLabel(event.occurredAt),
      kind: "growth",
      label: event.title,
      detail: event.description,
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
  const progressPct =
    totalActions > 0
      ? Math.round((doneActions / totalActions) * 100)
      : totalGoals > 0
        ? Math.round((achievedGoals / totalGoals) * 100)
        : 0;

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
    .filter((r) => r.followUpDate && r.followUpDate.getTime() >= startOfToday.getTime())
    .sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime());
  const nextFollowUp = upcomingFollowUps[0]?.followUpDate ?? null;

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

  const nextAction: { label: string; href: string } | null = isLeadership && record
    ? { label: record.nextStep.label, href: record.nextStep.href }
    : access.canRecordCheckIn
      ? { label: "Log a check-in", href: `/mentorship/people/${personId}?section=check-ins` }
      : null;

  const roleLabel = ROLE_LABELS[person.primaryRole] ?? person.primaryRole;
  const contextLabel = person.chapter?.name
    ? `${roleLabel} · ${person.chapter.name}`
    : roleLabel;

  const participantOptions: WorkspaceParticipant[] = [];
  if (access.activeMentorship) {
    participantOptions.push({
      id: personId,
      name: person.name || person.email,
    });
    participantOptions.push({
      id: access.activeMentorship.mentorId,
      name:
        access.activeMentorship.mentor.name || access.activeMentorship.mentor.email,
    });
  }

  return {
    person: {
      id: person.id,
      name: person.name || person.email,
      email: person.email,
      contextLabel,
    },
    accessLevel: access.level,
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
      outstandingCommitments: upcomingFollowUps.length,
      reviewCycles,
    },
  };
}
