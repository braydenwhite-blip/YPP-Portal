import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Keep the test light: the component only wires the status action onto
// <form action>, it never invokes it on render.
vi.mock("@/lib/mentorship-hub-actions", () => ({
  updateMentorshipActionItemStatus: vi.fn(),
}));

import { CommitmentsCalm } from "@/components/mentorship/calm";

describe("CommitmentsCalm", () => {
  it("offers completion on an open commitment", () => {
    render(
      <CommitmentsCalm
        commitments={[
          { id: "c1", title: "Send the workshop outline", ownerName: "Sam", dueLabel: "Due Jun 30" },
        ]}
      />
    );

    expect(screen.getByText("Send the workshop outline")).toBeInTheDocument();
    expect(screen.getByText(/Owner: Sam · Due Jun 30/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark complete/ })).toBeInTheDocument();
    // The one-click "convert to Action" bridge is gone — next steps are canonical.
    expect(screen.queryByRole("button", { name: /Create Action/ })).not.toBeInTheDocument();
  });

  it("shows a Tracked badge for an already-bridged legacy row; completion stays available", () => {
    render(<CommitmentsCalm commitments={[{ id: "c1", title: "Draft the deck", linked: true }]} />);

    expect(screen.getByText("Tracked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark complete/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Action/ })).not.toBeInTheDocument();
  });

  it("flags overdue commitments and shows supportive empty copy", () => {
    const { rerender } = render(
      <CommitmentsCalm commitments={[{ id: "c1", title: "Overdue thing", overdue: true }]} />
    );
    expect(screen.getByText("Overdue")).toBeInTheDocument();

    rerender(<CommitmentsCalm commitments={[]} empty="Nothing open." />);
    expect(screen.getByText("Nothing open.")).toBeInTheDocument();
  });
});
