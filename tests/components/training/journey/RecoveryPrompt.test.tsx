/**
 * RecoveryPrompt — interaction tests.
 *
 * Verifies:
 *   - Picking an option locks the prompt (single-shot).
 *   - The matching reaction line surfaces.
 *   - The optional roomDelta callback fires with the picked option's delta.
 *   - Other options become non-interactive after a pick.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { RecoveryPrompt } from "@/components/training/journey/beats/RecoveryPrompt";
import { MotionProvider } from "@/components/training/journey/MotionProvider";

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

const promptFixture = {
  question: "What now?",
  options: [
    {
      id: "good",
      label: "Recover well",
      reaction: "The room recovers.",
      roomDelta: { engagement: 1 },
    },
    {
      id: "bad",
      label: "Make it worse",
      reaction: "The room cools further.",
      roomDelta: { engagement: -1 },
    },
  ],
};

describe("RecoveryPrompt", () => {
  it("renders the question and all options", () => {
    withProvider(<RecoveryPrompt prompt={promptFixture} />);

    expect(screen.getByText("What now?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recover well/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Make it worse/ })).toBeInTheDocument();
  });

  it("shows the reaction line after a pick and fires the roomDelta callback", async () => {
    const user = userEvent.setup();
    const onRoomDelta = vi.fn();

    withProvider(
      <RecoveryPrompt prompt={promptFixture} onRoomDelta={onRoomDelta} />
    );

    expect(screen.queryByText("The room recovers.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Recover well/ }));

    expect(screen.getByText("The room recovers.")).toBeInTheDocument();
    expect(onRoomDelta).toHaveBeenCalledTimes(1);
    expect(onRoomDelta).toHaveBeenCalledWith({ engagement: 1 });
  });

  it("locks all options after the first pick (single-shot)", async () => {
    const user = userEvent.setup();
    const onRoomDelta = vi.fn();

    withProvider(
      <RecoveryPrompt prompt={promptFixture} onRoomDelta={onRoomDelta} />
    );

    await user.click(screen.getByRole("button", { name: /Recover well/ }));

    // Try to click the other option — it must be disabled and the
    // callback must not fire again.
    const otherOption = screen.getByRole("button", { name: /Make it worse/ });
    expect(otherOption).toBeDisabled();

    await user.click(otherOption);
    expect(onRoomDelta).toHaveBeenCalledTimes(1);

    // The originally-picked option's reaction is the only one rendered.
    expect(screen.getByText("The room recovers.")).toBeInTheDocument();
    expect(screen.queryByText("The room cools further.")).not.toBeInTheDocument();
  });

  it("does not call onRoomDelta when the picked option has no roomDelta", async () => {
    const user = userEvent.setup();
    const onRoomDelta = vi.fn();
    const prompt = {
      question: "What now?",
      options: [
        { id: "neutral", label: "Neutral move", reaction: "Nothing changes." },
        { id: "other", label: "Other", reaction: "Other reaction." },
      ],
    };

    withProvider(<RecoveryPrompt prompt={prompt} onRoomDelta={onRoomDelta} />);

    await user.click(screen.getByRole("button", { name: /Neutral move/ }));

    expect(screen.getByText("Nothing changes.")).toBeInTheDocument();
    expect(onRoomDelta).not.toHaveBeenCalled();
  });

  it("works without an onRoomDelta callback", async () => {
    const user = userEvent.setup();

    withProvider(<RecoveryPrompt prompt={promptFixture} />);

    await user.click(screen.getByRole("button", { name: /Recover well/ }));

    expect(screen.getByText("The room recovers.")).toBeInTheDocument();
  });
});
