import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getMyActivities, generateCommonAppExport } from "@/lib/college-activity-actions";
import { ACTIVITY_CATEGORY_CONFIG as CATEGORY_CONFIG } from "@/lib/college-activity-config";
import ActivitiesClient from "./activities-client";
import Link from "next/link";

export const metadata = { title: "Activities Builder — YPP" };

export default async function ActivitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [activities, commonAppExport] = await Promise.all([
    getMyActivities(),
    generateCommonAppExport(),
  ]);

  const allActivities = activities ?? [];
  const totalHoursPerWeek = allActivities.reduce((sum, a) => sum + (a.hoursPerWeek ?? 0), 0);
  const yppActivities = allActivities.filter((a) => a.isYppActivity);

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">College Advisor</p>
          <h1 className="page-title">Activities &amp; Extracurricular Builder</h1>
          <p className="page-subtitle">
            {allActivities.length}/10 activities · {totalHoursPerWeek.toFixed(1)} hrs/week total
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <ActivitiesClient mode="populate-ypp-button" />
          <Link href="/college-advisor/roadmap" className="button secondary small">
            ← Roadmap
          </Link>
        </div>
      </div>

      {/* Common App progress bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>Common App Slots</p>
          <span className="pill" style={{ fontSize: "0.72rem" }}>
            {allActivities.length}/10 used
          </span>
        </div>
        <div style={{ height: "8px", background: "var(--surface-alt)", borderRadius: "99px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (allActivities.length / 10) * 100)}%`,
              background: allActivities.length >= 10 ? "#16a34a" : "var(--ypp-purple-500)",
              borderRadius: "99px",
            }}
          />
        </div>
        {allActivities.length >= 10 && (
          <p style={{ fontSize: "0.78rem", color: "#16a34a", marginTop: "0.4rem", fontWeight: 600 }}>
            All 10 Common App slots filled!
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>
        {/* Activity List */}
        <div>
          {yppActivities.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.05em" }}>
                YPP PROGRAM ACTIVITIES
              </p>
              {yppActivities.map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
            </div>
          )}

          {allActivities.filter((a) => !a.isYppActivity).length > 0 && (
            <div>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 700, marginBottom: "0.5rem", letterSpacing: "0.05em" }}>
                MY ACTIVITIES
              </p>
              {allActivities
                .filter((a) => !a.isYppActivity)
                .map((a) => (
                  <ActivityCard key={a.id} activity={a} />
                ))}
            </div>
          )}

          {allActivities.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</p>
              <p style={{ marginBottom: "1rem" }}>No activities yet. Add your first or import from YPP!</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Add Activity Form */}
          {allActivities.length < 10 && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>Add Activity</p>
              <ActivitiesClient mode="add-activity-form" categoryConfig={CATEGORY_CONFIG} />
            </div>
          )}

          {/* Common App Export */}
          {commonAppExport && commonAppExport.length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}>Common App Preview</p>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                Top {commonAppExport.length} activities in Common App format
              </p>
              <ActivitiesClient mode="export-button" exportData={commonAppExport} />
              <div style={{ marginTop: "0.75rem" }}>
                {commonAppExport.map((entry) => (
                  <div
                    key={entry.position}
                    style={{
                      padding: "0.5rem 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", marginBottom: "0.15rem" }}>
                      <span style={{ fontWeight: 700, color: "var(--muted)" }}>{entry.position}.</span>
                      <span style={{ fontWeight: 600 }}>{entry.positionTitle}</span>
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{entry.organizationName}</p>
                    <p style={{ color: "var(--text)", marginTop: "0.1rem", lineHeight: 1.4 }}>
                      {entry.description.slice(0, 80)}{entry.description.length > 80 ? "…" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Activity = NonNullable<Awaited<ReturnType<typeof getMyActivities>>>[number];

function ActivityCard({ activity: a }: { activity: Activity }) {
  const cfg = a.categoryConfig;
  return (
    <div
      className="card"
      style={{
        marginBottom: "0.75rem",
        borderLeft: a.isYppActivity ? "3px solid var(--ypp-purple-500)" : "3px solid var(--border)",
        padding: "0.875rem 1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>{cfg.emoji}</span>
            <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{a.name}</p>
            {a.isYppActivity && (
              <span className="pill" style={{ fontSize: "0.62rem", background: "#ede9fe", color: "#7c3aed" }}>YPP</span>
            )}
          </div>
          {a.role && (
            <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{a.role}{a.organization ? ` · ${a.organization}` : ""}</p>
          )}
        </div>
        <span className="pill" style={{ fontSize: "0.65rem", flexShrink: 0 }}>{cfg.label}</span>
      </div>

      {a.description && (
        <p style={{ fontSize: "0.8rem", color: "var(--text)", marginBottom: "0.35rem", lineHeight: 1.5 }}>
          {a.description}
        </p>
      )}

      {a.impactStatement && (
        <p style={{ fontSize: "0.78rem", color: "#0369a1", fontStyle: "italic", marginBottom: "0.35rem" }}>
          💡 {a.impactStatement}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.72rem", color: "var(--muted)" }}>
        {a.hoursPerWeek && <span>{a.hoursPerWeek}h/week</span>}
        {a.weeksPerYear && <span>{a.weeksPerYear} wks/year</span>}
        {a.isOngoing && <span style={{ color: "#16a34a" }}>● Ongoing</span>}
        {a.milestones.length > 0 && <span>{a.milestones.length} milestone{a.milestones.length > 1 ? "s" : ""}</span>}
      </div>

      {!a.isYppActivity && (
        <div style={{ marginTop: "0.5rem" }}>
          <ActivitiesClient mode="delete-button" activityId={a.id} />
        </div>
      )}
    </div>
  );
}
