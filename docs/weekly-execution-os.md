# Weekly Execution OS

## What It Is

The Weekly Execution OS is the officer-meeting workspace for YPP leadership. It lives at `/operations/weekly-execution` and turns the existing Action Tracker, Meetings Tracker, and Strategic Initiatives layer into one weekly operating loop.

It answers four practical questions:

- What should we discuss before the meeting starts?
- What decisions, follow-ups, and action items are captured during the meeting?
- What loose ends still need owners, due dates, actions, or communication?
- What should go into the weekly recap?

## How It Differs From The Command Center

`/operations/command-center` is the current operating picture. It shows what is urgent, stuck, due, recently completed, and strategically important.

`/operations/weekly-execution` is the meeting workflow. It helps leadership run the week before, during, and after the officer meeting.

The two pages are meant to work together:

- Open the Command Center to understand the state of YPP.
- Open the Weekly Execution OS to run the weekly meeting, close loose ends, and produce the recap.

## Page Sections

The page has four main operating sections.

### Agenda

The agenda is derived from real portal data. It groups:

- Overdue actions
- Blocked actions
- Actions due this week
- Ownerless actions
- Decisions not yet converted into actions
- Meeting follow-ups not yet captured as actions
- Communication needed
- Strategic initiatives needing officer attention

Each item explains why it is on the agenda, who owns it, what meeting or entity it relates to, a suggested discussion question, and a suggested next action.

### Meeting Capture

The capture panel is a lightweight officer meeting notepad. It captures:

- Attendees
- Topics discussed
- Decisions made
- Follow-ups
- Action items
- Open questions
- Communication needed

Lines in the Action items box become tracked actions through the meeting follow-up conversion path. When the meeting has a related initiative focus, the created actions preserve that strategic context.

### Loose Ends

Loose Ends is the "do not leave the meeting with this unresolved" section. It surfaces:

- Decisions not converted into actions
- Follow-ups without owners
- Follow-ups without due dates
- Follow-ups not converted into actions
- Communication items that still need to be sent

### Weekly Recap

The recap generator produces a copyable draft for Slack or email. It includes:

- Completed actions this week
- New actions created
- Overdue actions
- Blocked actions
- Decisions needing action
- Upcoming meetings
- Initiative updates
- Top priorities for next week

It does not send email. It only prepares a leadership-ready draft.

## Meetings Become Actions

Meeting decisions and follow-ups can become Action Tracker items. The conversion path carries:

- Source meeting
- Meeting area
- Related entity, when present
- Suggested owner, when present
- Due date, when present
- Strategic initiative or project context, when the meeting matches one

This keeps meeting output from becoming invisible after the meeting ends.

## Communication Needed

Communication needed is a lightweight operational layer, not a messaging system.

The Weekly Execution OS groups items that likely require outreach, such as:

- Email an applicant
- Message an instructor
- Follow up with a partner
- Ask a mentor for an update
- Send a parent or student progress note
- Confirm a meeting time
- Send the officer recap

Each item shows who should be contacted, why, a suggested message, owner, and source link.

## Strategic Initiatives

Initiatives are included in the weekly agenda when they are blocked, at risk, ownerless, near a target date, missing a next step, or carrying overdue work, blocked work, unresolved follow-ups, or decisions needing action.

This keeps the weekly meeting from becoming only a tactical task review.

## Future Ideas

- Slack recap delivery
- Gmail draft creation
- AI-assisted action extraction from raw notes
- Parent and student progress summaries
- Applicant review 360
- Partner relationship dashboard

These are future ideas only. This pass builds the weekly operating loop, not a messaging system or a new project-management suite.
