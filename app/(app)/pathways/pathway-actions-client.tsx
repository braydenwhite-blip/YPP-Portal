"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectPathways, leavePathway } from "@/lib/onboarding-actions";

interface PathwayActionButtonsProps {
  pathwayId: string;
  isEnrolled: boolean;
  progressPercent: number;
  nextStepHref?: string;
}

export function PathwayActionButtons({
  pathwayId,
  isEnrolled,
  progressPercent,
  nextStepHref,
}: PathwayActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleJoin() {
    startTransition(async () => {
      await selectPathways([pathwayId]);
      router.refresh();
    });
  }

  function handleLeave() {
    if (!confirm("Leave this pathway? Your completed courses won't be affected, but you'll lose your current progress.")) return;
    startTransition(async () => {
      await leavePathway(pathwayId);
      router.refresh();
    });
  }

  if (isEnrolled) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {nextStepHref && (
          <a href={nextStepHref} className="button small">
            Continue &rarr;
          </a>
        )}
        {progressPercent === 100 && (
          <a href={`/pathways/${pathwayId}/certificate`} className="button small outline">
            View Certificate
          </a>
        )}
        <button
          className="button small outline danger"
          onClick={handleLeave}
          disabled={isPending}
          style={{ marginLeft: "auto", fontSize: 13, color: "var(--red, #e53e3e)", borderColor: "var(--red, #e53e3e)" }}
        >
          {isPending ? "Leaving..." : "Leave"}
        </button>
      </div>
    );
  }

  return (
    <button className="button small" onClick={handleJoin} disabled={isPending}>
      {isPending ? "Joining..." : "Join Pathway"}
    </button>
  );
}
