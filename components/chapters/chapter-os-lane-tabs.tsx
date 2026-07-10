// The five-lane tab bar. `?lane=` is a pure presentation param — chapter scope
// always comes from the session server-side (getChapterViewerContext), so
// switching tabs never loses chapter context. `active` is resolved server-side
// from `searchParams` and passed in, so this stays a plain server component —
// every tab is just a link (shareable, reload-safe, no client JS required).

import Link from "next/link";

import { cn } from "@/components/ui-v2/cn";
import { LANE_KEYS, LANE_TITLES, type LaneKey } from "@/lib/chapters/lanes";

const DEFAULT_LANE: LaneKey = "partners";

export function activeLaneFromSearchParam(lane: string | undefined): LaneKey {
  return (LANE_KEYS as readonly string[]).includes(lane ?? "") ? (lane as LaneKey) : DEFAULT_LANE;
}

export function ChapterOSLaneTabs({ active, counts }: { active: LaneKey | null; counts?: Partial<Record<LaneKey, number>> }) {
  return (
    <nav className="seg-tabs w-fit" aria-label="Chapter operating lanes">
      <Link href="/chapter" aria-current={active === null ? "page" : undefined} className={cn("seg-tab no-underline", active === null && "active")}>Overview</Link>
      {LANE_KEYS.map((key) => {
        const isActive = key === active;
        const count = counts?.[key];
        return (
          <Link
            key={key}
            href={key === DEFAULT_LANE ? "/chapter" : `/chapter?lane=${key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn("seg-tab no-underline", isActive && "active")}
          >
            {LANE_TITLES[key]}
            {typeof count === "number" && count > 0 ? ` (${count})` : ""}
          </Link>
        );
      })}
      <Link href="/chapter/reports" className="seg-tab no-underline">Reports</Link>
    </nav>
  );
}
