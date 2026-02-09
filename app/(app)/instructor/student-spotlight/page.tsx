import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function StudentSpotlightPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get spotlights nominated by this instructor
  const myNominations = await prisma.studentSpotlight.findMany({
    where: { nominatedById: session.user.id },
    include: {
      student: true
    },
    orderBy: { createdAt: "desc" }
  });

  // Get all spotlights for visibility
  const allSpotlights = await prisma.studentSpotlight.findMany({
    include: {
      student: true,
      nominatedBy: true
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  // Group by term
  const currentTerm = `${new Date().getFullYear()}-${Math.ceil((new Date().getMonth() + 1) / 4)}`;
  const currentTermNominations = myNominations.filter(n => n.term === currentTerm);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Student Spotlight</h1>
        </div>
        <Link href="/instructor/student-spotlight/nominate" className="button primary">
          Nominate Student
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Celebrate Outstanding Students</h3>
        <p>
          Nominate students who have shown exceptional growth, effort, leadership, or achievement.
          Spotlights are shared with the community to inspire and recognize excellence.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{myNominations.length}</div>
          <div className="kpi-label">Total Nominations</div>
        </div>
        <div className="card">
          <div className="kpi">{currentTermNominations.length}</div>
          <div className="kpi-label">This Term</div>
        </div>
        <div className="card">
          <div className="kpi">{allSpotlights.length}</div>
          <div className="kpi-label">Community Total</div>
        </div>
      </div>

      {/* My nominations */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">My Nominations</div>
        {myNominations.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No nominations yet. Recognize outstanding students by nominating them for the spotlight!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myNominations.map(spotlight => (
              <div key={spotlight.id} className="card">
                <div style={{ display: "flex", alignItems: "start", gap: 16 }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    backgroundColor: "var(--primary-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                    flexShrink: 0
                  }}>
                    ⭐
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <h3>{spotlight.student.name}</h3>
                      <span className="pill success">Spotlighted</span>
                      <span className="pill">{spotlight.term}</span>
                    </div>
                    <p style={{ fontSize: 14, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                      {spotlight.reason}
                    </p>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Nominated {new Date(spotlight.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent community spotlights */}
      <div>
        <div className="section-title">Recent Community Spotlights</div>
        <div className="grid two">
          {allSpotlights.map(spotlight => (
            <div key={spotlight.id} className="card">
              <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  backgroundColor: "var(--accent-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0
                }}>
                  ⭐
                </div>
                <div style={{ flex: 1 }}>
                  <h4>{spotlight.student.name}</h4>
                  <p style={{ fontSize: 13, marginTop: 4, marginBottom: 8 }}>
                    {spotlight.reason.length > 120
                      ? spotlight.reason.substring(0, 120) + "..."
                      : spotlight.reason}
                  </p>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    By {spotlight.nominatedBy.name} • {spotlight.term}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
