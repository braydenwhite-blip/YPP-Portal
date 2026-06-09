import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  StrategicBreadcrumbs,
  StrategicWorkspaceHeader,
  StrategicWorkspaceNav,
} from "@/components/people-strategy/strategic-workspace-nav";

describe("StrategicWorkspaceNav", () => {
  it("renders the seven workspace destinations with the right hrefs", () => {
    render(<StrategicWorkspaceNav current="projects" />);
    const nav = screen.getByRole("navigation", { name: "Strategic workspace" });
    const expected: Array<[string, string]> = [
      ["Command Center", "/operations/command-center"],
      ["Portfolio", "/operations/portfolio"],
      ["Initiatives", "/operations/initiatives"],
      ["Projects", "/operations/projects"],
      ["Weekly Review", "/operations/weekly-review"],
      ["Actions", "/actions/command-center"],
      ["Meetings", "/actions/meetings"],
    ];
    for (const [label, href] of expected) {
      expect(within(nav).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("marks only the current destination as the active page", () => {
    render(<StrategicWorkspaceNav current="projects" />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Portfolio" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing active when current is omitted", () => {
    render(<StrategicWorkspaceNav />);
    expect(screen.getAllByRole("link").every((link) => !link.getAttribute("aria-current"))).toBe(true);
  });

  it("hides the strategic-flag-gated destinations when showStrategic is false", () => {
    render(<StrategicWorkspaceNav current="command-center" showStrategic={false} />);
    // Always-available destinations stay.
    expect(screen.getByRole("link", { name: "Command Center" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Weekly Review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meetings" })).toBeInTheDocument();
    // Strategic-only destinations are omitted so they cannot 404.
    expect(screen.queryByRole("link", { name: "Portfolio" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Initiatives" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
  });
});

describe("StrategicBreadcrumbs", () => {
  it("renders nothing for an empty trail", () => {
    const { container } = render(<StrategicBreadcrumbs trail={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links every crumb except the current (last) one", () => {
    render(
      <StrategicBreadcrumbs
        trail={[
          { label: "Portfolio", href: "/operations/portfolio" },
          { label: "Summer Camps 2026", href: "/operations/initiatives/summer-camps-2026" },
          { label: "Beth El Pilot" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Portfolio" })).toHaveAttribute(
      "href",
      "/operations/portfolio",
    );
    expect(screen.getByRole("link", { name: "Summer Camps 2026" })).toHaveAttribute(
      "href",
      "/operations/initiatives/summer-camps-2026",
    );
    // The current page is the last crumb — it must not be a link.
    expect(screen.queryByRole("link", { name: "Beth El Pilot" })).toBeNull();
    expect(screen.getByText("Beth El Pilot")).toHaveAttribute("aria-current", "page");
  });
});

describe("StrategicWorkspaceHeader", () => {
  it("composes breadcrumbs, the title, and the active workspace nav", () => {
    render(
      <StrategicWorkspaceHeader
        current="projects"
        breadcrumbs={[
          { label: "Projects", href: "/operations/projects" },
          { label: "Beth El Pilot" },
        ]}
        eyebrow="People Strategy"
        title="Beth El Pilot"
        subtitle="A concrete body of work"
      />,
    );
    expect(screen.getByRole("heading", { name: "Beth El Pilot" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Strategic workspace" });
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
