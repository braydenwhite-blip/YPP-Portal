import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTryItSessions } from "@/lib/discovery-actions";

export default async function TryItSessionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const sessions = await getTryItSessions();

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
          Each session is around 10-20 minutes and shows what it is like to pursue that passion.
        </p>
      </div>

      {sessions.length > 0 ? (
        <div className="grid two">
          {sessions.map((session) => (
          <div
            key={session.id}
            className="card"
            style={{ borderTop: "4px solid var(--ypp-purple)" }}
          >
            <div style={{ display: "flex", alignItems: "start", gap: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 40 }}>🎥</div>
              <div style={{ flex: 1 }}>
                <h3>{session.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  {session.description}
                </p>
                <div style={{ fontSize: 13, marginTop: 8, color: "var(--text-secondary)" }}>
                  ⏱️ {session.duration} minutes · 🎯 {session.passionName}
                </div>
                {session.presenter && (
                  <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-secondary)" }}>
                    Presented by {session.presenter}
                  </div>
                )}
              </div>
            </div>

            <Link
              href={`/discover/try-it/${session.id}`}
              className="button primary"
              style={{ width: "100%" }}
            >
              Watch Video
            </Link>
          </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <h3>No Try-It sessions available yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Ask an admin to add sessions in the portal activity manager.
          </p>
        </div>
      )}

      <div className="card" style={{ marginTop: 28, textAlign: "center" }}>
        <h4>Not sure where to start?</h4>
        <p style={{ marginTop: 8, marginBottom: 16 }}>
          Take our quick quiz to get personalized recommendations!
        </p>
        <Link href="/discover/quiz" className="button secondary">
          Take the Quiz
        </Link>
      </div>
    </div>
  );
}
