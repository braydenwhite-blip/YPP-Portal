import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import { loadResponsibilityMap } from "@/lib/people-strategy/responsibility";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import { MOMENTUM_META } from "@/lib/people-strategy/momentum";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { Pill } from "@/components/people-strategy/pills";
import { GrowthTagEditor } from "@/components/people-strategy/growth-tag-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Responsibility Map · People Strategy" };

const RISK_TONE = { high: "overdue", medium: "warning", low: "info" } as const;
const RISK_BORDER = {
  high: "var(--error-color)",
  medium: "var(--warning-color)",
  low: "var(--ypp-purple)",
} as const;

export default async function ResponsibilityMapPage() {
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const { rows, risks } = await loadResponsibilityMap(viewer, now);
  const showPeople = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);

  return (
    <div className="page-shell" style={{ maxWidth: 1100 }}>
      <div>
        <p className="badge">People Strategy · Leadership</p>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Responsibility Map
        </h1>
        <p className="page-subtitle">
          Who owns what, who is overloaded, who has capacity — and where each person
          sits on the growth pipeline.
        </p>
      </div>

      <ActionTrackerTabs active="responsibility" showPeople={showPeople} />

      {/* People Risk Radar */}
      <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>
            People Risk Radar
          </h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Act before a problem becomes an emergency
          </span>
        </div>
        {risks.length === 0 ? (
          <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
            No risk signals right now — no one is overloaded, disengaging, or stalled. 🎉
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {risks.map((risk) => (
              <div
                key={risk.id}
                className="card"
                style={{
                  padding: "10px 14px",
                  flex: "1 1 280px",
                  minWidth: 240,
                  borderLeft: `3px solid ${RISK_BORDER[risk.severity]}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <strong style={{ fontSize: 14 }}>{risk.name}</strong>
                  <Pill tone={RISK_TONE[risk.severity]}>{risk.severity}</Pill>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>{risk.reason}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Responsibility table */}
      <section style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>
          Leaders &amp; Responsibilities
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Everyone who currently leads or executes action work. Tag people to track
          where they are on the leadership pipeline — it feeds the Risk Radar.
        </p>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
            No owners yet. Assign leads and executors to populate the map.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((row) => {
              const meta = MOMENTUM_META[row.momentum.label];
              return (
                <div key={row.id} className="card" style={{ padding: "12px 14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <strong style={{ fontSize: 14 }}>{row.name}</strong>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {row.departments.length > 0 ? row.departments.join(" · ") : "No department yet"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {row.overloaded ? <Pill tone="warning">Heavy load</Pill> : null}
                      {row.underutilized ? <Pill tone="neutral">Has capacity</Pill> : null}
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                    {row.openCount} open · {row.completedRecent} done (14d) · {row.overdue} overdue
                    {row.flagged > 0 ? ` · ${row.flagged} flagged` : ""}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <GrowthTagEditor userId={row.id} tags={row.growthTags} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p style={{ marginTop: 20, fontSize: 12, color: "var(--muted)" }}>
        Looking for individual reviews and check-ins? See the{" "}
        <Link href="/actions/people">People Dashboard</Link>.
      </p>
    </div>
  );
}
