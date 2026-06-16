"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EntityActionRowCapture } from "@/components/work/entity-action-row-capture";
import { Button, cn } from "@/components/ui-v2";
import {
  convertDecisionToAction,
  convertFollowUpToAction,
  setFollowUpStatus,
} from "@/lib/people-strategy/meetings-actions";
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

/** Convert an unconverted meeting decision into an owned, tracked action. */
function DecisionInlinePanel({
  decisionId,
  onResolved,
}: {
  decisionId: string;
  onResolved: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function convert() {
    setError(null);
    startTransition(async () => {
      try {
        await convertDecisionToAction(decisionId);
        await revalidateQueueSurfaces();
        // Mark the loop as acted-on BEFORE refreshing so the runner can confirm
        // it actually left the queue once the fresh data arrives.
        onResolved();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the action.");
      }
    });
  }

  return (
    <div className={panelShellClass("neutral")}>
      <p className={headingClass}>Turn this into a tracked action</p>
      <p className={bodyClass}>
        The decision was made but nobody is tracking the work. Create an owned
        action so it actually happens — it stays linked to the meeting.
      </p>
      {error ? <p className={errorClass}>{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={convert} disabled={pending}>
          {pending ? "Creating…" : "Create tracked action"}
        </Button>
      </div>
    </div>
  );
}

/** Handle a meeting follow-up: mark it done, or turn it into a tracked action. */
function FollowUpInlinePanel({
  followUpId,
  onResolved,
}: {
  followUpId: string;
  onResolved: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"handled" | "action" | null>(null);
  const [pending, startTransition] = useTransition();

  function run(which: "handled" | "action") {
    setError(null);
    setBusy(which);
    startTransition(async () => {
      try {
        if (which === "handled") {
          await setFollowUpStatus({ id: followUpId, status: "COMPLETED" });
        } else {
          await convertFollowUpToAction(followUpId);
        }
        await revalidateQueueSurfaces();
        onResolved();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setBusy(null);
      }
    });
  }

  return (
    <div className={panelShellClass("neutral")}>
      <p className={headingClass}>Close this follow-up</p>
      <p className={bodyClass}>
        Mark it handled once it&apos;s done, or turn it into a tracked action if
        it needs an owner and a due date.
      </p>
      {error ? <p className={errorClass}>{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => run("handled")}
          disabled={pending}
        >
          {pending && busy === "handled" ? "Saving…" : "Mark handled"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => run("action")}
          disabled={pending}
        >
          {pending && busy === "action" ? "Creating…" : "Create tracked action"}
        </Button>
      </div>
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
      return <DecisionInlinePanel decisionId={inline.decisionId} onResolved={onResolved} />;
    case "follow_up":
      return <FollowUpInlinePanel followUpId={inline.followUpId} onResolved={onResolved} />;
    default: {
      // Exhaustiveness guard — a new inline kind must add a panel here.
      const _never: never = inline;
      return _never;
    }
  }
}
