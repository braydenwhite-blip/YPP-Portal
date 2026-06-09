# YPP Execution OS — Leadership Command Center & Weekly Review

The **Execution OS** is the leadership cockpit that sits *above* the Action
Tracker and Meetings Tracker. The previous pass made the portal feel
**connected** (meetings ↔ actions ↔ entities). This layer makes it feel
**alive**: a YPP leader opens it and immediately knows what is urgent, what is
stuck, what is due, which parts of the org are falling behind, which meetings
produced no action, which decisions never became execution, and what to review
first this week.

It introduces **no new task system and no new meeting system** — it derives
everything from the existing operational-context layer (`ActionItem`,
`OfficerMeeting`, the polymorphic related-entity link, and the four-step
operational health read). Gated behind `ENABLE_OPERATIONS_HUB` **and**
`ENABLE_ACTION_TRACKER`, officer-tier and above (`requireOfficer()`).

## Routes

| Route | What it is |
| --- | --- |
| `/operations/command-center` | **Leadership Command Center** — the weekly cockpit: "This week at YPP" stats, a ranked "Needs attention" queue, meetings needing follow-through, decisions to convert into action, operational health by area, critical/drifting entities, due/overdue actions, and a recently-resolved momentum strip. |
| `/operations/weekly-review` | **Weekly Leadership Review** — a guided, step-driven pass over the same digest (Triage → Meetings → Entity health → Decisions → Wrap-up). The active step lives in `?step=`. |

Both are reached from the existing **Operations Hub** (`/operations`) via header
CTAs, and link to each other and back to the Action / Meetings trackers.

## How it connects

```
meetings ──┐
actions  ──┼─▶ operational context (per entity / per area)
decisions ─┘        │
                    ▼
        Weekly Operational Digest  (pure, deterministic)
            ├─ urgency buckets (actions + meetings)
            ├─ entity rollup + health explanations
            ├─ operational health by area
            ├─ decisions needing action / meetings needing follow-through
            └─ recommended review order  ◀── the accountability engine
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 Command Center page     Weekly Review flow
```

- An **action** rolls up to an entity (its `relatedEntityType/Id`) and to an
  operating **area** (via `areaForRelatedEntityType`).
- A **meeting** carries its area (its `category`) and may link an entity; its
  **decisions** and **follow-ups** inherit that entity.
- The digest joins all of this **once** (no N+1) and derives the leadership read.

## Derivation layer (the brain)

All pure, deterministic, unit-tested (inject `now`) — `lib/people-strategy/`:

- **`operational-digest.ts`** — urgency buckets (`bucketActionsByUrgency`,
  `bucketMeetingsByUrgency`), the entity rollup (`deriveOperationalEntities`),
  operational health by area (`deriveAreaHealth`), the health explanation
  (`explainOperationalHealth`), the deterministic **recommended-review ranking**
  (`rankReviewItems` — the accountability engine), the triage lists
  (`deriveActionTriage`), and the full assembly (`deriveWeeklyOperationalDigest`).
- **`meeting-outcome.ts`** — `deriveMeetingOutcomeQuality`: classifies whether a
  meeting actually produced output — `strong` / `adequate` /
  `needs_follow_through` / `empty` / `stale`.
- **`action-prefill.ts`** — `buildActionPrefillFrom{Decision,Entity,Meeting}`,
  `buildMeetingPrefillFrom{Entity,OperationalIssue}`, the
  `actionPrefillToQuery` / `meetingPrefillToQuery` serializers, and deterministic
  **duplicate detection** (`findDuplicateActionCandidates`, `titleSimilarity`).
- **`operational-timeline.ts`** — `deriveOperationalTimeline`: one entity's
  meetings + actions (created/completed) + decisions + follow-ups as a single
  chronological story.

## Query layer

`lib/people-strategy/operational-digest-queries.ts` does the single batched read
and feeds the derivations. Respects action visibility via
`listVisibleActionItems`; the meeting reads are officer-gated at the page guard.

- `getWeeklyOperationalDigestForViewer(viewer)` — the whole-org digest.
- `getWeeklyReviewForViewer(viewer)` — the digest **plus** triage lists, from one
  load.
- `getOperationalDigestForArea(area, viewer)` — area-scoped digest + health
  explanation (backs future area command pages).
- `getOperationalDigestForEntity(type, id, viewer)` — enriches the existing
  entity context with a health explanation, recommended next action, stale
  status, and the operating counts.

Avoids N+1: actions in one query, window meetings in one ranged query, the
per-entity meeting history in one batched query (`getMeetingsForEntities`), and
entity labels in one query per type (`loadRelatedEntityLabels`).

## Decision → action follow-through

Meetings produce decisions, but decisions die if they never become execution.
`convertDecisionToAction(decisionId)` (in `meetings-actions.ts`) turns a logged
decision into a tracked `ActionItem` — prefilled from the decision (title,
rationale, source meeting, area, and the meeting's related entity) and
**idempotent** via the decision's `linkedActionId`. The meeting detail decision
cards expose a "Create action" button, a tracked-action link, and a "possible
existing actions from this meeting" duplicate hint. The Command Center decision
cards open a fully prefilled `/actions/new`.

## Meeting outcome quality

Every meeting card / detail surfaces a `MeetingOutcomeBadge` (Strong → Stale) so
leadership sees at a glance whether a meeting was useful. Upcoming meetings are
graded on preparedness, not output.

## Entity timeline

The Class, Instructor, Mentorship, Partner, and Person detail pages render a
compact `OperationalTimeline` below the `OperationalContextPanel`, derived for
free from the same context.

## Prefill flows

`/actions/new` consumes `title`, `desc`, `area`, `priority`, `type`,
`dueInDays`, and `fromMeeting` (existence-checked) in addition to
`relatedType`/`relatedId`; the action form threads `officerMeetingId` through on
create. The meeting drawer + Weekly Command Center prefill a meeting's
`title` / `purpose` / `area`. All of it is built by the shared, tested prefill
builders so the mapping has one source of truth.

## Known limitations (this pass)

- The Weekly Review is a **deterministic page**, not a persisted "review
  session" — the step lives in `?step=`. No database migration was added.
- `deriveAreaHealth` rolls up actions through their linked entity's area;
  department-only actions (no related entity) have no area, mirroring the
  existing area context loader.
- The digest's ranged meeting read looks back `DIGEST_MEETING_LOOKBACK_DAYS`
  (30); an unlinked meeting with a very old open follow-up outside that window is
  covered by the Operations Hub's officer-meeting follow-up rollup instead.
- `health_signal` is reserved in the timeline event union but not yet synthesized
  (no health history is stored).

## Known pre-existing red checks (not caused by this work)

These were red before this pass and are unrelated to it:

- **`nav:check`** — core-map sizes for INSTRUCTOR / HIRING_CHAIR /
  CHAPTER_PRESIDENT / MENTOR. This pass touches neither the nav catalog nor the
  core map.
- **`page-helper-coverage`** — many existing routes (`/officer-meetings`,
  `/people`, `/people/[id]`, `/preview`, `/qa/instructor-onboarding`, …) lack
  registry entries. The two new routes here **are** registered, so this pass does
  not worsen it.
- Unrelated training / journey / summer-workshop / instructor-review / onboarding
  test failures pre-date this work.
