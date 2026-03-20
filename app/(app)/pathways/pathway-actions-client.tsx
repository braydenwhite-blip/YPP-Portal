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
      const result = await selectPathways([pathwayId]);
      if (result && "error" in result && result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleLeave() {
    if (!confirm("Leave this pathway? Completed courses stay on your record, but any unfinished pathway enrollments will be removed.")) return;
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
          {isPending ? "Leaving..." : "Leave Pathway"}
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
