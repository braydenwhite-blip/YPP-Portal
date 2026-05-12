"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, RegularInstructorAssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { requireAdmin } from "@/lib/authorization-helpers";
import { getInstructorReadinessMany } from "@/lib/instructor-readiness";

/**
 * Regular instructor assignment operations.
 *
 * Connects ClassOffering ↔ User (instructor) with role + lifecycle status.
 * Sits alongside lib/admin-class-operations.ts (which manages offerings
 * end-to-end). This module is strictly ADMIN — every exported action
 * enforces the ADMIN role server-side so direct route access cannot bypass
 * UI gating.
 *
 * Phase 1 surface:
 *   - List/create/update/remove assignments
 *   - Dashboard KPIs (coverage, status counts, pending confirmations)
 *   - Per-class admin view with assignment list
 *   - Instructor matching score helper (deterministic, no AI)
 *
 * Intentionally NOT in Phase 1:
 *   - Instructor-side accept/decline flow
 *   - Availability / conflict detection
 *   - Bulk assignment, calendar sync, email
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants & types
// ─────────────────────────────────────────────────────────────────────────────

const REVALIDATE_PATHS = [
  "/admin/instructor-assignments",
  "/admin/classes",
  "/admin/instructors",
  "/admin/instructor-readiness",
];

function revalidateAssignmentSurfaces(offeringId?: string) {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  if (offeringId) {
    revalidatePath(`/admin/classes/${offeringId}`);
    revalidatePath(`/admin/instructor-assignments/${offeringId}`);
  }
}

/** Statuses that count as "the offering is covered by this instructor". */
const ACTIVE_COVERAGE_STATUSES: RegularInstructorAssignmentStatus[] = [
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
  "OFFERED",
  "PENDING_REVIEW",
];

/** Statuses that count as "fully confirmed and counted toward load". */
const CONFIRMED_STATUSES: RegularInstructorAssignmentStatus[] = [
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
];

// Display labels live in lib/regular-instructor-assignments-display.ts —
// "use server" modules cannot export synchronous helpers.

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const RoleEnum = z.enum(["LEAD", "CO_INSTRUCTOR", "ASSISTANT", "BACKUP"]);
const StatusEnum = z.enum([
  "SUGGESTED",
  "PENDING_REVIEW",
  "OFFERED",
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
  "NEEDS_TRAINING",
  "NEEDS_CURRICULUM",
  "DECLINED",
  "REMOVED",
  "COMPLETED",
]);

const CreateInput = z.object({
  offeringId: z.string().min(1),
  instructorId: z.string().min(1),
  role: RoleEnum.default("LEAD"),
  status: StatusEnum.default("PENDING_REVIEW"),
  curriculumDraftId: z.string().optional().nullable(),
  classTemplateId: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
  instructorNote: z.string().optional().nullable(),
});

const UpdateStatusInput = z.object({
  assignmentId: z.string().min(1),
  status: StatusEnum,
  adminNotes: z.string().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Form helpers
// ─────────────────────────────────────────────────────────────────────────────

function getString(formData: FormData, key: string, required = true): string {
  const raw = formData.get(key);
  const value = raw == null ? "" : String(raw).trim();
  if (required && !value) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value;
}

function getOptional(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw == null) return null;
  const value = String(raw).trim();
  return value === "" ? null : value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new regular instructor assignment. Admin-only. Defaults chapterId
 * from the offering so chapter filters work without a separate write.
 */
export async function createRegularInstructorAssignment(formData: FormData) {
  const actor = await requireAdmin();

  const parsed = CreateInput.parse({
    offeringId: getString(formData, "offeringId"),
    instructorId: getString(formData, "instructorId"),
    role: getString(formData, "role", false) || "LEAD",
    status: getString(formData, "status", false) || "PENDING_REVIEW",
    curriculumDraftId: getOptional(formData, "curriculumDraftId"),
    classTemplateId: getOptional(formData, "classTemplateId"),
    adminNotes: getOptional(formData, "adminNotes"),
    instructorNote: getOptional(formData, "instructorNote"),
  });

  const offering = await prisma.classOffering.findUnique({
    where: { id: parsed.offeringId },
    select: { id: true, chapterId: true, templateId: true },
  });
  if (!offering) {
    throw new Error("Class offering not found.");
  }

  // Default the template link to the offering's template if not supplied —
  // makes downstream "which curriculum is in play" lookups one less hop.
  const classTemplateId =
    parsed.classTemplateId ?? offering.templateId ?? null;

  try {
    await prisma.regularInstructorAssignment.create({
      data: {
        offeringId: parsed.offeringId,
        instructorId: parsed.instructorId,
        role: parsed.role,
        status: parsed.status,
        chapterId: offering.chapterId,
        curriculumDraftId: parsed.curriculumDraftId,
        classTemplateId,
        adminNotes: parsed.adminNotes,
        instructorNote: parsed.instructorNote,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error(
        "This instructor already holds this role on the class. Update the existing assignment instead."
      );
    }
    throw e;
  }

  revalidateAssignmentSurfaces(parsed.offeringId);
}

/**
 * Update assignment status and stamp the matching timestamp. Admin-only.
 */
export async function updateRegularInstructorAssignmentStatus(
  formData: FormData
) {
  const actor = await requireAdmin();
  const parsed = UpdateStatusInput.parse({
    assignmentId: getString(formData, "assignmentId"),
    status: getString(formData, "status"),
    adminNotes: getOptional(formData, "adminNotes"),
  });

  const existing = await prisma.regularInstructorAssignment.findUnique({
    where: { id: parsed.assignmentId },
    select: { id: true, offeringId: true, status: true },
  });
  if (!existing) {
    throw new Error("Assignment not found.");
  }

  const now = new Date();
  const stamps: Record<string, Date | null> = {};
  switch (parsed.status) {
    case "OFFERED":
      stamps.offeredAt = now;
      break;
    case "INSTRUCTOR_CONFIRMED":
      stamps.instructorConfirmedAt = now;
      break;
    case "CHAPTER_CONFIRMED":
      stamps.chapterConfirmedAt = now;
      break;
    case "FULLY_CONFIRMED":
      stamps.instructorConfirmedAt = now;
      stamps.chapterConfirmedAt = now;
      break;
    case "DECLINED":
      stamps.declinedAt = now;
      break;
    case "REMOVED":
      stamps.removedAt = now;
      break;
    case "COMPLETED":
      stamps.completedAt = now;
      break;
  }

  await prisma.regularInstructorAssignment.update({
    where: { id: parsed.assignmentId },
    data: {
      status: parsed.status,
      adminNotes: parsed.adminNotes ?? undefined,
      updatedById: actor.id,
      ...stamps,
    },
  });

  revalidateAssignmentSurfaces(existing.offeringId);
}

/**
 * Hard-remove an assignment. Admin-only. Use REMOVED status if you want
 * to keep the audit trail. This is the destructive version.
 */
export async function deleteRegularInstructorAssignment(formData: FormData) {
  await requireAdmin();
  const assignmentId = getString(formData, "assignmentId");
  const existing = await prisma.regularInstructorAssignment.findUnique({
    where: { id: assignmentId },
    select: { offeringId: true },
  });
  if (!existing) {
    throw new Error("Assignment not found.");
  }
  await prisma.regularInstructorAssignment.delete({
    where: { id: assignmentId },
  });
  revalidateAssignmentSurfaces(existing.offeringId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries — admin dashboard
// ─────────────────────────────────────────────────────────────────────────────

export type AssignmentDashboardRow = Awaited<
  ReturnType<typeof getAssignmentDashboardRows>
>[number];

/**
 * Returns every relevant offering with its assignment summary, attached
 * instructors, and a derived coverage flag. Used by the admin assignments
 * page. Limited to non-archived offerings so the list stays manageable.
 */
export async function getAssignmentDashboardRows(args?: {
  chapterId?: string | null;
  status?: string | null;
}) {
  await requireAdmin();

  const where: Prisma.ClassOfferingWhereInput = {
    status: { in: ["DRAFT", "PUBLISHED", "IN_PROGRESS"] },
  };
  if (args?.chapterId) {
    where.chapterId = args.chapterId;
  }

  const offerings = await withPrismaFallback(
    "regular-instructor-assignments:dashboard-offerings",
    () =>
      prisma.classOffering.findMany({
        where,
        orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
        take: 250,
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          meetingDays: true,
          meetingTime: true,
          deliveryMode: true,
          status: true,
          capacity: true,
          chapter: { select: { id: true, name: true } },
          template: {
            select: { id: true, title: true, interestArea: true, targetAgeGroup: true },
          },
          instructor: { select: { id: true, name: true } },
          regularInstructorAssignments: {
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              role: true,
              status: true,
              instructor: { select: { id: true, name: true } },
              instructorConfirmedAt: true,
              chapterConfirmedAt: true,
            },
          },
          _count: { select: { enrollments: true } },
        },
      }),
    []
  );

  const rows = offerings.map((o) => {
    const activeAssignments = o.regularInstructorAssignments.filter((a) =>
      ACTIVE_COVERAGE_STATUSES.includes(a.status)
    );
    const hasLead =
      activeAssignments.some((a) => a.role === "LEAD") ||
      Boolean(o.instructor); // legacy singular pointer counts as lead
    const confirmedCount = o.regularInstructorAssignments.filter((a) =>
      CONFIRMED_STATUSES.includes(a.status)
    ).length;
    const coverageState: "UNCOVERED" | "PARTIAL" | "COVERED" = !hasLead
      ? "UNCOVERED"
      : confirmedCount === 0
        ? "PARTIAL"
        : "COVERED";

    return {
      ...o,
      coverageState,
      activeAssignmentCount: activeAssignments.length,
      confirmedAssignmentCount: confirmedCount,
    };
  });

  // Optional status filter applied post-aggregation so we don't drop
  // offerings just because an assignment row has a different status.
  if (args?.status === "UNCOVERED") {
    return rows.filter((r) => r.coverageState === "UNCOVERED");
  }
  if (args?.status === "PARTIAL") {
    return rows.filter((r) => r.coverageState === "PARTIAL");
  }
  if (args?.status === "COVERED") {
    return rows.filter((r) => r.coverageState === "COVERED");
  }
  return rows;
}

export type AssignmentDashboardCounts = {
  totalOfferings: number;
  uncovered: number;
  partial: number;
  covered: number;
  pendingConfirmation: number;
  declinedLast30Days: number;
};

export async function getAssignmentDashboardCounts(): Promise<AssignmentDashboardCounts> {
  await requireAdmin();

  const offerings = await getAssignmentDashboardRows();
  const totalOfferings = offerings.length;
  const uncovered = offerings.filter((o) => o.coverageState === "UNCOVERED").length;
  const partial = offerings.filter((o) => o.coverageState === "PARTIAL").length;
  const covered = offerings.filter((o) => o.coverageState === "COVERED").length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [pendingConfirmation, declinedLast30Days] = await Promise.all([
    withPrismaFallback(
      "regular-instructor-assignments:pending-count",
      () =>
        prisma.regularInstructorAssignment.count({
          where: { status: { in: ["OFFERED", "PENDING_REVIEW"] } },
        }),
      0
    ),
    withPrismaFallback(
      "regular-instructor-assignments:declined-count",
      () =>
        prisma.regularInstructorAssignment.count({
          where: { status: "DECLINED", declinedAt: { gte: thirtyDaysAgo } },
        }),
      0
    ),
  ]);

  return {
    totalOfferings,
    uncovered,
    partial,
    covered,
    pendingConfirmation,
    declinedLast30Days,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Instructor matching
// ─────────────────────────────────────────────────────────────────────────────

export type InstructorMatch = {
  instructor: {
    id: string;
    name: string;
    chapterId: string | null;
    chapterName: string | null;
  };
  score: number;
  reasons: string[];
  warnings: string[];
  readinessReady: boolean;
  currentLoad: number;
};

/**
 * Score instructors against an offering. Deterministic rule-based scoring
 * — no AI, no learned model. Each rule contributes +N (good) or -N (bad)
 * with a short human-readable explanation so admins understand the rank.
 */
export async function rankInstructorsForOffering(args: {
  offeringId: string;
  limit?: number;
}): Promise<InstructorMatch[]> {
  await requireAdmin();

  const offering = await prisma.classOffering.findUnique({
    where: { id: args.offeringId },
    select: {
      id: true,
      chapterId: true,
      template: { select: { interestArea: true, targetAgeGroup: true } },
    },
  });
  if (!offering) return [];

  // Eligible candidate pool: anyone with the INSTRUCTOR role. We pull a
  // bounded set and let the scoring rules sort them.
  const instructors = await withPrismaFallback(
    "regular-instructor-assignments:candidate-pool",
    () =>
      prisma.user.findMany({
        where: { roles: { some: { role: "INSTRUCTOR" } } },
        select: {
          id: true,
          name: true,
          chapterId: true,
          chapter: { select: { name: true } },
        },
        orderBy: { name: "asc" },
        take: 500,
      }),
    []
  );

  if (instructors.length === 0) return [];

  const instructorIds = instructors.map((i) => i.id);

  const [readinessMap, loadCounts] = await Promise.all([
    getInstructorReadinessMany(instructorIds),
    prisma.regularInstructorAssignment.groupBy({
      by: ["instructorId"],
      where: {
        instructorId: { in: instructorIds },
        status: { in: ACTIVE_COVERAGE_STATUSES },
      },
      _count: { _all: true },
    }),
  ]);

  const loadByInstructor = new Map<string, number>();
  for (const row of loadCounts) {
    loadByInstructor.set(row.instructorId, row._count?._all ?? 0);
  }

  const matches: InstructorMatch[] = instructors.map((inst) => {
    const readiness = readinessMap.get(inst.id);
    const load = loadByInstructor.get(inst.id) ?? 0;
    const reasons: string[] = [];
    const warnings: string[] = [];
    let score = 0;

    // Chapter match
    if (offering.chapterId && inst.chapterId === offering.chapterId) {
      score += 25;
      reasons.push("Same chapter");
    } else if (offering.chapterId && inst.chapterId !== offering.chapterId) {
      warnings.push("Different chapter");
    }

    // Readiness signal
    if (readiness?.baseReadinessComplete) {
      score += 30;
      reasons.push("Training + interview complete");
    } else if (readiness?.trainingComplete) {
      score += 10;
      reasons.push("Training complete");
      warnings.push("Interview not yet passed");
    } else if (readiness) {
      warnings.push("Training incomplete");
    }

    // Curriculum signal — approved curriculum draft is a strong positive.
    if (readiness?.studioCapstoneComplete) {
      score += 10;
      reasons.push("Curriculum capstone done");
    } else {
      warnings.push("Curriculum capstone missing");
    }

    // Load penalty — assignments past a soft cap reduce score.
    if (load === 0) {
      score += 5;
      reasons.push("No active assignments");
    } else if (load <= 2) {
      score += 0;
    } else if (load <= 4) {
      score -= 5;
      warnings.push(`${load} active assignments`);
    } else {
      score -= 15;
      warnings.push(`Overloaded (${load} active)`);
    }

    return {
      instructor: {
        id: inst.id,
        name: inst.name,
        chapterId: inst.chapterId,
        chapterName: inst.chapter?.name ?? null,
      },
      score,
      reasons,
      warnings,
      readinessReady: Boolean(readiness?.baseReadinessComplete),
      currentLoad: load,
    };
  });

  matches.sort((a, b) => b.score - a.score || a.instructor.name.localeCompare(b.instructor.name));
  return matches.slice(0, args.limit ?? 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-offering detail
// ─────────────────────────────────────────────────────────────────────────────

export async function getAssignmentsForOffering(offeringId: string) {
  await requireAdmin();
  return prisma.regularInstructorAssignment.findMany({
    where: { offeringId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: {
      instructor: {
        select: { id: true, name: true, email: true, chapterId: true },
      },
      curriculumDraft: { select: { id: true, title: true, status: true } },
      classTemplate: { select: { id: true, title: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
    },
  });
}

export async function listOfferingsForAssignmentPicker() {
  await requireAdmin();
  return prisma.classOffering.findMany({
    where: { status: { in: ["DRAFT", "PUBLISHED", "IN_PROGRESS"] } },
    orderBy: [{ startDate: "asc" }],
    select: {
      id: true,
      title: true,
      startDate: true,
      chapter: { select: { id: true, name: true } },
      template: { select: { title: true, interestArea: true } },
    },
    take: 500,
  });
}
