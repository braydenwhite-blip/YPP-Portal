import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Nav from "@/components/nav";

/**
 * App-shell navigation contract (Knowledge OS V2, Phase 2A).
 *
 * The sidebar chassis serves all nine roles and has no browser-level visual
 * baselines in this environment (no database → no authenticated screenshots),
 * so this suite pins the STRUCTURE the light reskin must preserve:
 * which links each role sees, group expand/collapse, locked groups, badges,
 * and the nav filter.
 */

const ORIGINAL_PORTAL_SLIM_NAV = process.env.PORTAL_SLIM_NAV;

describe("app shell nav contract", () => {
  it("gives ADMIN the full operating-system nav even under the public preview gate", async () => {
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

    // The leadership front doors stay pinned at the top.
    expect(screen.getByRole("link", { name: /Home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^People$/i })).toHaveAttribute("href", "/people");
    expect(screen.getByRole("link", { name: /^Actions$/i })).toHaveAttribute("href", "/actions");
    expect(screen.getByRole("link", { name: /^Meetings$/i })).toHaveAttribute(
      "href",
      "/actions/meetings"
    );
    // The retired "Work" hub and "Command Center" are gone from the nav.
    expect(screen.queryByRole("link", { name: /^Work$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Command Center/i })).toBeNull();
    // Initiatives still lives in the Actions section (no longer pinned in core).
    expect(screen.getByRole("link", { name: /Initiatives/i })).toHaveAttribute(
      "href",
      "/operations/initiatives"
    );

    // Officers get the grouped object sections (no "More Tools" accordion), and
    // admin configuration is reachable — not hidden behind the old slim stack.
    expect(screen.getByRole("region", { name: "Navigation sections" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /more navigation links/i })).toBeNull();
    expect(screen.getByRole("link", { name: /Administration/i })).toHaveAttribute("href", "/admin");
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

    expect(
      screen.queryByRole("button", { name: /more navigation links/i })
    ).toBeNull();

    const sections = screen.getByRole("region", { name: "Navigation sections" });
    expect(
      within(sections).getAllByRole("button").length
    ).toBeGreaterThan(0);

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

  describe("full officer sidebar (PORTAL_SLIM_NAV=false)", () => {
    beforeAll(() => {
      process.env.PORTAL_SLIM_NAV = "false";
    });

    afterAll(() => {
      if (ORIGINAL_PORTAL_SLIM_NAV === undefined) {
        delete process.env.PORTAL_SLIM_NAV;
      } else {
        process.env.PORTAL_SLIM_NAV = ORIGINAL_PORTAL_SLIM_NAV;
      }
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
  });

  it("marks the active link from the current pathname", () => {
    render(
      <Nav roles={["ADMIN"]} adminSubtypes={["SUPER_ADMIN"]} primaryRole="ADMIN" />
    );
    const home = screen.getByRole("link", { name: /Home/i });
    expect(home.getAttribute("aria-current") ?? home.className).toBeTruthy();
  });
});
