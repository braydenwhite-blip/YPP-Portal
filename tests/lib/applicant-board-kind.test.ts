import { describe, expect, it } from "vitest";

import {
  mapCpStatusToBoardStatus,
  parseApplicantKindFilter,
  applicantDetailHref,
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

  it("parses kind filter from URL", () => {
    expect(parseApplicantKindFilter(undefined)).toBe("both");
    expect(parseApplicantKindFilter("cp")).toBe("cp");
    expect(parseApplicantKindFilter("instructor")).toBe("instructor");
    expect(parseApplicantKindFilter("chapter-president")).toBe("cp");
  });

  it("routes detail pages by kind", () => {
    expect(applicantDetailHref("instructor", "a1")).toBe("/admin/instructor-applicants/a1");
    expect(applicantDetailHref("cp", "c1")).toBe("/admin/chapter-president-applicants/c1");
  });
});
