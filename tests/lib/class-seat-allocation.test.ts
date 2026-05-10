import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  takeSeatRaceSafe,
  dropAndPromoteRaceSafe,
  promoteNextWaitlistedRaceSafe,
} from "@/lib/class-seat-allocation";

// Default $transaction implementation: invoke the callback against the
// shared prisma mock. Re-assigned in beforeEach so that tests which
// override it via `mockRejectedValue` don't leak into the next test.
const defaultTxImpl = async (arg: unknown) => {
  if (typeof arg === "function") {
    return (arg as (tx: unknown) => Promise<unknown>)(prisma);
  }
  if (Array.isArray(arg)) {
    return Promise.all(arg);
  }
  return arg;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(defaultTxImpl as any);
});

describe("isolation level + retry", () => {
  it("requests Serializable isolation on every transaction", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue(null);

    await promoteNextWaitlistedRaceSafe({ offeringId: "o1" });

    const txCall = vi.mocked(prisma.$transaction).mock.calls[0];
    expect(txCall[1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("retries up to 3 times on P2034 (serialization failure)", async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError(
      "could not serialize access",
      { code: "P2034", clientVersion: "5.x" } as any,
    );
    const txMock = vi.mocked(prisma.$transaction);

    // Override $transaction so it rejects with P2034 twice, succeeds the third time.
    txMock
      .mockRejectedValueOnce(p2034)
      .mockRejectedValueOnce(p2034)
      .mockImplementationOnce(async (arg: unknown) => {
        if (typeof arg === "function") {
          return (arg as (tx: unknown) => Promise<unknown>)(prisma);
        }
        return arg;
      });

    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue(null);

    const result = await promoteNextWaitlistedRaceSafe({ offeringId: "o1" });
    expect(result).toEqual({ promoted: false, enrollmentId: null });
    expect(txMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces the error after 3 failed retries", async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError(
      "could not serialize access",
      { code: "P2034", clientVersion: "5.x" } as any,
    );
    vi.mocked(prisma.$transaction).mockRejectedValue(p2034);

    await expect(
      promoteNextWaitlistedRaceSafe({ offeringId: "o1" }),
    ).rejects.toThrow(/serialize/);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-serialization errors", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(
      new Error("boom — totally unrelated"),
    );

    await expect(
      promoteNextWaitlistedRaceSafe({ offeringId: "o1" }),
    ).rejects.toThrow(/boom/);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("takeSeatRaceSafe", () => {
  it("throws when offering does not exist", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue(null);
    await expect(
      takeSeatRaceSafe({ offeringId: "missing", studentId: "s1" }),
    ).rejects.toThrow(/Class not found/);
  });

  it("returns alreadyActive when student is already ENROLLED", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e-existing",
      status: "ENROLLED",
    } as any);

    const result = await takeSeatRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result).toMatchObject({
      enrollmentId: "e-existing",
      status: "ENROLLED",
      alreadyActive: true,
    });
    expect(prisma.classEnrollment.create).not.toHaveBeenCalled();
    expect(prisma.classEnrollment.update).not.toHaveBeenCalled();
  });

  it("returns alreadyActive when student is already WAITLISTED", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e-existing",
      status: "WAITLISTED",
    } as any);

    const result = await takeSeatRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result).toMatchObject({
      status: "WAITLISTED",
      alreadyActive: true,
    });
  });

  it("creates an ENROLLED row when capacity is open", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(5);
    vi.mocked(prisma.classEnrollment.create).mockResolvedValue({
      id: "e-new",
    } as any);

    const result = await takeSeatRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result).toMatchObject({
      status: "ENROLLED",
      waitlisted: false,
      waitlistPosition: null,
      alreadyActive: false,
    });
    expect(prisma.classEnrollment.create).toHaveBeenCalledWith({
      data: {
        studentId: "s1",
        offeringId: "o1",
        status: "ENROLLED",
        waitlistPosition: null,
      },
      select: { id: true },
    });
  });

  it("creates a WAITLISTED row at position 1 when class is full and waitlist is empty", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(10);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.classEnrollment.create).mockResolvedValue({
      id: "e-new",
    } as any);

    const result = await takeSeatRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result).toMatchObject({
      status: "WAITLISTED",
      waitlisted: true,
      waitlistPosition: 1,
    });
  });

  it("computes waitlist position as max(existing) + 1 (regression: re-enrolling does not collide)", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(10);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue({
      waitlistPosition: 7,
    } as any);
    vi.mocked(prisma.classEnrollment.create).mockResolvedValue({
      id: "e-new",
    } as any);

    const result = await takeSeatRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result.waitlistPosition).toBe(8);
  });

  it("re-enrolls a previously DROPPED student in-place (no new row)", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e-old",
      status: "DROPPED",
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(3);
    vi.mocked(prisma.classEnrollment.update).mockResolvedValue({
      id: "e-old",
    } as any);

    const result = await takeSeatRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(prisma.classEnrollment.create).not.toHaveBeenCalled();
    expect(prisma.classEnrollment.update).toHaveBeenCalledWith({
      where: { id: "e-old" },
      data: expect.objectContaining({
        status: "ENROLLED",
        droppedAt: null,
        waitlistPosition: null,
      }),
      select: { id: true },
    });
    expect(result.alreadyActive).toBe(false);
  });
});

describe("dropAndPromoteRaceSafe", () => {
  it("throws when student is not enrolled", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue(null);
    await expect(
      dropAndPromoteRaceSafe({ offeringId: "o1", studentId: "s1" }),
    ).rejects.toThrow(/Not enrolled/);
  });

  it("is a no-op when enrollment is already DROPPED", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e1",
      status: "DROPPED",
    } as any);
    const result = await dropAndPromoteRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result).toEqual({ dropped: false, promotedEnrollmentId: null });
    expect(prisma.classEnrollment.update).not.toHaveBeenCalled();
  });

  it("drops a WAITLISTED enrollment without promoting anyone", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e1",
      status: "WAITLISTED",
    } as any);
    const result = await dropAndPromoteRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result.dropped).toBe(true);
    expect(result.promotedEnrollmentId).toBeNull();
    // Only the drop write happened — no promotion lookups since the dropped
    // student was not holding a confirmed seat.
    expect(prisma.classEnrollment.findFirst).not.toHaveBeenCalled();
  });

  it("drops an ENROLLED student and promotes the next waitlisted person", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e1",
      status: "ENROLLED",
    } as any);
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(9);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue({
      id: "e-next",
    } as any);

    const result = await dropAndPromoteRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result.promotedEnrollmentId).toBe("e-next");
    expect(prisma.classEnrollment.update).toHaveBeenCalledWith({
      where: { id: "e-next" },
      data: { status: "ENROLLED", waitlistPosition: null },
    });
  });

  it("does not promote when the seat is still full after the drop (capacity already exceeded)", async () => {
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e1",
      status: "ENROLLED",
    } as any);
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 10,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(11);

    const result = await dropAndPromoteRaceSafe({
      offeringId: "o1",
      studentId: "s1",
    });
    expect(result.promotedEnrollmentId).toBeNull();
  });
});

describe("promoteNextWaitlistedRaceSafe", () => {
  it("throws when offering not found", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue(null);
    await expect(
      promoteNextWaitlistedRaceSafe({ offeringId: "missing" }),
    ).rejects.toThrow(/not found/i);
  });

  it("throws when class is at capacity", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(5);

    await expect(
      promoteNextWaitlistedRaceSafe({ offeringId: "o1" }),
    ).rejects.toThrow(/at capacity/i);
  });

  it("returns promoted=false when waitlist is empty", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue(null);

    const result = await promoteNextWaitlistedRaceSafe({ offeringId: "o1" });
    expect(result).toEqual({ promoted: false, enrollmentId: null });
  });

  it("promotes the oldest waitlisted entry by waitlistPosition then enrolledAt", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue({
      id: "e-next",
    } as any);

    const result = await promoteNextWaitlistedRaceSafe({ offeringId: "o1" });
    expect(result.enrollmentId).toBe("e-next");
    const callArgs = vi.mocked(prisma.classEnrollment.findFirst).mock.calls[0][0] as any;
    expect(callArgs.orderBy).toEqual([
      { waitlistPosition: "asc" },
      { enrolledAt: "asc" },
    ]);
  });
});
