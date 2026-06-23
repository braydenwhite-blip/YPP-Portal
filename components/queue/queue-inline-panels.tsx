"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EntityActionRowCapture } from "@/components/work/entity-action-row-capture";
import { Button, cn } from "@/components/ui-v2";
import { updateMentorshipActionItemStatus } from "@/lib/mentorship-hub-actions";
import { revalidateQueueSurfaces } from "@/lib/queue/queue-actions";
import type { QueueInline, QueueItem } from "@/lib/queue/types";

/**
 * The work area of My Queue — the real, inline workflow for each loop type.
 *
 * Every panel here calls an EXISTING domain mutation that re-checks permission
 * on the server; none invents a generic "resolve". On success it refreshes the
 * current route (so the queue recomputes from source truth and this item leaves
 * only because its underlying condition is now gone) and tells the runner via
 * `onResolved`, which moves to the next loop. Errors keep the panel and the
 * entered text, with a clear retry.
 */

function panelShellClass(tone: "neutral" | "amber" | "emerald") {
  return cn(
    "flex flex-col gap-2.5 rounded-[12px] border p-3.5",
    tone === "amber" && "border-amber-200 bg-amber-50/50",
    tone === "emerald" && "border-emerald-200 bg-emerald-50/50",
    tone === "neutral" && "border-line-soft bg-surface/70"
  );
}

const headingClass = "m-0 text-[13.5px] font-bold text-ink";
const bodyClass = "m-0 text-[12.5px] leading-snug text-ink-muted";
const errorClass = "m-0 text-[12.5px] font-semibold text-danger-700";

/**
 * Decision loops once converted to tracked actions through the meeting system,
 * which was removed in the weekly-meetings rebuild. The panel now just explains
 * the loop; there is no inline mutation to run.
 */
function DecisionInlinePanel() {
  return (
    <div className={panelShellClass("neutral")}>
      <p className={headingClass}>Turn this into a tracked action</p>
      <p className={bodyClass}>
        The decision was made but nobody is tracking the work. Open the full
        record below to create an owned action so it actually happens.
      </p>
    </div>
  );
}

/**
 * Follow-up loops were handled through the meeting system, which was removed in
 * the weekly-meetings rebuild. The panel now just explains the loop; there is no
 * inline mutation to run.
 */
function FollowUpInlinePanel() {
  return (
    <div className={panelShellClass("neutral")}>
      <p className={headingClass}>Close this follow-up</p>
      <p className={bodyClass}>
        Open the full record below to mark it handled or turn it into a tracked
        action with an owner and a due date.
      </p>
    </div>
  );
}

/** The action work area — structured complete / block, reusing the shared capture. */
function ActionInlinePanel({
  inline,
  onResolved,
}: {
  inline: Extract<QueueInline, { kind: "action" }>;
  onResolved: () => void;
}) {
  return (
    <div className={panelShellClass("neutral")}>
      <p className={headingClass}>Update this action</p>
      <p className={bodyClass}>
        Mark it complete (capture the outcome) or block it (name what it&apos;s
        waiting on). Need to change the owner, due date, or next steps? Open the
        full action below.
      </p>
      <EntityActionRowCapture
        actionId={inline.actionId}
        blockedReason={inline.blockedReason}
        completionNote={inline.completionNote}
        completionOutcome={inline.completionOutcome}
        nextFollowUpAt={inline.nextFollowUpISO}
        onCaptured={onResolved}
      />
    </div>
  );
}

/** Close a mentorship commitment in place — mark the action item COMPLETE. */
function MentorshipCommitmentInlinePanel({
  inline,
  onResolved,
}: {
  inline: Extract<QueueInline, { kind: "mentorship_commitment" }>;
  onResolved: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function complete() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("itemId", inline.actionItemId);
        formData.set("status", "COMPLETE");
        await updateMentorshipActionItemStatus(formData);
        await revalidateQueueSurfaces();
        onResolved();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update the commitment.");
      }
    });
  }

  return (
    <div className={panelShellClass("neutral")}>
      <p className={headingClass}>Close this commitment</p>
      <p className={bodyClass}>
        Mark “{inline.title}” complete once it&apos;s done. If the plan changed
        instead, open the relationship below to update it.
      </p>
      {error ? <p className={errorClass}>{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={complete} disabled={pending}>
          {pending ? "Saving…" : "Mark complete"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Render the inline work for a loop, when one exists. Returns null when the loop
 * has no safe inline action — the runner then leads with "open the full record".
 */
export function QueueInlineWork({
  item,
  onResolved,
}: {
  item: QueueItem;
  onResolved: () => void;
}) {
  const inline = item.inline;
  if (!inline) return null;
  switch (inline.kind) {
    case "action":
      return <ActionInlinePanel inline={inline} onResolved={onResolved} />;
    case "decision":
      return <DecisionInlinePanel />;
    case "follow_up":
      return <FollowUpInlinePanel />;
    case "mentorship_commitment":
      return <MentorshipCommitmentInlinePanel inline={inline} onResolved={onResolved} />;
    default: {
      // Exhaustiveness guard — a new inline kind must add a panel here.
      const _never: never = inline;
      return _never;
    }
  }
}
