import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mentorship-2/recommendations/actions", () => ({
  approveRecommendation: vi.fn(),
  generateRecommendationsForApplication: vi.fn(),
}));

import { ApplicationMatchCalm } from "@/components/mentorship-2/application-match-calm";
import type { RecommendationCard } from "@/components/mentorship-2/matching-recommendations";

function card(overrides: Partial<RecommendationCard> = {}): RecommendationCard {
  return {
    id: "rec-1",
    status: "SUGGESTED",
    score: 82,
    mentorName: "Morgan Mentor",
    mentorEmail: "morgan@example.com",
    mentorExpertise: [],
    mentorCapacity: 3,
    mentorLoad: 1,
    adminNote: null,
    explanation: "Strong expertise overlap and open capacity.",
    strengths: [],
    risks: [],
    ...overrides,
  };
}

describe("ApplicationMatchCalm", () => {
  it("prompts to generate recommendations when none exist yet", () => {
    render(
      <ApplicationMatchCalm applicationId="app-1" top={null} applicationOpen usableMatch={false} />
    );
    expect(screen.getByText("Generate scored mentor recommendations")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generate recommendations/ })
    ).toBeInTheDocument();
  });

  it("leads with approve when there is a usable top match", () => {
    render(
      <ApplicationMatchCalm applicationId="app-1" top={card()} applicationOpen usableMatch />
    );
    expect(screen.getByText(/Approve top match: Morgan Mentor/)).toBeInTheDocument();
    expect(screen.getByText(/score 82/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve match/ })).toBeInTheDocument();
  });

  it("does not offer approve when the best candidate is below threshold", () => {
    render(
      <ApplicationMatchCalm
        applicationId="app-1"
        top={card({ score: 20 })}
        applicationOpen
        usableMatch={false}
      />
    );
    expect(screen.getByText(/No strong match yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve match/ })).not.toBeInTheDocument();
    expect(screen.getByText(/below the usable-match threshold/)).toBeInTheDocument();
  });

  it("says nothing is needed for a closed application", () => {
    render(
      <ApplicationMatchCalm
        applicationId="app-1"
        top={card({ status: "APPROVED" })}
        applicationOpen={false}
        usableMatch
      />
    );
    expect(screen.getByText(/This application is closed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve match/ })).not.toBeInTheDocument();
  });
});
