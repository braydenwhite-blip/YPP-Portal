import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authorization from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  isOfferingPubliclyVisible,
  publicOfferingWhere,
} from "@/lib/class-visibility";
import {
  adminPublishClassOffering,
  adminUnpublishClassOffering,
  adminCancelClassOffering,
  adminMarkClassCompleted,
  adminUpdateCapacity,
  adminPromoteFromWaitlist,
  adminUpdateEnrollmentStatus,
  getAdminProposalQueue,
  getAdminClassRoster,
} from "@/lib/admin-class-operations";

vi.mock("@/lib/authorization", () => ({
  requireSessionUser: vi.fn(),
  requireAnyRole: vi.fn(),
}));

function adminUser() {
  return {
    id: "admin-1",
    roles: ["ADMIN"],
    primaryRole: "ADMIN",
    adminSubtypes: [],
  };
}

function nonAdminUser() {
  return {
    id: "instructor-1",
    roles: ["INSTRUCTOR"],
    primaryRole: "INSTRUCTOR",
    adminSubtypes: [],
  };
}

function makeForm(entries: Record<string, string | number>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, String(v));
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ────────────────────────────────────────────────────────────
 * publicOfferingWhere / isOfferingPubliclyVisible
 * ──────────────────────────────────────────────────────────── */

describe("class-visibility", () => {
  it("publicOfferingWhere requires PUBLISHED/IN_PROGRESS AND approved-or-grandfathered", () => {
    const where = publicOfferingWhere();
    expect(where.status).toEqual({ in: ["PUBLISHED", "IN_PROGRESS"] });
    expect(where.OR).toEqual([
      { approval: { is: { status: "APPROVED" } } },
      { grandfatheredTrainingExemption: true },
    ]);
  });

  it("publicOfferingWhere preserves caller-supplied filters", () => {
    const where = publicOfferingWhere({ chapterId: "chap-1" });
    expect(where.chapterId).toBe("chap-1");
    expect(where.OR).toBeDefined();
  });

  it("isOfferingPubliclyVisible rejects DRAFT regardless of approval", () => {
    expect(
      isOfferingPubliclyVisible({
        status: "DRAFT",
        approval: { status: "APPROVED" },
        grandfatheredTrainingExemption: false,
      }),
    ).toBe(false);
  });

  it("isOfferingPubliclyVisible rejects PUBLISHED without approval", () => {
    expect(
      isOfferingPubliclyVisible({
        status: "PUBLISHED",
        approval: null,
        grandfatheredTrainingExemption: false,
      }),
    ).toBe(false);
  });

  it("isOfferingPubliclyVisible rejects PUBLISHED with REJECTED approval", () => {
    expect(
      isOfferingPubliclyVisible({
        status: "PUBLISHED",
        approval: { status: "REJECTED" },
        grandfatheredTrainingExemption: false,
      }),
    ).toBe(false);
  });

  it("isOfferingPubliclyVisible accepts PUBLISHED + APPROVED", () => {
    expect(
      isOfferingPubliclyVisible({
        status: "PUBLISHED",
        approval: { status: "APPROVED" },
        grandfatheredTrainingExemption: false,
      }),
    ).toBe(true);
  });

  it("isOfferingPubliclyVisible accepts grandfathered offerings", () => {
    expect(
      isOfferingPubliclyVisible({
        status: "IN_PROGRESS",
        approval: null,
        grandfatheredTrainingExemption: true,
      }),
    ).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────
 * Admin permission gating
 * ──────────────────────────────────────────────────────────── */

describe("admin-class-operations permissions", () => {
  it.each([
    ["adminPublishClassOffering", () => adminPublishClassOffering(makeForm({ offeringId: "x" }))],
    ["adminUnpublishClassOffering", () => adminUnpublishClassOffering(makeForm({ offeringId: "x" }))],
    ["adminCancelClassOffering", () => adminCancelClassOffering(makeForm({ offeringId: "x" }))],
    ["adminMarkClassCompleted", () => adminMarkClassCompleted(makeForm({ offeringId: "x" }))],
    ["adminUpdateCapacity", () => adminUpdateCapacity(makeForm({ offeringId: "x", capacity: 10 }))],
    ["adminPromoteFromWaitlist", () => adminPromoteFromWaitlist(makeForm({ offeringId: "x" }))],
    [
      "adminUpdateEnrollmentStatus",
      () => adminUpdateEnrollmentStatus(makeForm({ enrollmentId: "e1", status: "ENROLLED" })),
    ],
    ["getAdminProposalQueue", () => getAdminProposalQueue()],
    ["getAdminClassRoster", () => getAdminClassRoster("x")],
  ])("%s rejects non-admin callers", async (_name, action) => {
    vi.mocked(authorization.requireAnyRole).mockRejectedValue(
      new Error("Insufficient role: requires one of ADMIN"),
    );
    await expect(action()).rejects.toThrow(/role/i);
  });
});

/* ────────────────────────────────────────────────────────────
 * adminPublishClassOffering
 * ──────────────────────────────────────────────────────────── */

describe("adminPublishClassOffering", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
  });

  it("refuses to publish an unapproved class", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "DRAFT",
      enrollmentOpen: false,
      capacity: 20,
      grandfatheredTrainingExemption: false,
      instructorId: "i1",
      title: "Pottery",
      deliveryMode: "IN_PERSON",
      locationName: "YPP HQ",
      locationAddress: "1 Main St",
      zoomLink: null,
      chapterId: "c1",
      approval: { status: "REQUESTED" },
    } as any);

    await expect(
      adminPublishClassOffering(makeForm({ offeringId: "o1" })),
    ).rejects.toThrow(/has not been approved/i);
    expect(prisma.classOffering.update).not.toHaveBeenCalled();
  });

  it("refuses to publish IN_PERSON class missing location", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "DRAFT",
      enrollmentOpen: false,
      capacity: 20,
      grandfatheredTrainingExemption: false,
      instructorId: "i1",
      title: "Pottery",
      deliveryMode: "IN_PERSON",
      locationName: null,
      locationAddress: null,
      zoomLink: null,
      chapterId: "c1",
      approval: { status: "APPROVED" },
    } as any);

    await expect(
      adminPublishClassOffering(makeForm({ offeringId: "o1" })),
    ).rejects.toThrow(/location name and address/i);
    expect(prisma.classOffering.update).not.toHaveBeenCalled();
  });

  it("publishes an approved IN_PERSON class with full logistics", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "DRAFT",
      enrollmentOpen: false,
      capacity: 20,
      grandfatheredTrainingExemption: false,
      instructorId: "i1",
      title: "Pottery",
      deliveryMode: "IN_PERSON",
      locationName: "YPP HQ",
      locationAddress: "1 Main St",
      zoomLink: null,
      chapterId: "c1",
      approval: { status: "APPROVED" },
    } as any);

    await adminPublishClassOffering(makeForm({ offeringId: "o1" }));

    expect(prisma.classOffering.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "PUBLISHED", enrollmentOpen: true },
    });
  });

  it("treats grandfathered offerings as approved", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "DRAFT",
      enrollmentOpen: false,
      capacity: 20,
      grandfatheredTrainingExemption: true,
      instructorId: "i1",
      title: "Pottery",
      deliveryMode: "VIRTUAL",
      locationName: null,
      locationAddress: null,
      zoomLink: "https://example.com/z",
      chapterId: "c1",
      approval: null,
    } as any);

    await adminPublishClassOffering(makeForm({ offeringId: "o1" }));
    expect(prisma.classOffering.update).toHaveBeenCalled();
  });

  it("is a no-op when already published", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "PUBLISHED",
      enrollmentOpen: true,
      capacity: 20,
      grandfatheredTrainingExemption: false,
      instructorId: "i1",
      title: "Pottery",
      deliveryMode: "IN_PERSON",
      locationName: "X",
      locationAddress: "Y",
      zoomLink: null,
      chapterId: "c1",
      approval: { status: "APPROVED" },
    } as any);

    const result = await adminPublishClassOffering(makeForm({ offeringId: "o1" }));
    expect(result).toMatchObject({ alreadyPublished: true });
    expect(prisma.classOffering.update).not.toHaveBeenCalled();
  });
});

/* ────────────────────────────────────────────────────────────
 * adminUnpublishClassOffering
 * ──────────────────────────────────────────────────────────── */

describe("adminUnpublishClassOffering", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
  });

  it("refuses to unpublish a completed class", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "COMPLETED",
      capacity: 1,
      enrollmentOpen: false,
      grandfatheredTrainingExemption: false,
      instructorId: "i1",
      title: "x",
      deliveryMode: "IN_PERSON",
      locationName: null,
      locationAddress: null,
      zoomLink: null,
      chapterId: null,
      approval: { status: "APPROVED" },
    } as any);

    await expect(
      adminUnpublishClassOffering(makeForm({ offeringId: "o1" })),
    ).rejects.toThrow(/completed or cancelled/i);
  });

  it("returns to DRAFT and closes enrollment", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "PUBLISHED",
      capacity: 1,
      enrollmentOpen: true,
      grandfatheredTrainingExemption: false,
      instructorId: "i1",
      title: "x",
      deliveryMode: "IN_PERSON",
      locationName: "X",
      locationAddress: "Y",
      zoomLink: null,
      chapterId: null,
      approval: { status: "APPROVED" },
    } as any);

    await adminUnpublishClassOffering(makeForm({ offeringId: "o1" }));

    expect(prisma.classOffering.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { status: "DRAFT", enrollmentOpen: false },
    });
  });
});

/* ────────────────────────────────────────────────────────────
 * adminUpdateCapacity
 * ──────────────────────────────────────────────────────────── */

describe("adminUpdateCapacity", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "PUBLISHED",
      capacity: 10,
      enrollmentOpen: true,
      grandfatheredTrainingExemption: false,
      instructorId: "i1",
      title: "x",
      deliveryMode: "IN_PERSON",
      locationName: "X",
      locationAddress: "Y",
      zoomLink: null,
      chapterId: null,
      approval: { status: "APPROVED" },
    } as any);
  });

  it("rejects non-positive capacity", async () => {
    await expect(
      adminUpdateCapacity(makeForm({ offeringId: "o1", capacity: 0 })),
    ).rejects.toThrow(/positive/i);
  });

  it("updates capacity when valid", async () => {
    await adminUpdateCapacity(makeForm({ offeringId: "o1", capacity: 25 }));
    expect(prisma.classOffering.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { capacity: 25 },
    });
  });
});

/* ────────────────────────────────────────────────────────────
 * adminPromoteFromWaitlist
 * ──────────────────────────────────────────────────────────── */

describe("adminPromoteFromWaitlist", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
  });

  it("refuses when class is at capacity", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(5);

    await expect(
      adminPromoteFromWaitlist(makeForm({ offeringId: "o1" })),
    ).rejects.toThrow(/at capacity/i);
  });

  it("returns promoted=false when waitlist is empty", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue(null);

    const result = await adminPromoteFromWaitlist(makeForm({ offeringId: "o1" }));
    expect(result.promoted).toBe(false);
    expect(prisma.classEnrollment.update).not.toHaveBeenCalled();
  });

  it("promotes the next waitlisted student to ENROLLED", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      capacity: 5,
    } as any);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue({
      id: "e-next",
    } as any);

    const result = await adminPromoteFromWaitlist(makeForm({ offeringId: "o1" }));
    expect(result.promoted).toBe(true);
    expect(prisma.classEnrollment.update).toHaveBeenCalledWith({
      where: { id: "e-next" },
      data: { status: "ENROLLED", waitlistPosition: null },
    });
  });
});

/* ────────────────────────────────────────────────────────────
 * adminUpdateEnrollmentStatus
 * ──────────────────────────────────────────────────────────── */

describe("adminUpdateEnrollmentStatus", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue({
      id: "e1",
      offeringId: "o1",
      status: "WAITLISTED",
    } as any);
  });

  it("rejects an unknown status string", async () => {
    await expect(
      adminUpdateEnrollmentStatus(makeForm({ enrollmentId: "e1", status: "BOGUS" })),
    ).rejects.toThrow(/invalid/i);
  });

  it("clears waitlistPosition when promoting to ENROLLED", async () => {
    await adminUpdateEnrollmentStatus(
      makeForm({ enrollmentId: "e1", status: "ENROLLED" }),
    );
    expect(prisma.classEnrollment.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: expect.objectContaining({
        status: "ENROLLED",
        droppedAt: null,
        waitlistPosition: null,
      }),
    });
  });

  it("stamps droppedAt when dropping", async () => {
    await adminUpdateEnrollmentStatus(
      makeForm({ enrollmentId: "e1", status: "DROPPED" }),
    );
    const call = vi.mocked(prisma.classEnrollment.update).mock.calls[0][0] as any;
    expect(call.data.status).toBe("DROPPED");
    expect(call.data.droppedAt).toBeInstanceOf(Date);
    expect(call.data.waitlistPosition).toBeNull();
  });

  it("stamps completedAt when marking complete", async () => {
    await adminUpdateEnrollmentStatus(
      makeForm({ enrollmentId: "e1", status: "COMPLETED" }),
    );
    const call = vi.mocked(prisma.classEnrollment.update).mock.calls[0][0] as any;
    expect(call.data.status).toBe("COMPLETED");
    expect(call.data.completedAt).toBeInstanceOf(Date);
  });
});

/* ────────────────────────────────────────────────────────────
 * getAdminProposalQueue — admins see all chapters/statuses
 * ──────────────────────────────────────────────────────────── */

describe("getAdminProposalQueue", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
  });

  it("filters to in-flight approval statuses (REQUESTED, UNDER_REVIEW, CHANGES_REQUESTED)", async () => {
    vi.mocked(prisma.classOffering.findMany).mockResolvedValue([] as any);
    await getAdminProposalQueue();

    const call = vi.mocked(prisma.classOffering.findMany).mock.calls[0][0] as any;
    expect(call.where.approval.is.status.in).toEqual([
      "REQUESTED",
      "UNDER_REVIEW",
      "CHANGES_REQUESTED",
    ]);
  });
});
