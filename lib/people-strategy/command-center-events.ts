/**
 * People Strategy — Command Center adoption telemetry event names (Phase 6 #4).
 *
 * Plain constants (no "use server") so both the client controls that fire events
 * and the server action that records them share one stable vocabulary. Stored on
 * the existing `AnalyticsEvent.eventType`, namespaced `command_center_*` so the
 * adoption signal is easy to query without a new table.
 */
export const COMMAND_CENTER_EVENTS = {
  /** A leader copied the weekly briefing to share it. */
  briefingCopied: "command_center_briefing_copied",
  /** A leader opened an item from the Leadership Attention Queue. */
  attentionItemOpened: "command_center_attention_item_opened",
} as const;

export type CommandCenterEventName =
  (typeof COMMAND_CENTER_EVENTS)[keyof typeof COMMAND_CENTER_EVENTS];
