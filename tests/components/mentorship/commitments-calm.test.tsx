import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Keep the test light: the component only wires these server actions onto
// <form action>, it never invokes them on render.
vi.mock("@/lib/mentorship-hub-actions", () => ({
  updateMentorshipActionItemStatus: vi.fn(),
  convertMentorshipCommitmentToAction: vi.fn(),
}));

import { CommitmentsCalm } from "@/components/mentorship/calm";

describe("CommitmentsCalm", () => {
  it("offers complete and convert on an open commitment when the viewer can convert", () => {
    render(
      <CommitmentsCalm
        canConvert
        commitments={[
          { id: "c1", title: "Send the workshop outline", ownerName: "Sam", dueLabel: "Due Jun 30" },
        ]}
      />
    );

    expect(screen.getByText("Send the workshop outline")).toBeInTheDocument();
    expect(screen.getByText(/Owner: Sam · Due Jun 30/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark complete/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Action/ })).toBeInTheDocument();
  });

  it("hides the convert button and shows a Tracked badge once bridged", () => {
    render(
      <CommitmentsCalm
        canConvert
        commitments={[{ id: "c1", title: "Draft the deck", linked: true }]}
      />
    );

    expect(screen.getByText("Tracked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Action/ })).not.toBeInTheDocument();
    // Completion stays available even after bridging.
    expect(screen.getByRole("button", { name: /Mark complete/ })).toBeInTheDocument();
  });

  it("never offers convert when the viewer cannot create org Actions", () => {
    render(
      <CommitmentsCalm
        canConvert={false}
        commitments={[{ id: "c1", title: "Follow up with the chapter" }]}
      />
    );

    expect(screen.queryByRole("button", { name: /Create Action/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark complete/ })).toBeInTheDocument();
  });

  it("flags overdue commitments and shows supportive empty copy", () => {
    const { rerender } = render(
      <CommitmentsCalm canConvert commitments={[{ id: "c1", title: "Overdue thing", overdue: true }]} />
    );
    expect(screen.getByText("Overdue")).toBeInTheDocument();

    rerender(<CommitmentsCalm canConvert commitments={[]} empty="Nothing open." />);
    expect(screen.getByText("Nothing open.")).toBeInTheDocument();
  });
});
