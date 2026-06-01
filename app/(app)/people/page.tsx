import { notFound } from "next/navigation";

import { requireCPO } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import {
  collectDepartments,
  loadPeopleDashboard,
} from "@/lib/people-strategy/people-dashboard";
import { PeopleDashboardTable } from "@/components/people-strategy/people-dashboard-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · CPO People View" };

export default async function PeopleDashboardPage() {
  // Outer gate: with ENABLE_PEOPLE_DASHBOARD off the route does not exist.
  if (!isPeopleDashboardEnabled()) notFound();

  // CPO / Board only. requireCPO() throws "Unauthorized" for everyone else
  // (and unauthenticated requests, which the proxy already redirects). Deny
  // with a 404 so the route's existence is not leaked to non-CPO users.
  const viewer = await requireCPO().catch(() => null);
  if (!viewer) notFound();

  const rows = await loadPeopleDashboard();
  const departments = collectDepartments(rows);

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      {/* Header banner */}
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
          <p className="badge">Action Tracker · CPO View</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            People Dashboard
          </h1>
          <p className="page-subtitle">
            Full access — <strong>CPO and Board only</strong>. Live succession &amp; people-health
            view compiled from the Action Tracker, Quarterly Reviews, and Monthly Check-Ins.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button outline small" disabled title="Coming soon">
            Request Monthly Feedback
          </button>
        </div>
      </div>

      <PeopleDashboardTable rows={rows} departments={departments} />
    </div>
  );
}
