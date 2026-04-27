/**
 * Final Review Cockpit analytics — fire-and-forget event emitter aligned with
 * the per-phase event tables from the redesign plan (§6.11, §7.10, §8.10,
 * §9.9, §10.10, §11.10).
 *
 * The emitter is a thin wrapper over `console.log` (gated by the
 * NEXT_PUBLIC_COCKPIT_ANALYTICS_ENABLED flag). Pipe stdout to your log
 * aggregator the same way `lib/telemetry.ts` already does for server-side
 * applicant events. Front-end + back-end emitters can use the same helper —
 * the function is environment-agnostic.
 */

export type CockpitEventName =
  // Phase 2A
  | "final_review.viewed"
  | "final_review.queue_advance"
  | "final_review.sibling_dropdown_opened"
  | "final_review.readiness_segment_hovered"
  // Phase 2B
  | "final_review.draft_autosaved"
  | "final_review.draft_autosave_failed"
  | "final_review.decision_intent"
  | "final_review.rationale_required_nudge"
  // Phase 2C
  | "final_review.confirm_modal_opened"
  | "final_review.confirm_modal_dismissed"
  | "final_review.contrarian_warning_shown"
  | "final_review.contrarian_override"
  | "final_review.condition_added"
  | "final_review.reject_reason_selected"
  // Phase 2D
  | "final_review.commit_started"
  | "final_review.commit_succeeded"
  | "final_review.commit_replayed"
  | "final_review.commit_failed"
  | "final_review.toast_shown"
  | "final_review.toast_advance_clicked"
  | "final_review.toast_dismissed"
  // Phase 2D.6
  | "final_review.sync_rollback_shown"
  | "final_review.sync_rollback_retried"
  | "final_review.stale_click_shown"
  | "final_review.validation_error_shown"
  | "final_review.deadlock_auto_retry"
  | "final_review.network_recovery_shown"
  // Phase 2D.9
  | "final_review.notification_failure_shown"
  | "final_review.notification_resend_clicked"
  | "final_review.notification_resend_succeeded"
  | "final_review.notification_resend_failed"
  | "final_review.notification_diagnostic_opened"
  | "final_review.notification_diagnostic_copied"
  // Phase 2D.9.5 — soft warnings
  | "final_review.warning_acknowledged"
  | "final_review.warning_panel_expanded"
  // Phase 2E
  | "final_review.rescind_modal_opened"
  | "final_review.rescind_committed"
  // Phase 3 / 4 / 7
  | "final_review.signal_pinned"
  | "final_review.signal_unpinned"
  | "final_review.signal_resolved"
  | "final_review.signal_replied"
  | "final_review.signal_mention_acknowledged";

const ANALYTICS_FLAG_ENV = "NEXT_PUBLIC_COCKPIT_ANALYTICS_ENABLED";

function analyticsEnabled(): boolean {
  if (typeof process === "undefined") return false;
  return process.env[ANALYTICS_FLAG_ENV] === "true";
}

export interface CockpitEventPayload {
  applicationId?: string;
  actorId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

/**
 * Emits a cockpit analytics event. No-op when the flag is unset — this is
 * deliberate so dev/test environments stay quiet without conditionals at
 * each call site.
 */
export function trackCockpitEvent(
  event: CockpitEventName,
  payload: CockpitEventPayload = {}
): void {
  if (!analyticsEnabled()) return;
  try {
    // eslint-disable-next-line no-console -- deliberate stdout pipe for log aggregator
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        event,
        ...payload,
      })
    );
  } catch {
    /* swallow circular-ref or stringify errors — analytics must never throw */
  }
}
