// Design System 2.0 guardrail — app/globals.css is FROZEN.
//
// V2 master plan §22 / Tailwind addendum §8: the legacy global stylesheet may
// only shrink. New styling belongs in components/ui-v2/ (Tailwind utilities)
// or, for tokens only, app/ui-v2.css. This check fails the release pipeline
// if globals.css grows past the recorded baseline.
//
// When you legitimately DELETE legacy CSS, lower the baseline in the same PR —
// that is the point: the number only ever goes down.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Frozen 2026-06 at the start of the Knowledge OS V2 migration (17,443).
 * Lowered to 16,503 by CSS deletion milestone 1 (Phase 2C): dead nav/sidebar
 * skin blocks — docs/knowledge-os-phase-2c-notes.md.
 * Lowered to 14,955 by CSS deletion milestone 2 (Phase 3A): dead overview /
 * legacy-dashboard blocks plus the application-board skins replaced by the
 * ui-v2 reskin — docs/knowledge-os-phase-3a-notes.md.
 * Lowered to 13,704 by CSS deletion milestone 3 (Phase 3B): the applicant
 * cockpit / chair-review / final-review skin families replaced by the
 * ui-v2 rebuild — docs/knowledge-os-phase-3b-notes.md.
 * Lowered to 11,598 by CSS deletion milestone 4 (Phase 3C): the live
 * interview runner / review-editor / interviewer-brief skin families
 * replaced by the ui-v2 rebuild — docs/knowledge-os-phase-3c-notes.md.
 * Lowered to 10,761 by CSS deletion milestone 5 (Phase 3D): the entire
 * /interviews hub `.iv-*` layer (cards/task cards/KPIs/filters/segmented/
 * toolbar/empty states/badges/kbd + its :root --iv-* tokens) replaced by
 * the ui-v2 rebuild — docs/knowledge-os-phase-3d-notes.md.
 * Lowered to 10,746 in Phase 3E: the dead `.ps-main-grid` block (zero
 * consumers) — docs/knowledge-os-phase-3e-actions-meetings-notes.md.
 * Lowered to 10,731 in Phase 3F: the `.my-actions-*` phone-width rules,
 * orphaned by the `/actions` (My Actions) ui-v2 rebuild. The shared `.ps-*`
 * chassis stays — it is portal-wide (People Suite, admin records, chapter,
 * operations) — docs/knowledge-os-phase-3f-actions-pages-notes.md.
 * Only lower it.
 * Reconciled to 10,733 when merging preview/brayden-portal: main added two
 * `.page-subtitle` typography rules (DM Sans font-family + letter-spacing) that
 * were never captured here, so the baseline lagged main's shipped globals.css.
 */
const BASELINE_LINE_COUNT = 10733;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "app", "globals.css");
const lineCount = readFileSync(file, "utf8").split("\n").length - 1;

if (lineCount > BASELINE_LINE_COUNT) {
  console.error(
    `✗ app/globals.css grew: ${lineCount} lines (frozen baseline: ${BASELINE_LINE_COUNT}).\n` +
      `  The legacy stylesheet is frozen — it may only shrink.\n` +
      `  Put new styles in components/ui-v2/ (Tailwind) instead.\n` +
      `  See docs/ypp-tailwind-design-system-v2-plan.md §8.`
  );
  process.exit(1);
}

const headroom = BASELINE_LINE_COUNT - lineCount;
console.log(
  `✓ globals.css freeze check passed: ${lineCount} lines (baseline ${BASELINE_LINE_COUNT}` +
    (headroom > 0
      ? `, ${headroom} lines deleted so far — lower the baseline in scripts/check-globals-css-freeze.mjs to lock it in)`
      : `)`)
);
