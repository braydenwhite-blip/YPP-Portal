import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GoalsCalm } from "@/components/mentorship/calm";

describe("GoalsCalm", () => {
  it("lists active goals with a mentee-friendly rubric label and an update CTA", () => {
    render(
      <GoalsCalm
        goals={[
          { id: "g1", title: "Lead a workshop", rating: "ACHIEVED", meta: "Due Jun 30" },
          { id: "g2", title: "Mentor a peer", rating: null, meta: "in progress" },
        ]}
      />
    );

    expect(screen.getByText("Lead a workshop")).toBeInTheDocument();
    expect(screen.getByText("Mentor a peer")).toBeInTheDocument();
    expect(screen.getByText("Due Jun 30")).toBeInTheDocument();
    // Mentee audience copy for ACHIEVED comes from the shared rubric source.
    expect(screen.getByRole("link", { name: /Update progress/ })).toHaveAttribute(
      "href",
      "/my-mentor/reflection"
    );
  });

  it("shows supportive empty copy and no CTA when there are no active goals", () => {
    render(<GoalsCalm goals={[]} empty="No goals yet." />);

    expect(screen.getByText("No goals yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Update progress/ })).not.toBeInTheDocument();
  });
});
