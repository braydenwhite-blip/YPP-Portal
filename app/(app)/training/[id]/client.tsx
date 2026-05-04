"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { getCurriculumDraftProgress } from "@/lib/curriculum-draft-progress";
import { deriveStudioPhase, STUDIO_PHASES } from "@/lib/lesson-design-studio";
import {
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
    sortOrder: number;
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

type LessonDesignStudioData = {
  userId: string;
  userName: string;
  draft: {
    id: string;
    title: string;
    description: string;
    interestArea: string;
    outcomes: string[];
    courseConfig: unknown;
    weeklyPlans: unknown[];
    understandingChecks: unknown;
    reviewRubric: unknown;
    reviewNotes: string;
    reviewedAt: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
    generatedTemplateId: string | null;
    status: string;
    updatedAt: string;
  };
} | null;

export default function TrainingModuleClient({
  module,
  assignment,
  videoProgress,
  quizAttempts,
  evidenceSubmissions,
  nextModule,
  academyHref,
  academyLabel,
  lessonDesignStudio,
}: {
  module: ModuleData;
  assignment: AssignmentData;
  videoProgress: VideoProgressData;
  quizAttempts: QuizAttemptData[];
  evidenceSubmissions: EvidenceSubmissionData[];
  nextModule: { id: string; title: string } | null;
  academyHref: string;
  academyLabel: string;
  lessonDesignStudio: LessonDesignStudioData;
}) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(
    module.videos.length > 0 ? module.videos.find((v) => !v.isSupplementary)?.id ?? module.videos[0]?.id ?? null : null
  );
  const router = useRouter();
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<Record<
    string,
    { correctAnswer: string; userAnswer: string | null; correct: boolean }
  > | null>(null);
  const [quizPassed, setQuizPassed] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const allQuizAnswered =
    module.quizQuestions.length > 0 &&
    module.quizQuestions.every((q) => Boolean(quizAnswers[q.id]));

  const hasPassedQuiz = quizAttempts.some((attempt) => attempt.passed);

  // Video completes when the player fires the "ended" event — no 90% threshold.
  const videoReady = !module.videoUrl || videoProgress?.completed === true;
  const quizReady = !module.requiresQuiz || hasPassedQuiz;
  const moduleReady = videoReady && quizReady;

  // Progress bar percentage: use actual watch progress for visual feedback.
  const primaryVideoDuration =
    module.videos.find((v) => !v.isSupplementary)?.videoDuration ?? module.videoDuration ?? null;
  const videoProgressPct = moduleReady
    ? 100
    : primaryVideoDuration && primaryVideoDuration > 0
      ? Math.min(99, Math.round(((videoProgress?.watchedSeconds ?? 0) / primaryVideoDuration) * 100))
      : (videoProgress?.watchedSeconds ?? 0) > 0
        ? 30
        : 0;
  const studioProgress = useMemo(
    () =>
      lessonDesignStudio
        ? getCurriculumDraftProgress({
            title: lessonDesignStudio.draft.title,
            interestArea: lessonDesignStudio.draft.interestArea,
            outcomes: lessonDesignStudio.draft.outcomes,
            courseConfig: lessonDesignStudio.draft.courseConfig,
            weeklyPlans: lessonDesignStudio.draft.weeklyPlans,
            understandingChecks: lessonDesignStudio.draft.understandingChecks,
          })
        : null,
    [lessonDesignStudio]
  );
  const studioPhase = useMemo(
    () =>
      lessonDesignStudio && studioProgress
        ? deriveStudioPhase({
            status: lessonDesignStudio.draft.status,
            title: lessonDesignStudio.draft.title,
            interestArea: lessonDesignStudio.draft.interestArea,
            outcomes: lessonDesignStudio.draft.outcomes,
            courseConfig: lessonDesignStudio.draft.courseConfig,
            weeklyPlans: lessonDesignStudio.draft.weeklyPlans,
            understandingChecks: lessonDesignStudio.draft.understandingChecks,
            progress: studioProgress,
          })
        : null,
    [lessonDesignStudio, studioProgress]
  );
  const studioPhaseLabel = studioPhase
    ? STUDIO_PHASES.find((phase) => phase.id === studioPhase)?.label ?? "Studio"
    : null;

  function setQuizAnswer(questionId: string, answer: string) {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (quizResults) {
      setQuizResults(null);
      setQuizFeedback(null);
      setQuizPassed(null);
    }
  }

  function retakeQuiz() {
    setQuizAnswers({});
    setQuizResults(null);
    setQuizFeedback(null);
    setQuizPassed(null);
  }

  function submitQuiz() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("moduleId", module.id);
        formData.set("answers", JSON.stringify(quizAnswers));
        const result = await submitTrainingQuizAttempt(formData);

        const resultsByQuestion: Record<
          string,
          { correctAnswer: string; userAnswer: string | null; correct: boolean }
        > = {};
        for (const r of result.results) {
          resultsByQuestion[r.questionId] = {
            correctAnswer: r.correctAnswer,
            userAnswer: r.userAnswer,
            correct: r.correct,
          };
        }
        setQuizResults(resultsByQuestion);
        setQuizPassed(result.passed);

        setQuizFeedback(
          result.passed
            ? `Passed with ${result.scorePct}% (required: ${result.passScorePct}%).`
            : `Scored ${result.scorePct}%. Required score is ${result.passScorePct}%.`
        );

        router.refresh();
      } catch (error) {
        setQuizResults(null);
        setQuizPassed(null);
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
      if (completed) {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <p className="badge">Training Module</p>
          <h1 className="page-title">{module.title}</h1>
          <p className="page-subtitle">{module.description}</p>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, maxWidth: 320, height: 6, background: "var(--border)", borderRadius: 3 }}>
              <div
                style={{
                  height: "100%",
                  width: `${videoProgressPct}%`,
                  background: moduleReady ? "#16a34a" : "#6366f1",
                  borderRadius: 3,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span className={`pill pill-small ${moduleReady ? "pill-success" : ""}`}>
              {moduleReady
                ? "Complete"
                : assignment?.status === "IN_PROGRESS"
                  ? "In Progress"
                  : "Not Started"}
            </span>
          </div>
        </div>
        <Link href={academyHref} className="button small outline" style={{ textDecoration: "none", alignSelf: "start" }}>
          {academyLabel}
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Quick Links</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {module.checkpoints.length > 0 ? (
            <a href="#section-goals" className="button small outline" style={{ textDecoration: "none" }}>
              Module Goals
            </a>
          ) : null}
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
          {lessonDesignStudio ? (
            <Link
              href="/instructor/lesson-design-studio?entry=training"
              className="button small outline"
              style={{ textDecoration: "none" }}
            >
              Continue your studio journey
            </Link>
          ) : null}
          {module.requiresQuiz ? (
            <a href="#section-quiz" className="button small outline" style={{ textDecoration: "none" }}>
              Go to quiz
            </a>
          ) : null}
        </div>
      </div>

      {lessonDesignStudio && studioProgress ? (
        <div
          className="card"
          style={{
            marginBottom: 18,
            border: "1px solid #c4b5fd",
            background: "linear-gradient(180deg, #faf5ff 0%, #fff 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
            <div>
              <p className="badge" style={{ background: "#f0e6ff", color: "#5a1da8" }}>
                Capstone Studio
              </p>
              <h3 style={{ margin: "6px 0 6px" }}>Lesson Design Studio readiness</h3>
              <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 13, maxWidth: 680 }}>
                This module is now a checkpoint, not the authoring surface itself. Open the canonical Lesson Design Studio when you are ready to keep building, review blockers, and move toward submission.
              </p>
            </div>
            <Link
              href="/instructor/lesson-design-studio?entry=training"
              className="button small outline"
              style={{ textDecoration: "none" }}
            >
              Continue your studio journey
            </Link>
          </div>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <div className="card" style={{ background: "white", margin: 0 }}>
              <div className="kpi-label">Current phase</div>
              <div className="kpi" style={{ fontSize: 18 }}>
                {studioPhaseLabel ?? "Lesson Design Studio"}
              </div>
            </div>
            <div className="card" style={{ background: "white", margin: 0 }}>
              <div className="kpi-label">Readiness</div>
              <div className="kpi" style={{ fontSize: 18 }}>
                {studioProgress.readyForSubmission ? "Ready to submit" : "Still building"}
              </div>
            </div>
            <div className="card" style={{ background: "white", margin: 0 }}>
              <div className="kpi-label">Fully built sessions</div>
              <div className="kpi" style={{ fontSize: 18 }}>
                {studioProgress.fullyBuiltSessions}/{studioProgress.totalSessionsExpected}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Blockers</p>
            {studioProgress.submissionIssues.length > 0 ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
                {studioProgress.submissionIssues.slice(0, 3).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: "8px 0 0", color: "#166534", fontSize: 13, fontWeight: 600 }}>
                No blockers are left. Open the studio to submit and move into review.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Module Goals — read-only list displayed above the video */}
      {module.checkpoints.length > 0 ? (
        <div id="section-goals" className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 4 }}>Module Goals</h3>
          <p style={{ marginTop: 0, marginBottom: 12, color: "var(--muted)", fontSize: 13 }}>
            In this module, you will:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
            {module.checkpoints.map((checkpoint) => (
              <li key={checkpoint.id} style={{ fontSize: 14, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 500 }}>{checkpoint.title}</span>
                {checkpoint.description ? (
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                    {" — "}
                    {renderTextWithLinks(checkpoint.description)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
              {module.quizQuestions.map((question, index) => {
                const result = quizResults?.[question.id] ?? null;
                const showFeedback = result !== null;
                return (
                  <div
                    key={question.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                      borderColor: showFeedback
                        ? result.correct
                          ? "#16a34a"
                          : "#dc2626"
                        : "var(--border)",
                      background: showFeedback
                        ? result.correct
                          ? "#f0fdf4"
                          : "#fef2f2"
                        : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{index + 1}. {question.question}</p>
                      {showFeedback ? (
                        <span
                          className={`pill pill-small ${result.correct ? "pill-success" : ""}`}
                          style={{
                            flexShrink: 0,
                            background: result.correct ? undefined : "#fecaca",
                            color: result.correct ? undefined : "#991b1b",
                          }}
                        >
                          {result.correct ? "Correct" : "Incorrect"}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {question.options.map((option, optionIndex) => {
                        const optionId = `${question.id}-${optionIndex}`;
                        const isCorrectOption = showFeedback && option === result.correctAnswer;
                        const isUserChoice = showFeedback && option === result.userAnswer;
                        return (
                          <label
                            key={optionId}
                            htmlFor={optionId}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              padding: "4px 6px",
                              borderRadius: 6,
                              background: isCorrectOption
                                ? "#dcfce7"
                                : isUserChoice && !result.correct
                                  ? "#fee2e2"
                                  : "transparent",
                            }}
                          >
                            <input
                              id={optionId}
                              type="radio"
                              name={`q-${question.id}`}
                              value={option}
                              checked={quizAnswers[question.id] === option}
                              onChange={() => setQuizAnswer(question.id, option)}
                              disabled={showFeedback}
                            />
                            <span>{option}</span>
                            {isCorrectOption ? (
                              <span style={{ marginLeft: "auto", fontSize: 12, color: "#166534", fontWeight: 600 }}>
                                Correct answer
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                    {showFeedback && question.explanation ? (
                      <p
                        style={{
                          margin: "10px 0 0",
                          fontSize: 13,
                          color: "var(--muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        <strong style={{ color: "var(--text-primary, #111)" }}>Why:</strong>{" "}
                        {question.explanation}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {quizResults ? (
                  <button
                    type="button"
                    className="button small"
                    onClick={retakeQuiz}
                    disabled={isPending}
                  >
                    {quizPassed ? "Retake quiz" : "Try again"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button small"
                    onClick={submitQuiz}
                    disabled={isPending || !allQuizAnswered}
                    title={!allQuizAnswered ? "Answer every question to submit." : undefined}
                  >
                    {isPending ? "Submitting..." : "Submit quiz"}
                  </button>
                )}
                {!quizResults && !allQuizAnswered ? (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {module.quizQuestions.length - Object.keys(quizAnswers).length} question
                    {module.quizQuestions.length - Object.keys(quizAnswers).length === 1 ? "" : "s"} remaining
                  </span>
                ) : null}
                {hasPassedQuiz ? <span className="pill pill-small pill-success">Passed</span> : null}
              </div>

              {quizFeedback ? (
                <p
                  style={{
                    marginTop: 0,
                    fontSize: 13,
                    fontWeight: quizPassed === false ? 600 : 400,
                    color: quizPassed === false ? "#991b1b" : quizPassed ? "#166534" : undefined,
                  }}
                >
                  {quizFeedback}
                </p>
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

      {/* Lesson Design Studio capstone: show current draft status */}
      {lessonDesignStudio ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 6 }}>Your Studio Draft</h3>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {lessonDesignStudio.draft.title || "Untitled curriculum"}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                {lessonDesignStudio.draft.status.replace(/_/g, " ")}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Last updated {new Date(lessonDesignStudio.draft.updatedAt).toLocaleString()}
              </p>
            </div>
            <Link
              href="/instructor/lesson-design-studio?entry=training"
              className="button small outline"
              style={{ textDecoration: "none" }}
            >
              Jump to Studio
            </Link>
          </div>
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
