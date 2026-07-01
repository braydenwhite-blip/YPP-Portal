import { describe, it, expect, vi, beforeEach } from "vitest";

// Declare mocks BEFORE importing the modules under test (mirrors
// tests/lib/workflow-engine/attachment.test.ts / action-sync.test.ts).
const { fireEntityStatusChanged } = vi.hoisted(() => ({
  fireEntityStatusChanged: vi.fn(),
}));

vi.mock("@/lib/workflow-engine/triggers", () => ({
  fireEntityStatusChanged,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// --- lib/partners-actions.ts -------------------------------------------------

const { requireAnyRole } = vi.hoisted(() => ({
  requireAnyRole: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({
  requireAnyRole,
}));

vi.mock("@/lib/help-agent/search-indexing", () => ({
  syncPartnerSearchDocument: vi.fn(),
}));

// --- lib/class-management-actions.ts + lib/admin-class-operations.ts -------

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession,
}));

vi.mock("@/lib/instructor-growth-service", () => ({
  syncInstructorGrowthSignalsForInstructor: vi.fn(async () => undefined),
}));

vi.mock("@/lib/instructor-readiness", () => ({
  assertCanPublishOffering: vi.fn(),
}));

vi.mock("@/lib/class-offering-timeline", () => ({
  recordOfferingTimeline: vi.fn(),
}));

vi.mock("@/lib/class-notifications", () => ({
  notifyWaitlistPromotion: vi.fn(),
}));

vi.mock("@/lib/class-visibility", () => ({
  isOfferingPubliclyVisible: vi.fn(),
  publicOfferingWhere: vi.fn(),
}));

// --- lib/curriculum-draft-actions.ts -----------------------------------------

vi.mock("@/lib/training-actions", () => ({
  syncTrainingAssignmentFromArtifacts: vi.fn(),
}));

const { prisma } = vi.hoisted(() => ({
  prisma: {
    partner: {
      create: vi.fn(),
      update: vi.fn(),
    },
    partnerNote: {
      create: vi.fn(),
    },
    classOffering: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    classTemplate: {
      findUnique: vi.fn(),
    },
    classSession: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    curriculumDraft: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trainingModule: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { createPartner, updatePartnerStage } from "@/lib/partners-actions";
import {
  createClassOffering,
  publishClassOffering,
} from "@/lib/class-management-actions";
import { adminMarkClassCompleted } from "@/lib/admin-class-operations";
import { submitCurriculumDraft } from "@/lib/curriculum-draft-actions";

function adminSessionUser() {
  return {
    id: "admin-1",
    roles: ["ADMIN"],
    primaryRole: "ADMIN",
    adminSubtypes: [],
  };
}

function instructorSession() {
  return {
    user: {
      id: "instructor-1",
      roles: ["INSTRUCTOR"],
    },
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
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(prisma);
    return arg;
  });
});

describe("createPartner auto-start", () => {
  it("fires ENTITY_STATUS_CHANGED for PARTNER with the default NOT_STARTED stage", async () => {
    requireAnyRole.mockResolvedValue(adminSessionUser());
    prisma.partner.create.mockResolvedValue({
      id: "partner-1",
      chapterId: null,
    });

    await createPartner(makeForm({ name: "Acme Co" }));

    expect(fireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(fireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "PARTNER",
      subjectId: "partner-1",
      newStatus: "NOT_STARTED",
      chapterId: null,
      ownerId: "admin-1",
      startedById: "admin-1",
    });
  });
});

describe("updatePartnerStage auto-start", () => {
  it("fires ENTITY_STATUS_CHANGED for PARTNER with the NEW stage", async () => {
    requireAnyRole.mockResolvedValue(adminSessionUser());
    prisma.partner.update.mockResolvedValue({
      id: "partner-1",
      chapterId: "chapter-9",
      stage: "NEGOTIATING",
    });
    prisma.partnerNote.create.mockResolvedValue({});

    await updatePartnerStage(makeForm({ id: "partner-1", stage: "NEGOTIATING" }));

    expect(fireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(fireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "PARTNER",
      subjectId: "partner-1",
      newStatus: "NEGOTIATING",
      chapterId: "chapter-9",
      ownerId: "admin-1",
      startedById: "admin-1",
    });
  });
});

describe("createClassOffering auto-start", () => {
  it("fires ENTITY_STATUS_CHANGED for CLASS_OFFERING with DRAFT status", async () => {
    getSession.mockResolvedValue(instructorSession());
    prisma.classTemplate.findUnique.mockResolvedValue({
      deliveryModes: ["VIRTUAL"],
      durationWeeks: 4,
      weeklyTopics: [],
    });
    prisma.classOffering.create.mockResolvedValue({
      id: "offering-1",
      chapterId: null,
    });
    prisma.classSession.findMany.mockResolvedValue([]);
    prisma.classSession.deleteMany.mockResolvedValue({});
    prisma.classSession.createMany.mockResolvedValue({});

    await createClassOffering(
      makeForm({
        templateId: "template-1",
        title: "Intro to Robotics",
        startDate: "2026-01-05",
        endDate: "2026-03-01",
        meetingTime: "16:00-18:00",
        deliveryMode: "VIRTUAL",
        zoomLink: "https://example.com/z",
        capacity: 20,
      }),
    );

    expect(fireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(fireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "CLASS_OFFERING",
      subjectId: "offering-1",
      newStatus: "DRAFT",
      chapterId: null,
      ownerId: "instructor-1",
      startedById: "instructor-1",
    });
  });
});

describe("publishClassOffering auto-start", () => {
  it("fires ENTITY_STATUS_CHANGED for CLASS_OFFERING with PUBLISHED status", async () => {
    getSession.mockResolvedValue(instructorSession());
    prisma.classOffering.findUnique.mockResolvedValue({
      id: "offering-1",
      instructorId: "instructor-1",
      templateId: "template-1",
      chapterId: "chapter-5",
      pathwayStepId: null,
      deliveryMode: "VIRTUAL",
      locationName: null,
      locationAddress: null,
      zoomLink: "https://example.com/z",
    });
    prisma.classOffering.update.mockResolvedValue({});

    await publishClassOffering("offering-1");

    expect(fireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(fireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "CLASS_OFFERING",
      subjectId: "offering-1",
      newStatus: "PUBLISHED",
      chapterId: "chapter-5",
      ownerId: "instructor-1",
      startedById: "instructor-1",
    });
  });
});

describe("adminMarkClassCompleted auto-start", () => {
  it("fires ENTITY_STATUS_CHANGED for CLASS_OFFERING with COMPLETED status", async () => {
    requireAnyRole.mockResolvedValue(adminSessionUser());
    prisma.classOffering.findUnique.mockResolvedValue({
      id: "offering-1",
      status: "PUBLISHED",
      enrollmentOpen: true,
      capacity: 20,
      grandfatheredTrainingExemption: false,
      instructorId: "instructor-1",
      title: "Intro to Robotics",
      deliveryMode: "VIRTUAL",
      locationName: null,
      locationAddress: null,
      zoomLink: "https://example.com/z",
      chapterId: "chapter-5",
      approval: { status: "APPROVED" },
    });
    prisma.classOffering.update.mockResolvedValue({});

    await adminMarkClassCompleted(makeForm({ offeringId: "offering-1" }));

    expect(fireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(fireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "CLASS_OFFERING",
      subjectId: "offering-1",
      newStatus: "COMPLETED",
      chapterId: "chapter-5",
      ownerId: "admin-1",
      startedById: "admin-1",
    });
  });
});

describe("submitCurriculumDraft auto-start", () => {
  it("fires ENTITY_STATUS_CHANGED for CURRICULUM_DRAFT with SUBMITTED status", async () => {
    getSession.mockResolvedValue({
      user: { id: "author-1", roles: ["INSTRUCTOR"] },
    });
    prisma.curriculumDraft.findUnique.mockResolvedValue({
      authorId: "author-1",
      title: "Intro to Robotics",
      interestArea: "STEM",
      outcomes: ["Outcome 1", "Outcome 2", "Outcome 3"],
      courseConfig: {
        durationWeeks: 1,
        sessionsPerWeek: 1,
        classDurationMin: 60,
        targetAgeGroup: "Teens",
        deliveryModes: ["VIRTUAL"],
        difficultyLevel: "LEVEL_101",
        minStudents: 3,
        maxStudents: 25,
        idealSize: 12,
        estimatedHours: 1,
      },
      weeklyPlans: [
        {
          id: "session_1_1",
          title: "Session 1",
          classDurationMin: 60,
          objective: "Introduce the basics of robotics.",
          atHomeAssignment: {
            type: "REFLECTION_PROMPT",
            title: "Reflect",
            description: "Write about what you learned.",
          },
          activities: [
            { title: "Warm up", type: "WARM_UP", durationMin: 10 },
            { title: "Main lesson", type: "DIRECT_INSTRUCTION", durationMin: 30 },
            { title: "Wrap up", type: "REFLECTION", durationMin: 10 },
          ],
        },
      ],
      understandingChecks: {
        answers: {},
        lastScorePct: 100,
        passed: true,
        completedAt: new Date().toISOString(),
      },
      status: "IN_PROGRESS",
    });
    prisma.curriculumDraft.update.mockResolvedValue({
      id: "draft-1",
      title: "Intro to Robotics",
      interestArea: "STEM",
      outcomes: ["Outcome 1"],
      weeklyPlans: [],
      status: "SUBMITTED",
    });
    prisma.trainingModule.findMany.mockResolvedValue([]);

    await submitCurriculumDraft("draft-1");

    expect(fireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(fireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "CURRICULUM_DRAFT",
      subjectId: "draft-1",
      newStatus: "SUBMITTED",
      chapterId: null,
      ownerId: "author-1",
      startedById: "author-1",
    });
  });
});
