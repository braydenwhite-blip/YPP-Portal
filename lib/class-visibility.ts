/**
 * Centralized visibility filters for ClassOffering.
 *
 * Public/student-facing class queries must combine status with approval —
 * the publish gate runs at write-time only, and the gate is itself bypassed
 * when ENABLE_NATIVE_INSTRUCTOR_GATE is off. Read-time defense-in-depth
 * here guarantees that draft, rejected, awaiting-review, and unapproved
 * offerings never leak into student-visible surfaces, regardless of how
 * the offering's status field came to read PUBLISHED.
 */

import type { Prisma } from "@prisma/client";

/** Statuses where an offering is allowed to be discovered by students. */
export const PUBLIC_OFFERING_STATUSES: Prisma.EnumClassOfferingStatusFilter["in"] = [
  "PUBLISHED",
  "IN_PROGRESS",
];

/**
 * Approval shape that satisfies "this offering has cleared admin review."
 * An offering is considered approved if either:
 *   - it has an approval record with status APPROVED, or
 *   - it carries the legacy grandfathered training exemption
 *
 * The grandfather flag exists for offerings created before the approval
 * workflow shipped — see `assertCanPublishOffering` in `lib/instructor-readiness.ts`.
 */
export const APPROVED_OFFERING_OR: Prisma.ClassOfferingWhereInput["OR"] = [
  { approval: { is: { status: "APPROVED" } } },
  { grandfatheredTrainingExemption: true },
];

/**
 * The canonical `where` fragment for any query that returns offerings
 * to students or other public surfaces.
 *
 * Compose with additional filters via spread:
 *   prisma.classOffering.findMany({ where: { ...publicOfferingWhere(), chapterId } })
 */
export function publicOfferingWhere(
  extra?: Prisma.ClassOfferingWhereInput
): Prisma.ClassOfferingWhereInput {
  return {
    status: { in: PUBLIC_OFFERING_STATUSES },
    OR: APPROVED_OFFERING_OR,
    ...(extra ?? {}),
  };
}

/**
 * Predicate form for in-memory filtering when a query already returned
 * offerings without the visibility join (e.g. through a reused select).
 */
export function isOfferingPubliclyVisible(offering: {
  status: string;
  grandfatheredTrainingExemption?: boolean | null;
  approval?: { status: string } | null;
}): boolean {
  if (!PUBLIC_OFFERING_STATUSES?.includes(offering.status as never)) {
    return false;
  }
  if (offering.grandfatheredTrainingExemption) return true;
  return offering.approval?.status === "APPROVED";
}
