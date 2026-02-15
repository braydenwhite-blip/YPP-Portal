import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelInterviewAvailabilityRequest,
  confirmPostedInterviewSlot,
  submitInterviewAvailabilityRequest,
} from "@/lib/instructor-interview-actions";
import { getInstructorReadiness } from "@/lib/instructor-readiness";
import { requestReadinessReview } from "@/lib/training-actions";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function dateTimeLocalValue(value: Date) {
  const copy = new Date(value);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

export default async function TrainingProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const isInstructor =
    roles.includes("INSTRUCTOR") || roles.includes("ADMIN") || roles.includes("CHAPTER_LEAD");

  if (!isInstructor) {
    redirect("/");
  }

  const instructorId = session.user.id;

  const [
    modules,
    assignments,
    videoProgress,
    checkpointCompletions,
    quizAttempts,
    evidenceSubmissions,
    reviewRequests,
    interviewGate,
    readiness,
  ] = await Promise.all([
    prisma.trainingModule.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        checkpoints: {
          where: { required: true },
          select: { id: true },
        },
        quizQuestions: {
          select: { id: true },
        },
      },
    }),
    prisma.trainingAssignment.findMany({
      where: { userId: instructorId },
    }),
    prisma.videoProgress.findMany({
      where: { userId: instructorId },
      select: {
        moduleId: true,
        watchedSeconds: true,
        completed: true,
      },
    }),
    prisma.trainingCheckpointCompletion.findMany({
      where: { userId: instructorId },
      select: { checkpointId: true },
    }),
    prisma.trainingQuizAttempt.findMany({
      where: { userId: instructorId },
      orderBy: { attemptedAt: "desc" },
      select: {
        moduleId: true,
        passed: true,
        scorePct: true,
        attemptedAt: true,
      },
    }),
    prisma.trainingEvidenceSubmission.findMany({
      where: { userId: instructorId },
      orderBy: { createdAt: "desc" },
      select: {
        moduleId: true,
        status: true,
        createdAt: true,
        reviewNotes: true,
      },
    }),
    prisma.readinessReviewRequest.findMany({
      where: { instructorId },
      orderBy: { requestedAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        notes: true,
        requestedAt: true,
        reviewNotes: true,
      },
    }),
    prisma.instructorInterviewGate.upsert({
      where: { instructorId },
      create: { instructorId, status: "REQUIRED" },
      update: {},
      include: {
        slots: {
          orderBy: { scheduledAt: "asc" },
        },
        availabilityRequests: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getInstructorReadiness(instructorId),
  ]);

  const assignmentByModule = new Map(assignments.map((assignment) => [assignment.moduleId, assignment]));
  const videoByModule = new Map(videoProgress.map((progress) => [progress.moduleId, progress]));
  const completedCheckpointIds = new Set(checkpointCompletions.map((item) => item.checkpointId));

  const latestQuizByModule = new Map<string, (typeof quizAttempts)[number]>();
  const passedQuizModuleIds = new Set<string>();
  for (const attempt of quizAttempts) {
    if (!latestQuizByModule.has(attempt.moduleId)) {
      latestQuizByModule.set(attempt.moduleId, attempt);
    }
    if (attempt.passed) {
      passedQuizModuleIds.add(attempt.moduleId);
    }
  }

  const latestEvidenceByModule = new Map<string, (typeof evidenceSubmissions)[number]>();
  const approvedEvidenceModuleIds = new Set<string>();
  for (const submission of evidenceSubmissions) {
    if (!latestEvidenceByModule.has(submission.moduleId)) {
      latestEvidenceByModule.set(submission.moduleId, submission);
    }
    if (submission.status === "APPROVED") {
      approvedEvidenceModuleIds.add(submission.moduleId);
    }
  }

  const moduleCards = modules.map((module) => {
    const assignment = assignmentByModule.get(module.id);
    const progress = videoByModule.get(module.id);
    const latestQuiz = latestQuizByModule.get(module.id);
    const latestEvidence = latestEvidenceByModule.get(module.id);

    const requiredCheckpointCount = module.checkpoints.length;
    const completedRequiredCheckpoints = module.checkpoints.filter((checkpoint) =>
      completedCheckpointIds.has(checkpoint.id)
    ).length;

    const videoReady =
      !module.videoUrl ||
      progress?.completed === true ||
      (module.videoDuration ? (progress?.watchedSeconds ?? 0) >= Math.floor(module.videoDuration * 0.9) : false);

    const checkpointsReady =
      requiredCheckpointCount === 0 || completedRequiredCheckpoints >= requiredCheckpointCount;

    const quizReady = !module.requiresQuiz || passedQuizModuleIds.has(module.id);
    const evidenceReady = !module.requiresEvidence || approvedEvidenceModuleIds.has(module.id);

    return {
      module,
      assignment,
      latestQuiz,
      latestEvidence,
      videoReady,
      checkpointsReady,
      quizReady,
      evidenceReady,
      fullyComplete: videoReady && checkpointsReady && quizReady && evidenceReady,
      completedRequiredCheckpoints,
      requiredCheckpointCount,
    };
  });

  const postedSlots = interviewGate.slots.filter((slot) => slot.status === "POSTED");
  const confirmedSlot = interviewGate.slots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = interviewGate.slots.find((slot) => slot.status === "COMPLETED");
  const pendingAvailabilityRequests = interviewGate.availabilityRequests.filter(
    (request) => request.status === "PENDING"
  );

  const hasPendingReadinessReview = reviewRequests.some(
    (request) => request.status === "REQUESTED" || request.status === "UNDER_REVIEW"
  );

  const defaultAvailabilityStart = dateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Training Progress</h1>
          <p className="page-subtitle">Native readiness flow: training academy + interview gate before first publish.</p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{readiness.completedRequiredModules}/{readiness.requiredModulesCount}</div>
          <div className="kpi-label">Required Modules Complete</div>
        </div>
        <div className="card">
          <div className="kpi">{readiness.interviewStatus.replace(/_/g, " ")}</div>
          <div className="kpi-label">Interview Gate</div>
        </div>
        <div className="card">
          <div className="kpi">{readiness.nextAction.title}</div>
          <div className="kpi-label">Next Required Action</div>
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>{readiness.nextAction.detail}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Interview Readiness</h3>
            <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 14 }}>
              Status: <strong>{interviewGate.status.replace(/_/g, " ")}</strong>
              {interviewGate.outcome ? ` \u00B7 Outcome: ${interviewGate.outcome}` : ""}
              {interviewGate.scheduledAt ? ` \u00B7 Scheduled: ${formatDateTime(interviewGate.scheduledAt)}` : ""}
            </p>
          </div>
          <a href="/admin/instructor-readiness" className="button small outline" style={{ textDecoration: "none" }}>
            Reviewer View
          </a>
        </div>

        {confirmedSlot ? (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>Confirmed Interview</strong>
            <p style={{ marginBottom: 0, marginTop: 6 }}>
              {formatDateTime(confirmedSlot.scheduledAt)} ({confirmedSlot.duration} min)
            </p>
            {confirmedSlot.meetingLink ? (
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                <a href={confirmedSlot.meetingLink} target="_blank" rel="noreferrer" className="link">
                  Join meeting link
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {completedSlot ? (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
            Most recent completed interview: {formatDateTime(completedSlot.completedAt)}
          </p>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Posted Interview Slots</h4>
          {postedSlots.length === 0 ? (
            <p style={{ color: "var(--muted)", marginTop: 0 }}>No posted slots right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {postedSlots.map((slot) => (
                <div key={slot.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{formatDateTime(slot.scheduledAt)}</p>
                  <p style={{ margin: "6px 0 10px", fontSize: 13, color: "var(--muted)" }}>
                    {slot.duration} minutes{slot.notes ? ` \u00B7 ${slot.notes}` : ""}
                  </p>
                  <form action={confirmPostedInterviewSlot}>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <button type="submit" className="button small">Confirm this slot</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <h4 style={{ marginBottom: 8 }}>Request Preferred Times</h4>
          <form action={submitInterviewAvailabilityRequest} className="form-grid">
            <div className="grid three">
              <label className="form-row">
                Preferred Slot 1
                <input className="input" type="datetime-local" name="preferredStart1" defaultValue={defaultAvailabilityStart} required />
              </label>
              <label className="form-row">
                Preferred Slot 2
                <input className="input" type="datetime-local" name="preferredStart2" />
              </label>
              <label className="form-row">
                Preferred Slot 3
                <input className="input" type="datetime-local" name="preferredStart3" />
              </label>
            </div>
            <label className="form-row">
              Notes (optional)
              <textarea
                className="input"
                name="note"
                rows={2}
                placeholder="Include timezone, constraints, or preferred interviewer notes"
              />
            </label>
            <button type="submit" className="button small">Submit availability request</button>
          </form>

          {pendingAvailabilityRequests.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Pending requests</p>
              <div style={{ display: "grid", gap: 8 }}>
                {pendingAvailabilityRequests.map((request) => (
                  <form key={request.id} action={cancelInterviewAvailabilityRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit" className="button small outline">Cancel request from {formatDateTime(request.createdAt)}</button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 8 }}>Readiness Review</h3>
        <p style={{ marginTop: 0, fontSize: 14, color: "var(--muted)" }}>
          Request reviewer approval after all required modules are complete.
        </p>
        <form action={requestReadinessReview}>
          <label className="form-row" style={{ marginBottom: 10 }}>
            Notes for reviewer (optional)
            <textarea className="input" name="notes" rows={2} placeholder="Share context for your readiness review request" />
          </label>
          <button
            type="submit"
            className="button small"
            disabled={!readiness.trainingComplete || hasPendingReadinessReview}
          >
            {hasPendingReadinessReview
              ? "Review request pending"
              : readiness.trainingComplete
                ? "Request readiness review"
                : "Complete training first"}
          </button>
        </form>

        {reviewRequests.length > 0 ? (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {reviewRequests.map((request) => (
              <div key={request.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{request.status.replace(/_/g, " ")}</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                  Requested {formatDateTime(request.requestedAt)}
                </p>
                {request.reviewNotes ? (
                  <p style={{ margin: "6px 0 0", fontSize: 13 }}>{request.reviewNotes}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Academy Modules</h3>
        <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 14 }}>
          Each module is complete only when required video, checkpoints, quiz, and evidence are done.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {moduleCards.map((card) => (
            <div key={card.module.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <h4 style={{ margin: 0 }}>{card.module.title}</h4>
                  <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
                    {card.module.description}
                  </p>
                </div>
                <span className={`pill ${card.fullyComplete ? "pill-success" : ""}`}>
                  {card.assignment?.status?.replace(/_/g, " ") ?? "NOT STARTED"}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <span className={`pill pill-small ${card.videoReady ? "pill-success" : ""}`}>
                  Video {card.videoReady ? "Done" : "Pending"}
                </span>
                <span className={`pill pill-small ${card.checkpointsReady ? "pill-success" : ""}`}>
                  Checkpoints {card.completedRequiredCheckpoints}/{card.requiredCheckpointCount}
                </span>
                <span className={`pill pill-small ${card.quizReady ? "pill-success" : ""}`}>
                  Quiz {card.module.requiresQuiz ? (card.quizReady ? "Passed" : "Required") : "N/A"}
                </span>
                <span className={`pill pill-small ${card.evidenceReady ? "pill-success" : ""}`}>
                  Evidence {card.module.requiresEvidence ? (card.evidenceReady ? "Approved" : "Pending") : "N/A"}
                </span>
              </div>

              {card.latestQuiz ? (
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "var(--muted)" }}>
                  Latest quiz: {card.latestQuiz.scorePct}% on {formatDateTime(card.latestQuiz.attemptedAt)}
                </p>
              ) : null}

              {card.latestEvidence ? (
                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "var(--muted)" }}>
                  Latest evidence: {card.latestEvidence.status.replace(/_/g, " ")} ({formatDateTime(card.latestEvidence.createdAt)})
                </p>
              ) : null}

              <div style={{ marginTop: 10 }}>
                <Link href={`/training/${card.module.id}`} className="button small" style={{ textDecoration: "none" }}>
                  Open module
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
