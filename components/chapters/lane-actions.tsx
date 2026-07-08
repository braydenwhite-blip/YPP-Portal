// The Actions lane: what must be done now, grouped by what makes it urgent.
// Every group is a real, chapter-scoped ActionItem (or an open support
// request to leadership) — the same accountability system the rest of the
// portal uses, never a parallel checklist.

import { CardV2, StatusBadge, ButtonLink, EmptyStateV2 } from "@/components/ui-v2";
import { LaneRecordCard } from "@/components/chapters/lane-record-card";
import type { ActionsLaneView } from "@/lib/chapters/actions-lane";

function Group({ title, description, records }: { title: string; description: string; records: ActionsLaneView["overdue"] }) {
  if (records.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">{title}</h3>
        <StatusBadge tone="neutral">{records.length}</StatusBadge>
      </div>
      <p className="m-0 text-[12px] text-ink-muted">{description}</p>
      <div className="flex flex-col gap-2">
        {records.map((r) => (
          <LaneRecordCard key={r.id} record={r} />
        ))}
      </div>
    </div>
  );
}

export function LaneActions({
  view,
  chapterId,
  workflowCard,
}: {
  view: ActionsLaneView;
  chapterId: string;
  workflowCard?: React.ReactNode;
}) {
  if (!view.trackerEnabled) {
    return (
      <CardV2 padding="lg">
        <EmptyStateV2
          title="Action tracking isn't enabled"
          body="Ask an admin to enable the People Strategy Action Tracker to see chapter actions here."
        />
      </CardV2>
    );
  }

  if (view.totalOpen === 0) {
    return (
      <div className="flex flex-col gap-4">
        {workflowCard}
        <CardV2 padding="lg">
          <EmptyStateV2
            title="Nothing open right now"
            body="Actions created for this chapter — from a workflow, a meeting follow-up, or tracked from a lane's needs list — show up here."
            action={<ButtonLink href="/actions/new">New action</ButtonLink>}
          />
        </CardV2>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] font-semibold text-ink">{view.headline}</p>
        <ButtonLink href={`/actions?ch=${chapterId}`} variant="secondary" size="sm">
          Open full Action Tracker
        </ButtonLink>
      </div>

      {workflowCard}

      <Group title="Overdue" description="Past their deadline and still open." records={view.overdue} />
      <Group title="Blocked" description="Stuck on something — the reason is shown on each card." records={view.blocked} />
      <Group title="Waiting on leadership" description="Blocked items and open support requests to national leadership." records={view.waitingOnLeadership} />
      <Group title="No next move" description="Open, but nothing is scheduled to move them forward." records={view.noNextMove} />
      <Group title="Flagged" description="Flagged for leadership's attention." records={view.flagged} />

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">All open actions</h3>
        <div className="flex flex-col gap-2">
          {view.all.map((r) => (
            <LaneRecordCard key={r.id} record={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
