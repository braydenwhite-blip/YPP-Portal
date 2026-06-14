import { ClassOperationsBoard } from "@/components/classes/class-operations-board";
import type { AdminClassOperationsListItem } from "@/lib/admin-class-operations";

type ProposalQueueItem = {
  id: string;
  title: string;
  startDate: Date;
  instructor: { id: string; name: string; email: string } | null;
  approval: {
    status: string;
    requestedAt: Date | null;
  } | null;
};

export default function ClassOperationsList({
  tab,
  operations,
  proposals,
}: {
  tab: string;
  operations: AdminClassOperationsListItem[];
  proposals: ProposalQueueItem[];
}) {
  return (
    <ClassOperationsBoard tab={tab} operations={operations} proposals={proposals} />
  );
}

export type { ProposalQueueItem };
