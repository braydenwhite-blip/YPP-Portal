import { describe, expect, it, vi } from "vitest";

// The query module imports the Prisma client + feature flags at the top level;
// the mappers under test don't touch them, but mock them so importing the module
// never spins up a real client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  mapMeetingToCardDTO,
  mapMeetingToDetailDTO,
  mapMeetingToView,
  meetingDisplayTitle,
} from "@/lib/people-strategy/meetings-queries";

const NOW = new Date(2026, 5, 8, 15, 0, 0); // Mon Jun 8 2026, 3pm

function person(id: string, name: string | null, email: string | null = null) {
  return { id, name, email };
}

// A realistic OfficerMeeting payload matching MEETING_INCLUDE. Cast through
// `any` so the test fixture stays readable without restating the full Prisma type.
function payload(overrides: Record<string, unknown> = {}): any {
  return {
    id: "m1",
    date: new Date(2026, 5, 8, 18, 0, 0),
    endTime: new Date(2026, 5, 8, 19, 0, 0),
    status: "SCHEDULED",
    title: "Weekly Leadership Sync",
    purpose: "Review priorities and blockers.",
    category: "LEADERSHIP",
    priority: "HIGH",
    recurrence: "WEEKLY",
    location: "Zoom",
    notesText: "Strong week.",
    relatedEntityType: "CLASS_OFFERING",
    relatedEntityId: "cls1",
    facilitator: person("u1", "Brayden White"),
    attendees: [
      { user: person("u1", "Brayden White") },
      { user: person("u2", null, "ian@ypp.org") },
    ],
    agendaItems: [
      { id: "a1", title: "Overdue items", description: null, status: "DISCUSSED", notes: "done", owner: person("u2", "Ian D"), convertedActionId: null },
      { id: "a2", title: "Signups", description: null, status: "OPEN", notes: null, owner: null, convertedActionId: null },
    ],
    decisions: [
      { id: "d1", decision: "Weekly updates required.", rationale: "Visibility.", decidedBy: person("u1", "Brayden White"), createdAt: new Date(2026, 5, 8, 19), linkedActionId: "act1" },
    ],
    followUps: [
      { id: "f1", title: "Chapter escalation list", description: null, owner: person("u3", "Priya N"), dueDate: new Date(2026, 5, 5), status: "OPEN", priority: "HIGH", area: "CHAPTERS", linkedActionId: "act2" }, // overdue
      { id: "f2", title: "Instructor bios", description: null, owner: null, dueDate: new Date(2026, 5, 13), status: "OPEN", priority: "URGENT", area: "INSTRUCTORS", linkedActionId: null }, // open
      { id: "f3", title: "Done thing", description: null, owner: null, dueDate: new Date(2026, 5, 1), status: "COMPLETED", priority: "LOW", area: null, linkedActionId: null },
    ],
    actionItems: [
      { id: "act2", title: "Follow up chapters", lead: person("u3", "Priya N"), status: "IN_PROGRESS", priority: "HIGH", deadlineStart: new Date(2026, 5, 12), department: { id: "dep", name: "Chapters" } },
      { id: "actDone", title: "Closed", lead: null, status: "COMPLETE", priority: "LOW", deadlineStart: new Date(2026, 5, 1), department: null },
    ],
    ...overrides,
  };
}

describe("meetingDisplayTitle", () => {
  it("uses the title, else a fallback", () => {
    expect(meetingDisplayTitle({ title: "Sync", date: NOW })).toBe("Sync");
    expect(meetingDisplayTitle({ title: null, date: NOW })).toBe("Officer Meeting");
    expect(meetingDisplayTitle({ title: "   ", date: NOW })).toBe("Officer Meeting");
  });
});

describe("mapMeetingToView", () => {
  it("flattens to the selector view with computed counts", () => {
    const view = mapMeetingToView(payload());
    expect(view.storedStatus).toBe("SCHEDULED");
    expect(view.agendaCount).toBe(2);
    expect(view.agendaDoneCount).toBe(1); // one DISCUSSED, one OPEN
    expect(view.decisionCount).toBe(1);
    expect(view.openLinkedActionCount).toBe(1); // one IN_PROGRESS, one COMPLETE
    expect(view.followUps).toHaveLength(3);
  });
});

describe("mapMeetingToCardDTO", () => {
  it("serializes dates and computes follow-up + action counts", () => {
    const dto = mapMeetingToCardDTO(payload(), NOW);
    expect(dto.title).toBe("Weekly Leadership Sync");
    expect(dto.categoryLabel).toBe("Leadership");
    expect(dto.startISO).toBe(new Date(2026, 5, 8, 18).toISOString());
    expect(dto.durationLabel).toBe("60 min");
    expect(dto.effectiveStatus).toBe("today");
    expect(dto.attendeeCount).toBe(2);
    expect(dto.agendaDoneCount).toBe(1);
    expect(dto.openFollowUps).toBe(2); // f1, f2 (f3 completed)
    expect(dto.overdueFollowUps).toBe(1); // f1 past due
    expect(dto.openLinkedActions).toBe(1);
    expect(dto.linkedActionCount).toBe(2);
    expect(dto.facilitator?.initials).toBe("BW");
    // Cross-portal link surfaced on the DTO so a meeting can show its entity.
    expect(dto.relatedEntityType).toBe("CLASS_OFFERING");
    expect(dto.relatedEntityId).toBe("cls1");
  });

  it("leaves the related entity null when the meeting links to nothing", () => {
    const dto = mapMeetingToCardDTO(
      payload({ relatedEntityType: null, relatedEntityId: null }),
      NOW
    );
    expect(dto.relatedEntityType).toBeNull();
    expect(dto.relatedEntityId).toBeNull();
  });
});

describe("mapMeetingToDetailDTO", () => {
  it("maps every section and resolves names from email fallback", () => {
    const dto = mapMeetingToDetailDTO(payload(), NOW);
    expect(dto.attendees).toHaveLength(2);
    expect(dto.attendees[1].name).toBe("ian@ypp.org"); // null name → email
    expect(dto.agenda[0].owner?.name).toBe("Ian D");
    expect(dto.decisions[0].linkedActionId).toBe("act1");
    expect(dto.followUps[0].effectiveStatus).toBe("overdue");
    expect(dto.followUps[0].areaLabel).toBe("Chapters");
    expect(dto.followUps[1].effectiveStatus).toBe("open");
    expect(dto.linkedActions[0].departmentName).toBe("Chapters");
    expect(dto.notesText).toBe("Strong week.");
  });
});
