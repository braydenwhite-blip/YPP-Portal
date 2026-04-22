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
    <details className="collapsible-assignment-panel">
      <summary className="collapsible-assignment-summary">
        <span className="collapsible-assignment-title">{title}</span>
        <span
          className={`collapsible-assignment-chip${hasAssignee ? "" : " is-empty"}`}
        >
          {summaryText}
        </span>
      </summary>
      <div className="collapsible-assignment-body">{children}</div>
    </details>
  );
}
