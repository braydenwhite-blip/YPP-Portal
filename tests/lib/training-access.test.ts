import { describe, expect, it } from "vitest";
import {
  canAccessTrainingLearnerActions,
  getTrainingAccessRedirect,
  hasApprovedInstructorTrainingAccess,
} from "@/lib/training-access";

describe("training access", () => {
  it("keeps applicants out of instructor training before approval", () => {
    expect(hasApprovedInstructorTrainingAccess(["APPLICANT"])).toBe(false);
    expect(canAccessTrainingLearnerActions(["APPLICANT"])).toBe(false);
    expect(getTrainingAccessRedirect(["APPLICANT"])).toBe("/application-status");
  });

  it("allows approved instructor roles into instructor training", () => {
    expect(hasApprovedInstructorTrainingAccess(["INSTRUCTOR"])).toBe(true);
    expect(hasApprovedInstructorTrainingAccess(["CHAPTER_PRESIDENT"])).toBe(true);
    expect(hasApprovedInstructorTrainingAccess(["ADMIN"])).toBe(true);
  });

  it("preserves student access to learner training actions", () => {
    expect(canAccessTrainingLearnerActions(["STUDENT"])).toBe(true);
    expect(hasApprovedInstructorTrainingAccess(["STUDENT"])).toBe(false);
  });
});
