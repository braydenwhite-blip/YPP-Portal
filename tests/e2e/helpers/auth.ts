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
  blockedInstructor:
    process.env.E2E_BLOCKED_INSTRUCTOR_EMAIL ??
    "e2e.instructor.blocked.alpha@ypp.test",
  student: process.env.E2E_STUDENT_EMAIL ?? "e2e.student.alpha@ypp.test",
} as const;

export async function loginAs(
  page: Page,
  role: keyof typeof USERS,
  options?: {
    callbackUrl?: string;
  }
) {
  const loginUrl = options?.callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(options.callbackUrl)}`
    : "/login";

  await page.goto(loginUrl);
  await page.getByLabel("Email").fill(USERS[role]);
  await page.getByLabel("Password").fill(DEFAULT_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  if (options?.callbackUrl) {
    await expect(page).toHaveURL(
      new RegExp(options.callbackUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      {
        timeout: 45_000,
      }
    );
  } else {
    await expect(page).not.toHaveURL(/\/login/, {
      timeout: 45_000,
    });
  }

  const skipOnboardingButton = page.getByRole("button", {
    name: "Skip onboarding",
    exact: true,
  });

  if (await skipOnboardingButton.isVisible().catch(() => false)) {
    await skipOnboardingButton.click();
    await expect(page).not.toHaveURL(/\/onboarding$/);
  }
}
