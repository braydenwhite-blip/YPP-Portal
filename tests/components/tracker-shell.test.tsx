import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TrackerPreview,
  TrackerRow,
  TrackerShell,
} from "@/components/ui-v2";

describe("TrackerShell", () => {
  it("renders the title, subtitle, primary action, metrics, views, and list", () => {
    render(
      <TrackerShell
        eyebrow="Admin"
        title="Applications"
        subtitle="Review applications and decisions."
        primaryAction={<a href="/interviews">Open Interviews</a>}
        metrics={<div data-testid="metrics">5 submitted</div>}
        views={[
          { key: "all", label: "All types", href: "/admin/applications", active: true },
          {
            key: "instructor",
            label: "Instructor",
            href: "/admin/applications?type=INSTRUCTOR",
          },
        ]}
        count="12 applications"
      >
        <ul>
          <li>Ada Lovelace</li>
        </ul>
      </TrackerShell>,
    );

    expect(screen.getByRole("heading", { name: "Applications" })).toBeTruthy();
    expect(screen.getByText("Review applications and decisions.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Interviews" })).toBeTruthy();
    expect(screen.getByTestId("metrics")).toBeTruthy();
    expect(screen.getByText("12 applications")).toBeTruthy();

    // The view switcher is a tablist with the active view marked.
    const tablist = screen.getByRole("tablist", { name: "Applications views" });
    const active = within(tablist).getByRole("tab", { name: "All types" });
    expect(active.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });
});

describe("TrackerRow", () => {
  it("links the title and renders status, meta, next step, and one action", () => {
    render(
      <ul>
        <TrackerRow
          title="Confirm the venue"
          href="/actions/a1"
          status={{ label: "Overdue", tone: "danger", title: "9 days overdue" }}
          meta="Jordan · due Jun 9"
          nextStep="Call the venue today"
          action={<a href="/actions/a1">Open</a>}
        />
      </ul>,
    );

    const titleLink = screen.getByRole("link", { name: "Confirm the venue" });
    expect(titleLink.getAttribute("href")).toBe("/actions/a1");
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Jordan · due Jun 9")).toBeTruthy();
    expect(screen.getByText("Call the venue today")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open" })).toBeTruthy();
  });

  it("renders a plain title when no href is given", () => {
    render(
      <ul>
        <TrackerRow title="Untracked item" />
      </ul>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Untracked item")).toBeTruthy();
  });
});

describe("TrackerPreview", () => {
  it("renders the title, status, concrete facts, next step, and actions", () => {
    render(
      <TrackerPreview
        title="Beth El"
        status={{ label: "Needs follow-up", tone: "warning" }}
        facts={[
          { label: "Owner", value: "Sam" },
          { label: "Last contact", value: "Jun 2" },
        ]}
        nextStep="Send the renewal note"
        actions={<button type="button">Log meeting</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Beth El" })).toBeTruthy();
    expect(screen.getByText("Needs follow-up")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByText("Send the renewal note")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log meeting" })).toBeTruthy();
  });
});
