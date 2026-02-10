import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CompetitionChecklistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get user's checklists
  const checklists = await prisma.competitionChecklist.findMany({
    where: { userId: session.user.id },
    include: {
      event: true,
      items: {
        orderBy: { sortOrder: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // Get upcoming competition events
  const upcomingEvents = await prisma.event.findMany({
    where: {
      eventType: "COMPETITION",
      startDate: { gte: new Date() }
    },
    orderBy: { startDate: "asc" },
    take: 10
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Learning</p>
          <h1 className="page-title">Competition Checklists</h1>
        </div>
        <Link href="/competitions/checklist/new" className="button primary">
          Create Checklist
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Stay Competition-Ready</h3>
        <p>
          Prepare for competitions with customizable checklists. Track materials, skills to practice,
          research tasks, and logistics. Never miss a critical preparation step!
        </p>
      </div>

      {checklists.length === 0 ? (
        <div>
          {upcomingEvents.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-title">Upcoming Competitions</div>
              <div className="grid two">
                {upcomingEvents.map(event => (
                  <div key={event.id} className="card">
                    <h3>{event.title}</h3>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
                      {event.description}
                    </p>
                    <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)" }}>
                      📅 {new Date(event.startDate).toLocaleDateString()}
                    </div>
                    <Link
                      href={`/competitions/checklist/new?eventId=${event.id}`}
                      className="button primary"
                      style={{ marginTop: 12, width: "100%" }}
                    >
                      Create Checklist
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3>No Checklists Yet</h3>
            <p>Create your first competition checklist to start tracking your preparation!</p>
            <Link href="/competitions/checklist/new" className="button primary" style={{ marginTop: 12 }}>
              Create Checklist
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {checklists.map(checklist => {
            const completed = checklist.items.filter(i => i.completed).length;
            const total = checklist.items.length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <Link
                key={checklist.id}
                href={`/competitions/checklist/${checklist.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3>{checklist.title}</h3>
                    {checklist.event && (
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                        📅 {new Date(checklist.event.startDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="kpi" style={{ fontSize: 32 }}>{progress}%</div>
                    <div className="kpi-label">{completed}/{total} done</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "var(--border-color)",
                  borderRadius: 4,
                  overflow: "hidden",
                  marginTop: 16
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: "100%",
                    backgroundColor: progress === 100 ? "var(--success-color)" : "var(--primary-color)"
                  }} />
                </div>

                {/* Category breakdown */}
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["PREPARATION", "MATERIALS", "SKILLS", "RESEARCH", "PRACTICE", "LOGISTICS"].map(category => {
                    const categoryItems = checklist.items.filter(i => i.category === category);
                    if (categoryItems.length === 0) return null;
                    const categoryCompleted = categoryItems.filter(i => i.completed).length;

                    return (
                      <span key={category} className="pill" style={{ fontSize: 12 }}>
                        {category}: {categoryCompleted}/{categoryItems.length}
                      </span>
                    );
                  })}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
