import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function StudentHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, primaryRole: true },
  });

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const quickActions = [
    { icon: "📝", text: "Log Practice", url: "/learn/practice", color: "#6366f1" },
    { icon: "📁", text: "My Portfolio", url: "/portfolio", color: "#10b981" },
    { icon: "💬", text: "Project Feedback", url: "/projects/feedback", color: "#ec4899" },
    { icon: "🏆", text: "Awards", url: "/awards", color: "#f59e0b" },
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Welcome back, {firstName}!</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 16 }}>Quick Actions</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {quickActions.map((action) => (
            <Link
              key={action.url}
              href={action.url}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
                borderLeft: `4px solid ${action.color}`,
              }}
            >
              <span style={{ fontSize: 32 }}>{action.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{action.text}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming Classes */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3>Upcoming Classes</h3>
          <Link href="/classes" className="button secondary" style={{ fontSize: 13 }}>
            View All →
          </Link>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
          <h4 style={{ marginBottom: 8 }}>No upcoming classes</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
            Classes will appear here once an instructor enrolls you or you join a class.
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
            Data is added by <strong>instructors and admins</strong>.
          </p>
          <Link href="/classes" className="button primary">
            Browse Classes
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 style={{ marginBottom: 16 }}>Recent Activity</h3>
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <h4 style={{ marginBottom: 8 }}>No activity yet</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
            Your practice logs, awards, and milestones will show up here as you progress
            through your passion journey.
          </p>
          <Link href="/learn/practice" className="button primary">
            Log Your First Practice
          </Link>
        </div>
      </div>
    </div>
  );
}
