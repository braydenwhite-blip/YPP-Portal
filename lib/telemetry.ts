/**
 * Lightweight telemetry helpers for Instructor Applicant Workflow V1.
 *
 * When TELEMETRY_ENABLED=true, events are emitted as structured JSON to
 * stdout. Pipe to your log aggregator (Datadog, Logtail, CloudWatch, etc.)
 * for dashboards and alerting.
 *
 * Set TELEMETRY_ENABLED=false (or omit) to disable with zero overhead.
 */

export type ApplicantTelemetryEvent =
  | "applicant.reviewer.assigned"
  | "applicant.interviewer.assigned"
  | "applicant.chair.decided"
  | "applicant.status.auto_advanced"
  | "applicant.materials.ready";

export interface ApplicantTelemetryPayload {
  applicationId: string;
  actorId: string;
  chapterId: string | null;
  status: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

/**
 * Emit a structured telemetry event when TELEMETRY_ENABLED=true.
 * No-op otherwise — safe to call unconditionally.
 */
export function trackApplicantEvent(
  event: ApplicantTelemetryEvent,
  payload: ApplicantTelemetryPayload
): void {
  if (process.env.TELEMETRY_ENABLED !== "true") return;
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      event,
      ...payload,
    })
  );
}
