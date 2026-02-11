import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function LearningModulesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Sample modules - in production from database
  const modules = [
    {
      id: "1",
      title: "Introduction to Watercolor Painting",
      passion: "Visual Arts",
      level: "BEGINNER",
      duration: 15,
      thumbnail: "🎨",
      description: "Learn the basics of watercolor techniques",
      videoUrl: "https://example.com/video1"
    },
    {
      id: "2", 
      title: "Basketball Dribbling Fundamentals",
      passion: "Sports",
      level: "BEGINNER",
      duration: 12,
      thumbnail: "⚽",
      description: "Master basic dribbling skills",
      videoUrl: "https://example.com/video2"
    },
    {
      id: "3",
      title: "Creative Writing: Character Development",
      passion: "Writing",
      level: "INTERMEDIATE",
      duration: 18,
      thumbnail: "✍️",
      description: "Create compelling characters for your stories",
      videoUrl: "https://example.com/video3"
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Learn</p>
          <h1 className="page-title">Micro-Learning Modules</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📚 Short Video Lessons</h3>
        <p>
          Learn new skills in 10-20 minute focused lessons. Watch at your own pace,
          anytime, anywhere. No live instructor needed!
        </p>
      </div>

      {/* Filters */}
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
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid two">
        {modules.map((module) => (
          <div key={module.id} className="card">
            <div style={{ fontSize: 64, textAlign: "center", marginBottom: 12 }}>
              {module.thumbnail}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span className="pill">{module.level}</span>
              <span className="pill secondary">{module.duration} min</span>
            </div>
            <h3>{module.title}</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4, marginBottom: 12 }}>
              {module.description}
            </p>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              {module.passion}
            </div>
            <a href={`/learn/modules/${module.id}`} className="button primary" style={{ width: "100%" }}>
              Watch Now
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
