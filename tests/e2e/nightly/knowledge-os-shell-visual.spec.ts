import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

/**
 * Knowledge OS V2 — app shell + master database screenshot baselines.
 *
 * Captures the dark premium sidebar chassis and the Phase 2A surfaces for
 * visual-regression comparison (Tailwind addendum §8.4). Requires a seeded
 * database (`npm run test:e2e:seed`) and a running portal — environments
 * without a DATABASE_URL (e.g. the remote build sandbox this shipped from)
 * cannot run it; the structural contract lives in
 * tests/components/app-shell-nav-contract.test.tsx instead.
 *
 * First run records baselines (`--update-snapshots`); later runs diff
 * against them. Animations are disabled and dynamic data regions masked so
 * the chrome — not the data — is what's pinned.
 */

const SHELL_ROUTES: Array<{ name: string; path: string; role: "admin" | "student" }> = [
  { name: "home", path: "/", role: "admin" },
  { name: "help-agent", path: "/help-agent", role: "admin" },
  { name: "admin-home", path: "/admin", role: "admin" },
  { name: "people", path: "/people", role: "admin" },
  { name: "partners", path: "/partners", role: "admin" },
  { name: "student-home", path: "/", role: "student" },
];

test.describe("knowledge-os shell visual baselines", () => {
  for (const route of SHELL_ROUTES) {
    test(`${route.role} ${route.name} (${route.path})`, async ({ page }) => {
      await loginAs(page, route.role);
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // The sidebar is the cross-role contract; screenshot it alone first so
      // a content change on one page never invalidates the chrome baseline.
      const sidebar = page.locator("#portal-sidebar");
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveScreenshot(
        `sidebar-${route.role}-${route.name}.png`,
        { animations: "disabled", maxDiffPixelRatio: 0.02 }
      );

      await expect(page).toHaveScreenshot(`page-${route.role}-${route.name}.png`, {
        fullPage: false,
        animations: "disabled",
        maxDiffPixelRatio: 0.03,
        // Data-bearing regions move run to run; the layout must not.
        mask: [page.locator("main")],
      });
    });
  }
});
