import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WorkshopSeriesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Sample workshop series - in production, fetch from database
  const workshopSeries = [
    {
      id: "1",
      title: "Watercolor Fundamentals Series",
      passion: "Visual Arts",
      difficulty: "BEGINNER",
      totalSessions: 4,
      estimatedHours: 6,
      thumbnailUrl: "🎨",
      instructor: "Sarah Martinez",
      description: "Master the basics of watercolor painting in this comprehensive 4-week series",
      learningOutcomes: [
        "Understand color mixing and theory",
        "Master wet-on-wet and wet-on-dry techniques",
        "Create stunning gradients and washes",
        "Complete your first watercolor landscape"
      ],
      enrolled: false,
      studentsEnrolled: 45
    },
    {
      id: "2",
      title: "Basketball Skills Bootcamp",
      passion: "Sports",
      difficulty: "INTERMEDIATE",
      totalSessions: 6,
      estimatedHours: 9,
      thumbnailUrl: "🏀",
      instructor: "Coach Mike Johnson",
      description: "Level up your game with advanced dribbling, shooting, and defensive techniques",
      learningOutcomes: [
        "Perfect your shooting form",
        "Advanced dribbling combinations",
        "Defensive positioning and footwork",
        "Game strategy and basketball IQ"
      ],
      enrolled: true,
      progress: 3,
      studentsEnrolled: 62
    },
    {
      id: "3",
      title: "Creative Writing Workshop",
      passion: "Writing",
      difficulty: "INTERMEDIATE",
      totalSessions: 5,
      estimatedHours: 7.5,
      thumbnailUrl: "✍️",
      instructor: "Dr. Emily Chen",
      description: "Develop your unique voice and craft compelling stories from start to finish",
      learningOutcomes: [
        "Find your authentic writing voice",
        "Build engaging characters",
        "Master plot structure and pacing",
        "Receive peer and instructor feedback"
      ],
      enrolled: false,
      studentsEnrolled: 38
    },
    {
      id: "4",
      title: "Music Production Basics",
      passion: "Music",
      difficulty: "BEGINNER",
      totalSessions: 8,
      estimatedHours: 12,
      thumbnailUrl: "🎵",
      instructor: "Alex Rivera",
      description: "Learn to produce your own music from scratch using digital audio workstations",
      learningOutcomes: [
        "Navigate DAW software confidently",
        "Record and edit audio",
        "Create beats and melodies",
        "Mix and master your first track"
      ],
      enrolled: false,
      studentsEnrolled: 71
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Workshops</p>
          <h1 className="page-title">Workshop Series</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🎓 Multi-Session Learning Experiences</h3>
        <p>
          Go deeper with structured workshop series. Each series includes multiple sessions,
          hands-on projects, and expert instruction to build real mastery.
        </p>
      </div>

      {/* Filter and Sort */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Sports</option>
            <option>Writing</option>
            <option>Music</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Levels</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Workshops</option>
            <option>My Enrolled</option>
            <option>Available</option>
          </select>
        </div>
      </div>

      {/* Workshop Series Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {workshopSeries.map((workshop) => (
          <div key={workshop.id} className="card">
            <div style={{ display: "flex", gap: 24, alignItems: "start" }}>
              {/* Thumbnail */}
              <div style={{
                fontSize: 80,
                width: 120,
                height: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: 12,
                flexShrink: 0
              }}>
                {workshop.thumbnailUrl}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <h3>{workshop.title}</h3>
                  <span className={`pill ${workshop.difficulty === 'BEGINNER' ? 'success' : 'warning'}`}>
                    {workshop.difficulty}
                  </span>
                  {workshop.enrolled && (
                    <span className="pill primary">
                      Enrolled
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                  By {workshop.instructor} • {workshop.passion}
                </p>

                <p style={{ fontSize: 14, marginBottom: 16 }}>
                  {workshop.description}
                </p>

                <div style={{ display: "flex", gap: 20, fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
                  <span>📺 {workshop.totalSessions} sessions</span>
                  <span>⏱️ ~{workshop.estimatedHours} hours</span>
                  <span>👥 {workshop.studentsEnrolled} enrolled</span>
                </div>

                {/* Learning outcomes */}
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                    What You'll Learn
                  </summary>
                  <ul style={{ marginLeft: 20, fontSize: 14 }}>
                    {workshop.learningOutcomes.map((outcome, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </details>

                {/* Progress bar for enrolled */}
                {workshop.enrolled && workshop.progress !== undefined && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span>Progress: Session {workshop.progress} of {workshop.totalSessions}</span>
                      <span>{Math.round((workshop.progress / workshop.totalSessions) * 100)}%</span>
                    </div>
                    <div style={{
                      width: "100%",
                      height: 8,
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: 4,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width: `${(workshop.progress / workshop.totalSessions) * 100}%`,
                        height: "100%",
                        backgroundColor: "var(--primary-color)",
                        transition: "width 0.3s"
                      }} />
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 12 }}>
                  {workshop.enrolled ? (
                    <>
                      <a href={`/learn/workshops/${workshop.id}/continue`} className="button primary">
                        Continue Learning
                      </a>
                      <button className="button secondary">
                        View Certificate
                      </button>
                    </>
                  ) : (
                    <>
                      <a href={`/learn/workshops/${workshop.id}`} className="button primary">
                        Enroll Now
                      </a>
                      <button className="button secondary">
                        Preview
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
