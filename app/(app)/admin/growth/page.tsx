import { notFound } from "next/navigation";

import { requireLeadership } from "@/lib/authorization";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { getGrowthAdminOverview } from "@/lib/growth/admin-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Growth — Leadership Dashboard" };

export default async function AdminGrowthPage() {
  // Outer gate: with ENABLE_GROWTH_OS off the route does not exist.
  if (!isGrowthOsEnabled()) notFound();

  // Leadership / admin only; deny with 404 so the route is not leaked.
  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) notFound();

  const overview = await getGrowthAdminOverview();
  const maxCategory = Math.max(1, ...overview.achievementsByCategory.map((c) => c.count));
  const maxTrack = Math.max(1, ...overview.eventsByTrack.map((t) => t.count));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Student Operating System</p>
          <h1 className="page-title">Growth — Leadership Dashboard</h1>
          <p className="page-subtitle">
            How the whole population is growing. Foundation analytics — built to grow.
          </p>
        </div>
      </div>

      {/* Totals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginTop: 8,
        }}
      >
        <Stat label="Active learners" value={overview.activeLearners} />
        <Stat label="Growth profiles" value={overview.totals.profiles} />
        <Stat label="Visions" value={overview.totals.visions} />
        <Stat label="Goals" value={overview.totals.goals} />
        <Stat label="Actions" value={overview.totals.actions} />
        <Stat label="Achievements" value={overview.totals.achievements} />
        <Stat label="Progress events" value={overview.totals.events} />
        <Stat label="Open opportunities" value={overview.totals.openOpportunities} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 24,
        }}
      >
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Achievements by dimension</h2>
          <div className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
            {overview.achievementsByCategory.map((c) => (
              <Bar key={c.category} label={c.label} value={c.count} max={maxCategory} />
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Progress events by track</h2>
          <div className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
            {overview.eventsByTrack.map((t) => (
              <Bar key={t.track} label={t.label} value={t.count} max={maxTrack} />
            ))}
          </div>
        </section>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Most-suggested opportunities</h2>
        {overview.topOpportunities.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No open opportunities across the population yet.</p>
        ) : (
          <div className="card" style={{ padding: 14 }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Opportunity key</th>
                  <th style={{ textAlign: "right" }}>Students</th>
                </tr>
              </thead>
              <tbody>
                {overview.topOpportunities.map((o) => (
                  <tr key={o.key}>
                    <td style={{ fontFamily: "monospace", fontSize: 13 }}>{o.key}</td>
                    <td style={{ textAlign: "right" }}>{o.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 130, fontSize: 13 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 18,
          background: "var(--border, #e5e7eb)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--accent, #4f46e5)",
          }}
        />
      </div>
      <span style={{ width: 32, textAlign: "right", fontSize: 13 }}>{value}</span>
    </div>
  );
}
