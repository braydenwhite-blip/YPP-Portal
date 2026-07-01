import { CardV2 } from "@/components/ui-v2/card";

/**
 * Compact list of currently-blocked steps with their reasons. Mirrors the
 * "Blocked: {reason}" tone used in workflow-runner.tsx's StepRow, falling
 * back to a bare "Blocked" (no colon) when no reason was given.
 */
export function WorkflowBlockerList({
  blockers,
}: {
  blockers: Array<{ executionId: string; title: string; blockedReason: string | null }>;
}) {
  if (blockers.length === 0) return null;

  return (
    <CardV2 padding="lg" className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-blocked-700">
        Blocked
      </p>
      <ul className="flex flex-col divide-y divide-line-soft">
        {blockers.map((blocker) => (
          <li key={blocker.executionId} className="flex flex-col gap-0.5 py-2">
            <span className="text-[14px] text-ink">{blocker.title}</span>
            <span className="text-[12px] text-blocked-700">
              {blocker.blockedReason ? `Blocked: ${blocker.blockedReason}` : "Blocked"}
            </span>
          </li>
        ))}
      </ul>
    </CardV2>
  );
}
