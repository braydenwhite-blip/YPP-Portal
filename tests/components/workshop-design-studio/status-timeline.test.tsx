import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicantStatusTimeline } from "@/app/(app)/instructor/workshop-design-studio/status-timeline";

describe("ApplicantStatusTimeline", () => {
  it("renders all five lifecycle steps", () => {
    render(<ApplicantStatusTimeline status={null} />);
    // The current step has "· now" appended; assert via substring match.
    expect(screen.getByText(/^Draft/)).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("Assigned to a camp")).toBeInTheDocument();
  });

  it("marks Draft as the current step for a brand-new submission", () => {
    render(<ApplicantStatusTimeline status="DRAFT" />);
    const current = screen.getByText((content) => content.startsWith("Draft"));
    expect(current.textContent).toMatch(/now/i);
  });

  it("marks 'In review' as current when submission is IN_REVIEW", () => {
    render(<ApplicantStatusTimeline status="IN_REVIEW" />);
    expect(screen.getByText(/^In review · now$/i)).toBeInTheDocument();
  });

  it("marks 'Assigned to a camp' as current when hasAssignment=true", () => {
    render(<ApplicantStatusTimeline status="APPROVED" hasAssignment />);
    expect(screen.getByText(/^Assigned to a camp · now$/i)).toBeInTheDocument();
  });

  it("treats CHANGES_REQUESTED as 'Draft' so the applicant knows it's back with them", () => {
    render(<ApplicantStatusTimeline status="CHANGES_REQUESTED" />);
    expect(screen.getByText(/^Draft · now$/i)).toBeInTheDocument();
  });
});
