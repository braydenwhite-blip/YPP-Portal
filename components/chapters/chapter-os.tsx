import type { ReactNode } from "react";

import { ChapterOSLaneTabs } from "@/components/chapters/chapter-os-lane-tabs";
import type { LaneKey } from "@/lib/chapters/lanes";

// The merged ChapterOS shell — the "This week" Growth pulse strip (kept, but
// not a 6th lane), an optional launch-readiness banner (lifecycle-scoped,
// cross-lane, shown only while the chapter is still launching), the five-lane
// tab bar, and whichever lane panel is active. This is the ONE Chapter
// President cockpit — no separate "Operating System" page, no duplicate
// automation section.
export function ChapterOS({
  active,
  laneCounts,
  launchBanner,
  panel,
}: {
  active: LaneKey;
  laneCounts?: Partial<Record<LaneKey, number>>;
  launchBanner?: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <ChapterOSLaneTabs active={active} counts={laneCounts} />
      {launchBanner}
      {panel}
    </div>
  );
}
