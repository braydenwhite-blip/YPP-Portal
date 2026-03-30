import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getMyPracticeStats } from "@/lib/practice-actions";
import { getPublishedModules, getMyModuleProgress } from "@/lib/module-actions";

export default async function LearnIndexPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [allModules, stats] = await Promise.all([
    getPublishedModules({}),
    getMyPracticeStats(),
  ]);

  const moduleIds = allModules.map((m) => m.id);
  const progress = moduleIds.length > 0 ? await getMyModuleProgress(moduleIds) : [];
  const completedCount = progress.filter((p) => p.completed).length;
  const inProgressCount = progress.filter((p) => !p.completed).length;
  const totalMinutes = allModules.reduce((sum, m) => sum + m.duration, 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Learn</p>
          <h1 className="page-title">Self-Paced Learning</h1>
          <p className="page-subtitle">
            Watch short lessons, log practice sessions, and track your growth — on your own schedule.
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <span className="stat-value">{allModules.length}</span>
          <span className="stat-label">Modules Available</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completedCount}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.streak}</span>
          <span className="stat-label">Day Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalMinutes}</span>
          <span className="stat-label">Practice Minutes</span>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="grid three" style={{ marginBottom: 32 }}>
        {/* Video Modules */}
        <Link href="/learn/modules" className="card" style={{ display: "block", textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 72,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, #8b3fe820, #6366f120)",
              marginBottom: 16,
              fontSize: 32,
            }}
          >
            🎥
          </div>
          <h3 style={{ marginBottom: 4 }}>Video Modules</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            {allModules.length > 0
              ? `${allModules.length} short lessons across coding, music, writing, and design.`
              : "Short video lessons you can watch anytime, at your own pace."}
          </p>
          {inProgressCount > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="pill pill-small pill-purple">{inProgressCount} in progress</span>
            </div>
          )}
          {completedCount > 0 && (
            <div style={{ marginTop: completedCount > 0 && inProgressCount > 0 ? 4 : 12 }}>
              <span className="pill pill-small pill-success">{completedCount} completed</span>
            </div>
          )}
        </Link>

        {/* Practice Log */}
        <Link href="/learn/practice" className="card" style={{ display: "block", textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 72,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, #22c55e20, #16a34a20)",
              marginBottom: 16,
              fontSize: 32,
            }}
          >
            📝
          </div>
          <h3 style={{ marginBottom: 4 }}>Practice Log</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Log your practice sessions, track what you worked on, and build a streak.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {stats.streak > 0 && (
              <span className="pill pill-small pill-success">🔥 {stats.streak}-day streak</span>
            )}
            {stats.sessionsThisMonth > 0 && (
              <span className="pill pill-small">{stats.sessionsThisMonth} sessions this month</span>
            )}
          </div>
        </Link>

        {/* Progress */}
        <Link href="/learn/progress" className="card" style={{ display: "block", textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 72,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, #f59e0b20, #d9770620)",
              marginBottom: 16,
              fontSize: 32,
            }}
          >
            📊
          </div>
          <h3 style={{ marginBottom: 4 }}>My Progress</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            View your learning history, total practice time, and skill progression over time.
          </p>
          {totalMinutes > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="pill pill-small">{totalMinutes} total minutes of content</span>
            </div>
          )}
        </Link>
      </div>

      {/* Recent modules — show up to 4 in-progress or newest */}
      {allModules.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>
              {inProgressCount > 0 ? "Continue Watching" : "Start Learning"}
            </h2>
            <Link href="/learn/modules" className="link" style={{ fontSize: 13 }}>
              View all {allModules.length} modules →
            </Link>
          </div>
          <div className="grid two">
            {allModules
              .filter((m) => {
                if (inProgressCount > 0) {
                  const p = progress.find((pr) => pr.moduleId === m.id);
                  return p && !p.completed;
                }
                return true;
              })
              .slice(0, 4)
              .map((mod) => {
                const prog = progress.find((p) => p.moduleId === mod.id);
                const levelLabel = mod.level.charAt(0) + mod.level.slice(1).toLowerCase();
                return (
                  <Link
                    key={mod.id}
                    href={`/learn/modules/${mod.id}`}
                    className="card"
                    style={{ display: "flex", gap: 12, textDecoration: "none", alignItems: "flex-start" }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "var(--radius-md)",
                        background: "var(--ypp-purple-50)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      🎬
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                        <span className="pill pill-small pill-purple">{levelLabel}</span>
                        <span className="pill pill-small">{mod.duration} min</span>
                      </div>
                      <h4 style={{ margin: "0 0 2px", fontSize: 14 }}>{mod.title}</h4>
                      {mod.description && (
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            margin: 0,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: "vertical" as const,
                          }}
                        >
                          {mod.description}
                        </p>
                      )}
                      {prog && !prog.completed && mod.duration > 0 && (
                        <div
                          style={{
                            marginTop: 6,
                            height: 3,
                            background: "var(--gray-200)",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, ((prog.watchTime ?? 0) / (mod.duration * 60)) * 100)}%`,
                              background: "var(--ypp-purple)",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allModules.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>📚</p>
          <h3>Modules Coming Soon</h3>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            New lessons are being added. In the meantime, try logging a practice session!
          </p>
          <Link href="/learn/practice" className="button" style={{ marginTop: 16, display: "inline-block" }}>
            Log Practice Session
          </Link>
        </div>
      )}
    </div>
  );
}
