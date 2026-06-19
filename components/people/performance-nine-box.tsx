import Link from "next/link";
import type { GoalRatingColor } from "@prisma/client";

import { cn } from "@/components/ui-v2";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

/**
 * Performance × Potential matrix (the mockup's leadership-only succession view).
 *
 * Reads the latest Quarterly Review placement already computed on each row
 * (`row.quarterly`). People without a quarterly placement are summarized below
 * the grid rather than dropped, so the view degrades calmly when reviews are
 * sparse.
 */

const LEVEL: Record<GoalRatingColor, number> = {
  BEHIND_SCHEDULE: 1,
  GETTING_STARTED: 2,
  ACHIEVED: 3,
  ABOVE_AND_BEYOND: 4,
};

/** Column labels left→right map to potential levels 1→4. */
const POTENTIAL_LABELS = ["At Risk", "Needs Attention", "On Track", "Above & Beyond"];

/** Per-cell name + one-line advice, keyed "performance-potential". */
const CELL: Record<string, [string, string]> = {
  "4-4": ["Clear Successor", "Fast-track · succession pipeline"],
  "4-3": ["Accelerate", "Mentor others · prep next role"],
  "4-2": ["Strong Contributor", "Stretch assignments"],
  "4-1": ["Peaked Performer", "Strong delivery, low ceiling"],
  "3-4": ["Rising Talent", "Accelerated growth path"],
  "3-3": ["Strong Candidate", "Stretch with new challenges"],
  "3-2": ["Solid Contributor", "Targeted development plan"],
  "3-1": ["Steady Performer", "Maintain clear expectations"],
  "2-4": ["Untapped Talent", "Urgent support · engagement gap"],
  "2-3": ["Developing Performer", "Set clear targets"],
  "2-2": ["Inconsistent Performer", "Coaching needed"],
  "2-1": ["Blocked Performer", "Clarify role · check blockers"],
  "1-4": ["Misaligned Talent", "Investigate barriers"],
  "1-3": ["Struggling Performer", "Structured improvement"],
  "1-2": ["Disengaged Performer", "Understand root cause"],
  "1-1": ["Critical Risk", "PIP or role change"],
};

/** Mockup's zone shading: high-high green, strong blue, mid amber, low red. */
function zone(perf: number, pot: number) {
  if (perf >= 3 && pot >= 3)
    return { bg: "bg-[#eaf7ef]", border: "border-[#cdeadb]", title: "text-[#0e7c52]", sub: "text-[#4f9b76]" };
  const sum = perf + pot;
  if (sum >= 6)
    return { bg: "bg-[#e8f1fd]", border: "border-[#d3e4fa]", title: "text-[#1d6fd6]", sub: "text-[#5a8ec9]" };
  if (sum >= 4)
    return { bg: "bg-[#fdf6e9]", border: "border-[#f1e3c2]", title: "text-[#b45309]", sub: "text-[#b08a45]" };
  return { bg: "bg-[#fdeeec]", border: "border-[#f6d5cf]", title: "text-[#c0392b]", sub: "text-[#c47b72]" };
}

const AVATAR_COLORS = [
  "#6b21c8", "#0e9f6e", "#d97706", "#0891b2", "#7c3aed", "#db2777",
  "#2563eb", "#0d9488", "#9333ea", "#ca8a04", "#16a34a", "#e0345c",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PerformanceNineBox({ rows }: { rows: PeoplePerformanceRow[] }) {
  const placed = rows.filter((r) => r.quarterly);
  const unrated = rows.filter((r) => !r.quarterly);

  // Performance top→bottom is 4→1; potential left→right is 1→4.
  const cells = [4, 3, 2, 1].flatMap((perf) =>
    [1, 2, 3, 4].map((pot) => {
      const people = placed.filter(
        (r) =>
          LEVEL[r.quarterly!.performanceRating] === perf &&
          LEVEL[r.quarterly!.potentialRating] === pot
      );
      const [label, advice] = CELL[`${perf}-${pot}`];
      return { key: `${perf}-${pot}`, people, label, advice, ...zone(perf, pot) };
    })
  );

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-line-card bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2.5 rounded-[11px] border border-brand-200 bg-brand-50 px-4 py-3">
        <span aria-hidden className="text-[14px]">
          🔒
        </span>
        <p className="m-0 text-[12.5px] leading-snug text-brand-700">
          <strong>Leadership-only succession view.</strong> Performance is current
          delivery; Potential is future growth. High–high members are succession
          candidates. Not visible to general members.
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex w-5 items-center justify-center">
          <span className="rotate-180 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted [writing-mode:vertical-rl]">
            Performance →
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {cells.map((c) => (
              <div
                key={c.key}
                className={cn("flex min-h-[128px] flex-col rounded-[12px] border p-3", c.bg, c.border)}
              >
                <div className={cn("text-[12px] font-bold leading-tight", c.title)}>{c.label}</div>
                <div className={cn("mt-0.5 text-[10.5px] leading-snug", c.sub)}>{c.advice}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.people.map((p) => (
                    <Link
                      key={p.id}
                      href={`/people/${p.id}`}
                      title={p.name}
                      className="flex size-7 items-center justify-center rounded-full border-2 border-surface text-[9.5px] font-bold text-white shadow-card transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                      style={{ backgroundColor: avatarColor(p.id) }}
                    >
                      {initials(p.name)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 hidden grid-cols-4 gap-2.5 md:grid">
            {POTENTIAL_LABELS.map((label) => (
              <div key={label} className="text-center text-[11px] font-semibold text-ink-muted">
                {label}
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
            Potential →
          </div>
        </div>
      </div>

      {unrated.length > 0 ? (
        <p className="m-0 text-[12px] text-ink-muted">
          {unrated.length} {unrated.length === 1 ? "person has" : "people have"} no
          quarterly review yet — they&apos;ll be placed once their first review is
          completed.
        </p>
      ) : null}
    </section>
  );
}
