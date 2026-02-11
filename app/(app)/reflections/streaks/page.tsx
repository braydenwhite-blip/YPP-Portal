import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ReflectionStreaksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get all reflection submissions
  const submissions = await prisma.reflectionSubmission.findMany({
    where: { userId: session.user.id },
    orderBy: { month: "desc" }
  });

  // Calculate streak
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Sort by month descending
  const sortedSubmissions = [...submissions].sort((a, b) =>
    new Date(b.month).getTime() - new Date(a.month).getTime()
  );

  // Calculate current streak
  let checkMonth = new Date(currentMonth);
  for (const sub of sortedSubmissions) {
    const subMonth = new Date(sub.month);
    subMonth.setDate(1);

    if (subMonth.getTime() === checkMonth.getTime()) {
      currentStreak++;
      checkMonth.setMonth(checkMonth.getMonth() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  tempStreak = 0;
  let prevMonth: Date | null = null;

  for (const sub of submissions) {
    const subMonth = new Date(sub.month);
    subMonth.setDate(1);

    if (!prevMonth) {
      tempStreak = 1;
    } else {
      const expectedPrev = new Date(subMonth);
      expectedPrev.setMonth(expectedPrev.getMonth() + 1);

      if (expectedPrev.getTime() === prevMonth.getTime()) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);
    prevMonth = subMonth;
  }

  // Milestones
  const milestones = [
    { months: 3, reward: "50 XP", emoji: "🔥" },
    { months: 6, reward: "100 XP", emoji: "⭐" },
    { months: 12, reward: "250 XP", emoji: "🏆" },
    { months: 24, reward: "500 XP", emoji: "💎" }
  ];

  const nextMilestone = milestones.find(m => currentStreak < m.months);
  const achievedMilestones = milestones.filter(m => longestStreak >= m.months);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Growth</p>
          <h1 className="page-title">Reflection Streaks</h1>
        </div>
        <Link href="/reflections" className="button secondary">
          Submit Reflection
        </Link>
      </div>

      {/* Current streak */}
      <div className="card" style={{ marginBottom: 28, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>
          {currentStreak > 0 ? "🔥" : "💤"}
        </div>
        <div className="kpi" style={{ fontSize: 48 }}>{currentStreak}</div>
        <div className="kpi-label">Month Streak</div>
        {nextMilestone && currentStreak > 0 && (
          <div style={{ marginTop: 16, color: "var(--text-secondary)" }}>
            {nextMilestone.months - currentStreak} more month{nextMilestone.months - currentStreak !== 1 ? "s" : ""} to earn {nextMilestone.reward}!
          </div>
        )}
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>Longest Streak</h3>
          <div className="kpi">{longestStreak}</div>
          <div className="kpi-label">Months</div>
        </div>
        <div className="card">
          <h3>Total Reflections</h3>
          <div className="kpi">{submissions.length}</div>
          <div className="kpi-label">Submitted</div>
        </div>
      </div>

      {/* Milestones */}
      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Milestones</div>
        <div className="grid two">
          {milestones.map(milestone => {
            const achieved = longestStreak >= milestone.months;
            return (
              <div
                key={milestone.months}
                className="card"
                style={{
                  opacity: achieved ? 1 : 0.5,
                  background: achieved ? "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)" : "transparent"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 48 }}>{milestone.emoji}</div>
                  <div>
                    <h3>{milestone.months} Month Streak</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      Reward: {milestone.reward}
                    </div>
                    {achieved && (
                      <div style={{ fontSize: 12, color: "var(--success-color)", marginTop: 4 }}>
                        ✓ Achieved!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submission history */}
      {submissions.length > 0 && (
        <div>
          <div className="section-title">Submission History</div>
          <div className="grid three">
            {submissions.slice(0, 12).map(submission => (
              <div key={submission.id} className="card">
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 4 }}>✓</div>
                  <div style={{ fontWeight: 600 }}>
                    {new Date(submission.month).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric"
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {submissions.length === 0 && (
        <div className="card">
          <h3>Start Your Streak!</h3>
          <p>Submit your first monthly reflection to begin tracking your streak.</p>
          <Link href="/reflections" className="button primary" style={{ marginTop: 12 }}>
            Submit First Reflection
          </Link>
        </div>
      )}
    </div>
  );
}
