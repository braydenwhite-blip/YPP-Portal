import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

test("@smoke chapter president can open the canonical recruiting workspace", async ({
  page,
}) => {
  await loginAs(page, "chapterLead");
  await page.goto("/chapter/recruiting?tab=candidates");

  await expect(
    page.getByRole("heading", { name: "Recruiting Command Center" })
  ).toBeVisible();
  await expect(page.getByText("Candidate Pipeline", { exact: true })).toBeVisible();
  await expect(page.getByText("Decision Queue", { exact: true })).toBeVisible();
});

test("@smoke chapter president is redirected away from admin analytics", async ({
  page,
}) => {
  await loginAs(page, "chapterLead");
  await page.goto("/admin/analytics");

  await expect(page).not.toHaveURL(/\/admin\/analytics$/);
});
