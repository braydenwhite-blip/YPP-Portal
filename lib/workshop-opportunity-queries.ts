/**
 * Read-only queries for the instructor assignment system.
 *
 * Separated from `workshop-opportunity-actions.ts` (which contains `"use server"`
 * mutations) so pages can import these freely without forcing every caller
 * through the Server Action boundary.
 */

import { prisma } from "@/lib/prisma";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  deriveCoverage,
  needsAttention,
  scoreInstructorMatch,
  rankCandidates,
  type CandidateInstructor,
  type MatchScore,
} from "@/lib/instructor-assignment-matching";
import type {
  OpportunityStatus,
  OpportunityUrgency,
  WorkshopOpportunity,
  InstructorAssignment,
  AssignmentStatus,
  CourseLevel,
} from "@prisma/client";

// ----------------------------------------------------------------------------
// Listing
// ----------------------------------------------------------------------------

export type OpportunityListFilters = {
  status?: OpportunityStatus;
  urgency?: OpportunityUrgency;
  chapterId?: string;
  type?: WorkshopOpportunity["type"];
  search?: string;
  /** When true, hide DRAFT / CANCELLED / COMPLETED / ARCHIVED rows. */
  activeOnly?: boolean;
};

export type OpportunityListItem = {
  id: string;
  title: string;
  partnerName: string | null;
  type: WorkshopOpportunity["type"];
  status: OpportunityStatus;
  urgency: OpportunityUrgency;
  deliveryMode: WorkshopOpportunity["deliveryMode"];
  locationCity: string | null;
  locationState: string | null;
  startDate: Date | null;
  endDate: Date | null;
  fillByDate: Date | null;
  slotsNeeded: number;
  ageGroup: string | null;
  topicTags: string[];
  chapter: { id: string; name: string } | null;
  owner: { id: string; name: string | null } | null;
  coverage: ReturnType<typeof deriveCoverage>;
  needsAttention: boolean;
};

export async function listOpportunities(
  filters: OpportunityListFilters = {},
): Promise<OpportunityListItem[]> {
  const activeStatuses: OpportunityStatus[] = ["DRAFT", "OPEN", "CONFIRMED"];

  const rows = await prisma.workshopOpportunity.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.urgency ? { urgency: filters.urgency } : {}),
      ...(filters.chapterId ? { chapterId: filters.chapterId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.activeOnly ? { status: { in: activeStatuses } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { partnerName: { contains: filters.search, mode: "insensitive" } },
              { locationCity: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [
      { urgency: "desc" },
      { fillByDate: "asc" },
      { startDate: "asc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      partnerName: true,
      type: true,
      status: true,
      urgency: true,
      deliveryMode: true,
      locationCity: true,
      locationState: true,
      startDate: true,
      endDate: true,
      fillByDate: true,
      slotsNeeded: true,
      ageGroup: true,
      topicTags: true,
      chapter: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      assignments: { select: { status: true } },
    },
  });

  return rows.map((row) => {
    const coverage = deriveCoverage(row.slotsNeeded, row.assignments);
    return {
      id: row.id,
      title: row.title,
      partnerName: row.partnerName,
      type: row.type,
      status: row.status,
      urgency: row.urgency,
      deliveryMode: row.deliveryMode,
      locationCity: row.locationCity,
      locationState: row.locationState,
      startDate: row.startDate,
      endDate: row.endDate,
      fillByDate: row.fillByDate,
      slotsNeeded: row.slotsNeeded,
      ageGroup: row.ageGroup,
      topicTags: row.topicTags,
      chapter: row.chapter,
      owner: row.owner,
      coverage,
      needsAttention: needsAttention({
        status: row.status,
        urgency: row.urgency,
        fillByDate: row.fillByDate,
        coverage,
      }),
    };
  });
}

// ----------------------------------------------------------------------------
// Dashboard summary
// ----------------------------------------------------------------------------

export type AssignmentDashboardSummary = {
  open: number;
  uncovered: number;
  pendingConfirmation: number;
  confirmed: number;
  upcoming: number;
  urgent: number;
  overloadedInstructors: number;
};

export async function getAssignmentDashboardSummary(): Promise<AssignmentDashboardSummary> {
  const [opportunities, pending, confirmed, instructorLoads] = await Promise.all([
    prisma.workshopOpportunity.findMany({
      where: { status: { in: ["DRAFT", "OPEN", "CONFIRMED"] } },
      select: {
        slotsNeeded: true,
        status: true,
        urgency: true,
        fillByDate: true,
        startDate: true,
        assignments: { select: { status: true } },
      },
    }),
    prisma.instructorAssignment.count({ where: { status: "PENDING" } }),
    prisma.instructorAssignment.count({ where: { status: "CONFIRMED" } }),
    prisma.instructorAssignment.groupBy({
      by: ["instructorId"],
      where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
      _count: { _all: true },
    }),
  ]);

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let open = 0;
  let uncovered = 0;
  let upcoming = 0;
  let urgent = 0;

  for (const op of opportunities) {
    if (op.status === "OPEN") open += 1;
    const coverage = deriveCoverage(op.slotsNeeded, op.assignments);
    if (op.status !== "CONFIRMED" && coverage.uncovered) uncovered += 1;
    if (op.startDate && op.startDate <= thirtyDaysOut && op.startDate >= now) {
      upcoming += 1;
    }
    if (
      needsAttention({
        status: op.status,
        urgency: op.urgency,
        fillByDate: op.fillByDate,
        coverage,
        now,
      }) &&
      (op.urgency === "HIGH" || op.urgency === "URGENT")
    ) {
      urgent += 1;
    }
  }

  const overloadedInstructors = instructorLoads.filter(
    (load) => load._count._all >= 3,
  ).length;

  return {
    open,
    uncovered,
    pendingConfirmation: pending,
    confirmed,
    upcoming,
    urgent,
    overloadedInstructors,
  };
}

// ----------------------------------------------------------------------------
// Detail view
// ----------------------------------------------------------------------------

export async function getOpportunityDetail(opportunityId: string) {
  return prisma.workshopOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      chapter: { select: { id: true, name: true, region: true } },
      owner: {
        select: { id: true, name: true, email: true },
      },
      createdBy: { select: { id: true, name: true } },
      assignments: {
        orderBy: [{ status: "asc" }, { assignedAt: "desc" }],
        include: {
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: { select: { city: true, stateProvince: true } },
            },
          },
          proposal: {
            select: {
              id: true,
              status: true,
              sourceType: true,
              template: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
}

// ----------------------------------------------------------------------------
// Suggested instructors
//
// Pulls approved or in-progress instructors, joins their profile + recent
// instructor application + teaching permissions + active assignment count
// + most recent workshop proposal, and runs `scoreInstructorMatch`.
// ----------------------------------------------------------------------------

export type SuggestedInstructor = {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  state: string | null;
  subjects: string | null;
  applicationStatus: string | null;
  applicationTrack: string | null;
  activeAssignmentCount: number;
  hasApprovedProposal: boolean;
  teachingLevels: CourseLevel[];
  alreadyAssigned: boolean;
  score: MatchScore;
};

export async function getSuggestedInstructors(opportunity: {
  id: string;
  topicTags: string[];
  deliveryMode: WorkshopOpportunity["deliveryMode"];
  locationCity: string | null;
  locationState: string | null;
  requiredCourseLevel: CourseLevel | null;
}): Promise<SuggestedInstructor[]> {
  // Existing assignments on this opportunity — those instructors should be
  // marked as "already assigned" but still appear so admins can re-score.
  const existingAssignments = await prisma.instructorAssignment.findMany({
    where: { opportunityId: opportunity.id },
    select: { instructorId: true },
  });
  const existingIds = new Set(existingAssignments.map((a) => a.instructorId));

  // Candidate pool: anyone who has filed an InstructorApplication OR holds
  // an INSTRUCTOR role. We over-fetch and let the score sort it out — at 200
  // instructors this is fine; if it ever exceeds ~2k we'll paginate.
  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "INSTRUCTOR" } } },
        { instructorApplications: { some: {} } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      profile: { select: { city: true, stateProvince: true } },
      instructorApplications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          status: true,
          city: true,
          stateProvince: true,
          subjectsOfInterest: true,
          applicationTrack: true,
        },
      },
      teachingPermissions: { select: { level: true } },
      workshopProposalSubmissions: {
        where: { status: "APPROVED" },
        select: { id: true },
        take: 1,
      },
      instructorAssignments: {
        where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
        select: { id: true },
      },
    },
    take: 500,
  });

  const scored: SuggestedInstructor[] = candidates.map((c) => {
    const app = c.instructorApplications[0] ?? null;
    const instructor: CandidateInstructor = {
      id: c.id,
      city: app?.city ?? c.profile?.city ?? null,
      state: app?.stateProvince ?? c.profile?.stateProvince ?? null,
      subjects: app?.subjectsOfInterest ?? null,
      applicationStatus: app?.status ?? null,
      applicationTrack: app?.applicationTrack ?? null,
      activeAssignmentCount: c.instructorAssignments.length,
      hasApprovedProposal: c.workshopProposalSubmissions.length > 0,
      teachingLevels: c.teachingPermissions.map((p) => p.level),
    };
    const score = scoreInstructorMatch(instructor, {
      topicTags: opportunity.topicTags,
      deliveryMode: opportunity.deliveryMode,
      locationCity: opportunity.locationCity,
      locationState: opportunity.locationState,
      requiredCourseLevel: opportunity.requiredCourseLevel,
    });
    const fullName = c.name?.trim() || "Unnamed instructor";
    return {
      id: c.id,
      name: fullName,
      email: c.email,
      city: instructor.city,
      state: instructor.state,
      subjects: instructor.subjects,
      applicationStatus: instructor.applicationStatus,
      applicationTrack: instructor.applicationTrack,
      activeAssignmentCount: instructor.activeAssignmentCount,
      hasApprovedProposal: instructor.hasApprovedProposal,
      teachingLevels: instructor.teachingLevels,
      alreadyAssigned: existingIds.has(c.id),
      score,
    };
  });

  return rankCandidates(scored);
}

// ----------------------------------------------------------------------------
// Instructor-side queries (read-only, defensive for Phase 2)
// ----------------------------------------------------------------------------

export async function listAssignmentsForInstructor(instructorId: string) {
  return prisma.instructorAssignment.findMany({
    where: {
      instructorId,
      status: { in: ["PENDING", "CONFIRMED", "WAITLISTED", "COMPLETED"] },
    },
    orderBy: [{ status: "asc" }, { assignedAt: "desc" }],
    include: {
      opportunity: {
        select: {
          id: true,
          title: true,
          partnerName: true,
          deliveryMode: true,
          locationCity: true,
          locationState: true,
          startDate: true,
          endDate: true,
          ageGroup: true,
          topicTags: true,
        },
      },
    },
  });
}
