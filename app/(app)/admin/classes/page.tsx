import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getAdminClassOperationsList,
  getAdminProposalQueue,
} from "@/lib/admin-class-operations";
import ClassOperationsList from "./class-operations-list";

type SearchParams = { tab?: string; cursor?: string };

export const dynamic = "force-dynamic";

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const tab = params.tab ?? "operations";
  const cursor = params.cursor ?? null;

  const [operationsPage, proposals] = await Promise.all([
    getAdminClassOperationsList({ cursor }),
    getAdminProposalQueue(),
  ]);
  const operations = operationsPage.items;

  // Counts reflect the current page only — admins paginate through the list
  // when there are more than ADMIN_CLASS_LIST_DEFAULT_LIMIT classes.
  const counts = {
    needsReview: proposals.filter((p) =>
      p.approval?.status === "REQUESTED" || p.approval?.status === "UNDER_REVIEW",
    ).length,
    needsRevision: proposals.filter((p) => p.approval?.status === "CHANGES_REQUESTED")
      .length,
    approvedNotPublished: operations.filter((o) => o.actionFlags.approvedNotPublished)
      .length,
    publishedOpen: operations.filter(
      (o) =>
        (o.status === "PUBLISHED" || o.status === "IN_PROGRESS") &&
        o.enrollmentOpen,
    ).length,
    publishedClosed: operations.filter(
      (o) =>
        (o.status === "PUBLISHED" || o.status === "IN_PROGRESS") &&
        !o.enrollmentOpen,
    ).length,
    full: operations.filter((o) => o.actionFlags.full).length,
    waitlists: operations.filter((o) => o.actionFlags.hasWaitlist).length,
    missingLogistics: operations.filter(
      (o) =>
        o.actionFlags.missingLocation ||
        o.actionFlags.missingMeetingLink,
    ).length,
    cancelled: operations.filter((o) => o.actionFlags.isCancelled).length,
    completed: operations.filter((o) => o.actionFlags.isCompleted).length,
  };

  function tabHref(value: string) {
    return `?tab=${value}`;
  }
  function nextPageHref() {
    if (!operationsPage.nextCursor) return null;
    const search = new URLSearchParams();
    search.set("tab", tab);
    search.set("cursor", operationsPage.nextCursor);
    return `?${search.toString()}`;
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Class Operations</p>
          <h1 className="page-title">Class operations</h1>
          <p className="page-subtitle">
            Review proposals, finalize logistics, and oversee rosters across every
            chapter.
          </p>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <SummaryCard label="Awaiting review" value={counts.needsReview} accent="#854d0e" href="?tab=review" />
        <SummaryCard label="Approved, not published" value={counts.approvedNotPublished} accent="#7c2d12" href="?tab=ready" />
        <SummaryCard label="Open for signup" value={counts.publishedOpen} accent="#166534" href="?tab=operations" />
        <SummaryCard label="Logistics gaps" value={counts.missingLogistics} accent="#9f1239" href="?tab=operations" />
      </div>

      <nav style={tabBarStyle}>
        <TabLink href="?tab=operations" current={tab} value="operations">
          Operations ({operations.length})
        </TabLink>
        <TabLink href="?tab=review" current={tab} value="review">
          Review queue ({counts.needsReview + counts.needsRevision})
        </TabLink>
        <TabLink href="?tab=ready" current={tab} value="ready">
          Ready to publish ({counts.approvedNotPublished})
        </TabLink>
        <TabLink href="?tab=full" current={tab} value="full">
          Full / waitlist ({counts.full + counts.waitlists})
        </TabLink>
        <TabLink href="?tab=logistics" current={tab} value="logistics">
          Logistics gaps ({counts.missingLogistics})
        </TabLink>
        <TabLink href="?tab=archive" current={tab} value="archive">
          Cancelled / completed ({counts.cancelled + counts.completed})
        </TabLink>
      </nav>

      <ClassOperationsList tab={tab} operations={operations} proposals={proposals} />

      {nextPageHref() && tab !== "review" && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link href={nextPageHref()!} className="button" style={{ fontSize: 13 }}>
            Load older classes →
          </Link>
          <p
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "var(--text-secondary)",
            }}
          >
            Showing {operations.length} of many. Pagination is by last
            updated, descending.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent: string;
  href: string;
}) {
  return (
    <Link href={href} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div className="kpi" style={{ color: accent }}>{value}</div>
      <div className="kpi-label">{label}</div>
    </Link>
  );
}

function TabLink({
  href,
  current,
  value,
  children,
}: {
  href: string;
  current: string;
  value: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={href}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "#fff" : "var(--text-secondary)",
        background: active ? "var(--ypp-purple, #6b21c8)" : "transparent",
        border: active ? "none" : "1px solid var(--border)",
      }}
    >
      {children}
    </Link>
  );
}

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 20,
};
