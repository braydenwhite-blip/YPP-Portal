import { describe, expect, it } from "vitest";

import { getLegacyApplicationTransitionError } from "@/lib/legacy-application-review";

describe("legacy-application-review", () => {
  it("blocks interview completion before an interview is scheduled", () => {
    expect(
      getLegacyApplicationTransitionError({
        status: "UNDER_REVIEW",
        action: "mark_interview_complete",
      })
    ).toBe("Only scheduled interviews can be marked complete.");
  });

  it("blocks approval until the interview is complete", () => {
    expect(
      getLegacyApplicationTransitionError({
        status: "INTERVIEW_SCHEDULED",
        action: "approve",
      })
    ).toBe("Complete the interview before approving this application.");
  });

  it("blocks all further actions after the application is finalized", () => {
    expect(
      getLegacyApplicationTransitionError({
        status: "APPROVED",
        action: "reject",
      })
    ).toBe("This application is already finalized.");
  });
});
