import "server-only";

/**
 * Operational queues (Phase 7 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 * The proposal's required queues, assembled from existing domain data:
 *   - Reviews to Draft        (mentor goal reviews the viewer must write/revise)
 *   - Reviews to Approve      (reviews awaiting the viewer's approval)
 *   - Curriculum to Review    (drafts awaiting first/final review)
 *   - Interviews Assigned     (instructor interviews assigned to the viewer)
 *   - Missing Chapter         (records without a valid chapter — Phase 6)
 *   - Promotion Setup         (Phase 8 — placeholder until the promotion flow lands)
 *
 * Each function returns lightweight, serializable rows so a queue surface can
 * render counts + items without re-deriving domain logic. Pure classification
 * lives in `operational-queues-utils.ts` for unit testing.
 */

import { prisma } from "@/lib/prisma";
import { getMyReviewQueue } from "@/lib/goal-review-actions";
import { getApprovableGoalReviewsForUser } from "@/lib/mentorship-chair-access";
import { getMissingChapterQueue } from "@/lib/org/missing-chapter";
import { getPendingPromotionSetups } from "@/lib/org/promotion-queries";
import {
  OPERATIONAL_QUEUE_KEYS,
  OPERATIONAL_QUEUE_LABELS,
  isReviewAwaitingDraft,
  type OperationalQueueKey,
  type OperationalQueueLane,
  type OperationalQueueRow,
  type OperationalQueueViewer,
} from "@/lib/org/operational-queues-utils";

// ─── Reviews to Draft ─────────────────────────────────────────────────────────

export async function getReviewsToDraftRows(): Promise<OperationalQueueRow[]> {
  const queue = await getMyReviewQueue();
  if (!queue) return [];
  return queue
    .filter((m) => isReviewAwaitingDraft(m.reviewStatus, Boolean(m.latestReflection)))
    .map((m) => ({
      id: m.mentorshipId,
      title: m.menteeName,
      subtitle:
        m.reviewStatus === "CHANGES_REQUESTED"
          ? "Review returned for revision"
          : "Self-reflection submitted — write the review",
      href: m.reviewId ? `/mentorship/reviews/${m.reviewId}` : `/mentorship/mentees/${m.menteeId}`,
      ageLabel: null,
    }));
}

// ─── Reviews to Approve ───────────────────────────────────────────────────────

export async function getReviewsToApproveRows(
  viewer: OperationalQueueViewer
): Promise<OperationalQueueRow[]> {
  const reviews = await getApprovableGoalReviewsForUser(viewer.id, viewer.adminSubtypes ?? []);
  return reviews.map((r) => {
    // `getApprovableGoalReviewsForUser` includes the mentee; fall back gracefully.
    const mentee = (r as unknown as { mentee?: { name?: string | null } }).mentee;
    return {
      id: r.id,
      title: mentee?.name ?? "Review",
      subtitle: "Awaiting your approval",
      href: `/mentorship/reviews/${r.id}`,
      ageLabel: null,
    };
  });
}

// ─── Curriculum to Review ─────────────────────────────────────────────────────

export async function getCurriculumToReviewRows(
  viewer: OperationalQueueViewer
): Promise<OperationalQueueRow[]> {
  const roles = new Set([viewer.primaryRole ?? "", ...viewer.roles]);
  const isAdmin = roles.has("ADMIN") || roles.has("STAFF");
  const isChapterPresident = roles.has("CHAPTER_PRESIDENT") && Boolean(viewer.chapterId);

  if (!isAdmin && !isChapterPresident) return [];

  const drafts = await prisma.curriculumDraft.findMany({
    where: {
      status: { in: ["SUBMITTED", "NEEDS_REVISION"] },
      ...(isAdmin ? {} : { author: { chapterId: viewer.chapterId } }),
    },
    select: {
      id: true,
      title: true,
      status: true,
      submittedAt: true,
      author: { select: { name: true } },
    },
    orderBy: { submittedAt: "asc" },
    take: 100,
  });

  return drafts.map((d) => ({
    id: d.id,
    title: d.title || "Untitled curriculum",
    subtitle:
      d.status === "NEEDS_REVISION"
        ? `Needs re-review · ${d.author.name}`
        : `Awaiting first review · ${d.author.name}`,
    href: `/curriculum/review/${d.id}`,
    ageLabel: null,
  }));
}

// ─── Interviews Assigned ──────────────────────────────────────────────────────

export async function getInterviewsAssignedRows(
  viewer: OperationalQueueViewer
): Promise<OperationalQueueRow[]> {
  const assignments = await prisma.instructorApplicationInterviewer.findMany({
    where: {
      interviewerId: viewer.id,
      removedAt: null,
      application: { status: { in: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] } },
    },
    select: {
      id: true,
      role: true,
      round: true,
      application: {
        select: { id: true, status: true, applicant: { select: { name: true } } },
      },
    },
    orderBy: { assignedAt: "asc" },
    take: 100,
  });

  return assignments.map((a) => ({
    id: a.id,
    title: a.application.applicant.name,
    subtitle: `Round ${a.round} · ${a.role} · ${a.application.status.replace(/_/g, " ").toLowerCase()}`,
    href: `/admin/instructor-applicants/${a.application.id}`,
    ageLabel: null,
  }));
}

// ─── Missing Chapter ──────────────────────────────────────────────────────────

export async function getMissingChapterRows(): Promise<OperationalQueueRow[]> {
  const rows = await getMissingChapterQueue();
  return rows.map((r) => ({
    id: r.id,
    title: r.label,
    subtitle: `${r.recordType} · needs a chapter assignment`,
    href: r.actionItemId ? `/actions/${r.actionItemId}` : null,
    ageLabel: r.ageLabel,
  }));
}

// ─── Promotion Setup (Phase 8 placeholder) ────────────────────────────────────

export async function getPromotionSetupRows(): Promise<OperationalQueueRow[]> {
  const pending = await getPendingPromotionSetups();
  return pending.map((p) => ({
    id: p.id,
    title: p.personName,
    subtitle:
      p.pendingSetup.length > 0
        ? `New role setup pending: ${p.pendingSetup.join(", ")}`
        : "New role setup pending",
    href: `/people/${p.userId}`,
    ageLabel: null,
  }));
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * Assemble every operational queue for a viewer. Each lane is independent, so a
 * failure in one domain does not blank the others.
 */
export async function getOperationalQueues(
  viewer: OperationalQueueViewer
): Promise<OperationalQueueLane[]> {
  const [toDraft, toApprove, curriculum, interviews, missingChapter, promotionSetup] =
    await Promise.all([
      getReviewsToDraftRows().catch(() => []),
      getReviewsToApproveRows(viewer).catch(() => []),
      getCurriculumToReviewRows(viewer).catch(() => []),
      getInterviewsAssignedRows(viewer).catch(() => []),
      getMissingChapterRows().catch(() => []),
      getPromotionSetupRows().catch(() => []),
    ]);

  const byKey: Record<OperationalQueueKey, OperationalQueueRow[]> = {
    "reviews-to-draft": toDraft,
    "reviews-to-approve": toApprove,
    "curriculum-to-review": curriculum,
    "interviews-assigned": interviews,
    "missing-chapter": missingChapter,
    "promotion-setup": promotionSetup,
  };

  return OPERATIONAL_QUEUE_KEYS.map((key) => ({
    key,
    label: OPERATIONAL_QUEUE_LABELS[key],
    count: byKey[key].length,
    rows: byKey[key],
  }));
}
