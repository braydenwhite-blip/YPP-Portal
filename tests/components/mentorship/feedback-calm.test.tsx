import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The respond form is a client component that imports server actions; stub it so
// the calm-lead test stays focused on framing, not the form internals.
vi.mock("@/app/(app)/mentorship/feedback/client", () => ({
  RespondForm: ({ requestId }: { requestId: string }) => (
    <button type="button">Write Response {requestId}</button>
  ),
}));

import { FeedbackCalm } from "@/app/(app)/mentorship/feedback/_components/feedback-calm";

describe("FeedbackCalm", () => {
  it("leads a mentor with the count waiting and an inline respond control", () => {
    render(
      <FeedbackCalm
        isMentor
        pending={[
          { id: "r1", question: "Is my pitch clear?", menteeName: "Sam", topic: "coding" },
        ]}
      />
    );

    expect(screen.getByText("1 request needs your response")).toBeInTheDocument();
    expect(screen.getByText("From Sam")).toBeInTheDocument();
    expect(screen.getByText("Is my pitch clear?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Write Response r1/ })).toBeInTheDocument();
  });

  it("shows a mentee their open ask as awaiting, never as a respond task", () => {
    render(
      <FeedbackCalm
        isMentor={false}
        pending={[{ id: "r1", question: "Can you review my deck?" }]}
      />
    );

    expect(screen.getByText("1 request waiting on a mentor")).toBeInTheDocument();
    expect(screen.getByText("Awaiting a mentor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Write Response/ })).not.toBeInTheDocument();
  });

  it("shows a supportive empty state with nothing pending", () => {
    render(<FeedbackCalm isMentor pending={[]} />);
    expect(screen.getByText("You're all caught up on feedback")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is waiting on your feedback/)).toBeInTheDocument();
  });
});
