# YPP Tech Team — Weekly Tasks: June 16–20, 2026

> **Expected output vs. actual output template**
> Each section below marks what we *expected* to ship this week. After the week, fill in the "Actual" column.
>
> | Task | Owner | Expected by | Actual | Notes |
> |------|-------|-------------|--------|-------|
> | *(copy each task row here)* | | | | |

---

## Priority Guide

- 🔴 **P0 — Must ship this week** (tied to deadline from Aveena's email)
- 🟡 **P1 — Should ship this week** (blocks next sprint or is in-flight)
- 🟢 **P2 — Best effort this week** (no hard deadline, moves things forward)

---

## BRAYDEN — Technical Core & Critical Systems

> Owns the things that touch the database, auth, routing, and anything that can break other people's work.

### 1. 🔴 Summer Workshop Instructor Pathway — Build the MVP

The full spec lives in `docs/summer-workshop-instructor-plan.md`. This is marked urgent — summer camp staffing depends on it. Build in this exact order:

- [ ] **Schema + migration.** Add `instructorSubtype` (enum: `standard` | `summer_workshop`), `applicationTrack` (enum: `standard_instructor` | `summer_workshop_instructor`), `workshopOutline` (JSON), `promotionEligibility` (JSON), `subtypeChangedAt`, `subtypeChangedBy` to the instructor/applicant model. Add new audit event types (`application.track_selected`, `workshop_outline.submitted`, `instructor.promoted_to_standard`, etc.). Backfill existing rows with `instructorSubtype = standard` and `applicationTrack = standard_instructor`.
- [ ] **Track selector page.** Two-card chooser at the application entry point (Standard Instructor vs. Summer Workshop Instructor). Clear copy, clear visual difference.
- [ ] **Summer workshop application form variant.** Shorter prompts, structured Workshop Outline section. Wire `applicationTrack` on submit.
- [ ] **Conditional workshop-specific interview prompts.** Append 4 summer workshop prompts to the existing interview template only when `subtype = summer_workshop`.
- [ ] **Onboarding route branching.** Gate LDS requirement off for summer workshop subtype; route to lighter training modules.
- [ ] **"Promote to Full Instructor" action.** Button on instructor profile (visible only when `instructorSubtype = summer_workshop`). Confirmation modal showing outstanding requirements. Subtype flips to `standard` on confirm. Audit events logged. History preserved.

**Deadline:** Per Aveena's email. Do not defer.

---

### 2. 🔴 Merge & Close Open Bug-Fix PRs

These have been sitting open and need to be resolved before they go stale.

- [ ] **PR #318 — Fix non-working buttons (async searchParams) + course-library Prisma error.** Review, test locally, merge. These are real user-facing bugs: tabs/filters doing nothing, and `/admin/course-library` throwing a Prisma crash.
- [ ] **PR #139 — Harden zero-goal reflection.** Review and merge.
- [ ] **PR #87 — Fix type error: DeliveryMode cast.** Quick merge — it's a one-liner fix.

---

### 3. 🟡 Knowledge OS V2 — Foundation Wiring

The DB migration for Knowledge OS V2 landed June 11 (`20260611210000_knowledge_os_v2_foundation`). Ensure the app code correctly references the new schema and nothing is broken.

- [ ] Audit any server actions that touch the Knowledge OS tables and confirm they work with the new schema.
- [ ] Confirm the Leadership Roles/Contributions fields (from `20260611120000_add_leadership_roles_contributions`) are wired up in the UI — if not, stub the display so it doesn't silently fail.

---

### 4. 🟡 Action Tracker — Old vs. New Consolidation Decision

Per `docs/portal-consolidation-plan.md`: there are two parallel Action Tracker products. The old one (`/admin/action-center`, `LeadershipActionItem`) and the new one (`/my-actions`, `/all-actions`, `ActionItem`).

- [ ] Confirm `ENABLE_ACTION_TRACKER` is **on** in production. If not, turn it on.
- [ ] Identify if any active users are still hitting the old `/admin/action-center`. If traffic is zero, add a redirect to the new tracker and document it.

---

### 5. 🟡 Testing — Run Full V1 Manual QA Script

`docs/V1_MANUAL_QA_SCRIPT.md` has the checklist. Run this end-to-end on the staging environment.

- [ ] Auth flow (sign up, lockout, password reset, magic link, 2FA)
- [ ] Dashboard per role: Admin, Instructor, Student, Mentor, Chapter President
- [ ] Training: three required modules, LDS capstone, interview gate
- [ ] Classes: browse, enroll, attendance, assignment submit, grade visible
- [ ] Mentorship: pairing, goal update, monthly review, chair path
- [ ] Recruiting: apply, pipeline transition, interview slot, decision paths
- [ ] Chapter: members, join request, announcement, calendar RSVP
- [ ] Parent: link request, read-only student views
- [ ] Analytics: admin metrics match DB counts
- [ ] Edge cases from `docs/v1-test-tracker-template.md`

Record all results in the shared Google Sheet.

---

### 6. 🟢 PR #417 — Close the Stale Vercel Redeploy PR

PR #417 is just a trigger redeploy PR for preview branch `f-6dd640`. Check if the preview is still needed. If not, close the PR.

---

## ANTHEA — UI Polish & Admin Surfaces

> Owns visual quality, admin-facing components, and instructor/recruiting UI. Works from Figma mocks where they exist; otherwise follows the existing YPP design system (purple palette, CSS vars, no Tailwind).

### 1. 🔴 Summer Workshop Instructor — Admin Board UI

Works in parallel with Brayden's backend work. Implement the visual layer for the admin board changes.

- [ ] **Subtype badge on applicant cards.** Small badge: `SW` (Summer Workshop) vs. `STD` (Standard). Visually distinct but does not override the rating color pill. Match existing card component style in `components/cockpit/`.
- [ ] **Filter UI on admin board.** Filter chip/dropdown: *All / Standard / Summer Workshop*. Persist filter state per user via URL param. Match the existing filter pattern used elsewhere in the recruiting kanban.
- [ ] **Workshop Outline tab on applicant detail view.** Read-only structured render of `workshopOutline` fields (title, age range, duration, learning goals, activity flow, materials, engagement hook, adaptation notes). Only render this tab when `applicationTrack = summer_workshop_instructor`.
- [ ] **Soft warning banner on cards + detail view.** If workshop outline has missing fields, show a soft (non-blocking) warning: *"Workshop outline is missing engagement hook"*. Yellow badge treatment, not an error state.
- [ ] **Promotion modal UI.** Confirmation modal for "Promote to Full Instructor" action. Shows: workshops completed, reviewer notes summary, outstanding requirements list (e.g., "LDS capstone not yet submitted"). Clear copy explaining what promotion does and does not waive.

**Deadline:** End of week — must be testable by Friday so QA can run it.

---

### 2. 🟡 Error Screens Polish — PR #317

PR #317 adds type-aware error screens (database, network, auth, not-found, timeout, validation, unknown). Review the visual output and polish.

- [ ] Review each error screen variant in the staging environment.
- [ ] Ensure icon, badge, heading, and description feel consistent with the YPP purple design system.
- [ ] Check that the "error digest" code (reference code for production tracing) renders legibly but doesn't dominate the screen.
- [ ] Merge PR #317 once satisfied, or request specific fixes.

---

### 3. 🟡 Command Center — Post-Simplification Visual QA

The last 5 commits were a major UX simplification (Calm mode, Heavy pages simplification, Command Center OS workspaces). Walk through every workspace and log any visual issues.

- [ ] Navigate `/operations/command-center` as a Leadership user. Check Today, Decide, Meet, Review, Follow Up, Delegate workspaces.
- [ ] Check Calm mode toggle — confirm it applies globally and persists.
- [ ] Check the My Queue section — confirm actions/items render correctly.
- [ ] Log any padding, spacing, truncation, or overflow issues in a shared doc. Flag anything that looks unfinished.

---

### 4. 🟡 Training Journey Beat Components — Visual Review

PR #227 added 880+ lines of CSS for training journey beat components. Run through each beat type and confirm the styling matches YPP standards.

- [ ] SortOrder: drag-and-drop, keyboard mode, readonly state
- [ ] MatchPairs: two-column desktop, tap-to-pair mobile fallback
- [ ] FillInBlank: textarea, character count, focus states
- [ ] BranchingScenario: breadcrumb nav, scenario framing, radio cards
- [ ] MessageComposer: pool selection, preview panel, selected indicators
- [ ] Hotspot: image overlay, accessible radio list alternative, mobile hit targets (≥44px)
- [ ] Flag anything that looks broken or off-brand. Brayden or Wesley can fix component logic; you own visual alignment.

---

### 5. 🟢 Student Pathways — PR #104 Review

PR #104 improves student pathway UX. Review the visual output against current design expectations and either approve or provide specific revision requests.

---

## WESLEY — UI Implementation & Frontend QA

> Owns frontend feature implementations, component-level code, and supporting Anthea's visual direction with engineering. Responsible for E2E test coverage of any UI work shipped this week.

### 1. 🔴 Summer Workshop Instructor — Application Form UI

Works alongside Brayden (backend) and Anthea (admin surfaces).

- [ ] **Track selector page.** Two-card layout at the application entry point. Cards should feel like a clear, calm choice — not a wall of text. Reuse existing card/button patterns from the YPP design system.
- [ ] **Summer workshop application form variant.** Implement the shorter form:
  - Same: contact info, eligibility, availability, background, references
  - Shortened: essays → short-answer prompts (~150 word cap with visible character counter)
  - Removed: LDS/curriculum capstone section
  - Added: **Workshop Outline** section with structured fields (title, age range, duration, learning goals, activity flow, materials, engagement hook, adaptation notes)
- [ ] **Inline help text.** Each section of the workshop form should have one-line guidance text. The overall form top should clarify this is a short-term, camp-based role with a possible promotion path.

---

### 2. 🟡 E2E Tests — Summer Workshop Flow

Once Brayden's schema is in and the application form is built, write E2E tests.

- [ ] **Happy path:** applicant visits entry point → picks Summer Workshop track → fills out shorter form with workshop outline → submits → application appears in admin board with `SW` badge.
- [ ] **Filter test:** admin opens board → filters to "Summer Workshop" → only SW applicants visible.
- [ ] **Promotion path:** admin promotes a summer workshop instructor → subtype changes to `standard` → promotion modal appeared with requirements → audit log records the event.
- [ ] **Regression:** standard instructor flow still works end-to-end with no changes.

Add to `tests/` following existing E2E patterns (see `tests/training-hub-unlock.e2e.ts` as a reference).

---

### 3. 🟡 Training Journey E2E Tests — PR #227

PR #227 includes E2E test files for training journeys. Get these running.

- [ ] Pull the branch `claude/complete-phase-5-ypp-l6Mil` (PR #227).
- [ ] Run `npm run test:e2e:local` and confirm training journey tests pass.
- [ ] Fix any failures. If the tests are flaky (CI drag-and-drop issues), add the existing keyboard fallback pattern as documented in the PR.
- [ ] Merge once green.

---

### 4. 🟡 Fix Async searchParams Bug — PR #318 Frontend Work

The buttons-doing-nothing bug (PR #318) affects several pages. Confirm the fix is correct for each affected page.

- [ ] Test each affected page manually: `admin/mentorship`, `admin/audit-log`, `chapter/members`, `internships`, `resource-exchange`, `learn/modules`, `instructor/sequence-builder`, `instructor/competition-builder`, `instructor/passion-lab-builder`
- [ ] Confirm tab/filter state updates correctly in the URL and the page re-renders with the right data.
- [ ] Sign off on PR #318.

---

### 5. 🟢 Test Coverage — Command Center OS Workspaces

The Command Center OS workspaces (Today, Decide, Meet, Review, Follow Up, Delegate) were just built. Add unit/component tests.

- [ ] Check `tests/` for any existing Command Center tests.
- [ ] Add component tests for the Queue Engine and workspace nav, following patterns in `tests/components/command-center/`.
- [ ] Run `npm run test:coverage` and confirm no regressions.

---

## SHARED — All Three

### By Wednesday, June 18
- [ ] **Brayden:** Schema migration for Summer Workshop Instructor is merged and deployed to staging.
- [ ] **Anthea + Wesley:** Application form UI and admin board UI are visible on staging (even if not final).

### By Friday, June 20
- [ ] **Brayden:** All P0 and P1 backend tasks complete. QA script run and results logged.
- [ ] **Anthea:** Admin board visual layer (badges, filter, outline tab, warnings, promotion modal) complete and QA-tested.
- [ ] **Wesley:** Application form complete, E2E tests for summer workshop flow passing, PR #227 merged.
- [ ] **All:** Nothing is sitting in an open PR without a review. Either merge, close, or leave a blocking comment.

---

## Testing Checklist (end of week gate)

Before calling the week done, confirm all of the following:

- [ ] Summer Workshop Instructor — full happy path works: apply → review → interview → accept → lighter onboarding → promote
- [ ] Standard Instructor flow — **regression check** — nothing changed for existing applicants
- [ ] Command Center workspaces load for a Leadership-role user
- [ ] Buttons/tabs on all pages in PR #318 respond to clicks
- [ ] Error screens render correctly (at least: not-found, auth, database)
- [ ] Training journey beats render correctly on mobile (test on 375px viewport)
- [ ] V1 QA script completed and logged by Brayden

---

## Notes

- **Aveena's email deadlines apply to the Summer Workshop Instructor pathway items.** If any of the above P0 items look like they will slip, flag to Sam immediately — do not wait until Friday.
- **UI work (Anthea, Wesley):** If Brayden's schema is not ready by Tuesday EOD, use mock/hardcoded data to build the UI in parallel so there is no blocker waiting.
- **Branch:** All work goes to `claude/compassionate-ptolemy-gv1hnv` until the week is done, then PR to main.
