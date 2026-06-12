import type { ReactNode } from "react";

interface CollapsibleAssignmentPanelProps {
  title: string;
  assigneeName?: string | null;
  children: ReactNode;
}

export default function CollapsibleAssignmentPanel({
  title,
  assigneeName,
  children,
}: CollapsibleAssignmentPanelProps) {
  const hasAssignee = Boolean(assigneeName?.trim());
  const summaryText = hasAssignee ? assigneeName?.trim() : "Not assigned";

  return (
    <details className="overflow-hidden rounded-[10px] border border-line-soft bg-surface shadow-card">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-surface-soft">
        <span className="text-[13.5px] font-bold text-ink">{title}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            hasAssignee
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {summaryText}
        </span>
      </summary>
      <div className="border-t border-line-soft bg-surface-soft/60 px-3.5 py-3">{children}</div>
    </details>
  );
}
