# Strategic Initiatives OS

## What An Initiative Is

An initiative is one of YPP's major goals, programs, or leadership priorities. It is bigger than one action and bigger than one meeting.

Examples:

- Portal Simplification
- Instructor Growth
- Camp / STEM Curriculum Launch
- Partnership Growth
- Mentorship 3.0

The simple operating model is:

Initiatives are the big goals. Meetings are where decisions happen. Actions are what move initiatives forward. The Weekly Execution OS keeps the loop moving.

In the unified leadership OS (see [Operations OS Simplification](./operations-os-simplification.md)), `/operations/initiatives` is the primary strategic page. The deeper analytical views — Portfolio (`/operations/portfolio`), Strategic Projects (`/operations/projects`), and the Strategic Map (`/operations/strategic-map`) — are secondary and linked from the Initiatives page instead of the primary nav.

## How Initiatives Differ From Actions

An action is a concrete task with an owner and due date.

An initiative is the strategic container that explains why those tasks matter. It has a health read, owner, priority, milestones, risks, related meetings, related decisions, and recommended next moves.

Actions can optionally store a related initiative or project through the existing Action System 4.0 fields:

- `strategicInitiativeId`
- `strategicProjectId`

The action form now exposes a simple Related initiative field so manual actions do not lose strategic context.

## How Meetings Connect To Initiatives

Meetings can relate to initiatives in two ways:

- Inferred context: the meeting title, purpose, category, or related entity matches an initiative.
- Captured focus: the Weekly Execution OS meeting capture panel can set a related initiative focus, which is written into the meeting purpose and category.

When meeting decisions, agenda items, or follow-ups are converted into actions, the conversion path preserves the likely initiative or project context on the created action.

## Initiative Health

Initiative health is deterministic. It uses the existing strategic summary and health derivation logic, including:

- Initiative status
- Priority
- Owner clarity
- Overdue action count
- Blocked action count
- Unassigned action count
- Open follow-ups
- Decisions without actions
- Target date proximity
- Milestone progress
- Risk and momentum

The Weekly Execution OS adds focused helpers for:

- Initiatives needing attention
- Initiative agenda items
- Health reasons
- Weekly recap initiative updates

Health labels remain simple for leaders:

- Healthy
- Drifting
- At risk
- Critical
- Completed
- Archived

## Weekly Agenda

An initiative appears in the Weekly Execution OS when it needs leadership attention. Common reasons:

- It is blocked
- It is at risk
- It is a flagship priority
- It has overdue actions
- It has blocked actions
- It has unresolved meeting follow-ups
- It has decisions not converted into actions
- It has no clear owner
- It is near a target date
- It has recommended next moves

Each initiative agenda item shows:

- Initiative title
- Why it needs attention
- Owner
- Status
- Priority
- Current milestone
- Suggested leadership question
- Suggested next action

## Initiative Pages

`/operations/initiatives` is the portfolio dashboard.

`/operations/initiatives/[initiativeId]` is the initiative detail page. It includes:

- Executive summary
- Weekly operating view
- Current focus
- Open action counts
- Meetings and decisions
- Risks and blockers
- Communication needed
- Timeline
- Workstreams
- Roadmap
- Milestones
- Decision center
- Dependencies
- Operating reviews

The goal is that a leader should not have to click through ten pages to understand whether an initiative is healthy, stuck, drifting, or ready for the next push.

## Weekly Recap

The Weekly Execution OS recap includes initiative updates, such as:

- Initiative status
- Health reason
- Current milestone
- Suggested next step
- Blockers
- Decisions needing action

This keeps the weekly recap connected to strategic progress, not only task activity.

## How Leaders Should Use This Before Officer Meetings

1. Open `/operations/command-center` to understand the current operating picture.
2. Open `/operations/weekly-execution` to see which initiatives need attention this week.
3. Open any initiative detail page when a topic needs deeper context.
4. During the meeting, capture decisions and follow-ups.
5. Before leaving, check Loose Ends and Communication Needed.
6. Copy the Weekly Recap draft and send it through the normal team channel.

## Not Built In This Pass

This is not a full project-management suite. This pass does not build:

- Gantt charts
- Complex dependency graphs beyond existing strategic dependency views
- Slack or Gmail integration
- Budget or resource planning
- AI-generated strategy summaries
- A permissions overhaul
