import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import InterviewReviewEditor from "@/components/instructor-review/interview-review-editor";

const questionBank = [
  {
    id: "bank-1",
    slug: "motivation_for_applying",
    prompt: "What drew you to teaching through YPP?",
    helperText: "Tests motivation.",
    followUpPrompt: "Why this chapter?",
    topic: "Motivation & Fit",
    competency: "Authentic motivation",
    whyItMatters: "Students need instructors with real purpose.",
    interviewerGuidance: "Ask for a concrete story.",
    listenFor: "Student-centered language.",
    suggestedFollowUps: ["What would make this meaningful for students?"],
    strongSignals: ["Names student impact"],
    concernSignals: ["Only talks about resume value"],
    notePrompts: ["Student impact", "Personal connection"],
    sortOrder: 1,
  },
  {
    id: "bank-2",
    slug: "teach_in_60_seconds",
    prompt: "Teach me one concept in 60 seconds.",
    helperText: "Tests teaching clarity.",
    followUpPrompt: "What if students were confused?",
    topic: "Teaching & Curriculum",
    competency: "Teaching clarity",
    whyItMatters: "The interview needs a live teaching sample.",
    interviewerGuidance: "Let them teach without interrupting.",
    listenFor: "Clear framing and pacing.",
    suggestedFollowUps: ["Can you use a different example?"],
    strongSignals: ["Makes a hard idea approachable"],
    concernSignals: ["Uses unexplained jargon"],
    notePrompts: ["Clarity", "Pacing"],
    sortOrder: 2,
  },
];

function renderEditor(
  liveDraftAction = vi.fn().mockResolvedValue({
    success: true,
    savedAt: "2026-04-20T12:00:00.000Z",
    reviewId: "review-1",
  })
) {
  render(
    <InterviewReviewEditor
      action={"/test-submit" as never}
      liveDraftAction={liveDraftAction}
      applicationId="app-1"
      returnTo="/applications/instructor/app-1"
      initialReview={null}
      canEdit
      isLeadReviewer
      canFinalizeRecommendation
      drafts={[]}
      selectedDraftId={null}
      questionBank={questionBank}
    />
  );
  return liveDraftAction;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("InterviewReviewEditor live runner", () => {
  it("marks a question asked and surfaces incomplete asked progress", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Mark Asked" }));

    expect(screen.getByText("1 incomplete")).toBeInTheDocument();
    expect(screen.getAllByText("Asked").length).toBeGreaterThan(0);
  });

  it("adds an inline custom follow-up question", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Add Follow-Up Question" }));

    expect(screen.getByPlaceholderText("Ask the follow-up exactly how you want it saved...")).toBeInTheDocument();
    expect(screen.getByText("Custom follow-up")).toBeInTheDocument();
  });

  it("autosaves after live notes change and a short pause", async () => {
    vi.useFakeTimers();
    const liveDraftAction = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Mark Asked" }));
    fireEvent.change(screen.getByLabelText("Notes on candidate answer"), {
      target: { value: "Candidate gave a strong student-centered example." },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(liveDraftAction).toHaveBeenCalled();
    expect(liveDraftAction.mock.calls.at(-1)?.[0]).toMatchObject({
      applicationId: "app-1",
    });
    expect(liveDraftAction.mock.calls.at(-1)?.[0].questionResponsesJson).toContain(
      "Candidate gave a strong student-centered example."
    );
  });
});
