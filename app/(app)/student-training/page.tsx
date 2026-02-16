import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const TRACKABLE_REQUIRED_VIDEO_PROVIDERS = new Set(["YOUTUBE", "VIMEO", "CUSTOM"]);

export default async function StudentTrainingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const canView = roles.includes("STUDENT") || roles.includes("ADMIN");
  if (!canView) {
    redirect("/");
  }

  const learnerId = session.user.id;

  const [assignments, videoProgress, checkpointCompletions, quizAttempts, evidenceSubmissions] =
    await Promise.all([
      prisma.trainingAssignment.findMany({
        where: { userId: learnerId },
        include: {
          module: {
            include: {
              checkpoints: {
                where: { required: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true, sortOrder: true },
              },
              quizQuestions: {
                select: { id: true },
              },
            },
          },
        },
      }),
      prisma.videoProgress.findMany({
        where: { userId: learnerId },
        select: {
          moduleId: true,
          watchedSeconds: true,
          completed: true,
        },
      }),
      prisma.trainingCheckpointCompletion.findMany({
        where: { userId: learnerId },
        select: { checkpointId: true },
      }),
      prisma.trainingQuizAttempt.findMany({
        where: { userId: learnerId },
        orderBy: { attemptedAt: "desc" },
        select: {
          moduleId: true,
          passed: true,
          scorePct: true,
          attemptedAt: true,
        },
      }),
      prisma.trainingEvidenceSubmission.findMany({
        where: { userId: learnerId },
        orderBy: { createdAt: "desc" },
        select: {
          moduleId: true,
          status: true,
          createdAt: true,
          reviewNotes: true,
        },
      }),
    ]);

  const sortedAssignments = [...assignments].sort((a, b) => a.module.sortOrder - b.module.sortOrder);
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

  const moduleCards = sortedAssignments.map((assignment) => {
    const module = assignment.module;
    const progress = videoByModule.get(module.id);
    const latestQuiz = latestQuizByModule.get(module.id);
    const latestEvidence = latestEvidenceByModule.get(module.id);

    const requiredCheckpointCount = module.checkpoints.length;
    const completedRequiredCheckpoints = module.checkpoints.filter((checkpoint) =>
      completedCheckpointIds.has(checkpoint.id)
    ).length;

    const hasAnyActionablePath =
      Boolean(module.videoUrl) ||
      requiredCheckpointCount > 0 ||
      module.requiresQuiz ||
      module.requiresEvidence;

    let configurationIssue: string | null = null;
    if (module.required && !hasAnyActionablePath) {
      configurationIssue =
        "Module is required but not configured yet. Ask an admin to add video, checkpoints, quiz, or evidence requirements.";
    } else if (module.requiresQuiz && module.quizQuestions.length === 0) {
      configurationIssue = "Quiz is required but no quiz questions are configured for this module.";
    } else if (
      module.required &&
      module.videoUrl &&
      module.videoProvider &&
      !TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(module.videoProvider)
    ) {
      configurationIssue =
        "Required module video provider must be YOUTUBE, VIMEO, or CUSTOM so watch tracking can count.";
    }

    const videoReady =
      !module.videoUrl ||
      progress?.completed === true ||
      (module.videoDuration
        ? (progress?.watchedSeconds ?? 0) >= Math.floor(module.videoDuration * 0.9)
        : false);

    const checkpointsReady =
      requiredCheckpointCount === 0 || completedRequiredCheckpoints >= requiredCheckpointCount;
    const quizReady =
      !module.requiresQuiz || (module.quizQuestions.length > 0 && passedQuizModuleIds.has(module.id));
    const evidenceReady = !module.requiresEvidence || approvedEvidenceModuleIds.has(module.id);

    const fullyComplete =
      !configurationIssue && videoReady && checkpointsReady && quizReady && evidenceReady;

    return {
      module,
      assignment,
      latestQuiz,
      latestEvidence,
      videoReady,
      checkpointsReady,
      quizReady,
      evidenceReady,
      fullyComplete,
      completedRequiredCheckpoints,
      requiredCheckpointCount,
      configurationIssue,
      checkpointLinks: module.checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        title: checkpoint.title,
        completed: completedCheckpointIds.has(checkpoint.id),
      })),
    };
  });

  const completedCount = moduleCards.filter((card) => card.fullyComplete).length;
  const evidencePendingCount = moduleCards.filter(
    (card) => card.module.requiresEvidence && !card.evidenceReady
  ).length;
  const nextModule = moduleCards.find((card) => !card.fullyComplete);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Student Training</p>
          <h1 className="page-title">Training Academy</h1>
          <p className="page-subtitle">
            Complete assigned modules, checkpoints, quizzes, and evidence submissions.
          </p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{completedCount}/{moduleCards.length}</div>
          <div className="kpi-label">Assigned Modules Complete</div>
        </div>
        <div className="card">
          <div className="kpi">{evidencePendingCount}</div>
          <div className="kpi-label">Evidence Pending</div>
        </div>
        <div className="card">
          <div className="kpi">{nextModule ? "Continue" : "Complete"}</div>
          <div className="kpi-label">Next Action</div>
          <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            {nextModule ? `Open ${nextModule.module.title}` : "All assigned modules are complete."}
          </p>
        </div>
      </div>

      {moduleCards.length === 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>No modules assigned yet</h3>
          <p style={{ marginBottom: 0 }}>
            Ask an admin to assign training modules to your account.
          </p>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Assigned Modules</h3>
          <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 14 }}>
            Evidence-required modules are only complete after reviewer approval.
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
                  <span className={`pill ${card.fullyComplete ? "pill-success" : card.configurationIssue ? "pill-declined" : ""}`}>
                    {card.configurationIssue
                      ? "CONFIG ERROR"
                      : card.assignment.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <span className={`pill pill-small ${card.videoReady ? "pill-success" : ""}`}>
                    Video {card.module.videoUrl ? (card.videoReady ? "Done" : "Pending") : "N/A"}
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

                {card.configurationIssue ? (
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#b45309" }}>
                    {card.configurationIssue}
                  </p>
                ) : null}

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

                {card.checkpointLinks.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Checkpoint links</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {card.checkpointLinks.map((checkpoint) => (
                        <Link
                          key={checkpoint.id}
                          href={`/training/${card.module.id}#checkpoint-${checkpoint.id}`}
                          className="link"
                          style={{ fontSize: 12 }}
                        >
                          {checkpoint.completed ? "Done: " : "Open: "}
                          {checkpoint.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/training/${card.module.id}`} className="button small" style={{ textDecoration: "none" }}>
                    Open module
                  </Link>
                  <Link
                    href={`/training/${card.module.id}#section-checkpoints`}
                    className="button small outline"
                    style={{ textDecoration: "none" }}
                  >
                    Open checkpoints
                  </Link>
                  {card.module.requiresQuiz ? (
                    <Link
                      href={`/training/${card.module.id}#section-quiz`}
                      className="button small outline"
                      style={{ textDecoration: "none" }}
                    >
                      Open quiz
                    </Link>
                  ) : null}
                  {card.module.requiresEvidence ? (
                    <Link
                      href={`/training/${card.module.id}#section-evidence`}
                      className="button small outline"
                      style={{ textDecoration: "none" }}
                    >
                      Open evidence
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
