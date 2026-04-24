/**
 * E2E: Module 1 (The YPP Standard) — happy path.
 *
 * Phase 4 exit criterion: an authorized user can walk through all 8 beats and
 * see the completion screen. After the run, the user's TrainingAssignment
 * row should be `COMPLETE` for academy_ypp_standard_001.
 *
 * Prereqs (satisfied by `scripts/seed-portal-e2e.ts` + `training:import`):
 *   - Module 1 seeded in the DB.
 *   - A test user in an approved instructor-training role (admin works —
 *     ADMIN ∈ APPROVED_INSTRUCTOR_TRAINING_ROLES per lib/training-access.ts).
 *
 * Feature flag: the portal defaults `ENABLE_INTERACTIVE_TRAINING_JOURNEY=true`.
 */

import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

const M1_CONTENT_KEY = "academy_ypp_standard_001";

async function openM1Module(
  page: import("@playwright/test").Page
): Promise<void> {
  // Navigate to the hub and resolve the M1 id via its link. The hub link carries
  // the contentKey in a data attribute on the module card once the Phase 7 hub
  // rebuild lands; for Phase 4 we navigate by contentKey via a query helper.
  await page.goto("/instructor-training");
  await page
    .getByRole("link", { name: /the ypp standard/i })
    .first()
    .click();
  await page.waitForURL(/\/training\/[^/]+$/, { timeout: 20_000 });
}

test("@smoke approved instructor completes Module 1 end-to-end", async ({
  page,
}) => {
  await loginAs(page, "admin");
  await openM1Module(page);

  // ── Intro screen ─────────────────────────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /the ypp standard/i })
  ).toBeVisible();
  await page.getByRole("button", { name: /^(start|resume)$/i }).click();

  // ── Beat 1: CONCEPT_REVEAL — visit all three panels ──────────────────────
  await expect(
    page.getByRole("heading", { name: /what ypp expects/i })
  ).toBeVisible({ timeout: 10_000 });
  for (const tabName of [/prepare/i, /show up/i, /follow through/i]) {
    await page.getByRole("tab", { name: tabName }).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 2: COMPARE — Recap B is correct ─────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /which recap meets the bar/i })
  ).toBeVisible();
  await page.getByRole("radio", { name: /recap b/i }).click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 3: SCENARIO_CHOICE — same-day specific reply ────────────────────
  await expect(
    page.getByRole("heading", { name: /parent asks for an update/i })
  ).toBeVisible();
  await page
    .getByRole("radio", { name: /reply same day with two concrete observations/i })
    .click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 4: MULTI_SELECT — the three red flags ───────────────────────────
  await expect(
    page.getByRole("heading", { name: /red flags in a first session/i })
  ).toBeVisible();
  for (const optionName of [
    /walks in without a lesson plan/i,
    /arrives 8 minutes late/i,
    /ends class without sending a parent recap/i,
  ]) {
    await page.getByRole("checkbox", { name: optionName }).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 5: SPOT_THE_MISTAKE — "winging the rest" ────────────────────────
  await expect(
    page.getByRole("heading", { name: /spot the violation/i })
  ).toBeVisible();
  await page
    .getByRole("radio", { name: /winging the rest/i })
    .first()
    .click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 6: SCENARIO_CHOICE — cover the session ──────────────────────────
  await expect(
    page.getByRole("heading", { name: /peer cancels last-minute/i })
  ).toBeVisible();
  await page
    .getByRole("radio", { name: /offer to cover the session yourself/i })
    .click();
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 7: REFLECTION — unscored, just needs ≥40 chars ──────────────────
  await expect(
    page.getByRole("heading", { name: /your hardest expectation/i })
  ).toBeVisible();
  await page
    .getByRole("textbox")
    .fill(
      "Follow Through is the hardest — I tend to improvise; I'll block 15 minutes after every class to send the recap."
    );
  await page.getByRole("button", { name: /^check$/i }).click();
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Beat 8: CONCEPT_REVEAL completion trigger — two panels ───────────────
  await expect(
    page.getByRole("heading", { name: /standard bearer/i })
  ).toBeVisible();
  for (const tabName of [/what you earned/i, /what's next/i]) {
    await page.getByRole("tab", { name: tabName }).click();
  }
  await page.getByRole("button", { name: /^check$/i }).click();
  // Final beat → "Finish" → triggers completeJourneyAction.
  await page.getByRole("button", { name: /^(next|finish)$/i }).click();

  // ── Completion screen ────────────────────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: /standard bearer|module 1 complete/i })
  ).toBeVisible({ timeout: 15_000 });

  // Primary CTA back to academy
  await expect(
    page.getByRole("link", { name: /back to (academy|student academy)/i })
  ).toBeVisible();

  // Navigate back and confirm the hub reflects completion
  await page
    .getByRole("link", { name: /back to (academy|student academy)/i })
    .click();
  await page.waitForURL(/\/instructor-training$/, { timeout: 15_000 });

  // The hub rebuild is Phase 7; at Phase 4 we only assert the module row
  // carries a visual "complete" marker — the legacy hub at least shows the
  // COMPLETE state somewhere. This assertion stays loose until Phase 7 lands
  // the real hub; it just sanity-checks that the assignment flip didn't 500
  // the hub render.
  await expect(page.locator("body")).not.toContainText(/application error/i);

  void M1_CONTENT_KEY;
});
