import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

test("@smoke admin can open the Chapter Command center", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/chapters");

  await expect(page.getByRole("heading", { name: "Chapter Command" })).toBeVisible();
  // Lifecycle/signal views and summary tiles render.
  await expect(page.getByText("Launching", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("At risk", { exact: true }).first()).toBeVisible();
});

test("@smoke admin can open the national chapter map", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/chapters/map");

  await expect(page.getByRole("heading", { name: "National Chapter Map" })).toBeVisible();
  await expect(page.getByText("Chapter density by state")).toBeVisible();
});

test("@smoke admin can open national growth analytics", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/chapters/analytics");

  await expect(page.getByRole("heading", { name: "National Growth Analytics" })).toBeVisible();
  await expect(page.getByText("Chapters per state")).toBeVisible();
});

test("@smoke the Become a Chapter President opportunity surfaces with live stats", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/chapter/apply");

  await expect(page.getByRole("heading", { name: "Become a Chapter President" })).toBeVisible();
  await expect(page.getByText("Active chapters", { exact: true })).toBeVisible();
});

test("@smoke a chapter president can open their chapter operating system", async ({ page }) => {
  await loginAs(page, "chapterLead");
  await page.goto("/chapter");

  await expect(page.getByRole("heading", { name: /Chapter Operating System/ })).toBeVisible();
  // The five lanes are all reachable as tabs on the one page.
  await expect(page.getByRole("link", { name: "Partners" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Instructors" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Actions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Meetings" })).toBeVisible();

  // The legacy /chapter/workspace and /chapter/operating surfaces now
  // consolidate into this single page.
  await page.goto("/chapter/workspace");
  await expect(page).toHaveURL(/\/chapter$/);
  await page.goto("/chapter/operating");
  await expect(page).toHaveURL(/\/chapter$/);
});

test("@smoke students cannot reach the leadership chapter command", async ({ page }) => {
  await loginAs(page, "student");
  await page.goto("/admin/chapters");

  // The leadership-only command center redirects non-leadership away.
  await expect(page).not.toHaveURL(/\/admin\/chapters$/);
});
