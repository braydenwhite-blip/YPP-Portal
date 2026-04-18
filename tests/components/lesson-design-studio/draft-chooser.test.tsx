import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftChooser } from "@/app/(app)/instructor/lesson-design-studio/draft-chooser";

const actionMocks = vi.hoisted(() => ({
  createBlankCurriculumDraft: vi.fn(),
  createWorkingCopyFromCurriculumDraft: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("@/lib/curriculum-draft-actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

function buildDraft(overrides: Partial<any> = {}) {
  return {
    id: "draft-1",
    title: "Money Moves",
    status: "IN_PROGRESS",
    updatedAt: "2026-03-18T14:00:00.000Z",
    submittedAt: null,
    approvedAt: null,
    generatedTemplateId: null,
    isEditable: true,
    isPrimaryEditable: true,
    ...overrides,
  };
}

describe("DraftChooser", () => {
  beforeEach(() => {
    actionMocks.createBlankCurriculumDraft
      .mockReset()
      .mockResolvedValue({ draftId: "draft-1", reusedExisting: false });
    actionMocks.createWorkingCopyFromCurriculumDraft
      .mockReset()
      .mockResolvedValue({ draftId: "draft-2", reusedExisting: false });
    routerMocks.push.mockReset();
  });

  it("shows the primary editable draft separately from history", () => {
    render(
      <DraftChooser
        userName="Instructor"
        entryContext="DIRECT"
        drafts={[
          buildDraft(),
          buildDraft({
            id: "draft-2",
            title: "Approved Curriculum",
            status: "APPROVED",
            isEditable: false,
            isPrimaryEditable: false,
            approvedAt: "2026-03-18T15:00:00.000Z",
          }),
        ]}
      />
    );

    expect(screen.getAllByText("Open Working Draft").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Approved Curriculum")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("routes reused working-copy actions back to the single active draft with a notice", async () => {
    const user = userEvent.setup();

    actionMocks.createWorkingCopyFromCurriculumDraft.mockResolvedValue({
      draftId: "draft-1",
      reusedExisting: true,
    });

    render(
      <DraftChooser
        userName="Instructor"
        entryContext="DIRECT"
        drafts={[
          buildDraft(),
          buildDraft({
            id: "draft-2",
            title: "Submitted Curriculum",
            status: "SUBMITTED",
            isEditable: false,
            isPrimaryEditable: false,
            submittedAt: "2026-03-18T15:00:00.000Z",
          }),
        ]}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "Use as starting point" })[0]);

    await waitFor(() => {
      expect(actionMocks.createWorkingCopyFromCurriculumDraft).toHaveBeenCalledWith(
        "draft-2"
      );
      expect(routerMocks.push).toHaveBeenCalledWith(
        "/instructor/lesson-design-studio/draft-1/setup?notice=active-draft-reused"
      );
    });
  });
});
