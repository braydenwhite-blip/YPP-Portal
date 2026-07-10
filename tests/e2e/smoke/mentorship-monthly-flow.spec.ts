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

    await page.getByRole("link", { name: "Check-ins", exact: true }).click();
    await page.getByRole("button", { name: "Mark kickoff complete" }).click();
    await expect(page.getByText("Waiting on reflection")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("01-admin-setup-complete.png"), fullPage: true });

    // Mentee submits the guided Self-Reflection from the same person workspace.
    await login(page, USERS.mentee);
    await page.goto("/mentorship");
    await expect(page).toHaveURL(new RegExp(`${personPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await page.getByRole("link", { name: "Reviews", exact: true }).click();
    await page.getByPlaceholder("Share your overall reflection on the past month…").fill(
      "I improved the robotics lesson sequence and used learner feedback to choose the next iteration."
    );
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByPlaceholder("Describe your overall engagement and fulfillment…").fill("Focused and engaged.");
    await page.getByPlaceholder("Describe what's been working well…").fill("Short learner feedback loops.");
    await page.getByPlaceholder("Describe what support or resources you need…").fill("One observation from my mentor.");
    await page.getByPlaceholder("Assess your mentor's support and helpfulness…").fill("Specific and timely.");
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByPlaceholder("Describe your leadership team collaboration this month…").fill(
      "We documented decisions and followed through."
    );
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByPlaceholder("Describe the progress made…").fill("Completed the learner-centered lesson draft.");
    await page.getByPlaceholder("List your accomplishments for this goal…").fill("Piloted two revised activities.");
    await page.getByPlaceholder("Describe your plans for next month…").fill("Measure outcomes in the first delivery.");
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByPlaceholder("Any additional thoughts, context, or notes…").fill("Ready for the Mentor Check-in.");
    await page.getByRole("button", { name: "Submit Reflection" }).click();
    await expect(page).toHaveURL(
      new RegExp(`${personPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?section=reviews`)
    );
    await expect(page.getByText("Mentor Check-in due")).toBeVisible();

    // Mentor records the cycle-bound Check-in, then writes the Progress Update.
    await login(page, USERS.mentor);
    await page.goto(personPath);
    await page.getByRole("link", { name: "Record the Mentor Check-in" }).click();
    await page.getByRole("button", { name: "Record Mentor Check-in" }).click();
    await page.getByLabel("Wins").fill("The lesson sequence is clearer and learner feedback is visible.");
    await page.getByLabel("Discussion").fill("We reviewed the reflection, work evidence, and next outcome.");
    await page.getByLabel("Decisions").fill("Run the revised lesson and measure the first learner outcome.");
    await page.getByLabel("Commitments").fill("Mentee will record the first learner outcome next week.");
    await page.getByRole("button", { name: "Complete Mentor Check-in" }).click();
    await expect(page.getByText("Progress Update due")).toBeVisible();
    await page.getByRole("link", { name: "Write the Monthly Progress Update" }).click();
    await expect(page.getByRole("heading", { name: /Write the .* Monthly Progress Update/ })).toBeVisible();
    const achievedButtons = page.getByRole("button", { name: "Achieved", exact: true });
    for (let index = 0; index < (await achievedButtons.count()); index += 1) {
      await achievedButtons.nth(index).click();
    }
    await page.getByLabel(/Progress after release for/).selectOption("IN_PROGRESS");
    await page.getByPlaceholder("Summarize performance for this cycle...").fill(
      "Strong progress: the lesson sequence is ready and the mentee is using learner evidence."
    );
    await page.getByPlaceholder("What should they focus on next month?").fill(
      "Deliver the revised lesson, measure one learner outcome, and bring it to the next Check-in."
    );
    await page.getByRole("button", { name: "Submit for Approval" }).click();
    await expect(page.getByText("Waiting on Role Chair approval")).toBeVisible();

    // The non-admin lane Chair receives a decision-ready packet and requests changes.
    await login(page, USERS.chair);
    await page.goto(`${personPath}?section=reviews&panel=approve`);
    await expect(page.getByText("Ready for decision")).toBeVisible();
    await expect(page.getByText("Mentor Check-in context")).toBeVisible();
    await page.getByPlaceholder("Optional feedback for the mentor…").fill(
      "Name the measurable learner outcome and make its owner explicit."
    );
    await page.getByRole("button", { name: "Request Changes" }).click();
    await expect(page.getByText("Changes requested", { exact: true })).toBeVisible();
    await expect(page.getByText(/Owner:\s*E2E Mentor Alpha/)).toBeVisible();

    // Mentor sees the Chair feedback, revises, and resubmits.
    await login(page, USERS.mentor);
    await page.goto(personPath);
    await page.getByRole("link", { name: "Revise your review" }).click();
    await expect(page.getByText(/Name the measurable learner outcome/)).toBeVisible();
    await page.getByPlaceholder("Summarize performance for this cycle...").fill(
      "Strong progress: the mentee owns measuring completion rate for the first revised learner activity."
    );
    await page.getByRole("button", { name: "Submit for Approval" }).click();
    await expect(page.getByText("Waiting on Role Chair approval")).toBeVisible();

    // Chair approves; approval atomically releases immutable history and applies
    // the proposed Current G&R progress update.
    await login(page, USERS.chair);
    await page.goto(`${personPath}?section=reviews&panel=approve`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Approve & release" }).click();
    await expect(page.getByText("Released", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("02-chair-release-complete.png"), fullPage: true });

    await login(page, USERS.mentee);
    await page.goto(`${personPath}?section=goals`);
    await expect(page.getByText("In progress")).toBeVisible();
    await page.goto(`${personPath}?section=reviews`);
    await expect(page.getByText("Feedback released to you")).toBeVisible();
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
