import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChooseWorkshopPathButtons } from "@/app/(app)/instructor/workshop-design-studio/choice-buttons";

const actionMocks = vi.hoisted(() => ({
  chooseWorkshopPath: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/workshop-proposal-actions", () => actionMocks);
vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

describe("ChooseWorkshopPathButtons", () => {
  beforeEach(() => {
    actionMocks.chooseWorkshopPath.mockReset();
    routerMocks.push.mockReset();
    routerMocks.refresh.mockReset();
  });

  it("renders 'Pick this path' button for an applicant with no current source", () => {
    render(
      <ChooseWorkshopPathButtons
        currentSource={null}
        path="CUSTOM_DESIGN"
        continueHref="/instructor/workshop-design-studio/design"
      />
    );
    expect(screen.getByRole("button", { name: /pick this path/i })).toBeInTheDocument();
  });

  it("renders 'Continue' link when current source matches", () => {
    render(
      <ChooseWorkshopPathButtons
        currentSource="CUSTOM_DESIGN"
        path="CUSTOM_DESIGN"
        continueHref="/instructor/workshop-design-studio/design"
      />
    );
    expect(screen.getByRole("link", { name: /continue/i })).toHaveAttribute(
      "href",
      "/instructor/workshop-design-studio/design"
    );
  });

  it("calls the server action and navigates on success", async () => {
    const user = userEvent.setup();
    actionMocks.chooseWorkshopPath.mockResolvedValueOnce(undefined);
    render(
      <ChooseWorkshopPathButtons
        currentSource={null}
        path="CUSTOM_DESIGN"
        continueHref="/instructor/workshop-design-studio/design"
      />
    );
    await user.click(screen.getByRole("button", { name: /pick this path/i }));
    await waitFor(() =>
      expect(actionMocks.chooseWorkshopPath).toHaveBeenCalledTimes(1)
    );
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/instructor/workshop-design-studio/design"
    );
  });

  it("shows a friendly fallback when the action throws Next's masked production digest error", async () => {
    const user = userEvent.setup();
    actionMocks.chooseWorkshopPath.mockRejectedValueOnce(
      new Error(
        "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details."
      )
    );
    render(
      <ChooseWorkshopPathButtons
        currentSource={null}
        path="CUSTOM_DESIGN"
        continueHref="/instructor/workshop-design-studio/design"
      />
    );
    await user.click(screen.getByRole("button", { name: /pick this path/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toMatch(/something went wrong/i);
    expect(alert.textContent ?? "").not.toMatch(/digest/i);
  });

  it("does NOT invoke the action in reviewer preview mode (regression: prod digest error)", async () => {
    const user = userEvent.setup();
    render(
      <ChooseWorkshopPathButtons
        currentSource={null}
        path="CUSTOM_DESIGN"
        continueHref="/instructor/workshop-design-studio/design"
        isReviewerPreview
      />
    );
    // No button to click — reviewers see a read-only pill instead.
    expect(
      screen.queryByRole("button", { name: /pick this path/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/applicant action.*preview only/i)
    ).toBeInTheDocument();
    expect(actionMocks.chooseWorkshopPath).not.toHaveBeenCalled();
  });

  it("shows the original action error message when it's a normal error", async () => {
    const user = userEvent.setup();
    actionMocks.chooseWorkshopPath.mockRejectedValueOnce(
      new Error("Your workshop submission is locked.")
    );
    render(
      <ChooseWorkshopPathButtons
        currentSource={null}
        path="CUSTOM_DESIGN"
        continueHref="/instructor/workshop-design-studio/design"
      />
    );
    await user.click(screen.getByRole("button", { name: /pick this path/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("submission is locked");
  });
});
