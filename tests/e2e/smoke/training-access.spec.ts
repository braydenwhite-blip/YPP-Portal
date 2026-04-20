import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

test("@smoke applicant cannot access instructor training before approval", async ({
  page,
}) => {
  await loginAs(page, "applicant");

  await page.goto("/instructor-training");
  await expect(page).toHaveURL(/\/application-status/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Curriculum Prep Before Training" })
  ).toBeVisible();

  await page.goto("/training/not-a-real-training-module");
  await expect(page).toHaveURL(/\/application-status/, { timeout: 20_000 });

  await page.goto("/instructor/lesson-design-studio?entry=application-status");
  await expect(
    page.getByRole("heading", { name: "Lesson Design Studio" })
  ).toBeVisible();
});
