import { startOfOperatingWeek } from "@/lib/leadership-action-center/dates";

import {
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "./action-queries";
import type { ActionViewer } from "./action-permissions";
import {
  buildAttentionQueue,
  buildPersonMomentum,
  buildTeamMomentum,
  buildWeeklyPulse,
  buildWinLog,
  topContributors,
  type AttentionEntry,
  type PersonMomentum,
  type TeamMomentum,
  type WeeklyPulse,
  type WinEntry,
} from "./command-center-selectors";
import { MOMENTUM_SEVERITY_ORDER } from "./momentum";

/**
 * People Strategy — Command Center data loader.
 *
 * The Command Center is the "People Strategy OS" landing for leadership: one
 * screen answering who owns what, what is slipping, who is doing great work,
 * and who needs support this week. It performs a SINGLE visibility-checked read
 * of the Action Tracker (reusing `listVisibleActionItems`) and composes the
 * pure Command Center selectors over it — no new source of truth, mirroring
 * the People Dashboard loader. Gating (ENABLE_ACTION_TRACKER) is enforced by
 * `listVisibleActionItems`, which returns [] when the flag is off.
 */

export interface CommandCenterData {
  weekStart: Date;
  pulse: WeeklyPulse;
  attention: AttentionEntry[];
  people: PersonMomentum[];
  /** People most in need of support (At Risk / Needs Support), worst first. */
  needsSupport: PersonMomentum[];
  /** People flagged as carrying a heavy open load. */
  overloaded: PersonMomentum[];
  teams: TeamMomentum[];
  wins: WinEntry[];
  contributors: ReturnType<typeof topContributors>;
  /** Total visible actions considered (for the "based on N actions" footnote). */
  consideredCount: number;
}

const SUPPORT_LABELS = new Set(["AT_RISK", "NEEDS_SUPPORT"]);

export async function loadCommandCenter(
  viewer: ActionViewer,
  now: Date = new Date()
): Promise<CommandCenterData> {
  const items: ActionItemWithRelations[] = await listVisibleActionItems(viewer);

  const pulse = buildWeeklyPulse(items, now);
  const attention = buildAttentionQueue(items, now);
  const people = buildPersonMomentum(items, now);
  const teams = buildTeamMomentum(items, now);
  const wins = buildWinLog(items, now);
  const contributors = topContributors(people);

  const needsSupport = people.filter((p) => SUPPORT_LABELS.has(p.momentum.label));
  const overloaded = people
    .filter((p) => p.overloaded)
    .sort((a, b) => b.momentum.factors.openCount - a.momentum.factors.openCount);

  return {
    weekStart: startOfOperatingWeek(now),
    pulse,
    attention,
    people,
    needsSupport,
    overloaded,
    teams,
    wins,
    contributors,
    consideredCount: items.length,
  };
}

export { MOMENTUM_SEVERITY_ORDER };
