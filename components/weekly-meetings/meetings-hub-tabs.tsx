import Link from "next/link";

import { cn } from "@/components/ui-v2/cn";

export type MeetingsHubView = "upcoming" | "past" | "all";

const TABS: Array<{ key: MeetingsHubView; label: string; href: string }> = [
  { key: "upcoming", label: "Upcoming", href: "/meetings" },
  { key: "past", label: "Past", href: "/meetings?view=past" },
  { key: "all", label: "All", href: "/meetings?view=all" },
];

export function MeetingsHubTabs({ active }: { active: MeetingsHubView }) {
  return (
    <nav aria-label="Meetings views" className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-semibold no-underline transition-colors",
              isActive
                ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                : "border-line-soft bg-surface text-brand-800 hover:border-brand-300 hover:bg-brand-50"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
