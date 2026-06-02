import { describe, expect, it } from "vitest";
import {
  canManageQaInstructorOnboarding,
  getQaInstructorOnboardingEmail,
  isQaInstructorOnboardingEnabled,
} from "@/lib/qa-instructor-onboarding";

describe("QA instructor onboarding guard", () => {
  it("is disabled unless the environment opts in", () => {
    expect(isQaInstructorOnboardingEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isQaInstructorOnboardingEnabled({
        ENABLE_QA_INSTRUCTOR_ONBOARDING: "true",
      } as NodeJS.ProcessEnv)
    ).toBe(true);
  });

  it("uses the default QA instructor email unless overridden", () => {
    expect(getQaInstructorOnboardingEmail({} as NodeJS.ProcessEnv)).toBe(
      "qa.instructor.onboarding@youthpassionproject.org"
    );
    expect(
      getQaInstructorOnboardingEmail({
        QA_INSTRUCTOR_ONBOARDING_EMAIL: "Custom.QA@Example.test",
      } as NodeJS.ProcessEnv)
    ).toBe("custom.qa@example.test");
  });

  it("allows only the QA instructor account or admins when enabled", () => {
    const env = {
      ENABLE_QA_INSTRUCTOR_ONBOARDING: "true",
    } as NodeJS.ProcessEnv;

    expect(
      canManageQaInstructorOnboarding(
        {
          id: "qa",
          email: "qa.instructor.onboarding@youthpassionproject.org",
          roles: ["INSTRUCTOR"],
          primaryRole: "INSTRUCTOR",
        },
        env
      )
    ).toBe(true);

    expect(
      canManageQaInstructorOnboarding(
        {
          id: "admin",
          email: "admin@example.test",
          roles: ["ADMIN"],
          primaryRole: "ADMIN",
        },
        env
      )
    ).toBe(true);

    expect(
      canManageQaInstructorOnboarding(
        {
          id: "instructor",
          email: "avery@example.test",
          roles: ["INSTRUCTOR"],
          primaryRole: "INSTRUCTOR",
        },
        env
      )
    ).toBe(false);
  });

  it("rejects everybody when disabled", () => {
    const env = {
      ENABLE_QA_INSTRUCTOR_ONBOARDING: "false",
    } as NodeJS.ProcessEnv;

    expect(
      canManageQaInstructorOnboarding(
        {
          id: "qa",
          email: "qa.instructor.onboarding@youthpassionproject.org",
          roles: ["ADMIN"],
          primaryRole: "ADMIN",
        },
        env
      )
    ).toBe(false);
  });
});
