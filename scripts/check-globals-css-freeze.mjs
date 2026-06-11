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

/** Frozen 2026-06 at the start of the Knowledge OS V2 migration. Only lower it. */
const BASELINE_LINE_COUNT = 17443;

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
