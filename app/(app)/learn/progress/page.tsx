import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function LearningProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  // Fetch all data in parallel
  const [
    totalModules,
    completedProgress,
    allProgress,
    practiceLogs,
    recentPractice,
    user,
  ] = await Promise.all([
    prisma.learningModule.count({ where: { isActive: true } }),
    prisma.moduleWatchProgress.findMany({
      where: { studentId: userId, completed: true },
      include: { module: { select: { tags: true, duration: true } } },
    }),
    prisma.moduleWatchProgress.findMany({
      where: { studentId: userId },
      include: {
        module: {
          select: { id: true, title: true, duration: true, level: true },
        },
      },
      orderBy: { lastWatchedAt: "desc" },
    }),
    prisma.practiceLog.aggregate({
      where: { studentId: userId },
      _sum: { duration: true },
      _count: true,
    }),
    prisma.practiceLog.findMany({
      where: { studentId: userId },
      orderBy: { date: "desc" },
      take: 5,
      select: { activity: true, duration: true, date: true, passionId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true },
    }),
  ]);

  const completedCount = completedProgress.length;
  const completionPct =
    totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  // Watch hours: sum of watchTime (seconds) across all progress records
  const totalWatchSeconds = allProgress.reduce(
    (sum: number, p: { watchTime: number }) => sum + p.watchTime,
    0,
  );
  const watchHours = (totalWatchSeconds / 3600).toFixed(1);

  // Practice stats
  const totalPracticeMinutes = practiceLogs._sum.duration ?? 0;
  const practiceSessionCount = practiceLogs._count;

  // Skills/tags unlocked from completed modules
  const allTags = completedProgress.flatMap(
    (p: { module: { tags: string[] } }) => p.module.tags,
  );
  const uniqueSkills = [...new Set(allTags)].sort();

  // Next recommended module: first active module the user hasn't completed
  const completedModuleIds = new Set(completedProgress.map((p: { moduleId: string }) => p.moduleId));
  const nextModule = await prisma.learningModule.findFirst({
    where: {
      isActive: true,
      id: { notIn: [...completedModuleIds] },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, duration: true, level: true },
  });

  // In-progress modules (started but not completed)
  const inProgressModules = allProgress.filter(
    (p: { completed: boolean; watchTime: number }) => !p.completed && p.watchTime > 0,
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/learn/modules"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              marginBottom: 4,
              display: "inline-block",
            }}
          >
            &larr; Back to Modules
          </Link>
          <h1 className="page-title">My Learning Progress</h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 2,
            }}
          >
            Track your self-paced learning journey
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">
            {completedCount}/{totalModules}
          </div>
          <div className="kpi-label">Modules Completed</div>
          <div
            style={{
              marginTop: 8,
              width: "100%",
              height: 6,
              background: "var(--gray-200)",
              borderRadius: 3,
            }}
          >
            <div
              style={{
                width: `${completionPct}%`,
                height: "100%",
                background: "var(--ypp-purple)",
                borderRadius: 3,
                transition: "width 300ms",
              }}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {completionPct}%
          </div>
        </div>

        <div className="card">
          <div className="kpi">{watchHours}h</div>
          <div className="kpi-label">Watch Hours</div>
        </div>

        <div className="card">
          <div className="kpi">{practiceSessionCount}</div>
          <div className="kpi-label">Practice Sessions</div>
          <div
            style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}
          >
            {totalPracticeMinutes} min total
          </div>
        </div>

        <div className="card">
          <div className="kpi">{uniqueSkills.length}</div>
          <div className="kpi-label">Skills Unlocked</div>
        </div>
      </div>

      {/* XP Summary */}
      {user && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 4,
              }}
            >
              Total XP Earned
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--ypp-purple)",
              }}
            >
              {user.xp ?? 0} XP
            </div>
          </div>
          {user.level && (
            <span className="pill pill-purple" style={{ fontSize: 14 }}>
              Level {user.level}
            </span>
          )}
        </div>
      )}

      <div className="grid two">
        {/* Next Recommended */}
        <div>
          <div className="section-title">Up Next</div>
          {nextModule ? (
            <Link
              href={`/learn/modules/${nextModule.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="card"
                style={{
                  borderLeft: "4px solid var(--ypp-purple)",
                  cursor: "pointer",
                }}
              >
                <h4 style={{ margin: "0 0 4px" }}>{nextModule.title}</h4>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <span>{nextModule.duration} min</span>
                  <span className="pill pill-small">
                    {nextModule.level.charAt(0) +
                      nextModule.level.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            </Link>
          ) : totalModules === 0 ? (
            <div
              className="card"
              style={{ color: "var(--muted)", textAlign: "center" }}
            >
              No modules available yet.
            </div>
          ) : (
            <div
              className="card"
              style={{
                textAlign: "center",
                color: "#16a34a",
                fontWeight: 600,
              }}
            >
              All modules completed!
            </div>
          )}

          {/* In Progress */}
          {inProgressModules.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="section-title">Continue Watching</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {inProgressModules.slice(0, 5).map((p) => {
                  const pct =
                    p.module.duration > 0
                      ? Math.round(
                          (p.watchTime / (p.module.duration * 60)) * 100,
                        )
                      : 0;
                  return (
                    <Link
                      key={p.id}
                      href={`/learn/modules/${p.moduleId}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div className="card" style={{ padding: "12px 16px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <h4 style={{ margin: 0, fontSize: 14 }}>
                            {p.module.title}
                          </h4>
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {Math.min(pct, 99)}%
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            width: "100%",
                            height: 4,
                            background: "var(--gray-200)",
                            borderRadius: 2,
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(pct, 99)}%`,
                              height: "100%",
                              background: "#3b82f6",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Skills Unlocked */}
          {uniqueSkills.length > 0 && (
            <div>
              <div className="section-title">Skills Unlocked</div>
              <div className="card">
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {uniqueSkills.map((skill) => (
                    <span
                      key={skill}
                      className="pill"
                      style={{
                        background: "var(--ypp-purple-light, #f3e8ff)",
                        color: "var(--ypp-purple)",
                        fontSize: 12,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Practice */}
          <div style={{ marginTop: uniqueSkills.length > 0 ? 24 : 0 }}>
            <div className="section-title">Recent Practice</div>
            {recentPractice.length > 0 ? (
              <div className="card">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {recentPractice.map((log, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingBottom:
                          i < recentPractice.length - 1 ? 12 : 0,
                        borderBottom:
                          i < recentPractice.length - 1
                            ? "1px solid var(--gray-100)"
                            : "none",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {log.activity}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            marginTop: 2,
                          }}
                        >
                          {log.passionId} &middot; {log.duration} min
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/learn/practice"
                  className="link"
                  style={{
                    display: "block",
                    marginTop: 12,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  View All Practice Logs
                </Link>
              </div>
            ) : (
              <div
                className="card"
                style={{ color: "var(--muted)", textAlign: "center" }}
              >
                <p style={{ margin: "0 0 8px" }}>No practice sessions yet.</p>
                <Link href="/learn/practice" className="button primary small">
                  Log Your First Session
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
