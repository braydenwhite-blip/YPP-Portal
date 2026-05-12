import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  getAssignmentDashboardCounts,
  getAssignmentDashboardRows,
} from "@/lib/regular-instructor-assignments";
import AssignmentsBoard from "./assignments-board";
import ChapterFilter from "./chapter-filter";

type SearchParams = {
  chapter?: string;
  coverage?: string;
};

export const dynamic = "force-dynamic";

export default async function AdminInstructorAssignmentsPage({
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
  const chapterId = params.chapter && params.chapter !== "all" ? params.chapter : null;
  const coverage = params.coverage ?? "all";

  const [counts, rows, chapters] = await Promise.all([
    getAssignmentDashboardCounts(),
    getAssignmentDashboardRows({
      chapterId,
      status:
        coverage === "uncovered"
          ? "UNCOVERED"
          : coverage === "partial"
            ? "PARTIAL"
            : coverage === "covered"
              ? "COVERED"
              : null,
    }),
    withPrismaFallback(
      "admin-instructor-assignments:chapters",
      () =>
        prisma.chapter.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      []
    ),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Regular instructors</p>
          <h1 className="page-title">Instructor assignments</h1>
          <p className="page-subtitle">
            Assign regular instructors to class offerings, track coverage, and
            see who is ready to teach.
          </p>
        </div>
        <div>
          <Link
            href="/admin/instructor-assignments/new"
            className="button"
            style={{ background: "var(--ypp-purple, #6b21c8)", color: "#fff" }}
          >
            + New assignment
          </Link>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <SummaryCard
          label="Uncovered offerings"
          value={counts.uncovered}
          accent="#9f1239"
          href="?coverage=uncovered"
        />
        <SummaryCard
          label="Partially covered"
          value={counts.partial}
          accent="#854d0e"
          href="?coverage=partial"
        />
        <SummaryCard
          label="Fully covered"
          value={counts.covered}
          accent="#166534"
          href="?coverage=covered"
        />
        <SummaryCard
          label="Awaiting confirmation"
          value={counts.pendingConfirmation}
          accent="#1e3a8a"
          href="?coverage=all"
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <span
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}
        >
          Coverage:
        </span>
        <FilterLink current={coverage} value="all" label={`All (${counts.totalOfferings})`} />
        <FilterLink
          current={coverage}
          value="uncovered"
          label={`Uncovered (${counts.uncovered})`}
        />
        <FilterLink
          current={coverage}
          value="partial"
          label={`Partial (${counts.partial})`}
        />
        <FilterLink
          current={coverage}
          value="covered"
          label={`Covered (${counts.covered})`}
        />

        <div style={{ marginLeft: "auto" }}>
          <ChapterFilter
            chapters={chapters}
            selected={chapterId}
            coverage={coverage}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            No class offerings match these filters. Try clearing the filters or
            create a new offering in{" "}
            <Link href="/admin/classes">Class operations</Link>.
          </p>
        </div>
      ) : (
        <AssignmentsBoard rows={rows} />
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
    <Link
      href={href}
      className="card"
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <div className="kpi" style={{ color: accent }}>
        {value}
      </div>
      <div className="kpi-label">{label}</div>
    </Link>
  );
}

function FilterLink({
  current,
  value,
  label,
}: {
  current: string;
  value: string;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={value === "all" ? "?" : `?coverage=${value}`}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textDecoration: "none",
        color: active ? "#fff" : "var(--text-secondary)",
        background: active ? "var(--ypp-purple, #6b21c8)" : "transparent",
        border: active ? "none" : "1px solid var(--border)",
      }}
    >
      {label}
    </Link>
  );
}

