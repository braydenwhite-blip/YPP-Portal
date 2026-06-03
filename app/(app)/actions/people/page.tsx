import { notFound } from "next/navigation";

import { requireCPO } from "@/lib/authorization";
import {
  isActionTrackerEmailsEnabled,
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import {
  collectDepartments,
  loadPeopleDashboard,
} from "@/lib/people-strategy/people-dashboard";
import { loadCpoEscalationQueue } from "@/lib/people-strategy/escalation-queue";
import { isBoard } from "@/lib/people-strategy/action-permissions";
import { PeopleDashboardTable } from "@/components/people-strategy/people-dashboard-table";
import { EscalationQueue } from "@/components/people-strategy/escalation-queue";
import Link from "next/link";

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

  // CPO Escalation Queue — flagged/overdue items unresolved for 48h+. Behind
  // ENABLE_ACTION_TRACKER; the loader returns [] when the flag is off so the
  // section simply doesn't render.
  const showEscalationQueue = isActionTrackerEnabled();
  const escalations = showEscalationQueue ? await loadCpoEscalationQueue() : [];

  // Board (SUPER_ADMIN) additionally sees a link to the Board Escalation
  // Roll-up list. A plain CPO does not — the destination route enforces this
  // server-side via requireBoard(); this only gates the affordance.
  const showBoardRollupLink = showEscalationQueue && isBoard(viewer);

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

      {showBoardRollupLink && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <Link
            href="/actions/people/board-rollup"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#991b1b",
              textDecoration: "none",
            }}
          >
            View Board Escalation Roll-up →
          </Link>
        </div>
      )}

      {showEscalationQueue && <EscalationQueue rows={escalations} />}

      <PeopleDashboardTable
        rows={rows}
        departments={departments}
        canRequestFeedback={canRequestFeedback}
      />
    </div>
  );
}
