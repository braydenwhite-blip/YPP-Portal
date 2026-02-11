import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/empty-state";

export default async function ResourceRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const requests = await prisma.resourceRequest.findMany({
    where: { studentId: session.user.id },
    orderBy: { requestedAt: "desc" },
  });

  if (requests.length === 0) {
    return (
      <EmptyState
        icon="🛠️"
        badge="Resources"
        title="Resource Requests"
        description="This page will let you request materials, equipment, or tools for your passion projects. Chapter leaders review and fulfill requests based on availability."
        addedBy="students (requests) and chapter leaders (approvals)"
        actionLabel="Go to Admin Panel"
        actionHref="/admin"
      />
    );
  }

  const statusColors: Record<string, string> = {
    PENDING: "#f59e0b",
    APPROVED: "#10b981",
    DENIED: "#ef4444",
    FULFILLED: "#6366f1",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Resources</p>
          <h1 className="page-title">Resource Requests</h1>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {requests.map((req) => (
          <div key={req.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{req.itemName}</h3>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  Requested {new Date(req.requestedAt).toLocaleDateString()}
                  {req.estimatedCost != null && ` · Est. $${req.estimatedCost}`}
                </div>
              </div>
              <span className="pill" style={{ backgroundColor: statusColors[req.status] ?? "var(--text-secondary)", color: "white", border: "none" }}>
                {req.status}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{req.reason}</p>
            {req.reviewNotes && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "var(--bg-secondary)", borderLeft: `3px solid ${statusColors[req.status] ?? "#888"}` }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Chapter Response:</div>
                <div style={{ fontSize: 14 }}>{req.reviewNotes}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
