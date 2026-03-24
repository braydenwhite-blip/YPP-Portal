import Link from "next/link";
import type { InstructorReadinessSummary } from "@/lib/dashboard/types";

function interviewLabel(status: string, passed: boolean): string {
  if (passed) return "Interview Passed";
  const map: Record<string, string> = {
    PASSED: "Interview Passed",
    WAIVED: "Interview Waived",
    REQUIRED: "Interview Required",
    SCHEDULED: "Interview Scheduled",
    FAILED: "Interview: Follow-up Needed",
    HOLD: "Interview: On Hold",
  };
  return map[status] ?? `Interview: ${status}`;
}

function interviewColor(status: string, passed: boolean): string {
  if (passed) return "#166534";
  if (status === "REQUIRED") return "#b45309";
  if (status === "SCHEDULED") return "#1d4ed8";
  if (status === "FAILED" || status === "HOLD") return "#b91c1c";
  return "var(--muted)";
}

export default function InstructorReadinessWidget({
  summary,
}: {
  summary: InstructorReadinessSummary;
}) {
  return (
    <div className="card">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <h3 style={{ margin: 0 }}>My Publish Readiness</h3>
        <Link
          href="/instructor/workspace?tab=my-pathway"
          className="link"
          style={{ fontSize: 13 }}
        >
          View full workflow →
        </Link>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <span
          className="pill"
          style={summary.trainingComplete ? { background: "#dcfce7", color: "#166534" } : {}}
        >
          Training {summary.trainingComplete ? "Complete" : "In Progress"}
        </span>
        <span
          className="pill"
          style={summary.interviewPassed ? { background: "#dcfce7", color: "#166534" } : {}}
        >
          {interviewLabel(summary.interviewStatus, summary.interviewPassed)}
        </span>
        <span
          className="pill"
          style={summary.canRequestOfferingApproval ? { background: "#dcfce7", color: "#166534" } : {}}
        >
          {summary.canRequestOfferingApproval ? "Can Request Offering Approval" : "Approval Request Blocked"}
        </span>
        {summary.legacyExemptOfferingCount > 0 ? (
          <span className="pill">
            Legacy exemptions: {summary.legacyExemptOfferingCount}
          </span>
        ) : null}
      </div>

      {/* Training progress */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          <span>Training Progress</span>
          <span style={{ fontWeight: 600 }}>
            {summary.completedRequiredModules} / {summary.requiredModulesCount} modules
          </span>
        </div>
        {summary.trainingComplete ? (
          <span
            className="pill"
            style={{ background: "#f0fdf4", color: "#166534", display: "inline-block" }}
          >
            Complete ✓
          </span>
        ) : (
          <div
            style={{
              height: 6,
              background: "var(--surface-alt, #e5e7eb)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${summary.trainingPercent}%`,
                background: "var(--ypp-purple, #7c3aed)",
                borderRadius: 999,
              }}
            />
          </div>
        )}
      </div>

      {/* Interview status */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: interviewColor(summary.interviewStatus, summary.interviewPassed),
            background: "var(--surface-alt)",
            padding: "3px 10px",
            borderRadius: 999,
            display: "inline-block",
          }}
        >
          {interviewLabel(summary.interviewStatus, summary.interviewPassed)}
        </span>
      </div>

      {/* Missing requirements */}
      {summary.featureEnabled && summary.missingRequirementsCount > 0 && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
          {summary.missingRequirementsCount} requirement
          {summary.missingRequirementsCount === 1 ? "" : "s"} remaining ·{" "}
          <Link href="/instructor/workspace?tab=my-pathway" className="link">
            See what&apos;s needed →
          </Link>
        </p>
      )}

      {/* CTA */}
      <div style={{ marginTop: 14 }}>
        <Link href="/instructor/class-settings" className="button outline small">
          Open Class Settings →
        </Link>
      </div>
    </div>
  );
}
