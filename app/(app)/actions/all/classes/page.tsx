import { notFound, redirect } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { hasRole } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
} from "@/lib/feature-flags";
import { listTrackerClasses, type TrackerClass } from "@/lib/people-strategy/class-tracker";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { ClassTrackerRow } from "@/components/people-strategy/class-tracker-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · Classes" };

export default async function ActionTrackerClassesPage() {
  // Outer gate: with ENABLE_ACTION_TRACKER off the route does not exist.
  if (!isActionTrackerEnabled()) notFound();

  // Officer-tier and above only (same gate as All Actions). Deny others with a
  // 404 so the route's existence is not leaked.
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  if (hasRole(viewer.roles, "ADMIN", viewer.primaryRole ?? null)) {
    redirect("/people/classes");
  }

  const classes = await listTrackerClasses();

  // Group by chapter (the class org unit), mirroring the department grouping on
  // All Actions. Classes keep the soonest-start ordering within each group.
  const groups = new Map<string, TrackerClass[]>();
  for (const offering of classes) {
    const key = offering.chapter?.name ?? "Unassigned";
    const bucket = groups.get(key);
    if (bucket) bucket.push(offering);
    else groups.set(key, [offering]);
  }
  const grouped = Array.from(groups.entries())
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      {/* Header */}
      <div
        className="topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="badge">Admin · People Strategy</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Action Tracker
          </h1>
          <p className="page-subtitle">
            Live class offerings with their lead and executing instructors — read-only, sourced from the Classes system.
          </p>
        </div>
      </div>

      <ActionTrackerTabsV2 active="classes" />

      <div
        className="card"
        style={{
          marginTop: 16,
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--muted)",
          background: "var(--ps-accent-soft)",
        }}
      >
        Click any class to see its partner, relationship lead, and instructors. Rows here are
        read-only; full editing lives in the Classes area.
      </div>

      {classes.length === 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <p style={{ margin: 0 }}>No active class offerings right now.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
          {grouped.map((group) => (
            <section key={group.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>
                  {group.name}
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {group.items.length} {group.items.length === 1 ? "class" : "classes"}
                </span>
              </div>
              {group.items.map((offering) => (
                <ClassTrackerRow
                  key={offering.id}
                  offering={offering}
                  detailHref={`/actions/all/classes/${offering.id}`}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
