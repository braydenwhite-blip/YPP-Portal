# Knowledge OS V2 — Phase 3B Implementation Notes

**Scope shipped:** the **applicant workspace rebuilt on ui-v2/Tailwind**
(`/applications/instructor/[id]`), the **chair review cockpit chrome
reskinned** onto the same system, the **Entity Action Operating Panel**
wired into five record surfaces, **inline structured completion/blocker
capture** on the action detail card, and **CSS deletion milestone 3**
(1,251 lines removed; freeze baseline lowered to **13,704**). Companion to
the master plan (§15, §16, §22.6), the Action System 4.0 delivery doc, and
the Phase 3A notes.

## Applicant workspace — rebuilt on ui-v2

`app/(app)/applications/instructor/[id]/page.tsx` and its component tree
moved off the legacy cockpit CSS onto Tailwind with the ui-v2 vocabulary
(calm light surface, brand accents, shared panel constants). **No data
loading, role guard, server action, or form changed** — visibility rules
(admin / chair / chapter lead / reviewer / interviewer / lead interviewer)
and the feature-flag gates are untouched.

- **Page shell:** sticky back bar (now also linking to **Application 360**
  for chair-tier viewers), light canvas, main+sidebar grid; re-application
  note and panel sections on Tailwind.
- **`ApplicantCockpitHeader`:** dark gradient hero → calm white card:
  avatar, identity, chapter/track/subjects/source chips, status pill with
  per-stage tones, owner chips (reviewer / lead / second), and the 5-step
  stage stepper rebuilt as a Tailwind progress row.
- **`ApplicantCockpitSidebar`** (documents + recent activity),
  **`ApplicantNextActionBar`** (fixed bottom bar, same status-driven
  next-action logic incl. `sendToChair`), **`CollapsibleAssignmentPanel`**
  (details/summary with assigned/unassigned chips) — all rebuilt.
- **Reskinned in place (logic untouched):**
  `InterviewSchedulingInlinePanel` (slot groups/cards/forms, confirmed /
  awaiting-confirmation tones), `ApplicantDocumentsPanel`
  (complete/missing cards, upload, history), `ApplicantTimelineFeed`
  (day-grouped feed with tone stripes), `ExternalIntakePanel`,
  `WorkshopOutlinePanel`, `ManualEmailGuidancePanel`, and the cockpit-class
  containers of `ApplicationReviewEditor` and the interview workspace's
  `interview-review-editor` kicker.
- Concrete labels only (§19): stage pills, "Materials ready / Missing",
  "Awaiting confirmation", owner chips — no fit/health/readiness scores.

## Chair review cockpit — chrome on ui-v2

The final-review system (43 components, ~8k lines) was already inline-styled
over CSS variables; **every decision capability is preserved untouched**
(chairDecide commit lifecycle with idempotency keys, rejection-reason
enforcement, condition validation, HIGH_RISK acknowledgements, stale-click /
network-drop / sync-rollback recovery, rescind for SUPER_ADMIN, audit chain,
queue navigation, notification resend). What changed:

- Layout wrappers (`ReviewWorkspace`, `FeedbackPanel`, `SignalPanel`),
  `ApplicantSnapshotBar`, and `DecisionDock` (read-only + live) moved from
  globals-scoped class rules + inline styles to Tailwind — including the
  responsive collapse the old `.final-review-cockpit` media block carried.
- `ActionButton` hover/focus, `QueueNavigator` and `ReviewerIdentityChip`
  focus rings now Tailwind (`focus-visible:outline-brand-600`).
- The route's loading skeleton rebuilt on `animate-pulse` (was
  `.cockpit-skel` shimmer); `SaveStateIndicator`'s autosave pulse moved to
  `animate-pulse` (was a cockpit-scoped keyframe).
- **Snapshot bar now links to Application 360** (decision-first loop:
  board → 360 → cockpit → 360).
- The deeper panels (ScoreMatrix, ReviewSignalFeed, RisksPanel, modals,
  banners, toasts) keep their existing inline-style implementation — they
  consume the `:root` cockpit/score/ink tokens (kept) and have no legacy
  class dependencies.

## Entity Action Operating Panel (Action System 4.0)

`deriveEntityActionPanel` is now wired into UI via
`components/work/entity-action-panel.tsx` (server component, ui-v2):
suggested next move (action + `deriveActionNextMove`'s move/why), concrete
counts (open / overdue / blocked / due within 7 days / without an
executor — never a composite score), the open-action list with owner and
meeting provenance, decisions-without-actions, last completed, and two
quick actions — **New linked action** (prefilled with honest `ENTITY`
provenance via `buildActionPrefillFromEntity`) and **View in Work Hub**
(new `/work?entity=<type>:<id>` lens with a clear chip; pure helpers +
tests in `work-hub-rows`).

Wired into:

1. **Partner profile** (`/admin/partners/[id]`) — new section above the
   existing Partnership Operations panel.
2. **Instructor full-360** (`/admin/instructors/[id]`) — replaces the old
   open-actions half of "Open work" (meetings list kept beside it).
3. **Student full-360** (`/admin/students/[id]`) — replaces "Open work".
4. **Class record** (`/admin/classes/[id]`) — new section above Class
   Operations.
5. **Application 360** (`/admin/instructor-applicants/[id]`) — new section
   (the page now loads `getActionsForEntity("INSTRUCTOR_APPLICATION", …)`).

## Inline structured completion / blocker capture

- **New focused server actions** in
  `lib/people-strategy/action-items-actions.ts` (same guard/zod/permission/
  transaction/system-comment conventions): `captureActionCompletion`
  (status → COMPLETE + `completionOutcome` + `completionNote` +
  `nextFollowUpAt`, `completedAt` stamped via the existing transition
  helper) and `captureActionBlocker` (status → BLOCKED + required
  `blockedReason` + optional `nextFollowUpAt`). No schema change — these
  persist the existing 4.0 columns. 7 unit tests
  (`tests/lib/people-strategy-action-capture.test.ts`).
- **`ActionStatusCapture`** (Tailwind subtree): choosing COMPLETE or
  BLOCKED in the action detail card's status control now opens inline
  capture instead of a bare status write; other statuses keep
  `updateActionStatus`. The card also displays stored structured state
  ("Blocked because …" with an update affordance; "Outcome: Delivered" +
  note + next follow-up) — `ActionDetailDTO` extended with the four
  fields.

## CSS deletion milestone 3 — EXECUTED (1,251 lines)

`globals.css`: **14,955 → 13,704** (freeze baseline lowered). 191 blocks.

**Deleted families** (each grep-verified at zero `app/components/lib/tests`
consumers after this pass's rebuild): `.applicant-cockpit-*` (page vars +
hero/stepper/layout), the whole consumer-free `.cockpit-*` skin family
(panel/section/detail-grid/prose/muted/slot/document/timeline/assignment/
person/form/buttons/text-link/video-callout/review-workspace/sidebar-card/
score-chip/stack/hero-status/scheduler), `.iv-cockpit-*`,
`.collapsible-assignment-*`, `.applicant-next-action-*`, `.chair-review-*`
(the deprecated V1 — its only "consumer" `ChairDecisionWorkspace.tsx` was an
orphan with zero importers, deleted), `.final-review-cockpit` rules
(replaced by the Tailwind wrappers/snapshot/dock), `.cockpit-skel` + the
`cockpit-spin`/`cockpit-pulse`/`cockpit-skel-shimmer` keyframes.

**Mixed selector groups split, live members kept:** `.review-editor-panel`
/ `.review-editor-notice` (review editors' own skin) extracted from five
shared rules.

**Why safe without Playwright (validation run):**

1. A scripted audit extracted every class name in the candidate families
   from `globals.css` and grep-verified consumers; the six still-live
   classes (`cockpit-panel`, `cockpit-section-heading/kicker`,
   `cockpit-muted`, `cockpit-hero-chip` comment, `cockpit-skel`) were
   converted in this same pass before deletion.
2. The `:root` Final-Review token block (`--cockpit-canvas/surface/line`,
   `--score-*`, `--ink-*`, `--shadow-dock`) is **kept** — the chair
   cockpit's inline styles consume it (plus per-usage fallbacks).
3. Brace-balance + dead-selector scans on the final file; typecheck,
   production build, `css:freeze-check` (13,704), lint on touched files,
   nav contract suite all green.

**Intentionally kept:** `.iv-status-badge` (interview UI StatusBadge),
`.iv-live-*`/`.iv-card*` (interview workspace), `.review-editor-*`,
`.dashboard-action-stripe` (dashboard next-actions), `.save-dot` base
(inline-styled component), `.slideout-*`, the `:root` cockpit tokens, and
all generic `.pill*`/`.button`/`.card` families still used by legacy
routes.

**Next deletion milestone (4):** the interview workspace
(`.iv-live-*`/`.iv-card*`, ~? lines) and `.review-editor-*` once the
interview/review editors are rebuilt; then the generic `.card`/
`.stat-card`/`.topbar` families as remaining leadership pages migrate
(plan §22.6 phase 4).

## Connections

- Applicant workspace back bar ⇄ Application 360 (chair tier) and the
  board; chair cockpit snapshot bar → Application 360; Application 360 →
  cockpit (existing DecisionDock CTA) and full workspace.
- Work Hub application rows → Application 360 (chair queue rows →
  cockpit); record pages → `/work?entity=…` lens; Help Agent application
  results land on Application 360 (Phase 2C) where the role-aware CTAs
  live.

## Validation status (this environment)

- Green: typecheck, lint (touched files), `css:freeze-check` (13,704),
  production build, new capture tests (7), work-hub-rows tests (14), nav
  contract suite, targeted suites.
- Pre-existing and unchanged: the 4 `nav:check` core-map findings and the
  13 baseline vitest failures in 6 unrelated suites (verified against main
  in Phase 3A; re-checked after this pass).
- No `DATABASE_URL` → browser smoke not runnable; CSS deletion proceeded
  on the static/build validation above per the Phase 3B directive.

## Known limitations / next pass

- The chair cockpit's inner panels (ScoreMatrix, ReviewSignalFeed,
  modals/banners/toasts) still use inline styles over the kept `:root`
  tokens — consistent visually, but not yet ui-v2 primitives.
- The interview workspace (`[id]/interview`, `.iv-live-*`) is still legacy
  CSS (deliberately untouched — next milestone).
- Inline capture lives on the action detail card; the Work Hub preview
  rail and Entity Action Panel rows link to the card rather than capturing
  in place.
- The Entity Action Panel's decisions-without-actions input is only fed on
  surfaces that load decision linkage (omitted where the ops context
  doesn't carry `linkedActionId`).
