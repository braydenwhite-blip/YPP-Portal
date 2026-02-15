import { prisma } from "@/lib/prisma";
import { submitTrainingEvidence } from "@/lib/training-actions";
import FileUpload from "@/components/file-upload";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InstructorTrainingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const canAccess =
    roles.includes("ADMIN") || roles.includes("INSTRUCTOR") || roles.includes("CHAPTER_LEAD");
  if (!canAccess) {
    redirect("/");
  }

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
            (101, 201, 301, 401) after interviews and training completion.
          </p>
          <div className="timeline" style={{ marginTop: 16 }}>
            {modules.map((module) => (
              <div key={module.id} className="timeline-item">
                <strong>{module.title}</strong>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>{module.description}</div>
                {module.materialUrl ? (
                  <div style={{ marginTop: 8 }}>
                    <a className="link" href={module.materialUrl} target="_blank" rel="noreferrer">
                      Open training material
                    </a>
                  </div>
                ) : null}
                {module.materialNotes ? (
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                    {module.materialNotes}
                  </div>
                ) : null}
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
        <div className="section-title">Submit Training Evidence</div>
        <div className="card">
          <h3>Upload Completion Evidence</h3>
          <p style={{ marginBottom: 16 }}>
            Upload certificates, screenshots, or documents as evidence of training completion.
          </p>
          <form action={submitTrainingEvidence}>
            <div className="form-row">
              <label>Training Module</label>
              <select name="moduleId" className="input" required>
                <option value="">Select module...</option>
                {modules.map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label>Evidence File</label>
              <FileUpload
                category="TRAINING_EVIDENCE"
                entityType="training_module"
                maxSizeMB={10}
                label="Upload Evidence"
              />
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label>Notes (optional)</label>
              <textarea
                name="notes"
                className="input"
                rows={2}
                placeholder="Any notes about this submission..."
              />
            </div>
            <button type="submit" className="button small" style={{ marginTop: 12 }}>
              Submit Evidence
            </button>
          </form>
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
