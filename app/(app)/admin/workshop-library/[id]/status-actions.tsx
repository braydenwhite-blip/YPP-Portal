"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWorkshopTemplateStatus } from "@/lib/workshop-proposal-actions";
import type { WorkshopProposalTemplateStatus } from "@prisma/client";

type TemplateStatusActionsProps = {
  templateId: string;
  status: WorkshopProposalTemplateStatus;
};

const NEXT_STATUS: Record<
  WorkshopProposalTemplateStatus,
  { label: string; next: WorkshopProposalTemplateStatus }[]
> = {
  DRAFT: [
    { label: "Approve & publish", next: "APPROVED" },
    { label: "Archive", next: "ARCHIVED" },
  ],
  APPROVED: [
    { label: "Move to draft", next: "DRAFT" },
    { label: "Archive", next: "ARCHIVED" },
  ],
  ARCHIVED: [
    { label: "Restore as draft", next: "DRAFT" },
  ],
};

export function TemplateStatusActions({
  templateId,
  status,
}: TemplateStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(next: WorkshopProposalTemplateStatus) {
    if (
      next === "ARCHIVED" &&
      !window.confirm(
        "Archive this workshop? Applicants who already selected it can keep going, but no new applicants will see it in the library."
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("id", templateId);
    fd.set("status", next);
    startTransition(async () => {
      try {
        await setWorkshopTemplateStatus(fd);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Status update failed.");
      }
    });
  }

  const actions = NEXT_STATUS[status];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {actions.map((a) => (
        <button
          key={a.next}
          type="button"
          className="button small secondary"
          onClick={() => handleClick(a.next)}
          disabled={isPending}
        >
          {isPending ? "Updating…" : a.label}
        </button>
      ))}
    </div>
  );
}
