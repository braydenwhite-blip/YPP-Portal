import Link from "next/link";

import { cn } from "@/components/ui-v2/cn";

export type MeetingsHubView = "upcoming" | "past" | "all";

const TABS: Array<{ key: MeetingsHubView; label: string; href: string }> = [
  { key: "upcoming", label: "Upcoming", href: "/meetings" },
  { key: "past", label: "Past", href: "/meetings?view=past" },
  { key: "all", label: "All", href: "/meetings?view=all" },
];

export function MeetingsHubTabs({ active, count }: { active: MeetingsHubView; count?: number }) {
  return (
    <nav aria-label="Meetings views" className="seg-tabs w-fit">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn("seg-tab no-underline", isActive && "active")}
          >
            {tab.label}
            {isActive && count !== undefined ? ` (${count})` : ""}
          </Link>
        );
      })}
    </nav>
  );
}
