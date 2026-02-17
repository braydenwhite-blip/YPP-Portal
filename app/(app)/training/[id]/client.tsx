"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import FileUpload from "@/components/file-upload";
import {
  setTrainingCheckpointCompletion,
  submitTrainingEvidence,
  submitTrainingQuizAttempt,
  updateVideoProgress,
} from "@/lib/training-actions";
import { VideoProvider } from "@prisma/client";

function renderTextWithLinks(text: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);
  return parts.map((part, index) => {
    if (/^https?:\/\/\S+$/.test(part)) {
      return (
        <a
          key={`url-${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="link"
        >
          {part}
        </a>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

type VideoSegmentData = {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  sortOrder: number;
};

type TrainingVideoData = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  videoProvider: VideoProvider;
  videoDuration: number;
  sortOrder: number;
  isSupplementary: boolean;
  segments: VideoSegmentData[];
};

type TrainingResourceData = {
  id: string;
  title: string;
  description: string | null;
  resourceUrl: string;
  resourceType: string;
  sortOrder: number;
  downloads: number;
};

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
  estimatedMinutes: number | null;
  // v2.0.0 multi-video and resources support
  videos: TrainingVideoData[];
  resources: TrainingResourceData[];
  checkpoints: Array<{
    id: string;
    title: string;
    description: string | null;
    required: boolean;
    sortOrder: number;
    completed: boolean;
    completedAt: string | null;
    notes: string | null;
  }>;
  quizQuestions: Array<{
    id: string;
    question: string;
    correctAnswer: string;
    explanation: string | null;
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
  academyHref,
  academyLabel,
}: {
  module: ModuleData;
  assignment: AssignmentData;
  videoProgress: VideoProgressData;
  quizAttempts: QuizAttemptData[];
  evidenceSubmissions: EvidenceSubmissionData[];
  nextModule: { id: string; title: string } | null;
  academyHref: string;
  academyLabel: string;
}) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(
    module.videos.length > 0 ? module.videos.find((v) => !v.isSupplementary)?.id ?? module.videos[0]?.id ?? null : null
  );
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

  function submitCheckpointCompletion(
    checkpointId: string,
    completed: boolean,
    notes?: string | null
  ) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("checkpointId", checkpointId);
      formData.set("completed", completed ? "true" : "false");
      if (notes && notes.trim().length > 0) {
        formData.set("notes", notes.trim());
      }
      await setTrainingCheckpointCompletion(formData);
      router.refresh();
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
        <Link href={academyHref} className="button small outline" style={{ textDecoration: "none" }}>
          {academyLabel}
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

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Quick Links</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {module.videos.length > 0 ? (
            <a href="#section-videos" className="button small outline" style={{ textDecoration: "none" }}>
              Go to videos ({module.videos.length})
            </a>
          ) : module.videoUrl ? (
            <a href="#section-video" className="button small outline" style={{ textDecoration: "none" }}>
              Go to video
            </a>
          ) : null}
          {module.resources.length > 0 ? (
            <a href="#section-resources" className="button small outline" style={{ textDecoration: "none" }}>
              Go to resources ({module.resources.length})
            </a>
          ) : null}
          <a href="#section-checkpoints" className="button small outline" style={{ textDecoration: "none" }}>
            Go to checkpoints
          </a>
          {module.requiresQuiz ? (
            <a href="#section-quiz" className="button small outline" style={{ textDecoration: "none" }}>
              Go to quiz
            </a>
          ) : null}
          {module.requiresEvidence ? (
            <a href="#section-evidence" className="button small outline" style={{ textDecoration: "none" }}>
              Go to evidence
            </a>
          ) : null}
        </div>
      </div>

      {/* Multi-video section (v2.0.0) */}
      {module.videos.length > 0 ? (
        <div id="section-videos" className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Training Videos</h3>
            {module.estimatedMinutes ? (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                ~{module.estimatedMinutes} min total
              </span>
            ) : null}
          </div>

          {/* Video selector tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {module.videos.map((video) => (
              <button
                key={video.id}
                type="button"
                className={`button small ${activeVideoId === video.id ? "" : "outline"}`}
                onClick={() => setActiveVideoId(video.id)}
                style={{ fontSize: 12 }}
              >
                {video.isSupplementary ? "★ " : ""}{video.title}
                {video.videoDuration ? ` (${Math.round(video.videoDuration / 60)}m)` : ""}
              </button>
            ))}
          </div>

          {/* Active video player */}
          {module.videos.map((video) => (
            <div key={video.id} style={{ display: activeVideoId === video.id ? "block" : "none" }}>
              <VideoPlayer
                videoUrl={video.videoUrl}
                provider={video.videoProvider}
                duration={video.videoDuration}
                moduleId={module.id}
                initialProgress={!video.isSupplementary ? (videoProgress ?? undefined) : undefined}
                onProgress={!video.isSupplementary ? saveVideoProgress : undefined}
              />
              {video.description ? (
                <p style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>{video.description}</p>
              ) : null}
              {/* Video segments for navigation */}
              {video.segments.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                    Segments ({video.segments.length})
                  </p>
                  <div style={{ display: "grid", gap: 4 }}>
                    {video.segments.map((segment) => (
                      <div
                        key={segment.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "6px 8px",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          fontSize: 13,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "var(--muted)", minWidth: 60, fontVariantNumeric: "tabular-nums" }}>
                          {Math.floor(segment.startTime / 60)}:{String(segment.startTime % 60).padStart(2, "0")}
                        </span>
                        <span>{segment.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {!videoProgress?.completed && module.videos.some((v) => !v.isSupplementary) ? (
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
              Watch the primary training video to fulfill the video requirement (90% completion or marked complete).
            </p>
          ) : null}
        </div>
      ) : module.videoUrl && module.videoProvider ? (
        /* Legacy single-video (v1.0.0 content) */
        <div id="section-video" className="card" style={{ marginBottom: 18 }}>
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

      {/* Resources section */}
      {module.resources.length > 0 ? (
        <div id="section-resources" className="card" style={{ marginBottom: 18 }}>
          <h3>Resources & Templates</h3>
          <p style={{ marginTop: 0, fontSize: 13, color: "var(--muted)" }}>
            Download templates and reference materials to support this module.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {module.resources.map((resource) => (
              <div
                key={resource.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{resource.title}</p>
                  {resource.description ? (
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      {resource.description}
                    </p>
                  ) : null}
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      fontSize: 11,
                      padding: "2px 6px",
                      background: "var(--muted-bg, #f1f5f9)",
                      borderRadius: 4,
                      color: "var(--muted)",
                    }}
                  >
                    {resource.resourceType}
                  </span>
                </div>
                <a
                  href={resource.resourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button small outline"
                  style={{ textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div id="section-checkpoints" className="card" style={{ marginBottom: 18 }}>
        <h3>Checkpoints</h3>
        {module.checkpoints.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No checkpoints required for this module.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {module.checkpoints.map((checkpoint) => (
              <details
                key={checkpoint.id}
                id={`checkpoint-${checkpoint.id}`}
                open={!checkpoint.completed && checkpoint.required}
                style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}
              >
                <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{checkpoint.title}</span>
                  <span className={`pill pill-small ${checkpoint.completed ? "pill-success" : ""}`}>
                    {checkpoint.completed ? "Completed" : checkpoint.required ? "Required" : "Optional"}
                  </span>
                </summary>

                <div style={{ marginTop: 10 }}>
                  {checkpoint.description ? (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                      {renderTextWithLinks(checkpoint.description)}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      No extra instructions for this checkpoint.
                    </p>
                  )}

                  <form
                    action={async (formData: FormData) => {
                      const notes = String(formData.get("notes") ?? "");
                      submitCheckpointCompletion(checkpoint.id, true, notes);
                    }}
                    className="form-grid"
                    style={{ marginTop: 10 }}
                  >
                    <label className="form-row">
                      Notes (optional)
                      <textarea
                        className="input"
                        name="notes"
                        rows={2}
                        defaultValue={checkpoint.notes ?? ""}
                        placeholder="Add checkpoint evidence or notes"
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="submit" className="button small">
                        {checkpoint.completed ? "Save notes" : "Mark checkpoint complete"}
                      </button>
                      {checkpoint.completed ? (
                        <button
                          type="button"
                          className="button small outline"
                          onClick={() => submitCheckpointCompletion(checkpoint.id, false)}
                        >
                          Mark checkpoint incomplete
                        </button>
                      ) : null}
                    </div>
                  </form>

                  {checkpoint.completedAt ? (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Completed on {new Date(checkpoint.completedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {module.requiresQuiz ? (
        <div id="section-quiz" className="card" style={{ marginBottom: 18 }}>
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
                  {question.explanation ? (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Why this matters: {question.explanation}
                    </p>
                  ) : null}
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
        <div id="section-evidence" className="card" style={{ marginBottom: 18 }}>
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
