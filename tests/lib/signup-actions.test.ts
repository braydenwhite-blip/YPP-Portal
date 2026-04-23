import { beforeEach, describe, expect, it, vi } from "vitest";

import { signUp } from "@/lib/signup-actions";
import { pickFormFields } from "@/lib/signup-form-utils";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";

// Mocks for modules not covered by the global setup
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

// ── pickFormFields unit tests ─────────────────────────────────────────────────

describe("pickFormFields", () => {
  it("includes all non-secret string fields", () => {
    const fd = new FormData();
    fd.set("legalName", "Test User");
    fd.set("email", "test@example.com");
    fd.set("city", "Phoenix");

    const result = pickFormFields(fd);

    expect(result.legalName).toBe("Test User");
    expect(result.email).toBe("test@example.com");
    expect(result.city).toBe("Phoenix");
  });

  it("excludes password and passwordConfirm", () => {
    const fd = new FormData();
    fd.set("legalName", "Test User");
    fd.set("password", "secret123");
    fd.set("passwordConfirm", "secret123");

    const result = pickFormFields(fd);

    expect(result.password).toBeUndefined();
    expect(result.passwordConfirm).toBeUndefined();
    expect(result.legalName).toBe("Test User");
  });

  it("omits File entries", () => {
    const fd = new FormData();
    fd.set("name", "Alice");
    fd.set("resume", new File(["content"], "resume.pdf", { type: "application/pdf" }));

    const result = pickFormFields(fd);

    expect(result.name).toBe("Alice");
    expect(result.resume).toBeUndefined();
  });
});

// ── signUp integration: validation error repopulates fields ───────────────────

describe("signUp — validation failure returns fields", () => {
  const prevState = { status: "idle" as const, message: "" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeValidFormData(): FormData {
    const fd = new FormData();
    fd.set("accountType", "APPLICANT");
    fd.set("name", "Test User");
    fd.set("email", "test@example.com");
    fd.set("password", "Password1");
    fd.set("chapterId", "");
    fd.set("legalName", "Test User");
    fd.set("preferredFirstName", "Test");
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
    // teachingExperience intentionally omitted to trigger validation failure
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

  it("returns status error and fields when a required field is missing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const fd = makeValidFormData();
    // teachingExperience is missing — Zod requires min 50 chars

    const result = await signUp(prevState, fd);

    expect(result.status).toBe("error");
    expect(result.fields).toBeDefined();
  });

  it("echoes legalName in fields but omits password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const fd = makeValidFormData();
    // teachingExperience missing — triggers validation error before prisma is called

    const result = await signUp(prevState, fd);

    expect(result.status).toBe("error");
    expect(result.fields?.legalName).toBe("Test User");
    expect(result.fields?.password).toBeUndefined();
  });

  it("echoes all section-5 fields (availability, hoursPerWeek) in the error response", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const fd = makeValidFormData();

    const result = await signUp(prevState, fd);

    expect(result.status).toBe("error");
    expect(result.fields?.availability).toBe("Weekday evenings, EST");
    expect(result.fields?.hoursPerWeek).toBe("5");
    expect(result.fields?.city).toBe("Phoenix");
    expect(result.fields?.schoolName).toBe("Central High");
  });

  it("does not expose passwordConfirm in the error response", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const fd = makeValidFormData();
    fd.set("passwordConfirm", "Password1");

    const result = await signUp(prevState, fd);

    expect(result.fields?.passwordConfirm).toBeUndefined();
  });
});
