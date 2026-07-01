import { StatusBadge } from "@/components/ui-v2/status-badge";
import type { StageProgressStatus } from "@/lib/workflow-engine/types";

/**
 * Small pill combining a stage's name with its status tone. Mirrors the color
 * conventions established in workflow-runner.tsx's "Stages" timeline (see the
 * stage-order-circle block under its "Stages" SectionHeaderV2) so a stage
 * looks the same whether shown in the runner or wherever this pill is reused.
 */
export function WorkflowStagePill({
  stageName,
  status,
  isOverdue,
}: {
  stageName: string;
  status: StageProgressStatus;
  isOverdue?: boolean;
}): JSX.Element {
  const tone = isOverdue
    ? "danger"
    : status === "COMPLETED"
      ? "success"
      : status === "CURRENT"
        ? "brand"
        : status === "BLOCKED"
          ? "danger"
          : "neutral";

  const reason = isOverdue
    ? `${stageName} is overdue`
    : status === "COMPLETED"
      ? `${stageName} is complete`
      : status === "CURRENT"
        ? `${stageName} is the current stage`
        : status === "BLOCKED"
          ? `${stageName} is blocked`
          : `${stageName} has not started`;

  return (
    <StatusBadge tone={tone} title={reason}>
      {stageName}
      {isOverdue ? " · Overdue" : ""}
    </StatusBadge>
  );
}
