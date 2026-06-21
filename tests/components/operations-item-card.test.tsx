import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OperationsEmptyState,
  OperationsItemCard,
  OperationsItemList,
  OperationsTimelineList,
} from "@/components/people-strategy/operations-item-card";
import type {
  OperationsItem,
  OperationsTimelineItem,
} from "@/lib/people-strategy/operations-summary";

function item(overrides: Partial<OperationsItem> = {}): OperationsItem {
  return {
    id: "action:a1",
    kind: "action",
    title: "Clarify Lily STEM curriculum direction",
    why: "Instructor is accepted, but class framing needs to be finalized before training.",
    owner: "Brayden",
    dueISO: "2026-06-12T00:00:00.000Z",
    status: "Due Jun 12",
    tone: "info",
    meetingTitle: "Officer meeting",
    initiativeTitle: "Camp / STEM Curriculum Launch",
    relatedLabel: "Lily",
    nextStep: "Brayden confirms the direction and sends the instructor next-step email.",
    href: "/actions/a1",
    ...overrides,
  };
}

describe("OperationsItemCard", () => {
  it("renders the action variant with kind, why, owner, source meeting, and next step", () => {
    render(<OperationsItemCard item={item()} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/actions/a1");
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Clarify Lily STEM curriculum direction")).toBeInTheDocument();
    expect(screen.getByText(/class framing needs to be finalized/)).toBeInTheDocument();
    expect(screen.getByText("Owner: Brayden")).toBeInTheDocument();
    expect(screen.getByText("From: Officer meeting")).toBeInTheDocument();
    expect(screen.getByText("Initiative: Camp / STEM Curriculum Launch")).toBeInTheDocument();
    expect(screen.getByText(/sends the instructor next-step email/)).toBeInTheDocument();
  });

  it("renders the meeting variant without repeating the meeting as its own source", () => {
    render(
      <OperationsItemCard
        item={item({
          id: "meeting:m1",
          kind: "meeting",
          title: "Officer meeting",
          why: "This meeting created 2 decisions, 3 actions, and 1 loose end.",
          meetingTitle: "Officer meeting",
          initiativeTitle: null,
          href: "/meetings/m1",
        })}
      />
    );
    expect(screen.getByText("Meeting")).toBeInTheDocument();
    expect(screen.getByText(/created 2 decisions, 3 actions, and 1 loose end/)).toBeInTheDocument();
    expect(screen.queryByText("From: Officer meeting")).toBeNull();
  });

  it("renders the initiative variant", () => {
    render(
      <OperationsItemCard
        item={item({
          id: "initiative:camp-stem",
          kind: "initiative",
          title: "Camp / STEM Curriculum Launch",
          status: "At risk",
          tone: "warning",
          meetingTitle: null,
          initiativeTitle: "Camp / STEM Curriculum Launch",
          relatedLabel: "Milestone: Confirm STEM class framing",
          href: "/operations/initiatives/camp-stem",
        })}
      />
    );
    expect(screen.getByText("Initiative")).toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("Milestone: Confirm STEM class framing")).toBeInTheDocument();
  });

  it("renders the communication variant with the suggested message", () => {
    render(
      <OperationsItemCard
        item={item({
          id: "communication:c1",
          kind: "communication",
          title: "Lily — Clarify STEM curriculum direction",
          status: "instructor",
          tone: "warning",
          nextStep: "Suggested message: Confirm the meeting time and ask her to bring 2–3 K–5 STEM class ideas.",
          href: "/actions/a1",
        })}
      />
    );
    expect(screen.getByText("Communication needed")).toBeInTheDocument();
    expect(screen.getByText(/Confirm the meeting time/)).toBeInTheDocument();
  });

  it("renders the loose end variant", () => {
    render(
      <OperationsItemCard
        item={item({
          id: "loose-end:f1",
          kind: "loose_end",
          title: "Curriculum direction still unclear",
          status: "No owner",
          tone: "danger",
          nextStep: "Convert this into an action and assign an owner.",
        })}
      />
    );
    expect(screen.getByText("Loose end")).toBeInTheDocument();
    expect(screen.getByText(/Convert this into an action and assign an owner/)).toBeInTheDocument();
  });

  it("shows TBD when there is no owner", () => {
    render(<OperationsItemCard item={item({ owner: null })} />);
    expect(screen.getByText("Owner: TBD")).toBeInTheDocument();
  });
});

describe("OperationsItemList", () => {
  it("renders the empty state when there are no items", () => {
    render(
      <OperationsItemList
        items={[]}
        empty={
          <OperationsEmptyState title="No loose ends.">
            Every meeting output has either been resolved or converted into an action.
          </OperationsEmptyState>
        }
      />
    );
    expect(screen.getByText("No loose ends.")).toBeInTheDocument();
    expect(screen.getByText(/resolved or converted into an action/)).toBeInTheDocument();
  });

  it("respects the limit", () => {
    render(
      <OperationsItemList
        items={[item(), item({ id: "action:a2", title: "Second action" })]}
        limit={1}
        empty={<OperationsEmptyState>Nothing.</OperationsEmptyState>}
      />
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("OperationsTimelineList", () => {
  it("renders merged timeline entries", () => {
    const events: OperationsTimelineItem[] = [
      {
        id: "decision:d1",
        kind: "decision",
        title: "Confirm broader K-5 STEM",
        occurredAtISO: "2026-06-09T00:00:00.000Z",
        detail: "Decided in Officer meeting",
        href: "/meetings/m1",
      },
      {
        id: "completed:a1",
        kind: "action_completed",
        title: "Accepted instructor onboarding note",
        occurredAtISO: "2026-06-08T00:00:00.000Z",
        detail: "Completed — Brayden",
        href: null,
      },
    ];
    render(<OperationsTimelineList items={events} empty={<span>empty</span>} />);
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("Action completed")).toBeInTheDocument();
    expect(screen.getByText("Decided in Officer meeting")).toBeInTheDocument();
  });
});
