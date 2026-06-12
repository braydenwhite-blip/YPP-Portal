import type { ReactNode } from "react";

import { EmptyStateV2, cn } from "@/components/ui-v2";

type EmptyStateProps = {
  title: string;
  helper?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Interview-domain empty state — thin wrapper over the ui-v2 primitive. */
export function EmptyState({ title, helper, icon, action, className }: EmptyStateProps) {
  return (
    <div role="status" className={cn(className)}>
      <EmptyStateV2 icon={icon} title={title} body={helper} action={action} />
    </div>
  );
}
