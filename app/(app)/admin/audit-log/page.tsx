import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@prisma/client";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { action?: string; search?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const page = Number(searchParams.page) || 1;
  const perPage = 30;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {};
  if (searchParams.action) {
    where.action = searchParams.action;
  }
  if (searchParams.search) {
    where.description = {
      contains: searchParams.search,
      mode: "insensitive",
    };
  }

  const [logs, total, stats24h, stats7d] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Audit Log / Activity Feed</h1>
        </div>
      </div>

      <div className="grid three">
        <div className="card">
          <div className="kpi">{total}</div>
          <div className="kpi-label">Total Events</div>
        </div>
        <div className="card">
          <div className="kpi">{stats24h}</div>
          <div className="kpi-label">Last 24 Hours</div>
        </div>
        <div className="card">
          <div className="kpi">{stats7d}</div>
          <div className="kpi-label">Last 7 Days</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Search & Filter</h3>
        <form className="form-grid" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="form-row" style={{ flex: 1, minWidth: 200 }}>
            Search
            <input
              className="input"
              name="search"
              placeholder="Search descriptions..."
              defaultValue={searchParams.search || ""}
            />
          </label>
          <label className="form-row" style={{ minWidth: 180 }}>
            Action Type
            <select className="input" name="action" defaultValue={searchParams.action || ""}>
              <option value="">All Actions</option>
              {Object.values(AuditAction).map((action) => (
                <option key={action} value={action}>
                  {action.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit" style={{ height: 40 }}>
            Filter
          </button>
          <a href="/admin/audit-log" className="button secondary" style={{ height: 40, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Clear
          </a>
        </form>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3>Activity History ({total} events)</h3>
          <a
            href="/api/export?table=audit-logs&format=csv"
            className="button small secondary"
            style={{ textDecoration: "none" }}
          >
            Export CSV
          </a>
        </div>
        {logs.length === 0 ? (
          <p>No audit events found.</p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Description</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className="pill pill-small">
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{log.actor.name}</td>
                    <td>{log.description}</td>
                    <td style={{ fontSize: 12 }}>
                      {log.targetType && (
                        <span className="pill pill-small">{log.targetType}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                {page > 1 && (
                  <a
                    href={`/admin/audit-log?page=${page - 1}${searchParams.action ? `&action=${searchParams.action}` : ""}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
                    className="button small secondary"
                    style={{ textDecoration: "none" }}
                  >
                    Previous
                  </a>
                )}
                <span style={{ padding: "8px 12px", fontSize: 13 }}>
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <a
                    href={`/admin/audit-log?page=${page + 1}${searchParams.action ? `&action=${searchParams.action}` : ""}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
                    className="button small secondary"
                    style={{ textDecoration: "none" }}
                  >
                    Next
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
