import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function InstructorReadinessPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [instructors, requiredModules, allApplications] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: "INSTRUCTOR" } } },
      include: {
        chapter: { select: { name: true } },
        approvals: {
          include: {
            levels: true,
          },
        },
        trainings: {
          include: {
            module: { select: { id: true, title: true, required: true } },
          },
        },
        courses: {
          select: { id: true, title: true, level: true },
        },
        profile: { select: { avatarUrl: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.trainingModule.findMany({
      where: { required: true },
      select: { id: true, title: true },
    }),
    prisma.application.findMany({
      where: {
        position: { type: "INSTRUCTOR" },
      },
      include: {
        applicant: { select: { id: true } },
        interviewSlots: true,
        interviewNotes: true,
        decision: true,
      },
    }),
  ]);

  // Build a map of applicant -> application data for interview status
  const applicationByUser = new Map<string, typeof allApplications[0]>();
  for (const app of allApplications) {
    applicationByUser.set(app.applicantId, app);
  }

  // Stats
  const totalInstructors = instructors.length;
  const fullyApproved = instructors.filter((i) =>
    i.approvals.some((a) => a.status === "APPROVED")
  ).length;
  const trainingComplete = instructors.filter((i) => {
    const completedIds = new Set(
      i.trainings.filter((t) => t.status === "COMPLETE").map((t) => t.moduleId)
    );
    return requiredModules.every((m) => completedIds.has(m.id));
  }).length;
  const pendingInterview = instructors.filter((i) =>
    i.approvals.some((a) => a.status === "INTERVIEW_PENDING")
  ).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Instructor Readiness Dashboard</h1>
        </div>
      </div>

      <div className="grid four">
        <div className="card">
          <div className="kpi">{totalInstructors}</div>
          <div className="kpi-label">Total Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{fullyApproved}</div>
          <div className="kpi-label">Fully Approved</div>
        </div>
        <div className="card">
          <div className="kpi">{trainingComplete}</div>
          <div className="kpi-label">Training Complete</div>
        </div>
        <div className="card">
          <div className="kpi">{pendingInterview}</div>
          <div className="kpi-label">Pending Interview</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3>Instructor Readiness Overview</h3>
          <a
            href="/api/export?table=users&role=INSTRUCTOR&format=csv"
            className="button small secondary"
            style={{ textDecoration: "none" }}
          >
            Export CSV
          </a>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Instructor</th>
              <th>Chapter</th>
              <th>Approved Levels</th>
              <th>Training Progress</th>
              <th>Approval Status</th>
              <th>Interview</th>
              <th>Courses Teaching</th>
            </tr>
          </thead>
          <tbody>
            {instructors.map((instructor) => {
              const completedModuleIds = new Set(
                instructor.trainings
                  .filter((t) => t.status === "COMPLETE")
                  .map((t) => t.moduleId)
              );
              const completedRequired = requiredModules.filter((m) =>
                completedModuleIds.has(m.id)
              ).length;
              const missingModules = requiredModules.filter(
                (m) => !completedModuleIds.has(m.id)
              );

              const approval = instructor.approvals[0];
              const approvedLevels =
                approval?.levels.map((l) => l.level.replace("LEVEL_", "")) ?? [];

              const application = applicationByUser.get(instructor.id);
              let interviewStatus = "N/A";
              if (application) {
                if (application.decision) {
                  interviewStatus = application.decision.accepted
                    ? "Accepted"
                    : "Rejected";
                } else if (application.interviewSlots.length > 0) {
                  const confirmed = application.interviewSlots.some(
                    (s) => s.isConfirmed
                  );
                  interviewStatus = confirmed ? "Scheduled" : "Pending";
                } else {
                  interviewStatus = "Applied";
                }
              }

              const trainingPct =
                requiredModules.length > 0
                  ? Math.round(
                      (completedRequired / requiredModules.length) * 100
                    )
                  : 100;

              return (
                <tr key={instructor.id}>
                  <td>
                    <strong>{instructor.name}</strong>
                    <br />
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {instructor.email}
                    </span>
                  </td>
                  <td>{instructor.chapter?.name || "—"}</td>
                  <td>
                    {approvedLevels.length > 0 ? (
                      approvedLevels.map((level) => (
                        <span key={level} className="pill pill-small" style={{ marginRight: 4 }}>
                          {level}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>None</span>
                    )}
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "#e2e8f0",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${trainingPct}%`,
                            height: "100%",
                            background:
                              trainingPct === 100 ? "#10b981" : "#f59e0b",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {completedRequired}/{requiredModules.length}
                      </span>
                    </div>
                    {missingModules.length > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#ef4444",
                          marginTop: 4,
                        }}
                      >
                        Missing:{" "}
                        {missingModules.map((m) => m.title).join(", ")}
                      </div>
                    )}
                  </td>
                  <td>
                    {approval ? (
                      <span
                        className={`pill pill-small ${
                          approval.status === "APPROVED"
                            ? "pill-enrolled"
                            : approval.status === "PAUSED"
                            ? "pill-declined"
                            : ""
                        }`}
                      >
                        {approval.status.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>
                        Not Started
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`pill pill-small ${
                        interviewStatus === "Accepted"
                          ? "pill-enrolled"
                          : interviewStatus === "Rejected"
                          ? "pill-declined"
                          : ""
                      }`}
                    >
                      {interviewStatus}
                    </span>
                  </td>
                  <td>
                    {instructor.courses.length > 0
                      ? instructor.courses.map((c) => c.title).join(", ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
