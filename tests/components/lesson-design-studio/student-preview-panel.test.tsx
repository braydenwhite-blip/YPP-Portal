import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StudentPreviewPanel } from "@/app/(app)/instructor/lesson-design-studio/components/student-preview-panel";

describe("StudentPreviewPanel", () => {
  it("renders rich activity content and supports interactive quiz blocks", async () => {
    const user = userEvent.setup();

    render(
      <StudentPreviewPanel
        open
        onClose={() => {}}
        courseConfig={{
          durationWeeks: 1,
          sessionsPerWeek: 1,
          classDurationMin: 60,
          targetAgeGroup: "",
          deliveryModes: ["VIRTUAL"],
          difficultyLevel: "LEVEL_101",
          minStudents: 3,
          maxStudents: 25,
          idealSize: 12,
          estimatedHours: 1,
        }}
        week={{
          id: "week-1",
          weekNumber: 1,
          sessionNumber: 1,
          title: "Money Moves",
          classDurationMin: 60,
          objective: "Understand the first step in building a budget.",
          teacherPrepNotes: null,
          materialsChecklist: [],
          atHomeAssignment: null,
          activities: [
            {
              id: "activity-1",
              title: "Budget check-in",
              type: "DISCUSSION",
              durationMin: 20,
              description: JSON.stringify({
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Students review the story and choose the strongest next move.",
                      },
                    ],
                  },
                  {
                    type: "studioQuiz",
                    attrs: {
                      question: "What is a smart budget first step?",
                      options: ["Track spending", "Spend more", "Ignore receipts"],
                      correctIndex: 0,
                      explanation:
                        "Tracking spending gives you a clear picture before you make a plan.",
                    },
                  },
                ],
              }),
              resources: null,
              notes: null,
              sortOrder: 0,
              materials: null,
              differentiationTips: null,
              energyLevel: "MEDIUM",
              standardsTags: [],
              rubric: null,
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Student preview")).toBeInTheDocument();
    expect(
      screen.getByText("Students review the story and choose the strongest next move.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Track spending" }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(
      screen.getByText(
        "Tracking spending gives you a clear picture before you make a plan."
      )
    ).toBeInTheDocument();
  });
});
