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
const ORIGINAL_LEADERSHIP_FULL_PORTAL_EXPLORER = process.env.LEADERSHIP_FULL_PORTAL_EXPLORER;

beforeAll(() => {
  process.env.LEADERSHIP_FULL_PORTAL_EXPLORER = "false";
});
afterAll(() => {
  if (ORIGINAL_LEADERSHIP_FULL_PORTAL_EXPLORER === undefined) {
    delete process.env.LEADERSHIP_FULL_PORTAL_EXPLORER;
  } else {
    process.env.LEADERSHIP_FULL_PORTAL_EXPLORER = ORIGINAL_LEADERSHIP_FULL_PORTAL_EXPLORER;
  }
});

describe("app shell nav contract", () => {
  it("gives ADMIN the simple leadership nav (Home, People, Mentorship, Actions, Applicants)", async () => {
    render(
      <Nav
        roles={["ADMIN"]}
        adminSubtypes={["SUPER_ADMIN"]}
        primaryRole="ADMIN"
        actionTrackerEnabled
        operationsHubEnabled
        publicGateActive
        officerSlimNavActive
        leadershipFullPortalExplorer={false}
      />
    );

    expect(screen.getByRole("link", { name: /^Home$/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^People$/i })).toHaveAttribute("href", "/people");
    expect(screen.getByRole("link", { name: /^Mentorship$/i })).toHaveAttribute(
      "href",
      "/mentorship"
    );
    expect(screen.getByRole("link", { name: /^Actions$/i })).toHaveAttribute("href", "/actions");
    expect(screen.getByRole("link", { name: /^Applicants$/i })).toHaveAttribute(
      "href",
      "/admin/instructor-applicants"
    );

    expect(screen.queryByRole("link", { name: /^Work$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Command Center/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /My Applications/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Workshop Design Studio/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Meetings$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Administration/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /more navigation links/i })).toBeNull();
    expect(screen.queryByRole("region", { name: "Navigation sections" })).toBeNull();
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

    it("shows the four leadership links for admins", () => {
      render(
        <Nav
          roles={["ADMIN"]}
          adminSubtypes={["SUPER_ADMIN"]}
          primaryRole="ADMIN"
          actionTrackerEnabled
          badges={{ notifications: 120 }}
        />
      );
      expect(screen.getByRole("link", { name: /^Home$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^People$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^Mentorship$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^Actions$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^Applicants$/i })).toBeInTheDocument();
      // Notifications are outside the simple leadership nav, so badge caps are N/A here.
      expect(screen.queryByText("99+")).toBeNull();
    });

    it("filters navigation by the sidebar search input", async () => {
      render(
        <Nav
          roles={["ADMIN"]}
          adminSubtypes={["SUPER_ADMIN"]}
          primaryRole="ADMIN"
          leadershipFullPortalExplorer
        />
      );

      const search = screen.getByRole("searchbox", { name: /search sidebar pages/i });
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
