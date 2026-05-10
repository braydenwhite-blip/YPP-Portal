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
  adminReassignInstructor,
  adminUpdateLogistics,
  getAdminProposalQueue,
  getAdminClassRoster,
  getAdminClassOperationsList,
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
    [
      "adminReassignInstructor",
      () =>
        adminReassignInstructor(
          makeForm({ offeringId: "x", instructorId: "u" }),
        ),
    ],
    [
      "adminUpdateLogistics",
      () => adminUpdateLogistics(makeForm({ offeringId: "x" })),
    ],
    ["getAdminProposalQueue", () => getAdminProposalQueue()],
    ["getAdminClassRoster", () => getAdminClassRoster("x")],
    ["getAdminClassOperationsList", () => getAdminClassOperationsList()],
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
 * adminReassignInstructor
 * ──────────────────────────────────────────────────────────── */

describe("adminReassignInstructor", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "DRAFT",
      capacity: 10,
      enrollmentOpen: false,
      grandfatheredTrainingExemption: false,
      instructorId: "old",
      title: "x",
      deliveryMode: "IN_PERSON",
      locationName: "X",
      locationAddress: "Y",
      zoomLink: null,
      chapterId: null,
      approval: null,
    } as any);
  });

  it("rejects when the new instructor user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(
      adminReassignInstructor(
        makeForm({ offeringId: "o1", instructorId: "missing" }),
      ),
    ).rejects.toThrow(/Instructor not found/);
  });

  it("rejects when the new user lacks the INSTRUCTOR role", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u-student",
      name: "Student",
      roles: [{ role: "STUDENT" }],
    } as any);
    await expect(
      adminReassignInstructor(
        makeForm({ offeringId: "o1", instructorId: "u-student" }),
      ),
    ).rejects.toThrow(/INSTRUCTOR role/);
  });

  it("accepts an ADMIN as a valid reassign target (admins can substitute teach)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u-admin",
      name: "Other Admin",
      roles: [{ role: "ADMIN" }],
    } as any);
    await adminReassignInstructor(
      makeForm({ offeringId: "o1", instructorId: "u-admin" }),
    );
    expect(prisma.classOffering.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { instructorId: "u-admin" },
    });
  });

  it("updates instructorId for a valid INSTRUCTOR user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u-new",
      name: "New",
      roles: [{ role: "INSTRUCTOR" }],
    } as any);
    await adminReassignInstructor(
      makeForm({ offeringId: "o1", instructorId: "u-new" }),
    );
    expect(prisma.classOffering.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { instructorId: "u-new" },
    });
  });
});

/* ────────────────────────────────────────────────────────────
 * adminUpdateLogistics
 * ──────────────────────────────────────────────────────────── */

describe("adminUpdateLogistics", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
  });

  it("no-ops when nothing changed", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      room: "Studio B",
      arrivalInstructions: "Sign in at front desk.",
      materialsList: ["sketchbook", "pencils"],
    } as any);

    const fd = new FormData();
    fd.set("offeringId", "o1");
    fd.set("room", "Studio B");
    fd.set("arrivalInstructions", "Sign in at front desk.");
    fd.set("materialsList", "sketchbook\npencils");

    const result = await adminUpdateLogistics(fd);
    expect(result).toMatchObject({ unchanged: true });
    expect(prisma.classOffering.update).not.toHaveBeenCalled();
    expect(prisma.classOfferingTimelineEvent.create).not.toHaveBeenCalled();
  });

  it("writes the diff and journals a NOTE timeline entry when fields change", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      room: null,
      arrivalInstructions: null,
      materialsList: [],
    } as any);
    vi.mocked(prisma.classOfferingTimelineEvent.create).mockResolvedValue(
      {} as any,
    );

    const fd = new FormData();
    fd.set("offeringId", "o1");
    fd.set("room", "Studio B");
    fd.set("arrivalInstructions", "Sign in at front desk.");
    fd.set("materialsList", "sketchbook\npencils\n  \nwater bottle");

    await adminUpdateLogistics(fd);

    expect(prisma.classOffering.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: {
        room: "Studio B",
        arrivalInstructions: "Sign in at front desk.",
        materialsList: ["sketchbook", "pencils", "water bottle"],
      },
    });

    const journalArgs = vi.mocked(prisma.classOfferingTimelineEvent.create).mock
      .calls[0][0] as any;
    expect(journalArgs.data.kind).toBe("NOTE");
    expect(Object.keys(journalArgs.data.payload)).toEqual(
      expect.arrayContaining(["room", "arrivalInstructions", "materialsList"]),
    );
  });
});

/* ────────────────────────────────────────────────────────────
 * getAdminClassOperationsList — pagination
 * ──────────────────────────────────────────────────────────── */

describe("getAdminClassOperationsList pagination", () => {
  beforeEach(() => {
    vi.mocked(authorization.requireAnyRole).mockResolvedValue(adminUser());
    vi.mocked(prisma.classEnrollment.groupBy).mockResolvedValue([] as any);
  });

  function makeOfferingRow(idx: number) {
    return {
      id: `o-${idx}`,
      title: `Class ${idx}`,
      status: "DRAFT",
      enrollmentOpen: false,
      startDate: new Date("2030-01-01"),
      endDate: new Date("2030-04-01"),
      meetingDays: [],
      meetingTime: "16:00-18:00",
      deliveryMode: "IN_PERSON",
      locationName: "X",
      locationAddress: "Y",
      zoomLink: null,
      capacity: 10,
      grandfatheredTrainingExemption: false,
      semester: null,
      createdAt: new Date("2030-01-01"),
      updatedAt: new Date(2030, 0, 1, 0, 0, idx),
      instructor: { id: "u1", name: "I", email: "i@x" },
      chapter: null,
      template: null,
      approval: null,
      _count: { enrollments: 0, sessions: 0 },
    };
  }

  it("requests limit+1 rows so it can detect more pages", async () => {
    vi.mocked(prisma.classOffering.findMany).mockResolvedValue([] as any);
    await getAdminClassOperationsList({ limit: 50 });
    const call = vi.mocked(prisma.classOffering.findMany).mock.calls[0][0] as any;
    expect(call.take).toBe(51);
    expect(call.orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
  });

  it("returns nextCursor when more pages exist, and trims the peek row from items", async () => {
    const rows = Array.from({ length: 4 }, (_, i) => makeOfferingRow(i));
    vi.mocked(prisma.classOffering.findMany).mockResolvedValue(rows as any);

    const page = await getAdminClassOperationsList({ limit: 3 });
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeTruthy();
  });

  it("returns null cursor when fewer than limit+1 rows are returned", async () => {
    const rows = Array.from({ length: 2 }, (_, i) => makeOfferingRow(i));
    vi.mocked(prisma.classOffering.findMany).mockResolvedValue(rows as any);

    const page = await getAdminClassOperationsList({ limit: 3 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it("decodes a cursor and applies the keyset filter on the next page", async () => {
    vi.mocked(prisma.classOffering.findMany).mockResolvedValue([] as any);
    const cursor = Buffer.from(
      JSON.stringify({ updatedAt: "2030-01-01T00:00:00.000Z", id: "o-9" }),
      "utf-8",
    ).toString("base64url");

    await getAdminClassOperationsList({ cursor });

    const call = vi.mocked(prisma.classOffering.findMany).mock.calls[0][0] as any;
    expect(call.where.OR).toEqual([
      { updatedAt: { lt: new Date("2030-01-01T00:00:00.000Z") } },
      { updatedAt: new Date("2030-01-01T00:00:00.000Z"), id: { gt: "o-9" } },
    ]);
  });

  it("ignores a malformed cursor (treats as first page)", async () => {
    vi.mocked(prisma.classOffering.findMany).mockResolvedValue([] as any);
    await getAdminClassOperationsList({ cursor: "not-a-cursor" });
    const call = vi.mocked(prisma.classOffering.findMany).mock.calls[0][0] as any;
    expect(call.where).toBeUndefined();
  });

  it("scopes the waitlist groupBy to the page's offering IDs", async () => {
    const rows = [makeOfferingRow(1), makeOfferingRow(2)];
    vi.mocked(prisma.classOffering.findMany).mockResolvedValue(rows as any);

    await getAdminClassOperationsList({ limit: 50 });

    const groupCall = vi.mocked(prisma.classEnrollment.groupBy).mock
      .calls[0][0] as any;
    expect(groupCall.where).toMatchObject({
      status: "WAITLISTED",
      offeringId: { in: ["o-1", "o-2"] },
    });
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
