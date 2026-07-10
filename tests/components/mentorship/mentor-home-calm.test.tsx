import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MentorHomeCalm } from "@/app/(app)/mentorship/_components/mentor-home-calm";
import { buildMentorHomeViewModel } from "@/lib/mentorship/load";

const NOW = new Date("2026-06-16T12:00:00.000Z");

function vmWith(cards: Parameters<typeof buildMentorHomeViewModel>[0]["cards"]) {
  return buildMentorHomeViewModel({
    viewerId: "u-mentor",
    viewerName: "You",
    cards,
    sessions: [],
    now: NOW,
  });
}

describe("MentorHomeCalm", () => {
  it("renders the focus and the mentee list", () => {
    const vm = vmWith([
      {
        mentorshipId: "m1",
        menteeId: "u-mentee",
        menteeName: "Sam Mentee",
        cycleStage: "REFLECTION_SUBMITTED",
        kickoffPending: false,
        latestRatings: ["ACHIEVED"],
      },
    ]);

    render(<MentorHomeCalm vm={vm} needsYouCount={1} />);

    // Focus card leads with the single next move.
    expect(screen.getByText("Review Sam Mentee")).toBeInTheDocument();
    // Short roster shows the mentee.
    expect(screen.getByText("Your mentees")).toBeInTheDocument();
    expect(screen.getByText("Sam Mentee")).toBeInTheDocument();
    // Quiet action strip is present.
    expect(screen.getByRole("link", { name: /Schedule/ })).toBeInTheDocument();
  });

  it("shows a caught-up empty state when nothing is waiting", () => {
    const vm = vmWith([
      {
        mentorshipId: "m1",
        menteeId: "u-mentee",
        menteeName: "Sam Mentee",
        cycleStage: "APPROVED",
        kickoffPending: false,
        latestRatings: [],
      },
    ]);

    render(<MentorHomeCalm vm={vm} needsYouCount={0} />);

    expect(screen.getByText(/caught up/i)).toBeInTheDocument();
  });

  it("no longer links a separate review inbox — approvals render on the Mentorship home itself", () => {
    const vm = vmWith([]);
    render(<MentorHomeCalm vm={vm} needsYouCount={0} />);
    expect(screen.queryByRole("link", { name: /Monthly reviews/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Schedule/ })).toHaveAttribute(
      "href",
      "/mentorship/schedule"
    );
  });
});
