import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCohorts } from "@/lib/incubator-actions";
import Link from "next/link";
import { CreateCohortForm, CohortStatusButton } from "./client";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6b7280",
  ACCEPTING_APPLICATIONS: "#3b82f6",
  IN_PROGRESS: "#d97706",
  SHOWCASE_PHASE: "#7c3aed",
  COMPLETED: "#16a34a",
  ARCHIVED: "#9ca3af",
};

export default async function AdminIncubatorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const isAdmin = (session.user as any).primaryRole === "ADMIN";
  const isInstructor = (session.user as any).primaryRole === "INSTRUCTOR";
  if (!isAdmin && !isInstructor) redirect("/incubator");

  const cohorts = await getCohorts();

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Manage Incubator</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Create cohorts, review applications, assign mentors
          </p>
        </div>
        <Link href="/incubator" className="button secondary">View Incubator</Link>
      </div>

      {/* Create New Cohort */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Create New Cohort</h3>
        <CreateCohortForm />
      </div>

      {/* Existing Cohorts */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>All Cohorts</h2>
      {(cohorts as any[]).length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(cohorts as any[]).map((cohort) => {
            const color = STATUS_COLORS[cohort.status] || "#6b7280";
            return (
              <div key={cohort.id} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <h3 style={{ margin: 0 }}>{cohort.name}</h3>
                      <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
                        {cohort.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)" }}>
                      <span>{cohort.season} {cohort.year}</span>
                      <span>{new Date(cohort.startDate).toLocaleDateString()} - {new Date(cohort.endDate).toLocaleDateString()}</span>
                      <span>{cohort._count.applications} applications</span>
                      <span>{cohort._count.projects} projects</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Link href={`/admin/incubator/${cohort.id}`} className="button secondary small">
                      Manage
                    </Link>
                    <CohortStatusButton cohortId={cohort.id} currentStatus={cohort.status} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No cohorts yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>Create your first incubator cohort above.</p>
        </div>
      )}
    </div>
  );
}
