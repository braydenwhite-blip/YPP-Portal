import { describe, expect, it } from "vitest";

import {
  archiveReasonLabel,
  deriveArchiveReason,
  terminalArchiveReasonForStatus,
  APPLICANT_ARCHIVE_REASONS,
  INACTIVITY_ARCHIVE_DAYS,
  INACTIVITY_NUDGE_DAYS,
} from "@/lib/applicant-archive";

describe("applicant-archive", () => {
  it("labels known archive reasons", () => {
    expect(archiveReasonLabel(APPLICANT_ARCHIVE_REASONS.INACTIVE_14D)).toMatch(/Inactive/i);
    expect(archiveReasonLabel(APPLICANT_ARCHIVE_REASONS.REJECTED)).toBe("Rejected");
  });

  it("derives reason from status when archiveReason is missing", () => {
    expect(deriveArchiveReason({ status: "REJECTED" })).toBe("REJECTED");
    expect(deriveArchiveReason({ status: "APPROVED" })).toBe("APPROVED");
    expect(
      deriveArchiveReason({ status: "CHAIR_REVIEW", chairAction: "WAITLIST" })
    ).toBe("WAITLISTED");
    expect(deriveArchiveReason({ status: "UNDER_REVIEW" })).toBe("MANUAL");
  });

  it("maps terminal statuses for the 30-day sweep", () => {
    expect(terminalArchiveReasonForStatus("REJECTED")).toBe("REJECTED");
    expect(terminalArchiveReasonForStatus("APPROVED")).toBe("APPROVED");
    expect(terminalArchiveReasonForStatus("WITHDRAWN")).toBe("WITHDRAWN");
  });

  it("uses a 14-day inactivity window with 3/7/14 nudges", () => {
    expect(INACTIVITY_ARCHIVE_DAYS).toBe(14);
    expect([...INACTIVITY_NUDGE_DAYS]).toEqual([3, 7, 14]);
  });
});
