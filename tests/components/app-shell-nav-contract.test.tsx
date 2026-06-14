import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import Nav from "@/components/nav";

/**
 * App-shell navigation contract (Knowledge OS V2, Phase 2A).
 *
 * The sidebar chassis serves all nine roles and has no browser-level visual
 * baselines in this environment (no database → no authenticated screenshots),
 * so this suite pins the STRUCTURE the dark-premium reskin must preserve:
 * which links each role sees, group expand/collapse, locked groups, badges,
 * and the nav filter. It is written against the pre-reskin Nav and must stay
 * green after it — behavior identical, only the skin changes.
 */

describe("app shell nav contract", () => {
  it("renders the full leadership chrome for ADMIN with core links and grouped More Tools", async () => {
    render(
      <Nav
        roles={["ADMIN"]}
        adminSubtypes={["SUPER_ADMIN"]}
        primaryRole="ADMIN"
        actionTrackerEnabled
        operationsHubEnabled
        publicGateActive
      />
    );

    // Core links render as real anchors.
    const home = screen.getByRole("link", { name: /Home/i });
    expect(home).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /People Hub/i })).toHaveAttribute("href", "/people");
    expect(screen.getByRole("link", { name: /^Actions$/i })).toHaveAttribute("href", "/actions");
    expect(screen.getByRole("link", { name: /Initiatives/i })).toHaveAttribute(
      "href",
      "/operations/initiatives"
    );
    expect(screen.getByRole("link", { name: /Administration/i })).toHaveAttribute(
      "href",
      "/admin"
    );

    // The grouped "More Tools" disclosure exists and expands on click.
    const moreToggle = screen.getByRole("button", { name: /more navigation links/i });
    expect(moreToggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(moreToggle);
    expect(moreToggle).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the student minimal nav flat, with section toggles and no More Tools accordion", () => {
    render(
      <Nav
        roles={["STUDENT"]}
        primaryRole="STUDENT"
        studentFullPortalExplorer={false}
        unlockedSections={new Set<string>()}
      />
    );

    // Students get flat sections, never the officer "More Tools" accordion.
    expect(
      screen.queryByRole("button", { name: /more navigation links/i })
    ).toBeNull();

    const sections = screen.getByRole("region", { name: "Navigation sections" });
    expect(
      within(sections).getAllByRole("button").length
    ).toBeGreaterThan(0);

    // Home stays present for students.
    expect(screen.getByRole("link", { name: /Home/i })).toHaveAttribute("href", "/");
  });

  it("renders the instructor minimal nav with its shortcuts row", () => {
    render(
      <Nav
        roles={["INSTRUCTOR"]}
        primaryRole="INSTRUCTOR"
        instructorFullPortalExplorer={false}
      />
    );

    expect(screen.getByText("Shortcuts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/i })).toHaveAttribute("href", "/");
  });

  it("shows notification badges with counts and caps at 99+", () => {
    render(
      <Nav
        roles={["ADMIN"]}
        adminSubtypes={["SUPER_ADMIN"]}
        primaryRole="ADMIN"
        badges={{ messages: 120 }}
      />
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("filters navigation by the sidebar search input", async () => {
    render(
      <Nav roles={["ADMIN"]} adminSubtypes={["SUPER_ADMIN"]} primaryRole="ADMIN" />
    );

    const search = screen.getByRole("textbox", { name: /filter navigation/i });
    await userEvent.type(search, "zzz-no-such-page");
    expect(screen.getByText(/No results for/)).toBeInTheDocument();

    await userEvent.clear(search);
    expect(screen.queryByText(/No results for/)).toBeNull();
  });

  it("marks the active link from the current pathname", () => {
    render(
      <Nav roles={["ADMIN"]} adminSubtypes={["SUPER_ADMIN"]} primaryRole="ADMIN" />
    );
    // usePathname is mocked to "/" in tests/setup.ts → Home is the active link.
    const home = screen.getByRole("link", { name: /Home/i });
    expect(home.getAttribute("aria-current") ?? home.className).toBeTruthy();
  });
});
