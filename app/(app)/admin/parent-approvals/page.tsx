import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveParentLinkRequest, rejectParentLinkRequest } from "@/lib/parent-approval-actions";

export default async function ParentApprovalsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [pendingLinks, approvedLinks, rejectedLinks] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { approvalStatus: "PENDING" },
      include: {
        parent: { select: { id: true, name: true, email: true, phone: true } },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            chapter: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.parentStudent.findMany({
      where: { approvalStatus: "APPROVED" },
      include: {
        parent: { select: { name: true, email: true } },
        student: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.parentStudent.findMany({
      where: { approvalStatus: "REJECTED" },
      include: {
        parent: { select: { name: true, email: true } },
        student: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Parent Link Approval Queue</h1>
        </div>
      </div>

      <div className="grid three">
        <div className="card">
          <div className="kpi">{pendingLinks.length}</div>
          <div className="kpi-label">Pending Requests</div>
        </div>
        <div className="card">
          <div className="kpi">{approvedLinks.length}</div>
          <div className="kpi-label">Recently Approved</div>
        </div>
        <div className="card">
          <div className="kpi">{rejectedLinks.length}</div>
          <div className="kpi-label">Recently Rejected</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Pending Approval Requests</h3>
        {pendingLinks.length === 0 ? (
          <p>No pending parent-student link requests.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Parent</th>
                <th>Parent Email</th>
                <th>Student</th>
                <th>Student Chapter</th>
                <th>Relationship</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingLinks.map((link) => (
                <tr key={link.id}>
                  <td>
                    <strong>{link.parent.name}</strong>
                  </td>
                  <td>{link.parent.email}</td>
                  <td>{link.student.name}</td>
                  <td>{link.student.chapter?.name || "—"}</td>
                  <td>{link.relationship}</td>
                  <td style={{ fontSize: 12 }}>
                    {new Date(link.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <form action={approveParentLinkRequest} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={link.id} />
                        <button className="button small" type="submit">
                          Approve
                        </button>
                      </form>
                      <form action={rejectParentLinkRequest} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={link.id} />
                        <button className="button small secondary" type="submit">
                          Reject
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Recently Approved</h3>
          {approvedLinks.length === 0 ? (
            <p>No recently approved links.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Student</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {approvedLinks.map((link) => (
                  <tr key={link.id}>
                    <td>{link.parent.name}</td>
                    <td>{link.student.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {link.reviewedAt
                        ? new Date(link.reviewedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Recently Rejected</h3>
          {rejectedLinks.length === 0 ? (
            <p>No recently rejected links.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Student</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rejectedLinks.map((link) => (
                  <tr key={link.id}>
                    <td>{link.parent.name}</td>
                    <td>{link.student.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {link.reviewedAt
                        ? new Date(link.reviewedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
