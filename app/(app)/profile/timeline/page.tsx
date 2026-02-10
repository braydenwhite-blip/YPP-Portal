import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PassionTimelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Sample timeline data - in production, fetch from database
  const timelineEntries = [
    {
      id: "1",
      date: "2024-01-15",
      type: "STARTED_PASSION",
      title: "Started Visual Arts Journey",
      description: "Discovered a passion for watercolor painting",
      icon: "🎨",
      color: "var(--primary-color)",
      milestone: "MAJOR"
    },
    {
      id: "2",
      date: "2024-01-20",
      type: "FIRST_VIDEO",
      title: "Completed First Learning Module",
      description: "Introduction to Watercolor Techniques",
      icon: "📺",
      color: "#6366f1"
    },
    {
      id: "3",
      date: "2024-02-01",
      type: "CHALLENGE_COMPLETED",
      title: "30-Day Drawing Challenge",
      description: "Completed all 30 daily drawings",
      icon: "🏆",
      color: "#f59e0b",
      milestone: "MAJOR"
    },
    {
      id: "4",
      date: "2024-02-10",
      type: "WORKSHOP_ATTENDED",
      title: "Advanced Watercolor Workshop",
      description: "4-week intensive workshop series",
      icon: "🎓",
      color: "#8b5cf6"
    },
    {
      id: "5",
      date: "2024-02-28",
      type: "PERSONAL_BEST",
      title: "Completed First Major Painting",
      description: "Landscape painting - 16x20 canvas",
      icon: "⭐",
      color: "#10b981",
      milestone: "MAJOR"
    },
    {
      id: "6",
      date: "2024-03-05",
      type: "CERTIFICATION_EARNED",
      title: "Beginner Watercolor Certification",
      description: "Earned official certification",
      icon: "🎖️",
      color: "#f59e0b",
      milestone: "BREAKTHROUGH"
    }
  ];

  // Group by month for display
  const groupedByMonth = timelineEntries.reduce((acc: any, entry) => {
    const month = new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(entry);
    return acc;
  }, {});

  const milestoneIcon = (level?: string) => {
    if (level === "BREAKTHROUGH") return "🌟";
    if (level === "MAJOR") return "⭐";
    if (level === "MINOR") return "✨";
    return "";
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Timeline</p>
          <h1 className="page-title">My Passion Journey</h1>
        </div>
        <button className="button primary">Add Milestone</button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📅 Your Story in Passions</h3>
        <p>
          Track your journey from discovery to mastery. Celebrate milestones,
          reflect on growth, and see how far you've come!
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">6</div>
          <div className="kpi-label">Major Milestones</div>
        </div>
        <div className="card">
          <div className="kpi">45</div>
          <div className="kpi-label">Total Entries</div>
        </div>
        <div className="card">
          <div className="kpi">3</div>
          <div className="kpi-label">Passions Explored</div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Sports</option>
            <option>Music</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Event Types</option>
            <option>Milestones Only</option>
            <option>Challenges</option>
            <option>Certifications</option>
            <option>Workshops</option>
          </select>
          <button className="button secondary">
            📥 Export Timeline
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div>
        {Object.entries(groupedByMonth).map(([month, entries]: [string, any]) => (
          <div key={month} style={{ marginBottom: 40 }}>
            <div className="section-title" style={{ marginBottom: 20 }}>
              {month}
            </div>
            <div style={{ position: "relative", paddingLeft: 40 }}>
              {/* Timeline line */}
              <div style={{
                position: "absolute",
                left: 15,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: "var(--border-color)"
              }} />

              {/* Timeline entries */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {entries.map((entry: any, index: number) => (
                  <div key={entry.id} style={{ position: "relative" }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: "absolute",
                      left: -32,
                      top: 8,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: entry.color || "var(--primary-color)",
                      border: "2px solid var(--bg-primary)",
                      zIndex: 1
                    }} />

                    {/* Entry card */}
                    <div className="card" style={{
                      borderLeft: `3px solid ${entry.color || "var(--primary-color)"}`,
                      position: "relative"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 28 }}>{entry.icon}</span>
                            <div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <h4>{entry.title}</h4>
                                {entry.milestone && (
                                  <span style={{ fontSize: 20 }}>
                                    {milestoneIcon(entry.milestone)}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                                {new Date(entry.date).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                          <p style={{ fontSize: 14, marginTop: 4 }}>
                            {entry.description}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="button secondary" style={{ padding: "4px 12px", fontSize: 13 }}>
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state for new users */}
      {Object.keys(groupedByMonth).length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>📅</div>
          <h3 style={{ marginBottom: 12 }}>Your Journey Begins Here</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            Start exploring passions to build your timeline. Every video watched,
            challenge completed, and skill mastered will appear here!
          </p>
          <a href="/discover/quiz" className="button primary">
            Take Discovery Quiz
          </a>
        </div>
      )}
    </div>
  );
}
