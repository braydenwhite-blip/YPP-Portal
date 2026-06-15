import {
  type QueueAction,
  type QueueItemType,
  type QueueResolution,
  type QueueSignals,
} from "./types";

/**
 * Resolution routing (Queue Engine §16, mirrors the DS 2.0 DecisionDock rule):
 * the dock NEVER re-implements a workflow. Each of Resolve / Delegate / Discuss
 * routes into the existing surface that already owns that mutation and its
 * validation; Defer is the one in-place action — it captures a reason for the
 * current queue session (the dock intercepts it). This keeps every existing
 * server action and route intact while giving every loop one consistent set of
 * moves.
 */

/** The meetings hub — where a loop becomes an agenda item / discussion. */
const MEETINGS_HREF = "/actions/meetings";

function meetingHref(meetingId: string | null | undefined): string {
  return meetingId ? `/actions/meetings/${meetingId}` : MEETINGS_HREF;
}

export type ResolutionOverrides = Partial<Record<QueueResolution, QueueAction | null>>;

/**
 * Build the four resolution actions for a loop, given where its record lives
 * and what is true about it. Returns the actions plus the list of resolutions
 * that actually apply (null entries are dropped). Folders pick which one is the
 * dominant primary; the rest become the secondary dock.
 */
export function buildResolutionActions(input: {
  /** The record / workflow the loop opens into. */
  href: string;
  type: QueueItemType;
  signals: QueueSignals;
  relatedMeetingId?: string | null;
  /** Resolve label override ("Complete", "Send times", "Convert to action"). */
  resolveLabel?: string;
  resolveHint?: string;
  /** Per-resolution overrides (href/label) or explicit removal (null). */
  overrides?: ResolutionOverrides;
}): {
  resolutions: QueueResolution[];
  actions: Partial<Record<QueueResolution, QueueAction>>;
} {
  const { href, type, signals, relatedMeetingId, overrides = {} } = input;

  // A loop with no owner can't be "delegated" further only when it's purely
  // informational; every actionable loop can be reassigned, so delegate is
  // available whenever there is a real record to open.
  const delegatable =
    type !== "meeting" && type !== "meeting_prep" && type !== "decision";

  const base: Record<QueueResolution, QueueAction | null> = {
    resolve: {
      resolution: "resolve",
      label: input.resolveLabel ?? "Resolve",
      href,
      hint: input.resolveHint ?? "Open the record and close this loop.",
    },
    delegate: delegatable
      ? {
          resolution: "delegate",
          label: "Delegate",
          href,
          hint: signals.missingOwner
            ? "Assign an owner so this stops drifting."
            : "Hand this to the right owner.",
        }
      : null,
    discuss: {
      resolution: "discuss",
      label: "Discuss",
      href: meetingHref(relatedMeetingId),
      hint: relatedMeetingId
        ? "Take it to the connected meeting."
        : "Put it on the next meeting agenda.",
    },
    defer: {
      resolution: "defer",
      label: "Defer",
      href,
      hint: "Snooze with a reason — it leaves this session.",
    },
  };

  // Apply overrides (including explicit removals via null).
  for (const key of Object.keys(overrides) as QueueResolution[]) {
    base[key] = overrides[key] ?? null;
  }

  const resolutions: QueueResolution[] = [];
  const actions: Partial<Record<QueueResolution, QueueAction>> = {};
  for (const key of ["resolve", "delegate", "discuss", "defer"] as QueueResolution[]) {
    const action = base[key];
    if (action) {
      resolutions.push(key);
      actions[key] = action;
    }
  }
  return { resolutions, actions };
}

/**
 * Pick the dominant primary action for a loop from its available resolutions.
 * Deterministic: missing-owner → Delegate, needs-decision → Discuss, otherwise
 * Resolve. The caller may already have set an explicit primary (e.g. "Send
 * times"); this is the fallback.
 */
export function pickPrimaryResolution(
  signals: QueueSignals,
  available: QueueResolution[]
): QueueResolution {
  if (signals.missingOwner && available.includes("delegate")) return "delegate";
  if (signals.needsDecision && available.includes("discuss")) return "discuss";
  if (available.includes("resolve")) return "resolve";
  return available[0] ?? "resolve";
}
