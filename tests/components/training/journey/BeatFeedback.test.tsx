/**
 * BeatFeedback — cinematic phasing tests.
 *
 * These tests run under `prefers-reduced-motion: reduce` so the phase
 * timers collapse to a single render. We avoid fake timers / animation
 * mocking and just assert that the right pieces show up for each
 * authored field combination.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { BeatFeedback } from "@/components/training/journey/beats/BeatFeedback";
import { MotionProvider } from "@/components/training/journey/MotionProvider";
import type { BeatFeedback as BeatFeedbackType } from "@/lib/training-journey/types";

// Force the reduced-motion path so phase timers fast-resolve and we can
// snapshot the final DOM in a single render. MotionProvider now derives its
// decision from the in-app motion preference, so mock that resolver.
vi.mock("@/lib/motion-preference", async () => {
  const actual = await vi.importActual<typeof import("@/lib/motion-preference")>(
    "@/lib/motion-preference"
  );
  return {
    ...actual,
    useResolvedReducedMotion: () => true,
  };
});

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

function withProvider(ui: React.ReactNode) {
  return render(<MotionProvider>{ui}</MotionProvider>);
}

const baseFeedback: BeatFeedbackType = {
  tone: "incorrect",
  headline: "Test headline",
  body: "Test body",
};

describe("BeatFeedback — cinematic phasing", () => {
  it("renders only mentor analysis when no simulation fields are authored", () => {
    withProvider(<BeatFeedback feedback={baseFeedback} />);

    expect(screen.getByText("Test headline")).toBeInTheDocument();
    expect(screen.getByText("Test body")).toBeInTheDocument();
    expect(screen.queryByText(/Live in the room/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Mentor aside/i)).not.toBeInTheDocument();
  });

  it("renders mentor aside when authored", () => {
    withProvider(
      <BeatFeedback
        feedback={{ ...baseFeedback, mentorAside: "Watch this." }}
      />
    );

    expect(screen.getByLabelText(/Mentor aside: Watch this/i)).toBeInTheDocument();
    expect(screen.getByText("Watch this.")).toBeInTheDocument();
  });

  it("renders student reaction with quote, body language, and peer ripple", () => {
    withProvider(
      <BeatFeedback
        feedback={{
          ...baseFeedback,
          studentReaction: {
            studentName: "Maya",
            archetype: "shy",
            mood: "shutdown",
            quote: "…",
            bodyLanguage: "stares at her hands",
          },
          peerRipple: "Two cameras flicker on.",
          consequence: "Maya freezes.",
        }}
      />
    );

    // Focal student name appears in the room-reaction bio
    const nameNode = document.querySelector(".room-reaction__name");
    expect(nameNode?.textContent).toContain("Maya");
    expect(screen.getByText("stares at her hands")).toBeInTheDocument();
    expect(screen.getByText(/Two cameras flicker on/)).toBeInTheDocument();
    expect(screen.getByText(/Maya freezes/)).toBeInTheDocument();
    // mood label rendered next to the name
    expect(screen.getByText(/shutting down/)).toBeInTheDocument();
  });

  it("renders the recovery prompt only on incorrect feedback when authored", () => {
    withProvider(
      <BeatFeedback
        feedback={{
          ...baseFeedback,
          tone: "incorrect",
          recoveryPrompt: {
            question: "What now?",
            options: [
              { id: "a", label: "Option A", reaction: "Reaction A" },
              { id: "b", label: "Option B", reaction: "Reaction B" },
            ],
          },
        }}
      />
    );

    expect(screen.getByText("What now?")).toBeInTheDocument();
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("does NOT render the recovery prompt on correct feedback even if authored", () => {
    withProvider(
      <BeatFeedback
        feedback={{
          ...baseFeedback,
          tone: "correct",
          recoveryPrompt: {
            question: "What now?",
            options: [
              { id: "a", label: "Option A", reaction: "Reaction A" },
              { id: "b", label: "Option B", reaction: "Reaction B" },
            ],
          },
        }}
      />
    );

    expect(screen.queryByText("What now?")).not.toBeInTheDocument();
  });

  it("auto-infers an ambient line from a high-magnitude roomDelta when none authored", () => {
    withProvider(
      <BeatFeedback
        feedback={{
          ...baseFeedback,
          tone: "incorrect",
          consequence: "Big consequence",
          roomDelta: { engagement: -2, clarity: -2, energy: -2 },
        }}
      />
    );

    // The auto-inferred line should mention the room cooling.
    expect(screen.getByText(/room cools/i)).toBeInTheDocument();
  });

  it("does not render an ambient line when roomDelta is small", () => {
    withProvider(
      <BeatFeedback
        feedback={{
          ...baseFeedback,
          tone: "incorrect",
          consequence: "Quiet consequence",
          roomDelta: { engagement: -1 },
        }}
      />
    );

    expect(screen.queryByText(/room cools/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/room exhales/i)).not.toBeInTheDocument();
  });

  it("renders the picked author-supplied ambient line over the auto-inferred one", () => {
    withProvider(
      <BeatFeedback
        feedback={{
          ...baseFeedback,
          tone: "correct",
          ambientLine: "Custom atmospheric line.",
          roomDelta: { engagement: 2, clarity: 2, energy: 2 },
        }}
      />
    );

    expect(screen.getByText("Custom atmospheric line.")).toBeInTheDocument();
    expect(screen.queryByText(/room exhales/i)).not.toBeInTheDocument();
  });

  it("uses a stable mentor opener for a given headline (deterministic by hash)", () => {
    const { rerender } = withProvider(
      <BeatFeedback
        feedback={{ ...baseFeedback, tone: "correct", headline: "Stable headline" }}
      />
    );

    const firstOpener = screen
      .getByRole("status")
      .querySelector(".beat-feedback__opener")?.textContent;

    expect(firstOpener).toBeTruthy();

    // Rerender with the same headline; the opener must be the same.
    rerender(
      <MotionProvider>
        <BeatFeedback
          feedback={{ ...baseFeedback, tone: "correct", headline: "Stable headline" }}
        />
      </MotionProvider>
    );

    const secondOpener = screen
      .getByRole("status")
      .querySelector(".beat-feedback__opener")?.textContent;

    expect(secondOpener).toBe(firstOpener);
  });
});
