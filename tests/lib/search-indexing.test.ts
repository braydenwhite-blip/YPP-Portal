import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchDocument: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    partner: { findFirst: vi.fn(), findMany: vi.fn() },
    instructorApplication: { findFirst: vi.fn(), findMany: vi.fn() },
    actionItem: { findUnique: vi.fn(), findMany: vi.fn() },
    classOffering: { findMany: vi.fn() },
    officerMeeting: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  buildApplicationDocument,
  buildPartnerDocument,
  buildPersonDocument,
  reconcileSearchDocuments,
  syncApplicationSearchDocument,
  syncPartnerSearchDocument,
  syncPersonSearchDocument,
} from "@/lib/help-agent/search-indexing";

function mock(fn: unknown) {
  return fn as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of [
    prisma.user,
    prisma.partner,
    prisma.instructorApplication,
    prisma.actionItem,
    prisma.classOffering,
    prisma.officerMeeting,
  ]) {
    const m = model as { findMany?: unknown };
    if (m.findMany) mock(m.findMany).mockResolvedValue([]);
  }
  mock(prisma.searchDocument.findMany).mockResolvedValue([]);
  mock(prisma.searchDocument.upsert).mockResolvedValue({});
  mock(prisma.searchDocument.deleteMany).mockResolvedValue({ count: 0 });
});

describe("document builders", () => {
  it("builds a MEMBER person row with email keywords", () => {
    expect(
      buildPersonDocument({
        id: "u1",
        name: "Riley Stone",
        email: "riley@test.dev",
        primaryRole: "STUDENT",
      })
    ).toEqual({
      entityType: "person",
      entityId: "u1",
      title: "Riley Stone",
      subtitle: "STUDENT",
      keywords: "riley@test.dev",
      visibilityTier: "MEMBER",
    });
  });

  it("indexes partner contacts and the relationship lead as keywords", () => {
    const doc = buildPartnerDocument({
      id: "pa1",
      name: "Beth El",
      type: "School",
      partnerType: "SCHOOL",
      contactName: "Dana Klein",
      relationshipLead: { name: "Ari Gold" },
      contacts: [{ name: "Noa Levy", email: "noa@bethel.org" }],
    });
    expect(doc.title).toBe("Beth El");
    expect(doc.subtitle).toBe("School");
    expect(doc.visibilityTier).toBe("OFFICER");
    for (const term of ["SCHOOL", "Dana Klein", "Ari Gold", "Noa Levy", "noa@bethel.org"]) {
      expect(doc.keywords).toContain(term);
    }
  });

  it("composes the applicant title the way the live query does", () => {
    expect(
      buildApplicationDocument({
        id: "a1",
        status: "UNDER_REVIEW",
        preferredFirstName: "Sam",
        lastName: "Vale",
        legalName: "Samuel Vale",
        applicant: { name: "S. Vale", email: "sam@test.dev" },
      })
    ).toMatchObject({
      entityType: "applicant",
      entityId: "a1",
      title: "Sam Vale",
      subtitle: "UNDER_REVIEW",
      visibilityTier: "OFFICER",
    });
    expect(
      buildApplicationDocument({
        id: "a2",
        status: "SUBMITTED",
        preferredFirstName: null,
        lastName: null,
        legalName: null,
        applicant: { name: null, email: "fallback@test.dev" },
      }).title
    ).toBe("fallback@test.dev");
  });
});

describe("write-path sync helpers", () => {
  it("upserts the person row when the user qualifies", async () => {
    mock(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      name: "Riley Stone",
      email: "riley@test.dev",
      primaryRole: "STUDENT",
    });

    await syncPersonSearchDocument("u1");

    expect(prisma.searchDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType_entityId: { entityType: "person", entityId: "u1" } },
        create: expect.objectContaining({ title: "Riley Stone" }),
      })
    );
    expect(prisma.searchDocument.deleteMany).not.toHaveBeenCalled();
  });

  it("removes the person row when the user no longer qualifies (archived)", async () => {
    mock(prisma.user.findFirst).mockResolvedValue(null);

    await syncPersonSearchDocument("u-gone");

    expect(prisma.searchDocument.upsert).not.toHaveBeenCalled();
    expect(prisma.searchDocument.deleteMany).toHaveBeenCalledWith({
      where: { entityType: "person", entityId: "u-gone" },
    });
  });

  it("removes the partner row when the partner is archived", async () => {
    mock(prisma.partner.findFirst).mockResolvedValue(null);

    await syncPartnerSearchDocument("pa-archived");

    expect(prisma.searchDocument.deleteMany).toHaveBeenCalledWith({
      where: { entityType: "partner", entityId: "pa-archived" },
    });
  });

  it("removes the applicant row when the application is archived", async () => {
    mock(prisma.instructorApplication.findFirst).mockResolvedValue(null);

    await syncApplicationSearchDocument("a-archived");

    expect(prisma.searchDocument.deleteMany).toHaveBeenCalledWith({
      where: { entityType: "applicant", entityId: "a-archived" },
    });
  });

  it("never throws when indexing fails — logs and lets the mutation continue", async () => {
    mock(prisma.partner.findFirst).mockRejectedValue(new Error("db down"));

    await expect(syncPartnerSearchDocument("pa1")).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe("reconcileSearchDocuments", () => {
  it("upserts every qualifying entity, reports counts by type, and removes stale rows", async () => {
    mock(prisma.user.findMany).mockResolvedValue([
      { id: "u1", name: "Riley", email: "r@test.dev", primaryRole: "STUDENT" },
    ]);
    mock(prisma.partner.findMany).mockResolvedValue([
      {
        id: "pa1",
        name: "Beth El",
        type: "School",
        partnerType: null,
        contactName: null,
        relationshipLead: null,
        contacts: [],
      },
    ]);
    mock(prisma.instructorApplication.findMany).mockResolvedValue([
      {
        id: "a1",
        status: "SUBMITTED",
        preferredFirstName: "Sam",
        lastName: "Vale",
        legalName: null,
        applicant: { name: null, email: "sam@test.dev" },
      },
    ]);
    mock(prisma.actionItem.findMany).mockResolvedValue([
      { id: "ac1", title: "Call the venue", status: "NOT_STARTED" },
    ]);
    // One index row whose source entity is gone → stale.
    mock(prisma.searchDocument.findMany).mockResolvedValue([
      { id: "doc-stale", entityType: "person", entityId: "u-gone" },
    ]);

    const report = await reconcileSearchDocuments();

    expect(report.upsertedByType).toEqual({
      person: 1,
      partner: 1,
      applicant: 1,
      action: 1,
    });
    expect(report.total).toBe(4);
    expect(report.staleRemoved).toBe(1);
    expect(prisma.searchDocument.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["doc-stale"] } },
    });
  });

  it("is idempotent — a second run upserts the same rows and removes nothing", async () => {
    mock(prisma.user.findMany).mockResolvedValue([
      { id: "u1", name: "Riley", email: "r@test.dev", primaryRole: "STUDENT" },
    ]);
    mock(prisma.searchDocument.findMany).mockResolvedValue([
      { id: "doc-u1", entityType: "person", entityId: "u1" },
    ]);

    const report = await reconcileSearchDocuments();

    expect(report.staleRemoved).toBe(0);
    expect(prisma.searchDocument.deleteMany).not.toHaveBeenCalled();
  });
});
