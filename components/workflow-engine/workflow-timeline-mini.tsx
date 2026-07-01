import { CardV2 } from "@/components/ui-v2/card";
import { SectionHeaderV2 } from "@/components/ui-v2/section-header";

/**
 * Compact version of workflow-runner.tsx's "History" timeline block, sized
 * for embedding on another page (entity detail, instance preview) rather than
 * being the main content. Reuses the same dot + summary + timestamp +
 * actor-name layout as the full runner, just denser. Presentational only —
 * the caller loads the data with `getWorkflowTimelineData` and passes it in.
 */
export function WorkflowTimelineMini({
  events,
}: {
  events: Array<{
    id: string;
    kind: string;
    summary: string;
    actorName: string | null;
    createdAt: string;
  }>;
}): JSX.Element | null {
  return (
    <CardV2 padding="md">
      <SectionHeaderV2 title="Recent activity" />
      <ul className="mt-2 flex flex-col gap-1.5">
        {events.length === 0 ? (
          <li className="text-[13px] text-ink-muted">No activity yet.</li>
        ) : (
          events.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-[12.5px]">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
              <div>
                <span className="text-ink">{e.summary}</span>
                <span className="ml-2 text-[11px] text-ink-muted">
                  {new Date(e.createdAt).toLocaleString()}
                  {e.actorName ? ` · ${e.actorName}` : ""}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </CardV2>
  );
}
