import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function TryItSessionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  // Get all try-it sessions - in production these would be from database
  // For now using sample data
  const passionAreas = [
    {
      id: "arts",
      name: "Visual Arts",
      icon: "🎨",
      color: "#FF6B6B",
      description: "Explore drawing, painting, sculpture, and digital art",
      videoUrl: "https://www.youtube.com/embed/example1",
      duration: 15
    },
    {
      id: "sports",
      name: "Sports & Athletics",
      icon: "⚽",
      color: "#4ECDC4",
      description: "Discover team sports, individual athletics, and fitness",
      videoUrl: "https://www.youtube.com/embed/example2",
      duration: 12
    },
    {
      id: "stem",
      name: "Science & Technology",
      icon: "🔬",
      color: "#45B7D1",
      description: "Experiment with coding, robotics, and scientific discovery",
      videoUrl: "https://www.youtube.com/embed/example3",
      duration: 18
    },
    {
      id: "music",
      name: "Music",
      icon: "🎵",
      color: "#48DBFB",
      description: "Learn instruments, singing, composition, and production",
      videoUrl: "https://www.youtube.com/embed/example4",
      duration: 14
    },
    {
      id: "service",
      name: "Community Service",
      icon: "🤝",
      color: "#5F27CD",
      description: "Make a difference through volunteering and leadership",
      videoUrl: "https://www.youtube.com/embed/example5",
      duration: 10
    },
    {
      id: "writing",
      name: "Writing & Storytelling",
      icon: "✍️",
      color: "#54A0FF",
      description: "Create stories, poetry, journalism, and creative content",
      videoUrl: "https://www.youtube.com/embed/example6",
      duration: 13
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Discover</p>
          <h1 className="page-title">Try-It Sessions</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🎬 Explore Different Passions</h3>
        <p>
          Watch short videos to get a taste of different activities. No commitment - just exploring!
          Each session is 10-20 minutes and shows you what it's like to pursue that passion.
        </p>
      </div>

      <div className="grid two">
        {passionAreas.map((passion) => (
          <div
            key={passion.id}
            className="card"
            style={{ borderTop: `4px solid ${passion.color}` }}
          >
            <div style={{ display: "flex", alignItems: "start", gap: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 48 }}>{passion.icon}</div>
              <div style={{ flex: 1 }}>
                <h3>{passion.name}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  {passion.description}
                </p>
                <div style={{ fontSize: 13, marginTop: 8, color: "var(--text-secondary)" }}>
                  ⏱️ {passion.duration} minutes
                </div>
              </div>
            </div>
            
            <a 
              href={`/discover/try-it/${passion.id}`}
              className="button primary"
              style={{ width: "100%" }}
            >
              Watch Video
            </a>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 28, textAlign: "center" }}>
        <h4>Not sure where to start?</h4>
        <p style={{ marginTop: 8, marginBottom: 16 }}>
          Take our quick quiz to get personalized recommendations!
        </p>
        <a href="/discover/quiz" className="button secondary">
          Take the Quiz
        </a>
      </div>
    </div>
  );
}
