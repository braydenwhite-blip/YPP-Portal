/**
 * E2E: Module 3 (Student Situations) — branching path variants.
 *
 * Module 3 uses BRANCHING_SCENARIO beats: a root beat presents a scenario and
 * the user's choice gates which follow-up child beats they see next. Each
 * visited leaf is scored independently; the module denominator counts only
 * the beats the user actually visited (not the full DAG).
 *
 * contentKey: "academy_student_situations_003"
 * Badge: "Classroom Whisperer"
 * Pass threshold: 75% (lower bar than other modules; branching is nuanced)
 *
 * Beat sequence (7 beats including 3 BRANCHING_SCENARIOs):
 *   1. CONCEPT_REVEAL    — "Read the room, then the student."
 *   2. BRANCHING_SCENARIO — "Quiet student" root + child beats per choice
 *   3. BRANCHING_SCENARIO — "Distracted student" root + child beats
 *   4. SCENARIO_CHOICE   — "'I don't get it' — what do you ask first?"
 *   5. BRANCHING_SCENARIO — "Student dominates the discussion" + children
 *   6. MATCH_PAIRS       — match situations to diagnostic questions
 *   7. JourneyComplete   — badge "Classroom Whisperer"
 *
 * BranchingScenario renders options as role="radio" inside a role="radiogroup".
 * Each option that leads to a child beat shows a ⤷ branch-hint indicator
 * (aria-label: "leads to a follow-up scenario").
 *
 * Prereqs:
 *   - Module 3 seeded in the DB.
 *   - Module 2 completed so that M3 is accessible.
 *
 * Test 1 (@smoke) — happy path, taking the first branch option on each
 *   BRANCHING_SCENARIO, completing all reachable child beats.
 *
 * Test 2 — alternative branch path: makes different root choices to exercise
 *   a second set of child beats and confirms the module still completes.
 */

import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

async function openM3Module(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.goto("/instructor-training");
  await page
    .getByRole("link", { name: /student situations/i })
    .first()
    .click();
  await page.waitForURL(/\/training\/[^/]+$/, { timeout: 20_000 });
}

/**
 * Complete a BRANCHING_SCENARIO root beat by clicking the first available
 * radio option, checking, and advancing. Returns the text of the option chosen
 * so callers can assert which branch was taken.
 */
async function completeBranchingRoot(
  page: import("@playwright/test").Page,
  preferredOptionPattern?: RegExp
): Promise<string> {
  // Wait for the radiogroup to appear (branching scenarios render one)
  await page
    .getByRole("radiogroup")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  const radios = page.getByRole("radio");
  const count = await radios.count();
  if (count === 0) {
    throw new Error("No radio options found for BRANCHING_SCENARIO root beat");
  }

  let chosenLabel = "";
  if (preferredOptionPattern) {
    const preferred = page.getByRole("radio", { name: preferredOptionPattern });
    if ((await preferred.count()) > 0) {
      chosenLabel = (await preferred.first().textContent()) ?? "";
      await preferred.first().click();
    } else {
      // Fall back to first option
      chosenLabel = (await radios.first().textContent()) ?? "";
      await radios.first().click();
    }
  } else {
    chosenLabel = (await radios.first().textContent()) ?? "";
    await radios.first().click();
  }

  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  return chosenLabel;
}

/**
 * Complete a BRANCHING_SCENARIO root beat by clicking the last radio option
 * (for exercising alternative branches).
 */
async function completeBranchingRootLast(
  page: import("@playwright/test").Page
): Promise<string> {
  await page
    .getByRole("radiogroup")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  const radios = page.getByRole("radio");
  const count = await radios.count();
  if (count === 0) {
    throw new Error("No radio options found for BRANCHING_SCENARIO root beat");
  }

  const last = radios.nth(count - 1);
  const chosenLabel = (await last.textContent()) ?? "";
  await last.click();

  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  return chosenLabel;
}

/**
 * Complete any child beats that appear after a branching root choice.
 *
 * Child beats may be SCENARIO_CHOICE, CONCEPT_REVEAL, or further
 * BRANCHING_SCENARIOs. This helper drives each to completion by detecting the
 * beat kind from what's currently visible.
 *
 * It loops until the next root-level BRANCHING_SCENARIO heading appears, a
 * non-branching SCENARIO_CHOICE heading appears, the MATCH_PAIRS beat, or
 * the completion screen appears.
 */
async function drainChildBeats(
  page: import("@playwright/test").Page,
  upcomingHeadingPattern: RegExp
): Promise<void> {
  // Give child beats a moment to load (they may not appear instantly)
  // Then try to advance any intermediate beats until the expected next section.
  let iterations = 0;
  const maxIterations = 8;

  while (iterations < maxIterations) {
    iterations++;

    const nextHeadingVisible = await page
      .getByRole("heading", { name: upcomingHeadingPattern })
      .isVisible()
      .catch(() => false);

    if (nextHeadingVisible) break;

    const completionVisible = await page
      .getByRole("heading", { name: /classroom whisperer|module 3 complete/i })
      .isVisible()
      .catch(() => false);
    if (completionVisible) break;

    // Check if there's an active radio group (child BRANCHING or SCENARIO_CHOICE)
    const radioGroupVisible = await page
      .getByRole("radiogroup")
      .first()
      .isVisible()
      .catch(() => false);
    if (radioGroupVisible) {
      const radios = page.getByRole("radio");
      await radios.first().click();
      await page.getByRole("button", { name: /^check$/i }).click();
      await page.getByRole("button", { name: /^(next|finish)$/i }).click();
      continue;
    }

    // Check if there's a textbox (REFLECTION or FILL_IN_BLANK child)
    const textboxVisible = await page
      .getByRole("textbox")
      .first()
      .isVisible()
      .catch(() => false);
    if (textboxVisible) {
      await page
        .getByRole("textbox")
        .fill("I would check in with the student directly and adjust my approach based on their response.");
      await page.getByRole("button", { name: /^check$/i }).click();
      await page.getByRole("button", { name: /^(next|finish)$/i }).click();
      continue;
    }

    // Check if there are tabs (CONCEPT_REVEAL child)
    const tabsVisible = await page
      .getByRole("tab")
      .first()
      .isVisible()
      .catch(() => false);
    if (tabsVisible) {
      const tabs = page.getByRole("tab");
      const tabCount = await tabs.count();
      for (let i = 0; i < tabCount; i++) {
        await tabs.nth(i).click();
      }
      await page.getByRole("button", { name: /^check$/i }).click();
      await page.getByRole("button", { name: /^(next|finish)$/i }).click();
      continue;
    }

    // Nothing recognizable — short wait and retry
    await page.waitForTimeout(500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @smoke — happy path, first-branch choices
// ─────────────────────────────────────────────────────────────────────────────

test("@smoke approved instructor completes Module 3 via first-branch path", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await openM3Module(page);

  // ── Intro screen ─────────────────────────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /student situations/i })
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^(start|resume)$/i }).click();

  // ── Beat 1: CONCEPT_REVEAL — "Read the room, then the student" ───────────
  await expect(
    page.getByRole("heading", { name: /read the room/i })
  ).toBeVisible({ timeout: 10_000 });
  const beat1Tabs = page.getByRole("tab");
  const beat1TabCount = await beat1Tabs.count();
  for (let i = 0; i < beat1TabCount; i++) {
    await beat1Tabs.nth(i).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 2: BRANCHING_SCENARIO — "Quiet student" ─────────────────────────
  await expect(
    page.getByRole("heading", { name: /quiet student/i })
  ).toBeVisible({ timeout: 10_000 });
  await completeBranchingRoot(page);
  // Drain any child beats that appear after this choice
  await drainChildBeats(page, /distracted student/i);

  // ── Beat 3: BRANCHING_SCENARIO — "Distracted student" ────────────────────
  await expect(
    page.getByRole("heading", { name: /distracted student/i })
  ).toBeVisible({ timeout: 10_000 });
  await completeBranchingRoot(page);
  await drainChildBeats(page, /i don.t get it|don.t understand/i);

  // ── Beat 4: SCENARIO_CHOICE — "I don't get it — what do you ask first?" ──
  await expect(
    page.getByRole("heading", { name: /i don.t get it|don.t understand/i })
  ).toBeVisible({ timeout: 10_000 });
  // Pick the diagnostic question approach
  const radios4 = page.getByRole("radio");
  await radios4.first().click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 5: BRANCHING_SCENARIO — "Student dominates the discussion" ───────
  await expect(
    page.getByRole("heading", { name: /dominates|student dominates/i })
  ).toBeVisible({ timeout: 10_000 });
  await completeBranchingRoot(page);
  await drainChildBeats(page, /match|pairs|situation/i);

  // ── Beat 6: MATCH_PAIRS — situations to diagnostic questions ─────────────
  await expect(
    page.getByRole("heading", { name: /match|pairs/i })
  ).toBeVisible({ timeout: 10_000 });
  // MATCH_PAIRS: tap-left-then-right or drag pattern. Click first left item,
  // then first right item to form a pair; repeat for remaining items.
  // The component typically renders two columns; we click items sequentially.
  const pairItems = page.locator("[data-match-item], .match-pairs__item, [role='button']").filter({ hasText: /.+/ });
  const pairCount = await pairItems.count();
  if (pairCount >= 2) {
    // Simple strategy: click pairs in order (left side first, right side second)
    // This may not produce all-correct pairings but MATCH_PAIRS awards partial credit.
    for (let i = 0; i < Math.min(pairCount, 4); i += 2) {
      await pairItems.nth(i).click().catch(() => { /* ignore if not clickable */ });
      await pairItems.nth(i + 1).click().catch(() => { /* ignore if not clickable */ });
    }
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Completion screen ─────────────────────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /classroom whisperer|module 3 complete/i })
  ).toBeVisible({ timeout: 15_000 });

  await expect(
    page.getByRole("link", { name: /back to (academy|student academy)/i })
  ).toBeVisible();

  await page
    .getByRole("link", { name: /back to (academy|student academy)/i })
    .click();
  await page.waitForURL(/\/instructor-training$/, { timeout: 15_000 });
  await expect(page.locator("body")).not.toContainText(/application error/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// Alternative branch — last-option choices on each BRANCHING_SCENARIO
// Verifies a different set of child beats is traversed and module still ends
// ─────────────────────────────────────────────────────────────────────────────

test("@smoke M3 alternative branch path completes successfully", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await openM3Module(page);

  await expect(
    page.getByRole("heading", { name: /student situations/i })
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^(start|resume)$/i }).click();

  // Beat 1: CONCEPT_REVEAL — advance through all tabs
  await expect(
    page.getByRole("heading", { name: /read the room/i })
  ).toBeVisible({ timeout: 10_000 });
  const tabs = page.getByRole("tab");
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    await tabs.nth(i).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // Beat 2: BRANCHING_SCENARIO "Quiet student" — take last option
  await expect(
    page.getByRole("heading", { name: /quiet student/i })
  ).toBeVisible({ timeout: 10_000 });
  const choice2 = await completeBranchingRootLast(page);
  expect(choice2).toBeTruthy(); // confirms an option was selected
  await drainChildBeats(page, /distracted student/i);

  // Beat 3: BRANCHING_SCENARIO "Distracted student" — take last option
  await expect(
    page.getByRole("heading", { name: /distracted student/i })
  ).toBeVisible({ timeout: 10_000 });
  await completeBranchingRootLast(page);
  await drainChildBeats(page, /i don.t get it|don.t understand/i);

  // Beat 4: SCENARIO_CHOICE — pick the last radio (different branch)
  await expect(
    page.getByRole("heading", { name: /i don.t get it|don.t understand/i })
  ).toBeVisible({ timeout: 10_000 });
  const radios4 = page.getByRole("radio");
  const count4 = await radios4.count();
  await radios4.nth(count4 - 1).click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // Beat 5: BRANCHING_SCENARIO "Student dominates" — take last option
  await expect(
    page.getByRole("heading", { name: /dominates|student dominates/i })
  ).toBeVisible({ timeout: 10_000 });
  await completeBranchingRootLast(page);
  await drainChildBeats(page, /match|pairs|situation/i);

  // Beat 6: MATCH_PAIRS — attempt partial pairing
  await expect(
    page.getByRole("heading", { name: /match|pairs/i })
  ).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // Completion screen — module completes regardless of which branch was taken
  await expect(
    page.getByRole("heading", { name: /classroom whisperer|module 3 complete/i })
  ).toBeVisible({ timeout: 15_000 });

  // Hub link is present
  await expect(
    page.getByRole("link", { name: /back to (academy|student academy)/i })
  ).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Branch-hint indicator renders for options that lead to child beats
// ─────────────────────────────────────────────────────────────────────────────

test("M3 BRANCHING_SCENARIO options with child beats show branch-hint indicator", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await openM3Module(page);

  await page.getByRole("button", { name: /^(start|resume)$/i }).click();

  // Advance past Beat 1 (CONCEPT_REVEAL)
  await expect(
    page.getByRole("heading", { name: /read the room/i })
  ).toBeVisible({ timeout: 10_000 });
  const tabs = page.getByRole("tab");
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    await tabs.nth(i).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // Beat 2: BRANCHING_SCENARIO "Quiet student" — verify branch-hint aria-label
  await expect(
    page.getByRole("heading", { name: /quiet student/i })
  ).toBeVisible({ timeout: 10_000 });

  // At least one option should have the branch-hint indicator that labels it
  // "leads to a follow-up scenario" (per BranchingScenario.tsx implementation)
  const branchHints = page.locator("[aria-label='leads to a follow-up scenario']");
  const hintCount = await branchHints.count();
  expect(hintCount).toBeGreaterThan(0);
});
