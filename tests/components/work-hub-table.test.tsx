import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  // jsdom has no matchMedia; the table only uses it for the rail breakpoint.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
});

import { WorkHubTable } from "@/components/work/work-hub-table";
import type { WorkHubRow } from "@/lib/work/work-hub-rows";

function row(overrides: Partial<WorkHubRow> = {}): WorkHubRow {
  return {
    id: "action:a1",
    kind: "action",
    kindLabel: "Action",
    title: "Call the venue",
    status: "Overdue 3d",
    tone: "danger",
    ownerName: "Jordan",
    dueISO: "2026-06-09T00:00:00.000Z",
    priorityLabel: "High",
    sourceLabel: "From meeting: Leadership sync",
    entityType: "partner",
    entityId: "p1",
    entityLabel: "Beth El",
    nextStep: "Confirm the date",
    overdue: true,
    blocked: false,
    unassigned: false,
    mine: false,
    href: "/actions/a1",
    quickActionLabel: null,
    quickActionHref: null,
    previewType: "action",
    previewId: "a1",
    ...overrides,
  };
}

describe("WorkHubTable", () => {
  it("renders the simplified row: work, owner and due date, status, next step, action", () => {
    render(<WorkHubTable rows={[row()]} />);
    expect(screen.getByText("Call the venue")).toBeInTheDocument();
    expect(screen.getAllByText("Action").length).toBeGreaterThan(0);
    expect(screen.getByText("Jordan")).toBeInTheDocument();
    expect(screen.getByText("Overdue 3d")).toBeInTheDocument();
    expect(screen.getByText("Beth El")).toBeInTheDocument();
    expect(screen.getByText("From meeting: Leadership sync")).toBeInTheDocument();
    expect(screen.getByText("Confirm the date")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      "/actions/a1"
    );
  });

  it("labels unowned work and renders the quick action when one exists", () => {
    render(
      <WorkHubTable
        rows={[
          row({
            id: "follow_up:f1",
            kind: "follow_up",
            kindLabel: "Meeting follow-up",
            ownerName: null,
            unassigned: true,
            quickActionLabel: "Convert to action",
            quickActionHref: "/actions/new?x=1",
          }),
        ]}
      />
    );
    expect(screen.getByText("Needs owner")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Convert to action/ })
    ).toHaveAttribute("href", "/actions/new?x=1");
  });

  it("shows the calm empty state when nothing matches", () => {
    render(<WorkHubTable rows={[]} />);
    expect(screen.getByText("No work matches this view")).toBeInTheDocument();
  });
});
