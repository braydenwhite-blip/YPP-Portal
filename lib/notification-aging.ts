/**
 * Pure helper for the cockpit's NotificationFailureBanner. Drives the
 * banner's visual severity over time so a stuck failure escalates from
 * "just failed" to "applicant hasn't been notified" without yelling on
 * minute one. (§11.4 of the redesign plan.)
 */

export type NotificationAgingSeverity = "fresh" | "amber" | "orange" | "red";

export interface NotificationAgingResult {
  severity: NotificationAgingSeverity;
  ageMinutes: number;
  copyHint: string;
}

export function computeAgingSeverity(
  failedAt: string | null,
  now: Date = new Date()
): NotificationAgingResult {
  if (!failedAt) {
    return { severity: "fresh", ageMinutes: 0, copyHint: "just failed" };
  }
  const ts = new Date(failedAt).getTime();
  if (Number.isNaN(ts)) {
    return { severity: "fresh", ageMinutes: 0, copyHint: "just failed" };
  }
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - ts) / 60_000));
  if (ageMinutes < 5) {
    return { severity: "fresh", ageMinutes, copyHint: "just failed" };
  }
  if (ageMinutes < 15) {
    return { severity: "amber", ageMinutes, copyHint: `failed ${ageMinutes} minutes ago` };
  }
  if (ageMinutes < 30) {
    return { severity: "orange", ageMinutes, copyHint: `failed ${ageMinutes} minutes ago` };
  }
  return {
    severity: "red",
    ageMinutes,
    copyHint: `failed ${ageMinutes} minutes ago — applicant hasn't been notified`,
  };
}

export function severityBorderColor(severity: NotificationAgingSeverity): string {
  switch (severity) {
    case "fresh":
    case "amber":
      return "var(--score-mixed, #eab308)";
    case "orange":
      return "var(--score-concern, #f97316)";
    case "red":
      return "var(--score-weak, #ef4444)";
  }
}

export function severityBackground(severity: NotificationAgingSeverity): string {
  switch (severity) {
    case "fresh":
    case "amber":
      return "rgba(234, 179, 8, 0.08)";
    case "orange":
      return "rgba(249, 115, 22, 0.10)";
    case "red":
      return "rgba(239, 68, 68, 0.10)";
  }
}
