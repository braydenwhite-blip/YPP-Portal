import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  difficultyLabel,
  templateStatusLabel,
} from "@/lib/workshop-proposal-constants";
import type { WorkshopProposalTemplateStatus } from "@prisma/client";

const STATUS_ORDER: WorkshopProposalTemplateStatus[] = [
  "DRAFT",
  "APPROVED",
  "ARCHIVED",
];

const STATUS_DOT: Record<WorkshopProposalTemplateStatus, string> = {
  DRAFT: "var(--border)",
  APPROVED: "#16a34a",
  ARCHIVED: "#71717a",
};

export default async function AdminWorkshopLibraryPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const templates = await withPrismaFallback(
    "admin-workshop-library:templates",
    () =>
      prisma.workshopProposalTemplate.findMany({
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          _count: { select: { submissions: true } },
        },
      }),
    []
  );

  const grouped = new Map<WorkshopProposalTemplateStatus, typeof templates>();
  for (const status of STATUS_ORDER) grouped.set(status, []);
  for (const t of templates) {
    const list = grouped.get(t.status);
    if (list) list.push(t);
  }

  const counts = {
    total: templates.length,
    approved: templates.filter((t) => t.status === "APPROVED").length,
    draft: templates.filter((t) => t.status === "DRAFT").length,
    archived: templates.filter((t) => t.status === "ARCHIVED").length,
    submissions: templates.reduce((s, t) => s + (t._count?.submissions ?? 0), 0),
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Summer Workshop pathway</p>
          <h1 className="page-title">Workshop Library</h1>
          <p className="page-subtitle">
            Curate the workshops Summer Workshop applicants can pick from.
            Only <strong>Approved</strong> templates are visible to applicants
            in the library.
          </p>
        </div>
        <div>
          <Link
            href="/admin/workshop-library/new"
            className="button"
            style={{ textDecoration: "none" }}
          >
            New workshop
          </Link>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{counts.total}</div>
          <div className="kpi-label">Templates</div>
        </div>
        <div className="card">
          <div className="kpi">{counts.approved}</div>
          <div className="kpi-label">Approved &amp; visible</div>
        </div>
        <div className="card">
          <div className="kpi">{counts.draft}</div>
          <div className="kpi-label">In draft</div>
        </div>
        <div className="card">
          <div className="kpi">{counts.submissions}</div>
          <div className="kpi-label">Applicant selections</div>
        </div>
      </div>

      {counts.total === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 32,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>No workshop templates yet</h3>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Templates appear in the applicant library only after you set their
            status to <strong>Approved</strong>. Start with one well-scoped
            workshop and iterate from there.
          </p>
          <Link
            href="/admin/workshop-library/new"
            className="button"
            style={{ textDecoration: "none", marginTop: 8 }}
          >
            Create the first template
          </Link>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {STATUS_ORDER.map((status) => {
          const list = grouped.get(status) ?? [];
          return (
            <div key={status}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: STATUS_DOT[status],
                    display: "inline-block",
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {templateStatusLabel(status)} ({list.length})
                </span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {list.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    {status === "APPROVED"
                      ? "Nothing is visible to applicants yet — approve a draft to start."
                      : status === "DRAFT"
                        ? "No drafts in flight."
                        : "Nothing archived."}
                  </p>
                ) : (
                  list.map((t) => (
                    <Link
                      key={t.id}
                      href={`/admin/workshop-library/${t.id}`}
                      className="card"
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                      }}
                    >
                      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
                        {t.title}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        {t.category} · {t.targetAgeRange} ·{" "}
                        {t.estimatedMinutes} min ·{" "}
                        {difficultyLabel(t.difficulty)}
                      </p>
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: 11,
                          color: "var(--muted)",
                        }}
                      >
                        {t._count?.submissions ?? 0} applicant
                        {(t._count?.submissions ?? 0) === 1 ? "" : "s"} chose this ·
                        Updated {new Date(t.updatedAt).toLocaleDateString()}
                        {t.updatedBy ? ` by ${t.updatedBy.name}` : ""}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
