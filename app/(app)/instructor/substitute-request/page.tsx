import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SubstituteRequestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get substitute requests created by this instructor
  const myRequests = await prisma.substituteRequest.findMany({
    where: { requestedById: session.user.id },
    include: {
      course: true,
      assignedTo: true
    },
    orderBy: { sessionDate: "desc" }
  });

  // Get requests where user is assigned as substitute
  const assignedToMe = await prisma.substituteRequest.findMany({
    where: { assignedToId: session.user.id },
    include: {
      course: true,
      requestedBy: true
    },
    orderBy: { sessionDate: "desc" }
  });

  const pendingRequests = myRequests.filter(r => r.status === "PENDING");
  const upcomingSubstitutes = assignedToMe.filter(r =>
    new Date(r.sessionDate) >= new Date() && r.status === "CONFIRMED"
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Substitute Requests</h1>
        </div>
        <Link href="/instructor/substitute-request/new" className="button primary">
          Request Substitute
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Substitute Instructor Management</h3>
        <p>
          Request substitute instructors when you need to miss a class session.
          Help cover other instructors' classes by accepting substitute requests.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{pendingRequests.length}</div>
          <div className="kpi-label">Pending Requests</div>
        </div>
        <div className="card">
          <div className="kpi">{upcomingSubstitutes.length}</div>
          <div className="kpi-label">Upcoming Subs</div>
        </div>
        <div className="card">
          <div className="kpi">{myRequests.filter(r => r.status === "CONFIRMED").length}</div>
          <div className="kpi-label">Confirmed Requests</div>
        </div>
      </div>

      {/* My substitute requests */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">My Substitute Requests</div>
        {myRequests.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No substitute requests yet. Create a request when you need coverage for a class.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myRequests.map(request => {
              const isPast = new Date(request.sessionDate) < new Date();
              const statusColor =
                request.status === "CONFIRMED" ? "success" :
                request.status === "DECLINED" ? "error" :
                request.status === "CANCELLED" ? "secondary" :
                "warning";

              return (
                <div key={request.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3>{request.course.title}</h3>
                        <span className={`pill ${statusColor}`}>
                          {request.status}
                        </span>
                        {isPast && <span className="pill">Past</span>}
                      </div>

                      <div style={{ fontSize: 14, marginBottom: 8 }}>
                        📅 Session Date: {new Date(request.sessionDate).toLocaleDateString()} at{" "}
                        {new Date(request.sessionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      {request.reason && (
                        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                          Reason: {request.reason}
                        </div>
                      )}

                      {request.assignedTo && (
                        <div style={{ fontSize: 14, marginTop: 12 }}>
                          <strong>Substitute:</strong> {request.assignedTo.name}
                        </div>
                      )}
                    </div>

                    {request.status === "PENDING" && (
                      <form action="/api/substitute-request/cancel" method="POST">
                        <input type="hidden" name="requestId" value={request.id} />
                        <button type="submit" className="button secondary small">
                          Cancel Request
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assigned to me */}
      {assignedToMe.length > 0 && (
        <div>
          <div className="section-title">Classes I'm Covering</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {assignedToMe.map(request => {
              const isUpcoming = new Date(request.sessionDate) >= new Date();

              return (
                <div
                  key={request.id}
                  className="card"
                  style={{
                    borderLeft: isUpcoming ? "4px solid var(--primary-color)" : "none"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3>{request.course.title}</h3>
                        {isUpcoming && <span className="pill primary">Upcoming</span>}
                      </div>

                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        📅 {new Date(request.sessionDate).toLocaleDateString()} at{" "}
                        {new Date(request.sessionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                        For: {request.requestedBy.name}
                      </div>

                      {request.reason && (
                        <div style={{
                          marginTop: 8,
                          padding: 8,
                          backgroundColor: "var(--accent-bg)",
                          borderRadius: 4,
                          fontSize: 13
                        }}>
                          {request.reason}
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/courses/${request.courseId}`}
                      className="button primary small"
                    >
                      View Course
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
