// Chapter-scoped class operations + instructor coverage for the Chapter
// President. A CP shouldn't be locked out of seeing how their chapter's
// classes are staffed and approved — this is a read scoped strictly to the
// chapter, surfaced inline on the chapter home and linking out to the existing
// coverage cockpit and review queues. No admin mutation surface, no
// cross-chapter leak: writes still live behind their own admin-gated actions.

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

// Same "needs review" set the admin proposal queue uses (offering approval).
const PENDING_APPROVAL_STATUSES: readonly string[] = [
  "REQUESTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
];

export type ChapterClassRow = {
  id: string;
  title: string;
  status: string;
  startDate: Date;
  instructorName: string | null;
  enrolled: number;
  coverageLabel: string;
  covered: boolean;
  approvalPending: boolean;
};

export type ChapterClassOps = {
  rows: ChapterClassRow[];
  total: number;
  needsStaffing: number;
  pendingApproval: number;
};

/**
 * Derive a plain coverage label from a class's regular-instructor-assignment
 * statuses — the same transparent rule the Partner 360 uses, so "covered"
 * means the same thing everywhere.
 */
function coverage(
  statuses: string[],
  hasInstructor: boolean
): { label: string; covered: boolean } {
  const label = statuses.includes("FULLY_CONFIRMED")
    ? "Fully covered"
    : statuses.includes("INSTRUCTOR_CONFIRMED")
      ? "Partner confirmation needed"
      : statuses.some((x) => x === "CHAPTER_CONFIRMED" || x === "OFFERED")
        ? "Waiting on instructor"
        : statuses.some((x) => x === "NEEDS_TRAINING" || x === "NEEDS_CURRICULUM")
          ? "Training needed"
          : statuses.some((x) => x === "SUGGESTED" || x === "PENDING_REVIEW")
            ? "Suggested match"
            : hasInstructor
              ? "Instructor assigned"
              : "Needs instructor";
  const covered = label === "Fully covered" || label === "Instructor assigned";
  return { label, covered };
}

export async function loadChapterClassOps(chapterId: string): Promise<ChapterClassOps> {
  const offerings = await withPrismaFallback(
    "chapter:class-ops",
    () =>
      prisma.classOffering.findMany({
        where: { chapterId, status: { not: "CANCELLED" } },
        orderBy: [{ startDate: "desc" }],
        take: 25,
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          instructor: { select: { name: true } },
          approval: { select: { status: true } },
          regularInstructorAssignments: { select: { status: true } },
          _count: { select: { enrollments: true } },
        },
      }),
    []
  );

  const rows: ChapterClassRow[] = offerings.map((o) => {
    const { label, covered } = coverage(
      o.regularInstructorAssignments.map((a) => a.status),
      Boolean(o.instructor)
    );
    return {
      id: o.id,
      title: o.title,
      status: o.status,
      startDate: o.startDate,
      instructorName: o.instructor?.name ?? null,
      enrolled: o._count.enrollments,
      coverageLabel: label,
      covered,
      approvalPending: o.approval ? PENDING_APPROVAL_STATUSES.includes(o.approval.status) : false,
    };
  });

  return {
    rows,
    total: rows.length,
    needsStaffing: rows.filter((r) => !r.covered).length,
    pendingApproval: rows.filter((r) => r.approvalPending).length,
  };
}
