import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  approveReadinessReview,
  grantTeachingPermission,
  requestReadinessRevision,
  reviewTrainingEvidence,
} from "@/lib/training-actions";
import { getInstructorReadiness } from "@/lib/instructor-readiness";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function InstructorReadinessPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [requiredModules, instructors, evidenceQueue, readinessQueue, interviewQueue] =
    await Promise.all([
      prisma.trainingModule.findMany({
        where: { required: true },
        select: { id: true },
      }),
      prisma.user.findMany({
        where: { roles: { some: { role: "INSTRUCTOR" } } },
        select: {
          id: true,
          name: true,
          email: true,
          chapter: { select: { name: true } },
          trainings: {
            select: {
              moduleId: true,
              status: true,
            },
          },
          teachingPermissions: {
            select: {
              level: true,
            },
          },
          interviewGate: {
            include: {
              slots: {
                orderBy: { scheduledAt: "asc" },
              },
              availabilityRequests: {
                where: { status: "PENDING" },
                orderBy: { createdAt: "desc" },
              },
            },
          },
          readinessReviewRequests: {
            where: {
              status: { in: ["REQUESTED", "UNDER_REVIEW", "REVISION_REQUESTED"] },
            },
            orderBy: { requestedAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              requestedAt: true,
              notes: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.trainingEvidenceSubmission.findMany({
        where: {
          status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          notes: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          module: { select: { id: true, title: true } },
          fileUrl: true,
        },
      }),
      prisma.readinessReviewRequest.findMany({
        where: {
          status: { in: ["REQUESTED", "UNDER_REVIEW", "REVISION_REQUESTED"] },
        },
        orderBy: { requestedAt: "asc" },
        select: {
          id: true,
          status: true,
          notes: true,
          requestedAt: true,
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
              chapter: { select: { name: true } },
            },
          },
        },
      }),
      prisma.instructorInterviewGate.findMany({
        where: {
          status: { in: ["REQUIRED", "SCHEDULED", "COMPLETED", "HOLD", "FAILED"] },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
              chapter: { select: { name: true } },
            },
          },
          slots: {
            orderBy: { scheduledAt: "asc" },
          },
          availabilityRequests: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    ]);

  const readinessEntries = await Promise.all(
    instructors.map(async (instructor) => {
      const readiness = await getInstructorReadiness(instructor.id);
      return [instructor.id, readiness] as const;
    })
  );
  const readinessByInstructor = new Map(readinessEntries);

  const totalInstructors = instructors.length;
  const trainingComplete = instructors.filter((instructor) => {
    const completedIds = new Set(
      instructor.trainings
        .filter((assignment) => assignment.status === "COMPLETE")
        .map((assignment) => assignment.moduleId)
    );

    return requiredModules.every((module) => completedIds.has(module.id));
  }).length;

  const interviewPassed = instructors.filter((instructor) => {
    const status = instructor.interviewGate?.status;
    return status === "PASSED" || status === "WAIVED";
  }).length;

  const readyToPublish = instructors.filter((instructor) => {
    const readiness = readinessByInstructor.get(instructor.id);
    return readiness?.canPublishFirstOffering;
  }).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Instructor Readiness Command Center</h1>
          <p className="page-subtitle">
            Resolve training blockers, interview scheduling, and teaching permissions before first publish.
          </p>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{totalInstructors}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{trainingComplete}</div>
          <div className="kpi-label">Training Complete</div>
        </div>
        <div className="card">
          <div className="kpi">{interviewPassed}</div>
          <div className="kpi-label">Interview Passed/Waived</div>
        </div>
        <div className="card">
          <div className="kpi">{readyToPublish}</div>
          <div className="kpi-label">Ready for First Publish</div>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Training Evidence Queue</h3>
          {evidenceQueue.length === 0 ? (
            <p className="empty">No evidence submissions waiting for review.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {evidenceQueue.map((submission) => (
                <div key={submission.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{submission.user.name} - {submission.module.title}</p>
                  <p style={{ margin: "6px 0", fontSize: 13, color: "var(--muted)" }}>
                    {submission.status.replace(/_/g, " ")} • {formatDate(submission.createdAt)}
                  </p>
                  <p style={{ margin: "0 0 8px" }}>
                    <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="link">
                      Open evidence file
                    </a>
                  </p>

                  <form action={reviewTrainingEvidence} className="form-grid">
                    <input type="hidden" name="submissionId" value={submission.id} />
                    <div className="grid two">
                      <label className="form-row">
                        Decision
                        <select name="status" className="input" defaultValue="APPROVED">
                          <option value="APPROVED">Approve</option>
                          <option value="REVISION_REQUESTED">Request revision</option>
                          <option value="REJECTED">Reject</option>
                        </select>
                      </label>
                      <label className="form-row">
                        Review notes
                        <input name="reviewNotes" className="input" placeholder="Optional reviewer note" />
                      </label>
                    </div>
                    <button type="submit" className="button small">Submit evidence review</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Readiness Review Queue</h3>
          {readinessQueue.length === 0 ? (
            <p className="empty">No readiness requests pending review.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {readinessQueue.map((request) => (
                <div key={request.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{request.instructor.name}</p>
                  <p style={{ margin: "6px 0", fontSize: 13, color: "var(--muted)" }}>
                    {request.status.replace(/_/g, " ")} • {request.instructor.chapter?.name || "No chapter"} • {formatDate(request.requestedAt)}
                  </p>
                  {request.notes ? <p style={{ marginTop: 0 }}>{request.notes}</p> : null}

                  <form action={approveReadinessReview} className="form-grid" style={{ marginBottom: 8 }}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <div className="grid two">
                      <label className="form-row">
                        Level to grant
                        <select name="level" className="input" defaultValue="LEVEL_101">
                          <option value="LEVEL_101">LEVEL 101</option>
                          <option value="LEVEL_201">LEVEL 201</option>
                          <option value="LEVEL_301">LEVEL 301</option>
                          <option value="LEVEL_401">LEVEL 401</option>
                        </select>
                      </label>
                      <label className="form-row">
                        Approval note
                        <input name="reviewNotes" className="input" placeholder="Optional note" />
                      </label>
                    </div>
                    <button type="submit" className="button small">Approve readiness + grant level</button>
                  </form>

                  <form action={requestReadinessRevision} className="form-grid">
                    <input type="hidden" name="requestId" value={request.id} />
                    <div className="grid two">
                      <label className="form-row">
                        Revision status
                        <select name="status" className="input" defaultValue="REVISION_REQUESTED">
                          <option value="REVISION_REQUESTED">Revision requested</option>
                          <option value="REJECTED">Reject request</option>
                        </select>
                      </label>
                      <label className="form-row">
                        Reviewer note
                        <input name="reviewNotes" className="input" placeholder="Explain what is missing" />
                      </label>
                    </div>
                    <button type="submit" className="button small outline">Send revision</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Interview Queue</h3>
        <div
          style={{
            border: "1px solid #c4b5fd",
            background: "#faf5ff",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            Interview execution now lives in Interview Command Center for guided next actions.
          </p>
          <Link
            href="/interviews?scope=readiness&view=team&state=needs_action"
            className="button small outline"
            style={{ textDecoration: "none" }}
          >
            Open Interview Command Center
          </Link>
        </div>
        {interviewQueue.length === 0 ? (
          <p className="empty">No interview gate items are currently blocked.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {interviewQueue.map((gate) => {
              const confirmedSlot = gate.slots.find((slot) => slot.status === "CONFIRMED");
              const completedSlot = gate.slots.find((slot) => slot.status === "COMPLETED");

              return (
                <div key={gate.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{gate.instructor.name}</p>
                  <p style={{ margin: "6px 0", fontSize: 13, color: "var(--muted)" }}>
                    {gate.status.replace(/_/g, " ")} • {gate.instructor.chapter?.name || "No chapter"}
                  </p>

                  {confirmedSlot ? (
                    <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                      Confirmed slot: {formatDate(confirmedSlot.scheduledAt)} ({confirmedSlot.duration} min)
                    </p>
                  ) : null}

                  {completedSlot ? (
                    <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                      Completed slot: {formatDate(completedSlot.completedAt)}
                    </p>
                  ) : null}

                  {gate.availabilityRequests.length > 0 ? (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>
                        Pending availability requests: {gate.availabilityRequests.length}
                      </p>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      href="/interviews?scope=readiness&view=team&state=needs_action"
                      className="button small"
                      style={{ textDecoration: "none" }}
                    >
                      Work in Command Center
                    </Link>
                    <Link
                      href={`/interviews?scope=readiness&view=team&state=scheduled`}
                      className="button small outline"
                      style={{ textDecoration: "none" }}
                    >
                      View Scheduled
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Per-Instructor Readiness</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {instructors.map((instructor) => {
            const readiness = readinessByInstructor.get(instructor.id);
            const pendingReview = instructor.readinessReviewRequests[0];
            const gateStatus = instructor.interviewGate?.status ?? "REQUIRED";

            return (
              <div key={instructor.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{instructor.name}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      {instructor.email} • {instructor.chapter?.name || "No chapter"}
                    </p>
                  </div>
                  <Link href="/admin/applications" className="link">
                    Applications
                  </Link>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <span className="pill pill-small">Interview: {gateStatus.replace(/_/g, " ")}</span>
                  <span className="pill pill-small">
                    Training: {readiness?.completedRequiredModules ?? 0}/{readiness?.requiredModulesCount ?? 0}
                  </span>
                  <span className="pill pill-small">
                    Can publish first offering: {readiness?.canPublishFirstOffering ? "Yes" : "No"}
                  </span>
                  <span className="pill pill-small">
                    Teaching levels: {instructor.teachingPermissions.map((permission) => permission.level.replace("LEVEL_", "")).join(", ") || "None"}
                  </span>
                </div>

                {readiness?.missingRequirements.length ? (
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: "#b91c1c" }}>
                    Missing: {readiness.missingRequirements.map((item) => item.title).join("; ")}
                  </p>
                ) : (
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: "#166534" }}>
                    No readiness blockers.
                  </p>
                )}

                {pendingReview ? (
                  <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
                    Pending reviewer action: {pendingReview.status.replace(/_/g, " ")} ({formatDate(pendingReview.requestedAt)})
                  </p>
                ) : (
                  <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
                    Next reviewer action: {readiness?.missingRequirements[0]?.title || "None"}
                  </p>
                )}

                <form action={grantTeachingPermission} className="form-grid" style={{ marginTop: 10 }}>
                  <input type="hidden" name="instructorId" value={instructor.id} />
                  <div className="grid three">
                    <label className="form-row">
                      Grant level
                      <select name="level" className="input" defaultValue="LEVEL_101">
                        <option value="LEVEL_101">LEVEL 101</option>
                        <option value="LEVEL_201">LEVEL 201</option>
                        <option value="LEVEL_301">LEVEL 301</option>
                        <option value="LEVEL_401">LEVEL 401</option>
                      </select>
                    </label>
                    <label className="form-row" style={{ gridColumn: "span 2" }}>
                      Reason
                      <input name="reason" className="input" placeholder="Why permission is being granted" />
                    </label>
                  </div>
                  <button type="submit" className="button small outline">Grant teaching permission</button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
