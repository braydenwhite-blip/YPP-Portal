import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueueRunner } from "@/components/queue/queue-runner";
import type { QueueItem } from "@/lib/queue/types";

import { makeQueueItem } from "../lib/queue/fixtures";

// Stub the domain mutations the inline panels call — we assert the runner's
// orchestration, not the server actions (those have their own coverage).
const convertDecisionToAction = vi.fn(async () => ({ id: "new-action" }));
const setFollowUpStatus = vi.fn(async () => {});
const convertFollowUpToAction = vi.fn(async () => ({ id: "new-action" }));
vi.mock("@/lib/people-strategy/meetings-actions", () => ({
  convertDecisionToAction: (...args: unknown[]) => convertDecisionToAction(...args),
  setFollowUpStatus: (...args: unknown[]) => setFollowUpStatus(...args),
  convertFollowUpToAction: (...args: unknown[]) => convertFollowUpToAction(...args),
}));
vi.mock("@/lib/queue/queue-actions", () => ({
  revalidateQueueSurfaces: vi.fn(async () => {}),
}));

function actionItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return makeQueueItem({
    id: "wh:action:1",
    type: "action",
    typeLabel: "Action",
    title: "Send the renewal email",
    why: "Mia is past the due date on this action.",
    recommendedMove: "Reschedule it or close it out today.",
    href: "/actions/1",
    inline: {
      kind: "action",
      actionId: "1",
      blockedReason: null,
      completionNote: null,
      completionOutcome: null,
      nextFollowUpISO: null,
    },
    ...overrides,
  });
}

function routeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return makeQueueItem({
    id: "wh:application:9",
    type: "application",
    typeLabel: "Application",
    title: "Review Jordan's application",
    why: "It has been waiting on a reviewer for 6 days.",
    recommendedMove: "Advance it to the next stage.",
    inline: null,
    primaryAction: {
      resolution: "resolve",
      label: "Advance application",
      href: "/admin/instructor-applicants/9",
    },
    href: "/admin/instructor-applicants/9",
    ...overrides,
  });
}

function decisionItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return makeQueueItem({
    id: "dec:7",
    type: "decision",
    typeLabel: "Decision",
    title: "Move interviews to Tuesdays",
    why: "Decided in Ops sync but never became a tracked action.",
    inline: { kind: "decision", decisionId: "7" },
    href: "/actions/meetings/m1",
    ...overrides,
  });
}

describe("QueueRunner — actionable work surface", () => {
  it("shows ONE loop at a time with why + what + the real work area", () => {
    render(<QueueRunner queueLabel="My queue" items={[actionItem(), routeItem()]} />);

    expect(screen.getByRole("heading", { name: "Send the renewal email" })).toBeInTheDocument();
    expect(screen.getByText("Why this matters")).toBeInTheDocument();
    expect(screen.getByText("Mia is past the due date on this action.")).toBeInTheDocument();
    expect(screen.getByText("What needs to happen")).toBeInTheDocument();
    // The inline action panel offers the real complete/block controls.
    expect(screen.getByText("Update this action")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Block" })).toBeInTheDocument();
    // The second loop is NOT shown — one at a time.
    expect(screen.queryByText("Review Jordan's application")).not.toBeInTheDocument();
    expect(screen.getByText(/2 left/)).toBeInTheDocument();
  });

  it("leads with a specific route action (not a generic Resolve) when there's no inline workflow", () => {
    render(<QueueRunner queueLabel="My queue" items={[routeItem()]} />);
    const link = screen.getByRole("link", { name: /Advance application/ });
    expect(link).toHaveAttribute("href", "/admin/instructor-applicants/9");
    // No fake "Resolve / Dismiss / Mark done" button.
    expect(screen.queryByRole("button", { name: /^Resolve$/ })).not.toBeInTheDocument();
  });

  it("Skip advances to the next loop WITHOUT mutating anything", () => {
    render(<QueueRunner queueLabel="My queue" items={[actionItem(), routeItem()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    // Now on the second loop; the first is hidden but not resolved.
    expect(screen.getByText("Review Jordan's application")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Send the renewal email" })).not.toBeInTheDocument();
    // No server action fired — skipping changes nothing.
    expect(convertDecisionToAction).not.toHaveBeenCalled();
    expect(setFollowUpStatus).not.toHaveBeenCalled();
  });

  it("advances and confirms only after the source record actually clears", async () => {
    const { rerender } = render(
      <QueueRunner queueLabel="My queue" items={[decisionItem(), routeItem()]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Create tracked action" }));

    await waitFor(() => expect(convertDecisionToAction).toHaveBeenCalledWith("7"));

    // Simulate the post-mutation refresh: the decision no longer produces a loop.
    rerender(<QueueRunner queueLabel="My queue" items={[routeItem()]} />);

    expect(await screen.findByText(/Done — "Move interviews to Tuesdays" cleared\./)).toBeInTheDocument();
    expect(screen.getByText("Review Jordan's application")).toBeInTheDocument();
  });

  it("keeps a loop and explains when a mutation was partial (item still present)", async () => {
    const { rerender } = render(
      <QueueRunner queueLabel="My queue" items={[decisionItem(), routeItem()]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Create tracked action" }));
    await waitFor(() => expect(convertDecisionToAction).toHaveBeenCalled());

    // Refresh returns the SAME item (e.g. nothing actually cleared) → keep it.
    rerender(<QueueRunner queueLabel="My queue" items={[decisionItem(), routeItem()]} />);

    expect(await screen.findByText(/stays in your queue until it's fully cleared/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Move interviews to Tuesdays" })).toBeInTheDocument();
  });

  it("shows a calm, encouraging empty state when there is nothing to do", () => {
    render(<QueueRunner queueLabel="My queue" items={[]} />);
    expect(screen.getByText("You're clear for now 🎉")).toBeInTheDocument();
  });

  it("lets a follow-up be handled or converted with real mutations", async () => {
    const followUp = makeQueueItem({
      id: "wh:follow_up:5",
      type: "follow_up",
      typeLabel: "Meeting follow-up",
      title: "Email the partner the recap",
      inline: { kind: "follow_up", followUpId: "5" },
    });
    render(<QueueRunner queueLabel="My queue" items={[followUp]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark handled" }));
    await waitFor(() =>
      expect(setFollowUpStatus).toHaveBeenCalledWith({ id: "5", status: "COMPLETED" })
    );
  });
});
