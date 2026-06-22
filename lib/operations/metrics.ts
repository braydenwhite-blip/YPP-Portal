import type { OperationalDigestCounts } from "@/lib/people-strategy/operational-digest";

/**
 * Data 360 — executive snapshot metrics.
 *
 * One ordered strip of numbers a leader reads in five seconds: how much work
 * is in flight, what is on fire, and which parts of the org need a look. Pure
 * derivation over already-loaded counts; the query layer supplies the
 * cross-domain numbers the digest does not track (classes, applicants,
 * partners, mentorships, initiatives).
 */

export type MetricTone = "default" | "accent" | "danger" | "warning" | "success";

/** Thematic clusters the snapshot renders as labeled groups. */
export const METRIC_GROUPS = ["work", "meetings", "programs"] as const;
export type MetricGroup = (typeof METRIC_GROUPS)[number];

export const METRIC_GROUP_LABELS: Record<MetricGroup, string> = {
  work: "Work",
  meetings: "Meetings & decisions",
  programs: "Programs & people",
};

export type DataMetric = {
  key: string;
  label: string;
  value: number;
  tone: MetricTone;
  group: MetricGroup;
  href: string | null;
  /** One short line of context under the number. */
  hint: string | null;
};

export type OrgWideCounts = {
  activeClasses: number;
  activeInitiatives: number;
  initiativesAtRisk: number;
  applicantsInReview: number;
  applicantsStuck: number;
  activeMentorships: number;
  mentorshipsQuiet: number;
  partnersNeedingFollowUp: number;
};

/** Flag a count red/amber only when it is non-zero — zero is a win, not a warning. */
function toneWhenPresent(value: number, tone: MetricTone): MetricTone {
  return value > 0 ? tone : "default";
}

/**
 * The executive snapshot, in reading order: work, then meetings, then the
 * org-wide surfaces. Deterministic — same counts, same strip.
 */
export function buildExecutiveSnapshot(input: {
  counts: OperationalDigestCounts;
  org: OrgWideCounts;
}): DataMetric[] {
  const { counts, org } = input;
  return [
    {
      key: "open-actions",
      group: "work",
      label: "Open work items",
      value: counts.openActions + counts.unconvertedFollowUps,
      tone: "accent",
      href: "/actions/all",
      hint: counts.unconvertedFollowUps > 0
        ? `${counts.unconvertedFollowUps} from meetings, not yet tracked`
        : "Actions and meeting follow-ups",
    },
    {
      key: "overdue",
      group: "work",
      label: "Overdue",
      value: counts.overdueActions,
      tone: toneWhenPresent(counts.overdueActions, "danger"),
      href: "/actions/all?status=OVERDUE",
      hint: counts.overdueActions > 0 ? "Rescue or reschedule" : "Nothing past due",
    },
    {
      key: "due-week",
      group: "work",
      label: "Due this week",
      value: counts.dueSoonActions,
      tone: "default",
      href: "/actions/all?preset=due_soon",
      hint: null,
    },
    {
      key: "blocked",
      group: "work",
      label: "Blocked",
      value: counts.blockedActions,
      tone: toneWhenPresent(counts.blockedActions, "warning"),
      href: "/actions/all?status=BLOCKED",
      hint: counts.blockedActions > 0 ? "Someone needs to unblock these" : null,
    },
    {
      key: "meetings-week",
      group: "meetings",
      label: "Meetings this week",
      value: counts.meetingsThisWeek,
      tone: "default",
      href: "/meetings",
      hint: counts.decisionsNeedingAction > 0
        ? `${counts.decisionsNeedingAction} decision${counts.decisionsNeedingAction === 1 ? "" : "s"} need an action`
        : null,
    },
    {
      key: "initiatives",
      group: "programs",
      label: "Active initiatives",
      value: org.activeInitiatives,
      tone: toneWhenPresent(org.initiativesAtRisk, "warning"),
      href: "/operations/initiatives",
      hint: org.initiativesAtRisk > 0 ? `${org.initiativesAtRisk} at risk` : "All on track",
    },
    {
      key: "classes",
      group: "programs",
      label: "Active classes",
      value: org.activeClasses,
      tone: "default",
      href: "/people/classes",
      hint: null,
    },
    {
      key: "applicants",
      group: "programs",
      label: "Applicants in review",
      value: org.applicantsInReview,
      tone: toneWhenPresent(org.applicantsStuck, "warning"),
      href: "/admin/instructor-applicants",
      hint: org.applicantsStuck > 0 ? `${org.applicantsStuck} waiting too long` : null,
    },
    {
      key: "partners",
      group: "programs",
      label: "Partner follow-ups",
      value: org.partnersNeedingFollowUp,
      tone: toneWhenPresent(org.partnersNeedingFollowUp, "warning"),
      href: "/admin/partners",
      hint: org.partnersNeedingFollowUp > 0 ? "No next step or overdue" : "Pipeline is covered",
    },
    {
      key: "mentorships",
      group: "programs",
      label: "Active mentorships",
      value: org.activeMentorships,
      tone: toneWhenPresent(org.mentorshipsQuiet, "warning"),
      href: "/admin/mentorship",
      hint: org.mentorshipsQuiet > 0 ? `${org.mentorshipsQuiet} gone quiet` : null,
    },
  ];
}
