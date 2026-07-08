// A `StatusBadge` that can only ever render concrete evidence (a `LaneStatus`
// — "Follow-up 6d overdue", "12/15 enrolled · 80% ready" — never a generic
// health grade like "At Risk"/"On Track"). This is the structural enforcement
// point for the five-lane rebuild's "no generic health language" rule: there
// is no prop that accepts a bare grade string, only a `LaneStatus`.

import { StatusBadge } from "@/components/ui-v2";
import type { LaneStatus } from "@/lib/chapters/lanes";

export function LaneStatusBadge({ status }: { status: LaneStatus }) {
  return (
    <StatusBadge tone={status.tone} withDot>
      {status.label}
    </StatusBadge>
  );
}
