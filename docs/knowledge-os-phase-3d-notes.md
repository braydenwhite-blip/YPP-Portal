# Knowledge OS V2 — Phase 3D Implementation Notes

**Scope shipped:** the **`/interviews` hub rebuilt on ui-v2/Tailwind**, the
**chair cockpit modal/toast/banner chrome converted** to new ui-v2
primitives (`ModalV2` / `ToastV2` / `BannerV2`), **SearchDocument
write-path upserts** for User / Partner / InstructorApplication /
ActionItem, a **nightly reconcile cron** (`/api/cron/search-reconcile`),
the **partner + applicant search groups cut over** to the index (with live
fallbacks), and **CSS deletion milestone 5** (837 lines removed; freeze
baseline lowered to **10,761**). Companion to the master plan (§8, §15,
§16, §22.6, §24) and the Phase 3A/3B/3C notes.

## `/interviews` hub — rebuilt on ui-v2

All workflow behavior preserved unchanged: the
`getInterviewCommandCenterData` loader (role gating, scope/view/state
normalization, hiring + V1 instructor + readiness task folds, KPI math),
every inline server-action form (`confirmInterviewSlot`,
`completeApplicationInterviewAndNote`, `saveStructuredInterviewNote`,
`confirmPostedInterviewSlot`, `completeInstructorInterviewAndSetOutcome`),
scheduler links, secondary links, blockers, and empty/section behavior.

- **Page** (`app/(app)/interviews/page.tsx`): `PageHeaderV2` (eyebrow
  "Interview Ops", concrete subtitle), primary **Open scheduler** action.
- **`InterviewHub`**: KPI strip on `StatCardV2` (click-to-filter:
  Needs my action / Scheduled / Today / Completed this week — `attention`
  tone only when the count demands action), next-best-action callout,
  filters, four queue sections.
- **`InterviewFilters`**: `CardV2` + URL-synced Tailwind segmented
  controls (Scope / View) + `FilterBar`/`FilterChipLink` state chips with
  counts. Filters stay links, not client state.
- **`InterviewTaskCard`**: Tailwind card (brand left-accent for
  needs-action), domain + stage + scheduling `StatusBadge`s, inline
  capture forms on a shared Tailwind field vocabulary, ui-v2 `Button`s,
  secondary links as secondary buttons.
- **`components/interviews/ui/*`** rewritten on Tailwind with identical
  APIs — `StatusBadge` (interview tone vocabulary on the ui-v2 semantic
  color set) and `Kbd` are also consumed by the Phase 3C live interview
  workspace (`interview-review-editor`, `KeyboardHelp`), so this is what
  freed the `.iv-*` CSS. `EmptyState` now wraps `EmptyStateV2`. Unused
  `MetaList` deleted.
- **Entity 360 hooks:** `InterviewTask` gained optional `relatedEntity`
  (`person` | `applicant`); V1 instructor-application tasks render an
  `EntityChip` into the applicant 360 preview, team readiness tasks into
  the instructor's person 360. Admin viewers get an **Application 360**
  secondary link on V1 tasks (`/admin/instructor-applicants/[id]`).

**Deliberately not rebuilt:** `/interviews/schedule` (the 1,506-line
scheduler client). It uses zero `.iv-*` classes — only shared legacy
families (`.button`/`.input`/`.form-row`/`.pill*`) still live elsewhere —
so it neither blocks milestone 5 nor belongs in this pass.

## Chair cockpit chrome — ui-v2 primitives

New primitives in `components/ui-v2/`: **`ModalV2`** (backdrop + spring
panel, Escape/backdrop dismissal with a `locked` gate, `size`/`accent`
variants, `dialog`/`alertdialog` roles, focus capture/restore) +
`ModalFooterV2`, **`ToastV2`** (tone stripe, bottom-left/right position,
`bottomOffset` to clear sticky docks), **`BannerV2`** (tone + sticky
variants, title/actions slots).

Converted (presentation only — `chairDecide` lifecycle, idempotency keys,
rejection-reason enforcement, condition validation, HIGH_RISK
acknowledgement gating, stale-click/deadlock/network-drop recovery, sync
rollback, rescind, audit chain, queue navigation, notification resend, and
read-only mode all untouched):

- Modals: `DecisionConfirmModal`, `StaleClickRecoveryModal` (kept its
  own Escape→acknowledge handler; `locked` blocks backdrop dismissal to
  match prior behavior), `CommitErrorModal` (field-jump intact),
  `RescindDecisionModal`, `ContrarianWarningModal`.
- Toasts: `PostDecisionToast` (140px offset, hover-pause kept),
  `DeadlockRetryToast` (bottom-left), `NotificationResendToast` (80px).
- Banners: `SyncRollbackBanner` (danger, alert role),
  `NetworkRecoveryBanner` (warning), `CockpitNotificationBanner`
  (aging severity → tone map with the three-step accent escalation kept),
  `ApplicantStatusBanner` (per-status tone map, rescind button intact).
- `DecisionPendingOverlay` → Tailwind; the dead `cockpit-spin` keyframe
  reference here and in `ActionButton` replaced with `animate-spin`.

The `:root` cockpit/score/ink tokens in `globals.css` are **kept** — other
cockpit panels (ScoreMatrix etc., converted to tokens in 3C) still consume
them.

## SearchDocument write path + nightly reconcile

**New module: `lib/help-agent/search-indexing.ts`** — the single
entity→row vocabulary: deterministic builders (person / partner /
applicant / class / meeting / action), `upsertSearchDocument` /
`removeSearchDocument`, per-entity **sync helpers that never throw**
(re-read committed state; upsert when the entity qualifies, remove when
archived/deleted; failures are logged and the mutation proceeds), and
`reconcileSearchDocuments()` — the idempotent full rebuild reporting
counts by entity type and deleting stale rows.

**Wired write paths:**

- **Partner:** `createPartner`, `updatePartner`, `archivePartner`
  (removes row); contact mutations (`addPartnerContact`,
  `removePartnerContact`) re-sync keywords. Partner keywords now include
  the **relationship lead's name** (builder + reconcile).
- **InstructorApplication:** one central hook inside
  `syncInstructorApplicationWorkflow` (lib/workflow.ts) — every lifecycle
  mutation already funnels through it (16 call sites incl. `chairDecide`,
  signup creation, interview actions), so status/title stay current; plus
  explicit syncs on `archiveApplication`, `autoArchiveTerminalApplications`,
  `archiveApplicantSubmissionById` (instructor case), and
  `editInstructorApplicationFields` (name edits).
- **ActionItem:** `createActionItem`, `updateActionItem`,
  `updateActionStatus`, `captureActionCompletion`, `captureActionBlocker`.
- **User/person:** `updateBasicInfo` (profile name), admin `createUser`,
  and `archiveUserById` (removes row).
- **Deliberately not wired:** the bulk CSV user import and bulk
  archive-all paths (high-volume; the nightly reconcile covers them
  within a day).

**Nightly reconcile:** `app/api/cron/search-reconcile/route.ts`
(CRON_SECRET bearer auth, repo cron convention) scheduled in `vercel.json`
at `0 4 * * *`; `scripts/backfill-search-documents.ts` is now a thin
wrapper over the same `reconcileSearchDocuments()` (`npm run
search:reconcile`). The reconcile also now indexes **applicants**
(non-archived InstructorApplications: composed name title, raw status
subtitle, legal-name/account keywords, OFFICER tier).

## `/api/search` after this pass

`runHelpAgentSearch` reads the index for **person, partner, and
applicant** via a shared `searchIndexGroup(entityType, tier, q)` reader
(count → text query on title+keywords). Fallback to the live Prisma query
on: empty group, zero text hits, or index error — identical semantics to
the hardened Phase 3C person path. **Applicant index hits are re-checked
against the live `instructorApplicationVisibilityWhere` filter** (one
`id IN (...)` query), so the index can never widen access; partner hrefs
stay admin-gated (`null` for non-admin officers) on the index path.
Classes/meetings/actions stay live (meetings need date context the index
lacks); initiatives stay config-defined. Recents hydrate live, unchanged.

## Connections

- Help Agent suggestions: **Interviews needing my action** →
  `/interviews?state=needs_action` (MEMBER) and **Upcoming interviews** →
  `/interviews?state=scheduled` (OFFICER) — both real, role-safe filters.
- `/interviews` → live interview workspace, applicant workspace,
  Application 360 (admins), `/interviews/schedule`; task `EntityChip`s
  open applicant/person 360 previews in place.

## CSS deletion milestone 5 — EXECUTED (837 lines)

`globals.css`: **11,598 → 10,761** (freeze baseline lowered). One
self-contained block (old lines 6692–7528): the entire "Interviewer View
(.iv-*)" layer — `:root --iv-*` tokens, `.iv-page`, `.iv-toolbar*`,
`.iv-section*`, `.iv-card*`, `.iv-status-badge*`, `.iv-kpi-*`,
`.iv-filter-*`, `.iv-segmented`, `.iv-empty-state*`, `.iv-meta-list`,
`.iv-kbd*`, `.iv-hint-cluster`, `.iv-task-card*`, `.iv-hub-*`, and their
media/reduced-motion blocks.

**Why safe without Playwright (validation run):**

1. Grep audit: after the rebuild, zero `iv-` class consumers across
   `app/`, `components/`, `lib/`, `tests/`, `e2e/` (the only remaining
   `iv-` strings are localStorage keys and element ids, not classes);
   `--iv-*` variables were referenced nowhere outside the deleted block.
2. The block was verified self-contained: its only non-`.iv-` selector
   was the `:root` holding `--iv-*` tokens; no mixed selector groups.
3. Brace-balance scan on the final file; typecheck; production build;
   `css:freeze-check` (10,761); lint on touched files; interview suite
   (13), chair/application suites (57), search suites (26), nav contract
   (`nav:check` — 203 routes / 9 roles) all green.

**Intentionally kept:** the `:root` cockpit/score/ink token block (live
consumers in chair cockpit panels), `.form-row`/`.form-grid`/`.input`/
`.button`/`.pill*` (shared legacy families used by `/interviews/schedule`
and other legacy routes), `.slideout-*`, kanban chassis.

**Next deletion milestone (6):** the scheduler client's shared families
once `/interviews/schedule` is rebuilt; then the generic `.card`/
`.stat-card`/`.topbar` families as the remaining leadership/admin pages
migrate (plan §22.6 phases 4–5).

## Validation status (this environment)

- Green: typecheck, production build, `css:freeze-check` (10,761), lint
  on touched files, `nav:check`, and targeted vitest suites:
  help-agent-search (16), search-indexing (10, new), interviews-workflow /
  scheduling / inline-panel / review-editor (13), chair + application +
  work-hub + suggestions + capture (57).
- Full `tests/lib` run: 2,252 passed, 7 failed in 4 suites
  (summer-workshop-outline, journey-editor-validation,
  instructor-review-actions, page-helper-coverage) — re-run on a clean
  stash of `main`: the same 7 fail identically, i.e. pre-existing
  baseline failures unrelated to this pass.
- No `DATABASE_URL` → browser smoke not runnable; CSS deletion proceeded
  on static/build validation per the Phase 3D directive.

## Known limitations / next pass

- `/interviews/schedule` still legacy CSS (shared families — see above).
- Action/meeting/class search groups remain live-query by design.
- Bulk user import does not upsert per row; the nightly reconcile heals it.
- The index uses `contains` matching; pg_trgm fuzziness remains a later
  optimization (master plan §24).
- `SearchIndexHealthCard` / admin reindex button not built yet — the
  cron route + `npm run search:reconcile` are the operational levers.
