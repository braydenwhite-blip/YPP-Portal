import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  helper?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, helper, icon, action, className }: EmptyStateProps) {
  return (
    <div className={`iv-empty-state${className ? ` ${className}` : ""}`} role="status">
      {icon ? <div className="iv-empty-state-icon" aria-hidden="true">{icon}</div> : null}
      <p className="iv-empty-state-title">{title}</p>
      {helper ? <p className="iv-empty-state-helper">{helper}</p> : null}
      {action ? <div className="iv-empty-state-action">{action}</div> : null}
    </div>
  );
}
