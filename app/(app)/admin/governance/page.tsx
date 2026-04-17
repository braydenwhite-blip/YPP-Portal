import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getGovernanceDashboardData,
  getOpsRules,
  getRecentViolations,
  createOpsRule,
  toggleOpsRuleStatus,
  acknowledgeViolation,
  triggerSnapshotComputation,
  triggerRuleEvaluation,
} from "@/lib/governance/actions";
import Link from "next/link";

export const metadata = { title: "Governance & Risk Controls" };

const RISK_FLAG_LABELS: Record<string, string> = {
  no_active_instructors: "No Active Instructors",
  overdue_queues_high: "High Overdue Queues",
  pending_applications_backlog: "Application Backlog",
  no_running_classes: "No Running Classes",
  low_enrollment: "Low Enrollment",
  no_mentorship_pairs: "No Mentorship Pairs",
};

const SEVERITY_STYLE: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: "#dc2626", bg: "#fef2f2" },
  WARNING: { color: "#d97706", bg: "#fffbeb" },
  INFO: { color: "#2563eb", bg: "#eff6ff" },
};

export default async function GovernancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const [dashboard, rules, violations] = await Promise.all([
    getGovernanceDashboardData(),
    getOpsRules(),
    getRecentViolations(),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Governance & Risk Controls</h1>
          <p className="page-subtitle">
            Monitor chapter health, enforce SLA rules, and manage escalations.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <form action={triggerSnapshotComputation}>
            <button type="submit" className="button outline small">
              Refresh Snapshots
            </button>
          </form>
          <form action={triggerRuleEvaluation}>
            <button type="submit" className="button outline small">
              Evaluate Rules
            </button>
          </form>
          <Link href="/admin/role-matrix" className="button outline small">
            Role Matrix
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "#dc2626" }}>{dashboard.atRiskChapters.length}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>At-Risk Chapters</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "#16a34a" }}>{dashboard.healthyChapters}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Healthy Chapters</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "var(--ypp-purple-700)" }}>{dashboard.totalChapters}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Total Chapters</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "#2563eb" }}>{dashboard.activeRules}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Active Rules</p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="kpi" style={{ color: "#d97706" }}>{dashboard.recentViolations}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>Open Violations (7d)</p>
        </div>
      </div>

      {/* At-Risk Chapters Panel */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "1.05rem" }}>
          At-Risk Chapters ({dashboard.atRiskChapters.length})
        </p>
        {dashboard.atRiskChapters.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            All chapters are healthy. No risk flags detected.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {dashboard.atRiskChapters.map((ch) => (
              <div
                key={ch.chapterId}
                style={{
                  padding: "0.75rem 1rem",
                  background: "#fef2f2",
                  borderRadius: "var(--radius-sm)",
                  borderLeft: "4px solid #dc2626",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0, fontSize: "0.92rem" }}>
                      {ch.chapterName}
                    </p>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.15rem 0 0" }}>
                      {[ch.city, ch.region].filter(Boolean).join(", ") || "No location"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                    <span>{ch.activeStudents} students</span>
                    <span>{ch.activeInstructors} instructors</span>
                    <span>{ch.classesRunningCount} classes</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {ch.riskFlags.map((flag) => (
                    <span
                      key={flag}
                      className="pill"
                      style={{ background: "#fef2f2", color: "#dc2626", fontSize: "0.7rem", border: "1px solid #fecaca" }}
                    >
                      {RISK_FLAG_LABELS[flag] ?? flag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid two" style={{ marginBottom: "1.5rem" }}>
        {/* Recent Violations */}
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>
            Recent Violations ({violations.length})
          </p>
          {violations.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No violations in the past 30 days.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {violations.map((v) => {
                const sev = SEVERITY_STYLE[v.severity] ?? SEVERITY_STYLE.INFO;
                return (
                  <div
                    key={v.id}
                    style={{
                      padding: "0.6rem 0.75rem",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: `3px solid ${sev.color}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "0.85rem" }}>
                        {v.ruleName}
                      </p>
                      <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "0.1rem 0 0" }}>
                        {v.chapterName} · {v.metricKey}: {v.actualValue} (threshold: {v.thresholdValue})
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span className="pill" style={{ background: sev.bg, color: sev.color, fontSize: "0.7rem" }}>
                        {v.severity}
                      </span>
                      {!v.acknowledged && (
                        <form action={acknowledgeViolation.bind(null, v.id)}>
                          <button type="submit" className="button ghost small" style={{ fontSize: "0.72rem" }}>
                            Acknowledge
                          </button>
                        </form>
                      )}
                      {v.acknowledged && (
                        <span style={{ fontSize: "0.72rem", color: "#16a34a" }}>Acknowledged</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Rules */}
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: "1rem" }}>
            Ops Rules ({rules.length})
          </p>
          {rules.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No rules configured yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {rules.map((r) => {
                const sev = SEVERITY_STYLE[r.severity] ?? SEVERITY_STYLE.INFO;
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: "0.6rem 0.75rem",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "0.85rem" }}>
                        {r.name}
                        <span className="pill" style={{ marginLeft: "0.4rem", background: sev.bg, color: sev.color, fontSize: "0.68rem" }}>
                          {r.severity}
                        </span>
                        <span className="pill" style={{
                          marginLeft: "0.25rem",
                          fontSize: "0.68rem",
                          background: r.status === "ACTIVE" ? "#f0fdf4" : "#f5f5f5",
                          color: r.status === "ACTIVE" ? "#16a34a" : "#666",
                        }}>
                          {r.status}
                        </span>
                      </p>
                      <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "0.1rem 0 0" }}>
                        {r.chapterName} · {r.metricKey} {r.operator} {r.thresholdValue} · {r.violationCount} violations
                      </p>
                    </div>
                    <form action={toggleOpsRuleStatus.bind(null, r.id)}>
                      <button type="submit" className="button ghost small" style={{ fontSize: "0.72rem" }}>
                        {r.status === "ACTIVE" ? "Pause" : "Activate"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create New Rule */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Create New Ops Rule</p>
        <form action={createOpsRule}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Rule Name</label>
              <input name="name" required className="input" placeholder="e.g. High Overdue Queues Alert" />
            </div>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Description</label>
              <input name="description" className="input" placeholder="Optional description" />
            </div>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Metric</label>
              <select name="metricKey" required className="input">
                <option value="overdue_queues">Overdue Queues</option>
                <option value="pending_applications">Pending Applications</option>
                <option value="active_students">Active Students</option>
                <option value="active_instructors">Active Instructors</option>
                <option value="avg_response_hours">Avg Response Hours</option>
                <option value="classes_running">Classes Running</option>
                <option value="enrollment_fill_percent">Enrollment Fill %</option>
                <option value="mentorship_pairs">Mentorship Pairs</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Operator</label>
                <select name="operator" required className="input">
                  <option value="gt">&gt; (greater than)</option>
                  <option value="gte">&ge; (greater or equal)</option>
                  <option value="lt">&lt; (less than)</option>
                  <option value="lte">&le; (less or equal)</option>
                  <option value="eq">= (equals)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Threshold</label>
                <input name="thresholdValue" type="number" step="any" required className="input" placeholder="5" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Severity</label>
              <select name="severity" className="input">
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
                <option value="INFO">Info</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Escalate To Roles (comma-separated)</label>
              <input name="escalateToRoles" className="input" defaultValue="ADMIN,CHAPTER_PRESIDENT" />
            </div>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <button type="submit" className="button primary small">Create Rule</button>
          </div>
        </form>
      </div>
    </div>
  );
}
