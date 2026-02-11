import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PeerObservationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get observations where user is observer
  const observing = await prisma.peerObservation.findMany({
    where: { observerId: session.user.id },
    include: {
      observee: true,
      observer: true,
      course: true
    },
    orderBy: { scheduledAt: "desc" }
  });

  // Get observations where user is being observed
  const beingObserved = await prisma.peerObservation.findMany({
    where: { observeeId: session.user.id },
    include: {
      observer: true,
      observee: true,
      course: true
    },
    orderBy: { scheduledAt: "desc" }
  });

  const upcomingObservations = [...observing, ...beingObserved]
    .filter(o => new Date(o.scheduledAt) >= new Date() && o.status === "SCHEDULED")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Peer Observation</h1>
        </div>
        <Link href="/instructor/peer-observation/schedule" className="button primary">
          Schedule Observation
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Peer Observation Program</h3>
        <p>
          Learn from fellow instructors by observing their classes and receiving feedback on your own teaching.
          Peer observations help improve instructional quality and share best practices.
        </p>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{observing.filter(o => o.status === "COMPLETED").length}</div>
          <div className="kpi-label">Classes Observed</div>
        </div>
        <div className="card">
          <div className="kpi">{beingObserved.filter(o => o.status === "COMPLETED").length}</div>
          <div className="kpi-label">Times Observed</div>
        </div>
      </div>

      {/* Upcoming observations */}
      {upcomingObservations.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Upcoming Observations</div>
          <div className="grid two">
            {upcomingObservations.map(obs => {
              const isObserver = obs.observerId === session.user.id;

              return (
                <div key={obs.id} className="card">
                  <div style={{ marginBottom: 8 }}>
                    <span className="pill primary">
                      {isObserver ? "You're Observing" : "Being Observed"}
                    </span>
                  </div>

                  <h3>
                    {isObserver
                      ? `Observe ${obs.observee.name}`
                      : `Observed by ${obs.observer.name}`}
                  </h3>

                  {obs.course && (
                    <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                      Course: {obs.course.title}
                    </div>
                  )}

                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    📅 {new Date(obs.scheduledAt).toLocaleString()}
                  </div>

                  {isObserver && (
                    <Link
                      href={`/instructor/peer-observation/${obs.id}/feedback`}
                      className="button primary"
                      style={{ marginTop: 12, width: "100%" }}
                    >
                      Submit Feedback
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past observations with feedback */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Past Observations</div>
        {beingObserved.filter(o => o.status === "COMPLETED").length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No completed observations yet. Schedule your first peer observation to get feedback!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {beingObserved
              .filter(o => o.status === "COMPLETED")
              .map(obs => (
                <div key={obs.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3>Observed by {obs.observer.name}</h3>
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                        {new Date(obs.completedAt!).toLocaleDateString()}
                        {obs.course && ` • ${obs.course.title}`}
                      </div>
                    </div>
                    <span className="pill success">Completed</span>
                  </div>

                  {obs.feedback && (
                    <div style={{
                      marginTop: 12,
                      padding: 12,
                      backgroundColor: "var(--accent-bg)",
                      borderRadius: 6
                    }}>
                      <strong>Feedback:</strong>
                      <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{obs.feedback}</p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
