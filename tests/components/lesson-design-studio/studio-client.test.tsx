import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudioClient } from "@/app/(app)/instructor/lesson-design-studio/studio-client";

const actionMocks = vi.hoisted(() => ({
  saveCurriculumDraft: vi.fn(),
  submitCurriculumDraft: vi.fn(),
  markLessonDesignStudioTourComplete: vi.fn(),
  createWorkingCopyFromCurriculumDraft: vi.fn(),
}));

const commentActionMocks = vi.hoisted(() => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  resolveComment: vi.fn(),
  deleteComment: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const libraryExampleWeek = {
  weekNumber: 1,
  title: "Imported Week",
  goal: "Practice a real skill",
  teachingTips: "Keep the pacing tight.",
  atHomeAssignment: {
    type: "REFLECTION_PROMPT",
    title: "Reflect",
    description: "Write down one takeaway.",
  },
  activities: [
    {
      title: "Warm Up",
      type: "WARM_UP",
      durationMin: 10,
      description: "Start strong.",
    },
    {
      title: "Mini Lesson",
      type: "INSTRUCTION",
      durationMin: 15,
      description: "Teach the core idea.",
    },
    {
      title: "Practice",
      type: "PRACTICE",
      durationMin: 20,
      description: "Try it out.",
    },
  ],
} as const;

vi.mock("@/lib/curriculum-draft-actions", () => actionMocks);
vi.mock("@/lib/curriculum-comment-actions", () => commentActionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock(
  "@/app/(app)/instructor/lesson-design-studio/components/examples-library",
  () => ({
    ExamplesLibrary: (props: any) =>
      props.open ? (
        <div>
          <div data-testid="examples-error">{props.errorMessage ?? ""}</div>
          <button type="button" onClick={() => props.onImportWeek(libraryExampleWeek)}>
            Import Example
          </button>
        </div>
      ) : null,
  })
);

vi.mock(
  "@/app/(app)/instructor/lesson-design-studio/components/activity-templates",
  () => ({
    ActivityTemplates: () => null,
  })
);

vi.mock(
  "@/app/(app)/instructor/lesson-design-studio/components/onboarding-tour",
  () => ({
    OnboardingTour: (props: any) => (
      <div data-testid="tour">
        <button type="button" onClick={() => void props.onComplete?.()}>
          Finish Tour
        </button>
      </div>
    ),
  })
);

function buildDraft(overrides: Partial<any> = {}) {
  return {
    id: "draft-1",
    title: "",
    description: "",
    interestArea: "",
    outcomes: [],
    courseConfig: {
      durationWeeks: 2,
      sessionsPerWeek: 1,
      classDurationMin: 60,
      targetAgeGroup: "",
      deliveryModes: ["VIRTUAL"],
      difficultyLevel: "LEVEL_101",
      minStudents: 3,
      maxStudents: 25,
      idealSize: 12,
      estimatedHours: 2,
    },
    weeklyPlans: [
      {
        id: "session-1",
        weekNumber: 1,
        sessionNumber: 1,
        title: "",
        classDurationMin: 60,
        activities: [],
        objective: null,
        teacherPrepNotes: null,
        materialsChecklist: [],
        atHomeAssignment: null,
      },
      {
        id: "session-2",
        weekNumber: 2,
        sessionNumber: 1,
        title: "",
        classDurationMin: 60,
        activities: [],
        objective: null,
        teacherPrepNotes: null,
        materialsChecklist: [],
        atHomeAssignment: null,
      },
    ],
    understandingChecks: {
      answers: {},
      lastScorePct: null,
      passed: false,
      completedAt: null,
    },
    reviewRubric: {
      scores: {
        clarity: 0,
        sequencing: 0,
        studentExperience: 0,
        launchReadiness: 0,
      },
      sectionNotes: {
        overview: "",
        courseStructure: "",
        sessionPlans: "",
        studentAssignments: "",
      },
      summary: "",
    },
    reviewNotes: "",
    reviewedAt: null,
    submittedAt: null,
    approvedAt: null,
    generatedTemplateId: null,
    status: "IN_PROGRESS",
    updatedAt: "2026-03-18T14:00:00.000Z",
    ...overrides,
  };
}

function buildReadyDraft(overrides: Partial<any> = {}) {
  return buildDraft({
    title: "Ready Draft",
    description: "A strong first course",
    interestArea: "Finance",
    outcomes: ["Outcome one", "Outcome two", "Outcome three"],
    weeklyPlans: [
      {
        id: "session-1",
        weekNumber: 1,
        sessionNumber: 1,
        title: "Week 1",
        classDurationMin: 60,
        activities: [
          { id: "a1", title: "Warm Up", type: "WARM_UP", durationMin: 10, description: null, resources: null, notes: null, sortOrder: 0, materials: null, differentiationTips: null, energyLevel: null, standardsTags: [], rubric: null },
          { id: "a2", title: "Teach", type: "INSTRUCTION", durationMin: 20, description: null, resources: null, notes: null, sortOrder: 1, materials: null, differentiationTips: null, energyLevel: null, standardsTags: [], rubric: null },
          { id: "a3", title: "Practice", type: "PRACTICE", durationMin: 20, description: null, resources: null, notes: null, sortOrder: 2, materials: null, differentiationTips: null, energyLevel: null, standardsTags: [], rubric: null },
        ],
        objective: "Learn skill one",
        teacherPrepNotes: "Set up materials.",
        materialsChecklist: [],
        atHomeAssignment: {
          type: "REFLECTION_PROMPT",
          title: "Reflect",
          description: "Reflect on today.",
        },
      },
      {
        id: "session-2",
        weekNumber: 2,
        sessionNumber: 1,
        title: "Week 2",
        classDurationMin: 60,
        activities: [
          { id: "b1", title: "Warm Up", type: "WARM_UP", durationMin: 10, description: null, resources: null, notes: null, sortOrder: 0, materials: null, differentiationTips: null, energyLevel: null, standardsTags: [], rubric: null },
          { id: "b2", title: "Teach", type: "INSTRUCTION", durationMin: 20, description: null, resources: null, notes: null, sortOrder: 1, materials: null, differentiationTips: null, energyLevel: null, standardsTags: [], rubric: null },
          { id: "b3", title: "Practice", type: "PRACTICE", durationMin: 20, description: null, resources: null, notes: null, sortOrder: 2, materials: null, differentiationTips: null, energyLevel: null, standardsTags: [], rubric: null },
        ],
        objective: "Learn skill two",
        teacherPrepNotes: null,
        materialsChecklist: [],
        atHomeAssignment: {
          type: "REFLECTION_PROMPT",
          title: "Reflect",
          description: "Reflect again.",
        },
      },
    ],
    understandingChecks: {
      answers: {
        objective_alignment:
          "It names what students will be able to do by the end of the session.",
        session_pacing:
          "A realistic plan protects flow, transitions, and student energy in real teaching.",
        activity_sequence:
          "Students learn better when the session builds from entry, to understanding, to application, to closure.",
        homework_purpose:
          "Extend or reinforce the learning from the session in a manageable way.",
        example_usage:
          "Study why they work, then adapt the moves to fit their own curriculum and students.",
        course_outcomes:
          "Outcomes clarify what students should leave able to do, which helps the whole sequence stay coherent.",
        differentiation_use:
          "They help the instructor plan how the same activity can still work for students who need more support or more challenge.",
        capstone_goal:
          "A full curriculum package that is ready for review and close to ready to teach, not just a rough outline.",
      },
      lastScorePct: 100,
      passed: true,
      completedAt: "2026-03-18T14:00:00.000Z",
    },
    status: "COMPLETED",
    ...overrides,
  });
}

const COMPLETE_UNDERSTANDING_CHECKS = buildReadyDraft().understandingChecks;

function buildViewerAccess(overrides: Partial<any> = {}) {
  return {
    canView: true,
    canEdit: true,
    canComment: true,
    canResolveComments: false,
    viewerKind: "AUTHOR",
    ...overrides,
  };
}

describe("StudioClient", () => {
  beforeEach(() => {
    actionMocks.saveCurriculumDraft.mockReset().mockResolvedValue({ success: true });
    actionMocks.submitCurriculumDraft.mockReset().mockResolvedValue({ success: true });
    actionMocks.markLessonDesignStudioTourComplete
      .mockReset()
      .mockResolvedValue({ success: true });
    actionMocks.createWorkingCopyFromCurriculumDraft
      .mockReset()
      .mockResolvedValue({ draftId: "draft-2", reusedExisting: false });
    commentActionMocks.listComments.mockReset().mockResolvedValue([]);
    commentActionMocks.createComment.mockReset().mockResolvedValue({
      id: "comment-1",
      draftId: "draft-1",
      authorId: "user-1",
      parentId: null,
      anchorType: "COURSE",
      anchorId: null,
      anchorField: "title",
      body: "Please sharpen the title.",
      resolved: false,
      resolvedById: null,
      resolvedAt: null,
      createdAt: "2026-04-10T12:00:00.000Z",
      updatedAt: "2026-04-10T12:00:00.000Z",
      author: {
        id: "user-1",
        name: "Instructor",
      },
      resolvedBy: null,
    });
    commentActionMocks.resolveComment.mockReset().mockResolvedValue({ success: true });
    commentActionMocks.deleteComment.mockReset().mockResolvedValue({ success: true });
    routerMocks.push.mockReset();
    routerMocks.refresh.mockReset();
    localStorage.clear();
  });

  it("shows the guided shell recommendation and lets the user switch steps", async () => {
    const user = userEvent.setup();

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildDraft()}
        viewerAccess={buildViewerAccess()}
        currentPhase="START"
      />
    );

    expect(screen.getByText("Recommended next move")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Pick a starter scaffold" }).length
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Course Map/i }));

    expect(screen.getByRole("heading", { name: "Shape the course promise" })).toBeInTheDocument();
  });

  it("generates a starter curriculum from the quick-start wizard", async () => {
    const user = userEvent.setup();

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildDraft()}
        viewerAccess={buildViewerAccess()}
        currentPhase="START"
      />
    );

    await user.click(screen.getByRole("button", { name: "Open quick-start wizard" }));

    const wizard = screen.getByRole("dialog", { name: "Quick-start wizard" });
    await user.click(
      within(wizard).getByRole("button", { name: /Technology & Coding/i })
    );
    await user.click(within(wizard).getByRole("button", { name: "Continue" }));
    await user.click(
      within(wizard).getByRole("button", { name: /Build with active practice/i })
    );
    await user.click(within(wizard).getByRole("button", { name: "Continue" }));
    await user.click(
      within(wizard).getByRole("button", { name: "Generate starter curriculum" })
    );

    expect(
      await screen.findByRole("heading", { name: "Shape the course promise" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Code Your Future")).toBeInTheDocument();
  });

  it("flushes the latest draft before exporting", async () => {
    const user = userEvent.setup();
    const exportWindow = {
      close: vi.fn(),
      location: { href: "" },
    } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(exportWindow);

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildReadyDraft()}
        viewerAccess={buildViewerAccess()}
        currentPhase="COURSE_MAP"
      />
    );

    const titleInput = screen.getByLabelText("Curriculum title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");
    await user.click(screen.getByRole("button", { name: /Review & Launch/i }));
    await user.click(screen.getByRole("button", { name: "Export student view" }));

    await waitFor(() => {
      expect(actionMocks.saveCurriculumDraft).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Updated Title" })
      );
      expect(exportWindow.location.href).toContain("type=student");
    });

    openSpy.mockRestore();
  });

  it("flushes the latest draft before submitting", async () => {
    const user = userEvent.setup();
    const callOrder: string[] = [];

    actionMocks.saveCurriculumDraft.mockImplementation(async () => {
      callOrder.push("save");
      return { success: true };
    });
    actionMocks.submitCurriculumDraft.mockImplementation(async () => {
      callOrder.push("submit");
      return { success: true };
    });

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildReadyDraft()}
        viewerAccess={buildViewerAccess()}
        currentPhase="COURSE_MAP"
      />
    );

    const titleInput = screen.getByLabelText("Curriculum title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");
    await user.click(screen.getByRole("button", { name: /Review & Launch/i }));
    await user.click(screen.getByRole("button", { name: "Submit curriculum for review" }));

    await waitFor(() => {
      expect(callOrder).toEqual(["save", "submit"]);
    });
  });

  it("restores understanding checks from version history", async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      "lds_history_draft-1",
      JSON.stringify([
        {
          savedAt: "2026-03-18T15:00:00.000Z",
          snapshot: {
            title: "Saved Version",
            description: "",
            interestArea: "Finance",
            outcomes: ["One", "Two", "Three"],
            courseConfig: buildDraft().courseConfig,
            weeklyPlans: buildDraft().weeklyPlans,
            understandingChecks: {
              ...COMPLETE_UNDERSTANDING_CHECKS,
              completedAt: "2026-03-18T15:00:00.000Z",
            },
          },
        },
      ])
    );

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildDraft()}
        viewerAccess={buildViewerAccess()}
        currentPhase="COURSE_MAP"
      />
    );

    expect(screen.getByText("Overall 0% / 80% needed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View version history" }));
    await user.click(screen.getByRole("button", { name: /saved version/i }));

    await waitFor(() => {
      expect(screen.getByText("Passed")).toBeInTheDocument();
      expect(screen.getByText("Overall 100% / 80% needed")).toBeInTheDocument();
    });
  });

  it("shows starter support only when the user asks for the walkthrough and marks completion", async () => {
    const user = userEvent.setup();

    const firstRender = render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildDraft()}
        viewerAccess={buildViewerAccess()}
        currentPhase="START"
      />
    );

    expect(screen.queryByTestId("tour")).not.toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Rebuild with starter support" })[0]
    );

    expect(screen.getByTestId("tour")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finish Tour" }));

    await waitFor(() => {
      expect(actionMocks.markLessonDesignStudioTourComplete).toHaveBeenCalledWith(
        "draft-1"
      );
      expect(actionMocks.saveCurriculumDraft).toHaveBeenCalledTimes(0);
    });

    firstRender.unmount();

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildReadyDraft({ status: "SUBMITTED" })}
        viewerAccess={buildViewerAccess({
          canEdit: false,
        })}
        currentPhase="REVIEW_LAUNCH"
      />
    );

    expect(screen.queryByTestId("tour")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Rebuild with starter support" })
    ).not.toBeInTheDocument();
  });

  it("keeps session authoring in focus mode and lets the user switch the selected session", async () => {
    const user = userEvent.setup();

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildReadyDraft()}
        viewerAccess={buildViewerAccess()}
        currentPhase="SESSIONS"
      />
    );

    expect(screen.getByLabelText("Session title")).toHaveValue("Week 1");

    await user.click(screen.getByRole("button", { name: /Week 2Week 2/i }));

    expect(screen.getByLabelText("Session title")).toHaveValue("Week 2");
  });

  it("imports an inline example week into the selected session", async () => {
    const user = userEvent.setup();

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildDraft({ interestArea: "Finance", outcomes: ["One", "Two", "Three"] })}
        viewerAccess={buildViewerAccess()}
        currentPhase="SESSIONS"
      />
    );

    await user.click(screen.getByRole("button", { name: "Import this example week" }));

    expect(screen.getByLabelText("Session title")).toHaveValue("Budgeting Basics");
  });

  it("opens a working copy from a read-only submitted draft", async () => {
    const user = userEvent.setup();

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildReadyDraft({ status: "SUBMITTED" })}
        viewerAccess={buildViewerAccess({
          canEdit: false,
        })}
        currentPhase="REVIEW_LAUNCH"
      />
    );

    await user.click(screen.getAllByRole("button", { name: "Use as starting point" })[0]);

    await waitFor(() => {
      expect(actionMocks.createWorkingCopyFromCurriculumDraft).toHaveBeenCalledWith(
        "draft-1"
      );
      expect(routerMocks.push).toHaveBeenCalledWith(
        "/instructor/lesson-design-studio?draftId=draft-2"
      );
    });
  });

  it("duplicates a session into a blank slot without overwriting a built one", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildDraft({
          courseConfig: {
            ...buildDraft().courseConfig,
            durationWeeks: 3,
          },
          weeklyPlans: [
            buildReadyDraft().weeklyPlans[0],
            {
              ...buildReadyDraft().weeklyPlans[1],
              id: "session-2",
              title: "Week 2 existing",
            },
            {
              id: "session-3",
              weekNumber: 3,
              sessionNumber: 1,
              title: "",
              classDurationMin: 60,
              activities: [],
              objective: null,
              teacherPrepNotes: null,
              materialsChecklist: [],
              atHomeAssignment: null,
            },
          ],
        })}
        viewerAccess={buildViewerAccess()}
        currentPhase="SESSIONS"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Session title")).toHaveValue("Week 1");
    });

    await user.click(screen.getByRole("button", { name: "Duplicate this session" }));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Session title")).toHaveValue("Week 1 (Copy)");

    await user.click(
      screen.getByRole("button", { name: /Week 2.*Week 2 existing/i })
    );

    expect(screen.getByLabelText("Session title")).toHaveValue(
      "Week 2 existing"
    );

    alertSpy.mockRestore();
  });

  it("does not save when a read-only draft receives a forced edit event", () => {
    render(
      <StudioClient
        userId="user-1"
        userName="Instructor"
        draft={buildReadyDraft({ status: "SUBMITTED" })}
        viewerAccess={buildViewerAccess({
          canEdit: false,
        })}
        currentPhase="COURSE_MAP"
      />
    );

    fireEvent.change(screen.getByLabelText("Curriculum title"), {
      target: { value: "Changed" },
    });

    expect(actionMocks.saveCurriculumDraft).not.toHaveBeenCalled();
  });

  it("keeps reviewers read-only while still showing comment access", async () => {
    render(
      <StudioClient
        userId="reviewer-1"
        userName="Reviewer"
        draft={buildReadyDraft({ status: "SUBMITTED" })}
        viewerAccess={buildViewerAccess({
          canEdit: false,
          canResolveComments: true,
          viewerKind: "REVIEWER",
        })}
        currentPhase="COURSE_MAP"
      />
    );

    expect(
      screen.getByRole("button", { name: /Comments/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use as starting point" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Review mode is on.")).toBeInTheDocument();
  });
});
