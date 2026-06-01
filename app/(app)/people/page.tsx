import { notFound } from "next/navigation";

import { requireCPO } from "@/lib/authorization";
import {
  isActionTrackerEmailsEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
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

  // The Request Monthly Feedback action needs BOTH the dashboard flag (already
  // checked above) and the emails flag. When emails are off the button is hidden
  // and the server action refuses regardless.
  const canRequestFeedback = isActionTrackerEmailsEnabled();

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b", maxWidth: 240, textAlign: "right" }}>
            {canRequestFeedback
              ? "Select members below, then Request Monthly Feedback. Responses stay CPO/Board-confidential."
              : "Set ENABLE_ACTION_TRACKER_EMAILS to request monthly feedback."}
          </span>
        </div>
      </div>

      <PeopleDashboardTable
        rows={rows}
        departments={departments}
        canRequestFeedback={canRequestFeedback}
      />
    </div>
  );
}
