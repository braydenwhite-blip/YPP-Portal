import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CustomGoalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const goals = await prisma.customGoal.findMany({
    where: { userId: session.user.id },
    include: {
      milestones: {
        orderBy: { sortOrder: "asc" }
      },
      progress: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: [
      { status: "asc" },
      { createdAt: "desc" }
    ]
  });

  const activeGoals = goals.filter(g => g.status === "ACTIVE");
  const completedGoals = goals.filter(g => g.status === "COMPLETED");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Growth</p>
          <h1 className="page-title">Custom Goals</h1>
        </div>
        <Link href="/goals/custom/new" className="button primary">
          Create Goal
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>About Custom Goals</h3>
          <p>
            Set personal goals beyond your assigned objectives. Track milestones, log progress updates,
            and stay motivated on your journey.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{activeGoals.length}</div>
              <div className="kpi-label">Active Goals</div>
            </div>
            <div>
              <div className="kpi">{completedGoals.length}</div>
              <div className="kpi-label">Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">Active Goals</div>
          <div className="grid two">
            {activeGoals.map(goal => {
              const latestProgress = goal.progress[0];
              const completedMilestones = goal.milestones.filter(m => m.completed).length;
              const totalMilestones = goal.milestones.length;
              const progressPercentage = latestProgress?.progress ||
                (totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0);

              return (
                <Link
                  key={goal.id}
                  href={`/goals/custom/${goal.id}`}
                  className="card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <h3>{goal.title}</h3>
                      {goal.category && (
                        <span className="pill" style={{ marginTop: 4 }}>{goal.category}</span>
                      )}
                    </div>
                    <div className="kpi">{Math.round(progressPercentage)}%</div>
                  </div>

                  {goal.description && (
                    <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
                      {goal.description.slice(0, 100)}
                      {goal.description.length > 100 && "..."}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div style={{
                    width: "100%",
                    height: 8,
                    backgroundColor: "var(--border-color)",
                    borderRadius: 4,
                    overflow: "hidden",
                    marginTop: 12
                  }}>
                    <div style={{
                      width: `${progressPercentage}%`,
                      height: "100%",
                      backgroundColor: "var(--primary-color)"
                    }} />
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-secondary)" }}>
                    <span>{completedMilestones}/{totalMilestones} milestones</span>
                    {goal.targetDate && (
                      <span>Due: {new Date(goal.targetDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div>
          <div className="section-title">Completed Goals</div>
          <div className="grid two">
            {completedGoals.map(goal => (
              <Link
                key={goal.id}
                href={`/goals/custom/${goal.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit", opacity: 0.7 }}
              >
                <h3>✓ {goal.title}</h3>
                {goal.category && (
                  <span className="pill success" style={{ marginTop: 4 }}>{goal.category}</span>
                )}
                {goal.description && (
                  <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
                    {goal.description.slice(0, 100)}
                    {goal.description.length > 100 && "..."}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="card">
          <h3>No Custom Goals Yet</h3>
          <p>
            Create your first personal goal to start tracking your progress beyond assigned objectives.
          </p>
          <Link href="/goals/custom/new" className="button primary" style={{ marginTop: 12 }}>
            Create Your First Goal
          </Link>
        </div>
      )}
    </div>
  );
}
