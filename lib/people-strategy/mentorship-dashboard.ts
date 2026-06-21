import type { GoalReviewStatus, MenteeRoleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getUserTitle } from "@/lib/user-title";
import { listMentorshipApplications } from "@/lib/mentorship-2/queries";
import { OPEN_APPLICATION_STATUSES } from "@/lib/mentorship-2/constants";
import { computeProvisionalStatus } from "./provisional";
import { loadPeoplePerformance } from "./people-performance";
import { loadMentorshipHealth } from "./mentorship-health";
import { monthKeyUTC, parseMonthKey } from "./people-performance-selectors";

export const MENTORSHIP_DASHBOARD_FILTERS = [
  "needs-review",
  "needs-checkin",
  "missing-gr",
  "active-pairs",
  "follow-ups",
] as const;

export type MentorshipDashboardFilter = (typeof MENTORSHIP_DASHBOARD_FILTERS)[number];

export const MENTORSHIP_FILTER_META: Record<
  MentorshipDashboardFilter,
  { label: string; dotClass: string; sectionTitle: string; sectionHint: string }
> = {
  "needs-review": {
    label: "Needs review",
    dotClass: "bg-[#e07b2d]",
    sectionTitle: "Members awaiting review",
    sectionHint: "Provisional or new — mentor review not yet written.",
  },
  "needs-checkin": {
    label: "Needs check-in",
    dotClass: "bg-[#c0392b]",
    sectionTitle: "Members needing a check-in",
    sectionHint: "Current month check-in not compiled yet.",
  },
  "missing-gr": {
    label: "Missing G&Rs",
    dotClass: "bg-[#5a1da8]",
    sectionTitle: "Pairs missing goals & resources",
    sectionHint: "Active mentorship with no G&R document on file.",
  },
  "active-pairs": {
    label: "Active pairs",
    dotClass: "bg-[#5a1da8]",
    sectionTitle: "Active mentor · mentee pairs",
    sectionHint: "Every active pairing in the program.",
  },
  "follow-ups": {
    label: "Follow-ups",
    dotClass: "bg-[#0e9f6e]",
    sectionTitle: "Follow-ups needed",
    sectionHint: "Stale check-ins or stalled cycles that need a nudge.",
  },
};

export type MentorshipQueueRow = {
  id: string;
  personId: string;
  name: string;
  subtitle: string;
  statusLabel: string;
  statusTone: "warning" | "info" | "success" | "danger" | "neutral";
  personHref: string;
  adminHref: string;
};

export type MentorshipApplicationRow = {
  id: string;
  applicantId: string;
  name: string;
  programLabel: string;
  detailText: string;
  statusLabel: string;
  statusTone: "warning" | "brand" | "info";
  meetingsHref: string;
  personHref: string;
};

export type MentorshipCommitteeRow = {
  id: string;
  tier: string;
  chairLine: string;
  meetingDateLabel: string;
};

export type MentorshipDashboardData = {
  counts: Record<MentorshipDashboardFilter, number>;
  queues: Record<MentorshipDashboardFilter, MentorshipQueueRow[]>;
  applications: MentorshipApplicationRow[];
  committees: MentorshipCommitteeRow[];
};

const APPROVED_REVIEW: GoalReviewStatus = "APPROVED";

const COMMITTEE_TIERS: Array<{
  id: string;
  tier: string;
  roleTypes: MenteeRoleType[];
  meetingDay: number;
}> = [
  { id: "officers", tier: "Officers", roleTypes: ["GLOBAL_LEADERSHIP"], meetingDay: 8 },
  { id: "instructors", tier: "Instructors", roleTypes: ["INSTRUCTOR"], meetingDay: 10 },
  { id: "leadership", tier: "Leadership", roleTypes: ["CHAPTER_PRESIDENT"], meetingDay: 12 },
];

function programLabelFromApplication(app: {
  programGroup: string;
  interests: string[];
}): string {
  const lane =
    app.interests[0] ??
    (app.programGroup === "STUDENT" ? "Student" : "Expansion");
  return `Mentorship application · ${lane}`;
}

function meetingDateForQuarter(now: Date, day: number): string {
  const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3 + 2;
  const month = new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, day));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(month);
}

function mentorCountForTier(
  mentorships: Array<{ mentor: { id: string }; mentee: { primaryRole: string | null } }>,
  tierId: string
): number {
  const rolesByTier: Record<string, string[]> = {
    officers: ["ADMIN", "STAFF", "OFFICER"],
    instructors: ["INSTRUCTOR", "MENTOR"],
    leadership: ["CHAPTER_PRESIDENT"],
  };
  const roles = rolesByTier[tierId] ?? [];
  const mentorIds = new Set<string>();
  for (const m of mentorships) {
    if (m.mentee.primaryRole && roles.includes(m.mentee.primaryRole)) {
      mentorIds.add(m.mentor.id);
    }
  }
  return mentorIds.size;
}

function buildCommitteeRows(
  chairs: Array<{ roleType: MenteeRoleType; user: { name: string | null } }>,
  mentorships: Array<{ mentor: { id: string }; mentee: { primaryRole: string | null } }>,
  now: Date
): MentorshipCommitteeRow[] {
  return COMMITTEE_TIERS.map((tier) => {
    const chair = chairs.find((c) => tier.roleTypes.includes(c.roleType));
    const chairName = chair?.user.name ?? "People Chair";
    const mentorCount = mentorCountForTier(mentorships, tier.id);
    return {
      id: tier.id,
      tier: tier.tier,
      chairLine: `Chair ${chairName} (${tier.tier}) + ${mentorCount} mentors · reviews performance, potential & role fit.`,
      meetingDateLabel: meetingDateForQuarter(now, tier.meetingDay),
    };
  });
}

export async function loadMentorshipDashboard(
  now: Date = new Date()
): Promise<MentorshipDashboardData> {
  const currentMonthKey = monthKeyUTC(now);
  const monthStart =
    parseMonthKey(currentMonthKey) ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );

  const [performance, health, mentorships, applications, chairs] =
    await Promise.all([
      loadPeoplePerformance(now),
      loadMentorshipHealth(now),
      prisma.mentorship.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          startDate: true,
          mentee: {
            select: {
              id: true,
              name: true,
              email: true,
              title: true,
              primaryRole: true,
              adminSubtypes: { select: { subtype: true } },
              provisionalStart: true,
              provisionalConfirmedAt: true,
              createdAt: true,
            },
          },
          mentor: { select: { id: true, name: true, email: true } },
          grDocuments: {
            where: { status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [{ mentee: { name: "asc" } }],
        take: 200,
      }),
      listMentorshipApplications({ statuses: [...OPEN_APPLICATION_STATUSES] }),
      prisma.mentorCommitteeChair.findMany({
        where: { isActive: true },
        select: {
          roleType: true,
          user: { select: { name: true } },
        },
      }),
    ]);

  const menteeIds = mentorships.map((m) => m.mentee.id);
  const reviews =
    menteeIds.length === 0
      ? []
      : await prisma.mentorGoalReview.findMany({
          where: {
            menteeId: { in: menteeIds },
            cycleMonth: { gte: monthStart, lt: monthEnd },
          },
          select: { menteeId: true, status: true },
          orderBy: { createdAt: "desc" },
        });
  const reviewByMentee = new Map<string, GoalReviewStatus>();
  for (const row of reviews) {
    if (!reviewByMentee.has(row.menteeId)) reviewByMentee.set(row.menteeId, row.status);
  }

  const performanceById = new Map(performance.rows.map((r) => [r.id, r]));

  const needsReview: MentorshipQueueRow[] = [];
  const missingGr: MentorshipQueueRow[] = [];
  const activePairs: MentorshipQueueRow[] = [];
  const needsCheckIn: MentorshipQueueRow[] = [];

  for (const m of mentorships) {
    const mentee = m.mentee;
    const name = mentee.name ?? mentee.email;
    const mentorName = m.mentor.name ?? m.mentor.email;
    const roleTitle = getUserTitle({
      title: mentee.title,
      primaryRole: mentee.primaryRole,
      adminSubtypes: mentee.adminSubtypes.map((s) => s.subtype),
    });
    const provisional = computeProvisionalStatus(
      mentee.provisionalStart,
      mentee.provisionalConfirmedAt,
      now
    );
    const isNew =
      now.getTime() - mentee.createdAt.getTime() < 60 * 86_400_000 ||
      now.getTime() - m.startDate.getTime() < 45 * 86_400_000;
    const statusNote = provisional.isProvisional
      ? "provisional"
      : isNew
        ? "new"
        : null;
    const reviewStatus = reviewByMentee.get(mentee.id);
    const subtitle = [
      `Mentor ${mentorName}`,
      roleTitle,
      statusNote,
    ]
      .filter(Boolean)
      .join(" · ");

    const personHref = `/people/${mentee.id}`;
    const adminHref = `/admin/mentorship/relationships/${m.id}`;

    activePairs.push({
      id: m.id,
      personId: mentee.id,
      name,
      subtitle,
      statusLabel: "Active",
      statusTone: "success",
      personHref,
      adminHref,
    });

    if (m.grDocuments.length === 0) {
      missingGr.push({
        id: `gr-${m.id}`,
        personId: mentee.id,
        name,
        subtitle,
        statusLabel: "G&R missing",
        statusTone: "warning",
        personHref,
        adminHref,
      });
    }

    const reviewDue =
      provisional.isProvisional ||
      isNew ||
      !reviewStatus ||
      reviewStatus !== APPROVED_REVIEW;

    if (reviewDue) {
      needsReview.push({
        id: `review-${m.id}`,
        personId: mentee.id,
        name,
        subtitle,
        statusLabel: "Review due",
        statusTone: "warning",
        personHref,
        adminHref,
      });
    }

    const perf = performanceById.get(mentee.id);
    if (perf?.facts.needsCheckIn) {
      needsCheckIn.push({
        id: `checkin-${m.id}`,
        personId: mentee.id,
        name,
        subtitle,
        statusLabel: "Check-in due",
        statusTone: "danger",
        personHref,
        adminHref,
      });
    }
  }

  const followUps: MentorshipQueueRow[] = health.atRisk.map((p) => ({
    id: `follow-${p.id}`,
    personId: p.menteeId,
    name: p.menteeName,
    subtitle: `Mentor ${p.mentorName}`,
    statusLabel: "Follow up",
    statusTone: "info",
    personHref: `/people/${p.menteeId}`,
    adminHref: `/admin/mentorship/relationships/${p.id}`,
  }));

  const applicationRows: MentorshipApplicationRow[] = applications.map((app) => {
    const name = app.applicant.name ?? app.applicant.email;
    const underReview = app.status === "UNDER_REVIEW";
    return {
      id: app.id,
      applicantId: app.applicantId,
      name,
      programLabel: programLabelFromApplication(app),
      detailText: underReview
        ? "Interview scheduled — tracked on the meeting agenda."
        : "Application has not been reviewed — assign a committee reviewer.",
      statusLabel: underReview ? "Interview" : "Review",
      statusTone: underReview ? "brand" : "warning",
      meetingsHref: "/meetings",
      personHref: `/people/${app.applicantId}`,
    };
  });

  const queues: Record<MentorshipDashboardFilter, MentorshipQueueRow[]> = {
    "needs-review": needsReview,
    "needs-checkin": needsCheckIn,
    "missing-gr": missingGr,
    "active-pairs": activePairs,
    "follow-ups": followUps,
  };

  const counts = Object.fromEntries(
    MENTORSHIP_DASHBOARD_FILTERS.map((key) => [key, queues[key].length])
  ) as Record<MentorshipDashboardFilter, number>;

  return {
    counts,
    queues,
    applications: applicationRows,
    committees: buildCommitteeRows(chairs, mentorships, now),
  };
}
