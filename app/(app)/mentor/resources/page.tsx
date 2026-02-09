import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CuratedResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  // Sample data - in production, fetch from database
  const resources = [
    {
      id: "1",
      mentorName: "Coach Rivera",
      mentorPhoto: "👨‍🏫",
      passionArea: "Visual Arts",
      title: "Proko's Figure Drawing Fundamentals",
      description: "Best free course for learning human anatomy and proportions. Clear explanations and homework assignments. Start here before taking paid courses.",
      url: "https://www.proko.com",
      resourceType: "COURSE",
      level: "BEGINNER",
      rating: 4.9,
      saves: 234,
      sharedAt: "2024-03-10"
    },
    {
      id: "2",
      mentorName: "Ms. Chen",
      mentorPhoto: "👩‍🎨",
      passionArea: "Visual Arts",
      title: "Color and Light by James Gurney",
      description: "THE book for understanding color theory in practice. Not just theory - shows you how light actually works. Changed how I see everything.",
      url: "https://example.com/book",
      resourceType: "BOOK",
      level: "INTERMEDIATE",
      rating: 5.0,
      saves: 189,
      sharedAt: "2024-03-08"
    },
    {
      id: "3",
      mentorName: "Alex Rivera",
      mentorPhoto: "🎸",
      passionArea: "Music",
      title: "JustinGuitar - Free Guitar Lessons",
      description: "Structured curriculum from absolute beginner to advanced. Completely free, better than many paid courses. Practice along with the videos daily.",
      url: "https://www.justinguitar.com",
      resourceType: "VIDEO",
      level: "BEGINNER",
      rating: 4.8,
      saves: 312,
      sharedAt: "2024-03-05"
    },
    {
      id: "4",
      mentorName: "Maya Johnson",
      mentorPhoto: "🌱",
      passionArea: "Service",
      title: "Idealist.org - Find Volunteer Opportunities",
      description: "Best platform for finding legitimate volunteer opportunities and nonprofits. Filter by cause, age group, and commitment level.",
      url: "https://www.idealist.org",
      resourceType: "TOOL",
      level: "BEGINNER",
      rating: 4.7,
      saves: 156,
      sharedAt: "2024-03-01"
    },
    {
      id: "5",
      mentorName: "Dr. Sarah Kim",
      mentorPhoto: "💻",
      passionArea: "STEM",
      title: "freeCodeCamp - Learn to Code",
      description: "Comprehensive, project-based curriculum. Build real projects while learning. Active community for help. Completely free with certificates.",
      url: "https://www.freecodecamp.org",
      resourceType: "COURSE",
      level: "BEGINNER",
      rating: 4.9,
      saves: 421,
      sharedAt: "2024-02-28"
    },
    {
      id: "6",
      mentorName: "Coach Rivera",
      mentorPhoto: "👨‍🏫",
      passionArea: "Visual Arts",
      title: "Procreate - Digital Art App",
      description: "Best digital art app for iPad. One-time purchase, professional-level tools. Great for beginners and pros. Tons of free tutorials on YouTube.",
      url: "https://procreate.art",
      resourceType: "TOOL",
      level: "BEGINNER",
      rating: 4.9,
      saves: 287,
      sharedAt: "2024-02-25"
    }
  ];

  const resourceTypeIcons: Record<string, string> = {
    VIDEO: "📺",
    ARTICLE: "📄",
    BOOK: "📚",
    COURSE: "🎓",
    TOOL: "🛠️",
    WEBSITE: "🌐"
  };

  const levelColors: Record<string, string> = {
    BEGINNER: "#10b981",
    INTERMEDIATE: "#f59e0b",
    ADVANCED: "#ef4444"
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Curated Resources</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📚 Mentor-Recommended Resources</h3>
        <p>
          Hand-picked by experienced mentors - the best free and paid resources for each passion.
          Save time by starting with what actually works!
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{resources.length}</div>
          <div className="kpi-label">Total Resources</div>
        </div>
        <div className="card">
          <div className="kpi">{resources.reduce((sum, r) => sum + r.saves, 0)}</div>
          <div className="kpi-label">Total Saves</div>
        </div>
        <div className="card">
          <div className="kpi">
            {(resources.reduce((sum, r) => sum + r.rating, 0) / resources.length).toFixed(1)}
          </div>
          <div className="kpi-label">Avg Rating</div>
        </div>
        <div className="card">
          <div className="kpi">18</div>
          <div className="kpi-label">My Saved Resources</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Music</option>
            <option>Service</option>
            <option>STEM</option>
            <option>Photography</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Types</option>
            <option>Videos</option>
            <option>Courses</option>
            <option>Books</option>
            <option>Tools</option>
            <option>Articles</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Levels</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>Sort: Most Saved</option>
            <option>Sort: Highest Rated</option>
            <option>Sort: Recent</option>
          </select>
        </div>
      </div>

      {/* Resources Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {resources.map((resource) => (
          <div key={resource.id} className="card">
            <div style={{ display: "flex", gap: 20, alignItems: "start" }}>
              {/* Icon */}
              <div style={{
                fontSize: 48,
                flexShrink: 0,
                backgroundColor: "var(--bg-secondary)",
                width: 80,
                height: 80,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12
              }}>
                {resourceTypeIcons[resource.resourceType]}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <h3 style={{ marginBottom: 0 }}>{resource.title}</h3>
                  <span className="pill" style={{
                    backgroundColor: levelColors[resource.level],
                    color: "white",
                    border: "none"
                  }}>
                    {resource.level}
                  </span>
                  <span className="pill secondary">
                    {resource.resourceType}
                  </span>
                </div>

                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                  {resource.passionArea}
                </p>

                <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                  {resource.description}
                </p>

                {/* Mentor Info */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>{resource.mentorPhoto}</span>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Recommended by <strong>{resource.mentorName}</strong> • {new Date(resource.sharedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Stats & Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 16, fontSize: 14, color: "var(--text-secondary)" }}>
                    <span>⭐ {resource.rating}</span>
                    <span>📌 {resource.saves} saves</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="button primary">
                      Visit Resource →
                    </a>
                    <button className="button secondary">
                      📌 Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Suggest Resource CTA */}
      <div className="card" style={{ marginTop: 40, textAlign: "center", padding: 40 }}>
        <h3 style={{ marginBottom: 12 }}>Found an Amazing Resource?</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          Share resources that helped you! Mentors review suggestions and add the best ones to the library.
        </p>
        <button className="button primary">
          Suggest a Resource
        </button>
      </div>
    </div>
  );
}
