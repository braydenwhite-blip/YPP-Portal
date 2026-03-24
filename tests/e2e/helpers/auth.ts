import { expect, type Page } from "@playwright/test";

const DEFAULT_PASSWORD =
  process.env.E2E_SEED_PASSWORD ??
  process.env.SEED_PASSWORD ??
  "CodexE2E!2026";

const USERS = {
  admin: process.env.E2E_ADMIN_EMAIL ?? "e2e.admin@ypp.test",
  chapterLead:
    process.env.E2E_CHAPTER_PRESIDENT_EMAIL ??
    "e2e.chapter.lead.alpha@ypp.test",
  student: process.env.E2E_STUDENT_EMAIL ?? "e2e.student.alpha@ypp.test",
} as const;

export async function loginAs(
  page: Page,
  role: keyof typeof USERS
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(USERS[role]);
  await page.getByLabel("Password").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await expect(page).not.toHaveURL(/\/login/);

  const skipOnboardingButton = page.getByRole("button", {
    name: "Skip onboarding",
    exact: true,
  });

  if (await skipOnboardingButton.isVisible().catch(() => false)) {
    await skipOnboardingButton.click();
    await expect(page).not.toHaveURL(/\/onboarding$/);
  }
}
