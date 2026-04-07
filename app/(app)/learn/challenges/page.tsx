import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";

export default async function SkillChallengesPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const challenges = [
    {
      id: "1",
      title: "30-Day Drawing Challenge",
      passion: "Visual Arts",
      difficulty: "BEGINNER",
      time: "15-20 min/day",
      xp: 200,
      icon: "🎨",
      description: "Draw one simple object each day for 30 days"
    },
    {
      id: "2",
      title: "Dribbling Mastery",
      passion: "Sports",
      difficulty: "INTERMEDIATE",
      time: "30 min",
      xp: 150,
      icon: "⚽",
      description: "Complete 10 different dribbling drills"
    },
    {
      id: "3",
      title: "Write a Short Story",
      passion: "Writing",
      difficulty: "INTERMEDIATE",
      time: "2-3 hours",
      xp: 250,
      icon: "✍️",
      description: "Create a complete 1000-word short story"
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Challenges</p>
          <h1 className="page-title">Skill Challenges</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🎯 Level Up Your Skills</h3>
        <p>
          Take on challenges to push your abilities, earn XP, and achieve milestones.
          Each challenge includes step-by-step instructions and success criteria.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {challenges.map((challenge) => (
          <div key={challenge.id} className="card">
            <div style={{ display: "flex", gap: 20, alignItems: "start" }}>
              <div style={{ fontSize: 64 }}>{challenge.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <h3>{challenge.title}</h3>
                  <span className={`pill ${challenge.difficulty === 'BEGINNER' ? 'success' : 'warning'}`}>
                    {challenge.difficulty}
                  </span>
                </div>
                <p style={{ fontSize: 14, marginBottom: 12 }}>
                  {challenge.description}
                </p>
                <div style={{ display: "flex", gap: 16, fontSize: 14, color: "var(--text-secondary)" }}>
                  <span>⏱️ {challenge.time}</span>
                  <span>🎯 {challenge.passion}</span>
                  <span style={{ color: "var(--primary-color)", fontWeight: 600 }}>
                    +{challenge.xp} XP
                  </span>
                </div>
              </div>
              <a href={`/learn/challenges/${challenge.id}`} className="button primary">
                Start Challenge
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
