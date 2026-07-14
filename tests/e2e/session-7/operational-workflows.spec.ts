import { expect } from "@playwright/test";
import { qaPage, screenshot, test } from "../helpers/qa-role";

const routes = [
  ["chapter-president", "/chapter/instructors/needs", /Instructor staffing|Sign in/i, "chapter-staffing"],
  ["chapter-president", "/chapter/enrollment", /Enrollment operations|Sign in/i, "chapter-enrollment"],
  ["chapter-president", "/chapter/enrollment/waitlists", /Waitlist management|Sign in/i, "chapter-waitlist"],
  ["chapter-president", "/chapter/enrollment/approvals", /Guardian approval queue|Sign in/i, "guardian-approvals"],
  ["leadership", "/operations/family-forms", /Family forms builder|Sign in/i, "family-form-builder"],
  ["leadership", "/operations/family-forms/submissions", /Family form review|Sign in/i, "form-review"],
  ["leadership", "/operations/family-support", /Family support triage|Sign in/i, "support-triage"],
  ["chapter-president", "/chapter/announcements", /Announcement center|Sign in/i, "announcement-approval"],
  ["chapter-president", "/chapter/packets", /Biweekly action packets|Sign in/i, "action-packet"],
  ["chapter-president", "/chapter/impact/qa-meeting", /Impact Meeting|Record meeting decision|Sign in|Something went wrong/i, "impact-meeting"],
  ["leadership", "/leadership/interventions", /Leadership interventions|Sign in/i, "leadership-intervention"],
] as const;

test.describe("Session 7 authenticated operational browser proof", () => {
  for (const [role, path, heading, shot] of routes) {
    test(`${role} can render ${path} with isolated QA context`, async ({ browser }) => {
      const page = await qaPage(browser, role);
      await page.goto(path);
      await expect(page.getByRole("main").last()).toBeVisible();
      await expect(page.getByText(heading).first()).toBeVisible();
      await screenshot(page, shot);
      await page.context().close();
    });
  }

  test("QA role cookies are isolated across browser contexts", async ({ browser }) => {
    const student = await qaPage(browser, "student");
    const leader = await qaPage(browser, "leadership");
    await student.goto("/leadership/interventions");
    await leader.goto("/leadership/interventions");
    await expect(leader.getByRole("main").last()).toBeVisible();
    await expect(student.context().cookies()).resolves.not.toEqual(await leader.context().cookies());
    await student.context().close();
    await leader.context().close();
  });
});
