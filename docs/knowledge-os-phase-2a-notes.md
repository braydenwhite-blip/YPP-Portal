# Knowledge OS V2 — Phase 2A Implementation Notes

**Scope shipped:** App shell + dark premium sidebar on Design System 2.0, master
People database (`/people`), master Partner database (`/partners`),
preview-first rails on the Entity 360 payload, partner relationship-operations
UI (contacts / requests / agreements), and Help Agent retargeting.
Companion to `docs/ypp-organizational-knowledge-os-master-plan.md` (§9, §10,
§22) and `docs/ypp-tailwind-design-system-v2-plan.md`.

## App shell & sidebar

- The **skin** is Design System 2.0: `components/ui-v2/sidebar.tsx` defines the
  dark premium vocabulary (surface gradient, link/icon/badge/group-toggle
  variants, user footer card); `components/app-shell.tsx` and
  `components/nav.tsx` compose it. One chrome for all nine roles — content
  still comes from `resolveNavModel`, behavior is unchanged.
- The **chassis** intentionally stays on the frozen legacy structural classes
  (`.app-shell`, `.sidebar`, `.sidebar-toggle`, `.sidebar-backdrop`,
  `.sidebar-header/nav/footer`): they carry positioning, scroll regions, the
  ≤960px off-canvas behavior, and print rules that all roles share. Utilities
  loaded after `globals.css` override the visual properties.
- **Dead legacy CSS (queued for deletion milestone 1, addendum §9):** the
  `.nav*` blocks (`globals.css` ~620–976 and the role-minimal variants), the
  sidebar skin parts of `.sidebar`/`.sidebar-header`/`.sidebar-footer`
  (background/border/shadow), `.sidebar-card*`, `.sidebar-marble-panel*`,
  `.sidebar-user-*`, `.sidebar-footer-card*`. Delete them once a DB-enabled
  environment has captured the visual baselines below — not before.
- Recently Viewed (officer tier) lives in the sidebar via
  `components/help-agent/sidebar-recents.tsx`, reading the same recents the
  Help Agent serves on an empty query.

## Shell safety net (visual testing status)

- This change shipped from an environment **without a database**, so
  authenticated browser screenshots were impossible. Two substitutes shipped:
  1. `tests/components/app-shell-nav-contract.test.tsx` — jsdom structural
     contract for the nav across full-chrome and role-minimal modes (written
     green against the legacy skin, kept green after the reskin).
  2. `tests/e2e/nightly/knowledge-os-shell-visual.spec.ts` — Playwright
     screenshot baselines (sidebar-only + masked full page) for `/`,
     `/help-agent`, `/admin`, `/people`, `/partners`, and the student home.
     **Run `npm run test:e2e:seed && npx playwright test
     tests/e2e/nightly/knowledge-os-shell-visual.spec.ts --update-snapshots`
     in a DB-enabled environment to record the first baselines.**

## Master databases

- `/people` — officer-tier directory over `User` + satellites
  (`lib/people/directory.ts`). Role/flag filters are URL params (shareable,
  StatCard click-to-filter): `role=student|instructor|mentor|advisor|
  leadership|applicant|parent`, `flag=no-advisor|checkin-overdue`, `q=`.
  Advisor state (assignment, last/next check-in, overdue, follow-up flag) is a
  first-class column; instructor rows show current-class counts; applicant
  rows show pipeline stage. No "last active" column — the schema has no
  reliable last-login fact, so the row shows joined date instead of a fake.
- `/partners` — officer-tier relationship database
  (`lib/partners-directory.ts`): relationship lead, structured primary contact
  (legacy contact fields as fallback), linked classes, stage, last
  interaction, next step (follow-up date → open request → stuck reasons),
  open-request and agreement/condition counts, upcoming partner-linked
  `OfficerMeeting`s (no new meeting model, per plan). Views/flags:
  `view=active|follow-up|meetings|won|parked`, `flag=no-lead|open-requests`,
  `type=`, `q=`.
- Both pages keep the admin tools where they are: "Add person" →
  `/admin/bulk-users`, "Add partner"/report → `/admin/partners`. The
  flag-gated `/admin/partners` pipeline board is untouched; the partner
  **profile** (`/admin/partners/[id]`) was un-flagged because it is the
  "Open full 360" target of an un-flagged front door (still ADMIN-only).

## Preview-first

- `components/operations/entity-preview-rail.tsx` renders the **same**
  `/api/entity-360` payload as the universal drawer (same loaders, same
  authorization, same recents recording) docked as a right rail on ≥1280px
  screens; below that, row clicks open the existing Entity 360 drawer. It is
  a re-skin of the payload, not a second preview system.
- Person 360 now carries advisor facts/risks for students (advisor, last/next
  check-in, overdue, follow-up flag) and last quarterly review for
  instructor-tier records. Partner 360 now carries primary contact, contacts
  as people, open requests (with overdue risks), and agreement/condition
  rollups.

## Partner relationship operations

- `lib/partner-relations-actions.ts` — ADMIN server actions for
  `PartnerContact` (add / set primary / remove), `PartnerRequest`
  (log / status with resolvedAt stamping), `PartnerAgreement`
  (add / status) and `PartnerAgreementCondition` (add / status with
  satisfiedAt). Vocabulary coercion lives in `lib/partners-constants.ts`.
- `components/partners/partner-relations-panel.tsx` manages all of it on the
  partner profile (anchor `#relationship-ops`, linked from the /partners
  preview rail).

## Help Agent / search

- Suggestions retargeted to the filtered front doors (students without
  advisors, advisor check-ins overdue → `/people?...`; partner follow-ups,
  open requests, **no relationship lead**, **upcoming meetings** →
  `/partners?...`) plus "Open People/Partner database" shortcuts.
- Live partner search now matches structured contact names/emails and shows
  the matched contact in the subtitle; the SearchDocument backfill indexes
  contact names/emails as partner keywords.
- **`/api/search` still runs live Prisma queries** (deliberate at current
  scale). Remaining cutover work: route `/api/search` through
  `SearchDocument` with pg_trgm ranking, add write-path upserts on entity
  mutations, schedule the backfill as a nightly reconcile.

## Validation status (this environment)

- Green: typecheck, lint (touched files), `css:freeze-check` (17,443 lines,
  unchanged), production build, new unit/contract tests.
- Pre-existing and unchanged (verified identical to the pre-change baseline):
  4 `nav:check` core-map count findings (INSTRUCTOR 9 links;
  HIRING_CHAIR/CHAPTER_PRESIDENT/MENTOR below min) and 13 vitest failures in
  6 unrelated suites (incl. the page-helper coverage sweep).
- Not runnable here: Playwright e2e / screenshots (no DATABASE_URL), live
  route smoke tests.
