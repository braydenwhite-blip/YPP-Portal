import { describe, expect, it } from "vitest";

import {
  mapCpStatusToBoardStatus,
  mapStaffStatusToBoardStatus,
  parseApplicantKindFilter,
  applicantDetailHref,
  isHiddenStaffPositionTitle,
  isBoardStaffPositionTitle,
} from "@/lib/applicant-board-kind";

describe("applicant-board-kind", () => {
  it("maps CP statuses onto shared board columns", () => {
    expect(mapCpStatusToBoardStatus("SUBMITTED")).toBe("SUBMITTED");
    expect(mapCpStatusToBoardStatus("INITIAL_REVIEW")).toBe("UNDER_REVIEW");
    expect(mapCpStatusToBoardStatus("INTERVIEW_NEEDED")).toBe("PRE_APPROVED");
    expect(mapCpStatusToBoardStatus("DECISION_NEEDED")).toBe("CHAIR_REVIEW");
    expect(mapCpStatusToBoardStatus("ONBOARDING")).toBe("APPROVED");
    expect(mapCpStatusToBoardStatus("DECLINED")).toBe("REJECTED");
  });

  it("maps staff Application statuses onto shared board columns", () => {
    expect(mapStaffStatusToBoardStatus("SUBMITTED")).toBe("SUBMITTED");
    expect(mapStaffStatusToBoardStatus("UNDER_REVIEW")).toBe("UNDER_REVIEW");
    expect(mapStaffStatusToBoardStatus("INTERVIEW_SCHEDULED")).toBe("INTERVIEW_SCHEDULED");
    expect(mapStaffStatusToBoardStatus("INTERVIEW_COMPLETED")).toBe("INTERVIEW_COMPLETED");
    expect(mapStaffStatusToBoardStatus("ACCEPTED")).toBe("APPROVED");
    expect(mapStaffStatusToBoardStatus("REJECTED")).toBe("REJECTED");
    expect(mapStaffStatusToBoardStatus("WITHDRAWN")).toBe("REJECTED");
  });

  it("parses kind filter from URL", () => {
    expect(parseApplicantKindFilter(undefined)).toBe("all");
    expect(parseApplicantKindFilter("cp")).toBe("cp");
    expect(parseApplicantKindFilter("instructor")).toBe("instructor");
    expect(parseApplicantKindFilter("chapter-president")).toBe("cp");
    expect(parseApplicantKindFilter("staff")).toBe("staff");
    expect(parseApplicantKindFilter("smm")).toBe("staff");
  });

  it("routes detail pages by kind", () => {
    expect(applicantDetailHref("instructor", "a1")).toBe("/admin/instructor-applicants/a1");
    expect(applicantDetailHref("cp", "c1")).toBe("/admin/chapter-president-applicants/c1");
    expect(applicantDetailHref("staff", "s1")).toBe("/applications/s1");
  });

  it("hides Technology Manager and keeps Social Media Manager on the board", () => {
    expect(isHiddenStaffPositionTitle("Technology Manager")).toBe(true);
    expect(isHiddenStaffPositionTitle("technology manager")).toBe(true);
    expect(isHiddenStaffPositionTitle("Social Media Manager")).toBe(false);
    expect(isBoardStaffPositionTitle("Social Media Manager")).toBe(true);
    expect(isBoardStaffPositionTitle("Technology Manager")).toBe(false);
  });
});
