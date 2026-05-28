import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

// Browser smoke coverage for the three canonical mentorship homes:
//   /admin/mentorship  — admin command center
//   /mentorship        — mentor workspace
//   /my-mentor         — mentee home
// Each test verifies the page loads, the key heading/landmark renders, core
// sections are present, and there is no obvious runtime crash.

test("@smoke admin can open the mentorship command center", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/mentorship");

  await expect(
    page.getByRole("heading", { name: "Instructor Mentorship Oversight" })
  ).toBeVisible();

  // Core tab navigation renders.
  await expect(page.getByRole("link", { name: "Overview / Pulse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Needs Attention" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Approvals" })).toBeVisible();
});

test("@smoke admin can open the mentor workspace", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/mentorship");

  await expect(
    page.getByRole("heading", { name: "Mentor Workspace" })
  ).toBeVisible();
});

test("@smoke a mentored leader can open their mentee home", async ({ page }) => {
  await loginAs(page, "chapterLead");
  await page.goto("/my-mentor");

  await expect(
    page.getByRole("heading", { name: "My Mentorship" })
  ).toBeVisible();

  // The supportive sub-navigation ties the mentee flows together.
  await expect(
    page.getByRole("navigation", { name: "My Mentorship sections" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Goals" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get Help" })).toBeVisible();
});

test("@smoke legacy /my-program mentee flows redirect into /my-mentor", async ({
  page,
}) => {
  await loginAs(page, "chapterLead");

  await page.goto("/my-program/gr");
  await expect(page).toHaveURL(/\/my-mentor\/goals$/);

  await page.goto("/my-program/schedule");
  await expect(page).toHaveURL(/\/my-mentor\/schedule$/);
});
