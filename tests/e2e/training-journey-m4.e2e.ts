/**
 * E2E: Module 4 (Communication & Reliability) — happy path including
 * MESSAGE_COMPOSER beats.
 *
 * contentKey: "academy_communication_004"
 * Badge: "Reliable Pro"
 * Pass threshold: 80%
 *
 * Beat sequence (7 beats):
 *   1. CONCEPT_REVEAL   — "Three rules of YPP communication" (3 panels)
 *   2. MESSAGE_COMPOSER — "Running late" (pools: Opening / Middle / Closing)
 *                         Correct: open-apology + mid-specific-eta + neutral close
 *   3. MESSAGE_COMPOSER — "Parent concern" (pools: Acknowledgement / What we've covered / Next step)
 *                         Correct: ack-direct + spec-lesson + next-action
 *   4. MULTI_SELECT     — Proactive parent communication scenarios (3 correct)
 *   5. SCENARIO_CHOICE  — "Missed a session" → apology + makeup in one message
 *   6. SPOT_THE_MISTAKE — Click the dismissive phrase in a parent email reply
 *   7. CONCEPT_REVEAL   — "Reliable Pro" completion trigger (2 panels)
 *
 * MessageComposer renders pools as <fieldset> + <legend> + radio-style divs
 * (role="radio" inside role="radiogroup") for single-select pools (max=1).
 * Clicking a snippet div selects it; all pools must have ≥1 selection before
 * Check is enabled.
 *
 * Prereqs:
 *   - Module 4 seeded in the DB.
 *   - Module 3 completed so that M4 is accessible.
 *
 * The correct snippet selections for Beat 2 (running late):
 *   Opening:  "Hi everyone, so sorry for the delay —"   (open-apology, tag: apologetic)
 *   Middle:   "I'll be online in 10 minutes, at 4:10 pm." (mid-specific-eta, tag: specific-eta)
 *   Closing:  either "We'll cover everything" or "Thank you for your patience" (neutral, no banned tags)
 *
 * The correct snippet selections for Beat 3 (parent concern):
 *   Acknowledgement: "Thank you for telling me — I want to make sure Marcus…"  (ack-direct, tag: acknowledging)
 *   What we've covered: "This week we worked on multi-step word problems…"     (spec-lesson, tag: specific-taught)
 *   Next step: "I'll send a brief session summary after every class…"          (next-action, tag: next-step)
 */

import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

const M4_CONTENT_KEY = "academy_communication_004";

async function openM4Module(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.goto("/instructor-training");
  await page
    .getByRole("link", { name: /communication.*reliability|reliability.*communication/i })
    .first()
    .click();
  await page.waitForURL(/\/training\/[^/]+$/, { timeout: 20_000 });
}

/**
 * Select a snippet from a MessageComposer pool by matching its label text.
 *
 * Snippets are rendered as role="radio" divs inside a role="radiogroup"
 * (per MessageComposer.tsx SingleSelectPool). Click the first snippet whose
 * text content matches the given pattern.
 */
async function selectSnippet(
  page: import("@playwright/test").Page,
  labelPattern: RegExp
): Promise<void> {
  // Try role="radio" first (single-select pools)
  const radioMatch = page.getByRole("radio", { name: labelPattern });
  if ((await radioMatch.count()) > 0) {
    await radioMatch.first().click();
    return;
  }
  // Fall back to role="checkbox" (multi-select pools)
  const checkboxMatch = page.getByRole("checkbox", { name: labelPattern });
  if ((await checkboxMatch.count()) > 0) {
    await checkboxMatch.first().click();
    return;
  }
  // Last resort: text match on any clickable element inside .message-composer
  await page
    .locator(".message-composer")
    .getByText(labelPattern)
    .first()
    .click();
}

// ─────────────────────────────────────────────────────────────────────────────
// @smoke — full happy-path walk-through with correct MESSAGE_COMPOSER answers
// ─────────────────────────────────────────────────────────────────────────────

test("@smoke approved instructor completes Module 4 end-to-end", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await openM4Module(page);

  // ── Intro screen ─────────────────────────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /communication.*reliability|reliability/i })
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^(start|resume)$/i }).click();

  // ── Beat 1: CONCEPT_REVEAL — 3 panels ────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /three rules.*communication|ypp communication/i })
  ).toBeVisible({ timeout: 10_000 });
  for (const panelName of [/respond within 24/i, /lead with the student/i, /no surprises/i]) {
    await page.getByRole("tab", { name: panelName }).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 2: MESSAGE_COMPOSER — "Running late to class" ───────────────────
  await expect(
    page.getByRole("heading", { name: /running late/i })
  ).toBeVisible({ timeout: 10_000 });

  // Opening pool: pick the apologetic opener (no blame-shifting tag)
  await selectSnippet(page, /so sorry for the delay/i);

  // Middle pool: pick the specific ETA snippet
  await selectSnippet(page, /i.ll be online in 10 minutes/i);

  // Closing pool: pick a neutral close (no banned tag)
  await selectSnippet(page, /we.ll cover everything on today.s plan/i);

  // Verify live preview updates (aria-live region)
  const preview = page.getByLabel(/your message preview/i);
  await expect(preview).toContainText(/sorry for the delay/i, { timeout: 5_000 });

  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 3: MESSAGE_COMPOSER — "Parent says my child isn't learning" ─────
  await expect(
    page.getByRole("heading", { name: /my child isn.t learning/i })
  ).toBeVisible({ timeout: 10_000 });

  // Acknowledgement pool: pick the non-defensive opener
  await selectSnippet(page, /thank you for telling me/i);

  // What we've covered pool: pick the specific lesson snippet
  await selectSnippet(page, /multi-step word problems/i);

  // Next step pool: pick the concrete action snippet
  await selectSnippet(page, /brief session summary after every class/i);

  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 4: MULTI_SELECT — proactive parent communication ─────────────────
  await expect(
    page.getByRole("heading", { name: /proactive parent communication/i })
  ).toBeVisible({ timeout: 10_000 });
  for (const optionName of [
    /cancel or miss a session/i,
    /consistently not understanding/i,
    /regular session time is changing/i,
  ]) {
    await page.getByRole("checkbox", { name: optionName }).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 5: SCENARIO_CHOICE — missed a session ───────────────────────────
  await expect(
    page.getByRole("heading", { name: /missed a session/i })
  ).toBeVisible({ timeout: 10_000 });
  await page
    .getByRole("radio", { name: /direct apology.*specific makeup time|apology.*makeup/i })
    .click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 6: SPOT_THE_MISTAKE — click the dismissive phrase ───────────────
  await expect(
    page.getByRole("heading", { name: /spot the tone problem/i })
  ).toBeVisible({ timeout: 10_000 });
  // The correct target is "These things just take time, so please try to be patient"
  // SPOT_THE_MISTAKE renders clickable text spans; click the target phrase.
  await page
    .getByText(/these things just take time/i)
    .first()
    .click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 7: CONCEPT_REVEAL — "Reliable Pro" completion trigger ───────────
  await expect(
    page.getByRole("heading", { name: /reliable pro/i })
  ).toBeVisible({ timeout: 10_000 });
  for (const panelName of [/what you earned/i, /keep it up/i]) {
    await page.getByRole("tab", { name: panelName }).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Completion screen ─────────────────────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /reliable pro|module 4 complete/i })
  ).toBeVisible({ timeout: 15_000 });

  await expect(
    page.getByRole("link", { name: /back to (academy|student academy)/i })
  ).toBeVisible();

  await page
    .getByRole("link", { name: /back to (academy|student academy)/i })
    .click();
  await page.waitForURL(/\/instructor-training$/, { timeout: 15_000 });
  await expect(page.locator("body")).not.toContainText(/application error/i);

  void M4_CONTENT_KEY;
});

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE_COMPOSER: Check button is disabled until all pools have a selection
// ─────────────────────────────────────────────────────────────────────────────

test("M4 MESSAGE_COMPOSER Beat 2 disables Check until all pools are filled", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await openM4Module(page);

  await page.getByRole("button", { name: /^(start|resume)$/i }).click();

  // Beat 1: advance quickly
  await expect(
    page.getByRole("heading", { name: /three rules.*communication|ypp communication/i })
  ).toBeVisible({ timeout: 10_000 });
  const tabs = page.getByRole("tab");
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    await tabs.nth(i).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // Beat 2: MESSAGE_COMPOSER should show Check as disabled initially
  await expect(
    page.getByRole("heading", { name: /running late/i })
  ).toBeVisible({ timeout: 10_000 });

  const checkButton = page.getByRole("button", { name: /^check$/i });

  // Initially disabled — no selections made yet
  await expect(checkButton).toBeDisabled({ timeout: 5_000 });

  // Select only the Opening pool — Check should still be disabled (Middle + Closing unfilled)
  await selectSnippet(page, /so sorry for the delay/i);
  await expect(checkButton).toBeDisabled();

  // Select the Middle pool — Check still disabled (Closing unfilled)
  await selectSnippet(page, /i.ll be online in 10 minutes/i);
  await expect(checkButton).toBeDisabled();

  // Select the Closing pool — Check should now be enabled
  await selectSnippet(page, /thank you for your patience/i);
  await expect(checkButton).toBeEnabled({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE_COMPOSER: Incorrect (banned-tag) selection triggers failure feedback
// ─────────────────────────────────────────────────────────────────────────────

test("M4 MESSAGE_COMPOSER Beat 2 incorrect selection (blame-shifting) shows failure feedback", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await openM4Module(page);

  await page.getByRole("button", { name: /^(start|resume)$/i }).click();

  // Beat 1: advance
  await expect(
    page.getByRole("heading", { name: /three rules.*communication|ypp communication/i })
  ).toBeVisible({ timeout: 10_000 });
  const tabs = page.getByRole("tab");
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    await tabs.nth(i).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // Beat 2: deliberately pick the blame-shifting opener
  await expect(
    page.getByRole("heading", { name: /running late/i })
  ).toBeVisible({ timeout: 10_000 });

  // Pick the blame-shifting opener (open-blame tag: blame-shifting)
  await selectSnippet(page, /traffic was awful today/i);
  // Pick a specific ETA (to satisfy that required tag)
  await selectSnippet(page, /i.ll be online in 10 minutes/i);
  // Pick a neutral close
  await selectSnippet(page, /thank you for your patience/i);

  await page.getByRole("button", { name: /^check$/i }).click();

  // Feedback panel should show incorrect/failure tone
  const feedback = page.locator("[aria-live='polite']").first();
  await expect(feedback).toBeVisible({ timeout: 10_000 });

  // The incorrect feedback headline for this beat is "Not quite right."
  // The body mentions banned tag or missing required tag.
  await expect(
    page.getByText(/not quite right|banned|blame|apologetic/i)
  ).toBeVisible({ timeout: 5_000 });

  // User can still proceed (module is not strictMode)
  await page.getByRole("button", { name: /^(next|try again|finish)$/i }).click();
});
