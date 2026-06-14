import { Prisma, RoleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  whereActiveMember,
  whereUserHasAnyRole,
  whereUserHasRole,
} from "@/lib/user-role-where";

/**
 * Master People database reads (Knowledge OS V2, plan §9).
 *
 * One directory over every person connected to YPP — no new person model;
 * a filtered query over `User` plus the role satellites that matter at the
 * directory altitude: advisor state for students, current classes and last
 * review for instructors, pipeline stage for applicants. Anything deeper is
 * preview/360 altitude and loads through /api/entity-360.
 *
 * Officer-tier only (the page gates) — advisor check-in state and applicant
 * stages are leadership reads.
 */

export const PEOPLE_ROLE_FILTERS = [
  "all",
  "student",
  "instructor",
  "mentor",
  "advisor",
  "leadership",
  "applicant",
  "parent",
] as const;
export type PeopleRoleFilter = (typeof PEOPLE_ROLE_FILTERS)[number];

export const PEOPLE_ROLE_FILTER_LABELS: Record<PeopleRoleFilter, string> = {
  all: "All members",
  student: "Students",
  instructor: "Instructors",
  mentor: "Mentors",
  advisor: "Advisors",
  leadership: "Leadership & staff",
  applicant: "Applicants",
  parent: "Parents",
};

export const PEOPLE_FLAG_FILTERS = ["needs-attention", "no-advisor", "checkin-overdue"] as const;
export type PeopleFlagFilter = (typeof PEOPLE_FLAG_FILTERS)[number];

export const PEOPLE_FLAG_FILTER_LABELS: Record<PeopleFlagFilter, string> = {
  "needs-attention": "Needs attention",
  "no-advisor": "No advisor",
  "checkin-overdue": "Check-in overdue",
};

/** Filters shown on the simplified People directory page. */
export const PEOPLE_SIMPLE_ROLE_FILTERS = [
  "all",
  "student",
  "instructor",
  "applicant",
] as const satisfies readonly PeopleRoleFilter[];

export function asPeopleRoleFilter(value: string | undefined): PeopleRoleFilter {
  return value && (PEOPLE_ROLE_FILTERS as readonly string[]).includes(value)
    ? (value as PeopleRoleFilter)
    : "all";
}

export function asPeopleFlagFilter(value: string | undefined): PeopleFlagFilter | null {
  return value && (PEOPLE_FLAG_FILTERS as readonly string[]).includes(value)
    ? (value as PeopleFlagFilter)
    : null;
}

const OFFICER_ROLES: readonly RoleType[] = [
  RoleType.ADMIN,
  RoleType.STAFF,
  RoleType.CHAPTER_PRESIDENT,
  RoleType.HIRING_CHAIR,
];

function whereForRoleFilter(role: PeopleRoleFilter): Prisma.UserWhereInput {
  switch (role) {
    case "student":
      return whereUserHasRole(RoleType.STUDENT);
    case "instructor":
      return whereUserHasRole(RoleType.INSTRUCTOR);
    case "mentor":
      return whereUserHasRole(RoleType.MENTOR);
    case "advisor":
      // An advisor is someone actually carrying an active advising caseload.
      return { advisorAssignments: { some: { isActive: true } } };
    case "leadership":
      return whereUserHasAnyRole(OFFICER_ROLES);
    case "applicant":
      // Pure applicants only — multi-role members who once applied belong to
      // their member role views, mirroring whereActiveMember()'s reasoning.
      return { primaryRole: RoleType.APPLICANT };
    case "parent":
      return whereUserHasRole(RoleType.PARENT);
    case "all":
    default:
      return whereActiveMember();
  }
}

function whereForFlagFilter(
  flag: PeopleFlagFilter | null,
  now: Date
): Prisma.UserWhereInput {
  switch (flag) {
    case "needs-attention":
      return {
        OR: [
          {
            ...whereUserHasRole(RoleType.STUDENT),
            adviseeAssignments: { none: { isActive: true } },
          },
          {
            adviseeAssignments: {
              some: { isActive: true, nextCheckInDueAt: { lt: now } },
            },
          },
        ],
      };
    case "no-advisor":
      return {
        ...whereUserHasRole(RoleType.STUDENT),
        adviseeAssignments: { none: { isActive: true } },
      };
    case "checkin-overdue":
      return {
        adviseeAssignments: {
          some: { isActive: true, nextCheckInDueAt: { lt: now } },
        },
      };
    default:
      return {};
  }
}

export type PeopleDirectoryParams = {
  q?: string;
  role?: PeopleRoleFilter;
  flag?: PeopleFlagFilter | null;
  /**
   * Advisor caseload view (plan §12): restrict to students actively advised
   * by this user. Linked from the instructor record's caseload section.
   */
  advisorId?: string | null;
  /** Row cap; the page shows "N of total" when the cap bites. */
  take?: number;
};

const DIRECTORY_ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  primaryRole: true,
  title: true,
  createdAt: true,
  chapter: { select: { name: true } },
  profile: { select: { grade: true, school: true } },
  roles: { select: { role: true } },
  // Advisor state — the always-visible student facts (plan §12).
  adviseeAssignments: {
    where: { isActive: true },
    take: 1,
    select: {
      lastCheckInAt: true,
      nextCheckInDueAt: true,
      needsFollowUp: true,
      advisor: { select: { id: true, name: true, email: true } },
    },
  },
  // Advising caseload size — marks the person as an active advisor.
  _count: {
    select: {
      advisorAssignments: { where: { isActive: true } },
      classOfferingsInstructed: {
        where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
      },
    },
  },
  // Applicant pipeline stage (latest application).
  instructorApplications: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { status: true, applicationTrack: true },
  },
} satisfies Prisma.UserSelect;

type DirectoryRowRaw = Prisma.UserGetPayload<{ select: typeof DIRECTORY_ROW_SELECT }>;

/** Serializable row shape for the client table. */
export type PersonDirectoryRow = {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  /** All held roles (primary + secondary), deduped. */
  roleSet: string[];
  title: string | null;
  affiliation: string | null;
  joinedAtISO: string;
  /** Student advisor state; null when not a student or no assignment. */
  advisor: {
    id: string;
    name: string;
    lastCheckInISO: string | null;
    nextCheckInISO: string | null;
    overdue: boolean;
    needsFollowUp: boolean;
  } | null;
  /** Concrete attention/context chips, already worded (plan §19). */
  flags: Array<{ label: string; tone: "danger" | "warning" | "info" | "neutral" }>;
  /** Current classes taught (instructor read). */
  currentClassCount: number;
  /** Active advising caseload size (advisor read). */
  adviseeCount: number;
  /** Latest instructor-application status (applicant read). */
  applicationStatus: string | null;
};

const APPLICATION_WAITING_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
  "PRE_APPROVED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "CHAIR_REVIEW",
]);

function prettyStatus(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

function toRow(user: DirectoryRowRaw, now: Date): PersonDirectoryRow {
  const roleSet = Array.from(
    new Set<string>([user.primaryRole, ...user.roles.map((r) => r.role)])
  );
  const isStudent = roleSet.includes("STUDENT");
  const isInstructor = roleSet.includes("INSTRUCTOR");
  const isApplicant = user.primaryRole === "APPLICANT";

  const advising = user.adviseeAssignments[0] ?? null;
  const overdue = Boolean(
    advising?.nextCheckInDueAt && advising.nextCheckInDueAt.getTime() < now.getTime()
  );

  const application = user.instructorApplications[0] ?? null;

  const flags: PersonDirectoryRow["flags"] = [];
  if (isStudent) {
    if (!advising) {
      flags.push({ label: "No advisor", tone: "danger" });
    } else if (overdue) {
      flags.push({ label: "Check-in overdue", tone: "danger" });
    }
    if (advising?.needsFollowUp) {
      flags.push({ label: "Follow-up flagged", tone: "warning" });
    }
  }
  if (isInstructor && user._count.classOfferingsInstructed === 0) {
    flags.push({ label: "No current classes", tone: "neutral" });
  }
  if (isApplicant && application && APPLICATION_WAITING_STATUSES.has(application.status)) {
    flags.push({ label: "Waiting on decision", tone: "warning" });
  }

  const affiliation =
    user.chapter?.name ??
    user.profile?.school ??
    (application?.applicationTrack ? prettyStatus(application.applicationTrack) : null);

  return {
    id: user.id,
    name: user.name || user.email,
    email: user.email,
    primaryRole: user.primaryRole,
    roleSet,
    title: user.title,
    affiliation,
    joinedAtISO: user.createdAt.toISOString(),
    advisor: advising
      ? {
          id: advising.advisor.id,
          name: advising.advisor.name ?? advising.advisor.email,
          lastCheckInISO: advising.lastCheckInAt?.toISOString() ?? null,
          nextCheckInISO: advising.nextCheckInDueAt?.toISOString() ?? null,
          overdue,
          needsFollowUp: advising.needsFollowUp,
        }
      : null,
    flags,
    currentClassCount: user._count.classOfferingsInstructed,
    adviseeCount: user._count.advisorAssignments,
    applicationStatus: application ? prettyStatus(application.status) : null,
  };
}

export type PeopleDirectoryStats = {
  students: number;
  instructors: number;
  applicantsInProcess: number;
  studentsWithoutAdvisor: number;
  checkInsOverdue: number;
};

export type PeopleDirectoryResult = {
  rows: PersonDirectoryRow[];
  total: number;
  stats: PeopleDirectoryStats;
  /** Set when the caseload filter is active — the advisor being viewed. */
  advisorFilter: { id: string; name: string } | null;
};

export async function loadPeopleDirectory(
  params: PeopleDirectoryParams
): Promise<PeopleDirectoryResult> {
  const now = new Date();
  const role = params.role ?? "all";
  const flag = params.flag ?? null;
  const advisorId = params.advisorId ?? null;
  const q = params.q?.trim();
  const take = params.take ?? 250;

  const where: Prisma.UserWhereInput = {
    AND: [
      { archivedAt: null },
      whereForRoleFilter(role),
      whereForFlagFilter(flag, now),
      ...(advisorId
        ? [{ adviseeAssignments: { some: { isActive: true, advisorId } } }]
        : []),
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const advisorFilterPromise = advisorId
    ? prisma.user.findUnique({
        where: { id: advisorId },
        select: { id: true, name: true, email: true },
      })
    : Promise.resolve(null);

  const [users, total, students, instructors, applicantsInProcess, noAdvisor, overdue, advisorUser] =
    await Promise.all([
      prisma.user.findMany({
        where,
        select: DIRECTORY_ROW_SELECT,
        orderBy: [{ name: "asc" }, { email: "asc" }],
        take,
      }),
      prisma.user.count({ where }),
      prisma.user.count({
        where: { archivedAt: null, ...whereUserHasRole(RoleType.STUDENT) },
      }),
      prisma.user.count({
        where: { archivedAt: null, ...whereUserHasRole(RoleType.INSTRUCTOR) },
      }),
      prisma.user.count({
        where: {
          archivedAt: null,
          primaryRole: RoleType.APPLICANT,
          instructorApplications: {
            some: {
              status: {
                in: [
                  "SUBMITTED",
                  "UNDER_REVIEW",
                  "INFO_REQUESTED",
                  "PRE_APPROVED",
                  "INTERVIEW_SCHEDULED",
                  "INTERVIEW_COMPLETED",
                  "CHAIR_REVIEW",
                ],
              },
            },
          },
        },
      }),
      prisma.user.count({
        where: { archivedAt: null, ...whereForFlagFilter("no-advisor", now) },
      }),
      prisma.user.count({
        where: { archivedAt: null, ...whereForFlagFilter("checkin-overdue", now) },
      }),
      advisorFilterPromise,
    ]);

  return {
    rows: users.map((user) => toRow(user, now)),
    total,
    stats: {
      students,
      instructors,
      applicantsInProcess,
      studentsWithoutAdvisor: noAdvisor,
      checkInsOverdue: overdue,
    },
    advisorFilter: advisorUser
      ? { id: advisorUser.id, name: advisorUser.name || advisorUser.email }
      : null,
  };
}
