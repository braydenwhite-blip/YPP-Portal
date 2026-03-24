import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  approveOfferingApproval,
  requestOfferingApprovalRevision,
} from "@/lib/offering-approval-actions";
import { reviewTrainingEvidence } from "@/lib/training-actions";
import {
  buildFallbackInstructorReadiness,
  getInstructorReadiness,
} from "@/lib/instructor-readiness";
import { withPrismaFallback } from "@/lib/prisma-guard";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getDraftIdFromEvidenceUrl(fileUrl: string) {
  try {
    return new URL(fileUrl, "https://studio.local").searchParams.get("draftId");
  } catch {
    return null;
  }
}

export default async function ChapterLeadInstructorReadinessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const canAccess = roles.includes("CHAPTER_PRESIDENT") || roles.includes("ADMIN");
  if (!canAccess) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      chapterId: true,
      chapter: { select: { name: true } },
    },
  });

  if (!currentUser?.chapterId) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Chapter President</p>
            <h1 className="page-title">Instructor Readiness</h1>
          </div>
        </div>
        <div className="card">
          <p className="empty">No chapter is assigned to your account.</p>
        </div>
      </div>
    );
  }

  const chapterId = currentUser.chapterId;

  const [requiredModules, instructors, evidenceQueue, approvalQueue, interviewQueue] =
    await Promise.all([
      withPrismaFallback(
        "chapter-readiness:required-modules",
        () =>
          prisma.trainingModule.findMany({
            where: { required: true },
            select: { id: true },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-readiness:instructors",
        () =>
          prisma.user.findMany({
            where: {
              chapterId,
              roles: { some: { role: "INSTRUCTOR" } },
            },
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
            },
            orderBy: { name: "asc" },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-readiness:evidence-queue",
        () =>
          prisma.trainingEvidenceSubmission.findMany({
            where: {
              status: { in: ["PENDING_REVIEW", "REVISION_REQUESTED"] },
              user: { chapterId },
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
        []
      ),
      withPrismaFallback(
        "chapter-readiness:approval-queue",
        () =>
          prisma.classOfferingApproval.findMany({
            where: {
              status: { in: ["REQUESTED", "UNDER_REVIEW", "CHANGES_REQUESTED"] },
              offering: {
                OR: [{ chapterId }, { instructor: { chapterId } }],
              },
            },
            orderBy: { requestedAt: "asc" },
            select: {
              offeringId: true,
              status: true,
              requestNotes: true,
              requestedAt: true,
              reviewNotes: true,
              offering: {
                select: {
                  title: true,
                  chapter: { select: { name: true } },
                  template: {
                    select: {
                      learnerFitLabel: true,
                    },
                  },
                  instructor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          }),
        []
      ),
      withPrismaFallback(
        "chapter-readiness:interview-queue",
        () =>
          prisma.instructorInterviewGate.findMany({
            where: {
              status: { in: ["REQUIRED", "SCHEDULED", "COMPLETED", "HOLD", "FAILED"] },
              instructor: { chapterId },
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
        []
      ),
    ]);

  const readinessEntries = await Promise.all(
    instructors.map(async (instructor) => {
      const readiness = await withPrismaFallback(
        "chapter-readiness:readiness-by-instructor",
        () => getInstructorReadiness(instructor.id),
        buildFallbackInstructorReadiness(instructor.id)
      );
      return [instructor.id, readiness] as const;
    })
  );
  const readinessByInstructor = new Map(readinessEntries);
  const approvalQueueByInstructor = new Map(
    instructors.map((instructor) => [instructor.id, [] as typeof approvalQueue])
  );
  for (const request of approvalQueue) {
    const requests = approvalQueueByInstructor.get(request.offering.instructor.id);
    if (requests) {
      requests.push(request);
    } else {
      approvalQueueByInstructor.set(request.offering.instructor.id, [request]);
    }
  }

  const trainingComplete = instructors.filter((instructor) => {
    const completedIds = new Set(
      instructor.trainings
        .filter((assignment) => assignment.status === "COMPLETE")
        .map((assignment) => assignment.moduleId)
    );

    return requiredModules.every((module) => completedIds.has(module.id));
  }).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chapter President</p>
          <h1 className="page-title">Instructor Readiness ({currentUser.chapter?.name})</h1>
          <p className="page-subtitle">Chapter-scoped readiness queue for training and interview blockers.</p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{instructors.length}</div>
          <div className="kpi-label">Chapter Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{trainingComplete}</div>
          <div className="kpi-label">Training Complete</div>
        </div>
        <div className="card">
          <div className="kpi">{interviewQueue.length}</div>
          <div className="kpi-label">Interview Blockers</div>
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
                (() => {
                  const draftId = getDraftIdFromEvidenceUrl(submission.fileUrl);
                  return (
                    <div key={submission.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{submission.user.name} - {submission.module.title}</p>
                      <p style={{ margin: "6px 0", fontSize: 13, color: "var(--muted)" }}>
                        {submission.status.replace(/_/g, " ")} • {formatDate(submission.createdAt)}
                      </p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 10px" }}>
                        <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="link">
                          Open evidence file
                        </a>
                        {draftId ? (
                          <>
                            <a
                              href={`/instructor/lesson-design-studio/print?draftId=${draftId}&type=student`}
                              target="_blank"
                              rel="noreferrer"
                              className="link"
                            >
                              Student preview
                            </a>
                            <a
                              href={`/instructor/lesson-design-studio/print?draftId=${draftId}&type=instructor`}
                              target="_blank"
                              rel="noreferrer"
                              className="link"
                            >
                              Instructor preview
                            </a>
                          </>
                        ) : null}
                      </div>

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
                            <input name="reviewNotes" className="input" placeholder="Short reviewer note" />
                          </label>
                        </div>

                        {draftId ? (
                          <>
                            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>
                              Score guide: `0` missing, `1` emerging, `2` partly working, `3` strong, `4` launch-ready.
                            </p>
                            <div className="grid four">
                              <label className="form-row">
                                Clarity
                                <select name="rubricClarity" className="input" defaultValue="3">
                                  {[0, 1, 2, 3, 4].map((score) => (
                                    <option key={score} value={score}>{score}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="form-row">
                                Sequencing
                                <select name="rubricSequencing" className="input" defaultValue="3">
                                  {[0, 1, 2, 3, 4].map((score) => (
                                    <option key={score} value={score}>{score}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="form-row">
                                Student Experience
                                <select name="rubricStudentExperience" className="input" defaultValue="3">
                                  {[0, 1, 2, 3, 4].map((score) => (
                                    <option key={score} value={score}>{score}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="form-row">
                                Launch Readiness
                                <select name="rubricLaunchReadiness" className="input" defaultValue="3">
                                  {[0, 1, 2, 3, 4].map((score) => (
                                    <option key={score} value={score}>{score}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="grid two">
                              <label className="form-row">
                                Overview note
                                <textarea name="rubricOverviewNote" className="input" rows={2} placeholder="How clear is the course purpose and promise?" />
                              </label>
                              <label className="form-row">
                                Course structure note
                                <textarea name="rubricCourseStructureNote" className="input" rows={2} placeholder="Comment on weeks, pacing, session count, or class shape." />
                              </label>
                            </div>
                            <div className="grid two">
                              <label className="form-row">
                                Session plans note
                                <textarea name="rubricSessionPlansNote" className="input" rows={2} placeholder="Comment on objectives, activity sequence, and pacing." />
                              </label>
                              <label className="form-row">
                                Student assignments note
                                <textarea name="rubricStudentAssignmentsNote" className="input" rows={2} placeholder="Comment on at-home assignments and reinforcement." />
                              </label>
                            </div>
                            <label className="form-row">
                              Rubric summary
                              <textarea name="rubricSummary" className="input" rows={2} placeholder="What should the instructor keep, fix, or do next?" />
                            </label>
                          </>
                        ) : null}

                        <button type="submit" className="button small">Submit evidence review</button>
                      </form>
                    </div>
                  );
                })()
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Offering Approval Queue</h3>
          {approvalQueue.length === 0 ? (
            <p className="empty">No offering approvals are waiting for review.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {approvalQueue.map((request) => (
                <div key={request.offeringId} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{request.offering.title}</p>
                  <p style={{ margin: "6px 0", fontSize: 13, color: "var(--muted)" }}>
                    {request.status.replace(/_/g, " ")} • {request.offering.instructor.name} • {request.offering.chapter?.name || "No chapter"} • {formatDate(request.requestedAt)}
                  </p>
                  <p style={{ marginTop: 0, marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>
                    Learner fit: {request.offering.template.learnerFitLabel || "Learner fit coming soon"}
                  </p>
                  {request.requestNotes ? <p style={{ marginTop: 0 }}>{request.requestNotes}</p> : null}
                  {request.reviewNotes ? <p style={{ marginTop: 0, fontSize: 13 }}>{request.reviewNotes}</p> : null}

                  <form action={approveOfferingApproval} className="form-grid" style={{ marginBottom: 8 }}>
                    <input type="hidden" name="offeringId" value={request.offeringId} />
                    <div className="grid one">
                      <label className="form-row">
                        Approval note
                        <input name="reviewNotes" className="input" placeholder="Optional note" />
                      </label>
                    </div>
                    <button type="submit" className="button small">Approve offering</button>
                  </form>

                  <form action={requestOfferingApprovalRevision} className="form-grid">
                    <input type="hidden" name="offeringId" value={request.offeringId} />
                    <div className="grid two">
                      <label className="form-row">
                        Approval status
                        <select name="status" className="input" defaultValue="CHANGES_REQUESTED">
                          <option value="CHANGES_REQUESTED">Changes requested</option>
                          <option value="REJECTED">Reject offering</option>
                        </select>
                      </label>
                      <label className="form-row">
                        Reviewer note
                        <input name="reviewNotes" className="input" placeholder="Explain what is missing" />
                      </label>
                    </div>
                    <button type="submit" className="button small outline">Send update</button>
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
            Interview execution now lives in Interview Command Center for chapter-scoped guidance.
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
              return (
                <div key={gate.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{gate.instructor.name}</p>
                  <p style={{ margin: "6px 0", fontSize: 13, color: "var(--muted)" }}>
                    {gate.status.replace(/_/g, " ")}
                  </p>

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
                      href="/interviews?scope=readiness&view=team&state=scheduled"
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
            const pendingApprovals = approvalQueueByInstructor.get(instructor.id) ?? [];
            const nextApproval = pendingApprovals[0];

            return (
              <div key={instructor.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{instructor.name}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{instructor.email}</p>
                  </div>
                  <Link href="/chapter-lead/dashboard" className="link">Chapter dashboard</Link>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <span className="pill pill-small">Interview: {readiness?.interviewStatus.replace(/_/g, " ")}</span>
                  <span className="pill pill-small">
                    Training: {readiness?.completedRequiredModules ?? 0}/{readiness?.requiredModulesCount ?? 0}
                  </span>
                  <span className="pill pill-small">
                    Ready for approval request: {readiness?.canRequestOfferingApproval ? "Yes" : "No"}
                  </span>
                  <span className="pill pill-small">
                    Offering approvals waiting: {pendingApprovals.length}
                  </span>
                  <span className="pill pill-small">
                    Legacy exemptions: {readiness?.legacyExemptOfferingCount ?? 0}
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

                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
                  {nextApproval
                    ? `Next reviewer action: ${nextApproval.offering.title} is ${nextApproval.status.replace(/_/g, " ").toLowerCase()} (${formatDate(nextApproval.requestedAt)})`
                    : `Next reviewer action: ${readiness?.missingRequirements[0]?.title || "No reviewer action queued"}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
