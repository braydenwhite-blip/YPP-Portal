# Knowledge OS Phase 3C Review Hardening Notes

Date: 2026-06-12
Branch: `codex/knowledge-os-phase-3c-review-hardening`
Base: `main` with Phase 3C present (`465603b8`, `5acc0d14`)

## Review Scope

- Read the Knowledge OS master plan, Tailwind V2 plan, Phase 3A/3B/3C notes, Action System 4.0 docs, CSS freeze script, search helpers/tests, Entity 360 loaders, Work Hub, People, Partners, applicant workspace, Application 360, live interview/review routes, nav catalog/core map, Help Agent suggestions, and Phase 3B/3C server actions.
- Used static review, grep audits, typecheck, production build, CSS freeze check, touched-file lint, targeted Vitest tests, and nav validation.
- Did not use Playwright, screenshot baselines, browser smoke tests, or DB/auth-dependent browser checks.
- Did not implement Phase 3D or rebuild the `/interviews` hub.

## Issues Found And Fixes Made

### SearchDocument and `/api/search`

- Fixed person SearchDocument fallback behavior in `lib/help-agent/search.ts`.
- Before: if any person SearchDocument rows existed, a query with zero indexed hits returned no people even when the live Prisma fallback had matches.
- After: the index is used only when member-visible person rows exist and the query returns hits; zero hits fall back to the live people query.
- Tightened the person index count to `visibilityTier: "MEMBER"`.
- Added tests for populated index, empty index, throwing index, and zero-hit index fallback.

### Application visibility

- Added `lib/applications/application-visibility.ts` as the shared list/search visibility filter for instructor applications.
- Work Hub application rows and Help Agent applicant search now apply the same high-level visibility model as application record pages:
  - Admins and Hiring Chairs see the full list.
  - Chapter Presidents see their chapter plus orphan applications.
  - Applicants, assigned reviewers, and active current-round interviewers can see their own/assigned applications.
- Added an Application 360 per-record authorization re-check in `app/(app)/admin/instructor-applicants/[id]/page.tsx` after loading the record and before loading linked actions.
- Added tests covering denied Application 360 access and visibility filter shape.

### Entity 360 and admin-only links

- Partner/class Entity 360 previews remain officer-visible, but `pageHref` now points to admin-only full pages only for admins.
- Applicant Entity 360 now applies instructor application visibility before loading record data.
- Help Agent partner/class results and recents now omit admin-page fallback hrefs for non-admin officers.
- Help Agent suggestions now hide admin-only shortcuts from non-admin officers while keeping officer-safe database shortcuts visible.

### Work Hub links

- Work Hub partner request/follow-up rows now send non-admin officers to safe `/work?entity=partner:<id>` filtered work views instead of admin-only partner records.
- Work Hub quiet mentorship rows now send non-admin officers to `/work?entity=mentorship:<id>` instead of admin-only mentorship admin.
- Admin users keep the direct admin record shortcuts.
- Added Work Hub row tests for safe non-admin links and admin direct links.

### Entity Action Panel and inline capture

- Fixed `ActionStatusCapture` so the existing `nextFollowUpAt` value is prefilled when completing or blocking an action.
- Fixed `captureActionCompletion` and `captureActionBlocker` so clearing the follow-up date writes `nextFollowUpAt: null` instead of silently preserving a stale date.
- Wired the existing follow-up date through `EntityActionPanel`, `EntityActionRowCapture`, and `ActionDetailCard`.
- Added targeted tests for clearing next follow-up dates on completion and blocker capture.

### People / Partners / Help Agent polish

- Hid People “Add person” from non-admin officers because `/admin/bulk-users` is admin-only.
- Hid Partners “Report” and “Add partner” from non-admin officers because those admin routes are admin-only.
- Hid the Partner preview rail “Add contact / request” quick action from non-admin officers.
- Adjusted empty-state copy for non-admin partner viewers so it no longer sends them to partner admin.

### Navigation

- Fixed core-map validation drift:
  - Reduced Instructor core links from 9 to 8.
  - Added existing, role-valid core shortcuts for Hiring Chair, Chapter President, and Mentor.
- `npm run nav:check` now passes.

## CSS Audit

- `app/globals.css` is still exactly 11,598 lines.
- `scripts/check-globals-css-freeze.mjs` baseline remains 11,598.
- No additional CSS was deleted in this pass.
- Grep audit found no live JSX references to the Phase 3C-deleted global class families:
  - `live-interview-*`
  - `question-runner-*`
  - `review-editor-*`
  - `chair-review-*`
  - `applicant-cockpit-*`
  - `application-360-*`

## Validation

- Targeted tests:
  - `npx vitest run tests/lib/help-agent-search.test.ts tests/lib/help-agent-suggestions.test.ts tests/lib/application-visibility.test.ts tests/lib/people-strategy-action-capture.test.ts tests/app/application-record-page.test.tsx tests/lib/work-hub-rows.test.ts`
  - Result before final docs/build pass: 6 files passed, 41 tests passed.
- Touched-file lint:
  - `npx eslint --ext .ts,.tsx ...`
  - Passed.
- Typecheck:
  - Initial run exposed stale generated Prisma types and missing local packages.
  - Freed npm cache space, regenerated Prisma, installed declared local dependencies `class-variance-authority` and `tailwind-merge` into `node_modules` without package changes.
  - `npm run typecheck` passed after local environment repair.
- CSS freeze:
  - `npm run css:freeze-check` passed.
- Production build:
  - `npm run build` passed.
  - Build printed Prisma connection-limit notices during page-data collection; no build failure.
- Navigation:
  - Initial `npm run nav:check` failed on core-map count drift.
  - After core-map cleanup, `npm run nav:check` passed with 203 catalog routes and 9 roles checked.

## Remaining Risks

- No browser smoke tests were run because this pass explicitly forbids Playwright and screenshot/browser validation.
- No live DB/auth smoke was attempted. The build and targeted unit tests provide static confidence, but not end-to-end session validation.
- Application visibility filters for interviewer assignments cover the active current rounds used by the workflow. Record pages still perform authoritative per-record assertions after loading.
- npm reported existing audit findings after repairing local dependencies. This pass did not run broad dependency upgrades or `npm audit fix`.

## Phase 3D Readiness

Phase 3D is safer to start after this pass. The biggest Phase 3C hardening items are now covered:

- person SearchDocument fallback no longer hides live results;
- application list/search visibility is centralized;
- Application 360 does per-record authorization;
- admin-only shortcut leakage in People, Partners, Help Agent, Entity 360, and Work Hub was reduced;
- inline action capture preserves and clears follow-up dates correctly;
- nav validation is green.

Recommended Phase 3D starting branch: `codex/knowledge-os-phase-3c-review-hardening` after it is merged.
