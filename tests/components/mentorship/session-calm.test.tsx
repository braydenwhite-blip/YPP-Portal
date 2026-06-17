import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  SessionFocusCard,
  SessionPrepChecklist,
} from "@/components/mentorship/calm";

const SOON = new Date(Date.now() + 2 * 86_400_000).toISOString();

describe("SessionFocusCard", () => {
  it("offers a join link when a meeting link exists", () => {
    render(
      <SessionFocusCard
        title="April momentum check-in"
        whenISO={SOON}
        type="CHECK_IN"
        meetingLink="https://meet.example.com/abc"
      />
    );
    expect(screen.getByText("April momentum check-in")).toBeInTheDocument();
    expect(screen.getByText(/Check-in/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Join session/ })).toHaveAttribute(
      "href",
      "https://meet.example.com/abc"
    );
  });

  it("reassures when no link is shared yet", () => {
    render(<SessionFocusCard title="Kickoff" whenISO={SOON} type="KICKOFF" meetingLink={null} />);
    expect(screen.queryByRole("link", { name: /Join session/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Link shared before the session/)).toBeInTheDocument();
  });
});

describe("SessionPrepChecklist", () => {
  it("renders the prep items and a link to the review", () => {
    render(<SessionPrepChecklist reviewHref="/my-mentor/goals" />);
    expect(screen.getByText("Come prepared")).toBeInTheDocument();
    expect(screen.getByText(/Bring one question/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open your goals & review/ })).toHaveAttribute(
      "href",
      "/my-mentor/goals"
    );
  });

  it("accepts custom items", () => {
    render(<SessionPrepChecklist items={["Only this item"]} />);
    expect(screen.getByText("Only this item")).toBeInTheDocument();
    expect(screen.queryByText(/Bring one question/)).not.toBeInTheDocument();
  });
});
