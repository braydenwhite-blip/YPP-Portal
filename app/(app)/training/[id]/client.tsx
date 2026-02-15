"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import FileUpload from "@/components/file-upload";
import {
  submitTrainingCheckpoint,
  submitTrainingEvidence,
  submitTrainingQuizAttempt,
  updateVideoProgress,
} from "@/lib/training-actions";
import { VideoProvider } from "@prisma/client";

type ModuleData = {
  id: string;
  title: string;
  description: string;
  type: string;
  required: boolean;
  videoUrl: string | null;
  videoProvider: VideoProvider | null;
  videoDuration: number | null;
  videoThumbnail: string | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  passScorePct: number;
  checkpoints: Array<{
    id: string;
    title: string;
    description: string | null;
    required: boolean;
    sortOrder: number;
    completed: boolean;
  }>;
  quizQuestions: Array<{
    id: string;
    question: string;
    correctAnswer: string;
    sortOrder: number;
    options: string[];
  }>;
};

type AssignmentData = {
  status: string;
  completedAt: string | null;
} | null;

type VideoProgressData = {
  watchedSeconds: number;
  lastPosition: number;
  completed: boolean;
} | null;

type QuizAttemptData = {
  id: string;
  scorePct: number;
  passed: boolean;
  attemptedAt: string;
};

type EvidenceSubmissionData = {
  id: string;
  status: string;
  fileUrl: string;
  notes: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

export default function TrainingModuleClient({
  module,
  assignment,
  videoProgress,
  quizAttempts,
  evidenceSubmissions,
  nextModule,
}: {
  module: ModuleData;
  assignment: AssignmentData;
  videoProgress: VideoProgressData;
  quizAttempts: QuizAttemptData[];
  evidenceSubmissions: EvidenceSubmissionData[];
  nextModule: { id: string; title: string } | null;
}) {
  const router = useRouter();
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const completedRequiredCheckpoints = useMemo(
    () => module.checkpoints.filter((checkpoint) => checkpoint.required && checkpoint.completed).length,
    [module.checkpoints]
  );
  const requiredCheckpointCount = useMemo(
    () => module.checkpoints.filter((checkpoint) => checkpoint.required).length,
    [module.checkpoints]
  );

  const hasPassedQuiz = quizAttempts.some((attempt) => attempt.passed);
  const hasApprovedEvidence = evidenceSubmissions.some(
    (submission) => submission.status === "APPROVED"
  );

  const videoReady =
    !module.videoUrl ||
    videoProgress?.completed === true ||
    (module.videoDuration
      ? (videoProgress?.watchedSeconds ?? 0) >= Math.floor(module.videoDuration * 0.9)
      : false);
  const checkpointsReady =
    requiredCheckpointCount === 0 || completedRequiredCheckpoints >= requiredCheckpointCount;
  const quizReady = !module.requiresQuiz || hasPassedQuiz;
  const evidenceReady = !module.requiresEvidence || hasApprovedEvidence;
  const moduleReady = videoReady && checkpointsReady && quizReady && evidenceReady;

  function setQuizAnswer(questionId: string, answer: string) {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  function submitQuiz() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("moduleId", module.id);
        formData.set("answers", JSON.stringify(quizAnswers));
        const result = await submitTrainingQuizAttempt(formData);

        setQuizFeedback(
          result.passed
            ? `Passed with ${result.scorePct}% (required: ${result.passScorePct}%).`
            : `Scored ${result.scorePct}%. Required score is ${result.passScorePct}%.`
        );

        router.refresh();
      } catch (error) {
        setQuizFeedback(error instanceof Error ? error.message : "Quiz submission failed.");
      }
    });
  }

  function saveVideoProgress(watchedSeconds: number, lastPosition: number, completed: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("moduleId", module.id);
      formData.set("watchedSeconds", String(Math.floor(watchedSeconds)));
      formData.set("lastPosition", String(Math.floor(lastPosition)));
      formData.set("completed", completed ? "true" : "false");
      await updateVideoProgress(formData);
    });
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Training Module</p>
          <h1 className="page-title">{module.title}</h1>
          <p className="page-subtitle">{module.description}</p>
        </div>
        <Link href="/instructor-training" className="button small outline" style={{ textDecoration: "none" }}>
          Back to academy
        </Link>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{assignment?.status?.replace(/_/g, " ") ?? "NOT STARTED"}</div>
          <div className="kpi-label">Assignment Status</div>
        </div>
        <div className="card">
          <div className="kpi">{videoReady ? "Done" : "Pending"}</div>
          <div className="kpi-label">Video</div>
        </div>
        <div className="card">
          <div className="kpi">{checkpointsReady ? "Done" : `${completedRequiredCheckpoints}/${requiredCheckpointCount}`}</div>
          <div className="kpi-label">Checkpoints</div>
        </div>
        <div className="card">
          <div className="kpi">{moduleReady ? "Ready" : "In Progress"}</div>
          <div className="kpi-label">Completion State</div>
        </div>
      </div>

      {module.videoUrl && module.videoProvider ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Training Video</h3>
          <VideoPlayer
            videoUrl={module.videoUrl}
            provider={module.videoProvider}
            duration={module.videoDuration ?? undefined}
            thumbnail={module.videoThumbnail ?? undefined}
            moduleId={module.id}
            initialProgress={videoProgress ?? undefined}
            onProgress={saveVideoProgress}
          />
          <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
            Video requirement: watch at least 90% or mark complete.
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Checkpoints</h3>
        {module.checkpoints.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No checkpoints required for this module.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {module.checkpoints.map((checkpoint) => (
              <div key={checkpoint.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{checkpoint.title}</p>
                    {checkpoint.description ? (
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                        {checkpoint.description}
                      </p>
                    ) : null}
                  </div>
                  <span className={`pill pill-small ${checkpoint.completed ? "pill-success" : ""}`}>
                    {checkpoint.completed ? "Completed" : checkpoint.required ? "Required" : "Optional"}
                  </span>
                </div>

                {!checkpoint.completed ? (
                  <form
                    action={async (_formData: FormData) => {
                      const formData = new FormData();
                      formData.set("checkpointId", checkpoint.id);
                      await submitTrainingCheckpoint(formData);
                      router.refresh();
                    }}
                    style={{ marginTop: 10 }}
                  >
                    <button type="submit" className="button small">Mark checkpoint complete</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {module.requiresQuiz ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Module Quiz</h3>
          <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13 }}>
            Pass score required: {module.passScorePct}%
          </p>
          {module.quizQuestions.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              Quiz required, but no questions are configured yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {module.quizQuestions.map((question, index) => (
                <div key={question.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{index + 1}. {question.question}</p>
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {question.options.map((option, optionIndex) => {
                      const optionId = `${question.id}-${optionIndex}`;
                      return (
                        <label key={optionId} htmlFor={optionId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            id={optionId}
                            type="radio"
                            name={`q-${question.id}`}
                            value={option}
                            checked={quizAnswers[question.id] === option}
                            onChange={() => setQuizAnswer(question.id, option)}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="button small" onClick={submitQuiz} disabled={isPending}>
                  {isPending ? "Submitting..." : "Submit quiz"}
                </button>
                {hasPassedQuiz ? <span className="pill pill-small pill-success">Passed</span> : null}
              </div>

              {quizFeedback ? (
                <p style={{ marginTop: 0, fontSize: 13 }}>{quizFeedback}</p>
              ) : null}
            </div>
          )}

          {quizAttempts.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>Recent attempts</p>
              <div style={{ display: "grid", gap: 6 }}>
                {quizAttempts.map((attempt) => (
                  <p key={attempt.id} style={{ margin: 0, fontSize: 13 }}>
                    {new Date(attempt.attemptedAt).toLocaleString()} - {attempt.scorePct}% {attempt.passed ? "(Pass)" : "(Not passed)"}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {module.requiresEvidence ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Evidence Submission</h3>
          <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13 }}>
            Upload required evidence for reviewer approval.
          </p>

          <form action={submitTrainingEvidence} className="form-grid">
            <input type="hidden" name="moduleId" value={module.id} />
            <label className="form-row">
              Evidence file
              <FileUpload
                category="TRAINING_EVIDENCE"
                entityType="training_module"
                entityId={module.id}
                maxSizeMB={10}
                label="Upload evidence"
              />
            </label>
            <label className="form-row">
              Notes (optional)
              <textarea name="notes" className="input" rows={2} />
            </label>
            <button type="submit" className="button small">Submit evidence</button>
          </form>

          {evidenceSubmissions.length > 0 ? (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {evidenceSubmissions.map((submission) => (
                <div key={submission.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {submission.status.replace(/_/g, " ")} - {new Date(submission.createdAt).toLocaleString()}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                    <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="link">
                      Open submitted file
                    </a>
                  </p>
                  {submission.reviewNotes ? (
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      Reviewer note: {submission.reviewNotes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <h3>Next Module</h3>
        {nextModule ? (
          <p style={{ marginBottom: 0 }}>
            Continue to <strong>{nextModule.title}</strong> after finishing this module. {" "}
            <Link href={`/training/${nextModule.id}`} className="link">Open next module</Link>
          </p>
        ) : (
          <p style={{ marginBottom: 0, color: "var(--muted)" }}>
            This is the final module in the sequence.
          </p>
        )}
      </div>
    </div>
  );
}
