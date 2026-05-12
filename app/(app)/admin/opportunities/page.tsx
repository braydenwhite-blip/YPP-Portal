import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getAssignmentDashboardSummary,
  listOpportunities,
  type OpportunityListFilters,
} from "@/lib/workshop-opportunity-queries";
import OpportunityRow from "./opportunity-row";

type SearchParams = {
  tab?: string;
  status?: string;
  urgency?: string;
  type?: string;
  q?: string;
};

export const dynamic = "force-dynamic";

const TAB_FILTERS: Record<string, OpportunityListFilters> = {
  needs_attention: { activeOnly: true },
  open: { status: "OPEN" },
  confirmed: { status: "CONFIRMED" },
  drafts: { status: "DRAFT" },
  archive: { status: "ARCHIVED" },
  all: {},
};

export default async function AdminOpportunitiesPage({
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
  const tab = params.tab && TAB_FILTERS[params.tab] ? params.tab : "needs_attention";

  const baseFilter = TAB_FILTERS[tab] ?? {};
  const filters: OpportunityListFilters = {
    ...baseFilter,
    ...(params.status ? { status: params.status as OpportunityListFilters["status"] } : {}),
    ...(params.urgency ? { urgency: params.urgency as OpportunityListFilters["urgency"] } : {}),
    ...(params.type ? { type: params.type as OpportunityListFilters["type"] } : {}),
    ...(params.q ? { search: params.q } : {}),
  };

  const [summary, opportunities] = await Promise.all([
    getAssignmentDashboardSummary(),
    listOpportunities(filters),
  ]);

  // Tab-specific filtering: "needs_attention" should only include rows where
  // needsAttention === true, regardless of underlying status.
  const filteredRows =
    tab === "needs_attention"
      ? opportunities.filter((op) => op.needsAttention)
      : opportunities;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Assignment operations</p>
          <h1 className="page-title">Workshop & camp assignments</h1>
          <p className="page-subtitle">
            Track partner programs, see which slots are uncovered, and shortlist
            instructors. Phase 1 is admin-only — instructors will see their
            assignments here once Phase 2 ships.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/admin/opportunities/new" className="button">
            + New opportunity
          </Link>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <SummaryCard
          label="Open opportunities"
          value={summary.open}
          accent="#1d4ed8"
          href="?tab=open"
        />
        <SummaryCard
          label="Uncovered slots"
          value={summary.uncovered}
          accent="#9f1239"
          href="?tab=needs_attention"
        />
        <SummaryCard
          label="Pending confirmation"
          value={summary.pendingConfirmation}
          accent="#854d0e"
          href="?tab=needs_attention"
        />
        <SummaryCard
          label="Upcoming (30 days)"
          value={summary.upcoming}
          accent="#166534"
          href="?tab=open"
        />
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <SummaryCard
          label="Urgent"
          value={summary.urgent}
          accent="#b91c1c"
          href="?tab=needs_attention&urgency=URGENT"
        />
        <SummaryCard
          label="Confirmed assignments"
          value={summary.confirmed}
          accent="#15803d"
          href="?tab=confirmed"
        />
        <SummaryCard
          label="Overloaded instructors"
          value={summary.overloadedInstructors}
          accent="#a16207"
          href="?tab=needs_attention"
        />
        <SummaryCard
          label="Drafts"
          value={null}
          accent="#525252"
          href="?tab=drafts"
        />
      </div>

      <nav style={tabBarStyle}>
        <TabLink current={tab} value="needs_attention">
          Needs attention ({summary.uncovered + summary.urgent})
        </TabLink>
        <TabLink current={tab} value="open">
          Open
        </TabLink>
        <TabLink current={tab} value="confirmed">
          Confirmed
        </TabLink>
        <TabLink current={tab} value="drafts">
          Drafts
        </TabLink>
        <TabLink current={tab} value="all">
          All active
        </TabLink>
        <TabLink current={tab} value="archive">
          Archive
        </TabLink>
      </nav>

      <form method="get" style={filterBarStyle}>
        <input type="hidden" name="tab" value={tab} />
        <input
          type="search"
          name="q"
          placeholder="Search partner, title, or city…"
          defaultValue={params.q ?? ""}
          style={{
            flex: "1 1 220px",
            minWidth: 200,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 13,
          }}
        />
        <select name="urgency" defaultValue={params.urgency ?? ""} style={selectStyle}>
          <option value="">Any urgency</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </select>
        <select name="type" defaultValue={params.type ?? ""} style={selectStyle}>
          <option value="">Any type</option>
          <option value="SUMMER_CAMP">Summer camp</option>
          <option value="PARTNER_PROGRAM">Partner program</option>
          <option value="ONE_TIME_WORKSHOP">One-time workshop</option>
          <option value="MULTI_DAY_CAMP">Multi-day camp</option>
          <option value="CHAPTER_CLASS_SERIES">Chapter class series</option>
          <option value="ONLINE_WORKSHOP">Online workshop</option>
          <option value="OTHER">Other</option>
        </select>
        <button type="submit" className="button small">
          Filter
        </button>
      </form>

      {filteredRows.length === 0 ? (
        <div className="empty">
          <p>No opportunities match these filters.</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            Create one to get started, or try the “All active” tab.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Type / location</th>
                <th>When</th>
                <th>Coverage</th>
                <th>Urgency</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((op) => (
                <OpportunityRow key={op.id} row={op} />
              ))}
            </tbody>
          </table>
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
  value: number | null;
  accent: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card"
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <div className="kpi" style={{ color: accent }}>
        {value ?? "—"}
      </div>
      <div className="kpi-label">{label}</div>
    </Link>
  );
}

function TabLink({
  current,
  value,
  children,
}: {
  current: string;
  value: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={`?tab=${value}`}
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
  marginBottom: 16,
};

const filterBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 16,
  alignItems: "center",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13,
  background: "white",
};
