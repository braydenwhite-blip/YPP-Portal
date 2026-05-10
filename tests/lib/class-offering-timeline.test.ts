import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  recordOfferingTimeline,
  getOfferingTimeline,
} from "@/lib/class-offering-timeline";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordOfferingTimeline", () => {
  it("inserts a timeline row with the actor, kind, and summary", async () => {
    vi.mocked(prisma.classOfferingTimelineEvent.create).mockResolvedValue(
      {} as any,
    );

    await recordOfferingTimeline({
      offeringId: "o1",
      actorId: "admin-1",
      kind: "PUBLISHED",
      summary: "Published.",
      payload: { previousStatus: "DRAFT" },
    });

    expect(prisma.classOfferingTimelineEvent.create).toHaveBeenCalledWith({
      data: {
        offeringId: "o1",
        actorId: "admin-1",
        kind: "PUBLISHED",
        summary: "Published.",
        payload: { previousStatus: "DRAFT" },
      },
    });
  });

  it("uses Prisma.DbNull when payload is missing so the JSON column writes SQL NULL", async () => {
    vi.mocked(prisma.classOfferingTimelineEvent.create).mockResolvedValue(
      {} as any,
    );

    await recordOfferingTimeline({
      offeringId: "o1",
      actorId: null,
      kind: "NOTE",
    });

    const args = vi.mocked(prisma.classOfferingTimelineEvent.create).mock
      .calls[0][0] as any;
    expect(args.data.payload).toBe(Prisma.DbNull);
    expect(args.data.summary).toBeNull();
  });

  it("swallows errors so journaling cannot block the underlying mutation", async () => {
    vi.mocked(prisma.classOfferingTimelineEvent.create).mockRejectedValue(
      new Error("db down"),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordOfferingTimeline({
        offeringId: "o1",
        actorId: "admin-1",
        kind: "PUBLISHED",
      }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("getOfferingTimeline", () => {
  it("returns most-recent events first, capped at the requested limit, with the actor join", async () => {
    vi.mocked(prisma.classOfferingTimelineEvent.findMany).mockResolvedValue(
      [] as any,
    );

    await getOfferingTimeline("o1", 25);

    const args = vi.mocked(prisma.classOfferingTimelineEvent.findMany).mock
      .calls[0][0] as any;
    expect(args.where).toEqual({ offeringId: "o1" });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.take).toBe(25);
    expect(args.include.actor.select).toMatchObject({
      id: true,
      name: true,
      email: true,
    });
  });
});
