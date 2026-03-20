import { describe, expect, it } from "vitest";

import { buildHiringInterviewTask } from "@/lib/interviews/workflow";

describe("interviews workflow", () => {
  it("tells applicants when a role skips interviews instead of saying they are waiting", () => {
    const task = buildHiringInterviewTask({
      applicationId: "app-1",
      applicantName: "Ava",
      positionTitle: "Chapter Coordinator",
      chapterName: "Atlanta",
      interviewRequired: false,
      submittedAt: new Date("2026-03-18T14:00:00.000Z"),
      slots: [],
      notes: [],
      decisionAccepted: null,
      audience: "mine",
      viewerRole: "applicant",
    });

    expect(task.stage).toBe("COMPLETED");
    expect(task.subtitle).toContain("Interview not required");
    expect(task.detail).toBe(
      "This application can move straight to review and decision."
    );
    expect(task.primaryAction).toEqual({
      kind: "open_details",
      label: "View Application Status",
      href: "/applications/app-1",
    });
  });
});
