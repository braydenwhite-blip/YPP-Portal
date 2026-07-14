import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock: any = {
  user: { findUnique: vi.fn() },
  classOffering: { findUnique: vi.fn() },
  classEnrollment: { count: vi.fn(), upsert: vi.fn() },
  classOfferingTimelineEvent: { create: vi.fn() },
  guardianApprovalRequest: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  familyWaitlistEntry: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn) => fn(prismaMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/family-access", async () => {
  const actual: any = await vi.importActual("@/lib/family-access");
  return { ...actual, requireGuardianAccessToStudent: vi.fn(async () => ({ relationshipStatus: "ACTIVE", revokedAt: null, canViewLearning: true, canApproveEnrollment: true, canManageEnrollment: true })) };
});

const { evaluateFamilyEnrollment, enrollDirect, joinWaitlist, requestGuardianApproval, acceptWaitlistOffer } = await import("@/lib/family-enrollment-service");
function offering(overrides: any = {}) { return { id: "off1", title: "Story Lab", capacity: 2, enrollmentOpen: true, familyEnrollmentConfig: null, enrollments: [], familyWaitlistEntries: [], guardianApprovalRequests: [], ...overrides }; }

describe("family enrollment service", () => {
  beforeEach(() => { vi.clearAllMocks(); prismaMock.user.findUnique.mockResolvedValue({ id: "student1", profile: { gradeLevel: 7 } }); prismaMock.classEnrollment.count.mockResolvedValue(0); prismaMock.classEnrollment.upsert.mockResolvedValue({ id: "en1", status: "ENROLLED" }); prismaMock.classOffering.findUnique.mockImplementation(({ select }: any) => select ? Promise.resolve({ capacity: 2 }) : Promise.resolve(offering())); prismaMock.classOfferingTimelineEvent.create.mockResolvedValue({}); });
  it("allows direct enrollment when eligible", async () => { await expect(evaluateFamilyEnrollment("student1", "off1")).resolves.toMatchObject({ action: "ENROLL", explanation: "You can enroll now." }); await expect(enrollDirect("student1", "off1", { userId: "student1", role: "STUDENT" })).resolves.toMatchObject({ message: expect.stringContaining("enrolled") }); });
  it("prevents duplicate enrolled participation", async () => { prismaMock.classOffering.findUnique.mockResolvedValue(offering({ enrollments: [{ status: "ENROLLED" }] })); await expect(evaluateFamilyEnrollment("student1", "off1")).resolves.toMatchObject({ action: "NONE", existingParticipationState: "ENROLLED" }); });
  it("enforces capacity and routes to waitlist", async () => { prismaMock.classEnrollment.count.mockResolvedValue(2); await expect(evaluateFamilyEnrollment("student1", "off1")).resolves.toMatchObject({ action: "JOIN_WAITLIST" }); await expect(enrollDirect("student1", "off1", { userId: "student1", role: "STUDENT" })).rejects.toThrow(/waitlist/); });
  it("creates guardian approval requests", async () => { prismaMock.classOffering.findUnique.mockResolvedValue(offering({ familyEnrollmentConfig: { mode: "GUARDIAN_APPROVAL_REQUIRED", requiresGuardianApproval: true } })); prismaMock.guardianApprovalRequest.upsert.mockResolvedValue({ id: "req1" }); await expect(requestGuardianApproval("student1", "off1", "student1")).resolves.toMatchObject({ id: "req1" }); });
  it("blocks grade-ineligible students", async () => { prismaMock.classOffering.findUnique.mockResolvedValue(offering({ familyEnrollmentConfig: { minGrade: 8, maxGrade: 9 } })); await expect(evaluateFamilyEnrollment("student1", "off1")).resolves.toMatchObject({ action: "NONE", blockingReason: "grade" }); });
  it("joins waitlist without duplicate rows", async () => { prismaMock.classEnrollment.count.mockResolvedValue(3); prismaMock.familyWaitlistEntry.upsert.mockResolvedValue({ id: "wl1", status: "ACTIVE" }); await expect(joinWaitlist("student1", "off1", { userId: "student1", role: "STUDENT" })).resolves.toMatchObject({ status: "ACTIVE" }); });
  it("expires stale waitlist offers", async () => { prismaMock.familyWaitlistEntry.findUnique.mockResolvedValue({ id: "wl1", status: "OFFERED", offerExpiresAt: new Date(Date.now() - 1000) }); prismaMock.familyWaitlistEntry.update.mockResolvedValue({}); await expect(acceptWaitlistOffer("student1", "off1", { userId: "student1", role: "STUDENT" })).rejects.toThrow(/expired/); });
  it("routes application and invitation modes safely", async () => { prismaMock.classOffering.findUnique.mockResolvedValueOnce(offering({ familyEnrollmentConfig: { mode: "APPLICATION_REQUIRED", applicationUrl: "/applications/start" } })); await expect(evaluateFamilyEnrollment("student1", "off1")).resolves.toMatchObject({ action: "APPLY" }); prismaMock.classOffering.findUnique.mockResolvedValueOnce(offering({ familyEnrollmentConfig: { mode: "INVITATION_ONLY" } })); await expect(evaluateFamilyEnrollment("student1", "off1")).resolves.toMatchObject({ state: "INVITATION_REQUIRED" }); });
});
