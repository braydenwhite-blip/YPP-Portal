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

vi.mock("@/lib/applications/application-visibility", () => ({
  instructorApplicationVisibilityWhere: vi.fn(() => Promise.resolve({})),
}));

import { prisma } from "@/lib/prisma";
import { instructorApplicationVisibilityWhere } from "@/lib/applications/application-visibility";
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
const CHAPTER_OFFICER: ActionViewer = {
  id: "u-chapter-officer",
  roles: ["CHAPTER_PRESIDENT"],
  primaryRole: "CHAPTER_PRESIDENT",
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
  mock(instructorApplicationVisibilityWhere).mockResolvedValue({});
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

  it("non-admin officers get preview-safe partner and class results without admin-page fallbacks", async () => {
    mock(prisma.partner.findMany).mockResolvedValue([
      { id: "pa1", name: "Beth El", type: "School", contactName: null, contacts: [] },
    ]);
    mock(prisma.classOffering.findMany).mockResolvedValue([
      {
        id: "class-1",
        title: "Beth El Entrepreneurship",
        semester: "Spring 2026",
        status: "PUBLISHED",
        template: null,
      },
    ]);

    const res = await runHelpAgentSearch("beth", CHAPTER_OFFICER);

    expect(res.groups.find((g) => g.type === "partner")?.items[0]).toMatchObject({
      id: "pa1",
      href: null,
    });
    expect(res.groups.find((g) => g.type === "class")?.items[0]).toMatchObject({
      id: "class-1",
      href: null,
    });
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
    const countWhere = mock(prisma.searchDocument.count).mock.calls[0][0].where;
    expect(countWhere).toMatchObject({ entityType: "person", visibilityTier: "MEMBER" });
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

  it("falls back to the live person query when an existing index has no hits", async () => {
    mock(prisma.searchDocument.count).mockResolvedValue(4);
    mock(prisma.searchDocument.findMany).mockResolvedValue([]);
    mock(prisma.user.findMany).mockResolvedValue([
      { id: "p3", name: "Maya Chen", email: "maya@test.dev", primaryRole: "INSTRUCTOR" },
    ]);

    const res = await runHelpAgentSearch("maya", MEMBER);

    expect(prisma.searchDocument.findMany).toHaveBeenCalled();
    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(res.groups[0].items[0]).toMatchObject({
      id: "p3",
      title: "Maya Chen",
      subtitle: "Instructor",
    });
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

type CountArgs = { where: { entityType?: string } };

/** Point the shared searchDocument mocks at one populated index group. */
function populateIndexGroup(
  entityType: string,
  docs: Array<{ entityId: string; title: string; subtitle: string | null }>
) {
  mock(prisma.searchDocument.count).mockImplementation((args: CountArgs) =>
    Promise.resolve(args.where.entityType === entityType ? docs.length : 0)
  );
  mock(prisma.searchDocument.findMany).mockImplementation((args: CountArgs) =>
    Promise.resolve(args.where.entityType === entityType ? docs : [])
  );
}

describe("runHelpAgentSearch — SearchDocument partner cutover", () => {
  it("uses the partner index when populated; admin hrefs only for admins", async () => {
    populateIndexGroup("partner", [
      { entityId: "pa9", title: "Beth El", subtitle: "School" },
    ]);

    const res = await runHelpAgentSearch("beth", OFFICER);

    expect(res.groups.find((g) => g.type === "partner")?.items[0]).toMatchObject({
      type: "partner",
      id: "pa9",
      title: "Beth El",
      subtitle: "School",
      href: "/admin/partners/pa9",
    });
    // The live partner query is skipped when the index answers.
    expect(prisma.partner.findMany).not.toHaveBeenCalled();
  });

  it("keeps partner hrefs preview-safe (null) for non-admin officers on the index path", async () => {
    populateIndexGroup("partner", [
      { entityId: "pa9", title: "Beth El", subtitle: "School" },
    ]);

    const res = await runHelpAgentSearch("beth", CHAPTER_OFFICER);

    expect(res.groups.find((g) => g.type === "partner")?.items[0]).toMatchObject({
      id: "pa9",
      href: null,
    });
  });

  it("falls back to the live partner query when the partner index is empty", async () => {
    mock(prisma.partner.findMany).mockResolvedValue([
      { id: "pa1", name: "Beth El", type: "School", contactName: null, contacts: [] },
    ]);

    const res = await runHelpAgentSearch("beth", OFFICER);

    expect(prisma.partner.findMany).toHaveBeenCalled();
    expect(res.groups.find((g) => g.type === "partner")?.items[0].id).toBe("pa1");
  });
});

describe("runHelpAgentSearch — SearchDocument applicant cutover", () => {
  it("uses the applicant index and re-checks every hit against the live visibility filter", async () => {
    populateIndexGroup("applicant", [
      { entityId: "a-visible", title: "Sam Vale", subtitle: "UNDER_REVIEW" },
      { entityId: "a-hidden", title: "Sam Stone", subtitle: "SUBMITTED" },
    ]);
    // The visibility re-check keeps only the row the viewer may see.
    mock(prisma.instructorApplication.findMany).mockResolvedValue([{ id: "a-visible" }]);

    const res = await runHelpAgentSearch("sam", OFFICER);

    const applicantGroup = res.groups.find((g) => g.type === "applicant");
    expect(applicantGroup?.items).toHaveLength(1);
    expect(applicantGroup?.items[0]).toMatchObject({
      id: "a-visible",
      title: "Sam Vale",
      subtitle: "Under review",
      href: "/admin/instructor-applicants/a-visible",
    });
    // The re-check queried exactly the index hits, with the visibility filter.
    const where = mock(prisma.instructorApplication.findMany).mock.calls[0][0].where;
    expect(where.AND[0].id.in).toEqual(["a-visible", "a-hidden"]);
    expect(where.AND[1]).toEqual({ archivedAt: null });
  });

  it("falls back to the live application query when the applicant index is empty", async () => {
    mock(prisma.instructorApplication.findMany).mockResolvedValue([
      {
        id: "a1",
        status: "UNDER_REVIEW",
        preferredFirstName: "Sam",
        lastName: "Vale",
        legalName: null,
        applicant: { name: "Sam Vale", email: "sam@test.dev" },
      },
    ]);

    const res = await runHelpAgentSearch("sam", OFFICER);

    expect(res.groups.find((g) => g.type === "applicant")?.items[0]).toMatchObject({
      id: "a1",
      title: "Sam Vale",
      subtitle: "Under review",
    });
  });
});

describe("runHelpAgentSearch — SearchDocument action cutover", () => {
  it("uses the action index (officer tier) with its owner/status/due subtitle", async () => {
    populateIndexGroup("action", [
      {
        entityId: "ac1",
        title: "Call the venue",
        subtitle: "In progress · Maya Chen · Due Jun 18, 2026",
      },
    ]);

    const res = await runHelpAgentSearch("venue", OFFICER);

    expect(res.groups.find((g) => g.type === "action")?.items[0]).toMatchObject({
      type: "action",
      id: "ac1",
      title: "Call the venue",
      subtitle: "In progress · Maya Chen · Due Jun 18, 2026",
      href: "/actions/ac1",
    });
    // The live action query is skipped when the index answers.
    expect(prisma.actionItem.findMany).not.toHaveBeenCalled();
    // The group is queried at the OFFICER tier.
    const countCalls = mock(prisma.searchDocument.count).mock.calls as Array<
      [{ where: { entityType?: string; visibilityTier?: string } }]
    >;
    const actionCount = countCalls.find(([args]) => args.where.entityType === "action");
    expect(actionCount?.[0].where.visibilityTier).toBe("OFFICER");
  });

  it("falls back to the live action query when the action index is empty", async () => {
    mock(prisma.actionItem.findMany).mockResolvedValue([
      { id: "ac2", title: "Call the venue", status: "IN_PROGRESS" },
    ]);

    const res = await runHelpAgentSearch("venue", OFFICER);

    expect(prisma.actionItem.findMany).toHaveBeenCalled();
    expect(res.groups.find((g) => g.type === "action")?.items[0]).toMatchObject({
      id: "ac2",
      title: "Call the venue",
      subtitle: "in progress",
      href: "/actions/ac2",
    });
  });

  it("members never get the action group, even with a populated index", async () => {
    populateIndexGroup("action", [
      { entityId: "ac1", title: "Call the venue", subtitle: null },
    ]);

    const res = await runHelpAgentSearch("venue", MEMBER);
    expect(res.groups.map((g) => g.type)).not.toContain("action");
  });
});

describe("runHelpAgentSearch — application visibility", () => {
  it("does not query applications when the viewer cannot resolve an application visibility filter", async () => {
    mock(instructorApplicationVisibilityWhere).mockResolvedValue(null);

    const res = await runHelpAgentSearch("riley", OFFICER);

    expect(prisma.instructorApplication.findMany).not.toHaveBeenCalled();
    expect(res.groups.map((g) => g.type)).not.toContain("applicant");
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
