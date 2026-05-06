# Summer Workshop Instructor Pathway — Architecture & Planning

**Status:** Draft (urgent MVP)
**Owner:** Architecture
**Branch:** `claude/plan-workshop-instructor-1WCuD`

---

## 1. Executive Summary

The **Summer Workshop Instructor** is a short-term instructor who runs short, focused workshops inside camps. They do not build full curriculum at this stage — they execute pre-scoped workshop sessions and bring strong classroom energy, clarity, and engagement. Some will later be promoted into the full Instructor role.

This pathway is being modeled as a **subtype of the existing Instructor role**, not as a new top-level role. The reasoning:

- Reviewers, admins, scoring, decisions, and audit trails are already mature for Instructor applications. Forking that system would double maintenance and split institutional knowledge.
- Subtype modeling lets us share the application pipeline, reviewer assignment, rating colors, ranking framework, decision history, and notes.
- Promotion from "summer workshop" to "standard" instructor becomes a status/subtype change instead of a cross-role migration that loses history.
- Filtering, dashboards, and reporting can be driven off a single applicant table with a `subtype` discriminator.

The MVP ships a lighter application form, a workshop-outline submission (replacing Lesson Design Studio), filterable admin visibility, and a promotion lever — without disturbing the existing standard Instructor flow.

---

## 2. Product Goals

1. **Support camp/workshop instructors.** Provide a clear, dedicated pathway for short-term workshop instructors who go into camps.
2. **Reduce onboarding friction.** Lighter application, no full curriculum capstone, faster path to a decision so we can staff camps in time.
3. **Preserve teaching quality.** Keep the same rating language, reviewer rigor, and final decision gate; the gate is strict even if the runway is shorter.
4. **Keep review/admin workflow unified.** One applicant board, one reviewer system, one scorecard model, filtered by subtype.
5. **Allow promotion to full Instructor.** A first-class promotion action that preserves history, ratings, and notes, and surfaces remaining requirements (e.g., LDS).

---

## 3. Non-Goals (explicitly out of scope right now)

- **No separate role system.** Do not create a `summer_workshop_instructor` role alongside `instructor`.
- **No separate applicant portal.** Reuse the existing application UI shell; only the form variant differs.
- **No required Lesson Design Studio capstone for summer workshop applicants.** Workshop outline replaces it at this stage.
- **No full mentorship / G&R implementation tied to this pathway.** Design data so it is forward-compatible, but do not build the feature now.
- **No workshop scheduling, camp placement, attendance tracking, or workshop performance dashboards** in MVP.
- **No bespoke reviewer queue, rating scale, or decision framework** for this subtype. Reuse existing.
- **No retroactive migration UX** beyond a default subtype backfill.

---

## 4. Data Model Plan

The plan extends existing applicant/instructor records with a small set of discriminator and outline fields. No new top-level role.

### 4.1 New / extended fields

On the applicant/instructor record (whatever model currently backs Instructor applications):

| Field | Type | Notes |
|---|---|---|
| `instructorSubtype` | enum: `standard` \| `summer_workshop` | Source of truth for subtype on the *instructor* side. Defaults to `standard` for legacy rows. |
| `applicationTrack` | enum: `standard_instructor` \| `summer_workshop_instructor` | Set at application submission. Drives form variant + admin filter. |
| `workshopOutline` | structured JSON (see 4.2) | Required for `summer_workshop_instructor` track. |
| `promotionEligibility` | structured JSON (see 4.3) | Tracks whether a summer workshop instructor is eligible for promotion. |
| `subtypeChangedAt` | timestamp | When subtype last changed (for audit). |
| `subtypeChangedBy` | userId | Who changed it. |

### 4.2 `workshopOutline` shape

```
{
  title: string,
  ageRange: string,
  durationMinutes: number,
  learningGoals: string[],   // 1–3 short bullets
  activityFlow: string,      // short paragraph or bullets
  materialsNeeded: string[],
  engagementHook: string,    // how they grab attention in first 5 min
  adaptationNotes: string    // how they handle mixed skill / energy levels
}
```

This is intentionally lightweight relative to a full LDS curriculum artifact.

### 4.3 `promotionEligibility` shape

```
{
  workshopsCompleted: number,
  reviewerNotesPositive: boolean,
  outstandingRequirements: string[],  // e.g. ["LDS capstone", "full training module 3"]
  flaggedForPromotion: boolean,
  flaggedAt: timestamp,
  flaggedBy: userId
}
```

### 4.4 Reuse — do **not** duplicate

The following existing systems are reused as-is:

- **Application status pipeline** (e.g., submitted → under review → interview → decision). Same states.
- **Reviewer assignment.** Same reviewers, same assignment logic.
- **Scorecard / rating categories.** Same categories, same color language.
- **Ranking & decision framework.** Same calculation, same thresholds.
- **Comments / notes.** Same model.
- **Audit/event log.** New event types added (see 4.5), but same log.

### 4.5 New audit events

- `application.track_selected`
- `application.subtype_changed`
- `workshop_outline.submitted`
- `workshop_outline.updated`
- `instructor.promotion_flagged`
- `instructor.promoted_to_standard`
- `instructor.demoted_to_summer_workshop` (rare, but supported for symmetry)

### 4.6 Migration / defaults

- Existing instructor records: backfill `instructorSubtype = "standard"` and `applicationTrack = "standard_instructor"`.
- No data is destroyed. No existing flow changes for legacy rows.
- Workshop outline is `null` for legacy rows and is *not* required for `standard` track.

### 4.7 Compatibility with current pipeline

Status values do not fork. A summer workshop applicant moves through the same statuses as a standard applicant. The subtype only changes:

- Which application form was rendered.
- Which review prompts appear.
- Which onboarding/training track they enter on accept.
- Whether the "Promote to Full Instructor" action is available.

---

## 5. Application Flow (Applicant Experience)

1. **Track selection.** On the application landing page, the applicant chooses one of:
   - *Standard Instructor* — design and teach full curriculum.
   - *Summer Workshop Instructor* — run short workshops at camps; possible path to full Instructor later.
   Each option has a one-paragraph plain-language description of expectations and time commitment.

2. **Shorter form.** Summer Workshop applicants see a reduced version of the Instructor application:
   - Same: contact info, eligibility, availability, background, references, basic teaching experience.
   - Reduced: long-form essays trimmed to short-answer prompts (~150 words instead of long essays).
   - Removed: full curriculum capstone / LDS submission.
   - Added: **Workshop Outline** (see §4.2) — a single structured submission describing one workshop they would run.

3. **Reduced writing burden.** Word/character caps on prompts. Optional fields are clearly marked optional.

4. **Expectation clarity.** Inline copy explains:
   - This is a short-term, camp-based teaching role.
   - The workshop outline is a sample, not a full curriculum.
   - Promotion to full Instructor is possible later and may require additional work (e.g., LDS).

5. **Submission.** On submit:
   - `applicationTrack = summer_workshop_instructor`
   - `instructorSubtype = summer_workshop` (provisional, finalized on accept)
   - Enters the same applicant pipeline at the same initial status as any other applicant.

---

## 6. Review Workflow (Admin / Reviewer Experience)

1. **One unified board.** Summer Workshop applicants appear on the existing applicant board / Kanban — not a separate page.

2. **Filter by applicant type.** A new filter chip / dropdown: *All / Standard / Summer Workshop*. Default = All.

3. **Subtype badge on cards.** Each applicant card shows a small badge:
   - `STD` for standard instructor (or no badge, if cleaner)
   - `SW` for summer workshop instructor
   Badge is visually distinct but does not override the rating color.

4. **Same rating colors and categories.** Reuse the YPP rating language end-to-end:
   - 🟣 **Purple** — exceptional
   - 🟢 **Green** — strong / ready
   - 🟡 **Yellow** — concern / needs review
   - 🔴 **Red** — not ready / high risk

5. **Same ranking & decision logic.** No new thresholds. Reviewer rubric is identical except for the prompts noted in §6.7 and §7.

6. **Workshop outline review section.** On the applicant detail view, a dedicated *Workshop Outline* tab/section renders the structured outline cleanly with the same fields a reviewer would expect to evaluate (clarity, age-appropriateness, engagement, feasibility).

7. **Soft warnings.** If `applicationTrack = summer_workshop_instructor` and the workshop outline is missing fields or is unusually short, surface a soft warning banner on the card and on the detail view (e.g., "Workshop outline is missing engagement hook"). Soft warning, not a hard block — reviewers stay in control.

8. **Audit trail for decisions.** All decision events, rating changes, subtype changes, and promotion actions are written to the existing audit log with the new event types from §4.5.

---

## 7. Interview Flow

Interview is mostly identical to the standard Instructor interview to keep reviewer cognitive load low.

**Same as standard:**
- Core eligibility / availability confirmation
- Communication, professionalism, energy, classroom presence
- Reference and background discussion
- Same scorecard categories and color rating language

**Workshop-specific additions (only for `summer_workshop_instructor`):**
- "Walk me through how you'd run a 45-minute workshop at a camp for 12 kids."
- "How do you grab attention in the first 5 minutes?"
- "How do you adapt when the group's energy or skill level isn't what you expected?"
- "How do you handle a disengaged or disruptive student in a short session?"

**Evaluation focus for this subtype:**
- Energy
- Clarity
- Classroom control
- Engagement
- Adaptability

**Explicitly not evaluated at interview stage:**
- Full curriculum design
- LDS-level lesson structure
- Long-arc pedagogy

---

## 8. Training / Onboarding Flow

A lighter onboarding track, branching off the existing Instructor onboarding system.

**Required for Summer Workshop Instructors (MVP):**
1. Core instructor expectations (shared module).
2. Safety & professionalism (shared module).
3. Workshop delivery basics (new short module): pacing a 30–60 min session, setup/teardown, materials handling.
4. Engagement tactics for camp settings (new short module): energy management, group dynamics, attention hooks.

**Not required at this stage:**
- Lesson Design Studio
- Full curriculum authoring training
- Long-form pedagogy modules

**Optional / forward-compatible:**
- A clearly labeled "Continue toward full Instructor" track that surfaces the additional modules + LDS for those interested in promotion.

Onboarding routing is driven off `instructorSubtype` after acceptance.

---

## 9. Promotion Path to Full Instructor

Promotion is a first-class admin action, not a re-application.

**Trigger.** Admin clicks **"Promote to Full Instructor"** on the instructor's profile.

**Pre-promotion checks (surfaced in a confirmation modal, not hard-blocking unless explicitly required):**
- Workshops completed (count).
- Reviewer notes from past workshops (positive / mixed / negative summary).
- Outstanding requirements list, e.g.:
  - LDS capstone not yet submitted.
  - Full instructor training modules not yet completed.

**Action:**
- `instructorSubtype` flips from `summer_workshop` → `standard`.
- `subtypeChangedAt` / `subtypeChangedBy` recorded.
- Audit event `instructor.promoted_to_standard` logged.
- Outstanding requirements (e.g., LDS) become *required follow-ups* tracked on the standard Instructor profile. Promotion does not skip them — it sequences them.

**History preservation:**
- All ratings, comments, scorecards, interview notes, audit log entries from the summer workshop phase are preserved on the same record.
- The detail view shows a clear timeline: applied as Summer Workshop → accepted → ran N workshops → promoted to Standard on DATE.

**Reverse path.** Demotion is supported by the same mechanism (subtype change) for symmetry, but is not exposed prominently in MVP UI.

---

## 10. Admin UX Requirements

Concrete UI changes:

1. **Application type selector** on the public application landing page — two clearly-labeled cards.
2. **Subtype badge** on every applicant card on the admin board.
3. **Filter** on the Kanban / admin board: *All / Standard / Summer Workshop*. Persist filter per user.
4. **Workshop Outline tab/section** on the applicant detail view, only rendered for `summer_workshop_instructor` track.
5. **Reuse the existing scorecard component** — no fork. New optional prompt fields appear conditionally.
6. **Promote to Full Instructor button** on the instructor profile, visible only when `instructorSubtype = summer_workshop`. Opens a confirmation modal with checks from §9.
7. **Decision history / audit trail** visible on the detail page, including subtype changes and promotion events.
8. **Empty states & help text:**
   - On the track selector: short paragraph per option.
   - On the workshop outline form: inline guidance and example.
   - On the admin filter: tooltip explaining what each subtype is.
   - On the promotion modal: clear copy about what promotion does and does not waive.

---

## 11. MVP Scope (must ship urgently)

1. **Application track selection** UI on the applicant entry point.
2. **Summer workshop application form variant** — shorter, with the workshop outline section.
3. **`workshopOutline` field** on the data model and applicant detail view.
4. **`instructorSubtype` + `applicationTrack` discriminators** + migration backfill for existing rows.
5. **Admin board filter + subtype badge** on cards.
6. **Reviewer visibility into the workshop outline** (read-only render) on the applicant detail view.
7. **Workshop-specific interview prompts** appended to the existing interview template when subtype is summer workshop.
8. **Promotion-ready data model** (fields exist + audit events defined). Promotion *button* is part of MVP; the deep "outstanding requirements" enforcement can be a soft list initially.
9. **Lighter onboarding route** based on `instructorSubtype`. At minimum, gate the LDS requirement off for summer workshop subtype.

---

## 12. Later Scope (intentionally deferred)

- Mentorship integration (G&R / mentor pairing) for summer workshop instructors.
- Workshop scheduling and calendar.
- Camp placement and logistics.
- Attendance tracking.
- Post-workshop performance reports / surveys.
- Full G&R refresh tailored for summer instructors.
- Bulk promotion tools.
- Analytics dashboards split by subtype.
- Reviewer-facing rubric variations beyond the workshop-specific prompts.

---

## 13. Edge Cases

| Case | Handling |
|---|---|
| Applicant accidentally picks the wrong track | Admin can change `applicationTrack` and `instructorSubtype` on the detail view (gated by permission). Audit event written. Form data is preserved; missing workshop outline triggers soft warning, not deletion. |
| Summer applicant wants to become a full instructor mid-pipeline | Admin can switch track. If switched to standard, the standard pipeline's LDS requirement re-engages as a follow-up. |
| Full instructor wants to also run summer workshops | Subtype is single-valued in MVP. A standard instructor running summer workshops is treated as a scheduling/assignment concern, not a subtype change. (Re-evaluate post-MVP if signal grows.) |
| Admin changes subtype after submission | Allowed, audited, soft-confirms with a modal explaining downstream effects (form variant, onboarding track, promotion button visibility). |
| Applicant has incomplete workshop outline | Soft warning on card and detail view. Reviewer may still proceed. Decision can be made; outline can be requested via existing comments/messages. |
| Existing applications need migration | Backfill: `instructorSubtype = standard`, `applicationTrack = standard_instructor`, `workshopOutline = null`. No status changes, no notification spam. |
| Reviewer applies summer-only prompts to a standard applicant | Prompts are conditionally rendered by subtype; reviewer cannot see summer-only fields on a standard applicant. |
| Two admins promote simultaneously | Standard optimistic locking on the record; second action sees "already promoted." |

---

## 14. Implementation Phases

**Phase 1 — Spec & Data Model**
- Lock this document.
- Add `instructorSubtype`, `applicationTrack`, `workshopOutline`, `promotionEligibility`, and audit event types to the schema.
- Backfill defaults for existing rows.

**Phase 2 — Application Form**
- Track selector on landing page.
- Summer workshop form variant (shorter prompts, workshop outline section).
- Wire `applicationTrack` on submission.

**Phase 3 — Admin Review & Filtering**
- Subtype badge on applicant cards.
- Filter on admin board.
- Workshop Outline tab on applicant detail view.
- Soft warnings for missing/weak outline fields.

**Phase 4 — Interview & Review Prompts**
- Append workshop-specific interview prompts conditional on subtype.
- Confirm scorecard reuse renders cleanly with the new prompts.

**Phase 5 — Promotion Pathway**
- "Promote to Full Instructor" action + confirmation modal.
- Outstanding requirements list rendering.
- Audit events on promotion / subtype change.
- Onboarding route branching off subtype (lighter track for summer workshop).

**Phase 6 — QA & Regression**
- Verify standard Instructor flow is untouched (regression).
- Verify summer workshop flow end-to-end.
- Verify migration backfill on a copy of production data.
- Verify audit trail completeness.
- Verify permission gates for subtype change and promotion.

---

## 15. Acceptance Criteria

The feature is considered done when **all** of the following are true:

1. An applicant can land on the application page, see two clearly-labeled tracks, and pick *Summer Workshop Instructor*.
2. The summer workshop application form is shorter than the standard form, contains a structured workshop outline section, and successfully submits.
3. Submitted summer workshop applications appear on the existing admin board alongside standard applications, with a visible subtype badge.
4. Admins can filter the board by subtype.
5. Reviewers can view the workshop outline on the applicant detail page in a clean, structured layout.
6. Reviewers use the same rating colors (purple/green/yellow/red), same categories, and same ranking/decision logic.
7. The interview flow renders workshop-specific prompts only for summer workshop applicants.
8. On acceptance, a summer workshop instructor enters a lighter onboarding track and is **not** required to complete LDS at this stage.
9. An admin can click "Promote to Full Instructor" on a summer workshop instructor's profile; subtype flips to `standard`, history is preserved, audit event is logged, and outstanding requirements (e.g., LDS) are surfaced as follow-ups.
10. Existing standard Instructor applications, reviewers, scorecards, and decisions continue to work with no behavior change.
11. Existing instructor records are backfilled with `instructorSubtype = standard` without data loss.
12. All new state changes (track selection, subtype change, outline submission, promotion) write to the audit log.

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Overbuilding** — scope creeps into scheduling, mentorship, performance reports | Slips MVP, distracts from urgency | Hard non-goals in §3. Re-read before each phase. Defer anything not in §11. |
| **Role duplication** — engineer instinct to make a separate role/portal | Doubles maintenance, splits audit & reviewer logic | This document explicitly mandates subtype, not role. Code review checklist item. |
| **Confusing applicants** at track selection | Wrong track picked, low-quality applications | Strong inline copy, clear visual difference between cards, easy admin override. |
| **Weak review signals** because the application is shorter | Bad hires slip through | Workshop outline + workshop-specific interview prompts + same final rating gate (purple/green/yellow/red). The runway is shorter; the gate is not. |
| **Promotion path ambiguity** — unclear what's required to become full Instructor | Inconsistent decisions, applicant frustration | `outstandingRequirements` list rendered in the promotion modal. LDS explicitly named. Audit log captures who promoted and when. |
| **Migration regression** — legacy applicants behave oddly after backfill | Trust hit on existing pipeline | Backfill is additive only. Phase 6 explicitly regression-tests the standard flow. |
| **Reviewer cognitive load** — too many subtype-specific UI states | Slower reviews | Keep subtype-specific UI to: badge, filter, outline tab, conditional prompts. Nothing else changes for reviewers. |
| **Subtype drift** — over time, summer workshop accumulates its own bespoke fields | Quietly forks into a parallel system | Periodic review: any new field should justify why it cannot live on the shared instructor record. |

---

## Recommended MVP Build Order

The engineering agent should implement in exactly this order:

1. **Schema + migration.** Add `instructorSubtype`, `applicationTrack`, `workshopOutline`, `promotionEligibility`, audit event types. Backfill existing rows with `standard` defaults.
2. **Track selector page.** Two-card chooser at the application entry point with clear copy.
3. **Summer workshop application form variant.** Shorter prompts + structured workshop outline section. Wire `applicationTrack` on submit.
4. **Subtype badge + admin board filter.** Visible discrimination on the existing board, no new board.
5. **Workshop Outline tab on applicant detail view.** Read-only structured render. Soft warnings for missing fields.
6. **Conditional workshop-specific interview prompts.** Append to existing interview template when subtype is summer workshop.
7. **Onboarding route branching.** Gate LDS off for summer workshop subtype; route to lighter modules.
8. **Promote to Full Instructor action.** Button on profile, confirmation modal, subtype flip, audit events, outstanding requirements list.
9. **Regression pass.** Verify the standard Instructor flow is unchanged end-to-end. Verify the summer workshop flow end-to-end. Verify backfill on a production-like dataset.

Ship after step 9. Everything in §12 is later scope.
