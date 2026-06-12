import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchDocument: { count: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    partner: { findMany: vi.fn(), findUnique: vi.fn() },
    classOffering: { findMany: vi.fn(), findUnique: vi.fn() },
    officerMeeting: { findMany: vi.fn(), findUnique: vi.fn() },
    actionItem: { findMany: vi.fn(), findUnique: vi.fn() },
    instructorApplication: { findMany: vi.fn(), findUnique: vi.fn() },
    recentEntityView: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  isActionTrackerEnabled: vi.fn(() => true),
}));

import { prisma } from "@/lib/prisma";
import { runHelpAgentSearch } from "@/lib/help-agent/search";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";

const MEMBER: ActionViewer = {
  id: "u-member",
  roles: ["STUDENT"],
  primaryRole: "STUDENT",
  adminSubtypes: [],
};
const OFFICER: ActionViewer = {
  id: "u-officer",
  roles: ["ADMIN"],
  primaryRole: "ADMIN",
  adminSubtypes: [],
};

function mock(fn: unknown) {
  return fn as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: every live query returns nothing; the index is empty.
  for (const model of [
    prisma.user,
    prisma.partner,
    prisma.classOffering,
    prisma.officerMeeting,
    prisma.actionItem,
    prisma.instructorApplication,
    prisma.recentEntityView,
  ]) {
    mock((model as { findMany: unknown }).findMany).mockResolvedValue([]);
  }
  mock(prisma.searchDocument.count).mockResolvedValue(0);
  mock(prisma.searchDocument.findMany).mockResolvedValue([]);
});

describe("runHelpAgentSearch — permission tiers", () => {
  it("members get only the People group", async () => {
    mock(prisma.user.findMany).mockResolvedValue([
      { id: "p1", name: "Riley Stone", email: "riley@test.dev", primaryRole: "STUDENT" },
    ]);

    const res = await runHelpAgentSearch("riley", MEMBER);

    expect(res.groups.map((g) => g.type)).toEqual(["person"]);
    expect(res.groups[0].items[0]).toMatchObject({
      type: "person",
      id: "p1",
      title: "Riley Stone",
      subtitle: "Student",
      href: "/people/p1",
    });
    // No officer-tier queries ran.
    expect(prisma.partner.findMany).not.toHaveBeenCalled();
    expect(prisma.instructorApplication.findMany).not.toHaveBeenCalled();
  });

  it("officers get the officer-tier groups", async () => {
    mock(prisma.partner.findMany).mockResolvedValue([
      { id: "pa1", name: "Beth El", type: "School", contactName: null, contacts: [] },
    ]);

    const res = await runHelpAgentSearch("beth", OFFICER);

    const types = res.groups.map((g) => g.type);
    expect(types).toContain("partner");
    expect(prisma.partner.findMany).toHaveBeenCalled();
    expect(prisma.officerMeeting.findMany).toHaveBeenCalled();
  });

  it("short queries return no groups", async () => {
    const res = await runHelpAgentSearch("r", MEMBER);
    expect(res.groups).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe("runHelpAgentSearch — SearchDocument person cutover", () => {
  it("uses the index when person rows exist and maps role subtitles", async () => {
    mock(prisma.searchDocument.count).mockResolvedValue(42);
    mock(prisma.searchDocument.findMany).mockResolvedValue([
      { entityId: "p9", title: "Jordan Vale", subtitle: "INSTRUCTOR" },
    ]);

    const res = await runHelpAgentSearch("jordan", MEMBER);

    expect(res.groups[0].items[0]).toMatchObject({
      id: "p9",
      title: "Jordan Vale",
      subtitle: "Instructor",
      href: "/people/p9",
    });
    // The live person query is skipped when the index answers.
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    // Tier filtering applies at the query level.
    const where = mock(prisma.searchDocument.findMany).mock.calls[0][0].where;
    expect(where.entityType).toBe("person");
    expect(where.visibilityTier).toBe("MEMBER");
  });

  it("falls back to the live person query when the index is empty", async () => {
    mock(prisma.searchDocument.count).mockResolvedValue(0);
    mock(prisma.user.findMany).mockResolvedValue([
      { id: "p1", name: "Riley Stone", email: "riley@test.dev", primaryRole: "STUDENT" },
    ]);

    const res = await runHelpAgentSearch("riley", MEMBER);

    expect(prisma.searchDocument.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(res.groups[0].items[0].id).toBe("p1");
  });

  it("falls back when the index read throws (e.g. table missing)", async () => {
    mock(prisma.searchDocument.count).mockRejectedValue(new Error("relation missing"));
    mock(prisma.user.findMany).mockResolvedValue([
      { id: "p1", name: "Riley Stone", email: "riley@test.dev", primaryRole: "STUDENT" },
    ]);

    const res = await runHelpAgentSearch("riley", MEMBER);
    expect(res.groups[0].items[0].id).toBe("p1");
  });

  it("ranks prefix matches above substring matches", async () => {
    mock(prisma.searchDocument.count).mockResolvedValue(2);
    mock(prisma.searchDocument.findMany).mockResolvedValue([
      { entityId: "sub", title: "Aria Sam", subtitle: null },
      { entityId: "pre", title: "Sam Aria", subtitle: null },
    ]);

    const res = await runHelpAgentSearch("sam", MEMBER);
    expect(res.groups[0].items.map((i) => i.id)).toEqual(["pre", "sub"]);
  });
});

describe("runHelpAgentSearch — empty query recents", () => {
  it("returns recents (tier-filtered) and no groups", async () => {
    mock(prisma.recentEntityView.findMany).mockResolvedValue([
      { entityType: "person", entityId: "p1" },
      { entityType: "partner", entityId: "pa1" },
    ]);
    mock(prisma.user.findUnique).mockResolvedValue({
      id: "p1",
      name: "Riley Stone",
      email: "riley@test.dev",
      primaryRole: "STUDENT",
      archivedAt: null,
    });

    const res = await runHelpAgentSearch("", MEMBER);
    expect(res.groups).toEqual([]);
    // Member tier: the partner recent is filtered before hydration.
    expect(prisma.partner.findUnique).not.toHaveBeenCalled();
    expect(res.recents.map((r) => r.id)).toEqual(["p1"]);
  });
});
