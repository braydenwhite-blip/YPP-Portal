/**
 * Hand-rolled progress bar (there is no progress-bar primitive in
 * components/ui-v2/) — copied from the completion strip in
 * workflow-runner.tsx so every workflow surface renders progress identically.
 */
export function WorkflowProgressStrip({
  completionPercent,
  stageLabel,
}: {
  completionPercent: number;
  stageLabel?: string;
}): JSX.Element {
  const percent = Math.min(100, Math.max(0, completionPercent));

  return (
    <div className="flex flex-col gap-1.5">
      {stageLabel ? (
        <p className="text-[13px] text-ink-muted">
          {stageLabel} · {percent}%
        </p>
      ) : (
        <p className="text-[13px] text-ink-muted">{percent}% complete</p>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-brand-50">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
