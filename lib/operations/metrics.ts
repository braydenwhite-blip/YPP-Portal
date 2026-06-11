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

export type DataMetric = {
  key: string;
  label: string;
  value: number;
  tone: MetricTone;
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
      label: "Overdue",
      value: counts.overdueActions,
      tone: toneWhenPresent(counts.overdueActions, "danger"),
      href: "/actions/all?status=OVERDUE",
      hint: counts.overdueActions > 0 ? "Rescue or reschedule" : "Nothing past due",
    },
    {
      key: "due-week",
      label: "Due this week",
      value: counts.dueSoonActions,
      tone: "default",
      href: "/actions/all?preset=due_soon",
      hint: null,
    },
    {
      key: "blocked",
      label: "Blocked",
      value: counts.blockedActions,
      tone: toneWhenPresent(counts.blockedActions, "warning"),
      href: "/actions/all?status=BLOCKED",
      hint: counts.blockedActions > 0 ? "Someone needs to unblock these" : null,
    },
    {
      key: "meetings-week",
      label: "Meetings this week",
      value: counts.meetingsThisWeek,
      tone: "default",
      href: "/actions/meetings",
      hint: counts.decisionsNeedingAction > 0
        ? `${counts.decisionsNeedingAction} decision${counts.decisionsNeedingAction === 1 ? "" : "s"} need an action`
        : null,
    },
    {
      key: "initiatives",
      label: "Active initiatives",
      value: org.activeInitiatives,
      tone: toneWhenPresent(org.initiativesAtRisk, "warning"),
      href: "/operations/initiatives",
      hint: org.initiativesAtRisk > 0 ? `${org.initiativesAtRisk} at risk` : "All on track",
    },
    {
      key: "classes",
      label: "Active classes",
      value: org.activeClasses,
      tone: "default",
      href: "/admin/classes",
      hint: null,
    },
    {
      key: "applicants",
      label: "Applicants in review",
      value: org.applicantsInReview,
      tone: toneWhenPresent(org.applicantsStuck, "warning"),
      href: "/admin/instructor-applicants",
      hint: org.applicantsStuck > 0 ? `${org.applicantsStuck} waiting too long` : null,
    },
    {
      key: "partners",
      label: "Partner follow-ups",
      value: org.partnersNeedingFollowUp,
      tone: toneWhenPresent(org.partnersNeedingFollowUp, "warning"),
      href: "/admin/partners",
      hint: org.partnersNeedingFollowUp > 0 ? "No next step or overdue" : "Pipeline is covered",
    },
    {
      key: "mentorships",
      label: "Active mentorships",
      value: org.activeMentorships,
      tone: toneWhenPresent(org.mentorshipsQuiet, "warning"),
      href: "/admin/mentorship",
      hint: org.mentorshipsQuiet > 0 ? `${org.mentorshipsQuiet} gone quiet` : null,
    },
  ];
}
