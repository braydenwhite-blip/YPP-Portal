import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ApplicantNextActionBar from "@/components/instructor-applicants/ApplicantNextActionBar";

vi.mock("@/lib/instructor-application-actions", () => ({
  assignReviewer: vi.fn(),
  sendToChair: vi.fn(),
  completeInterviewStage: vi.fn(),
}));

function baseApplication() {
  return {
    id: "app-1",
    status: "CHAIR_REVIEW" as const,
    reviewerId: "reviewer-1",
    materialsReadyAt: null,
    interviewScheduledAt: null,
    leadReviewNextStep: null,
    interviewerAssignments: [],
  };
}

describe("ApplicantNextActionBar", () => {
  it("routes chair decisions to the canonical final review cockpit", () => {
    render(
      <ApplicantNextActionBar
        application={baseApplication()}
        canAssignReviewer={false}
        canAssignInterviewers={false}
        isAssignedReviewer={false}
        isAssignedInterviewer={false}
        isAssignedLeadInterviewer={false}
        canActAsChair
        canSendToChair={false}
        isAdmin
      />
    );

    expect(screen.getByRole("link", { name: "Make Decision" })).toHaveAttribute(
      "href",
      "/admin/instructor-applicants/app-1/review"
    );
  });

  it("offers 'Mark Interview Complete' once a scheduled interview has a confirmed time", () => {
    render(
      <ApplicantNextActionBar
        application={{
          ...baseApplication(),
          status: "INTERVIEW_SCHEDULED" as const,
          interviewScheduledAt: new Date("2026-06-01T15:00:00Z"),
        }}
        canAssignReviewer={false}
        canAssignInterviewers={false}
        isAssignedReviewer
        isAssignedInterviewer={false}
        isAssignedLeadInterviewer={false}
        canActAsChair={false}
        canSendToChair={false}
        isAdmin={false}
      />
    );

    expect(
      screen.getByRole("button", { name: "Mark Interview Complete" })
    ).toBeInTheDocument();
  });

  it("does not offer completion until the applicant has confirmed a time", () => {
    render(
      <ApplicantNextActionBar
        application={{
          ...baseApplication(),
          status: "INTERVIEW_SCHEDULED" as const,
          interviewScheduledAt: null,
        }}
        canAssignReviewer={false}
        canAssignInterviewers={false}
        isAssignedReviewer
        isAssignedInterviewer={false}
        isAssignedLeadInterviewer={false}
        canActAsChair={false}
        canSendToChair={false}
        isAdmin={false}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Mark Interview Complete" })
    ).not.toBeInTheDocument();
  });
});
