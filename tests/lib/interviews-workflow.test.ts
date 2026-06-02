import { describe, expect, it } from "vitest";

import {
  buildHiringInterviewTask,
  buildReadinessInterviewTask,
} from "@/lib/interviews/workflow";

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

  it("flags hiring candidates who have no interview times sent yet", () => {
    const task = buildHiringInterviewTask({
      applicationId: "app-2",
      applicantName: "Ben",
      positionTitle: "Mentor",
      chapterName: "Boston",
      interviewRequired: true,
      submittedAt: new Date("2026-03-18T14:00:00.000Z"),
      slots: [],
      notes: [],
      decisionAccepted: null,
      audience: "team",
      viewerRole: "reviewer",
    });

    expect(task.schedulingStatus?.state).toBe("AWAITING_TIMES");
    expect(task.schedulingStatus?.label).toBe("No times sent yet");
    expect(task.schedulingStatus?.sentToName).toBe("Ben");
  });

  it("shows who sent the times when a candidate is waiting to confirm", () => {
    const task = buildHiringInterviewTask({
      applicationId: "app-3",
      applicantName: "Cara",
      positionTitle: "Mentor",
      chapterName: "Chicago",
      interviewRequired: true,
      submittedAt: new Date("2026-03-18T14:00:00.000Z"),
      slots: [
        {
          id: "slot-1",
          status: "POSTED",
          scheduledAt: new Date("2026-03-25T15:00:00.000Z"),
          createdAt: new Date("2026-03-19T09:00:00.000Z"),
          postedByName: "Reviewer Rao",
        },
        {
          id: "slot-2",
          status: "POSTED",
          scheduledAt: new Date("2026-03-26T15:00:00.000Z"),
          createdAt: new Date("2026-03-19T09:00:00.000Z"),
          postedByName: "Reviewer Rao",
        },
      ],
      notes: [],
      decisionAccepted: null,
      audience: "team",
      viewerRole: "reviewer",
    });

    expect(task.stage).toBe("BLOCKED");
    expect(task.schedulingStatus?.state).toBe("TIMES_SENT");
    expect(task.schedulingStatus?.sentByName).toBe("Reviewer Rao");
    expect(task.schedulingStatus?.sentToName).toBe("Cara");
    expect(task.schedulingStatus?.slotCount).toBe(2);
  });

  it("marks a readiness candidate as waiting once a reviewer posts a slot", () => {
    const task = buildReadinessInterviewTask({
      gateId: "gate-1",
      instructorId: "ins-1",
      instructorName: "Dana",
      chapterName: "Denver",
      gateStatus: "REQUIRED",
      outcome: null,
      slots: [
        {
          id: "rslot-1",
          status: "POSTED",
          scheduledAt: new Date("2026-03-25T15:00:00.000Z"),
          createdAt: new Date("2026-03-19T09:00:00.000Z"),
          postedByName: "Lead Lopez",
        },
      ],
      pendingRequests: [],
      audience: "team",
      viewerRole: "reviewer",
    });

    expect(task.stage).toBe("BLOCKED");
    expect(task.schedulingStatus?.state).toBe("TIMES_SENT");
    expect(task.schedulingStatus?.sentByName).toBe("Lead Lopez");
    expect(task.schedulingStatus?.sentToName).toBe("Dana");
  });
});
