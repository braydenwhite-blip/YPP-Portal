# Action + Meetings 360 Operating System

## What This Is

The Action + Meetings 360 view is the leadership operating page for YPP work. It lives at `/operations/command-center` and combines meetings, decisions, loose ends, owners, due dates, blocked work, and recent completions into one weekly command view.

Since the operations simplification pass (see [Operations OS Simplification](./operations-os-simplification.md)), the Command Center renders from the ONE shared operations summary (`lib/people-strategy/operations-summary.ts`) with the ONE shared card (`components/people-strategy/operations-item-card.tsx`), structured as: Top snapshot → Needs attention → This week → Recently decided → Strategic initiatives → area health + recent timeline.

The basic operating rule is:

Meetings create decisions. Decisions create actions. The command center shows what needs follow-up before it gets lost.

## Problem It Solves

The old operating experience spread context across action lists, meeting pages, weekly review, and detail pages. Leaders could see pieces of the truth, but had to click around to answer simple questions:

- What happened?
- What was decided?
- Who owns the next step?
- When is it due?
- What meeting or context created it?
- What is blocked or overdue?
- What should leadership focus on this week?

The 360 view reduces that clicking by showing the operational context inline on the command center.

## Relationship To Weekly Execution OS

The Command Center and Weekly Execution OS now share the same operating spine.

- `/operations/command-center` shows the current operating picture.
- `/operations/weekly-execution` turns that picture into the weekly officer agenda, meeting capture flow, loose-end inbox, communication queue, and recap draft.
- `/operations/initiatives` adds the strategic layer above actions and meetings.

The Command Center links leaders into the Weekly Execution OS when it is time to run the weekly meeting. The Weekly Execution OS links back to the Command Center when leaders need the broader operating picture.

## How Meetings Connect To Actions

Meetings can create three kinds of operational output:

- Decisions: a call leadership made.
- Follow-ups: a commitment or loose end from the meeting.
- Linked actions: tracked Action Items created from or attached to the meeting.

Action cards now show source meeting context when available. Meeting cards show key decisions, open follow-ups, actions already created, and follow-ups that still need to become tracked actions.

Action cards also show related initiative context when the action is tied to a strategic initiative. This keeps actions from becoming disconnected tasks without a larger reason.

## Unresolved Follow-Ups

The “Unresolved Meeting Follow-Ups” section shows meeting follow-ups that are still open and do not have a linked Action Item.

Use “Create action” when the follow-up needs an owner, due date, and tracked accountability. The action form is prefilled with:

- Source meeting
- Follow-up text
- Suggested owner, when the meeting captured one
- Suggested due date, when the follow-up has one
- Related YPP entity, when the meeting was linked to one

This keeps ambiguous meeting output, such as curriculum direction questions or partner uncertainty, from disappearing after the meeting ends.

## Strategic Initiative Context

Initiatives are the big goals. Meetings are where decisions happen. Actions are what moves the initiatives forward.

When a meeting output becomes an action, the conversion path preserves the likely strategic initiative or project when the meeting matches one. Manual actions can also choose a Related initiative on `/actions/new`.

This means an action like "Clarify Lily STEM curriculum direction" can roll up to "Camp / STEM Curriculum Launch" instead of living as a random task.

See [Weekly Execution OS](./weekly-execution-os.md) and [Strategic Initiatives OS](./strategic-initiatives-os.md) for the weekly loop and initiative layer.

## Communication Needed

The Weekly Execution OS adds a lightweight communication-needed layer over action and meeting output. It does not send email or Slack messages. It only identifies work that likely needs outreach and suggests a short message.

Examples include:

- Message an instructor about curriculum direction
- Email an applicant about next steps
- Follow up with a partner
- Ask a mentor for an update
- Send the weekly officer recap

## What Future Work Remains

### Applicant Review 360

Future applicant review pages should show each goal in one view with applicant self-reflection, supervisor or interviewer feedback, ratings, reviewer notes, and final recommendation. The goal is one integrated table instead of clicking across multiple pages.

### Mentee / Student Progress 360

Future mentee or student pages should be simpler and less evaluative. Instructors should be able to submit progress notes for parents or advisors, including what the student learned, what they built, strengths, encouragement areas, and suggested next steps. This should not become a grading system.

### Instructor Growth / Relationship Lead

Future instructor growth should include a “Relationship Lead” path for trusted upper-level instructors who can help own relationships with partners, instructors in their subject, and instructors in their region.

## What This Pass Does Not Build

This pass does not add a new XP system, a full project management app, applicant review overhaul, student progress rewrite, or instructor growth rewrite. The focus is the operating spine: meetings, decisions, actions, owners, deadlines, and follow-up.
