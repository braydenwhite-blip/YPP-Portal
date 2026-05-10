import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

test("@nightly admin can review readiness, mentorship, and legacy compatibility surfaces", async ({
  page,
}) => {
  await loginAs(page, "admin");

  await page.goto("/admin/instructor-readiness");
  await expect(
    page.getByRole("heading", { name: "Instructor Readiness Command Center" })
  ).toBeVisible();

  await page.goto("/admin/mentorship-program");
  await expect(
    page.getByRole("heading", { name: "Instructor Mentorship Command Center" })
  ).toBeVisible();

  await page.goto("/admin/instructor-applicants");
  await expect(
    page.getByText("This page is kept for compatibility.", { exact: false })
  ).toBeVisible();

  await page.goto("/admin/chapter-president-applicants");
  await expect(
    page.getByText("This page is kept for compatibility.", { exact: false })
  ).toBeVisible();
});
