import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function MenteeHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" ||
                       session.user.primaryRole === "MENTOR" ||
                       session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get mentees (students where user is mentor)
  const mentorships = await prisma.mentorship.findMany({
    where: { mentorId: session.user.id, status: "ACTIVE" },
    include: {
      mentee: {
        include: {
          enrollments: {
            include: {
              course: true
            }
          },
          assignmentSubmissions: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          },
          reflectionEntries: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      }
    }
  });

  // Calculate health metrics for each mentee
  const menteeHealth = mentorships.map(mentorship => {
    const mentee = mentorship.mentee;
    const activeEnrollments = mentee.enrollments.filter(e => e.status === "ENROLLED");
    const recentSubmissions = mentee.assignmentSubmissions.length;
    const lastReflection = mentee.reflectionEntries[0];
    const daysSinceReflection = lastReflection
      ? Math.floor((Date.now() - new Date(lastReflection.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Health score calculation
    let healthScore = 0;
    if (activeEnrollments.length > 0) healthScore += 30;
    if (recentSubmissions >= 3) healthScore += 40;
    else if (recentSubmissions >= 1) healthScore += 20;
    if (daysSinceReflection <= 7) healthScore += 30;
    else if (daysSinceReflection <= 14) healthScore += 15;

    const status =
      healthScore >= 70 ? "THRIVING" :
      healthScore >= 40 ? "STABLE" :
      "AT_RISK";

    return {
      mentorship,
      mentee,
      activeEnrollments: activeEnrollments.length,
      recentSubmissions,
      daysSinceReflection,
      healthScore,
      status,
      lastReflection
    };
  }).sort((a, b) => a.healthScore - b.healthScore);

  const atRisk = menteeHealth.filter(m => m.status === "AT_RISK");
  const stable = menteeHealth.filter(m => m.status === "STABLE");
  const thriving = menteeHealth.filter(m => m.status === "THRIVING");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentor Tools</p>
          <h1 className="page-title">Mentee Health Dashboard</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Monitor Your Mentees</h3>
        <p>
          Track engagement, progress, and wellbeing of your mentees. Early intervention can make
          a big difference in student success.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi" style={{ color: "var(--error-color)" }}>{atRisk.length}</div>
          <div className="kpi-label">At Risk</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--warning-color)" }}>{stable.length}</div>
          <div className="kpi-label">Stable</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "var(--success-color)" }}>{thriving.length}</div>
          <div className="kpi-label">Thriving</div>
        </div>
      </div>

      {/* At-risk mentees */}
      {atRisk.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">🚨 At-Risk Mentees - Action Needed</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {atRisk.map(({ mentee, activeEnrollments, recentSubmissions, daysSinceReflection, lastReflection }) => (
              <div
                key={mentee.id}
                className="card"
                style={{ borderLeft: "4px solid var(--error-color)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3>{mentee.name}</h3>
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 14 }}>
                        📚 Active enrollments: <strong>{activeEnrollments}</strong>
                      </div>
                      <div style={{ fontSize: 14 }}>
                        📝 Submissions (30d): <strong>{recentSubmissions}</strong>
                      </div>
                      <div style={{ fontSize: 14 }}>
                        💭 Last reflection:{" "}
                        <strong>
                          {daysSinceReflection === 999
                            ? "Never"
                            : `${daysSinceReflection} days ago`}
                        </strong>
                      </div>
                      {lastReflection && (
                        <div style={{
                          marginTop: 8,
                          padding: 12,
                          backgroundColor: "var(--accent-bg)",
                          borderRadius: 6,
                          fontSize: 13
                        }}>
                          <strong>Last mood:</strong> {lastReflection.mood}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginLeft: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Link
                      href={`/messages/new?to=${mentee.id}`}
                      className="button primary small"
                    >
                      Send Message
                    </Link>
                    <Link
                      href={`/students/${mentee.id}`}
                      className="button secondary small"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stable mentees */}
      {stable.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">⚠️ Stable Mentees</div>
          <div className="grid two">
            {stable.map(({ mentee, activeEnrollments, recentSubmissions }) => (
              <div key={mentee.id} className="card">
                <h4>{mentee.name}</h4>
                <div style={{ marginTop: 8, fontSize: 14 }}>
                  📚 {activeEnrollments} active courses
                </div>
                <div style={{ fontSize: 14 }}>
                  📝 {recentSubmissions} recent submissions
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thriving mentees */}
      {thriving.length > 0 && (
        <div>
          <div className="section-title">✅ Thriving Mentees</div>
          <div className="grid three">
            {thriving.map(({ mentee, activeEnrollments, recentSubmissions }) => (
              <div key={mentee.id} className="card">
                <h4>{mentee.name}</h4>
                <div style={{ marginTop: 8, fontSize: 14, color: "var(--success-color)" }}>
                  ✓ Doing great!
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {activeEnrollments} courses • {recentSubmissions} submissions
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {menteeHealth.length === 0 && (
        <div className="card">
          <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            No active mentees found. Check your mentorship assignments.
          </p>
        </div>
      )}
    </div>
  );
}
