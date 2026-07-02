import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

// Browser smoke coverage for the three canonical mentorship homes:
//   /admin/mentorship  — admin command center
//   /mentorship        — mentor overview
//   /my-mentor         — mentee home
// Each test verifies the page loads, the key heading/landmark renders, core
// sections are present, and there is no obvious runtime crash.

test("@smoke admin can open the mentorship command center", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/mentorship");

  await expect(
    page.getByRole("heading", { name: "Mentorship Admin" })
  ).toBeVisible();

  // Calm (the default) leads with a single triage and demotes the full
  // eight-tab cockpit behind a disclosure — the triage region and the cockpit
  // toggle both render on arrival.
  await expect(
    page.getByRole("region", { name: "Mentorship triage" })
  ).toBeVisible();
  const cockpitToggle = page.getByText("Full oversight cockpit");
  await expect(cockpitToggle).toBeVisible();

  // Expanding the cockpit reveals the full tab navigation (parity with
  // Executive, which shows it inline).
  await cockpitToggle.click();
  await expect(page.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Relationships", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review", exact: true })).toBeVisible();
});

test("@smoke admin can open the mentor workspace", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/mentorship");

  await expect(
    page.getByRole("heading", { name: "Mentorship" })
  ).toBeVisible();
});

test("@smoke a mentored leader can open their mentee home", async ({ page }) => {
  await loginAs(page, "chapterLead");

  // /my-mentor is now the mentee POV of the unified hub.
  await page.goto("/my-mentor");
  await expect(page).toHaveURL(/\/mentorship\?view=me/);
  await expect(
    page.getByRole("heading", { name: "Mentorship" })
  ).toBeVisible();

  // The detail surfaces carry the "My development" sub-navigation.
  await page.goto("/my-mentor/goals");
  await expect(
    page.getByRole("navigation", { name: "My development sections" })
  ).toBeVisible();
  const myMentorNav = page.getByRole("navigation", { name: "My development sections" });
  await expect(myMentorNav.getByRole("link", { name: "Goals", exact: true })).toBeVisible();
  await expect(myMentorNav.getByRole("link", { name: "Get help", exact: true })).toBeVisible();
});

test("@smoke legacy /my-program mentee flows redirect into /my-mentor", async ({
  page,
}) => {
  await loginAs(page, "chapterLead");

  await page.goto("/my-program/gr");
  await expect(page).toHaveURL(/\/my-mentor\/goals$/);

  await page.goto("/my-program/schedule");
  await expect(page).toHaveURL(/\/my-mentor\/schedule$/);

  await page.goto("/my-program/awards");
  await expect(page).toHaveURL(/\/my-mentor\/awards$/);
});

test("@smoke a mentee can open their recognition & awards page", async ({ page }) => {
  await loginAs(page, "chapterLead");
  await page.goto("/my-mentor/awards");

  await expect(
    page.getByRole("heading", { name: "My Recognition & Awards" })
  ).toBeVisible();
});

test("@smoke admin can open the canonical Goals & Resources workspace", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await page.goto("/admin/mentorship/gr");

  await expect(
    page.getByRole("heading", { name: "Goals & Resources" })
  ).toBeVisible();

  // The shared admin G&R sub-navigation ties the area together.
  await expect(
    page.getByRole("navigation", { name: "Goals & Resources admin sections" })
  ).toBeVisible();

  // Legacy admin G&R routes redirect into the canonical area.
  await page.goto("/admin/mentorship-program/gr-templates");
  await expect(page).toHaveURL(/\/admin\/mentorship\/gr\/templates$/);
});
