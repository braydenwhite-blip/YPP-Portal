import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getGRAssignedDocuments, getGRGoalChangeQueue } from "@/lib/gr-actions";
import { ActionSummaryHeader } from "@/components/mentorship/action-summary-header";
import { GRAdminSubnav } from "./_components/gr-admin-subnav";

export const metadata = { title: "Goals & Resources — Admin Mentorship" };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "pill pill-small pill-success" },
  DRAFT: { label: "Draft — not activated", cls: "pill pill-small pill-pending" },
};

export default async function AdminGROverviewPage() {
  const session = await getSession();
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/");

  const [documents, goalChanges] = await Promise.all([
    getGRAssignedDocuments(),
    getGRGoalChangeQueue(),
  ]);

  const draftDocs = documents.filter((d) => d.status === "DRAFT");
  const docsWithNoGoals = documents.filter((d) => d._count.goals === 0);
  const pendingChangeDocIds = new Set(goalChanges.map((gc) => gc.documentId));

  const headerStatus =
    goalChanges.length > 0
      ? { label: `${goalChanges.length} goal change(s) awaiting review`, tone: "warning" as const }
      : draftDocs.length > 0
      ? { label: `${draftDocs.length} draft(s) not yet activated`, tone: "pending" as const }
      : { label: "All documents healthy", tone: "success" as const };

  return (
    <div>
      <ActionSummaryHeader
        badge="Admin · Goals & Resources"
        title="Goals & Resources"
        purpose="Manage mentorship goals and resources — who owns each document, which mentor is connected, and what needs admin action."
        status={headerStatus}
        nextAction={{ label: "Assign a document →", href: "/admin/mentorship/gr/assignments" }}
      />

      <GRAdminSubnav />

      {/* Health signals derived from existing data only. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="card">
          <p className="kpi">{documents.length}</p>
          <p className="kpi-label">Active &amp; draft documents</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: draftDocs.length > 0 ? "#d97706" : undefined }}>
            {draftDocs.length}
          </p>
          <p className="kpi-label">Drafts not yet activated</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: goalChanges.length > 0 ? "#d97706" : undefined }}>
            {goalChanges.length}
          </p>
          <p className="kpi-label">Goal changes awaiting review</p>
        </div>
        <div className="card">
          <p className="kpi" style={{ color: docsWithNoGoals.length > 0 ? "#d97706" : undefined }}>
            {docsWithNoGoals.length}
          </p>
          <p className="kpi-label">Documents with no active goals</p>
        </div>
      </div>

      {goalChanges.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderLeft: "3px solid #d97706",
          }}
        >
          <div>
            <strong>{goalChanges.length} goal-change proposal(s) need a decision</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
              Mentors or mentees proposed goal edits. Approve or decline them so
              each document stays accurate.
            </p>
          </div>
          <Link href="/admin/mentorship/gr/assignments" className="button primary small">
            Review proposals →
          </Link>
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          G&amp;R documents ({documents.length})
        </div>
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13 }}>
          Sorted by most recently created. Open a document to see its goals,
          timeline phases, and what the mentee can currently see.
        </p>
        {documents.length === 0 ? (
          <div
            style={{
              padding: 24,
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border)",
              color: "var(--muted)",
              textAlign: "center",
            }}
          >
            No G&amp;R documents assigned yet. Use the Assignments tab to assign a
            template to an active mentorship.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Template / lane</th>
                  <th>Mentor</th>
                  <th>Status</th>
                  <th>Goals</th>
                  <th>Pending changes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => {
                  const statusMeta = STATUS_META[d.status] ?? {
                    label: d.status,
                    cls: "pill pill-small",
                  };
                  const hasPending =
                    d._count.goalChanges > 0 || pendingChangeDocIds.has(d.id);
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.user.name}</strong>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {d.user.email}
                        </div>
                      </td>
                      <td>
                        {d.template.title}
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {d.template.roleType}
                        </div>
                      </td>
                      <td>{d.mentorship.mentor.name}</td>
                      <td>
                        <span className={statusMeta.cls}>{statusMeta.label}</span>
                      </td>
                      <td style={{ color: d._count.goals === 0 ? "#d97706" : undefined }}>
                        {d._count.goals}
                      </td>
                      <td style={{ color: hasPending ? "#d97706" : undefined }}>
                        {d._count.goalChanges || "—"}
                      </td>
                      <td>
                        <Link
                          href={`/admin/mentorship/gr/${d.id}`}
                          className="button ghost small"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
