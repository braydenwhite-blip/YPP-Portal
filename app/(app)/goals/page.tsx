import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProgressBar, GoalProgressDisplay } from "@/components/progress-bar";

export default async function GoalsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      chapter: true,
      menteePairs: {
        where: { status: "ACTIVE" },
        include: {
          mentor: {
            select: { id: true, name: true, email: true, phone: true }
          }
        }
      }
    }
  });

  if (!user) {
    redirect("/login");
  }

  const roles = user.roles.map((r) => r.role);
  const isInstructor = roles.includes("INSTRUCTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");

  // Get user's goals with latest progress
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: {
      template: true,
      progress: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          submittedBy: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { template: { sortOrder: "asc" } }
  });

  const goalsWithProgress = goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    description: goal.template.description,
    timetable: goal.timetable,
    targetDate: goal.targetDate,
    latestStatus: goal.progress[0]?.status ?? null,
    latestComments: goal.progress[0]?.comments ?? null,
    lastUpdatedAt: goal.progress[0]?.createdAt ?? null,
    lastUpdatedBy: goal.progress[0]?.submittedBy?.name ?? null
  }));

  // Get progress history
  const progressHistory = await prisma.progressUpdate.findMany({
    where: {
      forUserId: userId
    },
    include: {
      goal: {
        include: { template: true }
      },
      submittedBy: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const mentor = user.menteePairs[0]?.mentor ?? null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Goals & Progress</p>
          <h1 className="page-title">My Goals</h1>
        </div>
        <div className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
          {isInstructor ? "Instructor" : isChapterLead ? "Chapter Lead" : "Staff"} Goals
        </div>
      </div>

      {mentor && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">My Mentor</div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>{mentor.name}</h3>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
                {mentor.email}
                {mentor.phone && ` · ${mentor.phone}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid two">
        <div className="card">
          <div className="section-title">Progress Update</div>
          {goalsWithProgress.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              No goals have been assigned yet. Your mentor or admin will assign goals based on your role.
            </p>
          ) : (
            <>
              <GoalProgressDisplay
                goals={goalsWithProgress.map((g) => ({
                  id: g.id,
                  title: g.title,
                  timetable: g.timetable,
                  latestStatus: g.latestStatus
                }))}
                showOverall={true}
              />

              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: "0 0 12px" }}>Goal Details</h4>
                {goalsWithProgress.map((goal, index) => (
                  <div
                    key={goal.id}
                    style={{
                      padding: 16,
                      marginBottom: 12,
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong>Goal {index + 1}: {goal.title}</strong>
                        {goal.timetable && (
                          <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: 13 }}>
                            (By {goal.timetable})
                          </span>
                        )}
                      </div>
                      {goal.latestStatus && (
                        <span
                          className={`pill ${
                            goal.latestStatus === "ON_TRACK"
                              ? "pill-success"
                              : goal.latestStatus === "BEHIND_SCHEDULE"
                              ? "pill-pending"
                              : goal.latestStatus === "ABOVE_AND_BEYOND"
                              ? "pill-pathway"
                              : ""
                          }`}
                        >
                          {goal.latestStatus.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {goal.description && (
                      <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13 }}>
                        {goal.description}
                      </p>
                    )}
                    {goal.latestComments && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "white",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 13
                        }}
                      >
                        <strong>Mentor Feedback:</strong>
                        <p style={{ margin: "4px 0 0" }}>{goal.latestComments}</p>
                        {goal.lastUpdatedBy && goal.lastUpdatedAt && (
                          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12 }}>
                            — {goal.lastUpdatedBy},{" "}
                            {new Date(goal.lastUpdatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="section-title">Your Happiness in YPP</div>
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
              Submit monthly reflections to help your mentor understand how you&apos;re doing.
            </p>
            <a href="/reflection" className="button small" style={{ display: "inline-block", textDecoration: "none" }}>
              Submit Monthly Reflection
            </a>
          </div>

          <div className="section-title" style={{ marginTop: 24 }}>Progress History</div>
          {progressHistory.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>No progress updates yet.</p>
          ) : (
            <div className="timeline">
              {progressHistory.map((update) => (
                <div key={update.id} className="timeline-item">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <strong style={{ fontSize: 14 }}>{update.goal.template.title}</strong>
                    <span
                      className={`pill ${
                        update.status === "ON_TRACK"
                          ? "pill-success"
                          : update.status === "BEHIND_SCHEDULE"
                          ? "pill-pending"
                          : update.status === "ABOVE_AND_BEYOND"
                          ? "pill-pathway"
                          : ""
                      }`}
                      style={{ fontSize: 10 }}
                    >
                      {update.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {update.comments && (
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      {update.comments}
                    </p>
                  )}
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    By {update.submittedBy.name} · {new Date(update.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="section-title" style={{ marginTop: 24 }}>Future Plan of Action</div>
          <div
            style={{
              padding: 16,
              background: "var(--surface-alt)",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--border)"
            }}
          >
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              <strong>Revisions to future goals</strong> (major vision-level changes should be discussed
              with the Executive Committee)
            </p>
            <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 13 }}>
              <strong>Action Items and Implementation Plan</strong> (for larger goals, include specific
              subgoals not yet achieved and action plan to achieve them)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
