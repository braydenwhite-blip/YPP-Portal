// TodayWorkPanel — the CP's working set: what's overdue from earlier playbook
// weeks and what's expected this week. Read-only server component.

import { CardV2 } from "@/components/ui-v2";
import type { AutomationItem } from "@/lib/automation/types";
import { AutomationItemList } from "./automation-item-list";

export function TodayWorkPanel({
  overdue,
  thisWeek,
  weekNumber,
}: {
  overdue: AutomationItem[];
  thisWeek: AutomationItem[];
  weekNumber: number;
}) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-4">
      <h2 className="m-0 text-[15px] font-bold text-ink">Your work — Week {weekNumber}</h2>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-blocked-700">
          Overdue ({overdue.length})
        </h3>
        <AutomationItemList
          items={overdue}
          compact
          limit={5}
          emptyTitle="Nothing overdue"
          emptyBody="You haven't fallen behind on any earlier playbook week."
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-ink-muted">
          This week ({thisWeek.length})
        </h3>
        <AutomationItemList
          items={thisWeek}
          compact
          limit={6}
          emptyTitle="Nothing scheduled this week"
          emptyBody="No week-specific work is due right now."
        />
      </div>
    </CardV2>
  );
}
