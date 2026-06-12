import { describe, expect, it } from "vitest";

import type { WorkItem } from "@/lib/operations/work-items";
import type { MeetingLite } from "@/lib/people-strategy/operational-digest";
import {
  asWorkHubEntityFilter,
  asWorkHubFlag,
  filterWorkHubRowsByEntity,
  filterWorkHubRowsByFlag,
  rowIsDueSoon,
  searchWorkHubRows,
  sortWorkHubRows,
  workHubRowFromAdvisorCheckIn,
  workHubRowFromApplication,
  workHubRowFromMeeting,
  workHubRowFromPartnerFollowUp,
  workHubRowFromPartnerRequest,
  workHubRowFromQuietMentorship,
  workHubRowFromWorkItem,
  type WorkHubRow,
} from "@/lib/work/work-hub-rows";

const NOW = new Date("2026-06-12T12:00:00.000Z");

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "action:a1",
    kind: "action",
    title: "Call the venue",
    status: "Due Jun 18",
    tone: "neutral",
    ownerName: "Jordan",
    dueISO: "2026-06-18T00:00:00.000Z",
    priority: "MEDIUM",
    sourceLabel: "Action",
    meetingTitle: null,
    relatedType: null,
    relatedId: null,
    relatedLabel: null,
    nextStep: null,
    overdue: false,
    blocked: false,
    unassigned: false,
    completedISO: null,
    href: "/actions/a1",
    convertHref: null,
    ...overrides,
  };
}

describe("workHubRowFromWorkItem", () => {
  it("folds a tracker action with its related entity chip", () => {
    const row = workHubRowFromWorkItem(
      workItem({
        relatedType: "PARTNER",
        relatedId: "p1",
        relatedLabel: "Beth El",
      }),
      { mine: true }
    );
    expect(row.kind).toBe("action");
    expect(row.kindLabel).toBe("Action");
    expect(row.entityType).toBe("partner");
    expect(row.entityId).toBe("p1");
    expect(row.entityLabel).toBe("Beth El");
    expect(row.mine).toBe(true);
    expect(row.previewType).toBe("action");
    expect(row.previewId).toBe("a1");
  });

  it("shows honest meeting provenance and a convert quick action on follow-ups", () => {
    const row = workHubRowFromWorkItem(
      workItem({
        id: "follow_up:f1",
        kind: "follow_up",
        meetingTitle: "Leadership sync",
        href: "/actions/meetings/m1",
        convertHref: "title=Do+it",
      })
    );
    expect(row.kindLabel).toBe("Meeting follow-up");
    expect(row.sourceLabel).toBe("From meeting: Leadership sync");
    expect(row.quickActionLabel).toBe("Convert to action");
    expect(row.quickActionHref).toBe("/actions/new?title=Do+it");
    expect(row.previewType).toBe("meeting");
    expect(row.previewId).toBe("m1");
  });
});

describe("workHubRowFromMeeting", () => {
  function meeting(overrides: Partial<MeetingLite> = {}): MeetingLite {
    return {
      id: "m1",
      title: "Leadership sync",
      startISO: "2026-06-15T17:00:00.000Z",
      category: null,
      categoryLabel: "Leadership",
      effectiveStatus: "scheduled" as MeetingLite["effectiveStatus"],
      openFollowUps: 0,
      overdueFollowUps: 0,
      decisionCount: 0,
      linkedActionCount: 0,
      facilitatorName: "Sam",
      attendeeCount: 4,
      recurrence: null,
      relatedType: null,
      relatedId: null,
      relatedLabel: null,
      href: "/actions/meetings/m1",
      ...overrides,
    } as MeetingLite;
  }

  it("shows upcoming meetings with their start date", () => {
    const row = workHubRowFromMeeting(meeting(), NOW);
    expect(row).not.toBeNull();
    expect(row?.status).toContain("Starts");
    expect(row?.tone).toBe("info");
  });

  it("keeps past meetings only while follow-ups are open", () => {
    const past = meeting({ startISO: "2026-06-01T17:00:00.000Z" });
    expect(workHubRowFromMeeting(past, NOW)).toBeNull();
    const withDebt = workHubRowFromMeeting(
      meeting({
        startISO: "2026-06-01T17:00:00.000Z",
        openFollowUps: 2,
        overdueFollowUps: 1,
      }),
      NOW
    );
    expect(withDebt?.status).toBe("1 follow-up overdue");
    expect(withDebt?.tone).toBe("danger");
    expect(withDebt?.overdue).toBe(true);
  });
});

describe("partner / advisor / application / mentorship rows", () => {
  it("marks an overdue partner request and chips its partner", () => {
    const row = workHubRowFromPartnerRequest(
      {
        id: "r1",
        title: "Send updated MOU",
        status: "OPEN",
        dueISO: "2026-06-10T00:00:00.000Z",
        ownerName: null,
        partnerId: "p1",
        partnerName: "Beth El",
      },
      NOW
    );
    expect(row.status).toBe("Overdue 2d");
    expect(row.tone).toBe("danger");
    expect(row.unassigned).toBe(true);
    expect(row.entityType).toBe("partner");
    expect(row.previewType).toBe("partner");
    expect(row.quickActionLabel).toBe("View partner work");
    expect(row.href).toBe("/work?entity=partner:p1");
  });

  it("keeps admin partner quick links for admins", () => {
    const row = workHubRowFromPartnerRequest(
      {
        id: "r1",
        title: "Send updated MOU",
        status: "OPEN",
        dueISO: null,
        ownerName: "Sam",
        partnerId: "p1",
        partnerName: "Beth El",
      },
      NOW,
      { canOpenAdminRecord: true }
    );
    expect(row.quickActionLabel).toBe("Open partner");
    expect(row.href).toBe("/admin/partners/p1#relationship-ops");
  });

  it("derives partner follow-up days overdue", () => {
    const row = workHubRowFromPartnerFollowUp(
      { id: "p1", name: "Beth El", nextFollowUpISO: "2026-06-05T00:00:00.000Z", leadName: "Sam" },
      NOW
    );
    expect(row.title).toBe("Follow up with Beth El");
    expect(row.status).toBe("Overdue 7d");
    expect(row.overdue).toBe(true);
    expect(row.quickActionHref).toBe("/work?entity=partner:p1");
  });

  it("routes advisor check-ins to the advising workspace", () => {
    const row = workHubRowFromAdvisorCheckIn(
      {
        assignmentId: "as1",
        studentId: "s1",
        studentName: "Riley",
        advisorName: "Casey",
        nextCheckInISO: "2026-06-09T00:00:00.000Z",
      },
      NOW,
      { mine: true }
    );
    expect(row.quickActionLabel).toBe("Log check-in");
    expect(row.href).toBe("/my-advisees/as1");
    expect(row.entityType).toBe("person");
    expect(row.mine).toBe(true);
  });

  it("maps application statuses to concrete next steps and skips applicant-side waits", () => {
    const chair = workHubRowFromApplication({
      id: "app1",
      displayName: "Alex Kim",
      status: "CHAIR_REVIEW",
      reviewerName: "Jess",
      updatedISO: "2026-06-10T00:00:00.000Z",
    });
    expect(chair?.status).toBe("Decision needed");
    expect(chair?.tone).toBe("danger");
    expect(chair?.href).toBe("/admin/instructor-applicants/app1");
    expect(chair?.previewType).toBe("applicant");

    const waiting = workHubRowFromApplication({
      id: "app2",
      displayName: "Sam Lee",
      status: "INFO_REQUESTED",
      reviewerName: null,
      updatedISO: "2026-06-10T00:00:00.000Z",
    });
    expect(waiting).toBeNull();
  });

  it("labels quiet mentorships with the explicit day count", () => {
    const row = workHubRowFromQuietMentorship({
      id: "mt1",
      mentorName: "Drew",
      menteeName: "Pat",
      menteeId: "u9",
      quietDays: 45,
    });
    expect(row.status).toBe("Quiet 45 days");
    expect(row.previewType).toBe("mentorship");
    expect(row.quickActionHref).toBe("/work?entity=mentorship:mt1");
  });
});

describe("sorting / filtering / search", () => {
  const rows: WorkHubRow[] = [
    workHubRowFromWorkItem(workItem({ id: "action:calm", title: "Calm future task", dueISO: "2026-08-01T00:00:00.000Z" })),
    workHubRowFromWorkItem(
      workItem({
        id: "action:late",
        title: "Late task",
        status: "Overdue 3d",
        tone: "danger",
        overdue: true,
        dueISO: "2026-06-09T00:00:00.000Z",
      })
    ),
    workHubRowFromWorkItem(
      workItem({
        id: "action:stuck",
        title: "Stuck task",
        status: "Blocked",
        tone: "warning",
        blocked: true,
        ownerName: null,
        unassigned: true,
        dueISO: "2026-07-01T00:00:00.000Z",
      })
    ),
    workHubRowFromWorkItem(
      workItem({ id: "action:soon", title: "Soon task", dueISO: "2026-06-15T00:00:00.000Z" })
    ),
  ];

  it("sorts overdue → blocked → severity, deterministically", () => {
    const sorted = sortWorkHubRows(rows);
    expect(sorted.map((r) => r.id)).toEqual([
      "action:late",
      "action:stuck",
      "action:soon",
      "action:calm",
    ]);
  });

  it("filters by every stat-card flag", () => {
    expect(filterWorkHubRowsByFlag(rows, "overdue", NOW).map((r) => r.id)).toEqual([
      "action:late",
    ]);
    expect(filterWorkHubRowsByFlag(rows, "blocked", NOW).map((r) => r.id)).toEqual([
      "action:stuck",
    ]);
    expect(filterWorkHubRowsByFlag(rows, "unowned", NOW).map((r) => r.id)).toEqual([
      "action:stuck",
    ]);
    expect(filterWorkHubRowsByFlag(rows, "due-soon", NOW).map((r) => r.id)).toEqual([
      "action:soon",
    ]);
  });

  it("treats overdue rows as not due-soon", () => {
    const late = rows.find((r) => r.id === "action:late") as WorkHubRow;
    expect(rowIsDueSoon(late, NOW)).toBe(false);
  });

  it("parses and applies the entity filter", () => {
    expect(asWorkHubEntityFilter("partner:p1")).toEqual({ type: "partner", id: "p1" });
    expect(asWorkHubEntityFilter("bogus:p1")).toBeNull();
    expect(asWorkHubEntityFilter("partner:")).toBeNull();
    expect(asWorkHubEntityFilter(undefined)).toBeNull();

    const tagged = [
      workHubRowFromWorkItem(
        workItem({ id: "action:linked", relatedType: "PARTNER", relatedId: "p1", relatedLabel: "Beth El" })
      ),
      workHubRowFromWorkItem(workItem({ id: "action:other" })),
    ];
    const filtered = filterWorkHubRowsByEntity(tagged, { type: "partner", id: "p1" });
    expect(filtered.map((r) => r.id)).toEqual(["action:linked"]);
    // previewType match: an action row IS the action entity
    const byPreview = filterWorkHubRowsByEntity(tagged, { type: "action", id: "other" });
    expect(byPreview.map((r) => r.id)).toEqual(["action:other"]);
  });

  it("validates flags and searches across title/owner/entity", () => {
    expect(asWorkHubFlag("overdue")).toBe("overdue");
    expect(asWorkHubFlag("bogus")).toBeNull();
    expect(searchWorkHubRows(rows, "stuck").map((r) => r.id)).toEqual(["action:stuck"]);
    expect(searchWorkHubRows(rows, "jordan").length).toBe(3);
  });
});
