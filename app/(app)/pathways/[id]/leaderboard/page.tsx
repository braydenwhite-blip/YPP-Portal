import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PathwayLeaderboardPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    include: { steps: { select: { courseId: true, stepOrder: true }, orderBy: { stepOrder: "asc" } } },
  });
  if (!pathway) notFound();

  const courseIds = pathway.steps.map((s) => s.courseId);
  if (courseIds.length === 0) {
    return (
      <div>
        <div className="topbar">
          <div>
            <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
            <h1 className="page-title">Leaderboard</h1>
          </div>
        </div>
        <div className="card"><p>No steps in this pathway yet.</p></div>
      </div>
    );
  }

  // Get all enrollments in this pathway
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    include: { user: { select: { id: true, name: true, xp: true, level: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate per user
  const userMap = new Map<string, { name: string; xp: number; level: number; completedSteps: number; enrolledSteps: number }>();
  for (const e of enrollments) {
    if (!userMap.has(e.userId)) {
      // Privacy: only first name + last initial
      const nameParts = e.user.name.trim().split(" ");
      const displayName = nameParts.length >= 2 ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` : nameParts[0];
      userMap.set(e.userId, { name: displayName, xp: e.user.xp, level: e.user.level, completedSteps: 0, enrolledSteps: 0 });
    }
    const entry = userMap.get(e.userId)!;
    entry.enrolledSteps++;
    if (e.status === "COMPLETED") entry.completedSteps++;
  }

  // Sort: completed steps desc, then XP desc
  const ranked = [...userMap.entries()]
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.completedSteps - a.completedSteps || b.xp - a.xp);

  const currentUserId = session.user.id;
  const currentUserRank = ranked.findIndex((r) => r.userId === currentUserId) + 1;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-subtitle">{pathway.name} — top students by steps completed</p>
        </div>
      </div>

      {currentUserRank > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--ypp-purple)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Your rank: <strong>#{currentUserRank}</strong> out of {ranked.length} enrolled students
          </p>
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="card"><p>No students enrolled in this pathway yet. Be the first!</p></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--gray-200, #e2e8f0)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Rank</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Student</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>Steps Complete</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>Level</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>XP</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((entry, idx) => {
                const isMe = entry.userId === currentUserId;
                return (
                  <tr
                    key={entry.userId}
                    style={{
                      borderBottom: "1px solid var(--gray-100, #f7fafc)",
                      background: isMe ? "var(--purple-50, #faf5ff)" : undefined,
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 16 }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontWeight: isMe ? 700 : 500 }}>{entry.name}</span>
                      {isMe && <span style={{ fontSize: 12, color: "var(--ypp-purple)", marginLeft: 6 }}>you</span>}
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      <span className="pill">{entry.completedSteps} / {pathway.steps.length}</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>Lv {entry.level}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>{entry.xp.toLocaleString()} XP</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
