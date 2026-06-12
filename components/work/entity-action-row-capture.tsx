"use client";

import { useState } from "react";

import { ActionStatusCapture } from "@/components/people-strategy/action-status-capture";

/**
 * Compact inline capture on an Entity Action Panel row: "Complete" / "Block"
 * open the same structured ActionStatusCapture the action detail card uses
 * (same mutations, same permissions — the server actions re-check
 * canEditAction), so closing out linked work doesn't force a navigation.
 */
export function EntityActionRowCapture({
  actionId,
  blockedReason,
  completionNote,
  completionOutcome,
  nextFollowUpAt,
  onCaptured,
}: {
  actionId: string;
  blockedReason?: string | null;
  completionNote?: string | null;
  completionOutcome?: string | null;
  nextFollowUpAt?: string | Date | null;
  /** Called after a capture saves — lets client surfaces refresh stale views. */
  onCaptured?: () => void;
}) {
  const [mode, setMode] = useState<"complete" | "blocked" | null>(null);

  if (mode) {
    return (
      <div className="w-full">
        <ActionStatusCapture
          actionId={actionId}
          mode={mode}
          initialOutcome={completionOutcome}
          initialNote={completionNote}
          initialBlockedReason={blockedReason}
          initialNextFollowUpAt={
            nextFollowUpAt instanceof Date ? nextFollowUpAt.toISOString() : nextFollowUpAt
          }
          onDone={() => {
            setMode(null);
            onCaptured?.();
          }}
          onCancel={() => setMode(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setMode("complete")}
        className="cursor-pointer rounded-[6px] border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
      >
        Complete
      </button>
      <button
        type="button"
        onClick={() => setMode("blocked")}
        className="cursor-pointer rounded-[6px] border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold text-amber-700 hover:border-amber-300 hover:bg-amber-50"
      >
        Block
      </button>
    </div>
  );
}
