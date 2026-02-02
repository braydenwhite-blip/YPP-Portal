import { prisma } from "@/lib/prisma";

export default async function InstructorTrainingPage() {
  const modules = await prisma.trainingModule.findMany({
    orderBy: { sortOrder: "asc" }
  });

  const assignments = await prisma.trainingAssignment.findMany({
    include: { user: true, module: true },
    orderBy: { createdAt: "asc" },
    take: 6
  });

  const approvals = await prisma.instructorApproval.findMany({
    include: { instructor: true, levels: true }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Training</p>
          <h1 className="page-title">Training & Approval</h1>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Training Program Structure</h3>
          <p>
            All instructors complete a shared sequence before teaching. Approval is granted by level
            (101, 201, 301) after interviews and training completion.
          </p>
          <div className="timeline" style={{ marginTop: 16 }}>
            {modules.map((module) => (
              <div key={module.id} className="timeline-item">
                <strong>{module.title}</strong>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>{module.description}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Approval Status</h3>
          {approvals.length === 0 ? (
            <p>No approvals created yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th>Status</th>
                  <th>Approved Levels</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((approval) => (
                  <tr key={approval.id}>
                    <td>{approval.instructor.name}</td>
                    <td>{approval.status.replace("_", " ")}</td>
                    <td>
                      {approval.levels.length
                        ? approval.levels
                            .map((level) => level.level.replace("LEVEL_", ""))
                            .join(", ")
                        : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="section-title">Recent Training Activity</div>
        <div className="card">
          {assignments.length === 0 ? (
            <p>No training assignments yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th>Module</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.user.name}</td>
                    <td>{assignment.module.title}</td>
                    <td>{assignment.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
