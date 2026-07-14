import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_SEED_PASSWORD ?? "CodexE2E!2026";

const USERS = {
  admin: "e2e.admin@ypp.test",
  mentee: "e2e.mentee.monthly@ypp.test",
  mentor: "e2e.mentor.alpha@ypp.test",
  chair: "e2e.chair.instructor@ypp.test",
  committee: "e2e.committee.instructor@ypp.test",
};

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.request.post("/api/auth/local-password", {
        data: { email, password: PASSWORD },
        timeout: 60_000,
      });
      expect(response.ok(), `local login failed for ${email}`).toBeTruthy();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

test.describe("canonical Mentorship lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test("admin → mentee → mentor → Role Chair monthly flow", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(60_000);

    // Admin finds the person in Mentorship, assigns an overloaded mentor with
    // an explicit override, assigns Current G&R, and completes kickoff.
    await login(page, USERS.admin);
    await page.goto("/mentorship?view=admin");
    await expect(page.getByRole("heading", { name: "Who needs something from me?" })).toBeVisible();
    await page.getByLabel("Search mentorship people").fill("E2E Monthly Flow Mentee");
    await page
      .getByRole("region", { name: "Find a person" })
      .getByRole("link", { name: /E2E Monthly Flow Mentee/ })
      .click();
    await expect(page).toHaveURL(/\/mentorship\/people\//);
    const personPath = new URL(page.url()).pathname;

    await page.getByRole("link", { name: /Assign a mentor/ }).first().click();
    await expect(page.getByRole("heading", { name: "Finish mentorship setup" })).toBeVisible();
    await page.getByLabel("Search any active member").fill("E2E Mentor Alpha");
    const mentorSelect = page.locator('select[name="newMentorId"]');
    await expect(mentorSelect.locator("option")).toHaveCount(2);
    await mentorSelect.selectOption({ index: 1 });
    await expect(page.getByText(/Capacity warning:/)).toBeVisible();
    await page.getByRole("button", { name: "Assign anyway" }).click();

    const templateSelect = page.getByLabel("Approved template");
    await expect(templateSelect).toBeVisible();
    const templateOption = templateSelect.locator("option").filter({
      hasText: "E2E Instructor Current G&R",
    });
    await templateSelect.selectOption((await templateOption.getAttribute("value")) ?? "");
    await page.getByRole("button", { name: "Assign and activate" }).click();
    await expect(page.getByText("Setup is complete.")).toBeVisible();

    await page.getByRole("link", { name: "Meetings", exact: true }).click();
    await page.getByRole("button", { name: "Mark first meeting done" }).click();
    await expect(page.getByText("Reflection due")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("01-admin-setup-complete.png"), fullPage: true });

    // Mentee sends a short monthly note from Feedback.
    await login(page, USERS.mentee);
    await page.goto("/mentorship");
    await expect(page).toHaveURL(new RegExp(`${personPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await page.getByRole("link", { name: "Feedback", exact: true }).click();
    await page.getByPlaceholder("It was pretty good / busy / hard because…").fill(
      "I improved the robotics lesson sequence and used learner feedback to choose the next iteration."
    );
    await page.getByPlaceholder("I finished… / I felt proud of…").fill("Short learner feedback loops.");
    await page.getByPlaceholder("I got stuck on… / I wish I had help with…").fill(
      "One observation from my mentor."
    );
    await page.getByRole("button", { name: "Send to mentor" }).click();
    await expect(page).toHaveURL(
      new RegExp(`${personPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?section=reviews`)
    );
    await expect(page.getByText(/waiting on your mentor/i)).toBeVisible();

    // Mentor logs the meeting from Feedback, then sends feedback on the same tab.
    await login(page, USERS.mentor);
    await page.goto(`${personPath}?section=reviews`);
    await page.getByRole("button", { name: "Log a meeting" }).click();
    await page.getByPlaceholder("What did you cover?").fill(
      "Reviewed the reflection and agreed on the next learner outcome."
    );
    await page.getByRole("button", { name: "Save meeting" }).click();
    await expect(page.getByRole("heading", { name: /Send feedback/ })).toBeVisible();
    await page.getByRole("button", { name: "On track" }).click();
    await page.getByPlaceholder("You did a great job with…").fill(
      "Strong progress: the lesson sequence is ready and the mentee is using learner evidence."
    );
    await page.getByPlaceholder("Next, try…").fill(
      "Deliver the revised lesson, measure one learner outcome, and bring it to the next meeting."
    );
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText(/Feedback is with the chair/i)).toBeVisible();

    // Chair requests a small tweak.
    await login(page, USERS.chair);
    await page.goto(`${personPath}?section=reviews&panel=approve`);
    await expect(page.getByText("Ready for decision")).toBeVisible();
    await expect(page.getByText("Meeting note")).toBeVisible();
    await page.getByPlaceholder("Optional feedback for the mentor…").fill(
      "Name the measurable learner outcome and make its owner explicit."
    );
    await page.getByRole("button", { name: "Request Changes" }).click();
    await expect(page.getByText("Changes requested", { exact: true })).toBeVisible();

    // Mentor fixes and resends.
    await login(page, USERS.mentor);
    await page.goto(`${personPath}?section=reviews`);
    await expect(page.getByText(/Name the measurable learner outcome/)).toBeVisible();
    await page.getByPlaceholder("You did a great job with…").fill(
      "Strong progress: the mentee owns measuring completion rate for the first revised learner activity."
    );
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText(/Feedback is with the chair/i)).toBeVisible();

    // Chair approves and shares.
    await login(page, USERS.chair);
    await page.goto(`${personPath}?section=reviews&panel=approve`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Approve & release" }).click();
    await expect(page.getByText("Released", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("02-chair-release-complete.png"), fullPage: true });

    await login(page, USERS.mentee);
    await page.goto(`${personPath}?section=reviews`);
    await expect(
      page.getByText(/mentee owns measuring completion rate/i)
    ).toBeVisible();
  });

  test("committee member can open the quarterly packet from Mentorship", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(60_000);
    await login(page, USERS.committee);
    await page.goto("/mentorship");
    await expect(page.getByRole("heading", { name: /Quarterly committee reviews due/ })).toBeVisible();
    await page.getByRole("link", { name: /E2E Quarterly Review Mentee/ }).click();
    await expect(page.getByText(/Quarterly Committee Review/).first()).toBeVisible();
    await expect(page.getByText("Pathway Decision")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("03-quarterly-committee-packet.png"), fullPage: true });
    await settle(page);
  });
});
