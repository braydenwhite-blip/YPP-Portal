import { notFound } from "next/navigation";

import { requireLeadership } from "@/lib/authorization";
import {
  isActionTrackerEmailsEnabled,
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import {
  collectDepartments,
  loadPeopleDashboard,
} from "@/lib/people-strategy/people-dashboard";
import { listActionDepartments } from "@/lib/people-strategy/action-queries";
import { loadLeadershipEscalationQueue } from "@/lib/people-strategy/escalation-queue";
import { loadMentorshipHealth } from "@/lib/people-strategy/mentorship-health";
import { isBoard } from "@/lib/people-strategy/action-permissions";
import { PeopleDashboardTable } from "@/components/people-strategy/people-dashboard-table";
import { EscalationQueue } from "@/components/people-strategy/escalation-queue";
import { MentorshipHealthSection } from "@/components/people-strategy/mentorship-health-section";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · Leadership People View" };

export default async function PeopleDashboardPage() {
  // Outer gate: with ENABLE_PEOPLE_DASHBOARD off the route does not exist.
  if (!isPeopleDashboardEnabled()) notFound();

  // Leadership / Board only. requireLeadership() throws "Unauthorized" for everyone
  // else (and unauthenticated requests, which the proxy already redirects).
  // Deny with a 404 so the route's existence is not leaked to other users.
  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) notFound();

  const rows = await loadPeopleDashboard();
  // Department filter options come from the Department table (the canonical
  // standing departments), unioned with any names present on the rows, rather
  // than being derived purely from free-text on the action items.
  const standingDepartments = await listActionDepartments();
  const departments = Array.from(
    new Set([
      ...standingDepartments.map((d) => d.name),
      ...collectDepartments(rows),
    ])
  ).sort();

  // Leadership Escalation Queue — flagged/overdue items unresolved for 48h+.
  // Behind ENABLE_ACTION_TRACKER; the loader returns [] when the flag is off so
  // the section simply doesn't render.
  const showEscalationQueue = isActionTrackerEnabled();
  const escalations = showEscalationQueue ? await loadLeadershipEscalationQueue() : [];

  // Mentorship health roll-up (#12) — read-only over the Mentorship models.
  const mentorshipHealth = await loadMentorshipHealth();

  // Board (SUPER_ADMIN) additionally sees a link to the Board Escalation
  // Roll-up list. Plain Leadership does not — the destination route enforces
  // this server-side via requireBoard(); this only gates the affordance.
  const showBoardRollupLink = showEscalationQueue && isBoard(viewer);

  // The Request Monthly Feedback action needs BOTH the dashboard flag (already
  // checked above) and the emails flag. When emails are off the button is hidden
  // and the server action refuses regardless.
  const canRequestFeedback = isActionTrackerEmailsEnabled();

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      {/* Back-link + tabs so the People Dashboard is no longer a navigation
          trap — every Action Tracker subview can be reached from here. */}
      <Link
        href="/actions/all"
        style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}
      >
        ← Action Tracker
      </Link>
      <ActionTrackerTabs active="people" showPeople />

      {/* Header banner */}
      <ActionCommandBar
        eyebrow="Action Tracker · Leadership View"
        title="People Dashboard"
        subtitle={
          <>
            Full access — <strong>Leadership and Board only</strong>. Live succession &amp;
            people-health view compiled from the Action Tracker, Quarterly Reviews, and Monthly
            Check-Ins.
          </>
        }
        meta={`${rows.length} ${rows.length === 1 ? "member" : "members"} tracked`}
        actions={
          <span style={{ fontSize: 12, color: "var(--ps-ink-soft)", maxWidth: 240, textAlign: "right" }}>
            {canRequestFeedback
              ? "Select members below, then Request Monthly Feedback. Responses stay Leadership/Board-confidential."
              : "Set ENABLE_ACTION_TRACKER_EMAILS to request monthly feedback."}
          </span>
        }
      />

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

      <MentorshipHealthSection health={mentorshipHealth} />

      <PeopleDashboardTable
        rows={rows}
        departments={departments}
        canRequestFeedback={canRequestFeedback}
      />
    </div>
  );
}
