"use server";

/**
 * Admin server actions for the instructor-to-camp/workshop assignment system.
 *
 * Phase 1 surface (admin-only):
 *   - createOpportunity      / updateOpportunity / archiveOpportunity
 *   - createAssignment       / updateAssignmentStatus / removeAssignment
 *   - bulkSuggestInstructors (helper for one-click shortlisting)
 *
 * Every exported action enforces ADMIN role server-side so a bypassed UI
 * can't quietly write to these tables. Mutations revalidate the
 * /admin/opportunities surfaces.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization-helpers";
import type {
  AssignmentRole,
  AssignmentStatus,
  CourseLevel,
  DeliveryMode,
  OpportunityStatus,
  OpportunityType,
  OpportunityUrgency,
} from "@prisma/client";

// ----------------------------------------------------------------------------
// Form helpers — mirror the style used in admin-class-operations.ts
// ----------------------------------------------------------------------------

const ADMIN_REVALIDATE_PATHS = ["/admin/opportunities"];

function revalidateOpportunitySurfaces(opportunityId?: string) {
  for (const path of ADMIN_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  if (opportunityId) {
    revalidatePath(`/admin/opportunities/${opportunityId}`);
  }
}

function getString(formData: FormData, key: string, required = true): string {
  const raw = formData.get(key);
  const value = raw == null ? "" : String(raw).trim();
  if (required && !value) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value;
}

function getOptionalString(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw == null) return null;
  const value = String(raw).trim();
  return value === "" ? null : value;
}

function getInt(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (raw == null || String(raw).trim() === "") return fallback;
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getDate(formData: FormData, key: string): Date | null {
  const raw = formData.get(key);
  if (raw == null || String(raw).trim() === "") return null;
  const value = String(raw).trim();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStringArray(formData: FormData, key: string): string[] {
  const raw = formData.get(key);
  if (raw == null) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

const ALLOWED_OPPORTUNITY_TYPES: OpportunityType[] = [
  "SUMMER_CAMP",
  "PARTNER_PROGRAM",
  "ONE_TIME_WORKSHOP",
  "MULTI_DAY_CAMP",
  "CHAPTER_CLASS_SERIES",
  "ONLINE_WORKSHOP",
  "OTHER",
];

const ALLOWED_OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  "DRAFT",
  "OPEN",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
];

const ALLOWED_URGENCIES: OpportunityUrgency[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const ALLOWED_DELIVERY_MODES: DeliveryMode[] = ["IN_PERSON", "VIRTUAL", "HYBRID"];
const ALLOWED_COURSE_LEVELS: CourseLevel[] = [
  "LEVEL_101",
  "LEVEL_201",
  "LEVEL_301",
  "LEVEL_401",
];
const ALLOWED_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "SUGGESTED",
  "PENDING",
  "CONFIRMED",
  "WAITLISTED",
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
];
const ALLOWED_ASSIGNMENT_ROLES: AssignmentRole[] = [
  "LEAD_INSTRUCTOR",
  "CO_INSTRUCTOR",
  "ASSISTANT",
  "SUBSTITUTE",
  "MENTOR",
];

function parseEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw && (allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return fallback;
}

// ----------------------------------------------------------------------------
// Opportunity CRUD
// ----------------------------------------------------------------------------

export async function createOpportunity(formData: FormData) {
  const actor = await requireAdmin();

  const title = getString(formData, "title");
  const type = parseEnum(
    getOptionalString(formData, "type"),
    ALLOWED_OPPORTUNITY_TYPES,
    "PARTNER_PROGRAM",
  );
  const status = parseEnum(
    getOptionalString(formData, "status"),
    ALLOWED_OPPORTUNITY_STATUSES,
    "OPEN",
  );
  const urgency = parseEnum(
    getOptionalString(formData, "urgency"),
    ALLOWED_URGENCIES,
    "NORMAL",
  );
  const deliveryMode = parseEnum(
    getOptionalString(formData, "deliveryMode"),
    ALLOWED_DELIVERY_MODES,
    "IN_PERSON",
  );
  const requiredCourseLevel = (() => {
    const raw = getOptionalString(formData, "requiredCourseLevel");
    if (!raw) return null;
    return ALLOWED_COURSE_LEVELS.includes(raw as CourseLevel)
      ? (raw as CourseLevel)
      : null;
  })();

  const opportunity = await prisma.workshopOpportunity.create({
    data: {
      title,
      partnerName: getOptionalString(formData, "partnerName"),
      type,
      status,
      urgency,
      deliveryMode,
      description: getOptionalString(formData, "description"),
      locationName: getOptionalString(formData, "locationName"),
      locationCity: getOptionalString(formData, "locationCity"),
      locationState: getOptionalString(formData, "locationState"),
      locationCountry: getOptionalString(formData, "locationCountry"),
      startDate: getDate(formData, "startDate"),
      endDate: getDate(formData, "endDate"),
      fillByDate: getDate(formData, "fillByDate"),
      slotsNeeded: getInt(formData, "slotsNeeded", 1),
      ageGroup: getOptionalString(formData, "ageGroup"),
      topicTags: getStringArray(formData, "topicTags"),
      requiredCourseLevel,
      chapterId: getOptionalString(formData, "chapterId"),
      ownerId: getOptionalString(formData, "ownerId") ?? actor.id,
      partnerContactName: getOptionalString(formData, "partnerContactName"),
      partnerContactEmail: getOptionalString(formData, "partnerContactEmail"),
      partnerContactPhone: getOptionalString(formData, "partnerContactPhone"),
      internalNotes: getOptionalString(formData, "internalNotes"),
      createdById: actor.id,
    },
  });

  revalidateOpportunitySurfaces(opportunity.id);
  return { success: true, opportunityId: opportunity.id };
}

export async function updateOpportunity(formData: FormData) {
  await requireAdmin();
  const opportunityId = getString(formData, "opportunityId");

  await prisma.workshopOpportunity.update({
    where: { id: opportunityId },
    data: {
      title: getString(formData, "title"),
      partnerName: getOptionalString(formData, "partnerName"),
      type: parseEnum(
        getOptionalString(formData, "type"),
        ALLOWED_OPPORTUNITY_TYPES,
        "PARTNER_PROGRAM",
      ),
      status: parseEnum(
        getOptionalString(formData, "status"),
        ALLOWED_OPPORTUNITY_STATUSES,
        "OPEN",
      ),
      urgency: parseEnum(
        getOptionalString(formData, "urgency"),
        ALLOWED_URGENCIES,
        "NORMAL",
      ),
      deliveryMode: parseEnum(
        getOptionalString(formData, "deliveryMode"),
        ALLOWED_DELIVERY_MODES,
        "IN_PERSON",
      ),
      description: getOptionalString(formData, "description"),
      locationName: getOptionalString(formData, "locationName"),
      locationCity: getOptionalString(formData, "locationCity"),
      locationState: getOptionalString(formData, "locationState"),
      locationCountry: getOptionalString(formData, "locationCountry"),
      startDate: getDate(formData, "startDate"),
      endDate: getDate(formData, "endDate"),
      fillByDate: getDate(formData, "fillByDate"),
      slotsNeeded: getInt(formData, "slotsNeeded", 1),
      ageGroup: getOptionalString(formData, "ageGroup"),
      topicTags: getStringArray(formData, "topicTags"),
      partnerContactName: getOptionalString(formData, "partnerContactName"),
      partnerContactEmail: getOptionalString(formData, "partnerContactEmail"),
      partnerContactPhone: getOptionalString(formData, "partnerContactPhone"),
      internalNotes: getOptionalString(formData, "internalNotes"),
    },
  });

  revalidateOpportunitySurfaces(opportunityId);
  return { success: true };
}

export async function archiveOpportunity(formData: FormData) {
  await requireAdmin();
  const opportunityId = getString(formData, "opportunityId");

  await prisma.workshopOpportunity.update({
    where: { id: opportunityId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  revalidateOpportunitySurfaces(opportunityId);
  return { success: true };
}

// ----------------------------------------------------------------------------
// Assignment CRUD
// ----------------------------------------------------------------------------

export async function createAssignment(formData: FormData) {
  const actor = await requireAdmin();
  const opportunityId = getString(formData, "opportunityId");
  const instructorId = getString(formData, "instructorId");
  const role = parseEnum(
    getOptionalString(formData, "role"),
    ALLOWED_ASSIGNMENT_ROLES,
    "LEAD_INSTRUCTOR",
  );
  const status = parseEnum(
    getOptionalString(formData, "status"),
    ALLOWED_ASSIGNMENT_STATUSES,
    "SUGGESTED",
  );

  // Idempotent: if the row already exists, just update its role/status so the
  // admin can re-click "Assign" without hitting the unique constraint.
  await prisma.instructorAssignment.upsert({
    where: { opportunityId_instructorId: { opportunityId, instructorId } },
    create: {
      opportunityId,
      instructorId,
      role,
      status,
      proposalId: getOptionalString(formData, "proposalId"),
      assignedById: actor.id,
      internalNotes: getOptionalString(formData, "internalNotes"),
      instructorNotes: getOptionalString(formData, "instructorNotes"),
    },
    update: {
      role,
      status,
      proposalId: getOptionalString(formData, "proposalId"),
      assignedById: actor.id,
      assignedAt: new Date(),
    },
  });

  await maybeAutoConfirmOpportunity(opportunityId);
  revalidateOpportunitySurfaces(opportunityId);
  return { success: true };
}

export async function updateAssignmentStatus(formData: FormData) {
  await requireAdmin();
  const assignmentId = getString(formData, "assignmentId");
  const status = parseEnum(
    getOptionalString(formData, "status"),
    ALLOWED_ASSIGNMENT_STATUSES,
    "SUGGESTED",
  );

  const now = new Date();
  const assignment = await prisma.instructorAssignment.update({
    where: { id: assignmentId },
    data: {
      status,
      instructorConfirmedAt:
        status === "CONFIRMED" || status === "PENDING" ? undefined : null,
      declinedAt: status === "DECLINED" ? now : null,
      cancelledAt: status === "CANCELLED" ? now : null,
      completedAt: status === "COMPLETED" ? now : null,
      // Re-stamp confirmation timestamps when explicitly transitioning into
      // CONFIRMED so admins can read "when was this locked in".
      ...(status === "CONFIRMED"
        ? {
            instructorConfirmedAt: now,
            partnerConfirmedAt: now,
          }
        : {}),
    },
    select: { opportunityId: true },
  });

  await maybeAutoConfirmOpportunity(assignment.opportunityId);
  revalidateOpportunitySurfaces(assignment.opportunityId);
  return { success: true };
}

export async function removeAssignment(formData: FormData) {
  await requireAdmin();
  const assignmentId = getString(formData, "assignmentId");

  const removed = await prisma.instructorAssignment.delete({
    where: { id: assignmentId },
    select: { opportunityId: true },
  });

  revalidateOpportunitySurfaces(removed.opportunityId);
  return { success: true };
}

/**
 * One-click shortlist: takes a comma-separated list of instructor IDs and
 * creates SUGGESTED assignments for each that doesn't already have one.
 * Used by the matching panel's "Shortlist top N" affordance.
 */
export async function bulkSuggestInstructors(formData: FormData) {
  const actor = await requireAdmin();
  const opportunityId = getString(formData, "opportunityId");
  const ids = getString(formData, "instructorIds")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (ids.length === 0) {
    return { success: true, created: 0 };
  }

  const existing = await prisma.instructorAssignment.findMany({
    where: { opportunityId, instructorId: { in: ids } },
    select: { instructorId: true },
  });
  const existingIds = new Set(existing.map((a) => a.instructorId));
  const toCreate = ids.filter((id) => !existingIds.has(id));

  if (toCreate.length > 0) {
    await prisma.instructorAssignment.createMany({
      data: toCreate.map((instructorId) => ({
        opportunityId,
        instructorId,
        role: "LEAD_INSTRUCTOR" as AssignmentRole,
        status: "SUGGESTED" as AssignmentStatus,
        assignedById: actor.id,
      })),
      skipDuplicates: true,
    });
  }

  revalidateOpportunitySurfaces(opportunityId);
  return { success: true, created: toCreate.length };
}

// ----------------------------------------------------------------------------
// Derived status helpers
// ----------------------------------------------------------------------------

/**
 * When the number of CONFIRMED assignments meets/exceeds slotsNeeded, flip
 * the opportunity to CONFIRMED. We do NOT flip backwards here — admins
 * downgrade manually via updateOpportunity to preserve their explicit intent.
 */
async function maybeAutoConfirmOpportunity(opportunityId: string) {
  const op = await prisma.workshopOpportunity.findUnique({
    where: { id: opportunityId },
    select: {
      status: true,
      slotsNeeded: true,
      assignments: { where: { status: "CONFIRMED" }, select: { id: true } },
    },
  });
  if (!op) return;
  if (op.status === "OPEN" && op.assignments.length >= op.slotsNeeded) {
    await prisma.workshopOpportunity.update({
      where: { id: opportunityId },
      data: { status: "CONFIRMED" },
    });
  }
}
