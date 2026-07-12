import "server-only";

import type { SessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { defaultGrowthEventTitle, isGrowthEventType } from "@/lib/growth/events";
import {
  loadDevelopmentRecord,
  type DevelopmentRecord,
} from "@/lib/development/record";
import { loadPersonGrowthTimeline } from "@/lib/growth/queries";
import { mentorshipRequiresChairApproval } from "@/lib/mentorship-canonical";
import {
  computeCycleStage,
  getCurrentCycleMonth,
  getReflectionSoftDeadline,
} from "@/lib/mentorship-cycle";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { isChairForLane } from "@/lib/mentorship-chair-access";

import { hasMentorshipCommandAccess } from "./command-access";
import {
  buildCycleStrip,
  defaultLifecycleHrefs,
  deriveCycleState,
  deriveNextAction,
  deriveReviewCapabilities,
  type CycleState,
  type CycleStripStep,
  type LifecycleNextAction,
  type LifecyclePov,
  type LifecycleSnapshot,
  type ReviewCapabilities,
} from "./lifecycle";
import {
  getLatestCoachingPlan,
  getMyReleasedCoachingPlan,
  type CoachingPlan,
} from "./person-extras";
import { loadParticipationsForUser } from "./cycle-load";
import { STAGE_META } from "./cycle-constants";
import { isQuarterlyCycle, findQuarterlyReview } from "./quarterly-review";
import { currentQuarterLabel } from "@/lib/people-strategy/people-performance-selectors";

/**
 * The unified Mentorship workspace loader — one person's complete development
 * journey assembled from the canonical lifecycle objects (Mentorship, GRDocument,
 * MentorshipCheckIn, MonthlySelfReflection → MentorGoalReview → MenteeReviewAck,
 * MentorshipActionItem). No parallel data stores: Growth-OS and advising rows
 * belong to their own flag-gated domains and are not loaded here.
 *
 * Two access tiers:
 *   - "leadership"   → full record incl. leadership-confidential data
 *                      (`loadDevelopmentRecord`, coaching plans, review cycles).
 *   - "relationship" → the assigned mentor/chair, or the person themselves; a
 *                      scoped, relationship-safe view (conversation records,
 *                      released reviews, sessions, commitments) with NO
 *                      confidential internals — never calls the
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

/** An owned, due-dated follow-up commitment (MentorshipActionItem). */
export type WorkspaceCommitment = {
  id: string;
  title: string;
  details: string | null;
  ownerName: string | null;
  ownedByPerson: boolean;
  dueLabel: string | null;
  overdue: boolean;
  completed: boolean;
  completedLabel: string | null;
  /** Set when this commitment came out of a released mentor review. */
  fromReviewLabel: string | null;
};

export type WorkspaceSession = {
  id: string;
  title: string;
  scheduledISO: string;
  scheduledLabel: string;
};

export type WorkspaceParticipant = { id: string; name: string };

export type MentorshipWorkspace = {
  person: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    roleLabel: string;
    chapterName: string | null;
    contextLabel: string | null;
  };
  accessLevel: WorkspaceAccessLevel;
  isSelf: boolean;
  /** True when the viewer holds ADMIN — gates admin-only relationship controls. */
  isAdmin: boolean;
  /** True when the viewer is the assigned mentor on the active pairing. */
  isMentor: boolean;
  /** The viewer's lifecycle point of view — drives every next-action verb. */
  pov: LifecyclePov;
  canRecordCheckIn: boolean;
  /** Authorized to repair relationship, G&R, and Role Chair setup. */
  canManageSetup: boolean;
  /** What this viewer can actually do — drives which panels/controls render. */
  capabilities: ReviewCapabilities;
  activeMentorshipId: string | null;
  participantOptions: WorkspaceParticipant[];
  /** The canonical lifecycle state + the one thing to do next. */
  lifecycle: LifecycleSnapshot;
  nextAction: LifecycleNextAction;
  cycleStrip: CycleStripStep[];
  /** The single source of truth for "what happens next" — stage, comment
   * status, owner, and available actions — organizing element for the page. */
  cycleState: CycleState;
  overview: {
    mentorName: string | null;
    mentorEmail: string | null;
    chairName: string | null;
    chairEmail: string | null;
    statusLabel: string;
    currentFocus: string | null;
    upcomingFollowUp: { label: string; dateLabel: string } | null;
    coachingPlan: CoachingPlan | null;
    record: DevelopmentRecord | null;
  };
  /** G&R rollup for stats; the Goals section loads the full document itself. */
  goals: {
    docStatus: LifecycleSnapshot["grDocStatus"];
    docTitle: string | null;
    activeGoals: number;
    completedGoals: number;
    progressLabel: string;
  };
  checkIns: ConversationRecordView[];
  commitments: WorkspaceCommitment[];
  upcomingSessions: WorkspaceSession[];
  timeline: WorkspaceTimelineEvent[];
  relationships: {
    primaryMentorName: string | null;
    chairName: string | null;
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
  isLeadership: boolean;
  /** The assigned mentor on the active pairing — the review's writer. */
  isMentor: boolean;
  /** The assigned chair on the active pairing — the review's approver. */
  isChair: boolean;
  /** An active Role Committee member for this mentorship's program group. */
  isCommitteeMember: boolean;
  /** @deprecated use isMentor / isChair — kept for existing call sites that only need "owns this pairing at all". */
  ownsRelationship: boolean;
  canRecordCheckIn: boolean;
  canManageSetup: boolean;
  capabilities: ReviewCapabilities;
  activeMentorship: {
    id: string;
    mentorId: string;
    chairId: string | null;
    startDate: Date;
    status: string;
    kickoffCompletedAt: Date | null;
    cycleStage: string;
    programGroup: string;
    governanceMode: string;
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
  const [leadership, activeMentorship, personForLane] = await Promise.all([
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
        kickoffCompletedAt: true,
        cycleStage: true,
        programGroup: true,
        governanceMode: true,
        mentor: { select: { name: true, email: true } },
        chair: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: personId }, select: { primaryRole: true } }),
  ]);

  const isMentor = !!activeMentorship && viewer.id === activeMentorship.mentorId;
  const isChairOfPairing = !!activeMentorship && viewer.id === activeMentorship.chairId;
  // The real approval authority is the lane chair (MentorCommitteeChair for
  // the person's role lane) — the same check requireReviewApprover() in
  // lib/goal-review-actions.ts uses, not just whoever happens to be recorded
  // as this specific pairing's chairId. Null-safe: no mappable primaryRole
  // (e.g. MENTOR/STUDENT) or no MentorCommitteeChair row for that lane just
  // yields false, independent of whether an active mentorship exists.
  const laneRoleType = toMenteeRoleType(personForLane?.primaryRole ?? null);
  const isLaneChair = laneRoleType
    ? await isChairForLane(viewer.id, laneRoleType, viewer.adminSubtypes)
    : false;
  const isChair = isChairOfPairing || isLaneChair;
  const isCommitteeMember = activeMentorship
    ? Boolean(
        await prisma.mentorCommitteeMember.findFirst({
          where: {
            userId: viewer.id,
            committee: {
              track: { programGroup: activeMentorship.programGroup as never },
            },
          },
          select: { id: true },
        })
      )
    : false;
  const ownsRelationship = isMentor || isChair;

  // Restricted to the assigned owner: admin, leadership/board, the mentor/chair
  // on the active pairing, or the person themselves. (No chapter-wide access.)
  const hasAccess = isAdmin || leadership || ownsRelationship || isCommitteeMember || isSelf;
  if (!hasAccess) return null;

  // A viewer's OWN record is always the relationship tier — never expose one's
  // own leadership-confidential succession/potential ratings or unreleased plans.
  const level: WorkspaceAccessLevel = leadership && !isSelf ? "leadership" : "relationship";

  const canRecordCheckIn =
    !!activeMentorship && (isAdmin || (leadership && !isSelf) || ownsRelationship || isSelf);
  const canManageSetup = isAdmin || leadership;

  const capabilities = deriveReviewCapabilities({
    isSelf,
    isAdmin,
    isMentor,
    isChair,
    isLeadership: leadership && !isSelf,
    isCommitteeMember,
    canRecordCheckIn,
  });

  return {
    level,
    isSelf,
    isAdmin,
    isLeadership: leadership && !isSelf,
    isMentor,
    isChair,
    isCommitteeMember,
    ownsRelationship,
    canRecordCheckIn,
    canManageSetup,
    capabilities,
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
      phone: true,
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
  const isCommitteeOnly =
    access.isCommitteeMember &&
    !access.isAdmin &&
    !access.isLeadership &&
    !access.isMentor &&
    !access.isChair &&
    !access.isSelf;
  const checkInWhere =
    isCommitteeOnly
      ? { id: { in: [] as string[] } }
      : isFullScope || !access.activeMentorship
      ? { OR: [{ subjectId: personId }, { mentorship: { menteeId: personId } }] }
      : { mentorshipId: access.activeMentorship.id };

  const { cycleMonth, cycleLabel } = getCurrentCycleMonth(now);

  const [
    checkInRows,
    grDoc,
    actionItemRows,
    upcomingSessionRows,
    latestMentorshipAnyStatus,
    latestReleasedReview,
    releasedReviews,
    sessions,
    growthTimeline,
    feedbackRequestRows,
    activeCycleReflection,
    roleChair,
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
    prisma.gRDocument.findFirst({
      where: { userId: personId, status: { in: ["DRAFT", "PENDING_APPROVAL", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        template: { select: { title: true } },
        goals: {
          where: { lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] } },
          select: { lifecycleStatus: true },
        },
      },
    }),
    prisma.mentorshipActionItem.findMany({
      where: { menteeId: personId },
      orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        details: true,
        status: true,
        ownerId: true,
        owner: { select: { name: true, email: true } },
        dueAt: true,
        completedAt: true,
        sourceReview: { select: { cycleMonth: true } },
      },
    }),
    prisma.mentorshipSession.findMany({
      where: {
        menteeId: personId,
        completedAt: null,
        cancelledAt: null,
        scheduledAt: { gte: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      select: { id: true, title: true, scheduledAt: true },
    }),
    access.activeMentorship
      ? Promise.resolve(null)
      : prisma.mentorship.findFirst({
          where: { menteeId: personId },
          orderBy: { startDate: "desc" },
          select: { status: true },
        }),
    prisma.mentorGoalReview.findFirst({
      where: { menteeId: personId, releasedToMenteeAt: { not: null } },
      orderBy: { releasedToMenteeAt: "desc" },
      select: { id: true, reviewAck: { select: { id: true } } },
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
    // Comment-request status for the active cycle — a live-computed dimension
    // of the lifecycle, never a gate. Counts only (never responseBody), so
    // safe to compute regardless of viewer tier.
    prisma.feedbackRequest.findMany({
      where: {
        subjectUserId: personId,
        month: cycleMonth,
        cancelledAt: null,
      },
      select: { submittedAt: true, dueAt: true },
    }),
    access.activeMentorship
      ? prisma.monthlySelfReflection.findFirst({
          where: { mentorshipId: access.activeMentorship.id },
          orderBy: { cycleNumber: "desc" },
          select: {
            id: true,
            cycleNumber: true,
            cycleMonth: true,
            mentorCycleCheckIn: { select: { id: true } },
            goalReview: {
              select: {
                status: true,
                cycleNumber: true,
                cycleMonth: true,
                releasedToMenteeAt: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    (() => {
      const laneRoleType = toMenteeRoleType(person.primaryRole);
      return laneRoleType
        ? prisma.mentorCommitteeChair.findFirst({
            where: { roleType: laneRoleType, isActive: true },
            select: { user: { select: { name: true, email: true } } },
          })
        : Promise.resolve(null);
    })(),
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

  // --- Commitments (MentorshipActionItem) ---
  const monthMs = 30 * DAY_MS;
  const commitments: WorkspaceCommitment[] = actionItemRows
    .filter(
      (item) =>
        !item.completedAt || now.getTime() - item.completedAt.getTime() <= monthMs
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      details: item.details,
      ownerName: item.owner?.name || item.owner?.email || null,
      ownedByPerson: item.ownerId === personId,
      dueLabel: item.dueAt ? relativeDayLabel(item.dueAt, todayMs) : null,
      overdue: !item.completedAt && !!item.dueAt && utcMidnight(item.dueAt) < todayMs,
      completed: !!item.completedAt,
      completedLabel: item.completedAt ? dateLabel(item.completedAt) : null,
      fromReviewLabel: item.sourceReview
        ? `From your ${item.sourceReview.cycleMonth.toLocaleDateString("en-US", {
            month: "long",
            timeZone: "UTC",
          })} review`
        : null,
    }));
  const overdueActionItems = commitments.filter((c) => c.overdue).length;
  const openActionItems = commitments.filter((c) => !c.completed).length;

  const upcomingSessions: WorkspaceSession[] = upcomingSessionRows.map((s) => ({
    id: s.id,
    title: s.title,
    scheduledISO: s.scheduledAt.toISOString(),
    scheduledLabel: `${dateLabel(s.scheduledAt)} · ${relativeDayLabel(s.scheduledAt, todayMs)}`,
  }));

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

  // --- G&R rollup (the only development model) ---
  const grDocStatus: LifecycleSnapshot["grDocStatus"] = grDoc
    ? (grDoc.status as LifecycleSnapshot["grDocStatus"])
    : "NONE";
  const activeGoals = grDoc
    ? grDoc.goals.filter((g) => g.lifecycleStatus === "ACTIVE").length
    : 0;
  const completedGoals = grDoc
    ? grDoc.goals.filter((g) => g.lifecycleStatus === "COMPLETED").length
    : 0;
  const progressLabel =
    grDocStatus === "ACTIVE"
      ? `${activeGoals} active goal${activeGoals === 1 ? "" : "s"} · ${completedGoals} completed`
      : grDocStatus === "NONE"
        ? "No goals yet"
        : "Goals being prepared";

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

  // --- The canonical lifecycle snapshot + next action ---
  // Derive the live stage from the actual reflection/review artifacts instead
  // of trusting the denormalized Mentorship.cycleStage. The stored column is a
  // queue optimization and may be stale after imports or repairs; this
  // workspace is the source users act on, so it must always show live truth.
  const effectiveCycleStage = access.activeMentorship
    ? computeCycleStage({
        mentorship: {
          status: access.activeMentorship.status as never,
          kickoffCompletedAt: access.activeMentorship.kickoffCompletedAt,
        },
        latestReflection: activeCycleReflection,
        latestReview: activeCycleReflection?.goalReview ?? null,
        currentCycleMonth: cycleMonth,
      })
    : null;
  const mentorCheckInComplete = Boolean(
    activeCycleReflection?.mentorCycleCheckIn || activeCycleReflection?.goalReview
  );
  const lifecycleCycleLabel = activeCycleReflection
    ? activeCycleReflection.cycleMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : cycleLabel;
  const reflectionOverdue =
    effectiveCycleStage === "REFLECTION_DUE" && now > getReflectionSoftDeadline(cycleMonth);

  const commentsRequested = feedbackRequestRows.length;
  const commentsSubmitted = feedbackRequestRows.filter((r) => r.submittedAt != null).length;
  const commentsOverdue = feedbackRequestRows.filter(
    (r) => r.submittedAt == null && r.dueAt != null && r.dueAt < now
  ).length;

  // Quarterly Committee Review — only relevant once every 3rd cycle's
  // monthly work is fully released. Scoped to the ACTIVE mentorship
  // specifically (not just menteeId) so a prior mentorship's cycle count
  // never bleeds into a new pairing's quarterly cadence.
  let quarterlyDue = false;
  let quarterlyStatus: LifecycleSnapshot["quarterlyStatus"] = null;
  let quarterlyRequiresBoardApproval = false;
  if (access.activeMentorship && effectiveCycleStage === "APPROVED") {
    const latestApproved = await prisma.mentorGoalReview.findFirst({
      where: {
        mentorshipId: access.activeMentorship.id,
        status: "APPROVED",
        releasedToMenteeAt: { not: null },
      },
      orderBy: { cycleNumber: "desc" },
      select: { cycleNumber: true, cycleMonth: true },
    });
    if (latestApproved && isQuarterlyCycle(latestApproved.cycleNumber)) {
      quarterlyDue = true;
      const quarter = currentQuarterLabel(latestApproved.cycleMonth);
      const existing = await findQuarterlyReview(access.activeMentorship.id, quarter);
      quarterlyStatus = (existing?.status ?? null) as LifecycleSnapshot["quarterlyStatus"];
      quarterlyRequiresBoardApproval = existing?.requiresBoardApproval ?? false;
    }
  }

  const lifecycle: LifecycleSnapshot = {
    hasActiveMentorship: !!access.activeMentorship,
    mentorshipStatus: access.activeMentorship?.status ?? latestMentorshipAnyStatus?.status ?? null,
    kickoffComplete: !!access.activeMentorship?.kickoffCompletedAt,
    cycleStage: effectiveCycleStage as LifecycleSnapshot["cycleStage"],
    mentorName:
      access.activeMentorship?.mentor.name ||
      access.activeMentorship?.mentor.email ||
      null,
    chairName:
      access.activeMentorship?.chair?.name ||
      access.activeMentorship?.chair?.email ||
      roleChair?.user.name ||
      roleChair?.user.email ||
      null,
    grDocStatus,
    cycleLabel: lifecycleCycleLabel,
    activeReflectionId: activeCycleReflection?.id ?? null,
    mentorCheckInComplete,
    reflectionOverdue: !!reflectionOverdue,
    releasedReviewPendingAck: !!latestReleasedReview && !latestReleasedReview.reviewAck,
    requiresChairApproval: access.activeMentorship
      ? mentorshipRequiresChairApproval({
          governanceMode: access.activeMentorship.governanceMode as never,
          programGroup: access.activeMentorship.programGroup as never,
        })
      : true,
    hasRoleChair: Boolean(roleChair),
    overdueFollowUpLabel:
      followUpIsOverdue && latestWithFollowUp?.followUpDate
        ? `Follow-up was due ${dateLabel(latestWithFollowUp.followUpDate)}`
        : null,
    openActionItems,
    overdueActionItems,
    lastCheckInLabel: lastConversation ? dateLabel(lastConversation) : null,
    commentsRequested,
    commentsSubmitted,
    commentsOverdue,
    quarterlyDue,
    quarterlyStatus,
    quarterlyRequiresBoardApproval,
  };

  // Resolve POV from the viewer's actual relationship to THIS pairing first —
  // being Leadership-tier does not override being the assigned mentor. Before
  // this fix, a Leadership member who was also someone's assigned mentor
  // always got the "leadership" verb set (approve/synthesize) and was never
  // prompted to write the review that was, in fact, their job to write.
  const pov: LifecyclePov = access.isSelf
    ? "me"
    : access.isMentor
      ? "mentor"
      : access.isCommitteeMember && !access.isChair && !access.isLeadership
        ? "committee"
      : "leadership"; // covers the assigned chair and any other leadership-tier viewer
  const personName = person.name || person.email;
  const nextAction = deriveNextAction(
    lifecycle,
    pov,
    defaultLifecycleHrefs(personId),
    personName
  );
  const cycleStrip = buildCycleStrip(lifecycle, pov, personName);
  const cycleState = deriveCycleState(
    lifecycle,
    access.capabilities,
    defaultLifecycleHrefs(personId),
    personName
  );

  // --- Overview ---
  const currentFocus =
    firstLine(coachingPlan?.planOfAction ?? null) ??
    firstLine(checkInRows[0]?.discussion ?? checkInRows[0]?.commitments ?? null);

  const roleLabel = ROLE_LABELS[person.primaryRole] ?? person.primaryRole;
  const contextLabel = person.chapter?.name
    ? `${roleLabel} · ${person.chapter.name}`
    : roleLabel;

  const participantOptions: WorkspaceParticipant[] = [];
  if (access.activeMentorship) {
    participantOptions.push({ id: personId, name: personName });
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
      name: personName,
      email: person.email,
      phone: person.phone ?? null,
      roleLabel,
      chapterName: person.chapter?.name ?? null,
      contextLabel,
    },
    accessLevel: access.level,
    isSelf: access.isSelf,
    isAdmin: access.isAdmin,
    isMentor: access.isMentor,
    pov,
    canRecordCheckIn: access.canRecordCheckIn,
    canManageSetup: access.canManageSetup,
    capabilities: access.capabilities,
    activeMentorshipId: access.activeMentorship?.id ?? null,
    participantOptions,
    lifecycle,
    nextAction,
    cycleStrip,
    cycleState,
    overview: {
      mentorName: lifecycle.mentorName,
      mentorEmail: access.activeMentorship?.mentor.email ?? null,
      chairName:
        access.activeMentorship?.chair?.name ||
        access.activeMentorship?.chair?.email ||
        null,
      chairEmail: access.activeMentorship?.chair?.email ?? null,
      statusLabel: access.activeMentorship ? "Active mentorship" : "No active mentorship",
      currentFocus,
      upcomingFollowUp: nextFollowUp
        ? { label: "Upcoming follow-up", dateLabel: dateLabel(nextFollowUp) }
        : null,
      coachingPlan,
      record,
    },
    goals: {
      docStatus: grDocStatus,
      docTitle: grDoc?.template?.title ?? null,
      activeGoals,
      completedGoals,
      progressLabel,
    },
    checkIns,
    commitments,
    upcomingSessions,
    timeline,
    relationships: {
      primaryMentorName: lifecycle.mentorName,
      chairName:
        access.activeMentorship?.chair?.name ||
        access.activeMentorship?.chair?.email ||
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
