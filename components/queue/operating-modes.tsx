import Link from "next/link";

import { cn } from "@/components/ui-v2";
import type { QueueSummary } from "@/lib/queue/types";

import { ArrowRightIcon, BoltIcon, CalendarIcon, TriageIcon } from "./icons";

/**
 * The three primary operating modes that open Mission Control (Queue Engine §1).
 * Not dashboard cards — each is a one-click entry into a focused queue runner:
 * clear the small stuff, triage what's stuck, or prep the next meeting.
 */

type Mode = {
  href: string;
  title: string;
  subtitle: string;
  count: number;
  Icon: (p: { className?: string }) => JSX.Element;
  tile: string;
  iconWrap: string;
};

export function OperatingModes({ summary }: { summary: QueueSummary }) {
  const modes: Mode[] = [
    {
      href: "/work/queue?queue=quick-wins",
      title: "Clear quick wins",
      subtitle: "Tackle small loops fast",
      count: summary.quickWins,
      Icon: BoltIcon,
      tile: "hover:border-success-700/40",
      iconWrap: "bg-success-100 text-success-700",
    },
    {
      href: "/work/queue?queue=leadership",
      title: "Sort stuck work",
      subtitle: "Overdue, blocked & owner-less",
      count: summary.overdue + summary.blocked + summary.unowned,
      Icon: TriageIcon,
      tile: "hover:border-danger-700/40",
      iconWrap: "bg-danger-100 text-danger-700",
    },
    {
      href: "/work/queue?queue=meeting-prep",
      title: "Prepare next meeting",
      subtitle: "Review before you walk in",
      count: summary.upcomingMeetings,
      Icon: CalendarIcon,
      tile: "hover:border-info-700/40",
      iconWrap: "bg-info-100 text-info-700",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {modes.map((mode) => (
        <Link
          key={mode.href}
          href={mode.href}
          className={cn(
            "group flex items-center gap-4 rounded-[14px] border border-line-soft bg-surface/80 p-4 shadow-card backdrop-blur transition-all duration-200",
            "hover:-translate-y-0.5 hover:shadow-overlay motion-reduce:hover:translate-y-0",
            mode.tile
          )}
        >
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-[12px]", mode.iconWrap)}>
            <mode.Icon className="size-6" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-ink">{mode.title}</span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                {mode.count}
              </span>
            </span>
            <span className="text-[12.5px] text-ink-muted">{mode.subtitle}</span>
          </span>
          <ArrowRightIcon className="size-5 shrink-0 text-brand-600 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      ))}
    </div>
  );
}
