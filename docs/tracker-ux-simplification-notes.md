# Tracker UX Simplification Notes

**Branch:** `codex/tracker-ux-simplification`

**Intent:** make the existing tracker power feel obvious, calm, and usable. This pass did not add a large feature set; it reduced visible choices, renamed confusing user-facing labels, moved advanced controls behind disclosure, and made `/work` the simple place to start.

## What was overwhelming before

- `/work` opened with many equal-weight stats, tabs, filters, and tracker concepts before telling a leader what to do first.
- `/actions/all` exposed filters, presets, saved views, legacy inbox framing, and the full database table language at the same time.
- The action tab bar made advanced tools such as Classes, Responsibility Map, and People Dashboard feel as important as everyday work.
- `/actions/meetings` mixed meeting status filters, summary metrics, follow-up queues, decisions, actions, and pulse-style area summaries in one first view.
- Meeting details made the follow-up/action relationship available, but the most important mental model was not first: meeting -> follow-up -> action.
- Home and Help Agent still used some older labels and routes that pointed people toward broad tracker/admin surfaces instead of simple work views.

## Routes audited

`/work` · `/actions` · `/actions/all` · `/actions/new` · `/actions/[id]` · `/actions/[id]/edit` · `/actions/meetings` · `/actions/meetings/[id]` · `/actions/all/classes` · `/actions/all/classes/[id]` · `/actions/people` · `/actions/responsibility` · `/actions/completion-report` · `/admin/action-center` · `/operations` · `/operations/command-center` · `/operations/data-360` · `/operations/initiatives` · `/operations/initiatives/[initiativeId]` · `/operations/projects/[projectId]` · `/operations/weekly-execution` · Leadership Home · Help Agent suggestions · Entity Action Panel · Meeting Follow-Up Pack · partner/person preview quick actions.

## Simplifications made

- Added a shared `TrackerStartCard` primitive in `components/ui-v2/` for the calm tracker pattern: short label, plain recommendation, one next action, and concrete summary facts.
- Changed visible tracker language from internal/admin wording to action-oriented copy: "Create action", "Log meeting", "Needs action", "Needs owner", "Follow-ups from this meeting", "Decisions needing actions", "Created from meeting", and "Linked work".
- Moved advanced action and meeting tools behind disclosure controls instead of making every option visible by default.
- Preserved advanced pages and editing tools, but bannered or labeled them as advanced/legacy starts where appropriate.

## Work improvements

- `/work` now defaults to the Needs attention experience, not the full database-style All view.
- Header is now simply `Work` with the purpose statement: "Actions, meeting follow-ups, blockers, and next steps across YPP."
- Primary action is `Create action`; secondary action is `Log meeting`.
- A new Start here card recommends the next best queue and shows only concrete facts: needs attention, your work, blocked, upcoming meetings.
- The main view switcher is simplified to Needs attention, My work, Actions, Meetings, Initiatives, All.
- Status filters now live under `More filters`.
- Flag links such as `/work?flag=blocked` and `/work?flag=overdue` show the filtered work list instead of being hidden behind the default attention summary.
- Work rows now show the essentials only: work, owner/due, status, next step, and one action link. Related entity/source information is still present, but quieter.

## Action tracker improvements

- Action tabs now emphasize Work, My actions, All actions, and Meetings. Classes, Responsibility Map, and People Dashboard moved under `More action tools`.
- `/actions/all` now presents itself as an advanced action tool and points most leaders to Work first.
- Filters, presets, and saved views on `/actions/all` are collapsed under `Advanced filters`.
- The triage module is now called `Needs action` instead of `Operational inbox`.
- Action list cards show a clear next move when no prompt is supplied.
- Action detail copy now uses simpler labels for provenance and linked records.
- Create/edit/class/report action subroutes now use the simplified tab bar.

## Meeting tracker improvements

- Meeting index title is `Meetings`; the primary action is `Log meeting`.
- The start module recommends reviewing overdue follow-ups, open follow-ups, or upcoming meetings.
- Meeting views are now simple: Upcoming, Needs follow-up, Recent, All.
- Search, owner/status/category filters, overdue toggles, and open-action filters moved under `More filters`.
- Sidebar labels now describe concrete work: Follow-ups still open, Overdue actions from meetings, Recent decisions, Follow-ups by area.
- Meeting detail now surfaces `Follow-ups and actions` before lower-priority sections.
- Meeting detail sections are ordered around the mental model: summary/header, follow-ups/actions, actions created, decisions, agenda, notes.

## Meeting to action flow

- Follow-up cards now say whether a follow-up is still open or converted to action.
- Decisions that are not yet tracked are labeled `Decision needs an action`.
- Follow-up conversion uses `Create action` wording.
- The Meeting Follow-Up Pack is now `Follow-ups from this meeting` and explains that actions keep the owner, due date, and Work visibility clear.
- Meeting detail makes it easier to see which actions already exist and where unresolved follow-ups remain.

## Route consolidation and banners

- `/actions/all`, `/actions/meetings`, `/actions/people`, and `/actions/responsibility` keep their specialized tools but now steer leaders toward `/work` as the simple starting point.
- `/admin/action-center`, `/operations/command-center`, `/operations/data-360`, and `/operations/initiatives` banners now point to Work with simpler copy.
- `/operations` now labels the work entry as `Work`, not `Work Hub`.
- The legacy action tab component also says `Work` if any older subroute still renders it.

## Help Agent and Home routing

- Help Agent suggestions now include clear work shortcuts: What needs attention, My work, Overdue actions, Blocked work, Upcoming meetings, Meetings needing follow-up, and Decisions needing actions.
- Help Agent work shortcuts route to simple `/work` views and flags, including `/work?view=needs-attention`, `/work?view=my`, `/work?flag=blocked`, and `/work?view=meetings`.
- Leadership Home routes action/meeting cards into simple Work views and uses `Open` / `Create action` labels instead of old tracker wording.

## Tracker pattern recommendations

- Use this pattern for future tracker-style pages: simple header -> Start here card -> one primary CTA -> simple segmented views -> list/table/card -> row preview -> detail only when needed.
- Keep advanced filters behind disclosure unless they are part of the top two reasons a leader opened the page.
- Every row/card should name the next step when possible.
- Prefer concrete states over broad metrics: overdue, blocked, missing owner, no due date, follow-up open, decision needs action.
- Do not show more than one primary action in a page header.

## CSS

- No `globals.css` selectors were removed in this pass.
- Freeze baseline remains `10,731` lines, as enforced by `scripts/check-globals-css-freeze.mjs`.

## Validation results

- `npx prisma generate` was run first because the local generated Prisma client was stale for the existing `SearchDocument.eventAt` schema field.
- `npm run typecheck` passed.
- `npx vitest run tests/components/work-hub-table.test.tsx tests/components/action-inbox-groups.test.tsx tests/lib/help-agent-suggestions.test.ts tests/lib/work-hub-rows.test.ts tests/lib/help-agent-search.test.ts` passed: 47 tests.
- `npx vitest run tests/lib/people-strategy-meetings-actions.test.ts tests/lib/people-strategy-meetings-status.test.ts tests/lib/people-strategy-meetings-queries.test.ts tests/components/weekly-execution.test.tsx` passed: 44 tests.
- `git diff --name-only -z -- '*.ts' '*.tsx' | xargs -0 npx eslint --max-warnings=0` passed.
- `npm run css:freeze-check` passed at `10,731` lines.
- `npm run nav:check` passed: 203 catalog routes, 9 roles checked.
- `npm run build` passed.
- `git diff --check` passed.
- No Playwright, screenshots, browser smoke, DB smoke, or auth smoke were run by request.

## Remaining confusing areas

- Several legacy action/operations pages still use older visual primitives and inline styles even though the navigation/copy is simpler.
- `/actions/all` remains powerful and dense by design; this pass hides complexity but does not rebuild the full list page.
- Meeting drawer and meeting detail internals are still legacy-styled; a later pass should rebuild them on shared ui-v2 primitives.
- Some historical docs still use older names such as Work Hub and Decisions without actions because they describe previous phases.

## Recommended next phase

Rebuild the meeting tracker and `/actions/all` on a shared `TrackerShell`/`TrackerRow`/`TrackerPreview` family, then remove any dead legacy tracker CSS after grep-confirming no live consumers.
