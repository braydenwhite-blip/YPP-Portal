"use server";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { revalidatePath } from "next/cache";
import {
  GoalReviewStatus,
  MentorshipCycleStage,
  MentorshipReviewStatus,
} from "@prisma/client";
import { getMentorshipAccessibleMenteeIds } from "@/lib/mentorship-access";
import { getCurrentCycleMonth, getReflectionSoftDeadline } from "@/lib/mentorship-cycle";
import { getCycleStageCTA, stageLabel, type CycleCTA } from "@/lib/mentorship-cycle-cta";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session.user.id;
}

/* ── Goal Review Status Updates ───────────────────── */

const VALID_GOAL_REVIEW_STATUSES: GoalReviewStatus[] = [
  "DRAFT",
  "PENDING_CHAIR_APPROVAL",
  "CHANGES_REQUESTED",
  "APPROVED",
];

export async function updateGoalReviewStage(
  reviewId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!VALID_GOAL_REVIEW_STATUSES.includes(newStatus as GoalReviewStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    await prisma.mentorGoalReview.update({
      where: { id: reviewId },
      data: {
        status: newStatus as GoalReviewStatus,
        ...(newStatus === "APPROVED" ? { chairApprovedAt: new Date() } : {}),
      },
    });

    revalidatePath("/admin/mentorship-program");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update status" };
  }
}

/* ── Monthly Review Status Updates ────────────────── */

const VALID_MONTHLY_REVIEW_STATUSES: MentorshipReviewStatus[] = [
  "DRAFT",
  "PENDING_CHAIR_APPROVAL",
  "APPROVED",
  "RETURNED",
];

export async function updateMonthlyReviewStage(
  reviewId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!VALID_MONTHLY_REVIEW_STATUSES.includes(newStatus as MentorshipReviewStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    await prisma.monthlyGoalReview.update({
      where: { id: reviewId },
      data: {
        status: newStatus as MentorshipReviewStatus,
        ...(newStatus === "APPROVED"
          ? { chairDecisionAt: new Date() }
          : {}),
      },
    });

    revalidatePath("/admin/mentorship-program");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update status" };
  }
}

/* ── Mentee Matching Stage (virtual stages) ───────── */

export async function updateMenteeMatchingStage(
  menteeId: string,
  newStage: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    // Matching stages are virtual (unassigned/shortlisted/matched).
    // Moving to "matched" triggers mentor assignment via the existing
    // approveMentorMatch server action, so drag-to-matched is blocked.
    // Moving to "shortlisted" just tags the mentee.
    if (newStage === "matched") {
      return {
        success: false,
        error: "Use the matching panel to approve matches.",
      };
    }
    // For shortlisting, we don't need a DB change - it's UI-only state
    revalidatePath("/admin/mentorship-program");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update stage" };
  }
}

/* ── Fetch data for mentorship kanban boards ──────── */

export async function getMentorshipGoalReviews() {
  const session = await getSession();
  if (!session?.user?.id) return [];
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) return [];

  const reviews = await prisma.mentorGoalReview.findMany({
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
      selfReflection: {
        select: { cycleNumber: true, cycleMonth: true, submittedAt: true },
      },
      goalRatings: {
        include: { goal: { select: { id: true, title: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return reviews.map((r) => ({
    id: r.id,
    status: r.status,
    mentorId: r.mentorId,
    mentorName: r.mentor.name,
    menteeId: r.menteeId,
    menteeName: r.mentee.name,
    menteeEmail: r.mentee.email,
    menteeRole: r.mentee.primaryRole,
    menteeChapter: r.mentee.chapter?.name ?? null,
    cycleNumber: r.selfReflection.cycleNumber,
    cycleMonth: r.selfReflection.cycleMonth.toISOString(),
    submittedAt: r.selfReflection.submittedAt.toISOString(),
    overallRating: r.overallRating,
    overallComments: r.overallComments,
    planOfAction: r.planOfAction,
    isQuarterly: r.isQuarterly,
    bonusPoints: r.bonusPoints,
    bonusReason: r.bonusReason,
    chairComments: r.chairComments,
    chairApprovedAt: r.chairApprovedAt?.toISOString() ?? null,
    goalRatings: r.goalRatings.map((gr) => ({
      goalTitle: gr.goal?.title ?? "",
      rating: gr.rating,
      comment: gr.comments,
    })),
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getMentorshipMonthlyReviews() {
  const session = await getSession();
  if (!session?.user?.id) return [];
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) return [];

  const reviews = await prisma.monthlyGoalReview.findMany({
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          chapter: { select: { name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return reviews.map((r) => ({
    id: r.id,
    status: r.status,
    mentorName: r.mentor?.name ?? "Unknown",
    menteeId: r.menteeId,
    menteeName: r.mentee.name,
    menteeEmail: r.mentee.email,
    menteeRole: r.mentee.primaryRole,
    menteeChapter: r.mentee.chapter?.name ?? null,
    month: r.month.toISOString(),
    overallStatus: r.overallStatus,
    overallComments: r.overallComments,
    strengths: r.strengths,
    focusAreas: r.focusAreas,
    chairDecisionNotes: r.chairDecisionNotes,
    chairDecisionAt: r.chairDecisionAt?.toISOString() ?? null,
    mentorSubmittedAt: r.mentorSubmittedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

/* ── Phase 0.9999 Mentor Kanban ────────────────────── */

export type KanbanCard = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  menteeEmail: string;
  menteePrimaryRole: string | null;
  trackName: string | null;
  cycleStage: MentorshipCycleStage;
  stageLabel: string;
  softDeadline: Date | null;
  completedAt: Date | null;
  cta: CycleCTA;
  kickoffPending: boolean;
};

export type KanbanColumn = {
  key: MentorshipCycleStage;
  label: string;
  cards: KanbanCard[];
};

const ACTIVE_STAGE_ORDER: MentorshipCycleStage[] = [
  "KICKOFF_PENDING",
  "REFLECTION_DUE",
  "REFLECTION_SUBMITTED",
  "CHANGES_REQUESTED",
  "REVIEW_SUBMITTED",
  "APPROVED",
];
const INACTIVE_STAGES: MentorshipCycleStage[] = ["PAUSED", "COMPLETE"];

/**
 * Server-only loader for the unified mentor Kanban.
 * Columns keyed by MentorshipCycleStage; Inactive drawer groups PAUSED + COMPLETE.
 */
export async function getMentorKanbanData(): Promise<{
  active: KanbanColumn[];
  inactive: KanbanColumn;
  total: number;
  isAdmin: boolean;
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const accessibleMenteeIds = isAdmin
    ? null
    : (await getMentorshipAccessibleMenteeIds(userId, roles)) ?? [];

  const where = accessibleMenteeIds === null
    ? {}
    : { menteeId: { in: accessibleMenteeIds.length > 0 ? accessibleMenteeIds : ["__none__"] } };

  const mentorships = await prisma.mentorship.findMany({
    where,
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      cycleStage: true,
      mentorTag: true,
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      track: { select: { name: true } },
      goalReviews: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
        select: { id: true, status: true, releasedToMenteeAt: true, cycleMonth: true },
      },
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
        select: { cycleMonth: true, submittedAt: true },
      },
    },
  });

  const { cycleMonth } = getCurrentCycleMonth();
  const softDeadline = getReflectionSoftDeadline(cycleMonth);

  const cards: KanbanCard[] = mentorships.map((m) => {
    const latestReview = m.goalReviews[0] ?? null;
    const latestReflection = m.selfReflections[0] ?? null;
    const completedAt =
      m.cycleStage === "APPROVED"
        ? latestReview?.releasedToMenteeAt ?? null
        : m.cycleStage === "REFLECTION_SUBMITTED"
          ? latestReflection?.submittedAt ?? null
          : null;
    return {
      mentorshipId: m.id,
      menteeId: m.mentee.id,
      menteeName: m.mentee.name ?? m.mentee.email,
      menteeEmail: m.mentee.email,
      menteePrimaryRole: m.mentee.primaryRole,
      trackName: m.track?.name ?? null,
      cycleStage: m.cycleStage,
      stageLabel: stageLabel(m.cycleStage),
      softDeadline,
      completedAt,
      cta: getCycleStageCTA({
        stage: m.cycleStage,
        menteeId: m.mentee.id,
        mentorshipId: m.id,
        reviewId: latestReview?.id ?? null,
      }),
      kickoffPending: m.cycleStage === "KICKOFF_PENDING",
    };
  });

  const active: KanbanColumn[] = ACTIVE_STAGE_ORDER.map((stage) => ({
    key: stage,
    label: stageLabel(stage),
    cards: cards.filter((c) => c.cycleStage === stage).sort((a, b) => a.menteeName.localeCompare(b.menteeName)),
  }));

  const inactive: KanbanColumn = {
    key: "PAUSED",
    label: "Inactive",
    cards: cards.filter((c) => INACTIVE_STAGES.includes(c.cycleStage)),
  };

  return { active, inactive, total: cards.length, isAdmin };
}

/* ── Simplified 5-Column Mentor Kanban (Phase Simplification) ──────── */

export type SimplifiedKanbanCard = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  menteePrimaryRole: string | null;
  cycleStage: MentorshipCycleStage;
  mentorTag: string | null;
  reflectionSubmitted: boolean;
  kickoffPending: boolean;
  latestRatings: string[]; // GoalRatingColor values
  softDeadline: Date | null;
  cta: CycleCTA;
};

export type SimplifiedKanbanColumn = {
  key: string;
  label: string;
  accent: string; // CSS color token
  cards: SimplifiedKanbanCard[];
};

const SIMPLIFIED_COLUMNS: Array<{
  key: string;
  label: string;
  accent: string;
  test: (card: SimplifiedKanbanCard) => boolean;
}> = [
  {
    key: "REFLECTION_NOT_SUBMITTED",
    label: "Reflection Not Submitted",
    accent: "#f59e0b",
    test: (c) =>
      !c.mentorTag &&
      (c.cycleStage === "KICKOFF_PENDING" || c.cycleStage === "REFLECTION_DUE"),
  },
  {
    key: "READY_FOR_REVIEW",
    label: "Ready for Review",
    accent: "#3b82f6",
    test: (c) =>
      !c.mentorTag &&
      (c.cycleStage === "REFLECTION_SUBMITTED" ||
        c.cycleStage === "CHANGES_REQUESTED"),
  },
  {
    key: "FEEDBACK_COMPLETED",
    label: "Feedback Completed",
    accent: "#22c55e",
    test: (c) =>
      !c.mentorTag &&
      (c.cycleStage === "REVIEW_SUBMITTED" || c.cycleStage === "APPROVED"),
  },
  {
    key: "FOLLOW_UP_NEEDED",
    label: "Follow-Up Needed",
    accent: "#ef4444",
    test: (c) => c.mentorTag === "FOLLOW_UP_NEEDED",
  },
  {
    key: "OUTSTANDING_PERFORMANCE",
    label: "Outstanding Performance",
    accent: "#a855f7",
    test: (c) => c.mentorTag === "OUTSTANDING_PERFORMANCE",
  },
];

export async function getSimplifiedMentorKanban(): Promise<{
  columns: SimplifiedKanbanColumn[];
  total: number;
  inactive: SimplifiedKanbanCard[];
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const accessibleMenteeIds = isAdmin
    ? null
    : (await getMentorshipAccessibleMenteeIds(userId, roles)) ?? [];

  const where =
    accessibleMenteeIds === null
      ? {}
      : {
          menteeId: {
            in:
              accessibleMenteeIds.length > 0
                ? accessibleMenteeIds
                : ["__none__"],
          },
        };

  const { cycleMonth } = getCurrentCycleMonth();
  const softDeadline = getReflectionSoftDeadline(cycleMonth);

  const mentorships = await prisma.mentorship.findMany({
    where,
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      cycleStage: true,
      mentorTag: true,
      mentee: { select: { id: true, name: true, email: true, primaryRole: true } },
      track: { select: { name: true } },
      goalReviews: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          releasedToMenteeAt: true,
          goalRatings: { select: { rating: true } },
        },
      },
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
        select: { submittedAt: true },
      },
    },
  });

  const activeStages: MentorshipCycleStage[] = [
    "KICKOFF_PENDING",
    "REFLECTION_DUE",
    "REFLECTION_SUBMITTED",
    "CHANGES_REQUESTED",
    "REVIEW_SUBMITTED",
    "APPROVED",
  ];

  const allCards: SimplifiedKanbanCard[] = mentorships.map((m) => {
    const latestReview = m.goalReviews[0] ?? null;
    const latestReflection = m.selfReflections[0] ?? null;
    return {
      mentorshipId: m.id,
      menteeId: m.mentee.id,
      menteeName: m.mentee.name ?? m.mentee.email,
      menteePrimaryRole: m.mentee.primaryRole,
      cycleStage: m.cycleStage,
      mentorTag: m.mentorTag ?? null,
      reflectionSubmitted: !!latestReflection?.submittedAt,
      kickoffPending: m.cycleStage === "KICKOFF_PENDING",
      latestRatings: latestReview?.goalRatings.map((gr) => gr.rating) ?? [],
      softDeadline: activeStages.includes(m.cycleStage) ? softDeadline : null,
      cta: getCycleStageCTA({
        stage: m.cycleStage,
        menteeId: m.mentee.id,
        mentorshipId: m.id,
        reviewId: latestReview?.id ?? null,
      }),
    };
  });

  const activeCards = allCards.filter((c) => activeStages.includes(c.cycleStage));
  const inactive = allCards.filter((c) => !activeStages.includes(c.cycleStage));

  const columns: SimplifiedKanbanColumn[] = SIMPLIFIED_COLUMNS.map((col) => ({
    key: col.key,
    label: col.label,
    accent: col.accent,
    cards: activeCards
      .filter(col.test)
      .sort((a, b) => a.menteeName.localeCompare(b.menteeName)),
  }));

  return { columns, total: allCards.length, inactive };
}
