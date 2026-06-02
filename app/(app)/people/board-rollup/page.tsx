import Link from "next/link";
import { notFound } from "next/navigation";

import { requireBoard } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { loadBoardRollupList } from "@/lib/people-strategy/board-rollup";
import { BoardRollupList } from "@/components/people-strategy/board-rollup-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · Board Escalation Roll-up" };

export default async function BoardRollupPage() {
  // Outer gate: behind ENABLE_ACTION_TRACKER the route does not exist.
  if (!isActionTrackerEnabled()) notFound();

  // Board only. requireBoard() throws "Unauthorized" for everyone else —
  // including a plain CPO (CPO subtype without SUPER_ADMIN). Deny with a 404 so
  // the route's existence is not leaked to non-Board users.
  const viewer = await requireBoard().catch(() => null);
  if (!viewer) notFound();

  const rows = await loadBoardRollupList();

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
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
          <p className="badge">Action Tracker · Board View</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Board Escalation Roll-up
          </h1>
          <p className="page-subtitle">
            <strong>Board only.</strong> CPO escalations that have remained
            unresolved for 7+ days after reaching the CPO, with full history.
          </p>
        </div>
        <Link
          href="/people"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#6b21c8",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          ← People Dashboard
        </Link>
      </div>

      <BoardRollupList rows={rows} />
    </div>
  );
}
