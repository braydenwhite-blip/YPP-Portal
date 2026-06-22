import { describe, expect, it } from "vitest";

import {
  derivePartnerNeedsAttention,
  type PartnerDetail,
} from "@/lib/partners-queries";

function partnerFixture(overrides: Partial<PartnerDetail> = {}): PartnerDetail {
  return {
    id: "partner1",
    name: "Lincoln HS",
    relationshipLeadId: "lead1",
    nextFollowUpAt: null,
    classOfferings: [],
    ...overrides,
  } as unknown as PartnerDetail;
}

function classFixture(
  overrides: Partial<PartnerDetail["classOfferings"][number]> = {}
): PartnerDetail["classOfferings"][number] {
  return {
    id: "class1",
    title: "Intro to Coding",
    status: "PUBLISHED",
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    endDate: new Date("2026-08-01T00:00:00.000Z"),
    meetingDays: ["Monday"],
    meetingTime: "16:00-17:00",
    timezone: "America/New_York",
    deliveryMode: "VIRTUAL",
    zoomLink: null,
    locationName: null,
    locationAddress: null,
    room: null,
    instructor: { id: "i1", name: "Instructor", email: "i@test.dev" },
    chapter: { id: "ch1", name: "Scarsdale" },
    approval: { status: "REQUESTED", reviewedAt: null, reviewNotes: null, reviewedBy: null },
    regularInstructorAssignments: [],
    _count: { sessions: 0, enrollments: 3 },
    ...overrides,
  } as PartnerDetail["classOfferings"][number];
}

describe("derivePartnerNeedsAttention", () => {
  it("flags missing owner and overdue follow-up", () => {
    const items = derivePartnerNeedsAttention(
      partnerFixture({
        relationshipLeadId: null,
        nextFollowUpAt: new Date("2026-06-01T12:00:00.000Z"),
      }),
      new Date("2026-06-19T12:00:00.000Z")
    );

    expect(items.map((item) => item.code)).toEqual([
      "NO_RELATIONSHIP_LEAD",
      "FOLLOW_UP_OVERDUE",
    ]);
  });

  it("flags class review, schedule, virtual link, and assignment gaps", () => {
    const items = derivePartnerNeedsAttention(
      partnerFixture({ classOfferings: [classFixture()] }),
      new Date("2026-06-19T12:00:00.000Z")
    );

    expect(items.map((item) => item.code)).toEqual([
      "CLASS_REVIEW_PENDING",
      "CLASS_MISSING_SESSIONS",
      "CLASS_MISSING_MEETING_LINK",
      "CLASS_ASSIGNMENT_GAP",
    ]);
  });
});
