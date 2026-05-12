import { describe, expect, it } from "vitest";

import { buildWeeklyDigest } from "@/lib/leadership-action-center/digest";
import type { ActionItemWithRelations, MeetingWithCounts } from "@/lib/leadership-action-center/queries";

function buildItem(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  const base: ActionItemWithRelations = {
    id: overrides.id ?? "item-" + Math.random().toString(36).slice(2),
    title: overrides.title ?? "Sample task",
    description: null,
    category: overrides.category ?? "INSTRUCTION",
    status: overrides.status ?? "NOT_STARTED",
    priority: "NORMAL",
    source: "MANUAL",
    sourceLabel: null,
    sourceNotes: null,
    dueDate: overrides.dueDate ?? null,
    weekStart: null,
    needsOfficerDiscussion: overrides.needsOfficerDiscussion ?? false,
    officerDiscussionDate: overrides.officerDiscussionDate ?? null,
    meetingId: null,
    primaryOwnerId: null,
    ownerNames: overrides.ownerNames ?? [],
    inputNeededNames: overrides.inputNeededNames ?? [],
    notes: overrides.notes ?? null,
    completedAt: null,
    createdById: null,
    updatedById: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    primaryOwner: overrides.primaryOwner ?? null,
    meeting: overrides.meeting ?? null,
    inputNeededFrom: overrides.inputNeededFrom ?? [],
    _count: { updates: 0 },
  };
  return { ...base, ...overrides };
}

describe("buildWeeklyDigest", () => {
  const weekStart = new Date(2026, 4, 11); // Mon May 11
  const weekEnd = new Date(2026, 4, 17, 23, 59); // Sun May 17
  const generatedAt = new Date(2026, 4, 13, 10, 0); // Wed

  it("groups tasks by date and renders a color key in the text output", () => {
    const items: ActionItemWithRelations[] = [
      buildItem({
        title: "Email summer camps",
        category: "COMMUNICATION",
        dueDate: new Date(2026, 4, 15),
        ownerNames: ["Brayden"],
      }),
      buildItem({
        title: "Find Scarsdale apps",
        category: "INSTRUCTION",
        dueDate: new Date(2026, 4, 16),
        needsOfficerDiscussion: true,
        ownerNames: ["Anthea"],
      }),
      buildItem({
        title: "Backlog item",
        category: "STAFF_MANAGEMENT",
        dueDate: null,
      }),
    ];
    const meetings: MeetingWithCounts[] = [];

    const digest = buildWeeklyDigest({
      weekStart,
      weekEnd,
      generatedAt,
      actionItems: items,
      meetings,
    });

    expect(digest.text).toContain("Pink = Core Instruction");
    expect(digest.text).toContain("Email summer camps");
    expect(digest.sections.length).toBeGreaterThanOrEqual(2);

    const allDaysSection = digest.sections.find((s) => s.heading.startsWith("All days"));
    expect(allDaysSection?.items[0].title).toBe("Backlog item");
  });

  it("flags off-track and officer-discussion items", () => {
    const items: ActionItemWithRelations[] = [
      buildItem({
        title: "Stuck task",
        status: "BLOCKED",
        dueDate: new Date(2026, 4, 12),
      }),
      buildItem({
        title: "Decision item",
        needsOfficerDiscussion: true,
        dueDate: new Date(2026, 4, 14),
      }),
    ];

    const digest = buildWeeklyDigest({
      weekStart,
      weekEnd,
      generatedAt,
      actionItems: items,
      meetings: [],
    });

    expect(digest.offTrack.map((i) => i.title)).toContain("Stuck task");
    expect(digest.officerDiscussion.map((i) => i.title)).toContain("Decision item");
  });

  it("includes meetings with the kind label", () => {
    const meeting: MeetingWithCounts = {
      id: "m1",
      title: "Officers",
      kind: "OFFICERS",
      scheduledAt: new Date(2026, 4, 13, 18, 0),
      notes: null,
      ownerId: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: null,
      _count: { actionItems: 2 },
    };
    const digest = buildWeeklyDigest({
      weekStart,
      weekEnd,
      generatedAt,
      actionItems: [],
      meetings: [meeting],
    });
    expect(digest.text).toContain("Officers");
    expect(digest.text).toContain("Key meetings this week");
    expect(digest.html).toContain("Officers");
  });
});
