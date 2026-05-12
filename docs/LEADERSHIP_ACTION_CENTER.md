# Leadership Action Center

Internal officer/staff operating dashboard that replaces the "Action Items
Tracker" spreadsheet and the hand-written weekly email update with a
structured database the portal can read off of.

**Route:** `/admin/action-center`
**Audience:** `ADMIN` and `STAFF` roles only. The feature is private; non-leadership users do not see it in nav and cannot hit the routes.

---

## What it replaces

- The spreadsheet columns: `Category`, `Item`, `Deadline`, `Primary Owners`,
  `Get Input From`, `Status`, `Needs Officer Discussion?`, `Officer
  Discussion Date`.
- The weekly leadership email update (color-coded by category, grouped by
  due date, with "Off track" and "Key meetings this week" sections).

Both are now derived from the same `LeadershipActionItem` table.

## Tabs

| Tab | URL | Purpose |
| --- | --- | --- |
| Overview | `/admin/action-center` | KPI strip (due today / this week / overdue / blocked / officer discussion / completed), grouped lists, upcoming meetings, category breakdown. |
| Tasks | `/admin/action-center/tasks` | Spreadsheet-style table with filters (category, status, owner, meeting, deadline bucket, officer flag, search). Click a row → drawer with quick-status buttons, edit form, comments, activity log. |
| Weekly Digest | `/admin/action-center/weekly` | Generates the weekly update from the live tracker. Three view modes: Preview (rich UI), HTML (paste-into-email), Plain text (editable). Has prev/this/next-week navigation. |
| Meetings | `/admin/action-center/meetings` | Officers / Marketing / Tech / etc. Each card opens a drawer with a suggested agenda generated from linked tasks, decisions-needed call-out, linked tasks list, standing notes, edit form. |
| Import | `/admin/action-center/import` | Paste rows from a spreadsheet or weekly email → auto-detect columns → preview with duplicate flagging → commit. |

A CSV export of every open task is available at
`/api/admin/action-center/export.csv` (linked from the dashboard header).

## Categories and the color key

The weekly email's color convention is preserved:

| Category | Enum value | Color |
| --- | --- | --- |
| Core Instruction | `INSTRUCTION` | Pink |
| Technology | `TECHNOLOGY` | Blue |
| Communication | `COMMUNICATION` | Green |
| Staff Management | `STAFF_MANAGEMENT` | Purple |

The styles live in `lib/leadership-action-center/constants.ts` and are
applied uniformly in the table, badges, dashboard, weekly digest preview,
and the HTML export of the digest.

## Operating week

"This week" means Monday 00:00 → Sunday 23:59 local time. Helpers in
`lib/leadership-action-center/dates.ts`:

- `startOfOperatingWeek(date)` / `endOfOperatingWeek(date)`
- `isOverdue(due, now)` / `isDueToday` / `isDueThisWeek`
- `parseDateInput` / `toDateInputValue` for round-tripping `<input type="date">`

A task can either have a hard `dueDate` (counts in due-today/this-week
buckets) or a soft `weekStart` (pinned to a week, but no deadline). The
weekly digest pulls items matching either.

## Schema

Four new models live at the bottom of `prisma/schema.prisma`:

- `LeadershipActionItem` — the main row, mirroring the spreadsheet columns
- `LeadershipMeeting` — recurring/one-off meeting (Officers, Marketing, Tech, …)
- `LeadershipActionItemInput` — many-to-many: users who need to give input
- `LeadershipActionItemUpdate` — comments + activity log entries

Enums: `LeadershipActionCategory`, `LeadershipActionStatus`,
`LeadershipActionPriority`, `LeadershipActionSource`,
`LeadershipMeetingKind`, `LeadershipActionUpdateKind`.

Migration: `prisma/migrations/20260512022003_leadership_action_center/migration.sql`.

## Permissions

- `ADMIN` — full read/write/delete + import.
- `STAFF` — full read/write on tasks; the Import page is gated on `canManage` (ADMIN only) so STAFF can't bulk-insert.
- All other roles get a `redirect("/")`.

Implementation is in `lib/leadership-action-center/authorization.ts`
(`getLeadershipSession`, `requireLeadershipManager`,
`requireLeadershipReader`).

## Importing from the spreadsheet / email

1. In Google Sheets / Excel, select the rows you want and copy.
2. On `/admin/action-center/import`, paste into the textarea (tab-delimited
   from Sheets, comma-delimited from CSV exports — both auto-detected).
3. The tool maps headers like `Item`, `Deadline`, `Primary Owners`, `Get
   Input From`, `Needs Officer Discussion?` automatically. Color names
   ("Pink", "Blue", "Green", "Purple") normalize to the right category.
4. Probable duplicates (matching `title + category + dueDate`) are
   pre-excluded; the admin can re-include any they want to overwrite.
5. Optionally set a default operating week and a meeting to attach all
   imported rows to.
6. Commit.

The import action records `source = SPREADSHEET | EMAIL | IMPORT` plus a
`sourceLabel` (row number) for traceability.

## Generating the weekly digest

The digest is **always** read off the live database — there is no
hand-written input. On `/admin/action-center/weekly` you can:

- Toggle between **Preview** (rich UI), **HTML** (paste-into-email
  rendering), and **Plain text** (editable, e.g. to add a personal note
  before sending).
- Use **Copy rich text** to put the HTML+plain-text payload on the
  clipboard so Gmail/Outlook keeps the formatting on paste.
- Navigate to **Previous week** / **Next week**.

Off-track items (overdue + blocked) and items flagged for officer
discussion are surfaced in their own call-out cards.

## Tests

Unit tests cover the parts that have logic worth defending against
regression. See `tests/lib/leadership-action-center/`:

- `dates.test.ts` — operating-week math, due-date predicates, date input
  parsing
- `import.test.ts` — TSV/CSV parsing, header alias detection, color-name
  normalization, duplicate detection
- `digest.test.ts` — section grouping, off-track + officer-discussion
  buckets, color key in text/HTML output

Run: `npx vitest run tests/lib/leadership-action-center`

## Follow-up ideas (not built)

- Reminders/notifications. Schema supports owner + input-needed users; a
  cron/Resend job could ping owners on due-today and overdue items.
- Slack export — same `buildWeeklyDigest()` output, posted to a webhook.
- AI parsing of the pasted weekly email into draft rows (currently the
  importer handles structured rows; freeform email parsing is out of scope).
- Mobile polish — the table is desktop-first; the dashboard and weekly
  digest already adapt.
