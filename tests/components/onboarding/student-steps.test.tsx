import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentSteps from "@/components/onboarding/student-steps";

function buildProps(overrides: Partial<ComponentProps<typeof StudentSteps>> = {}) {
  return {
    currentStep: 1,
    userName: "Jordan Student",
    chapterName: "Phoenix",
    profileData: {
      school: "Lincoln High School",
      grade: 9,
      interests: ["Technology & Engineering"],
      parentEmail: "parent@example.com",
      parentPhone: "555-111-2222",
      dateOfBirth: "2010-04-01",
      learningStyle: "Hands-on projects",
      primaryGoal: "Career exploration",
    },
    selectedInterests: ["Technology & Engineering"],
    selectedLearningStyle: "Hands-on projects",
    selectedPrimaryGoal: "Career exploration",
    formError: null,
    onInterestToggle: vi.fn(),
    onLearningStyleChange: vi.fn(),
    onPrimaryGoalChange: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
    onProfileSave: vi.fn(),
    onSkip: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

describe("StudentSteps", () => {
  it("uses the shorter path-finding step instead of the old pathway picker", () => {
    render(<StudentSteps {...buildProps()} />);

    expect(screen.getByRole("heading", { name: "Let's Find Your Path" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and see my journey" })).toBeEnabled();
    expect(screen.queryByText("Choose Your Pathway")).not.toBeInTheDocument();
    expect(screen.queryByText("Goals & Mentorship")).not.toBeInTheDocument();
    expect(screen.queryByText("You're All Set")).not.toBeInTheDocument();
  });

  it("shows the inline legacy completion form only when required basics are missing", () => {
    const { rerender } = render(
      <StudentSteps
        {...buildProps({
          currentStep: 2,
          profileData: {
            school: null,
            grade: null,
            parentEmail: null,
            parentPhone: null,
            dateOfBirth: "2010-04-01",
            interests: [],
            learningStyle: null,
            primaryGoal: null,
          },
        })}
      />
    );

    expect(screen.getByLabelText("Student school")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade for current academic year")).toBeInTheDocument();
    expect(screen.getByLabelText("Parent or guardian email")).toBeInTheDocument();
    expect(screen.getByLabelText("Parent or guardian phone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish onboarding" })).toBeInTheDocument();
    expect(screen.queryByText("You're All Set")).not.toBeInTheDocument();

    rerender(<StudentSteps {...buildProps({ currentStep: 2 })} />);

    expect(
      screen.getByText(/Your school, grade, and parent or guardian details are already in place/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter my dashboard" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Student school")).not.toBeInTheDocument();
  });
});
