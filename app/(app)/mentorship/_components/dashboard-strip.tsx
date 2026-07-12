"use client";

import Link from "next/link";
import { cn } from "@/components/ui-v2";

export type DashboardStripProps = {
  /** Reviews waiting for the user's attention. */
  pendingReviews: number;
  /** Check-ins due or overdue. */
  checkInsDue: number;
  /** Follow-ups needed. */
  followUpsNeeded: number;
  /** Kickoffs pending (for mentors). */
  kickoffsPending: number;
  /** Quiet mentees who need a touchpoint. */
  quietMentees: number;
  /** Unread action items. */
  actionItems: number;
  /** URL for the reviews page. */
  reviewsHref: string;
  /** URL for check-ins. */
  checkInsHref: string;
  /** URL for follow-ups. */
  followUpsHref: string;
  /** URL for quiet mentees list. */
  quietHref: string;
};

const TONE_CONFIG: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  amber: { bg: "bg-amber-50", border: "border-l-amber-500", dot: "bg-amber-500", label: "amber" },
  blue: { bg: "bg-blue-50", border: "border-l-blue-500", dot: "bg-blue-500", label: "blue" },
  red: { bg: "bg-red-50", border: "border-l-red-500", dot: "bg-red-500", label: "red" },
  purple: { bg: "bg-purple-50", border: "border-l-purple-500", dot: "bg-purple-500", label: "purple" },
  slate: { bg: "bg-slate-50", border: "border-l-slate-400", dot: "bg-slate-400", label: "slate" },
};

export function DashboardStrip(props: DashboardStripProps) {
  const tiles: Array<{
    count: number;
    label: string;
    href: string;
    tone: keyof typeof TONE_CONFIG;
  }> = [];

  if (props.pendingReviews > 0) tiles.push({ count: props.pendingReviews, label: "Reviews to complete", href: props.reviewsHref, tone: "blue" });
  if (props.checkInsDue > 0) tiles.push({ count: props.checkInsDue, label: "Check-ins due", href: props.checkInsHref, tone: "amber" });
  if (props.followUpsNeeded > 0) tiles.push({ count: props.followUpsNeeded, label: "Follow-ups needed", href: props.followUpsHref, tone: "red" });
  if (props.kickoffsPending > 0) tiles.push({ count: props.kickoffsPending, label: "Kickoffs pending", href: props.reviewsHref, tone: "purple" });
  if (props.quietMentees > 0) tiles.push({ count: props.quietMentees, label: "Quiet mentees", href: props.quietHref, tone: "slate" });
  if (props.actionItems > 0) tiles.push({ count: props.actionItems, label: "Action items", href: "/actions", tone: "amber" });

  if (tiles.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[12px] border border-line-soft bg-surface px-4 py-3 shadow-sm">
        <span className="text-[15px]">✅</span>
        <p className="m-0 text-[13px] text-ink-muted">
          Nothing needs your attention — everything is on track.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        What you have to do
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => {
          const t = TONE_CONFIG[tile.tone] ?? TONE_CONFIG.blue;
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className={cn(
                "flex items-center gap-3 rounded-[10px] border border-line-soft bg-surface px-3.5 py-2.5 shadow-sm no-underline transition-all hover:shadow-md",
                t.bg,
                "border-l-4",
                t.border
              )}
            >
              <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", t.dot)} />
              <div className="min-w-0">
                <p className="m-0 text-[18px] font-bold text-ink">{tile.count}</p>
                <p className="m-0 truncate text-[11.5px] font-medium text-ink-muted">
                  {tile.label}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}