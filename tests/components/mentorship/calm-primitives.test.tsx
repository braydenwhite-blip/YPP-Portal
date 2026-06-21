import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ColorStatusChip,
  MentorshipFocusCard,
  MentorshipRow,
} from "@/components/mentorship/calm";
import type {
  MentorshipRelationshipSummary,
  NextMentorshipFocus,
} from "@/lib/mentorship/view-model";

describe("ColorStatusChip", () => {
  it("renders the operational label for mentor/admin audiences", () => {
    render(<ColorStatusChip rating="ACHIEVED" />);
    expect(screen.getByText("Achieved")).toBeInTheDocument();
  });

  it("renders nothing when there is no rating", () => {
    const { container } = render(<ColorStatusChip rating={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses supportive copy for the mentee audience", () => {
    render(<ColorStatusChip rating="BEHIND_SCHEDULE" audience="mentee" />);
    expect(screen.getByText("Needs focused support")).toBeInTheDocument();
  });
});

describe("MentorshipFocusCard", () => {
  const focus: NextMentorshipFocus = {
    kind: "kickoff",
    relationshipId: "m1",
    title: "Kick off with Sam",
    reason: "Hold the kickoff to start this mentorship.",
    ctaLabel: "Plan kickoff",
    ctaHref: "/mentorship/mentees/m1",
    tone: "brand",
    inline: null,
  };

  it("renders the focus title and routes the CTA", () => {
    render(<MentorshipFocusCard focus={focus} />);
    expect(screen.getByText("Kick off with Sam")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /Plan kickoff/ });
    expect(cta).toHaveAttribute("href", "/mentorship/mentees/m1");
  });
});

describe("MentorshipRow", () => {
  function summary(
    overrides: Partial<MentorshipRelationshipSummary> = {}
  ): MentorshipRelationshipSummary {
    return {
      id: "m1",
      mentorId: "u-mentor",
      mentorName: "Morgan Mentor",
      menteeId: "u-mentee",
      menteeName: "Sam Mentee",
      viewerRole: "mentor",
      status: "ACTIVE",
      cycleStage: "REFLECTION_DUE",
      cycleNumber: 3,
      colorStatus: "ACHIEVED",
      href: "/mentorship/mentees/m1",
      ...overrides,
    };
  }

  it("shows the mentee + rubric status for a mentor viewer", () => {
    render(<MentorshipRow relationship={summary()} />);
    expect(screen.getByText("Sam Mentee")).toBeInTheDocument();
    expect(screen.getByText("Achieved")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/mentorship/mentees/m1");
  });

  it("shows the mentor for a mentee viewer", () => {
    render(
      <MentorshipRow relationship={summary({ viewerRole: "mentee", href: "/my-mentor" })} />
    );
    expect(screen.getByText("Morgan Mentor")).toBeInTheDocument();
  });
});
