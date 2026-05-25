/**
 * Server-side reader for the "approved Summer Workshop instructors waiting
 * for a placement" pool.
 *
 * Used by:
 *   * /admin/workshop-reviews — counts + queue
 *   * /admin/opportunities — sidebar panel that surfaces candidates ready
 *     to be matched to an unstaffed opportunity
 *
 * The pool is derived rather than persisted: an applicant is "in the
 * pool" iff their `WorkshopProposalSubmission.status === APPROVED` AND
 * they have zero active `InstructorAssignment` rows
 * (status NOT IN DECLINED|CANCELLED).
 */

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

export type ApprovedUnplacedCandidate = {
  submissionId: string;
  applicantId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  chapterName: string | null;
  approvedAt: Date | null;
  /** Topic/category — derived from the template OR the custom JSON blob. */
  category: string | null;
  /** Free-text target age. From template.targetAgeRange or custom.targetAgeGroup. */
  ageRange: string | null;
  /** Workshop title (template.title or custom.title). */
  workshopTitle: string | null;
  /** Custom-design vs. template selection. */
  sourceLabel: "Custom-designed" | "From library";
};

const ACTIVE_ASSIGNMENT_STATUSES = [
  "SUGGESTED",
  "PENDING",
  "CONFIRMED",
  "WAITLISTED",
  "COMPLETED",
] as const;

function deriveCategory(
  template: { category: string | null } | null,
  customWorkshop: unknown
): string | null {
  if (template?.category) return template.category;
  if (customWorkshop && typeof customWorkshop === "object") {
    const value = String(
      (customWorkshop as Record<string, unknown>).category ?? ""
    ).trim();
    return value || null;
  }
  return null;
}

function deriveAgeRange(
  template: { targetAgeRange: string | null } | null,
  customWorkshop: unknown
): string | null {
  if (template?.targetAgeRange) return template.targetAgeRange;
  if (customWorkshop && typeof customWorkshop === "object") {
    const value = String(
      (customWorkshop as Record<string, unknown>).targetAgeGroup ?? ""
    ).trim();
    return value || null;
  }
  return null;
}

function deriveTitle(
  template: { title: string | null } | null,
  customWorkshop: unknown
): string | null {
  if (template?.title) return template.title;
  if (customWorkshop && typeof customWorkshop === "object") {
    const value = String(
      (customWorkshop as Record<string, unknown>).title ?? ""
    ).trim();
    return value || null;
  }
  return null;
}

/**
 * Pulls the pool, optionally limited. Defaults to 20 — anything bigger and
 * the admin should use the queue/filter view, not a sidebar.
 */
export async function listApprovedUnplacedCandidates(
  opts: { limit?: number; chapterId?: string | null } = {}
): Promise<ApprovedUnplacedCandidate[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const rows = await withPrismaFallback(
    "workshop-pool:approved-unplaced",
    () =>
      prisma.workshopProposalSubmission.findMany({
        where: {
          status: "APPROVED",
          ...(opts.chapterId
            ? { author: { chapterId: opts.chapterId } }
            : {}),
          // Pull both placed and unplaced so we can filter in app code by
          // active-status, which keeps the query simple and avoids a noisy
          // OR/NOT EXISTS combination.
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              chapter: { select: { name: true } },
            },
          },
          template: { select: { title: true, category: true, targetAgeRange: true } },
          assignments: {
            where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
            select: { id: true },
          },
        },
        orderBy: { reviewedAt: "asc" },
      }),
    []
  );

  return rows
    .filter((r) => r.assignments.length === 0)
    .slice(0, limit)
    .map((r) => ({
      submissionId: r.id,
      applicantId: r.author.id,
      applicantName: r.author.name,
      applicantEmail: r.author.email,
      chapterName: r.author.chapter?.name ?? null,
      approvedAt: r.reviewedAt ?? r.updatedAt ?? null,
      category: deriveCategory(r.template, r.customWorkshop),
      ageRange: deriveAgeRange(r.template, r.customWorkshop),
      workshopTitle: deriveTitle(r.template, r.customWorkshop),
      sourceLabel:
        r.sourceType === "CUSTOM_DESIGN" ? "Custom-designed" : "From library",
    }));
}

/** Cheap count for KPI tiles. */
export async function countApprovedUnplaced(): Promise<number> {
  const rows = await withPrismaFallback(
    "workshop-pool:approved-unplaced-count",
    () =>
      prisma.workshopProposalSubmission.findMany({
        where: { status: "APPROVED" },
        select: {
          id: true,
          assignments: {
            where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
            select: { id: true },
          },
        },
      }),
    []
  );
  return rows.filter((r) => r.assignments.length === 0).length;
}
