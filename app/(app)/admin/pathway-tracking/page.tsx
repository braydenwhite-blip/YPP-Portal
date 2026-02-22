import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PathwayTrackingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  // Load all pathways with their steps
  const pathways = await prisma.pathway.findMany({
    include: {
      steps: {
        include: { course: true },
        orderBy: { stepOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // For each pathway, compute aggregate enrollment stats
  const pathwayStats = await Promise.all(
    pathways.map(async (pathway) => {
      const courseIds = pathway.steps.map((s) => s.courseId);
      if (courseIds.length === 0) {
        return { pathway, enrolledUsers: 0, completedUsers: 0, dropoffByStep: [], avgProgress: 0 };
      }

      // Get all unique users enrolled in at least one step
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        select: { userId: true, courseId: true, status: true },
      });

      const userIds = [...new Set(enrollments.map((e) => e.userId))];
      const enrolledUsers = userIds.length;

      // Per-user progress
      const userProgress = userIds.map((userId) => {
        const userEnrollments = enrollments.filter((e) => e.userId === userId);
        const completedCount = userEnrollments.filter((e) => e.status === "COMPLETED").length;
        return completedCount;
      });

      const completedUsers = userProgress.filter((c) => c >= pathway.steps.length).length;
      const avgProgress = userIds.length > 0
        ? Math.round(userProgress.reduce((sum, c) => sum + c, 0) / userIds.length)
        : 0;

      // Drop-off: how many users reached each step
      const dropoffByStep = pathway.steps.map((step) => {
        const reached = enrollments.filter((e) => e.courseId === step.courseId).length;
        return { stepOrder: step.stepOrder, courseTitle: step.course.title, reached };
      });

      return { pathway, enrolledUsers, completedUsers, dropoffByStep, avgProgress };
    })
  );

  // Recent student drill-down: load top enrolled users across all pathways
  const recentEnrollments = await prisma.enrollment.findMany({
    where: {
      courseId: {
        in: pathways.flatMap((p) => p.steps.map((s) => s.courseId)),
      },
    },
    include: {
      user: { select: { id: true, name: true, primaryRole: true } },
      course: {
        include: {
          pathwaySteps: {
            include: { pathway: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Group by user → pathways enrolled
  const userPathwayMap = new Map<string, { userName: string; pathways: Map<string, { pathwayName: string; completedSteps: number; totalSteps: number }> }>();
  for (const e of recentEnrollments) {
    if (!userPathwayMap.has(e.userId)) {
      userPathwayMap.set(e.userId, { userName: e.user.name, pathways: new Map() });
    }
    const userData = userPathwayMap.get(e.userId)!;
    for (const ps of e.course.pathwaySteps) {
      const pathwayId = ps.pathway.id;
      if (!userData.pathways.has(pathwayId)) {
        const pw = pathways.find((p) => p.id === pathwayId);
        userData.pathways.set(pathwayId, {
          pathwayName: ps.pathway.name,
          completedSteps: 0,
          totalSteps: pw?.steps.length ?? 0,
        });
      }
      if (e.status === "COMPLETED") {
        const entry = userData.pathways.get(pathwayId)!;
        entry.completedSteps++;
      }
    }
  }

  const studentDrilldown = [...userPathwayMap.entries()].slice(0, 20);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Pathway Tracking</h1>
        </div>
        <Link href="/admin/pathways" className="button outline small">
          Manage Pathways
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{pathways.length}</div>
          <div className="kpi-label">Total Pathways</div>
        </div>
        <div className="card">
          <div className="kpi">{pathways.filter((p) => p.isActive).length}</div>
          <div className="kpi-label">Active Pathways</div>
        </div>
      </div>

      {/* Per-pathway table */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-title">Pathway Enrollment Summary</div>
        {pathways.length === 0 ? (
          <div className="card"><p>No pathways exist yet.</p></div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--gray-200, #e2e8f0)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Pathway</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Steps</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Enrolled</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Completed</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Completion Rate</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Avg Steps Done</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pathwayStats.map(({ pathway, enrolledUsers, completedUsers, avgProgress }) => (
                  <tr key={pathway.id} style={{ borderBottom: "1px solid var(--gray-100, #f7fafc)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <Link href={`/pathways/${pathway.id}`} style={{ fontWeight: 600, color: "var(--ypp-purple)", textDecoration: "none" }}>
                        {pathway.name}
                      </Link>
                      <div style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 2 }}>{pathway.interestArea}</div>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>{pathway.steps.length}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>{enrolledUsers}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>{completedUsers}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      {enrolledUsers > 0 ? `${Math.round((completedUsers / enrolledUsers) * 100)}%` : "—"}
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>{avgProgress}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      <span className="pill" style={pathway.isActive ? { background: "#f0fdf4", color: "#166534" } : { background: "#fef2f2", color: "#991b1b" }}>
                        {pathway.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Funnel view */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-title">Step-by-Step Drop-off Funnel</div>
        <div className="grid two">
          {pathwayStats
            .filter((s) => s.dropoffByStep.length > 0)
            .map(({ pathway, dropoffByStep }) => (
              <div key={pathway.id} className="card">
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>{pathway.name}</h3>
                {dropoffByStep.map((step) => (
                  <div key={step.stepOrder} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                      <span style={{ color: "var(--gray-600)" }}>Step {step.stepOrder}: {step.courseTitle}</span>
                      <span style={{ fontWeight: 600 }}>{step.reached}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--gray-200, #e2e8f0)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: dropoffByStep[0]?.reached > 0 ? `${(step.reached / dropoffByStep[0].reached) * 100}%` : "0%",
                          background: "var(--ypp-purple)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Student drill-down */}
      <div>
        <div className="section-title">Student Progress (Recent 20)</div>
        {studentDrilldown.length === 0 ? (
          <div className="card"><p>No student enrollments yet.</p></div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--gray-200, #e2e8f0)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Student</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Pathway</th>
                  <th style={{ textAlign: "center", padding: "8px 12px" }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {studentDrilldown.flatMap(([userId, data]) =>
                  [...data.pathways.entries()].map(([pathwayId, pw]) => (
                    <tr key={`${userId}-${pathwayId}`} style={{ borderBottom: "1px solid var(--gray-100, #f7fafc)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>{data.userName}</td>
                      <td style={{ padding: "10px 12px" }}>{pw.pathwayName}</td>
                      <td style={{ textAlign: "center", padding: "10px 12px" }}>
                        <span className="pill">
                          {pw.completedSteps} / {pw.totalSteps} steps
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
