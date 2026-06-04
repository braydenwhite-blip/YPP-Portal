import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";

/**
 * People Strategy — Action Tracker "Classes" data source.
 *
 * READ-ONLY view over the existing `ClassOffering` records (see
 * INTEGRATION_MAP.md §11). We deliberately do NOT copy class data into
 * `ActionItem`; the Classes tab and the /my-actions teaching feed read live
 * offerings directly.
 *
 * Instructor roles use the real relations:
 *   - Lead Instructor      → `ClassOffering.instructor` (relation
 *                            "ClassOfferingsInstructed").
 *   - Executing Instructors → active `RegularInstructorAssignment` rows
 *                            (relation "RegularInstructorAssignmentsForOffering"),
 *                            carrying RegularInstructorAssignmentRole.
 *
 * Gated by ENABLE_ACTION_TRACKER like the rest of the tracker — returns an
 * empty list when the flag is off.
 */

/** Assignment states that represent live coverage (mirror of the regular-
 * instructor dashboard's ACTIVE_COVERAGE_STATUSES). */
const ACTIVE_ASSIGNMENT_STATUSES = [
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
  "OFFERED",
  "PENDING_REVIEW",
] as const;

/** Offering statuses shown in the tracker (active / runnable classes). */
const TRACKER_OFFERING_STATUSES = ["DRAFT", "PUBLISHED", "IN_PROGRESS"] as const;

const TRACKER_CLASS_SELECT = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  meetingDays: true,
  meetingTime: true,
  timezone: true,
  deliveryMode: true,
  status: true,
  chapter: { select: { id: true, name: true } },
  instructor: { select: { id: true, name: true, email: true } },
  partner: {
    select: {
      id: true,
      name: true,
      relationshipLead: { select: { id: true, name: true, email: true } },
    },
  },
  regularInstructorAssignments: {
    where: { status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      status: true,
      instructor: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.ClassOfferingSelect;

export type TrackerClass = Prisma.ClassOfferingGetPayload<{
  select: typeof TRACKER_CLASS_SELECT;
}>;

/** A person displayed in the Executing Instructors line, with their role. */
export type TrackerClassExecutor = {
  id: string;
  name: string;
  role: TrackerClass["regularInstructorAssignments"][number]["role"];
};

/**
 * Executing instructors for a class: active assignments, excluding a LEAD-role
 * assignment that just re-states the primary lead instructor (so we never list
 * the lead twice).
 */
export function executingInstructors(offering: TrackerClass): TrackerClassExecutor[] {
  return offering.regularInstructorAssignments
    .filter((a) => !(a.role === "LEAD" && a.instructor.id === offering.instructor.id))
    .map((a) => ({
      id: a.instructor.id,
      name: a.instructor.name ?? a.instructor.email ?? "Unknown",
      role: a.role,
    }));
}

/** Human-readable schedule string: "Mon/Wed 16:00-18:00". */
export function formatClassSchedule(offering: TrackerClass): string {
  const days = offering.meetingDays.map((d) => d.slice(0, 3)).join("/");
  return [days, offering.meetingTime].filter(Boolean).join(" ").trim();
}

/** Date-range string for the meta line: "Jun 10 – Aug 1". */
export function formatClassDateRange(offering: TrackerClass): string {
  return `${formatMonthDay(offering.startDate)} – ${formatMonthDay(offering.endDate)}`;
}

/**
 * All active class offerings for the leadership Classes tab, soonest start
 * first. Read-only.
 */
export async function listTrackerClasses(): Promise<TrackerClass[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.classOffering.findMany({
    where: { status: { in: [...TRACKER_OFFERING_STATUSES] } },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    take: 250,
    select: TRACKER_CLASS_SELECT,
  });
}

/**
 * Classes the given user teaches — as the lead instructor (`instructorId`) or
 * via an active regular-instructor assignment. Used to surface a teacher's
 * classes in their /my-actions feed alongside action items. Read-only.
 */
export async function getMyTeachingClasses(userId: string): Promise<TrackerClass[]> {
  if (!isActionTrackerEnabled()) return [];

  return prisma.classOffering.findMany({
    where: {
      status: { in: [...TRACKER_OFFERING_STATUSES] },
      OR: [
        { instructorId: userId },
        {
          regularInstructorAssignments: {
            some: {
              instructorId: userId,
              status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
            },
          },
        },
      ],
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: TRACKER_CLASS_SELECT,
  });
}
