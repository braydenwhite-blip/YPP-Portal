# YPP Organizational Knowledge OS — Master Plan

**Status:** Planning baseline (Phase 1 deliverable)
**Date:** June 2026
**Scope:** Full portal structure and product architecture — navigation, master databases, entity 360s, Work Hub, YPP Help Agent, visual system, and implementation roadmap.
**Grounding:** Every recommendation in this document is based on a direct audit of the current codebase (492 pages, 459 Prisma models, ~145 nav catalog entries, the `lib/operations/` derivation engine, and the existing Entity 360 system). File paths are cited throughout.

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
9. [Master People Database Plan](#9-master-people-database-plan)
10. [Master Partner Database Plan](#10-master-partner-database-plan)
11. [Person 360 Tailoring](#11-person-360-tailoring)
12. [Student/Advisor Model](#12-studentadvisor-model)
13. [Partner 360 Tailoring](#13-partner-360-tailoring)
14. [Program/Class Structure](#14-programclass-structure)
15. [Work Hub Structure](#15-work-hub-structure)
16. [Application Review Structure](#16-application-review-structure)
17. [Mentorship/Advising Structure](#17-mentorshipadvising-structure)
18. [Universal 360 Rules](#18-universal-360-rules)
19. [Vague Metric Audit and Replacements](#19-vague-metric-audit-and-replacements)
20. [Navigation Consolidation Recommendations](#20-navigation-consolidation-recommendations)
21. [Page-by-Page Redesign Recommendations](#21-page-by-page-redesign-recommendations)
22. [Visual Polish / Design System Recommendations](#22-visual-polish--design-system-recommendations)
23. [Data Relationship Gaps](#23-data-relationship-gaps)
24. [Search/Indexing Gaps](#24-searchindexing-gaps)
25. [Implementation Roadmap](#25-implementation-roadmap)
26. [Phase 1 Plan](#26-phase-1-plan)
27. [Phase 2 Plan](#27-phase-2-plan)
28. [Phase 3 Plan](#28-phase-3-plan)
29. [Risks, Tradeoffs, Open Questions](#29-risks-tradeoffs-open-questions)
30. [Validation Checklist](#30-validation-checklist)

---

## 1. Executive Summary

The YPP Portal already contains most of the **engine** of an Organizational Knowledge OS. It is missing the **access layer** and the **polish layer**.

What exists and is strong (keep and build on):

- A **universal Entity 360 system** (`lib/operations/entity-360.ts`, `components/operations/entity-360-drawer.tsx`, `/api/entity-360/[type]/[id]`) covering six entity types — person, class, partner, initiative, meeting, action — with permission-aware loaders, stacking drawer panels, and a single body renderer.
- A **connected work graph**: `ActionItem` and `OfficerMeeting` carry polymorphic entity links (`relatedEntityType`/`relatedEntityId`), source provenance (`sourceType`/`sourceId`), meeting agenda items/decisions/follow-ups that convert two-way into actions, and a strategic initiative layer with a pure derivation health engine (`lib/people-strategy/strategic-initiative-health.ts`).
- **Honest, explainable signals**: class readiness, partner follow-up state, attention queues, and initiative health are all pure functions of real counts with reasons attached (`lib/operations/signals.ts`, `lib/operations/attention.ts`). There is no fake analytics layer to remove — only presentation to fix.
- A **first-class Student Advisor system** (`StudentAdvisorAssignment`, `AdvisingNote`, `AdvisingRecommendation` in `prisma/schema.prisma` ~line 13692; `lib/leadership/`).
- A **comprehensive applicant pipeline** (15+ pages, structured reviews, interview question bank, chair decisions, concrete readiness signals in `lib/readiness-signals.ts`).

What is missing or broken (the work of this plan):

1. **No global access layer.** There is no portal-wide search, no functional ⌘K (the hint in `components/nav.tsx` is visual only), no entity index, no master People database, and the Partner database is buried behind a feature flag at `/admin/partners`.
2. **Severe IA fragmentation.** 492 pages; three parallel action trees; five mentorship surfaces; three command centers; 72 admin pages with no internal IA; multiple competing dashboards per role; legacy routes still reachable.
3. **Data gaps for relationship operations.** Partners lack structured contacts, requests, agreements/conditions; advising lacks check-in scheduling; there is no search index table.
4. **No shared UI primitives.** No PageHeader, Tabs, Drawer, Table shell, or EmptyState components; a 17,000-line `globals.css` with good tokens applied inconsistently. The mockups' polish cannot be reached page-by-page without primitives.

The plan, in one sentence: **expose the existing engine through four front doors — Home, YPP Help Agent, Master People Database, Master Partner Database — consolidate work surfaces into one Work Hub, tailor the existing Entity 360 per entity type, and standardize the UI on a small set of shared primitives, while presenting every derived signal as concrete reasons instead of scores.**

The renamed **YPP Help Agent** (formerly "Siri for YPP" in mockups only — the codebase contains zero "Siri" references, so the rename costs nothing in code) launches as a deterministic, indexed, permission-aware command palette that reuses the existing Entity 360 drawer and Quick Find ranking. No model calls per keystroke.

---

## 2. Product Vision

The portal becomes the place where YPP leadership can answer, in seconds, without asking anyone:

- What is happening across YPP this week?
- What needs attention, and why exactly?
- Who owns what?
- What changed recently, and what did each meeting produce?
- Which applicants are waiting on a decision, which instructors need reviews, which students need advisor follow-up?
- Which partners are active, which have open requests or unmet conditions, and who owns each relationship?
- Which classes are running, blocked, or missing setup?
- How is every person, partner, class, meeting, initiative, mentorship, application, and action connected?

### The four-altitude model

Every entity in the portal is reachable at exactly four altitudes, and information is assigned to one altitude only:

| Altitude | Surface | What it shows |
|---|---|---|
| **Page** | Master database / hub page | Search, filters, the identifying columns, primary actions. Answers "who/what is this, what state is it in, what's next." |
| **Preview** | Right-side panel / 360 drawer (existing `Entity360Drawer`) | Identity, status, next step, key relationships, recent activity, quick actions. |
| **Full 360** | Full-page profile | Complete history, all relationships, documents, timeline, notes, deep workflows. |
| **Help Agent** | Global ⌘K / Help Agent page | The fastest way to reach any of the above from anywhere. |

**Progressive disclosure is the law.** If a field does not help the user understand, decide, or act at the current altitude, it moves down one altitude or is removed.

### Scope boundary: the Knowledge OS is the leadership workspace

The portal serves students, instructors, parents, applicants, and leadership. The current minimal sidebars for students/instructors/applicants (`lib/navigation/student-v1-nav-layout.ts`, `instructor-v1-nav-layout.ts`, `applicant-allowlist.ts`) are working as designed and are **out of scope** for this restructuring except where they consume shared primitives. The Organizational Knowledge OS is the **officer/leadership tier experience** (ADMIN, HIRING_CHAIR, CHAPTER_PRESIDENT, leadership subtypes). This boundary keeps the redesign tractable and avoids destabilizing the student/parent experience.

---

## 3. Mockup Synthesis

Nine mockups were provided: Executive Home/Cockpit, YPP Help Agent (global search), Universal 360, Instructor Application Review, Mentorship, Class Page, Work Hub, Master People Database, Master Partner Database.

### What to adopt from the mockups

- **The overall layout grammar**: dark premium sidebar, clean white workspace, rounded cards, generous spacing, calm hierarchy. The current portal already has a fixed sidebar shell (`components/app-shell.tsx`) — it needs token-level polish, not reinvention.
- **The list + right-preview pattern** on People, Partners, and Work Hub: master table on the left, selected-record preview panel on the right, one-click "Open 360." This maps directly onto the existing `Entity360Drawer` and should be the standard pattern for every master database.
- **Stat strips as entry filters, not decoration**: "Needs Attention 8," "Overdue Actions 5" tiles that filter the list below when clicked. The Operations Command Center already does this (`/operations/command-center` stat cards carry href filters) — generalize it.
- **Recently Viewed in the sidebar** and **Connected To chips** in previews: both are buildable from existing data (Entity 360 payload already includes `people`, `classes`, `meetings` refs).
- **One global search affordance in the header** with ⌘K, present on every page.
- **Quick actions in previews** (Schedule Meeting, Log Interaction, Add Note, Create Action): these map to existing server actions (`createActionItem`, `createPartner` note actions, meeting drawer deep-links `?new=1&relatedType&relatedId`).

### What to reject or fix from the mockups

| Mockup element | Problem | Replacement |
|---|---|---|
| "The YPP Pulse 92% Overall Health Score" (Executive Home) | Vague composite number; not explainable; invites gaming | Today's Brief sentences (already exist: `buildTodaysBrief` in `lib/operations/signals.ts`) + Needs Attention queue with reasons |
| "Engagement Level: High" (Partner 360) | Undefined metric | Last interaction date, open requests count, next meeting date |
| Department/Program "Health: On Track / At Risk" chips without reasons | Score without explanation | Keep the derived level but always render the reasons list beneath it (engine already returns reasons) |
| Six+ tabs on the person 360 (Overview, Classes, Reviews, Meetings, Activity, Relationships) | Tab overload; several tabs would be near-empty for most people | Role-tailored sections, max 4–5 tabs, sections collapse when empty (see §11, §18) |
| Applicant Pipeline funnel bars + Initiatives donut on Executive Home | Pretty, but doesn't drive an action | Replace with counts that link to filtered queues; charts belong in Reports |
| 8 KPI tiles + 5 modules + 2 panels all on one Executive Home | Overload | Maximum: greeting, 4–6 stat tiles, Needs Attention, Today's schedule, Recent Activity. Everything else is one click away |
| "Siri for YPP" naming | Gimmicky; implies expensive AI chat | **YPP Help Agent** — search-first, command-first, deterministic |

The mockups define the **quality bar** (spacing, typography, calm), not the **information inventory**. Section 21 applies this screen by screen.

---

## 4. Sam/Brayden Feedback Synthesis

Synthesized from the product feedback driving this plan, cross-checked against the operator runbooks in `docs/brayden/` (instructor-applicant workflow, chapter OS, dashboard 45-day expansion), which confirm the same theme: the portal is the system of record but operators drown in surfaces.

The feedback distills to five binding rules, applied throughout this plan:

1. **The relevance test.** Every field, metric, card, tab, and panel must help the user understand, decide, act, clarify a relationship, or reduce clicks. Otherwise: remove, collapse, or demote to a deeper 360 section. (Applied in §21 page-by-page.)
2. **No vague labels.** "Health," "Pulse," "Engagement," "Readiness," "Fit," "Risk," "Activity" are banned as bare UI labels unless the concrete inputs are rendered alongside. The codebase is actually well-positioned here: nearly every derived signal already carries machine-readable reasons (`deriveClassReadiness` returns a missing-setup list; `derivePartnerHealth` returns reasons; `explainInitiativeHealth` returns headline + reasons + next steps). The fix is **presentation policy**, not engine rework. (Full audit in §19.)
3. **Master databases are central, not buried.** People and Partners become top-level destinations, not admin tables behind flags. (§9, §10.)
4. **Tailored 360s.** One structural skeleton, per-entity-type content. The current `entity-360-body.tsx` renders all six types through one component with per-loader emphasis — correct architecture, now make the tailoring deliberate per §11–§13.
5. **Progressive disclosure.** Page → preview → full 360 → deep workflow. Nothing appears at an altitude above where a user acts on it.

---

## 5. Current Codebase Audit

### 5.1 Scale and stack

- **Framework:** Next.js 14 App Router, React 18, TypeScript, Prisma 5.22 + PostgreSQL, NextAuth (JWT), server components + server actions (no GraphQL, no client state library).
- **Styling:** Plain CSS — no Tailwind. `app/globals.css` is ~17,400 lines with a defined token system (purple brand scale, 4px spacing base, 4 radius steps, shadow palette) that is inconsistently applied. Inter font, lucide-react icons, framer-motion.
- **Scale:** 492 `page.tsx` files; 459 Prisma models; ~145 nav catalog entries across 9 roles; ~404 component files organized by domain, not by primitive.
- **AI:** `@anthropic-ai/sdk` used in exactly one place — mentor review draft generation (`lib/ai/generate-review-draft.ts`, Haiku with prompt caching). No AI search/assistant exists.
- **Guardrails:** `scripts/validate-nav.mjs` (nav href/route/label/core-size validation, runs in `check:release`), ~60 Vitest/Playwright tests.

### 5.2 Routes and navigation

- Nav is centralized in `lib/navigation/catalog.ts` (1,333 lines) with role resolution in `resolve-nav.ts`, per-role core pins (max 8) in `core-map.ts`, and minimal-sidebar layouts for student/instructor/chapter-president.
- The nav search (⌘K focus) **filters the sidebar only**; the `⌘K` chip in `components/nav.tsx` is a visual hint with no global palette behind it.
- **Three+ parallel action trees:** `/actions/*` (15 pages, canonical), `/all-actions/*` (legacy alias), `/admin/actions/*` (admin CRUD), `/admin/action-center/*` (legacy system on separate Prisma models, orphaned from nav but reachable).
- **Three command centers:** `/actions/command-center` (People Strategy pulse/momentum), `/operations/command-center` (cross-domain digest — the real cockpit), `/admin/action-center` (legacy).
- **Five+ mentorship surfaces:** `/mentorship` (canonical mentor), `/my-mentor` (canonical mentee), `/mentorship-program/*` (legacy), `/admin/mentorship` (modern admin), `/admin/mentorship-program`, `/admin/mentor-match`, `/admin/instructor-mentor-matching` (three overlapping matching boards). `MENTORSHIP_REDESIGN_PLAN.md` prescribes consolidation; V1 not executed.
- **Admin sprawl:** 72 admin pages; `/admin` redirects to `/admin/chapters`; no admin home or domain IA.
- **No leadership home:** ADMIN/HIRING_CHAIR/CHAPTER_PRESIDENT land on a "Reviewer Home" card list (`app/(app)/page.tsx`); the executive picture lives one click away in `/operations/*`.
- **Gamification surfaces** (`/badges`, `/challenges/*`, `/rewards`, `/leaderboards`, `/world`, `/wall-of-fame`) remain routed and partially nav-visible.

### 5.3 Data model

Strong core for the work graph:

- `ActionItem` (schema ~12579): status/priority/lead/department, polymorphic `relatedEntityType`+`relatedEntityId` (CLASS_OFFERING | MENTORSHIP | USER | INSTRUCTOR_APPLICATION | PARTNER), source provenance (`sourceType`/`sourceId`/`sourceActionId`), strategic links, structured completion (`completionOutcome`, `blockedReason`, `nextFollowUpAt`).
- `OfficerMeeting` (~13002) + `MeetingAttendee`/`MeetingAgendaItem`/`MeetingDecision`/`MeetingFollowUp`, with two-way action conversion (`convertedActionId`, `linkedActionId`) and the same polymorphic entity link.
- `Mentorship` (~2754) with sessions, requests, action items, goal reviews; Mentorship 2.0 matching (`MentorshipApplication`, `MentorshipMatchRecommendation`).
- `StudentAdvisorAssignment` (~13692) + `AdvisingNote` + `AdvisingRecommendation` + `LeadershipContribution(STUDENT_ADVISOR)`.
- `InstructorApplication` (~1819) + 15 supporting models (reviews with category ratings, interview question bank/responses, chair decisions with conditions JSON, `ReviewSignal` unified comment stream, timeline events).
- `ClassOffering` (~7196) with `instructorId`, `partnerId`, `chapterId`, sessions, enrollments, approval workflow, timeline events, outcome.
- `Partner` (~7284): name/type/website/notes/`relationshipLeadId`, plus flag-gated pipeline fields (stage, priority, partnerType, contact strings, `lastContactedAt`, `nextFollowUpAt`, requested-program free-text fields) and `PartnerNote` (kinds: NOTE | FOLLOW_UP | MEETING | CONCERN | WIN | DECISION | OUTCOME | STAGE_CHANGE).

Gaps (detailed in §23): no PartnerContact/PartnerRequest/PartnerAgreement models; no check-in scheduling fields on advising; initiatives are config-registry only (`lib/people-strategy/strategic-initiatives.ts`), not DB rows; **no search/index tables anywhere**; no unified Person directory model (User + per-role satellites).

### 5.4 Data 360 and search

- `lib/operations/entity-360.ts` defines `ENTITY_360_TYPES = ["person", "class", "partner", "initiative", "meeting", "action"]` and the universal `Entity360` payload (identity, signal, glance, facts, people, classes, workItems, meetings, timeline, nextStep, risks).
- `Entity360Provider` mounts once in the app shell; `openEntity(type, id)` opens stacking right-side panels; `EntityLink` and `RelatedEntityBadge` launch panels from action cards, meeting cards, admin partner/class lists, and every `PersonLink`.
- Authorization lives in the loaders (`entity-360-queries.ts`): person is member-visible with officer-gated sections; class/partner/initiative/meeting are officer-tier with 404-on-forbidden.
- `lib/operations/quick-find.ts` ranks prefix > word-start > substring over a **page-local** index loaded by the Data 360 page. `docs/DATA_360.md` explicitly names a global ⌘K palette backed by a search endpoint as the natural next step.
- `SavedActionView` (action tracker) and `InstructorSavedView` exist as per-domain saved-view systems; no generic saved query, no recents, no suggested queries.

### 5.5 People and partner surfaces

- People exist only as per-role tables: `/admin/students`, `/admin/instructors` (mature, with detail page), `/admin/staff`, `/admin/alumni`, `/admin/bulk-users`, plus the leadership-only `/actions/people` dashboard (where names are currently **inert text** — `people-dashboard-table.tsx`). `/people/[id]` is the canonical public profile with officer-gated operating panels. **There is no unified person directory.**
- `/admin/partners` is dual-mode behind `ENABLE_PARTNER_PIPELINE`: simple directory (off) or stage-grouped pipeline with KPIs and per-partner cards (on); `/admin/partners/[id]` detail exists. It is admin-routed, flag-gated, and absent from the leadership core nav.

### 5.6 Work surfaces

- Action System 4.0 derivations are built and tested but **partially unwired in UI** (per `docs/ACTION_SYSTEM_4.0_DELIVERED.md` §7): Entity Action Operating Panel, Meeting Follow-Up Pack, structured completion capture inline, Weekly Review action sections.
- Initiatives: config registry + pure health engine (health/momentum/progress/risk/ownership with explainers and documented windows, e.g. `INITIATIVE_MOMENTUM_WINDOW_DAYS = 14`). Surfaces: `/operations/initiatives`, `/operations/strategic-map`, `/operations/portfolio`, `/operations/projects` (a third tier between initiatives and actions).
- Reports: `/actions/completion-report`, `/admin/analytics`, `/admin/chapter-reports` (concrete health rules), `/admin/classes/reports`, scattered role reports.

### 5.7 UI system

- Tokens exist; primitives don't. No shared PageHeader, Tabs, Modal/Drawer (each feature hand-rolls), Table shell, or single EmptyState (three competing patterns). `.card` means four different things across pages. Spacing rhythm varies 16–48px between equivalent sections. Inline styles override tokens in places.
- `components/shared/` contains only collapsible-section, skeleton, and a save-state indicator. `components/ui/` is nearly empty. Everything else is domain-siloed.

---

## 6. Current UX/IA Problems

Ranked by impact on the executive experience:

1. **No global access layer.** A leader looking for "Camp Hudson" must know it's a Partner, know partners live under Admin, and have the pipeline flag on. Nothing portal-wide answers "find X."
2. **No master People database.** "Find Sam Singer" requires knowing Sam's role first (students table vs instructors table vs staff table vs alumni). Partner contacts and parents aren't findable at all as people.
3. **Partners are a buried admin table**, not a relationship system. Relationship leads, stages, and follow-up dates exist in the schema but are invisible to the leadership tier; requests/negotiations/agreements live in free text.
4. **Work is split across three trees and three command centers.** The same overdue action appears in `/actions`, `/actions/all`, `/operations/command-center`, and possibly `/admin/action-center` — with different framing in each.
5. **Mentorship has five+ entry points and three matching boards.** The redesign plan exists (`MENTORSHIP_REDESIGN_PLAN.md`) and is unexecuted.
6. **No leadership home.** The richest leadership surface (`/operations/command-center`) is feature-flag-gated and not the landing page; the actual landing for admins is a card list pointing at the applicant board.
7. **Click depth.** Person → their open actions: 3–4 clicks today (profile → officer panel → action list). Partner → last meeting: not possible without reading the note log. Applicant → decision: workable but spread over cockpit + detail + chair queue.
8. **Dead-end and legacy pages** still reachable: `/all-actions`, `/admin/action-center/*`, `/mentorship-program/*`, `/world`, plus gamification surfaces irrelevant to the leadership tier.
9. **Vague presentation of honest data.** Engines compute reasons; several UIs render only the level chip ("At Risk") without them.
10. **No standard page anatomy.** Every page invents its own header, filters, and card grid, so polish work doesn't compound.

---

## 7. Proposed Simplified Portal Structure

### Leadership-tier top-level navigation (the Knowledge OS)

The evaluated direction (Home / Help Agent / People / Programs / Work / Partners / Mentorship / Knowledge / Reports / Admin) **fits the codebase well** with two adjustments: "Programs" should be the umbrella for classes + pathways + curriculum (matching `ClassOffering`/`Pathway`/`ClassTemplate`), and Mentorship stays top-level only for roles that operate it (matching existing role gating).

| Nav item | Route | What it absorbs | Source today |
|---|---|---|---|
| **Home** | `/` (leadership variant) | Executive cockpit: brief, needs attention, today's meetings, recent activity | `buildTodaysBrief`, `buildNeedsAttention`, `getWeeklyOperationalDigestForViewer` — currently scattered across `/operations/*` |
| **YPP Help Agent** | global ⌘K + `/help-agent` | Portal-wide search/commands | New (reuses Quick Find ranking + Entity 360) |
| **People** | `/people` | Master People Database; absorbs `/admin/students`, `/admin/instructors` list view, `/admin/staff`, `/admin/alumni` directory role, `/actions/people` | §9 |
| **Programs** | `/programs` (leadership view) | Class operations (`/admin/classes`), pathways, curriculum, course library | §14 |
| **Work** | `/work` | Actions + meetings + initiatives + weekly rhythm; absorbs `/actions/*`, `/operations/command-center`, `/operations/initiatives`, `/operations/weekly-*` | §15 |
| **Partners** | `/partners` | Master Partner Database; absorbs `/admin/partners` (un-flagged) | §10 |
| **Mentorship** | `/mentorship` (+ `/admin/mentorship` ops tab) | Per existing redesign plan; advising surfaces join here for advisor roles | §17 |
| **Knowledge** | `/knowledge` | Resource libraries (`/resources`, `/admin/resource-library`, role resource pages as filtered views) | thin Phase-3+ consolidation |
| **Reports** | `/reports` | Completion report, analytics, chapter reports, class reports, partner report | index page first, consolidation later |
| **Admin** | `/admin` | True admin only: users/access, feature gates, governance, comms, data export. Gets a real home page with domain groups | shrinks from 72 entries to ~6 groups |

### Principles

- **Rename and redirect, don't break.** Every absorbed route gets a redirect (the `/all-actions` → `/actions/all` pattern already exists). `validate-nav.mjs` enforces integrity.
- **Master databases are pages; records are drawers; profiles are full pages.** The four-altitude model from §2 applies to every nav item.
- **Student/instructor/parent/applicant navs unchanged** except inherited polish. Their minimal layouts already implement progressive disclosure correctly.
- **Feature flags become tier defaults.** `ENABLE_OPERATIONS_HUB`, `ENABLE_ACTION_TRACKER`, `ENABLE_PARTNER_PIPELINE` stop being optional extras for the leadership tier — the Knowledge OS *is* the leadership portal.

Where to go for each executive question:

- Organization-wide view → **Home**
- All people → **People**; all partners → **Partners**; all classes/programs → **Programs**
- Actions/meetings/initiatives → **Work**
- Mentorship + advising → **Mentorship**
- Anything by name or by question → **YPP Help Agent**

---

## 8. YPP Help Agent Plan

### Naming and positioning

**"Siri for YPP" is retired everywhere** in product vocabulary, mockups, and any future copy. Code-wise this is free: a full-text search confirms zero "Siri" references in the repository. The feature ships as **YPP Help Agent** — a reliable global command/search layer, deterministic and cost-safe. It is *not* a chatbot.

### V1 capabilities (no model calls)

| Capability | Implementation |
|---|---|
| Find any entity by name | Indexed entity search over people, partners, classes, programs, meetings, actions, initiatives, mentorships, applications |
| Fuzzy matching | Postgres `pg_trgm` similarity + the existing `rankQuickFind` prefix/word-start/substring ranking client-side over returned candidates |
| Grouped results | Group by entity type with counts (mirrors the mockup's All Results / People / Programs / Work / Partners tabs) |
| Right-side preview | Selected result fetches `/api/entity-360/[type]/[id]` and renders the existing `Entity360Body` |
| Open 360 | `openEntity(type, id)` (existing provider) from anywhere; modifier-click navigates to full page |
| Command shortcuts | Verb prefixes: `new action`, `new meeting`, `add partner`, `add person`, `go people`, `go partners` — a static command registry filtered through the same ranker |
| Saved queries | New generic `SavedQuery` model (generalizing `SavedActionView`); seeded executive queries below |
| Recent records / searches | `RecentEntityView` rows written on 360 open (also powers sidebar "Recently Viewed"); recent searches in localStorage first, DB later |
| Suggested searches | Static, curated chips backed by the attention engine: "Overdue instructor reviews," "Students without advisors," "Partners needing follow-up," "Classes with no lead instructor," "Applicants waiting on decision," "Mentorships missing check-ins" |
| Permissions | Index rows carry a `visibilityTier`; queries filter by viewer tier; result hydration goes through the already-authorized entity-360 loaders, so a result can never reveal more than its 360 would |

### Query examples → resolution

- "Find Sam Singer" → people index, fuzzy match → person preview → open Person 360.
- "Show all students without advisors" → saved query: `User(role STUDENT)` left-join `StudentAdvisorAssignment(isActive)` where null → People page pre-filtered.
- "Show all open partner negotiations" → saved query over `PartnerRequest(status: OPEN | IN_NEGOTIATION)` (new model, §23) → Partners page pre-filtered.
- "Show actions from last week's meetings" → `ActionItem` where `sourceType IN (MEETING, MEETING_DECISION)` and source meeting date in last week → Work Hub pre-filtered.
- "Show all work connected to STEM Innovators" → entity match (partner) → Partner 360 work tab, which already aggregates via `relatedEntityType='PARTNER'`.

Saved queries are **named filters over existing list pages**, not a new query language. Each resolves to a URL with query params on People/Partners/Work/Programs. This keeps the agent deterministic, auditable, and cheap.

### Architecture

1. **Index:** new `SearchDocument` table — `{ entityType, entityId, title, subtitle, keywords[], tsv tsvector, trigram on title, visibilityTier, chapterId?, updatedAt }`. Populated by a backfill script plus write-path upserts in the existing server actions (create/update user, partner, class, meeting, action, application, mentorship). A nightly reconcile cron (Vercel cron pattern already in use) heals drift.
2. **API:** `GET /api/search?q=&types=&limit=` → grouped, ranked, tier-filtered results (id, type, title, subtitle, status chip). P95 target < 150ms.
3. **UI:** `HelpAgentPalette` mounted in `components/app-shell.tsx` beside `Entity360Provider`; global ⌘K handler (replacing the decorative chip); full-page `/help-agent` for the search-first experience with suggested chips and saved queries.
4. **Recents/suggestions:** as above.

### Future optional AI layer (explicitly out of V1)

A "Summarize" button on a result set or 360 — explicit user action, one call, using the established pattern from `lib/ai/generate-review-draft.ts` (Haiku + prompt caching). Never per-keystroke, never required for any workflow.

---

## 9. Master People Database Plan

### Page: `/people`

One directory for every person connected to YPP: students, instructors, applicants, mentors/mentees, advisors, parents/guardians (tracked via `ParentStudent`/`ParentProfile`), leadership, staff, alumni, partner contacts (once `PartnerContact` exists, §23), interviewers/reviewers.

**No new person model is needed.** The directory is a query over `User` + role/satellite joins. Partner contacts join the directory when the `PartnerContact` model lands (rendered as people with a "Partner contact" role chip, linking to their organization).

**Page anatomy** (mirrors the mockup, trimmed):

- Header: title, "Add Person" primary action, Help Agent search field.
- Stat strip (click-to-filter): Total people, Instructors (active), Students (active), Mentors, Applicants in process. Five tiles maximum.
- Filters: Role, Program/Track, Status, Chapter/School. "More filters" disclosure for the rest. Free-text search hits the same index as the Help Agent.
- Master table columns — exactly six: **Name** (avatar + email), **Role**, **Program/Affiliation**, **Status**, **Last Active**, overflow menu. Row click opens the preview; modifier-click opens `/people/[id]`.
- Right preview panel: the existing Person Entity 360 (drawer or docked panel on wide screens).

**What the People page answers immediately:** who is this, what role, what are they connected to, what status, when last active, what needs attention (flag chip sourced from the attention engine: overdue review, missing advisor check-in, application waiting), what's the next action.

**What it deliberately omits at page level:** XP/badges/gamification, profile completeness, mentorship cycle detail, training progress — all live in the 360.

### Migration of existing surfaces

- `/admin/students`, `/admin/staff`, alumni directory → become `/people?role=…` filtered views; the admin pages redirect. Role-specific bulk tooling (CSV import, role editor) stays under Admin.
- `/admin/instructors` keeps its operational detail page (`/admin/instructors/[id]` is mature) but its list becomes `/people?role=instructor`; the detail page becomes the instructor-tailored full 360 over time.
- `/actions/people` (accountability dashboard) folds into Work Hub's "By person" view (§15); its inert names become `PersonLink`s immediately (a known Phase-1 fix from `PEOPLE_STRATEGY_COMMAND_CENTER_PLAN.md`).
- Applicant hygiene: `listActionAssignableUsers` currently leaks applicants into assignee pickers — fix with an active-member predicate during Phase 1.

---

## 10. Master Partner Database Plan

### Page: `/partners`

Partners cover camps, schools, synagogues, nonprofits, education/community orgs, companies, program hosts, curriculum/outreach partners — the existing `partnerType` vocabulary plus free-text type, normalized during migration.

**Promotion, not creation:** `/admin/partners` already has the right bones (directory + pipeline, relationship lead, stages, follow-up dates, `PartnerNote` log, open-action counts via polymorphic links). The work is to **un-flag it, move it to `/partners` in the leadership nav, and deepen the model** (§23).

**Page anatomy:**

- Header: title, "Add Partner" primary action, Help Agent search.
- Stat strip (click-to-filter): Total partners, Active, Needs follow-up (overdue `nextFollowUpAt` — concrete, already computed), Upcoming meetings, Open requests (new model). Five tiles.
- Filters: Type, Status/Stage, Region, Relationship lead, Open needs.
- Master table columns — exactly eight, per the requirement: **Partner**, **Type**, **Primary contact**, **Relationship lead**, **Linked programs/classes** (count chip), **Status**, **Last interaction**, **Next step / open request**. No "partner health" column — "Needs follow-up" and "Next step" carry the load with concrete dates.
- Right preview: Partner Entity 360 (exists today; tailored per §13).

**The leadership questions it answers at page level:** who owns this relationship, what state is it in, when did we last talk, what's next. Everything else is preview/360 depth.

### Relationship operations (the critical upgrade)

Partner records must support real relationship work, not contact cards. This requires the §23 model additions: `PartnerContact` (multiple contacts with roles), `PartnerRequest` (structured asks/negotiations with status), `PartnerAgreement` (MOU/contract with status, dates, and conditions). Meetings need **no new model**: `OfficerMeeting` already supports `relatedEntityType='PARTNER'` — Partner 360 surfaces those meetings, and "Schedule meeting" from a partner deep-links the existing new-meeting drawer prefilled (`?new=1&relatedType=PARTNER&relatedId=…`, a pattern that already works on class pages).

---

## 11. Person 360 Tailoring

One skeleton (§18), role-dependent content. The person loader in `lib/operations/entity-360-queries.ts` already varies emphasis; this section makes the variation a specification. Tabs shown only when they would not be empty.

### Instructor

Tabs: **Overview · Classes · Reviews/Interviews · Mentorship/Leadership · Activity**

- Overview: role + track, current classes (count + chips), open actions, next review due, advisor/mentor relationships, leadership contributions (from `LeadershipContribution`), notes.
- Classes: taught/current via `ClassOffering.instructorId` + `RegularInstructorAssignment`.
- Reviews/Interviews: applicant history if they came through the pipeline (`InstructorApplication` chain incl. reapplications), quarterly reviews, interview assignments they conduct.
- Mentorship/Leadership: mentorships (both directions), advisor caseload if `STUDENT_ADVISOR`, contributions with status.
- Activity: existing person-story timeline (joined, roles, classes, mentorship, notes) + meetings mentioned in.

### Student

Tabs: **Overview · Classes · Advisor · Activity** (Notes folds into Overview/Advisor)

- Overview: grade/school (from `UserProfile`), enrolled classes, advisor assigned (or **"No advisor" flag**), mentor if any, parent/guardian chips (`ParentStudent`), open support needs, last advisor check-in.
- Classes: enrollments with attendance pattern (concrete: sessions attended / total, last absence — from `AttendanceRecord`/`ClassAttendanceRecord`).
- Advisor: assignment, status (`ENGAGED | NEEDS_ATTENTION | PAUSED | CONCLUDED`), check-in log (`AdvisingNote`), next check-in due (new field, §12), recommendations and their statuses, follow-up flag.
- Activity: program history timeline.
- Explicitly demoted from leadership view: XP, badges, challenge streaks.

### Applicant

Tabs: **Overview · Application · Interviews/Reviews · Activity**

- Overview: stage + status enum, desired role/track (`applicationTrack`), **missing items** (from the concrete readiness signals in `lib/readiness-signals.ts`), decision status, next step, timeline position.
- Application: materials (`ApplicantDocument`), responses, cohort.
- Interviews/Reviews: structured reviews with category ratings, interview Q&A, reviewer recommendation, chair decision + conditions.
- Activity: `InstructorApplicationTimelineEvent` feed.

### Partner contact (new role)

Tabs: **Overview · Activity**

- Overview: organization (link to Partner 360), title/role, relationship owner, recent meetings/requests they're attached to, notes, follow-ups.

### Mentor / Advisor / Leadership variants

Mentors get a Mentorship tab (mentees, check-in cadence, review queue). Advisors get an Advising tab (caseload, overdue check-ins). Leadership/staff default to the instructor-like layout minus teaching tabs.

---

## 12. Student/Advisor Model

The schema is already right; the gaps are scheduling, surfacing, and structure.

### What exists (keep)

`StudentAdvisorAssignment` (advisor↔student, `advisingStatus`, `needsFollowUp`, `nextSteps`, `lastCheckInAt`), `AdvisingNote` (NOTE | CHECK_IN), `AdvisingRecommendation`, advisor-as-`LeadershipContribution(STUDENT_ADVISOR)`, `StudentAdvisingPanel` on profiles, `lib/leadership/advisor-actions.ts` server actions.

### What to add

1. **Check-in scheduling:** `checkInCadenceDays` (default e.g. 14) and computed/stored `nextCheckInDueAt` on `StudentAdvisorAssignment`. "Check-in overdue" becomes a real, concrete state instead of a reactive `lastCheckInAt` read.
2. **Structured support needs (Phase 3):** `SupportNeed { assignmentId, category, description, status: OPEN | IN_PROGRESS | RESOLVED | DEFERRED, openedAt, resolvedAt }`. Until then, `nextSteps` text remains the carrier.
3. **Advisor caseload view:** advisors currently manage from student profiles; there is no "My Advisees" surface. Add a caseload view (within Mentorship for advisor roles): advisees with status, overdue check-ins first, last check-in, open recommendations, quick "Log check-in" action.
4. **Attention integration:** "advisor check-in overdue" and "student without advisor" become categories in `lib/operations/attention.ts`, which feeds Home, Work Hub, and Help Agent suggested queries automatically.
5. **Work graph integration:** advisor follow-ups optionally create `ActionItem`s (`sourceType: ENTITY`, related student) so advising work appears in the unified work picture.

### Student-side and leadership-side answers

- Student 360 Advisor tab (per §11): assignment, check-in history, next check-in due, support needs, recommendations.
- Leadership: People page flag chips ("No advisor," "Check-in overdue"), Help Agent saved queries, Home attention queue items — all from the same derivations.

---

## 13. Partner 360 Tailoring

Tabs: **Overview · People · Classes/Programs · Meetings · Requests & Agreements · Activity** (Files lives inside Requests & Agreements and Notes inside Activity until volume justifies more)

### Overview (the relationship cockpit)

- Identity: name, type, status/stage, region/location, website.
- **Relationship lead** (`relationshipLeadId` — person chip, reassignable).
- **Primary contact** (from `PartnerContact`, with email/phone quick actions).
- Concrete state row (replaces any "health" chip): Last interaction (`lastContactedAt` / latest `PartnerNote`), Next follow-up (`nextFollowUpAt`, overdue in red), Next meeting (earliest upcoming linked `OfficerMeeting`), Open requests (count), Open actions (count via `relatedEntityType='PARTNER'`).
- Next step (free text, required when stage is active — enforced by the attention engine's "partner without next step" signal, which already exists).
- Quick actions: Schedule meeting (prefilled drawer), Log interaction (PartnerNote), Add note, Create action, Add request.

### People

- Contacts (`PartnerContact` list: name, title, role, primary flag) — each opens a person-style preview.
- Affiliated instructors (via linked classes' instructors).
- Affiliated students/parents (via enrollments in linked classes; parent chips via `ParentStudent`). This answers "which families are connected to this partner" without a new model.

### Classes/Programs

- Linked `ClassOffering`s with status, enrollment count, lead instructor, next session. "Create class for this partner" action.

### Meetings

- All `OfficerMeeting`s linked to this partner: date, attendees, decisions count, open follow-ups. One-click into Meeting 360.

### Requests & Agreements

- `PartnerRequest` list: what they asked for, status (OPEN | IN_NEGOTIATION | AGREED | DECLINED | FULFILLED), owner, due date, linked classes that fulfill it.
- `PartnerAgreement` list: kind (MOU | CONTRACT | INFORMAL), status (DRAFT | SENT | SIGNED | EXPIRED), effective/renewal dates, conditions with per-condition status (PENDING | SATISFIED | WAIVED), linked documents (`FileUpload`).

### Activity

- Unified timeline: `PartnerNote` log (all kinds), stage changes, meetings held, actions completed, agreements signed — the relationship story in one stream (extends the existing pipeline-note timeline in the partner 360 loader).

Every leadership question from the brief maps to a tab: ownership → Overview; classes → Classes; instructors/students/parents → People; meetings → Meetings; requests/negotiations/conditions/contracts → Requests & Agreements; last interaction/next step/open actions → Overview.

---

## 14. Program/Class Structure

### Leadership Programs hub: `/programs`

- Stat strip: Active classes, Starting soon, **Needs setup** (from `deriveClassReadiness` missing-setup list — concrete), Completed this term.
- Table: Class, Program/Track, Partner, Lead instructor, Schedule, Enrollment (n/capacity), Status, Next session. Row → Class 360 preview.
- Secondary tabs: Pathways, Curriculum/Templates (absorbing `/admin/course-library`, `/admin/curricula` as leadership views; deep editing stays admin).

### Class page / Class 360

Tabs: **Overview · Students · Instructors · Curriculum · Meetings/Actions · Activity**

Overview shows exactly the brief's list: name, program/track, partner chip (→ Partner 360), schedule (`meetingDays`/`meetingTime`/`timezone`), enrollment, lead instructor + teaching team, next session, curriculum progress, attendance status, open issues, partner follow-up flag, recent activity, quick actions.

**Readiness replaces "health"** — and the engine already exists. `deriveClassReadiness` returns ready / almost / needs_setup / at_risk **with the missing-setup list**; `computePublishReadiness` (`lib/class-publish-readiness.ts`) provides the pre-publish checklist. The UI rule: always render the checklist, never just the level:

- ☑ Instructor assigned ☑ Schedule set ☐ Next lesson ready ☑ Enrollment ≥ minimum ☐ Attendance logged for last session ☐ Open issues (2) ☐ Partner follow-up needed

Students tab: roster with attendance pattern per student. Instructors: lead + team + co-instructor assignments. Curriculum: template, session topics, progress. Meetings/Actions: the Entity Action Operating Panel (derivation exists, UI unwired — wire it here first). Activity: `ClassOfferingTimelineEvent` + operational timeline.

---

## 15. Work Hub Structure

### Page: `/work`

Unifies what is currently split across `/actions` (My), `/actions/all`, `/actions/meetings`, `/operations/command-center`, `/operations/initiatives`, `/actions/people`, and the completion report. The legacy `/admin/action-center` and `/actions/command-center` retire with redirects.

**Anatomy (per the Work Hub mockup, trimmed):**

- Stat strip (click-to-filter): Needs attention, Overdue actions, Upcoming meetings, At-risk initiatives, Open work items.
- Tabs: **All Work · Actions · Meetings · Initiatives · My Queue** (plus a "By person" view absorbing the accountability dashboard).
- Unified list: the existing `WorkItem` fold (`lib/operations/work-items.ts` already merges tracker actions + unconverted meeting follow-ups into ranked lanes: overdue → blocked → needs owner → due soon → …).
- Right preview: Action/Meeting/Initiative 360 panels (all exist).
- Below the fold: Recent activity, Upcoming this week, Saved views (the `SavedActionView` bar, generalized to `SavedQuery`).

**Work item rows** show: title, type icon, owner, linked-entity chip (`RelatedEntityBadge` — exists), due/next step, status. The linked-entity chip is what makes work navigable back to people/partners/classes/initiatives.

**What flows in beyond actions/meetings/initiatives** (the brief's list): reviews needing action and applicant next steps (attention engine categories — exist), partner requests (new model → new category), mentorship/advisor check-ins (categories exist/added per §12). The Work Hub's "Needs attention" tab *is* the cross-domain attention queue (`buildNeedsAttention`), each item carrying "why it matters" + suggested next step — already implemented, currently rendered only on the Operations Command Center.

**Finish wiring Action System 4.0** as part of this consolidation (all derivations exist per `docs/ACTION_SYSTEM_4.0_DELIVERED.md` §7): Entity Action Operating Panel on entity pages, Meeting Follow-Up Pack on meeting detail, inline structured completion/blocker capture, Weekly Review action sections.

**Initiatives tab** keeps the portfolio view but folds `/operations/portfolio` (duplicate analytical view) and re-evaluates the `/operations/projects` third tier (see §29 open questions). The strategic map remains as a secondary view within the Initiatives tab.

---

## 16. Application Review Structure

The pipeline model is comprehensive; the surface count (15 pages) and decision ergonomics are the problem. The direction follows `FINAL_REVIEW_REDESIGN_PLAN.md` (already a production-grade spec for the chair cockpit) plus this plan's altitude rules.

**Application 360 / review page shows** (per the brief, all backed by existing models):

- Identity + desired role/track (`applicationTrack`), current stage (status enum), decision status.
- **Missing items** — concrete, from `lib/readiness-signals.ts`: interview reviews submitted? materials complete? reviewer recommendation present? open info request? Rendered as a checklist, **never as a bare percentage**. If a composite "readiness" indicator stays, its caption lists the four inputs.
- Interview status (slots, assignments, completed rounds), review summary (category ratings: curriculum strength, relationship building, organization & commitment, community fit, long-term potential — already structured), materials, timeline (`InstructorApplicationTimelineEvent`), recommendation/next step.
- Decision dock with the real actions: Advance, Request info, Schedule interview, Approve (with conditions), Decline, Hold, Waitlist — mapping 1:1 to `ChairDecisionAction`.

**Consolidation:** the applicant detail slideout vs. review workspace vs. chair queue trio collapses to: board (pipeline list + preview drawer) → Application 360 (full page, role-aware: reviewer sees review editor, chair sees decision dock). Generalize the existing `CollapsibleAssignmentPanel` pattern for deep sections. Applicant-facing pages (`/applications/*`) are untouched.

---

## 17. Mentorship/Advising Structure

**Execute `MENTORSHIP_REDESIGN_PLAN.md` V1 as written** — it is correct and unexecuted: one canonical home per role (`/admin/mentorship` ops, `/mentorship` mentor, `/my-mentor` mentee), redirect `/mentorship-program/*` and `/mentor/*`, merge the three matching boards into one assignments tab, standardize the PURPLE/GREEN/YELLOW/RED rubric labels.

**Mentorship page (leadership/mentor view)** per the brief:

- Stat strip: Active mentorships, **Needs follow-up** (concrete states below), Upcoming check-ins, New matches, Ending soon.
- List + filters (program group, status, chair lane); selected mentorship opens **Mentorship 360** — added as a seventh Entity 360 type (§18) showing mentor, mentee, program/track, start date, next check-in, goals (from `GRDocumentGoal`), last activity, notes, open items (`MentorshipActionItem`), quick actions.

**Concrete states replace "mentorship health":** Check-in overdue (no `MentorshipSession`/check-in within cycle window) · No recent activity (no session/reflection/review in N days — the "gone quiet" signal already exists in `attention.ts`) · Goal missing (no active `GRDocumentGoal`) · Needs leadership follow-up (`MentorshipRequest` of kind ESCALATION open) · On track (none of the above). Each renders as its own labeled chip, not a composite.

**Advising lives here too:** advisor roles see the caseload view (§12) as a tab; admin sees advisor coverage (students without advisors, overdue check-ins) in the ops dashboard.

---

## 18. Universal 360 Rules

The universal skeleton (already implemented in `entity-360-body.tsx`) is, in order:

1. **Header/identity** — avatar/initials, title, subtitle, status badge.
2. **Status / next step** — one line; the single most important "what now."
3. **Key facts** — max 6 at preview altitude.
4. **Relationships** — connected-entity chips (people, classes, partner, meetings).
5. **Recent activity** — last 3–5 events at preview altitude.
6. **Open actions/work** — via existing work-item integration.
7. **Timeline, notes/files** — full-360 altitude only.
8. **Quick actions** — max 4 at preview altitude.

Rules:

- **Two altitudes per entity:** drawer preview (sections 1–6 trimmed + quick actions) and full 360 (everything + tabs). Same loader, two renders — the payload already supports this.
- **Tabs are per-entity-type and meaningful** (§11/§13/§14/§16/§17 fix the tab sets: Partner — Overview·People·Classes/Programs·Meetings·Requests & Agreements·Activity; Person — role-tailored; Student — Overview·Classes·Advisor·Activity; Instructor/Application — Overview·Application·Interviews/Reviews·Classes·Mentorship/Leadership·Activity; Class — Overview·Students·Instructors·Curriculum·Meetings/Actions·Activity). **No tab ships because data exists; a tab ships because a user acts there.** Empty tabs hide.
- **Signals always render with reasons** (§19). The `signal` field keeps its level + a mandatory reasons array.
- **Type roster grows to eight:** add `application` and `mentorship` to `ENTITY_360_TYPES`; student/instructor/applicant/partner-contact remain person-type with role-tailored loaders (cheaper than new types, consistent with `PersonLink` behavior).
- **Every entity reference everywhere is a chip** that opens the drawer — extend the `EntityLink`/`RelatedEntityBadge` pattern to the remaining raw links (audit found many outside operations surfaces).

---

## 19. Vague Metric Audit and Replacements

Codebase finding: most "vague" labels are **vague only at the presentation layer** — the engines compute concrete, documented inputs. The binding policy: **a level may summarize; the reasons must always be visible at the same altitude.** No bare scores, no composite indexes without listed inputs.

| Current label (location) | What it actually computes | Replacement presentation |
|---|---|---|
| Class "readiness" (`deriveClassReadiness`, `signals.ts`) | Missing-setup list (instructor, schedule, sessions, enrollment) | Readiness checklist rendered in full (§14); level chip allowed beside it |
| "Partner health" (`derivePartnerHealth`, `signals.ts`) | Days since contact, next-step presence, overdue follow-up — with reasons | Drop the word "health." Show: Last interaction · Next follow-up (overdue flag) · Open requests · Open actions |
| Initiative "health/at-risk" (`strategic-initiative-health.ts`) | Overdue/blocked/unowned/stale counts, schedule slippage, unconverted decisions, momentum windows (documented constants) | Keep level; always render `explainInitiativeHealth` reasons + next steps beneath it |
| "Momentum" (accelerating/steady/slowing/stalled) | Completions + intake + meetings in 14-day window | Rename to "Recent activity:" with the counts ("3 completed, 1 meeting in last 14 days — slowing") |
| "People Momentum" (People-Strategy command center) | Completions lift, overdue/flagged lower | Fold into Work Hub "By person": open/overdue/completed columns — drop the momentum framing |
| "Weekly Pulse" (`buildWeeklyPulse`) | Completions, intake, velocity vs prior week | Rename "This week:" with explicit numbers and a labeled comparison |
| Instructor "readiness" (decision screen, `readiness-signals.ts`) | 4 boolean checks | Render the 4 checks as a checklist; n/4 caption permitted |
| Chapter "health" (`/admin/chapter-reports`) | President assigned, user count thresholds, recent events/announcements | Already ships `healthReason` — promote the reason to equal visual weight |
| Profile completeness (person 360) | Missing profile fields | List the missing fields; show only when incomplete (current behavior — keep) |
| "Engagement" (`hasDisengagementRisk`) | Inactivity tags | "No activity in N days" with the actual N |
| Mockup "YPP Pulse 92%" | Nothing — does not exist in code | **Do not build.** Home uses Today's Brief sentences + attention queue |
| Mockup "Engagement Level: High" (partner) | Nothing | Do not build; concrete fields per §13 |

Class/Student/Partner concrete-indicator sets from the brief are adopted verbatim as the canonical replacements (§12, §13, §14).

---

## 20. Navigation Consolidation Recommendations

1. **Adopt the §7 leadership nav** (Home, Help Agent, People, Programs, Work, Partners, Mentorship, Knowledge, Reports, Admin) in `lib/navigation/catalog.ts` + `core-map.ts`; leadership core pins: Home, Help Agent, People, Work, Partners (+ up to 3 role-relevant).
2. **Redirect, then retire:** `/all-actions/*` → `/work`; `/actions/command-center` → `/work`; `/admin/action-center/*` → `/work` (one-time data check on its separate models, then archive); `/mentorship-program/*` and `/admin/mentorship-program/*`, `/admin/mentor-match`, `/admin/instructor-mentor-matching` → canonical mentorship routes; `/operations/command-center` content → leadership Home; `/operations/data-360` → `/help-agent` + Home (its explorer becomes Help Agent browse; its brief becomes Home).
3. **Admin gets a real home:** `/admin` stops redirecting to chapters; renders six groups (People & Access · Hiring · Programs & Content · Communications · Governance/Ops · Data). Admin keeps only true admin tooling; operational surfaces move to their domains.
4. **Gamification exits the leadership tier:** student-facing surfaces remain in student nav; remove from leadership catalogs; orphan `/world` and stale prototypes behind redirects.
5. **One home per role.** Leadership home is the cockpit; `/operations` index folds into it.
6. **Extend `validate-nav.mjs`**: add redirect-map validation (legacy href → canonical) so retired routes can't silently 404, and keep the ≤8 core pins rule.

---

## 21. Page-by-Page Redesign Recommendations

| Page | Verdict | Action |
|---|---|---|
| `/` leadership home | Rebuild | Cockpit: greeting, 4–6 click-to-filter tiles, Needs Attention (with reasons), today's meetings, recent activity, recently opened. All loaders exist (`operational-digest`, `attention.ts`, `metrics.ts`). No pulse %, no donuts. |
| `/operations/command-center` | Fold into Home | Its digest/attention/initiative sections are the Home content. Redirect. |
| `/operations/data-360` | Fold | Quick Find → Help Agent; Today's Brief → Home; explorer → Help Agent browse + master DBs. Redirect when parity reached. |
| `/actions/*` (My/All/meetings/people/completion-report) | Consolidate | → `/work` tabs (§15). Preserve URLs as tab deep-links during transition. |
| `/admin/action-center/*` | Retire | Legacy separate system; verify no unique live data, archive, redirect. |
| `/admin/partners` | Promote | → `/partners`, un-flag pipeline, §10 columns, §13 360. |
| `/admin/students`, `/admin/staff`, alumni list | Absorb | → `/people` filtered views + redirects; bulk tools stay admin. |
| `/admin/instructors` | Keep detail, absorb list | List → `/people?role=instructor`; `[id]` page evolves into instructor full-360. |
| `/actions/people` | Absorb | → Work Hub "By person"; make names PersonLinks immediately (Phase 1). |
| `/admin/instructor-applicants` suite | Simplify surfaces | Board + Application 360 (role-aware) per §16; chair cockpit per `FINAL_REVIEW_REDESIGN_PLAN.md`. |
| `/admin/instructor-readiness` | Keep, relabel | It's a concrete blocker aggregation; rename to "Instructor onboarding queue" to avoid the readiness-score connotation. |
| Mentorship suite | Execute existing plan | §17. |
| `/admin/classes` + `[id]` | Reframe | → `/programs` leadership hub + Class 360 per §14; wire Entity Action Operating Panel. |
| `/admin/analytics`, reports | Index | `/reports` landing listing real reports; drop vague-metric panels per §19. |
| `/people/[id]` | Enhance | Becomes Person full-360 with role tabs (§11); officer panels become tabs. |
| Student/instructor/parent dashboards | Leave | Out of scope except shared primitives. |

---

## 22. Visual Polish / Design System Recommendations

**Decision: stay on plain CSS + tokens.** A Tailwind migration across 492 pages is high-risk/low-value; the token system is good. The gap is primitives and enforcement. (`FINAL_REVIEW_REDESIGN_PLAN.md`'s visual language — calm, decisive, trustworthy — is adopted as the north star; it's already the most complete design spec in the repo.)

**Build eight primitives in `components/shared/`** and require them on every touched page:

1. `PageHeader` — title, subtitle, breadcrumb/back, primary + secondary actions, optional stat strip slot. (Biggest single consistency win; no standard exists today.)
2. `Card` — one card with `padding="md|lg"` variants; ends the four-meanings-of-`.card` problem.
3. `StatCard` — count, label, optional delta, **href filter** (click-to-filter is standard behavior).
4. `DataTableShell` — header/filters/table/pagination/empty slots wrapping the existing `data-table.tsx`.
5. `Tabs` — accessible, URL-synced; replaces per-page hand-rolled tabs.
6. `Drawer` — standardize on the Entity 360 drawer's chassis for all slide-overs (applicant quick drawer, meeting drawer, GR panel migrate to it).
7. `EmptyState` — one component, two tones (neutral, editorial); replaces the three competing patterns.
8. `StatusBadge` + `EntityChip` — canonical status colors from tokens; EntityChip generalizes `RelatedEntityBadge` everywhere an entity is referenced.

**Standards to codify** (a short `docs/design-standards.md`, enforced in review):

- Spacing: 4px scale only; section gap 24px; card padding 20/24px; page gutter 32px.
- Radius: cards 12px (`--radius-md`), buttons/inputs 8px, chips 999px. Shadows: only the token palette, one level per surface type.
- Typography: defined scale (28/20/16/14/12·5) with weights; page title always via PageHeader.
- Status colors: exactly one semantic set (success/warning/error/info/neutral) consumed only through StatusBadge.
- Sidebar: keep dark-premium identity; align paddings/active states with mockups (chassis is sound).
- Buttons: primary (one per view), secondary, ghost, danger — via the existing `.button` classes, no inline overrides.
- **Lint guard:** ESLint rule flagging inline `style={{…}}` with hardcoded colors/spacing in `app/(app)` and warning on raw hex in new code.
- Empty/loading: every list page ships EmptyState + skeleton (skeleton exists in `components/shared/`).

The order of operations matters: primitives land first (Phase 2), then every page touched by consolidation adopts them, so polish compounds instead of being repainted page-by-page.

---

## 23. Data Relationship Gaps

New models/fields (all additive; naming follows existing conventions — append-only logs, status enums, explicit FKs where the relation is first-class):

### Partner relationship operations

```prisma
model PartnerContact {
  id          String   @id @default(cuid())
  partnerId   String
  partner     Partner  @relation(fields: [partnerId], references: [id])
  name        String
  title       String?
  email       String?
  phone       String?
  role        String?          // decision maker, day-to-day, billing…
  isPrimary   Boolean  @default(false)
  userId      String?          // optional link if they have a portal account
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model PartnerRequest {
  id          String               @id @default(cuid())
  partnerId   String
  partner     Partner              @relation(fields: [partnerId], references: [id])
  title       String               // "3 instructors for summer camp"
  details     String?
  status      PartnerRequestStatus // OPEN | IN_NEGOTIATION | AGREED | DECLINED | FULFILLED | EXPIRED
  ownerId     String?              // User responsible
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
  id          String                    @id @default(cuid())
  agreementId String
  agreement   PartnerAgreement          @relation(fields: [agreementId], references: [id])
  description String                    // "background checks for all instructors"
  status      PartnerConditionStatus    // PENDING | SATISFIED | WAIVED | FAILED
  dueAt       DateTime?
  satisfiedAt DateTime?
}
```

Plus: extend `relatedEntityType` usage so Partner 360 meeting/action aggregation is first-class (values already supported); add `PARTNER_REQUEST` to attention categories; migrate `Partner.contactName/Email/Phone/Title` into a primary `PartnerContact` (keep columns during transition). **Deliberately not building:** a `PartnerMeeting` model (reuse `OfficerMeeting` + polymorphic link) and a partner health score (concrete fields only).

### Advising

- `StudentAdvisorAssignment`: add `checkInCadenceDays Int @default(14)` and `nextCheckInDueAt DateTime?` (set on assignment and on each check-in).
- Phase 3: `SupportNeed` per §12.

### Search & saved queries (Help Agent)

- `SearchDocument` per §8 (with `tsvector` + `pg_trgm` indexes via raw migration SQL).
- `SavedQuery { id, ownerId?, scope: PERSONAL|SHARED|SEEDED, name, targetPage, params Json }` — generalizes `SavedActionView`; seeded rows ship the executive queries.
- `RecentEntityView { userId, entityType, entityId, viewedAt }` (pruned to last ~50/user).

### Work graph polish (small, valuable)

- Backfill legacy `officerMeetingId`-only actions to explicit `sourceType=MEETING` (named as optional in ACTION_SYSTEM_4.0_DELIVERED §7).
- Initiatives stay config-registry for now (see §29 open question on DB-backed initiatives).
- No new polymorphic-FK framework: the string-pair pattern is consistent and works; document it and validate values in server actions.

---

## 24. Search/Indexing Gaps

Current state: **no global search exists.** `rankQuickFind` is sound but page-local; the nav ⌘K only filters sidebar items; no index tables; no `/api/search`; no recents; no fuzzy matching; per-domain saved views only.

Gap closure (all in §8's architecture): `SearchDocument` index with FTS + trigram; `/api/search` with tier filtering; global palette in app shell with real ⌘K handling; grouped results + Entity 360 previews; `RecentEntityView` + localStorage recents; seeded `SavedQuery` executive views; index writes in server actions + nightly reconcile cron.

Permission model: index rows carry the coarse visibility tier (member-visible vs officer-tier vs admin); the API filters by viewer tier and chapter where applicable; hydration through entity-360 loaders guarantees nothing leaks beyond what the 360 would show (the loaders already 404 on forbidden).

---

## 25. Implementation Roadmap

Five phases. Each phase ships independently behind the existing feature-flag discipline; redirects preserve every legacy URL; `validate-nav.mjs` + smoke tests gate each release.

| Phase | Theme | Headline deliverables |
|---|---|---|
| **1** | Planning + immediate clarity | This plan; naming policy (Help Agent); quick wins (clickable names, applicant-picker fix, reasons-not-scores pass); requirement sign-offs |
| **2** | Global structure + master databases | Shared primitives; leadership nav + Home cockpit; `/people`; `/partners` (with new partner models); Help Agent V1 (⌘K + index + previews) |
| **3** | Entity 360 tailoring | Role-tailored Person 360; Student 360 + advisor scheduling/caseload; Partner 360 relationship ops; Class 360 readiness; Application 360 consolidation; Mentorship V1 consolidation + Mentorship 360 |
| **4** | Work graph + search depth | `/work` consolidation; Action System 4.0 UI wiring completion; saved/suggested queries + recents; attention-category expansion (partner requests, advising); legacy retirements (`/admin/action-center`, data-360 fold) |
| **5** | Polish + validation | Primitive adoption sweep on remaining leadership pages; clutter reduction passes per §21; click-count and workflow validation per §30; visual QA against mockup bar |

Sequencing rationale: primitives before pages (Phase 2) so every subsequent page lands polished once; master databases before 360 tailoring so the drawers have front doors; Work Hub after 360s so its previews are already tailored.

---

## 26. Phase 1 Plan

**Goal:** lock decisions, ship zero-risk clarity wins, prepare Phase 2.

Deliverables:

1. **This document** merged as the planning baseline.
2. **Naming policy:** "YPP Help Agent" adopted in all product vocabulary/mockups; grep-verified zero "Siri" in code (done — nothing to rename in code).
3. **Quick wins (small PRs, no migrations):**
   - People Dashboard names become `PersonLink`s (`components/people-strategy/people-dashboard-table.tsx` — known gap).
   - `listActionAssignableUsers` excludes applicants (active-member predicate).
   - Reasons-not-scores presentation pass on existing surfaces that show bare levels (initiative cards, partner cards, command-center chips) — render the already-computed reasons.
   - Admin home page replacing the `/admin` → `/admin/chapters` redirect (pure nav win).
4. **Requirement definitions signed off:** People DB columns/filters (§9), Partner DB columns + new models (§10, §23), 360 tab sets per type (§11–§17), polish standards (§22), Help Agent V1 scope (§8).
5. **Confusing-route + vague-metric inventories** (§6, §19, §21) accepted as the work queue.
6. **Decision log started** for §29 open questions with owners.

Exit criteria: plan approved; quick wins deployed; Phase 2 backlog ticketed.

---

## 27. Phase 2 Plan

**Goal:** the four front doors exist and feel premium.

1. **Shared primitives** (§22, items 1–8) in `components/shared/`, with the design-standards doc and lint guard. Adopt on every page below.
2. **Leadership nav + Home cockpit:** new catalog/core-map entries; Home built from existing digest/attention/brief loaders; `/operations/command-center` content folds in (redirect).
3. **Master People Database `/people`:** directory query over User + role joins; six-column table; filters; Entity 360 preview panel; redirects from absorbed admin lists; "Add person" consolidating existing create flows.
4. **Master Partner Database `/partners`:** route move + un-flag; §10 columns; **migrations: `PartnerContact`, `PartnerRequest`, `PartnerAgreement`(+conditions)**; contact backfill from string fields; quick actions wired to existing server actions + meeting drawer deep-link.
5. **YPP Help Agent V1:** `SearchDocument` migration + backfill script + write-path upserts + nightly reconcile; `/api/search`; `HelpAgentPalette` in app shell with real ⌘K; grouped results, Entity 360 preview, `openEntity` launching; `/help-agent` page with suggested chips; `RecentEntityView` + sidebar Recently Viewed.
6. **Page-header standardization** across all pages touched above.

Exit criteria: a leader can ⌘K → find any person/partner/class/meeting/action → preview → open 360, from anywhere; People and Partners are top-level, polished, and answer their §9/§10 questions; nav validation green; e2e smoke covers palette → drawer.

---

## 28. Phase 3 Plan

**Goal:** every entity's 360 is tailored to how leadership actually uses it.

1. **Entity 360 type roster:** add `application` and `mentorship` types (loaders + drawer support); person loader branches by role.
2. **Person 360 tailoring** per §11 (instructor/student/applicant/partner-contact/mentor/advisor variants); `/people/[id]` becomes the full-360 with tabs.
3. **Student/advisor:** `checkInCadenceDays` + `nextCheckInDueAt` migration; advisor caseload view; attention categories ("no advisor," "check-in overdue"); Student 360 Advisor tab.
4. **Partner 360 relationship ops** per §13: six tabs; requests & agreements UI on the Phase-2 models; affiliated people via class-enrollment joins; unified relationship timeline.
5. **Class 360** per §14: readiness checklist rendering; Entity Action Operating Panel wired (first 4.0 wiring item); roster attendance patterns.
6. **Application 360** per §16: board + role-aware full page; chair cockpit per `FINAL_REVIEW_REDESIGN_PLAN.md`; readiness checklist presentation.
7. **Mentorship V1 consolidation** (existing plan) + Mentorship 360 with concrete states per §17.

Exit criteria: tab sets match §11–§17 exactly; no bare scores anywhere in the 360 system; every entity reference on touched pages is an EntityChip; advisor caseload live.

(Phases 4–5 scope is fixed in §25; their detailed plans are written at the end of Phase 3, informed by what consolidation reveals.)

---

## 29. Risks, Tradeoffs, Open Questions

### Risks

| Risk | Mitigation |
|---|---|
| **Scale of churn** (492 pages, 9 roles) destabilizes non-leadership users | Hard scope boundary (§2): student/instructor/parent navs untouched; leadership changes flag-gated; redirects for every moved route; `validate-nav.mjs` + smoke tests gate releases |
| **Index drift** (SearchDocument vs source tables) | Write-path upserts + nightly reconcile + "reindex entity" admin action; index stores only display fields, authorization stays in loaders |
| **Consolidation breaks muscle memory** for current officer users | Phased redirects with in-app "this moved" notices; keep old URLs as deep links into new tabs for a full phase |
| **Primitive adoption stalls** and the portal ends up with N+1 styles | Primitives ship *before* page work (Phase 2 ordering); lint guard; PR checklist item |
| **Partner data migration** (string contacts → PartnerContact) loses nuance | Keep legacy columns during transition; migration script logs unparseable rows for manual review |
| **Legacy `/admin/action-center` retirement** loses untracked data | One-time audit of its separate models before archive; export to CSV regardless |

### Tradeoffs accepted

- **Plain CSS stays** (no Tailwind migration): consistency via primitives + lint, not framework swap.
- **Initiatives remain config-registry** in this plan's horizon: version-controlled definitions + pure derivation are working well; a DB-backed editor is deferred.
- **Person roles stay on one User model** (no Student/Instructor table split): role-tailored loaders over the existing satellites are far cheaper than a schema split, and the satellites already exist.
- **No new polymorphic-link framework:** the `relatedEntityType`/`relatedEntityId` string pattern is kept and documented.

### Open questions (need product decisions)

1. **`/operations/projects` third tier:** keep Initiative → Project → Action, or collapse to Initiative → Workstream/Milestone → Action? Recommendation: collapse unless current users actively manage at the project tier.
2. **Parents in the People DB:** include parents/guardians as first-class directory rows (they are Users), or only as chips on student records? Recommendation: include, filtered out by default.
3. **Saved-query sharing model:** personal vs shared vs seeded only? Recommendation: seeded + personal in Phase 2; shared in Phase 4.
4. **`/operations/data-360` retirement timing:** fold immediately at Help Agent parity, or keep as power-user explorer for a phase? Recommendation: keep one phase, instrument usage, then decide.
5. **Partner agreements and documents:** is `FileUpload` + agreement link sufficient, or is e-signature/versioning needed? Assumed sufficient for V1.
6. **Knowledge area ambition:** consolidated resource library only, or a true internal knowledge base (playbooks, runbooks like `docs/brayden/` content surfaced in-portal)? Plan assumes library-first; KB is a separate future initiative.
7. **Mentorship "lane" for students** (`SHOW_STUDENT_MENTORSHIP_LANE`): does advising absorb student mentorship, or do both run? Needs program-owner input before Phase 3 item 7.

---

## 30. Validation Checklist

The redesign is done when every line below checks out, measured on the real portal:

**Navigation & access**

- [ ] Leadership nav shows ≤10 top-level items; every §2 executive question maps to exactly one of them.
- [ ] ⌘K opens the Help Agent from every page; "Find \<any person/partner/class\>" → preview → 360 in ≤3 interactions.
- [ ] Every legacy route from §20/§21 redirects (zero 404s from old bookmarks); `validate-nav.mjs` green including redirect map.
- [ ] No "Siri" anywhere in product copy or mockups.

**Master databases**

- [ ] Any person findable by name/email/role/program in one search from `/people`; row → preview → full 360 each one click.
- [ ] Any partner shows owner, last interaction, and next step on the table row itself; a partner without a next step appears in Needs Attention with that reason.
- [ ] Partner 360 answers all eleven §13 leadership questions without leaving the profile.
- [ ] A student without an advisor and an advisor with an overdue check-in both surface automatically (People flags, Home attention, Help Agent suggested query).

**360s & metrics**

- [ ] Each entity type's tabs match §11–§17; no empty tabs render.
- [ ] Zero bare scores: every level chip has visible reasons at the same altitude; "Health/Pulse/Engagement" appear nowhere as standalone labels.
- [ ] Class pages show the readiness checklist, not a number.
- [ ] Application review shows the 4-input checklist and the seven real decision actions.

**Work**

- [ ] One Work Hub; the three legacy command centers redirect to it or Home.
- [ ] A meeting decision converts to an action in one click, and the action shows its source meeting (already true — preserved through consolidation).
- [ ] Every work item row carries a working entity chip back to its person/partner/class/initiative.

**Polish**

- [ ] All leadership pages use PageHeader/Card/StatCard/DataTableShell/Tabs/Drawer/EmptyState/StatusBadge primitives; spacing/radius/typography per standards doc; lint guard active.
- [ ] Empty and loading states on every list page.
- [ ] Side-by-side with the mockups, the real People, Partners, Work, and Home pages read at the same level of calm and hierarchy — with less, not more, on each screen.

**Workflows (timed, with a real leadership user)**

- [ ] "What needs my attention today?" — answered on Home in <10 seconds, every item carrying a why and a next step.
- [ ] "Who owns Camp Hudson and what's next?" — <15 seconds via Help Agent.
- [ ] "Which applicants are waiting on a decision?" — one suggested query, one click to the queue.
- [ ] "What did last week's meetings produce?" — Work Hub meetings tab shows decisions/follow-ups/actions per meeting.
