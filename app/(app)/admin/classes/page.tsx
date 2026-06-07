import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getAdminClassOperationsList,
  getAdminProposalQueue,
} from "@/lib/admin-class-operations";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { StatCard } from "@/components/people-strategy/stat-card";
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

  const TABS: Array<{ value: string; label: string; count: number }> = [
    { value: "operations", label: "Operations", count: operations.length },
    { value: "review", label: "Review queue", count: counts.needsReview + counts.needsRevision },
    { value: "ready", label: "Ready to publish", count: counts.approvedNotPublished },
    { value: "full", label: "Full / waitlist", count: counts.full + counts.waitlists },
    { value: "logistics", label: "Logistics gaps", count: counts.missingLogistics },
    { value: "archive", label: "Cancelled / completed", count: counts.cancelled + counts.completed },
  ];

  return (
    <div className="ps-page psuite">
      <ActionCommandBar
        eyebrow="Admin · Class Operations"
        title="Class Operations"
        subtitle="Review proposals, finalize logistics, and oversee rosters across every chapter — one command center for the whole catalog."
        meta={`${operations.length} classes on this page · ${counts.publishedOpen} open for signup`}
      />

      <div className="psuite-stat-strip">
        <StatCard
          label="Awaiting review"
          value={counts.needsReview}
          icon="clock"
          tone={counts.needsReview > 0 ? "warning" : "default"}
          href="?tab=review"
        />
        <StatCard
          label="Ready to publish"
          value={counts.approvedNotPublished}
          icon="layers"
          tone="accent"
          href="?tab=ready"
        />
        <StatCard
          label="Open for signup"
          value={counts.publishedOpen}
          icon="check"
          tone="success"
          href="?tab=operations"
        />
        <StatCard
          label="Full / waitlist"
          value={counts.full + counts.waitlists}
          icon="users"
          href="?tab=full"
        />
        <StatCard
          label="Logistics gaps"
          value={counts.missingLogistics}
          icon="alert"
          tone={counts.missingLogistics > 0 ? "danger" : "default"}
          href="?tab=logistics"
        />
      </div>

      <nav aria-label="Class operations views" className="ps-tabs">
        {TABS.map((t) =>
          t.value === tab ? (
            <span key={t.value} className="ps-tab" aria-current="page">
              {t.label} ({t.count})
            </span>
          ) : (
            <Link key={t.value} href={tabHref(t.value)} className="ps-tab">
              {t.label} ({t.count})
            </Link>
          ),
        )}
      </nav>

      <div style={{ marginTop: 18 }}>
        <ClassOperationsList tab={tab} operations={operations} proposals={proposals} />
      </div>

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
