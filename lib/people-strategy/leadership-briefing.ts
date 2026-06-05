import { formatMonthDay } from "@/lib/leadership-action-center/dates";

import type {
  AttentionEntry,
  PersonMomentum,
  WeeklyPulse,
  WinEntry,
} from "./command-center-selectors";
import { MOMENTUM_META } from "./momentum";

/**
 * People Strategy — Weekly Leadership Briefing (Phase 6).
 *
 * A PURE builder (no DB, no session, no React) that composes the Command Center
 * selectors leadership already sees — the weekly pulse, the attention queue,
 * who needs support, and this week's wins — into a single, copy-pasteable
 * markdown summary. It pastes cleanly into Slack, email, or Notion, and is the
 * shareable replacement for the UX the retired legacy weekly digest provided.
 *
 * Pure + deterministic so it can be unit-tested and reused by both the Command
 * Center "Copy briefing" control and (later) the weekly-digest cron.
 */

export interface LeadershipBriefingInput {
  weekStart: Date;
  pulse: WeeklyPulse;
  attention: AttentionEntry[];
  /** People most in need of support (At Risk / Needs Support), worst first. */
  needsSupport: PersonMomentum[];
  wins: WinEntry[];
  /** Total visible actions the briefing was composed from. */
  consideredCount: number;
}

/** How many rows to include per section so the briefing stays scannable. */
const ATTENTION_LIMIT = 5;
const SUPPORT_LIMIT = 5;
const WINS_LIMIT = 5;

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Build the briefing as a markdown string. `consideredCount === 0` yields a
 * short "nothing to report" note so the output is never an empty shell.
 */
export function buildLeadershipBriefing(input: LeadershipBriefingInput): string {
  const { weekStart, pulse, attention, needsSupport, wins, consideredCount } = input;

  const lines: string[] = [];
  lines.push("**People Strategy — Weekly Leadership Briefing**");
  lines.push(
    `Week of ${formatMonthDay(weekStart)} · based on ${pluralize(consideredCount, "action")}`
  );

  if (consideredCount === 0) {
    lines.push("");
    lines.push("_No visible actions yet — nothing to report this week._");
    return lines.join("\n");
  }

  // Pulse — one dense line of the numbers that matter.
  lines.push("");
  lines.push("**Pulse**");
  lines.push(
    [
      `${pulse.openTotal} open`,
      `${pulse.overdue} overdue`,
      `${pulse.dueThisWeek} due this week`,
      `${pulse.blocked} blocked`,
      `${pulse.flagged} flagged`,
      `${pulse.unowned} unowned`,
      `${pulse.completedThisWeek} completed this week`,
    ].join(" · ")
  );

  // Needs attention — the top of the attention queue.
  lines.push("");
  lines.push(`**Needs attention** (${attention.length})`);
  if (attention.length === 0) {
    lines.push("- Nothing flagged — everything visible is on track. 🎉");
  } else {
    for (const a of attention.slice(0, ATTENTION_LIMIT)) {
      const dept = a.departmentName ? ` · ${a.departmentName}` : "";
      lines.push(`- [${a.reason}] ${a.title} — ${a.ownerName}${dept} · due ${a.dueLabel}`);
    }
    if (attention.length > ATTENTION_LIMIT) {
      lines.push(`- …and ${attention.length - ATTENTION_LIMIT} more`);
    }
  }

  // Needs support — people, not tasks.
  lines.push("");
  lines.push("**Who needs support**");
  if (needsSupport.length === 0) {
    lines.push("- Everyone has healthy momentum right now.");
  } else {
    for (const p of needsSupport.slice(0, SUPPORT_LIMIT)) {
      const f = p.momentum.factors;
      const label = MOMENTUM_META[p.momentum.label].label;
      lines.push(
        `- ${p.name} — ${f.openCount} open, ${f.overdue} overdue (${label})`
      );
    }
  }

  // Wins — finish on a high note.
  lines.push("");
  lines.push("**Wins this week**");
  if (wins.length === 0) {
    lines.push("- None logged yet — they'll appear here as items complete.");
  } else {
    for (const w of wins.slice(0, WINS_LIMIT)) {
      lines.push(`- ✓ ${w.title} — ${w.ownerName} (${w.completedLabel})`);
    }
  }

  return lines.join("\n");
}
