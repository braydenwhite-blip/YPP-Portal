import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getPublishedModules,
  getMyModuleProgress,
  getModulePassionIds,
} from "@/lib/module-actions";
import ModuleFilters from "./module-filters";

export default async function LearningModulesPage({
  searchParams,
}: {
  searchParams: { passion?: string; level?: string; q?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const passionFilter = searchParams.passion || undefined;
  const levelFilter = searchParams.level || undefined;
  const searchQuery = searchParams.q || undefined;
  const statusFilter = searchParams.status || undefined;

  const [modules, passionIds] = await Promise.all([
    getPublishedModules({
      passionId: passionFilter,
      level: levelFilter,
      search: searchQuery,
    }),
    getModulePassionIds(),
  ]);

  const moduleIds = modules.map((m) => m.id);
  const progress = await getMyModuleProgress(moduleIds);
  const progressMap = new Map(progress.map((p) => [p.moduleId, p]));

  // Apply status filter (completed / in-progress / not-started)
  const filteredModules = statusFilter
    ? modules.filter((m) => {
        const p = progressMap.get(m.id);
        if (statusFilter === "completed") return p?.completed === true;
        if (statusFilter === "in-progress") return p && !p.completed;
        if (statusFilter === "not-started") return !p;
        return true;
      })
    : modules;

  const completedCount = progress.filter((p) => p.completed).length;
  const inProgressCount = progress.filter((p) => !p.completed).length;
  const totalMinutes = modules.reduce((sum, m) => sum + m.duration, 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Learn</p>
          <h1 className="page-title">Learning Modules</h1>
          <p className="page-subtitle">
            Short video lessons you can watch at your own pace, anytime.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-value">{modules.length}</span>
          <span className="stat-label">Available</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completedCount}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{inProgressCount}</span>
          <span className="stat-label">In Progress</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalMinutes}</span>
          <span className="stat-label">Total Minutes</span>
        </div>
      </div>

      {/* Filters */}
      <ModuleFilters
        passionIds={passionIds}
        currentPassion={passionFilter}
        currentLevel={levelFilter}
        currentStatus={statusFilter}
        currentSearch={searchQuery}
      />

      {/* Modules Grid */}
      {filteredModules.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>
            {modules.length === 0 ? "\uD83D\uDCDA" : "\uD83D\uDD0D"}
          </p>
          <h3>
            {modules.length === 0
              ? "No modules available yet"
              : "No modules match your filters"}
          </h3>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            {modules.length === 0
              ? "Check back soon \u2014 new lessons are being added."
              : "Try adjusting your filters to see more results."}
          </p>
        </div>
      ) : (
        <div className="grid two">
          {filteredModules.map((mod) => {
            const prog = progressMap.get(mod.id);
            const isCompleted = prog?.completed === true;
            const isStarted = !!prog && !prog.completed;
            const levelLabel =
              mod.level.charAt(0) + mod.level.slice(1).toLowerCase();

            return (
              <Link
                key={mod.id}
                href={`/learn/modules/${mod.id}`}
                className="card"
                style={{ display: "block", textDecoration: "none" }}
              >
                {/* Thumbnail area */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 80,
                    borderRadius: "var(--radius-md)",
                    background: "var(--ypp-purple-50)",
                    marginBottom: 16,
                    fontSize: 36,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {mod.thumbnailUrl ? (
                    <img
                      src={mod.thumbnailUrl}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "var(--radius-md)",
                      }}
                    />
                  ) : (
                    "\uD83C\uDFA5"
                  )}
                  {isCompleted && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "#22c55e",
                        color: "white",
                        borderRadius: "var(--radius-full)",
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      Completed
                    </span>
                  )}
                  {isStarted && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "var(--ypp-purple)",
                        color: "white",
                        borderRadius: "var(--radius-full)",
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      In Progress
                    </span>
                  )}
                </div>

                {/* Meta pills */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="pill pill-small pill-purple">
                    {levelLabel}
                  </span>
                  <span className="pill pill-small">{mod.duration} min</span>
                  {mod.passionId && (
                    <span className="pill pill-small pill-info">
                      {mod.passionId}
                    </span>
                  )}
                </div>

                <h3 style={{ marginBottom: 4 }}>{mod.title}</h3>
                {mod.description && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      marginTop: 4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                      overflow: "hidden",
                    }}
                  >
                    {mod.description}
                  </p>
                )}

                {/* Tags */}
                {mod.tags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      marginTop: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {mod.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          color: "var(--gray-500)",
                          background: "var(--gray-100)",
                          padding: "1px 6px",
                          borderRadius: "var(--radius-full)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Progress bar for started modules */}
                {isStarted && mod.duration > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      height: 4,
                      background: "var(--gray-200)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, ((prog?.watchTime ?? 0) / (mod.duration * 60)) * 100)}%`,
                        background: "var(--ypp-purple)",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
