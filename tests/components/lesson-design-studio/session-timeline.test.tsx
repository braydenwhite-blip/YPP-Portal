import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionTimeline } from "@/app/(app)/instructor/lesson-design-studio/components/session-timeline";
import type { WeekActivity } from "@/app/(app)/instructor/lesson-design-studio/types";

function buildActivity(overrides: Partial<WeekActivity>): WeekActivity {
  return {
    id: "activity-1",
    title: "Warm welcome",
    type: "WARM_UP",
    durationMin: 10,
    description: "Open with a quick check-in.",
    resources: null,
    notes: null,
    sortOrder: 0,
    materials: null,
    differentiationTips: null,
    energyLevel: "MEDIUM",
    standardsTags: [],
    rubric: null,
    ...overrides,
  };
}

describe("SessionTimeline", () => {
  it("opens activity details on block click and commits resize changes", () => {
    const onSelectActivity = vi.fn();
    const onReorderActivity = vi.fn();
    const onResizeActivity = vi.fn();

    render(
      <SessionTimeline
        activities={[
          buildActivity({ id: "activity-1", title: "Warm welcome", durationMin: 10 }),
          buildActivity({
            id: "activity-2",
            title: "Guided practice",
            type: "PRACTICE",
            durationMin: 20,
            sortOrder: 1,
          }),
        ]}
        classDurationMin={60}
        readOnly={false}
        selectedActivityId={null}
        onSelectActivity={onSelectActivity}
        onReorderActivity={onReorderActivity}
        onResizeActivity={onResizeActivity}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Warm welcome, 10 minutes" }));
    expect(onSelectActivity).toHaveBeenCalledWith("activity-1");

    const resizeHandle = screen.getByRole("separator", {
      name: "Resize Warm welcome",
    });
    fireEvent.pointerDown(resizeHandle, { clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 160 });
    fireEvent.pointerUp(window);

    expect(onResizeActivity).toHaveBeenCalledWith("activity-1", 15);
    expect(onReorderActivity).not.toHaveBeenCalled();
  });

  it("shows an overtime warning when planned time exceeds the class duration", () => {
    render(
      <SessionTimeline
        activities={[
          buildActivity({ id: "activity-1", durationMin: 25 }),
          buildActivity({
            id: "activity-2",
            title: "Teach",
            type: "INSTRUCTION",
            durationMin: 25,
            sortOrder: 1,
          }),
          buildActivity({
            id: "activity-3",
            title: "Build",
            type: "PRACTICE",
            durationMin: 20,
            sortOrder: 2,
          }),
        ]}
        classDurationMin={60}
        readOnly={false}
        selectedActivityId={null}
        onSelectActivity={vi.fn()}
        onReorderActivity={vi.fn()}
        onResizeActivity={vi.fn()}
      />
    );

    expect(screen.getByText("Over by 10 min")).toBeInTheDocument();
    expect(screen.getByText("70 min planned")).toBeInTheDocument();
  });
});
