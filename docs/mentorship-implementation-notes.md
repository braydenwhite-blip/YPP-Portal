# Mentorship Simplification — Implementation Notes

Working notes captured while implementing the mentorship simplification pass.
Companion to `docs/instructor-mentorship-audit.md` and
`docs/admin-mentorship-audit.md`. This file records the decisions taken and
the small commits used to land them so a future reviewer can trace why a
particular change exists.

## Scope of this pass

The audit concluded that the mentor and mentee dashboards are mostly fine
already. The user-visible problems are:

1. Nav bloat — ~14 mentorship-related entries, two of them labelled "Reviews"
   meaning different things.
2. Duplicate URL universes — `/mentorship/*` and `/mentorship-program/*` both
   in active use; `/mentorship-program` itself redirects to `/mentorship` but
   children (`/reviews`, `/chair`, `/schedule`) are real pages.
3. No obvious mentor-facing way to manage a mentee's G&R. The mentor's only
   path to influence goals is via the monthly review form's plan-of-action.
4. Several unfinished or rarely-used features are still surfaced in the top
   nav (AI coaching sidebar, list view of mentees, unlock sections).

This pass does **not** rebuild dashboards, change the schema, or add a full
G&R editor. It adds a small mentor-facing G&R workspace, consolidates routes,
and prunes nav.

## Route decisions

| Concern | Canonical route | Other routes |
|---|---|---|
| Mentor hub | `/mentorship` | — |
| Mentor's mentees list | `/mentorship/mentees` | — |
| Mentor's view of a mentee | `/mentorship/mentees/[id]` | — |
| **Mentor's view of a mentee's G&R** (new) | `/mentorship/mentees/[id]/gr` | — |
| Mentor's monthly review form | `/mentorship/reviews/[menteeId]` *(unchanged)* | — |
| Chair approval queue | `/mentorship/chair` *(future)* / `/mentorship/reviews` *(today)* | `/mentorship-program/chair` redirects to it |
| Mentor schedule | **`/mentorship/schedule`** | `/mentorship-program/schedule` and `/mentorship/calendar` redirect to it |
| Awards | `/mentorship-program/awards` *(unchanged for now)* | — |
| Mentee monthly reflection | `/mentorship-program/reviews` *(unchanged for now)* | — |
| Mentee's own G&R | `/my-program/gr` *(unchanged)* | — |
| Admin oversight | `/admin/mentorship-program` *(unchanged)* | — |

Per open question #3, `/mentorship/schedule` is the canonical schedule route.
The richer `MentorAvailabilityRule` implementation lives at
`/mentorship-program/schedule` today; this pass redirects both the legacy
`/mentorship-program/schedule` and `/mentorship/calendar` to the new
canonical path, but does **not** rewrite the page contents — only the URL.

## Mentor-facing G&R page (`/mentorship/mentees/[id]/gr`)

Distinct from the mentee's own `/my-program/gr`:

- Frames the document as **"{mentee name}'s G&R"** with mentor pairing context
  in the header (mentee role, mentor pairing status, cycle stage).
- 90-day goals come first.
- Annual and multi-year goals appear lower and may be collapsed by default.
- Includes a short "Latest review context" panel if a released review exists.
- Empty state when no `GRDocument` exists: a single sentence + a single CTA.
- Primary CTAs: **Edit G&R** (links to existing edit surface if one exists,
  otherwise rendered disabled with a `TODO` helper) and **Back to mentee**.

Access control lives in `lib/mentorship-access.ts` already:
`hasMentorshipMenteeAccess()` permits assigned mentor, chair, support-circle
member, admin, chapter president, and the mentee themselves. The new page
calls this and `notFound()`s on failure.

## Mentee detail page action bar

Header now exposes three buttons in this order:

1. **Run Check-In** — primary when stage is `KICKOFF_PENDING`,
   `REFLECTION_DUE`, or no recent session in current cycle.
2. **Write Review** — primary when stage is `READY_FOR_REVIEW` (mentee has
   submitted their reflection and the cycle is waiting on the mentor).
3. **Open G&R** — primary when cycle is `FEEDBACK_COMPLETED`, or when no
   active G&R goals exist yet; otherwise rendered secondary.

The page itself does not get a full restructure in this pass — only the
header bar is added. Existing sections stay where they are.

## Nav cleanup

Removed / consolidated entries in `lib/navigation/catalog.ts`:

- Drop `/mentorship-program` (it was only a redirect to `/mentorship`).
- Drop `/my-mentor` (also a redirect).
- Drop `/mentorship/calendar` (redirect to `/mentorship/schedule`).
- Rename `/mentorship/reviews` label from "Reviews" → "Chair Queue".
- Drop the duplicate `/mentorship-program/reviews` mentor-side entry (the
  page itself stays — it's the mentee's reflection submission surface, and
  remains linked from the mentee dashboard via "Submit Reflection").
- Rename `/my-program/gr` label "My G&R" → "My Goals".
- Drop `/mentorship/unlock-sections` from top-level nav (route stays;
  contextually surfaced from the mentee detail page).
- Rename `/mentor/incubator` label "Mentor Workspace" → "Project Mentoring"
  and move out of the Mentorship group.

## What is intentionally not in this pass

- No `Mentorship` / `GRDocument` schema changes.
- No new mentor-side G&R editor (the new page is read-only or redirects to
  whatever editor already exists).
- No merge of `/admin/mentorship` and `/admin/mentorship-program`.
- No rewrite of `/mentorship/mentees/[id]` body — only the header bar is new.
- No AI Coaching Sidebar work (feature stays as-is; gating happens in a
  follow-up pass).

## Commit log for this pass

1. **Implementation notes** — this doc.
2. **Mentor G&R page** — new route `/mentorship/mentees/[id]/gr` with access
   control and a readable mentor-facing layout.
3. **Mentee detail action bar** — add header buttons; "Open G&R" links to
   the new page.
4. **Canonical schedule** — `/mentorship/schedule` becomes canonical;
   `/mentorship-program/schedule` and `/mentorship/calendar` redirect.
5. **Nav cleanup** — labels and removals in `lib/navigation/catalog.ts`.
6. **Typecheck / build / lint** — fix anything the above broke.
