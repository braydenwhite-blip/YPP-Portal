/**
 * Batch 2 auto-start call sites: InstructorApplication submission (new
 * applicant sign-up + existing-user re-application) and Mentorship creation.
 * Asserts `fireEntityStatusChanged` is called once with the exact expected
 * subjectType/newStatus for each real call site.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import { createServiceClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const { mockFireEntityStatusChanged } = vi.hoisted(() => ({
  mockFireEntityStatusChanged: vi.fn(),
}));

vi.mock("@/lib/workflow-engine/triggers", () => ({
  fireEntityStatusChanged: mockFireEntityStatusChanged,
}));

// ── signup-actions dependencies ────────────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ success: true, remaining: 4 })),
}));

vi.mock("@/lib/workflow", () => ({
  syncInstructorApplicationWorkflow: vi.fn(),
}));

vi.mock("@/lib/instructor-application-defaults", () => ({
  findDefaultInitialReviewerForChapter: vi.fn(() => null),
}));

vi.mock("@/lib/applicant-video-upload", () => ({
  isStoredFileUrl: vi.fn(() => true),
}));

vi.mock("@/lib/instructor-application-actions", () => ({
  notifyReviewersOfNewApplication: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendInstructorApplicationSubmittedEmail: vi.fn(),
}));

// ── mentorship-program-actions dependencies ────────────────────────────────

vi.mock("@/lib/audit-log-actions", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/mentorship-canonical", () => ({
  ensureCanonicalTrack: vi.fn(async () => ({ id: "track-1" })),
  enforceFullProgramMentorCapacity: vi.fn(),
  getAchievementAwardLevelForPoints: vi.fn(),
  getAwardPolicyForProgramGroup: vi.fn(),
  getCommitteeScopeForProgramGroup: vi.fn(),
  getDefaultMentorCapForProgramGroup: vi.fn(),
  getGovernanceModeForProgramGroup: vi.fn(() => "FULL_PROGRAM"),
  getLegacyMenteeRoleTypeForRole: vi.fn(() => "INSTRUCTOR"),
  getMentorshipProgramGroupForRole: vi.fn(() => "INSTRUCTOR"),
  getMentorshipTypeForProgramGroup: vi.fn(() => "INSTRUCTOR"),
  mentorshipRequiresChairApproval: vi.fn(),
  mentorshipRequiresKickoff: vi.fn(),
  mentorshipRequiresMonthlyReflection: vi.fn(),
}));

vi.mock("@/lib/mentorship-access", () => ({
  getMentorshipAccessibleMenteeIds: vi.fn(),
  hasMentorshipMenteeAccess: vi.fn(),
}));

vi.mock("@/lib/mentorship-hub-actions", () => ({
  ensureMentorshipSupportCircle: vi.fn(),
}));

vi.mock("@/lib/help-agent/search-indexing", () => ({
  syncMentorshipSearchDocument: vi.fn(),
}));

import { signUp, submitInstructorApplicationForExistingUser } from "@/lib/signup-actions";
import { assignProgramMentor } from "@/lib/mentorship-program-actions";

function makeApplicantFormData(): FormData {
  const fd = new FormData();
  fd.set("accountType", "APPLICANT");
  fd.set("name", "Test Applicant");
  fd.set("email", "applicant@example.com");
  fd.set("password", "Password1");
  fd.set("chapterId", "chapter-1");
  fd.set("legalName", "Test Applicant");
  fd.set("preferredFirstName", "Test");
  fd.set("lastName", "Applicant");
  fd.set("phoneNumber", "5551234567");
  fd.set("dateOfBirth", "2005-01-01");
  fd.set("hearAboutYPP", "Word of mouth");
  fd.set("city", "Phoenix");
  fd.set("stateProvince", "Arizona");
  fd.set("zipCode", "85004");
  fd.set("country", "United States");
  fd.set("countryOther", "");
  fd.set("schoolName", "Central High");
  fd.set("graduationYear", "2027");
  fd.set("subjectsOfInterest", "Math");
  fd.set("motivation", "");
  fd.set("motivationVideoUrl", "");
  fd.set(
    "teachingExperience",
    "I have tutored middle schoolers in math and science for two years at my school's tutoring center."
  );
  fd.set("referralEmails", "");
  fd.set("courseIdea", "Personal Finance 101");
  fd.set("textbook", "");
  fd.set("courseOutline", "Week 1: Intro\nWeek 2: Budgeting\nWeek 3: Saving");
  fd.set("firstClassPlan", "Icebreaker then intro then Q&A to finish");
  fd.set("availability", "Weekday evenings, EST");
  fd.set("hoursPerWeek", "5");
  fd.set("preferredStartDate", "2025-09-01");
  return fd;
}

describe("InstructorApplication submission auto-start", () => {
  const prevState = { status: "idle" as const, message: "" };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).user.upsert = vi.fn();
    (prisma as any).user.findUniqueOrThrow = vi.fn();
    (prisma as any).instructorApplication = {
      create: vi.fn(),
      findFirst: vi.fn(),
    };
  });

  it("signUp() fires ENTITY_STATUS_CHANGED for a new applicant's submitted application", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: "auth-user-1" } },
            error: null,
          }),
          deleteUser: vi.fn(),
        },
      },
    } as any);
    vi.mocked(prisma.user.upsert as any).mockResolvedValue({
      id: "user-1",
      email: "applicant@example.com",
      chapterId: "chapter-1",
    });
    vi.mocked(prisma.userRole.upsert as any).mockResolvedValue({});
    vi.mocked((prisma as any).instructorApplication.create).mockResolvedValue({
      id: "app-1",
    });

    const result = await signUp(prevState, makeApplicantFormData());

    expect(result.status).toBe("success");
    expect(mockFireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(mockFireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "INSTRUCTOR_APPLICATION",
      subjectId: "app-1",
      newStatus: "SUBMITTED",
      chapterId: "chapter-1",
      ownerId: "user-1",
      startedById: "user-1",
    });
  });

  it("submitInstructorApplicationForExistingUser() fires ENTITY_STATUS_CHANGED for a re-application", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-2" },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      name: "Existing Applicant",
      email: "existing@example.com",
      chapterId: "chapter-2",
    } as any);
    vi.mocked((prisma as any).instructorApplication.findFirst).mockImplementation(
      (args: any) => {
        // First call: open-application guard (none open). Second call:
        // most-recent-prior-application lookup (none prior).
        return Promise.resolve(null);
      }
    );
    vi.mocked((prisma as any).instructorApplication.create).mockResolvedValue({
      id: "app-2",
    });

    const fd = makeApplicantFormData();
    fd.delete("accountType");
    fd.delete("email");
    fd.delete("password");

    const result = await submitInstructorApplicationForExistingUser(prevState, fd);

    expect(result.status).toBe("success");
    expect(mockFireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(mockFireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "INSTRUCTOR_APPLICATION",
      subjectId: "app-2",
      newStatus: "SUBMITTED",
      chapterId: "chapter-2",
      ownerId: "user-2",
      startedById: "user-2",
    });
  });
});

describe("Mentorship creation auto-start", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (prisma as any).mentorship = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "ms-1" }),
    };
    (prisma as any).mentorshipSession = {
      create: vi.fn().mockResolvedValue({ id: "session-1" }),
    };
    (prisma as any).mentorshipTrack = {
      findUnique: vi.fn().mockResolvedValue({ committees: [] }),
      findUniqueOrThrow: vi.fn(),
    };
    (prisma as any).mentorCommitteeChair = {
      findFirst: vi.fn().mockResolvedValue(null),
    };
    (prisma as any).user.findUniqueOrThrow = vi
      .fn()
      .mockResolvedValueOnce({ id: "mentor-1", name: "Mentor One" })
      .mockResolvedValueOnce({
        id: "mentee-1",
        name: "Mentee One",
        primaryRole: "INSTRUCTOR",
        chapterId: "chapter-3",
        chapter: { name: "Atlanta" },
      });
  });

  it("assignProgramMentor() fires ENTITY_STATUS_CHANGED for the new active mentorship", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);

    const fd = new FormData();
    fd.set("mentorId", "mentor-1");
    fd.set("menteeId", "mentee-1");

    await assignProgramMentor(fd);

    expect(mockFireEntityStatusChanged).toHaveBeenCalledTimes(1);
    expect(mockFireEntityStatusChanged).toHaveBeenCalledWith({
      subjectType: "MENTORSHIP",
      subjectId: "ms-1",
      newStatus: "ACTIVE",
      chapterId: "chapter-3",
      ownerId: "mentor-1",
      startedById: "admin-1",
    });
  });
});
