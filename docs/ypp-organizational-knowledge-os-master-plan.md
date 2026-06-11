# YPP Organizational Knowledge OS — Master Plan (V2)

**Status:** Planning baseline V2 — supersedes V1
**Date:** June 2026
**Scope:** Full portal structure and product architecture — navigation, master databases, entity 360s, Work Hub, YPP Help Agent, **Design System 2.0 (Tailwind-first)**, instructor and student surfaces, and implementation roadmap.
**Grounding:** Every recommendation is based on a direct audit of the current codebase (492 pages, 459 Prisma models, ~145 nav catalog entries, the `lib/operations/` derivation engine, the existing Entity 360 system, and the CSS layer). File paths are cited throughout.

**What changed from V1:**

1. **The visual strategy is reversed.** V1 recommended staying on plain CSS + tokens. V2 names the CSS layer as a product bottleneck and adopts a **Tailwind-first Design System 2.0** for all new and redesigned Knowledge OS surfaces, with an aggressive, phased retirement of `app/globals.css`. See §22 and the companion deep-dive: `docs/ypp-tailwind-design-system-v2-plan.md`.
2. **Scope expands to the whole portal.** V1 scoped the Knowledge OS to the leadership tier. V2 explicitly includes instructor-facing and student-facing surfaces in the plan — sequenced admin-first, but no longer out of scope.
3. **`/people` and `/partners` are must-build**, not recommendations. They are core front doors of the product.
4. **Partner relationship models ship in the first major implementation pass** (migrations are additive and safe), not "Phase 2 if approved."
5. **Student advisor visibility and instructor leadership visibility are elevated** to cross-cutting requirements with explicit placement matrices (§12, §11).
6. **The YPP Help Agent is the first surface built on the new design system** and defines its interaction quality bar.
7. **Mockup-level polish is a requirement, not an aspiration** — including rebuilding page layouts where light edits cannot reach it.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Mockup Synthesis](#3-mockup-synthesis)
4. [Sam/Brayden Feedback Synthesis](#4-sambrayden-feedback-synthesis)
5. [Current Codebase Audit](#5-current-codebase-audit)
6. [Current UX/IA Problems](#6-current-uxia-problems)
7. [Proposed Simplified Portal Structure](#7-proposed-simplified-portal-structure)
8. [YPP Help Agent Plan](#8-ypp-help-agent-plan)
9. [Master People Database Plan (Must-Build)](#9-master-people-database-plan-must-build)
10. [Master Partner Database Plan (Must-Build)](#10-master-partner-database-plan-must-build)
11. [Person 360 Tailoring — Instructor Leadership Centrality](#11-person-360-tailoring--instructor-leadership-centrality)
12. [Student/Advisor Model — Advisor Centrality](#12-studentadvisor-model--advisor-centrality)
13. [Partner 360 Tailoring](#13-partner-360-tailoring)
14. [Program/Class Structure](#14-programclass-structure)
15. [Work Hub Structure](#15-work-hub-structure)
16. [Application Review Structure](#16-application-review-structure)
17. [Mentorship/Advising Structure](#17-mentorshipadvising-structure)
18. [Universal 360 Rules](#18-universal-360-rules)
19. [Vague Metric Audit and Replacements](#19-vague-metric-audit-and-replacements)
20. [Navigation Consolidation Recommendations](#20-navigation-consolidation-recommendations)
21. [Page-by-Page Redesign Recommendations](#21-page-by-page-redesign-recommendations)
22. [Design System 2.0 — Tailwind-First](#22-design-system-20--tailwind-first)
23. [Data Relationship Gaps](#23-data-relationship-gaps)
24. [Search/Indexing Gaps](#24-searchindexing-gaps)
25. [Implementation Roadmap](#25-implementation-roadmap)
26. [Phase 1 Plan — Foundation](#26-phase-1-plan--foundation)
27. [Phase 2 Plan — Master Databases and Admin Records](#27-phase-2-plan--master-databases-and-admin-records)
28. [Phase 3 Plan — Work, Programs, and Member-Facing Surfaces](#28-phase-3-plan--work-programs-and-member-facing-surfaces)
29. [Risks, Tradeoffs, Open Questions](#29-risks-tradeoffs-open-questions)
30. [Validation Checklist](#30-validation-checklist)

---

## 1. Executive Summary

The YPP Portal already contains most of the **engine** of an Organizational Knowledge OS. It is missing the **access layer**, the **polish layer** — and, named plainly in V2, it is built on a **CSS foundation that cannot deliver the product we want**.

What exists and is strong (keep and build on):

- A **universal Entity 360 system** (`lib/operations/entity-360.ts`, `components/operations/entity-360-drawer.tsx`, `/api/entity-360/[type]/[id]`) covering person, class, partner, initiative, meeting, action — permission-aware loaders, stacking drawer panels, one body renderer.
- A **connected work graph**: `ActionItem` and `OfficerMeeting` carry polymorphic entity links, source provenance, two-way meeting↔action conversion, and a strategic initiative layer with a pure, explainable health engine.
- **Honest signals**: class readiness, partner follow-up state, attention queues, and initiative health are pure functions of real counts with reasons attached (`lib/operations/signals.ts`, `lib/operations/attention.ts`).
- A **first-class Student Advisor system** (`StudentAdvisorAssignment`, `AdvisingNote`, `AdvisingRecommendation`; `lib/leadership/`).
- A **comprehensive applicant pipeline** with concrete readiness signals (`lib/readiness-signals.ts`).

What is missing or broken:

1. **No global access layer.** No portal-wide search, no functional ⌘K (the hint in `components/nav.tsx` is decorative), no entity index, no master People database; the Partner database is a flag-gated admin table.
2. **Severe IA fragmentation.** 492 pages; three parallel action trees; five mentorship surfaces; three command centers; 72 admin pages with no internal IA; legacy routes still reachable.
3. **Data gaps for relationship operations.** Partners lack structured contacts, requests, agreements/conditions; advising lacks check-in scheduling; there are no search index tables.
4. **The CSS layer is a bottleneck.** `app/globals.css` is ~17,400 lines of global classes with good tokens applied inconsistently, four meanings of `.card`, no primitives, and no enforcement. It cannot produce mockup-level polish at portal scale, it makes every new page a fresh styling negotiation, and it actively punishes consistency. This is a product problem, not a cosmetic one.

The V2 direction, in one paragraph: **expose the existing engine through four front doors — Home, YPP Help Agent, Master People Database, Master Partner Database — consolidate work into one Work Hub, tailor the Entity 360 per entity type, and rebuild the visual layer on a Tailwind-first Design System 2.0 (`components/ui-v2/`) that all new and redesigned surfaces use from day one, while the legacy global CSS is frozen, contained, and retired in phases.** Every derived signal renders as concrete reasons, never bare scores. Instructor and student surfaces are in scope — admin/operator views first, member-facing dashboards next — because leadership manages the organization through them.

Technical note that makes this tractable: the portal runs **Next.js 16 with Turbopack** (`next.config.mjs` sets `turbopack.root`; `package.json` has `next ^16.2.4` — the Next 14 claim in `TECH_STACK.md` is stale). Tailwind CSS v4 is first-class on this stack, `globals.css` has exactly one import point (`app/layout.tsx:1`), there is no existing PostCSS pipeline to conflict with, and `clsx` and `framer-motion` are already dependencies. There is **no serious technical blocker** to the Tailwind-first direction.

---

## 2. Product Vision

The portal becomes the place where YPP leadership can answer, in seconds, without asking anyone:

- What is happening across YPP this week? What needs attention, and why exactly?
- Who owns what? What changed recently, and what did each meeting produce?
- Which applicants are waiting on a decision, which instructors need reviews, which students need advisor follow-up?
- Which partners are active, which have open requests or unmet conditions, and who owns each relationship?
- Which classes are running, blocked, or missing setup?
- How is every person, partner, class, meeting, initiative, mentorship, application, and action connected?

And it becomes the place where **instructors and students** see a calm, polished, supportive view of their own world: my classes, my next session, my advisor, my open tasks, my next action.

### Apple-simple and data-rich are the same goal

The design system exists to serve one outcome: **fast, intuitive access to the organization's data.** Apple-simplicity here does not mean hiding data; it means every screen has a clear purpose, an obvious search, an obvious next action, and depth available on demand. The portal should feel like one connected organizational brain wearing a calm, premium interface.

Two product laws follow:

- **Every page follows the same product logic** — clear purpose, easy search, obvious next action, deep data through preview/360 — but pages are *not* forced into one identical table+preview layout. A student home and a master database legitimately look different while obeying the same logic.
- **Crowded dashboards are banned.** A card, tile, metric, or panel ships only if it is directly actionable or explains a concrete state. Decoration is debt.

### The four-altitude model

| Altitude | Surface | What it shows |
|---|---|---|
| **Page** | Master database / hub page | Search, filters, identifying columns, primary actions |
| **Preview** | Right-side panel / 360 drawer | Identity, status, next step, key relationships, recent activity, quick actions |
| **Full 360** | Full-page profile | Complete history, all relationships, documents, timeline, deep workflows |
| **Help Agent** | Global ⌘K / Help Agent page | The fastest way to reach any of the above from anywhere |

**Rows open previews first.** Clicking a person/partner/class row opens the right-side preview; opening the full 360 is a separate, always-visible action. Progressive disclosure is the law.

### Scope (revised from V1)

V1 limited the Knowledge OS to the leadership tier. **V2 covers the whole portal**, sequenced deliberately:

1. **Leadership/admin surfaces first** — including the admin instructor and admin student list/detail pages, because operator clarity is how leadership manages the organization.
2. **Instructor-facing surfaces next** — dashboard/home, profile, classes, reviews/interviews where relevant, mentorship responsibilities, leadership contributions, open actions, next steps.
3. **Student-facing surfaces next** — dashboard/home, profile, class pages, enrollment, and above all the **advisor relationship**, plus mentor/mentee context where relevant.
4. Parent/applicant surfaces inherit the design system but are not redesigned in this plan's horizon.

The student/instructor minimal navigation layouts (`lib/navigation/student-v1-nav-layout.ts`, `instructor-v1-nav-layout.ts`) remain structurally sound; what changes is the **quality and content of the pages behind them**.

---

## 3. Mockup Synthesis

Nine mockups define the bar: Executive Home/Cockpit, YPP Help Agent, Universal 360, Instructor Application Review, Mentorship, Class Page, Work Hub, Master People Database, Master Partner Database.

### What to adopt

- **The layout grammar as a requirement**: dark premium sidebar, clean white workspace, rounded cards, generous spacing, calm hierarchy. V2 commitment: where the current page cannot reach this bar by light edits, **rebuild the page layout on Design System 2.0** rather than retrofitting `globals.css` classes.
- **List + right-preview** on People, Partners, Work Hub: master table left, preview panel right, separate one-click "Open 360." Standard pattern for every master database.
- **Stat strips as entry filters, not decoration** — click-to-filter tiles (the Operations Command Center already does this; generalize it).
- **Recently Viewed** in the sidebar and **Connected To chips** in previews — both buildable from existing Entity 360 payloads.
- **One global search affordance** with ⌘K on every page.
- **Quick actions in previews** mapping to existing server actions and drawer deep-links.

### What to reject or fix

| Mockup element | Problem | Replacement |
|---|---|---|
| "The YPP Pulse 92%" | Unexplainable composite | Today's Brief sentences (`buildTodaysBrief`) + attention queue with reasons |
| "Engagement Level: High" (partner) | Undefined metric | Last interaction, open requests, next meeting |
| Health chips without reasons | Score without explanation | Level chip + mandatory visible reasons (engine already returns them) |
| Six+ generic tabs per 360 | Tab overload | Role/type-tailored sections, max 4–5 tabs, empty tabs hide |
| Funnel/donut charts on Home | Pretty, not actionable | Counts that link to filtered queues; charts live in Reports |
| 8 tiles + 5 modules + 2 panels on one Home | Overload — now banned by the crowded-dashboard law | Greeting, 4–6 actionable tiles, Needs Attention, today's schedule, recent activity |
| "Siri for YPP" naming | Gimmicky, implies expensive AI chat | **YPP Help Agent** — search-first, deterministic |

The mockups define the **quality bar and the layout grammar**. The information inventory on each screen is set by the relevance test (§4), not by the mockups.

---

## 4. Sam/Brayden Feedback Synthesis

Six binding rules, applied throughout:

1. **The relevance test.** Every field, metric, card, tab, panel must help the user understand, decide, act, clarify a relationship, or reduce clicks. Otherwise: remove, collapse, or demote one altitude.
2. **No vague labels.** "Health," "Pulse," "Engagement," "Readiness," "Fit," "Risk," "Performance," "Quality," "Activity" are banned as bare UI labels. The engines already compute concrete reasons; the UI must always show them (§19). This applies equally to instructor and student records: no "instructor performance," no "student risk" — show the classes, check-ins, and open items instead.
3. **Master databases are central.** `/people` and `/partners` are top-level must-builds (§9, §10).
4. **Tailored 360s.** One skeleton, per-type content (§11–§13, §18).
5. **Progressive disclosure.** Page → preview → full 360 → deep workflow. Rows open previews first.
6. **The design system serves data access.** Polish is not an end in itself; it removes friction between a leader and an answer. Crowded dashboards are banned unless every item is actionable or explains a concrete state.

The operator runbooks in `docs/brayden/` confirm the theme: the portal is the system of record but operators drown in surfaces. Fewer, calmer, denser-in-meaning screens.

---

## 5. Current Codebase Audit

### 5.1 Scale and stack

- **Framework:** Next.js **16** (`^16.2.4`) with **Turbopack** configured (`next.config.mjs`), React 18+, TypeScript, Prisma 5.22 + PostgreSQL, NextAuth (JWT), server components + server actions. (Correction to V1/`TECH_STACK.md`, which said Next 14.)
- **Styling:** Plain CSS. `app/globals.css` is ~17,400 lines, imported exactly once (`app/layout.tsx:1`). Tokens are well-defined (purple brand scale, 4px spacing, radius/shadow palettes) but inconsistently applied; global classes (`.card`, `.button`, `.topbar`, `.stat-card`) carry divergent meanings across domains; inline styles override tokens; one CSS module exists (`skeleton.module.css`). **No PostCSS or Tailwind configuration exists** — a clean slate for Design System 2.0. `clsx` 2.1.1 and `framer-motion` are already dependencies.
- **Scale:** 492 `page.tsx` files; 459 Prisma models; ~145 nav catalog entries across 9 roles; ~404 components organized by domain, not primitive.
- **AI:** `@anthropic-ai/sdk` used once (`lib/ai/generate-review-draft.ts`). No AI search/assistant exists.
- **Guardrails:** `scripts/validate-nav.mjs` in `check:release`; ~60 Vitest/Playwright tests; Playwright config present (usable for visual regression during CSS migration).

### 5.2 Routes and navigation

Centralized nav (`lib/navigation/catalog.ts`, `resolve-nav.ts`, `core-map.ts`) with per-role minimal layouts. The ⌘K chip filters the sidebar only. Three+ parallel action trees (`/actions/*`, `/all-actions/*`, `/admin/actions/*`, legacy `/admin/action-center/*`); three command centers; five+ mentorship surfaces with an unexecuted consolidation plan (`MENTORSHIP_REDESIGN_PLAN.md`); 72 admin pages, `/admin` redirecting to `/admin/chapters`; no leadership home; gamification surfaces still routed.

### 5.3 Data model

Strong work-graph core: `ActionItem` (~12579) with polymorphic links + provenance + structured completion; `OfficerMeeting` (~13002) + attendees/agenda/decisions/follow-ups with two-way action conversion; `Mentorship` (~2754) + 2.0 matching; `StudentAdvisorAssignment` (~13692) + `AdvisingNote` + `AdvisingRecommendation`; `InstructorApplication` (~1819) + 15 supporting models; `ClassOffering` (~7196) with instructor/partner/chapter links; `Partner` (~7284) with flag-gated pipeline fields + `PartnerNote`.

Gaps (§23): no `PartnerContact`/`PartnerRequest`/`PartnerAgreement`; no advisor check-in scheduling fields; initiatives are config-registry only; **no search/index tables**.

### 5.4 Data 360 and search

`ENTITY_360_TYPES = [person, class, partner, initiative, meeting, action]`; `Entity360Provider` in the app shell; `openEntity(type, id)`; `EntityLink`/`RelatedEntityBadge`; authorization in loaders (officer-tier 404-on-forbidden). `lib/operations/quick-find.ts` ranks prefix > word-start > substring over a **page-local** index. `docs/DATA_360.md` itself names a global ⌘K palette as the next step. `SavedActionView`/`InstructorSavedView` exist per-domain; no generic saved query, recents, or suggestions.

### 5.5 People and partner surfaces

People exist only as per-role tables (`/admin/students`, `/admin/instructors` + mature `[id]` detail, `/admin/staff`, `/admin/alumni`, `/admin/bulk-users`) plus the leadership `/actions/people` dashboard (names are inert text). `/people/[id]` is the canonical profile with officer-gated panels. **No unified directory.** `/admin/partners` is dual-mode behind `ENABLE_PARTNER_PIPELINE` with `[id]` detail — right bones, wrong altitude, missing relationship models.

### 5.6 Work surfaces

Action System 4.0 derivations built and tested but partially unwired in UI (`docs/ACTION_SYSTEM_4.0_DELIVERED.md` §7: Entity Action Operating Panel, Meeting Follow-Up Pack, inline completion capture, Weekly Review sections). Initiatives: config registry + pure health engine with documented windows. Reports scattered.

### 5.7 The CSS layer, stated as a finding

The token vocabulary is good; everything above it is a liability:

- ~17,400 lines of append-only global CSS with no ownership, no dead-code detection, and no scoping. Deleting anything is dangerous, so nothing is deleted.
- No primitives: no PageHeader, Tabs, Modal/Drawer standard, Table shell, or single EmptyState. Domain components hand-roll all of these (~404 files).
- Class semantics drift: `.card` is a table wrapper, a stat tile, a row container, and a panel depending on the page. Spacing between equivalent sections varies 16–48px.
- The polish ceiling is structural: with global classes and no variant system, every page that wants mockup-level finish must hand-tune CSS, and the next page starts from zero.

Conclusion: **incremental primitives on top of `globals.css` (the V1 plan) would slow the decay but never reach the bar.** The foundation itself must change. §22 specifies how.

---

## 6. Current UX/IA Problems

Ranked by impact:

1. **No global access layer** (find "Camp Hudson" requires knowing it's a partner, that partners are under Admin, and having a flag on).
2. **No master People database** ("find Sam Singer" requires knowing Sam's role first; partner contacts and parents aren't findable as people).
3. **Partners are a buried admin table**, not a relationship system; requests/negotiations/agreements live in free text.
4. **Work split across three trees and three command centers.**
5. **Mentorship has five+ entry points and three matching boards**; the consolidation plan is unexecuted.
6. **No leadership home**; the cockpit content is flag-gated one click away.
7. **The CSS foundation blocks polish at scale** (§5.7) — every consistency effort decays because nothing enforces it.
8. **Click depth**: person → open actions is 3–4 clicks; partner → last meeting requires reading a note log.
9. **Advisor state is invisible** outside the student profile panel: no caseload view, no overdue-check-in surfacing, no People-level flags.
10. **Instructor records are operationally rich but scattered**: classes, reviews, mentorship, contributions live in different surfaces with no single instructor picture below the admin detail page.
11. **Dead-end/legacy pages** still reachable (`/all-actions`, `/admin/action-center/*`, `/mentorship-program/*`, `/world`, gamification surfaces in leadership view).
12. **Vague presentation of honest data**: engines compute reasons; several UIs render only level chips.

---

## 7. Proposed Simplified Portal Structure

### Leadership-tier top-level navigation

| Nav item | Route | What it absorbs |
|---|---|---|
| **Home** | `/` (leadership variant) | Executive cockpit (digest, attention queue, today, recent activity) — folds `/operations/command-center` |
| **YPP Help Agent** | global ⌘K + `/help-agent` | Portal-wide search/commands (new; reuses Quick Find ranking + Entity 360) |
| **People** | `/people` | **Must-build** master People database; absorbs `/admin/students`, `/admin/instructors` list, `/admin/staff`, alumni directory, `/actions/people` |
| **Programs** | `/programs` | Class operations, pathways, curriculum (leadership views) |
| **Work** | `/work` | Actions + meetings + initiatives + weekly rhythm |
| **Partners** | `/partners` | **Must-build** master Partner database (un-flagged, promoted from `/admin/partners`) |
| **Mentorship** | `/mentorship` (+ admin ops tab) | Per existing redesign plan; advising joins here for advisor roles |
| **Knowledge** | `/knowledge` | Resource libraries (thin consolidation, later phase) |
| **Reports** | `/reports` | Index of real reports |
| **Admin** | `/admin` | True admin only, with a real home (6 domain groups) |

Principles unchanged from V1: rename-and-redirect (never break URLs), master databases are pages / records are previews / profiles are full pages, feature flags become tier defaults for the leadership tier, `validate-nav.mjs` extended with a redirect map.

### Instructor and student navigation (V2 addition)

The minimal nav structures stay; the destinations get rebuilt on Design System 2.0 in Phase 3:

- **Instructor:** Home (rebuilt dashboard), My Classes, Mentorship/My Mentor, Training, Profile. The instructor home becomes the action-oriented surface specified in §11.
- **Student:** Home (rebuilt dashboard), My Classes, My Advisor (elevated — see §12), My Program, Profile.

---

## 8. YPP Help Agent Plan

### Naming and positioning

"Siri for YPP" is retired everywhere in product vocabulary (code contains zero "Siri" references — verified). The feature is the **YPP Help Agent**: a reliable, deterministic, global command/search layer. Not a chatbot.

### V2 addition: the Help Agent is the design system's proving ground

The Help Agent palette and `/help-agent` page are **the first surfaces built on Design System 2.0** (§22). They are small, new (no legacy CSS to fight), used by everyone, and interaction-dense — keyboard navigation, grouped results, preview panel, drawer launching. If the new system can make the Help Agent feel premium, the patterns (PreviewPanel, EntityChip, StatusBadge, CommandPalette shell, motion standards) are proven for every surface that follows. The palette ships as `ui-v2` components from day one.

### V1 capabilities (no model calls) — unchanged and reaffirmed

- **Indexed entity search** over people, partners, students, instructors, applicants, classes, programs, meetings, actions, initiatives, reviews/interviews, applications, mentorships, and advisor relationships.
- **Fuzzy matching**: Postgres `pg_trgm` + the existing `rankQuickFind` ranking client-side.
- **Grouped results** by entity type; **right-side preview** rendering the existing `Entity360Body`; **open 360** via `openEntity(type, id)`; modifier-click navigates to full pages.
- **Command shortcuts** (`new action`, `add partner`, `go people`, …) through a static registry.
- **Saved queries** (generic `SavedQuery` model generalizing `SavedActionView`), **recents** (`RecentEntityView` + localStorage), **suggested searches** backed by the attention engine.
- **Permissions**: index rows carry visibility tier; hydration goes through already-authorized entity-360 loaders, so a result can never reveal more than its 360 would.

Seeded executive queries (now explicitly including advisor and instructor-leadership queries):

- Students without advisors · Advisor check-ins overdue · Open support needs
- Overdue instructor reviews · Instructors with no upcoming review · Instructors with open leadership follow-ups · Classes with no lead instructor
- Applicants waiting on decision · Applications missing materials
- Partners needing follow-up · Open partner requests/negotiations · Agreements with pending conditions
- Mentorships missing check-ins · Actions from last week's meetings

### Architecture (unchanged)

`SearchDocument` table (tsvector + trigram, visibility tier, write-path upserts + nightly reconcile), `GET /api/search` (<150ms P95), `HelpAgentShell` mounted in the app shell with a real ⌘K handler, `/help-agent` full page with suggested chips and saved queries. Future optional AI summaries remain an explicit-button, single-call pattern — never per-keystroke, never required.

---

## 9. Master People Database Plan (Must-Build)

`/people` is a **core front door of the product**. It ships in the first implementation sequence, on Design System 2.0, and it is the reference implementation of the master-database pattern: search, filters, clean table, right-side preview, one-click full 360, concrete next steps, entity chips, zero vague metrics, zero tab sprawl.

One directory for every person connected to YPP: students, instructors, applicants, mentors/mentees, advisors, parents/guardians, leadership, staff, alumni, partner contacts (once `PartnerContact` lands), interviewers/reviewers. **No new person model needed** — a query over `User` + role/satellite joins.

**Page anatomy:**

- Header (PageHeader primitive): title, "Add Person," Help Agent search.
- Stat strip (click-to-filter, max five): Total people, Instructors (active), Students (active), Mentors, Applicants in process.
- FilterBar: Role, Program/Track, Status, Chapter/School; "More filters" disclosure.
- Master table — six columns: **Name** (avatar + email), **Role**, **Program/Affiliation**, **Status**, **Last Active**, overflow menu.
- **Row click opens the right-side preview** (Person Entity 360); "Open 360" inside the preview goes to the full profile; modifier-click navigates directly.

**Flag chips on rows, sourced from the attention engine — this is where advisor and instructor centrality become visible at the directory level:**

- Students: `No advisor` · `Check-in overdue` · `Open support need`
- Instructors: `Review overdue` · `No next step` · `Open leadership follow-up`
- Applicants: `Waiting on decision` · `Missing materials`

**What the page deliberately omits:** XP/badges/gamification, profile completeness, training detail — 360 altitude.

**Migration of existing surfaces:** `/admin/students`, `/admin/staff`, alumni directory → `/people?role=…` redirects (bulk tooling stays under Admin); `/admin/instructors` list → `/people?role=instructor` while its mature `[id]` page becomes the instructor full-360 (§11); `/actions/people` → Work Hub "By person." Phase-1 hygiene fixes: People Dashboard names become `PersonLink`s; `listActionAssignableUsers` excludes applicants.

---

## 10. Master Partner Database Plan (Must-Build)

`/partners` is the second core front door, and partner records are **relationship operations records, not contact cards**. The V2 stance is decisive: the missing relationship models (`PartnerContact`, `PartnerRequest`, `PartnerAgreement`, `PartnerAgreementCondition` — §23) are **additive, low-risk migrations and ship in the first major implementation pass**, alongside the page itself.

**Page anatomy:**

- PageHeader: title, "Add Partner," Help Agent search.
- Stat strip (click-to-filter): Total partners, Active, Needs follow-up (overdue `nextFollowUpAt` — concrete), Upcoming meetings, Open requests.
- FilterBar: Type, Status/Stage, Region, Relationship lead, Open needs.
- Master table — eight columns: **Partner**, **Type**, **Primary contact**, **Relationship lead**, **Linked programs/classes**, **Status**, **Last interaction**, **Next step / open request**. No "partner health" column, ever.
- Row click → right-side Partner preview; "Open 360" → full profile (§13).

**Partner records must support** (full list, all mapped to schema in §13/§23): relationship lead · primary contact · additional contacts · linked classes/programs/camps · linked instructors · affiliated students · affiliated parents/guardians · meetings · requests · negotiations · conditions · contracts/MOUs/agreements · open actions · next step · last interaction · documents/files.

**Meetings need no new model** — `OfficerMeeting` already supports `relatedEntityType='PARTNER'`; Partner 360 surfaces those meetings and "Schedule meeting" deep-links the existing drawer prefilled (`?new=1&relatedType=PARTNER&relatedId=…`).

---

## 11. Person 360 Tailoring — Instructor Leadership Centrality

One skeleton (§18), role-tailored content. Tabs render only when non-empty.

### Instructor — the full operational picture, in one place

The instructor record is where leadership answers "what does this instructor carry, and what do they need next?" It must visibly show, without hunting: classes taught and current, upcoming sessions, reviews, interviews they conduct, mentorship roles, advisor roles, leadership contributions, open actions, missing next step, recent activity, and next review/check-in.

Tabs: **Overview · Classes · Reviews/Interviews · Mentorship/Leadership · Activity**

- **Overview:** role + track; current classes (chips); **upcoming sessions**; open actions/tasks; **next review due** (or `Review overdue` flag); **next step** (or `No next step` flag); advisor/mentor relationships at a glance; notes.
- **Classes:** taught/current via `ClassOffering.instructorId` + `RegularInstructorAssignment`, with per-class readiness flags.
- **Reviews/Interviews:** applicant history (full `InstructorApplication` chain incl. reapplications), quarterly reviews, interview assignments they conduct with status.
- **Mentorship/Leadership:** mentorships (both directions), **advisor caseload if `STUDENT_ADVISOR`** (advisees, overdue check-ins), `LeadershipContribution` records with status and follow-ups.
- **Activity:** person-story timeline + meetings mentioned in.

**Visibility matrix — instructor leadership state appears in:** the People database (flag chips, §9) · the Instructor 360 (here) · admin instructor pages (rebuilt on the same loaders, §21) · Help Agent saved queries (§8) · Work Hub when action-linked (§15) · Home attention queue.

Banned: "instructor health/engagement/performance/readiness" as bare labels. Allowed: the concrete flags above, each carrying its reason.

### Student

Tabs: **Overview · Classes · Advisor · Activity** — fully specified in §12. Advisor information is the centerpiece of the student record.

### Applicant

Tabs: **Overview · Application · Interviews/Reviews · Activity** — decision-oriented per §16: stage, desired role/track, missing materials (concrete checklist), interview/review completion, recommendation, decision status, next action, timeline.

### Partner contact

Tabs: **Overview · Activity** — organization link, title/role, relationship owner, recent meetings/requests, notes, follow-ups.

### Mentor / Advisor / Leadership variants

Mentors gain a Mentorship tab (mentees, cadence, review queue); advisors gain an Advising tab (caseload, overdue check-ins first); leadership/staff default to the instructor-like layout minus teaching tabs.

---

## 12. Student/Advisor Model — Advisor Centrality

The advisor relationship is **the** student-side relationship the Knowledge OS must make impossible to lose. The schema is largely right (`StudentAdvisorAssignment`, `AdvisingNote`, `AdvisingRecommendation`, `LeadershipContribution(STUDENT_ADVISOR)`, `lib/leadership/advisor-actions.ts`); V2 elevates scheduling, surfacing, and placement.

### Model additions (first implementation pass, alongside partner models)

1. **Check-in scheduling:** `checkInCadenceDays Int @default(14)` and `nextCheckInDueAt DateTime?` on `StudentAdvisorAssignment` — "check-in overdue" becomes a stored, queryable fact.
2. **Structured support needs (Phase 3):** `SupportNeed { assignmentId, category, description, status: OPEN | IN_PROGRESS | RESOLVED | DEFERRED, openedAt, resolvedAt }`.

### The advisor visibility matrix (binding)

Advisor state — **Advisor assigned · Last check-in · Next check-in · Check-in overdue · Support need · Open follow-up** — must be visible in every one of these places:

| Surface | Presentation |
|---|---|
| **People database** (§9) | Row flag chips: `No advisor`, `Check-in overdue`, `Open support need`; advisor name in preview |
| **Student 360 — Advisor tab** | Assignment + status, check-in log, next check-in due, cadence, recommendations with status, follow-up flag, "Log check-in" quick action |
| **Student 360 — Overview** | Advisor chip + last/next check-in line (always above the fold) |
| **Admin student pages** (§21) | Advisor columns in list; advisor panel in detail (rebuilt on the same loaders) |
| **Help Agent** (§8) | Seeded queries: students without advisors, overdue check-ins, open support needs |
| **Home attention queue** | Attention categories: "student without advisor," "advisor check-in overdue" (added to `lib/operations/attention.ts`) |
| **Work Hub** (§15) | Advisor follow-ups optionally create `ActionItem`s (`sourceType: ENTITY`, related student) and appear in the unified work picture |
| **Advisor caseload view** (§17) | Advisees sorted overdue-first: status, last/next check-in, open needs, quick actions |
| **Student-facing pages** (Phase 3) | "My Advisor" card on the student home: advisor identity, next check-in, how to reach them — supportive tone, not surveillance |

### Student 360 specification

- **Overview:** grade/school (`UserProfile`), enrolled classes, **advisor chip or `No advisor` flag**, last/next check-in, mentor if any, parent/guardian chips (`ParentStudent`), open support needs, next action.
- **Classes:** enrollments with concrete attendance pattern (sessions attended/total, last absence) and class progress.
- **Advisor:** the full §12 panel.
- **Activity:** program history timeline.
- Demoted from leadership view: XP, badges, streaks.

Banned: "student health/engagement/risk/quality" as bare labels. The flags above, each with its reason, carry the load.

---

## 13. Partner 360 Tailoring

Tabs: **Overview · People · Classes/Programs · Meetings · Requests & Agreements · Activity**

- **Overview (relationship cockpit):** identity (name, type, status/stage, region, website); **relationship lead** (reassignable person chip); **primary contact** (from `PartnerContact`, with email/phone quick actions); concrete state row — Last interaction · Next follow-up (overdue in red) · Next meeting · Open requests · Open actions; **next step** (required when active — the "partner without next step" attention signal already exists); quick actions (Schedule meeting, Log interaction, Add note, Create action, Add request).
- **People:** `PartnerContact` list (name, title, role, primary flag); affiliated instructors (via linked classes); affiliated students/parents (via enrollments in linked classes + `ParentStudent`).
- **Classes/Programs:** linked `ClassOffering`s with status, enrollment, lead instructor, next session; "Create class for this partner."
- **Meetings:** all partner-linked `OfficerMeeting`s — date, attendees, decisions, open follow-ups; one click into Meeting 360.
- **Requests & Agreements:** `PartnerRequest` list (ask, status OPEN | IN_NEGOTIATION | AGREED | DECLINED | FULFILLED, owner, due, fulfilling classes); `PartnerAgreement` list (MOU | CONTRACT | INFORMAL; DRAFT | SENT | SIGNED | EXPIRED; dates; **conditions with per-condition status** PENDING | SATISFIED | WAIVED; linked `FileUpload` documents).
- **Activity:** unified relationship timeline (notes of all kinds, stage changes, meetings, completed actions, signed agreements).

Every leadership question maps to a tab: ownership/last interaction/next step → Overview; classes → Classes; instructors/students/parents → People; meetings → Meetings; requests/negotiations/conditions/contracts → Requests & Agreements.

---

## 14. Program/Class Structure

**Leadership hub `/programs`:** stat strip (Active classes, Starting soon, **Needs setup** — from `deriveClassReadiness`'s missing-setup list, Completed this term); table (Class, Program/Track, Partner, Lead instructor, Schedule, Enrollment n/capacity, Status, Next session); row → Class 360 preview. Secondary tabs: Pathways, Curriculum/Templates.

**Class 360 tabs:** Overview · Students · Instructors · Curriculum · Meetings/Actions · Activity. Overview carries: name, program/track, partner chip, schedule, enrollment, lead instructor + team, next session, curriculum progress, attendance status, open issues, partner follow-up flag, quick actions.

**Readiness replaces "health"** — render the checklist (`deriveClassReadiness` + `computePublishReadiness`), never just the level: Instructor assigned · Schedule set · Next lesson ready · Enrollment ≥ minimum · Attendance logged · Open issues (n) · Partner follow-up needed.

**Member-facing class pages (Phase 3):** instructor "My Classes" (roster, next session, attendance entry, open tasks per class) and student class pages (schedule, materials, progress) are rebuilt on the same loaders and Design System 2.0 — simpler renders of the same truth.

---

## 15. Work Hub Structure

`/work` unifies `/actions` (My/All/meetings/people/completion-report), `/operations/command-center`, and `/operations/initiatives`; legacy `/admin/action-center` and `/actions/command-center` retire with redirects.

- Stat strip (click-to-filter): Needs attention, Overdue actions, Upcoming meetings, At-risk initiatives, Open work items.
- Tabs: **All Work · Actions · Meetings · Initiatives · My Queue** (+ "By person" view absorbing the accountability dashboard).
- Unified list via the existing `WorkItem` fold (`lib/operations/work-items.ts` lanes); right preview = Action/Meeting/Initiative 360 panels; saved views via generalized `SavedQuery`.
- Rows: title, type icon, owner, **EntityChip** to the linked person/partner/class/initiative, due/next step, status.
- Flows in beyond actions/meetings/initiatives: reviews needing action, applicant next steps, **partner requests**, **mentorship/advisor check-ins** — all as attention categories with reasons.
- **Finish wiring Action System 4.0** here: Entity Action Operating Panel, Meeting Follow-Up Pack, inline structured completion/blocker capture, Weekly Review sections (derivations exist).

---

## 16. Application Review Structure

Application review stays fully in scope and becomes **decision-first**. Direction: `FINAL_REVIEW_REDESIGN_PLAN.md` (the chair cockpit spec) rebuilt on Design System 2.0, plus this plan's altitude rules.

The Application 360 / review surface shows, in order of decision usefulness:

- Applicant identity · desired role/track (`applicationTrack`) · current stage · decision status.
- **Missing materials** — concrete checklist from `lib/readiness-signals.ts` (interview reviews submitted? materials complete? reviewer recommendation? open info request?). **Never a bare percentage**; if a composite indicator appears, its inputs are listed beside it.
- **Interview complete? Review complete?** — explicit binary states with links to the artifacts.
- Review summary (the five structured category ratings) · reviewer recommendation · timeline (`InstructorApplicationTimelineEvent`) · **next action**.
- Decision dock mapping 1:1 to `ChairDecisionAction`: Advance, Request info, Schedule interview, Approve (with conditions), Decline, Hold, Waitlist.

**Surface consolidation:** board (pipeline list + preview drawer) → Application 360 (full page, role-aware: reviewer sees the review editor, chair sees the decision dock). The detail-slideout / review-workspace / chair-queue trio collapses into this. Applicant-facing pages are untouched.

---

## 17. Mentorship/Advising Structure

**Execute `MENTORSHIP_REDESIGN_PLAN.md` V1 as written** (canonical home per role, redirect legacy routes, merge the three matching boards, standardize the rubric) — then layer:

- **Mentorship page:** stat strip (Active, Needs follow-up, Upcoming check-ins, New matches, Ending soon); list + filters; selected record opens **Mentorship 360** (new seventh Entity 360 type): mentor, mentee, program/track, start date, next check-in, goals, last activity, notes, open items, quick actions.
- **Concrete states replace "mentorship health":** Check-in overdue · No recent activity (N days, shown) · Goal missing · Needs leadership follow-up (open ESCALATION request) · On track. Individual labeled chips, never a composite.
- **Advising lives here for advisor roles:** the caseload view (§12) as a tab — advisees overdue-first, last/next check-in, open needs, "Log check-in." Admin ops dashboard gains advisor coverage (students without advisors, overdue check-ins).

---

## 18. Universal 360 Rules

Skeleton (already implemented in `entity-360-body.tsx`), in order: Header/identity → Status/next step → Key facts (≤6 at preview) → Relationships (EntityChips) → Recent activity (3–5 at preview) → Open work → Timeline/notes/files (full-360 only) → Quick actions (≤4 at preview).

Rules:

- **Preview first, full 360 second** — everywhere, including master databases, Work Hub, Help Agent results.
- **Tabs are per-type and meaningful** (§11–§17 fix the sets); a tab ships because a user acts there, not because data exists; empty tabs hide.
- **Signals always render with reasons** (§19).
- **Type roster grows to eight:** add `application` and `mentorship`; student/instructor/applicant/partner-contact remain person-type with role-tailored loaders.
- **Every entity reference everywhere is a chip** that opens the preview drawer (extend `EntityLink`/`RelatedEntityBadge` to remaining raw links).
- **Visual chassis:** all previews/drawers/360 headers move to the Design System 2.0 `DrawerShell`/`PreviewPanel`/`ProfileHeader` primitives during Phase 3 (§22), so polish lands once and everywhere.

---

## 19. Vague Metric Audit and Replacements

Binding policy: **a level may summarize; the reasons must be visible at the same altitude.** No bare scores, no composite indexes without listed inputs. The engines already compute reasons — this is presentation policy.

| Current label (location) | What it actually computes | Replacement presentation |
|---|---|---|
| Class "readiness" (`deriveClassReadiness`) | Missing-setup list | Render the checklist; level chip beside it |
| "Partner health" (`derivePartnerHealth`) | Days since contact, next-step presence, overdue follow-up | Drop the word. Last interaction · Next follow-up · Open requests · Open actions |
| Initiative "health/at-risk" (`strategic-initiative-health.ts`) | Overdue/blocked/unowned/stale counts, slippage, momentum windows | Keep level; always render `explainInitiativeHealth` reasons + next steps |
| "Momentum" | Completions+intake+meetings in 14 days | "Recent activity:" with the counts and window |
| "People Momentum" (People-Strategy CC) | Completions vs overdue/flagged | Work Hub "By person" columns; drop the framing |
| "Weekly Pulse" (`buildWeeklyPulse`) | Completions/intake vs prior week | "This week:" with explicit numbers |
| Instructor application "readiness" (`readiness-signals.ts`) | 4 boolean checks | Render the 4 checks; n/4 caption permitted |
| Chapter "health" (`/admin/chapter-reports`) | President, member count, recent events | Promote the existing `healthReason` to equal weight |
| Profile completeness | Missing fields | List the fields; only when incomplete |
| "Engagement"/disengagement risk | Inactivity tags | "No activity in N days" with the N |
| **Instructor "performance/health/readiness"** (anywhere new) | — | Never as a label. Use: classes (n), next review due/overdue, open actions, no-next-step flag |
| **Student "health/risk/engagement/quality"** (anywhere new) | — | Never as a label. Use: advisor assigned, last/next check-in, attendance n/m, open support needs |
| Mockup "YPP Pulse 92%" | Does not exist in code | **Do not build** |
| Mockup "Engagement Level: High" | Does not exist | Do not build |

---

## 20. Navigation Consolidation Recommendations

1. Adopt the §7 leadership nav in `lib/navigation/catalog.ts` + `core-map.ts`; leadership core pins: Home, Help Agent, People, Work, Partners (+ ≤3 role-relevant).
2. **Redirect, then retire:** `/all-actions/*`, `/actions/command-center`, `/admin/action-center/*` → `/work`; mentorship legacy routes → canonical; `/operations/command-center` → Home; `/operations/data-360` → `/help-agent` + Home at parity.
3. **Admin gets a real home** (6 domain groups), replacing the `/admin` → `/admin/chapters` redirect.
4. **Gamification exits the leadership tier**; student-facing gamification is re-evaluated (not redesigned) in the student pass.
5. One home per role; `/operations` index folds into leadership Home.
6. Extend `validate-nav.mjs` with redirect-map validation.

---

## 21. Page-by-Page Redesign Recommendations

V2 adds explicit instructor/student rows and marks build strategy: **R** = rebuild on Design System 2.0 (new layout), **A** = absorb/redirect, **K** = keep with polish pass.

| Page | Strategy | Action |
|---|---|---|
| `/` leadership home | **R** | Cockpit: greeting, 4–6 actionable tiles, Needs Attention with reasons, today's meetings, recent activity. No pulse %, no donuts. |
| `/help-agent` + palette | **R (first)** | First DS 2.0 surface (§8). |
| `/people` | **R (must-build)** | §9 anatomy; reference master-database implementation. |
| `/partners` | **R (must-build)** | §10 anatomy + relationship models. |
| `/admin/instructors` list | **A** | → `/people?role=instructor`. |
| `/admin/instructors/[id]` | **R** | Becomes the Instructor full-360 (§11): identity, classes, upcoming sessions, reviews/interviews, mentorship, leadership contributions, open actions, next step, activity. Priority: top-3 of record pages. |
| `/admin/students` list | **A** | → `/people?role=student` with advisor flag chips. |
| Admin student detail (today: profile + scattered panels) | **R** | Becomes the Student full-360 (§12) with the Advisor tab and visibility matrix. Priority: top-3 of record pages. |
| `/admin/instructor-applicants` suite | **R** | Board + decision-first Application 360 (§16); chair cockpit per `FINAL_REVIEW_REDESIGN_PLAN.md`. |
| `/admin/instructor-readiness` | **K** | Concrete blocker queue; relabel "Instructor onboarding queue." |
| `/actions/*` | **A→R** | → `/work` (§15), rebuilt tabs on DS 2.0. |
| `/admin/action-center/*` | **A** | Audit data, export, archive, redirect. |
| `/operations/command-center`, `/operations/data-360` | **A** | Fold into Home / Help Agent. |
| Mentorship suite | **A→R** | Execute existing consolidation, then DS 2.0 rebuild of the canonical pages + Mentorship 360. |
| `/admin/classes` + `[id]` | **R** | `/programs` hub + Class 360 (§14); wire Entity Action Operating Panel. |
| `/people/[id]` | **R** | Person full-360 with role tabs (§11). |
| **Instructor home/dashboard** | **R (Phase 3)** | Action-oriented: assigned classes, upcoming sessions, open tasks, next review, mentorship duties, leadership contributions, next action. Calm; no vanity metrics. |
| **Instructor profile** | **R (Phase 3)** | Instructor's own view of their 360 (visibility-filtered). |
| **Instructor My Classes** | **R (Phase 3)** | Per-class: roster, next session, attendance entry, open tasks, materials. |
| **Student home/dashboard** | **R (Phase 3)** | Supportive: my classes, next session, **my advisor + next check-in**, my next action, recent activity. Not a leadership dashboard. |
| **Student profile** | **R (Phase 3)** | Student's own 360 view: classes, progress, advisor, mentor. |
| **Student class pages** | **R (Phase 3)** | Schedule, materials, progress, who to ask for help. |
| Reports | **K→R** | `/reports` index first; vague-metric panels dropped per §19. |
| Gamification/legacy (`/world`, badges, challenges…) | **defer** | **No early migration effort.** Leave on legacy CSS until the final containment phase; retire or re-skin wholesale then. |

---

## 22. Design System 2.0 — Tailwind-First

> **This section reverses V1.** V1 said: stay on plain CSS + tokens; a Tailwind migration across 492 pages is high-risk/low-value. That was too timid, and it misread the problem. The risk is not in adopting Tailwind for new surfaces — it is in continuing to build a premium product on a 17,400-line append-only global stylesheet. **The current CSS layer is a bottleneck. The portal gets a new Tailwind-based design-system foundation for all new and redesigned Knowledge OS surfaces, and a phased, measured retirement of the old global CSS.**
>
> The full engineering deep-dive (configuration, token mapping, primitive specs, lint rules, migration mechanics, rollback) lives in **`docs/ypp-tailwind-design-system-v2-plan.md`**. This section is the product-level contract.

### 22.1 The decision

- **Tailwind CSS v4 is the styling foundation for every new and redesigned surface.** No serious technical blocker exists: Next 16 + Turbopack supports Tailwind v4 first-class; there is no competing PostCSS pipeline; `globals.css` has a single import point; `clsx` is already installed. Installation and configuration happen in the **first implementation pass**.
- **Hybrid period is explicit and bounded.** Old pages keep old CSS temporarily. New/redesigned pages use Tailwind + `ui-v2` exclusively. No page mixes both systems beyond the shared app shell.
- **`globals.css` is frozen on day one.** A CI guard fails any PR that grows it. From then on it only shrinks, with deletion milestones per migration phase (§22.6).
- **Preflight strategy:** during the hybrid period Tailwind is imported *without* its global reset (theme + utilities only), so legacy pages are pixel-untouched; the reset is enabled at the end of migration when legacy CSS is removed. This makes adoption **additive and rollback trivial** (§29).

### 22.2 Component architecture

- New folder: **`components/ui-v2/`** — the clean design system, never importing from legacy domain components or relying on `globals.css` classes. Variants via `class-variance-authority` + `tailwind-merge`; motion via the existing `framer-motion`; icons via the existing `lucide-react`.
- Domain components that get rebuilt move to their domains but compose `ui-v2` primitives exclusively.
- The V1 "eight primitives in `components/shared/`" plan is superseded — **do not build primitives on the legacy CSS**; build them once, in `ui-v2`, in Tailwind.

**The primitive set (the foundation for the whole portal):**

Shell & navigation: `AppShell` · `Sidebar` (dark premium) · `CommandPalette` / `HelpAgentShell`
Page anatomy: `PageHeader` · `SectionHeader` · `FilterBar` · `SearchInput` · `Tabs` · `ActionButtonGroup`
Content: `Card` · `StatCard` (click-to-filter) · `DataTableShell` · `EmptyState` (+ loading/error states) · `StatusBadge` · `EntityChip`
Depth: `PreviewPanel` · `DrawerShell` · `ProfileHeader` · `RelationshipSection` · `TimelineSection` · `QuickActionBar`
Forms: `Input` / `Select` / `Textarea` / `Field` patterns

### 22.3 Token strategy

The existing `--ypp-*` brand values are correct and migrate into Tailwind v4 `@theme` tokens (CSS-first config) — one source of truth for color (brand purple scale + one semantic status set), spacing (4px scale), radius (cards 12px, controls 8px, chips full), shadow (one level per surface type), and a typographic scale (28/20/16/14/12·5 with weights). Legacy `globals.css` variables alias to the same values during the hybrid period so the two systems can't drift apart visually.

### 22.4 Visual rules

- **Dark premium sidebar:** the deep-purple gradient identity stays; standardized paddings, active states, group headers, Recently Viewed section, user footer. One Sidebar component for all roles (content varies by nav resolution, chrome does not).
- **Light calm workspace:** white/off-white canvas, 32px gutters, 24px section gaps, restrained borders, one shadow level per surface, no decoration without information.
- **Layout patterns:** master-database (header + stat strip + filter bar + table + preview rail), record/360 (ProfileHeader + tabs + sections), cockpit (greeting + actionable tiles + queues), focused-task (single column, decision dock). Pages pick a pattern; they do not invent one.
- **Accessibility:** WCAG AA contrast, full keyboard support (palette, drawers, tables), visible focus rings, reduced-motion respect — the `FINAL_REVIEW_REDESIGN_PLAN.md` accessibility bar applies portal-wide.
- **Responsive:** sidebar collapses (existing behavior), preview rails become overlay drawers below desktop widths, tables get priority-column behavior.

### 22.5 Guardrails

- CI guard: `globals.css` may not grow (line-count check in `check:release`).
- ESLint: no inline `style={{…}}` with hardcoded colors/spacing in redesigned routes; no `globals.css` class names (`.card`, `.topbar`, `.button`, `.stat-card`) inside `ui-v2`-based pages; Tailwind class sorting via the official Prettier plugin.
- Visual regression: Playwright screenshot baselines on ~15 key legacy pages, run during the hybrid period to prove legacy pixels don't move; screenshot specs for each new `ui-v2` surface as it ships.
- A living `docs/design-standards.md` with do/don't examples per primitive.

### 22.6 Migration phases and legacy containment

Tracked in lines-of-`globals.css`-deleted, not vibes:

1. **Foundation** (Phase 1): Tailwind v4 installed (no preflight); tokens in `@theme`; `ui-v2` primitives; AppShell + Sidebar rebuilt; Help Agent shipped on the new system. `globals.css` frozen.
2. **Front doors** (Phase 2): `/people`, `/partners`, admin instructor/student record pages, application review — each new page deletes or strands its legacy page's CSS; first deletion milestone (sidebar/nav/app-shell blocks removed).
3. **Work & programs** (Phase 3): Work Hub, Programs/classes, 360 chassis (DrawerShell/PreviewPanel), instructor- and student-facing pages. Second deletion milestone (cards/tables/badges/stat blocks).
4. **Sweep** (Phases 4–5): reports/admin cleanup; remaining leadership pages; enable preflight; delete the legacy layer down to a small `legacy.css` for the deferred gamification/legacy pages, which are explicitly **not worth early migration effort**.

---

## 23. Data Relationship Gaps

All additive migrations. **V2 decision: the partner relationship models and the advisor scheduling fields ship in the first major implementation pass** — they are nullable-additive, touch no existing rows, and unblock the must-build front doors.

### Partner relationship operations (first pass)

```prisma
model PartnerContact {
  id        String   @id @default(cuid())
  partnerId String
  partner   Partner  @relation(fields: [partnerId], references: [id])
  name      String
  title     String?
  email     String?
  phone     String?
  role      String?          // decision maker, day-to-day, billing…
  isPrimary Boolean  @default(false)
  userId    String?          // optional portal account link
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PartnerRequest {
  id          String               @id @default(cuid())
  partnerId   String
  partner     Partner              @relation(fields: [partnerId], references: [id])
  title       String               // "3 instructors for summer camp"
  details     String?
  status      PartnerRequestStatus // OPEN | IN_NEGOTIATION | AGREED | DECLINED | FULFILLED | EXPIRED
  ownerId     String?
  dueAt       DateTime?
  resolvedAt  DateTime?
  createdById String
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
}

model PartnerAgreement {
  id            String                 @id @default(cuid())
  partnerId     String
  partner       Partner                @relation(fields: [partnerId], references: [id])
  kind          PartnerAgreementKind   // MOU | CONTRACT | INFORMAL
  status        PartnerAgreementStatus // DRAFT | SENT | SIGNED | EXPIRED | TERMINATED
  title         String
  effectiveAt   DateTime?
  expiresAt     DateTime?
  renewalNoteAt DateTime?
  terms         String?
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt
  conditions    PartnerAgreementCondition[]
}

model PartnerAgreementCondition {
  id          String                 @id @default(cuid())
  agreementId String
  agreement   PartnerAgreement       @relation(fields: [agreementId], references: [id])
  description String                 // "background checks for all instructors"
  status      PartnerConditionStatus // PENDING | SATISFIED | WAIVED | FAILED
  dueAt       DateTime?
  satisfiedAt DateTime?
}
```

Plus: migrate `Partner.contactName/Email/Phone/Title` into a primary `PartnerContact` (legacy columns kept during transition; unparseable rows logged); add `PARTNER_REQUEST` to attention categories. **Deliberately not building:** a `PartnerMeeting` model (reuse `OfficerMeeting` + `relatedEntityType='PARTNER'`) and any partner health score.

### Advising (first pass + Phase 3)

- First pass: `StudentAdvisorAssignment.checkInCadenceDays Int @default(14)` and `nextCheckInDueAt DateTime?` (set on assignment and on each check-in).
- Phase 3: `SupportNeed` per §12.

### Search & saved queries (first pass, with the Help Agent)

- `SearchDocument` (tsvector + `pg_trgm` indexes via raw migration SQL), `SavedQuery` (personal/shared/seeded), `RecentEntityView` (pruned ~50/user).

### Work graph polish (Phase 3–4)

- Backfill legacy `officerMeetingId`-only actions to explicit `sourceType=MEETING`.
- Initiatives stay config-registry (open question on DB-backing stands, §29).
- No new polymorphic-FK framework; document and validate the existing string-pair pattern in server actions.

---

## 24. Search/Indexing Gaps

Current state: no global search; `rankQuickFind` is page-local; the nav ⌘K filters sidebar items only; no index tables; no `/api/search`; no recents; per-domain saved views only.

Closure (§8): `SearchDocument` with FTS + trigram; `/api/search` with tier filtering; `HelpAgentShell` in the app shell with real ⌘K; grouped results + Entity 360 previews; `RecentEntityView` + localStorage recents; seeded `SavedQuery` executive views (including advisor and instructor-leadership queries); write-path upserts + nightly reconcile.

Permissions: index rows carry coarse visibility tiers; the API filters by viewer tier/chapter; hydration through entity-360 loaders guarantees results never exceed 360 visibility.

---

## 25. Implementation Roadmap

The migration priority order is now explicit and binding:

1. Tailwind / Design System 2.0 foundation
2. App shell + sidebar
3. YPP Help Agent
4. Master People database
5. Master Partner database (+ partner relationship migrations)
6. Admin instructor list/detail
7. Admin student list/detail (+ advisor scheduling migration)
8. Application review
9. Work Hub
10. Programs/classes
11. Instructor-facing dashboard/profile/classes
12. Student-facing dashboard/profile/classes/advisor
13. Entity 360 visual polish across all types
14. Reports/admin cleanup
15. Lower-priority legacy/gamification pages — **explicitly last; no early effort**

Grouped into phases (each ships independently; redirects preserve URLs; `validate-nav.mjs` + smoke + visual-regression gates):

| Phase | Theme | Migration items |
|---|---|---|
| **1** | Foundation | Items 1–3 + first-pass migrations (partner models, advisor fields, search tables) + quick wins |
| **2** | Master databases & admin records | Items 4–8 |
| **3** | Work, programs, member-facing | Items 9–12 + 360 chassis polish (13) |
| **4** | Consolidation & cleanup | Item 14; legacy route retirements; second CSS deletion milestone; saved-query sharing |
| **5** | Sweep & validation | Item 15 decision (retire vs re-skin); preflight enablement; legacy CSS deletion; §30 validation |

Sequencing rationale: the design system lands first so every subsequent surface is built once, on the right foundation; the Help Agent proves the system before the big pages consume it; admin/operator record pages precede member-facing dashboards because leadership manages the organization through them.

---

## 26. Phase 1 Plan — Foundation

**Goal:** the new foundation exists, is proven on a real surface, and the data layer for the front doors is in place.

1. **Tailwind v4 + Design System 2.0 core** (full spec in `docs/ypp-tailwind-design-system-v2-plan.md`):
   - Install/configure Tailwind v4 (no preflight during hybrid); map `--ypp-*` tokens into `@theme`; freeze `globals.css` with the CI guard; add lint rules + Prettier class sorting; Playwright screenshot baselines on key legacy pages.
   - Build the first primitive tranche in `components/ui-v2/`: AppShell, Sidebar, PageHeader, Card, StatCard, StatusBadge, EntityChip, SearchInput, Tabs, EmptyState, DrawerShell, PreviewPanel, CommandPalette/HelpAgentShell.
   - Rebuild the **app shell + dark premium sidebar** on the new system (all roles inherit immediately — first visible polish win).
2. **YPP Help Agent V1** on the new system: `SearchDocument` migration + backfill + write-path upserts + nightly reconcile; `/api/search`; global ⌘K; grouped results; Entity 360 preview; `openEntity` launching; `/help-agent` page; `RecentEntityView` + sidebar Recently Viewed.
3. **First-pass data migrations** (all additive): `PartnerContact`, `PartnerRequest`, `PartnerAgreement`, `PartnerAgreementCondition`; `checkInCadenceDays` + `nextCheckInDueAt`; `SavedQuery`; contact backfill script.
4. **Quick wins** (no redesign): People Dashboard names → `PersonLink`s; `listActionAssignableUsers` excludes applicants; reasons-not-scores presentation pass on existing level-chip surfaces; `/admin` home page replacing the chapters redirect.
5. **Attention categories added:** student without advisor, advisor check-in overdue, open partner request.

Exit criteria: ⌘K works portal-wide with previews and 360 launching; the sidebar/app shell visibly matches the mockup bar; legacy pages pixel-identical (visual regression green); migrations deployed; `globals.css` line count locked.

---

## 27. Phase 2 Plan — Master Databases and Admin Records

**Goal:** the front doors and the operator record pages exist, polished, on the new system.

1. **`/people` (must-build):** §9 anatomy on DS 2.0 — six-column table, filters, flag chips (advisor + instructor-leadership flags), right-side preview, Add Person; redirects from absorbed admin lists.
2. **`/partners` (must-build):** §10 anatomy — un-flagged, promoted, eight columns, preview, quick actions wired to existing server actions + meeting drawer deep-link; Requests & Agreements UI on the Phase-1 models.
3. **Admin instructor detail → Instructor full-360** (§11): one page answering classes, sessions, reviews, interviews, mentorship, leadership contributions, open actions, next step, activity.
4. **Admin student detail → Student full-360** (§12): Advisor tab, advisor visibility matrix rows for admin surfaces, attendance patterns, parent/guardian chips.
5. **Application review, decision-first** (§16): board + role-aware Application 360; chair cockpit per `FINAL_REVIEW_REDESIGN_PLAN.md`, rebuilt on DS 2.0.
6. **Leadership Home cockpit** rebuilt on DS 2.0 (folds `/operations/command-center`).
7. First CSS deletion milestone: app-shell/sidebar/nav legacy blocks removed from `globals.css`.

Exit criteria: a leader can find any person or partner, see advisor/instructor flags at directory level, open previews and full 360s, and decide an application — entirely on new-system surfaces; absorbed routes redirect; visual regression green on untouched legacy pages.

---

## 28. Phase 3 Plan — Work, Programs, and Member-Facing Surfaces

**Goal:** daily work and the member experience move onto the new system.

1. **Work Hub `/work`** (§15) with Action System 4.0 UI wiring completed (Entity Action Operating Panel, Meeting Follow-Up Pack, inline completion/blocker capture, Weekly Review sections).
2. **Programs hub + Class 360** (§14) with the readiness checklist rendering.
3. **Entity 360 chassis polish** (§18): all previews/drawers/profile headers on DrawerShell/PreviewPanel/ProfileHeader; `application` and `mentorship` 360 types added; person loader branches by role.
4. **Mentorship consolidation** (existing plan) + Mentorship 360 + **advisor caseload view**; `SupportNeed` migration.
5. **Instructor-facing rebuild:** home/dashboard (assigned classes, upcoming sessions, open tasks, next review, mentorship duties, contributions, next action), profile, My Classes.
6. **Student-facing rebuild:** home/dashboard (my classes, next session, **my advisor + next check-in**, next action), profile, class pages. Supportive tone; no leadership density.
7. Second CSS deletion milestone (cards/tables/badges/stat blocks).

Exit criteria: tab sets match §11–§17; zero bare scores anywhere; advisor visibility matrix fully satisfied (§12 table); instructors and students land on rebuilt homes; Work Hub is the only work surface.

(Phases 4–5 scope is fixed in §25; detailed plans are written at the end of Phase 3.)

---

## 29. Risks, Tradeoffs, Open Questions

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Tailwind preflight breaks legacy pages** | Hybrid imports exclude preflight until legacy CSS is retired; visual regression baselines on key legacy pages run in CI during the entire hybrid period |
| **Two styling systems live forever** | `globals.css` frozen day one (CI line-count guard); deletion milestones per phase tracked in the release checklist; migration priority bans effort on low-value pages so the long tail is small and explicitly parked |
| **Class-soup / inconsistent Tailwind usage** | All styling flows through `ui-v2` primitives with cva variants; lint forbids legacy class names and inline styles in new routes; Prettier class sorting; `docs/design-standards.md` |
| **Rebuilds regress behavior** (e.g., admin instructor detail is operationally rich) | Rebuilds reuse existing loaders/server actions unchanged; Playwright smoke per rebuilt page; old page kept behind a fallback route flag for one release |
| **Rollback** | Adoption is additive: no preflight, no legacy CSS edits in early phases → reverting a surface is a route-level revert; the Tailwind layer itself can be unplugged by removing one import without touching legacy pages |
| **Scale of churn across 9 roles** | Phased by route group; redirects for every move; member-facing rebuilds last, behind per-role flags consistent with existing rollout discipline (`FeatureGateRule`/`RolloutCampaign` exist) |
| **Index drift** (SearchDocument) | Write-path upserts + nightly reconcile + admin reindex action; authorization stays in loaders |
| **Partner contact backfill loses nuance** | Legacy columns retained during transition; unparseable rows logged for manual review |
| **Bundle/perf regressions** | Tailwind v4 emits only used utilities; per-page JS budgets per `FINAL_REVIEW_REDESIGN_PLAN.md` precedent; Turbopack build times monitored in CI |

### Tradeoffs accepted

- **Hybrid period (one to three phases)** of two coexisting styling systems — accepted as the price of never doing a big-bang rewrite; bounded by the freeze + deletion milestones.
- **Some page layouts are rebuilt, not edited.** Costlier per page, but the only way to mockup-level polish; mitigated by reusing loaders/actions wholesale.
- **Person roles stay on one User model**; role-tailored loaders over the existing satellites.
- **No new polymorphic-link framework**; the string-pair pattern is kept and documented.
- ~~Plain CSS stays~~ — **superseded.** V1's primitives-on-legacy-CSS approach is dead; primitives are built once, in `ui-v2`, in Tailwind.

### Open questions

1. **`/operations/projects` third tier** — collapse into workstreams/milestones unless actively used. (Unchanged.)
2. **Parents in `/people` by default?** Recommendation: include, filtered out by default. (Unchanged.)
3. **Saved-query sharing** — seeded + personal in Phase 1–2; shared in Phase 4. (Unchanged.)
4. **`/operations/data-360` retirement timing** — keep one phase past Help Agent parity, instrument, decide. (Unchanged.)
5. **Student-facing gamification** — out of leadership view regardless; retire vs re-skin decided in Phase 5 with usage data.
6. **Mentorship student lane vs advising** — needs program-owner input before Phase 3 item 4.
7. **Tailwind v4 vs v3** — v4 recommended (Next 16/Turbopack first-class, CSS-first tokens); if an unexpected v4 blocker appears in the foundation spike, v3.4 is the fallback with identical architecture (this is the only contingency, not a reason to delay).

---

## 30. Validation Checklist

**Navigation & access**

- [ ] Leadership nav ≤10 items; every §2 executive question maps to exactly one.
- [ ] ⌘K opens the Help Agent everywhere; find → preview → 360 in ≤3 interactions.
- [ ] Every moved route redirects; `validate-nav.mjs` green including redirect map.
- [ ] No "Siri" anywhere in product copy or mockups.

**Master databases (must-builds)**

- [ ] `/people`: any person findable by name/email/role/program in one search; row → preview → full 360; advisor and instructor flag chips render from real attention data.
- [ ] `/partners`: owner, last interaction, next step visible on the row; a partner without a next step self-reports in Needs Attention.
- [ ] Partner 360 answers all relationship-ops questions (contacts, requests, negotiations, conditions, agreements, meetings, affiliated people) without leaving the profile.

**Advisor centrality**

- [ ] Every surface in the §12 visibility matrix shows advisor state; a student without an advisor and an overdue check-in each surface in ≥4 places (People, 360, Home, Help Agent) with zero configuration.
- [ ] Advisor caseload view live; "Log check-in" updates `nextCheckInDueAt`.

**Instructor centrality**

- [ ] Instructor 360 shows classes, sessions, reviews, interviews, mentorship, contributions, open actions, next step on one page; People rows carry instructor flags.

**360s & metrics**

- [ ] Tab sets match §11–§17; empty tabs hide; previews open before full 360s everywhere.
- [ ] Zero bare scores; "Health/Pulse/Engagement/Performance/Risk" appear nowhere as standalone labels — including on instructor and student records.
- [ ] Class pages show the readiness checklist; application review shows the 4-input checklist and the seven real decision actions.

**Design System 2.0**

- [ ] Tailwind v4 configured; `ui-v2` primitives power every redesigned surface; no legacy class names or inline style overrides in new routes (lint-enforced).
- [ ] `globals.css` line count: frozen at baseline, then strictly decreasing per phase milestone; preflight enabled only after legacy retirement.
- [ ] Visual regression green on legacy baselines throughout the hybrid period; screenshot specs exist for each new surface.
- [ ] Keyboard + WCAG AA verified on palette, drawers, tables; reduced-motion respected.
- [ ] Side-by-side with the mockups, Home, Help Agent, People, Partners, and the admin instructor/student records read at the same level of calm and hierarchy — with less, not more, on each screen.

**Workflows (timed, with real users)**

- [ ] "What needs my attention today?" — Home, <10s, every item with a why and a next step.
- [ ] "Who owns Camp Hudson and what's next?" — Help Agent, <15s.
- [ ] "Which students have no advisor?" — one suggested query, one click.
- [ ] "What does this instructor carry?" — Instructor 360, one page, no hunting.
- [ ] An instructor and a student each open their rebuilt home and can state their next action in <10 seconds.
