import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

test("@smoke instructor can open the lesson design studio draft and key overlays", async ({
  page,
}) => {
  await loginAs(page, "blockedInstructor", {
    callbackUrl: "/instructor/lesson-design-studio",
  });

  await expect(
    page.getByRole("heading", { name: "Lesson Design Studio" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Open Working Draft" }).first().click();
  await expect(page).toHaveURL(/\/instructor\/lesson-design-studio\/.+\/.+/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Choose a starter" })
  ).toBeVisible();

  await page.getByRole("button", { name: /^Comments/ }).click();
  await expect(page.locator(".lds-comment-sidebar")).toBeVisible();
  await page.getByRole("button", { name: "Close comments" }).click();
  await expect(page.locator(".lds-comment-sidebar")).toBeHidden();

  await page.getByRole("button", { name: "Examples library" }).click();
  await expect(
    page.getByRole("dialog", { name: "Examples library" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Close examples library" }).click();
  await expect(
    page.getByRole("dialog", { name: "Examples library" })
  ).toBeHidden();

  await page.getByRole("link", { name: /Sessions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Course roadmap" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Preview session" }).click();
  await expect(
    page.getByRole("dialog", { name: /Student preview for/i })
  ).toBeVisible();
  await page.getByRole("button", { name: "Close student preview" }).click();
  await expect(
    page.getByRole("dialog", { name: /Student preview for/i })
  ).toBeHidden();

  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
});

test("@smoke instructor lesson design studio remains usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "blockedInstructor", {
    callbackUrl: "/instructor/lesson-design-studio",
  });

  await page.getByRole("button", { name: "Open Working Draft" }).first().click();
  await expect(page).toHaveURL(/\/instructor\/lesson-design-studio\/.+\/.+/, { timeout: 20_000 });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 4
  );
  expect(hasHorizontalOverflow).toBe(false);

  await expect(page.getByRole("button", { name: /^Comments/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose a starter" })
  ).toBeVisible();
});
