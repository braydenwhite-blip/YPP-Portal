import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RelationshipDetailCalm } from "@/components/mentorship/calm";

describe("RelationshipDetailCalm", () => {
  it("leads with the status, the focus, and the active goals", () => {
    render(
      <RelationshipDetailCalm
        status={{ label: "Active · Review due", tone: "warning" }}
        contextLine="Mentor: Morgan · Scarsdale"
        focus={{
          eyebrow: "Review due",
          title: "Write Sam's review",
          reason: "Their reflection is in.",
          ctaLabel: "Write review",
          ctaHref: "/mentorship/reviews/u-mentee",
        }}
        goals={[{ id: "g1", title: "Lead a workshop", meta: "Latest: in progress" }]}
        commitments={[{ id: "c1", title: "Send the outline", meta: "Owner: Sam" }]}
      />
    );

    expect(screen.getByText("Active · Review due")).toBeInTheDocument();
    expect(screen.getByText("Write Sam's review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Write review/ })).toHaveAttribute(
      "href",
      "/mentorship/reviews/u-mentee"
    );
    expect(screen.getByText("Lead a workshop")).toBeInTheDocument();
    expect(screen.getByText("Send the outline")).toBeInTheDocument();
  });

  it("shows supportive empty copy when there are no goals or commitments", () => {
    render(
      <RelationshipDetailCalm
        status={{ label: "Active", tone: "success" }}
        focus={{
          eyebrow: "On track",
          title: "Stay close to Sam",
          ctaLabel: "Open G&R",
          ctaHref: "/mentorship/mentees/u-mentee/gr",
        }}
        goals={[]}
        goalsEmpty="No active goals yet."
        commitments={[]}
        commitmentsEmpty="No open commitments."
      />
    );

    expect(screen.getByText("No active goals yet.")).toBeInTheDocument();
    expect(screen.getByText("No open commitments.")).toBeInTheDocument();
  });
});
