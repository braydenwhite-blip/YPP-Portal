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
        mentorCheckInComplete: true,
        latestRatings: ["ACHIEVED"],
      },
    ]);

    render(<MentorHomeCalm vm={vm} needsYouCount={1} />);

    expect(screen.getByText("Send feedback for Sam Mentee")).toBeInTheDocument();
    expect(screen.getByText("Your mentees")).toBeInTheDocument();
    expect(screen.getByText("Sam Mentee")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Schedule/ })).toBeNull();
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

  it("does not link a separate review inbox — approvals live on Mentorship home", () => {
    const vm = vmWith([]);
    render(<MentorHomeCalm vm={vm} needsYouCount={0} />);
    expect(screen.queryByRole("link", { name: /Monthly reviews/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Feedback$/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Schedule/ })).toBeNull();
  });
});
