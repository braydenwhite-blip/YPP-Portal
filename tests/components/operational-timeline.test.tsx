import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OperationalTimelineEvent } from "@/lib/people-strategy/operational-timeline";
import { OperationalTimeline } from "@/components/people-strategy/operational-timeline";

const events: OperationalTimelineEvent[] = [
  {
    id: "meeting:m1",
    type: "meeting",
    occurredAt: new Date("2026-06-05T18:00:00"),
    title: "Class sync",
    description: "Classes · 1 decision",
    href: "/actions/meetings/m1",
    severity: "neutral",
  },
  {
    id: "action_completed:a1",
    type: "action_completed",
    occurredAt: new Date("2026-06-04T00:00:00"),
    title: "Finalize roster",
    href: "/actions/a1",
    severity: "positive",
  },
];

describe("OperationalTimeline", () => {
  it("renders events with their type label and links", () => {
    render(<OperationalTimeline events={events} />);
    expect(screen.getByText("Meeting")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Class sync" })).toHaveAttribute(
      "href",
      "/actions/meetings/m1"
    );
    expect(screen.getByText("2 events")).toBeInTheDocument();
  });

  it("renders a clean empty state with create CTAs", () => {
    render(
      <OperationalTimeline
        events={[]}
        createActionHref="/actions/new?relatedType=USER&relatedId=u1"
        createMeetingHref="/actions/meetings?new=1"
      />
    );
    expect(screen.getByText(/No operational history yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Schedule meeting" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create action" })).toHaveAttribute(
      "href",
      "/actions/new?relatedType=USER&relatedId=u1"
    );
  });

  it("caps a compact timeline and shows the earlier-events hint", () => {
    const many: OperationalTimelineEvent[] = Array.from({ length: 9 }, (_, i) => ({
      id: `decision:d${i}`,
      type: "decision",
      occurredAt: new Date(2026, 5, 9 - i),
      title: `Decision ${i}`,
      severity: "neutral",
    }));
    render(<OperationalTimeline events={many} compact />);
    expect(screen.getByText(/\+ 3 earlier events/)).toBeInTheDocument();
  });
});
