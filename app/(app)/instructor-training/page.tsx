import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  cancelInterviewAvailabilityRequest,
  confirmPostedInterviewSlot,
} from "@/lib/instructor-interview-actions";
import {
  buildFallbackInstructorReadiness,
  getInstructorReadiness,
} from "@/lib/instructor-readiness";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  getTrainingAccessRedirect,
  hasApprovedInstructorTrainingAccess,
} from "@/lib/training-access";
import {
  LESSON_DESIGN_STUDIO_MODULE_KEY,
  READINESS_CHECK_MODULE_KEY,
  TRACKABLE_REQUIRED_VIDEO_PROVIDERS,
} from "@/lib/training-constants";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

type ModuleCard = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  module: any;
  assignment: { status: string } | undefined;
  latestQuiz: { scorePct: number; attemptedAt: Date } | undefined;
  /** Interactive-journey progress: beats answered correctly / total scored beats. */
  journeyProgress: {
    isInteractive: boolean;
    correctBeats: number;
    totalBeats: number;
    scorePct: number | null;
    passed: boolean;
  };
  videoReady: boolean;
  quizReady: boolean;
  fullyComplete: boolean;
  /** Unified completion percentage for the card progress bar (journey-aware). */
  progressPct: number;
  configurationIssue: string | null;
  estimatedMinutes: number | null;
};

function KanbanCard({
  card,
  readinessCheckPassed,
  readinessCheckModuleId,
}: {
  card: ModuleCard;
  readinessCheckPassed: boolean;
  readinessCheckModuleId: string | null;
}) {
  const isLDS = card.module.contentKey === LESSON_DESIGN_STUDIO_MODULE_KEY;
  const ldsLocked = isLDS && !readinessCheckPassed;
  const isJourney = card.journeyProgress.isInteractive;
  const cta = ldsLocked
    ? null
    : isLDS
      ? { label: "Open Studio", href: "/instructor/lesson-design-studio?entry=training" }
      : card.fullyComplete
        ? { label: "Review", href: `/training/${card.module.id}` }
        : card.assignment?.status === "IN_PROGRESS"
          ? { label: "Continue", href: `/training/${card.module.id}` }
          : { label: "Start module", href: `/training/${card.module.id}` };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        background: card.fullyComplete ? "#f0fdf4" : "var(--surface)",
        opacity: ldsLocked ? 0.6 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{card.module.title}</p>
        {card.estimatedMinutes ? (
          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
            {card.estimatedMinutes} min
          </span>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
        {card.module.description}
      </p>

      {/* Progress bar — only for trackable modules (journeys + legacy videos) */}
      {!isLDS ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <div
            style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2 }}
            role="progressbar"
            aria-valuenow={card.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${card.module.title} progress`}
          >
            <div
              style={{
                height: "100%",
                width: `${card.progressPct}%`,
                background: card.fullyComplete ? "#16a34a" : "#6366f1",
                borderRadius: 2,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 36, textAlign: "right" }}>
            {isJourney
              ? `${card.journeyProgress.correctBeats}/${card.journeyProgress.totalBeats}`
              : `${card.progressPct}%`}
          </span>
        </div>
      ) : null}

      {/* Status pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ldsLocked ? (
          <span className="pill pill-small">Complete Readiness Check to unlock</span>
        ) : null}
        {card.fullyComplete ? (
          <span className="pill pill-small pill-success">Complete</span>
        ) : isJourney && card.journeyProgress.scorePct !== null ? (
          <span
            className={`pill pill-small ${card.journeyProgress.passed ? "pill-success" : ""}`}
            title={card.journeyProgress.passed ? "Journey passed" : "Below pass score — retake to complete"}
          >
            Score {card.journeyProgress.scorePct}%
          </span>
        ) : null}
        {card.module.requiresQuiz ? (
          <span className={`pill pill-small ${card.quizReady ? "pill-success" : ""}`}>
            Quiz {card.quizReady ? "Passed" : "Required"}
          </span>
        ) : null}
      </div>

      {card.configurationIssue ? (
        <p style={{ margin: 0, fontSize: 11, color: "#b45309" }} role="status">
          {card.configurationIssue}
        </p>
      ) : null}

      {/* Quiz retake hint when the user attempted but didn't pass */}
      {card.latestQuiz && !card.quizReady ? (
        <p style={{ margin: 0, fontSize: 11, color: "#b45309" }}>
          Last quiz: {card.latestQuiz.scorePct}% · {formatDateTime(card.latestQuiz.attemptedAt)}
          {" — retake to pass."}
        </p>
      ) : card.latestQuiz ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
          Quiz: {card.latestQuiz.scorePct}% · {formatDateTime(card.latestQuiz.attemptedAt)}
        </p>
      ) : null}

      {/* CTA */}
      {ldsLocked ? (
        readinessCheckModuleId ? (
          <Link
            href={`/training/${readinessCheckModuleId}`}
            className="button small"
            style={{ textDecoration: "none", fontSize: 12 }}
          >
            Open Readiness Check
          </Link>
        ) : (
          <button
            type="button"
            className="button small"
            disabled
            aria-disabled="true"
            style={{ fontSize: 12, cursor: "not-allowed" }}
            title="Complete the Readiness Check to unlock the Lesson Design Studio."
          >
            Locked
          </button>
        )
      ) : cta ? (
        <Link
          href={cta.href}
          className="button small"
          style={{ textDecoration: "none", fontSize: 12 }}
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

export default async function InstructorTrainingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const sp = (await searchParams) ?? {};
  const lockedParamRaw = sp.locked;
  const lockedParam = Array.isArray(lockedParamRaw) ? lockedParamRaw[0] : lockedParamRaw;
  const showLdsLockedBanner = lockedParam === "lesson-design-studio";

  const roles = session.user.roles ?? [];
  const canAccessTraining = hasApprovedInstructorTrainingAccess(roles);

  if (!canAccessTraining) {
    redirect(getTrainingAccessRedirect(roles));
  }

  const isReviewer = roles.includes("ADMIN") || roles.includes("CHAPTER_PRESIDENT");
  const reviewerHref = roles.includes("ADMIN")
    ? "/admin/instructor-readiness"
    : "/chapter-lead/instructor-readiness";

  const instructorId = session.user.id;
  const loadInterviewGate = () =>
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
    });

  type InterviewGateWithDetails = Awaited<ReturnType<typeof loadInterviewGate>>;

  const fallbackInterviewGate: InterviewGateWithDetails = {
    id: "fallback-interview-gate",
    instructorId,
    status: "REQUIRED",
    outcome: null,
    scheduledAt: null,
    completedAt: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    slots: [],
    availabilityRequests: [],
  };

  // Look up the instructor's subtype (summer workshop vs standard) so we can
  // route them to the lighter onboarding when applicable.
  // Best-effort: if the application can't be loaded, fall back to STANDARD.
  const instructorSubtype = await withPrismaFallback(
    "instructor-training:subtype",
    async () => {
      const app = await prisma.instructorApplication.findUnique({
        where: { applicantId: instructorId },
        select: { instructorSubtype: true },
      });
      return app?.instructorSubtype ?? "STANDARD";
    },
    "STANDARD" as const
  );
  const isSummerWorkshopInstructor = instructorSubtype === "SUMMER_WORKSHOP";

  const [
    modules,
    assignments,
    videoProgress,
    quizAttempts,
    journeyCompletions,
    journeyBeatAttempts,
    interviewGate,
    readiness,
    trainingCertificate,
  ] = await Promise.all([
    withPrismaFallback(
      "instructor-training:modules",
      () =>
        prisma.trainingModule.findMany({
          orderBy: { sortOrder: "asc" },
          include: {
            quizQuestions: {
              select: { id: true },
            },
            interactiveJourney: {
              select: {
                id: true,
                estimatedMinutes: true,
                beats: {
                  where: { removedAt: null, scoringWeight: { gt: 0 } },
                  select: { id: true },
                },
              },
            },
          },
        }),
      []
    ),
    withPrismaFallback(
      "instructor-training:assignments",
      () =>
        prisma.trainingAssignment.findMany({
          where: { userId: instructorId },
        }),
      []
    ),
    withPrismaFallback(
      "instructor-training:video-progress",
      () =>
        prisma.videoProgress.findMany({
          where: { userId: instructorId },
          select: {
            moduleId: true,
            watchedSeconds: true,
            completed: true,
          },
        }),
      []
    ),
    withPrismaFallback(
      "instructor-training:quiz-attempts",
      () =>
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
      []
    ),
    withPrismaFallback(
      "instructor-training:journey-completions",
      () =>
        prisma.interactiveJourneyCompletion.findMany({
          where: { userId: instructorId },
          select: {
            journeyId: true,
            scorePct: true,
            passed: true,
            firstTryCorrectCount: true,
            visitedBeatCount: true,
          },
        }),
      []
    ),
    withPrismaFallback(
      "instructor-training:journey-beat-attempts",
      () =>
        prisma.interactiveBeatAttempt.findMany({
          where: { userId: instructorId },
          select: {
            beatId: true,
            correct: true,
            attemptNumber: true,
            beat: {
              select: { journeyId: true, scoringWeight: true },
            },
          },
        }),
      []
    ),
    withPrismaFallback(
      "instructor-training:interview-gate",
      () => loadInterviewGate(),
      fallbackInterviewGate
    ),
    withPrismaFallback(
      "instructor-training:readiness",
      () => getInstructorReadiness(instructorId),
      buildFallbackInstructorReadiness(instructorId)
    ),
    withPrismaFallback(
      "instructor-training:certificate",
      () =>
        prisma.certificate.findFirst({
          where: {
            recipientId: instructorId,
            template: { type: "TRAINING_COMPLETION" },
          },
          select: {
            id: true,
            certificateNumber: true,
            issuedAt: true,
          },
        }),
      null
    ),
  ]);

  const assignmentByModule = new Map(assignments.map((assignment) => [assignment.moduleId, assignment]));
  const videoByModule = new Map(videoProgress.map((progress) => [progress.moduleId, progress]));

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

  // Journey progress lookups: keep only the latest correct attempt per beat,
  // then group by journeyId so we can show "X of Y beats correct" on the card.
  const journeyCompletionByJourneyId = new Map(
    journeyCompletions.map((completion) => [completion.journeyId, completion])
  );
  const correctBeatsByJourneyId = new Map<string, Set<string>>();
  for (const attempt of journeyBeatAttempts) {
    if (!attempt.correct || attempt.beat.scoringWeight <= 0) continue;
    const journeyId = attempt.beat.journeyId;
    let beatSet = correctBeatsByJourneyId.get(journeyId);
    if (!beatSet) {
      beatSet = new Set<string>();
      correctBeatsByJourneyId.set(journeyId, beatSet);
    }
    beatSet.add(attempt.beatId);
  }

  // Summer workshop instructors don't need the Lesson Design Studio capstone
  // at this stage — they run pre-scoped workshops, not full curriculum.
  // Filter the LDS module out of their training feed (plan §8).
  const visibleModules = isSummerWorkshopInstructor
    ? modules.filter((m) => m.contentKey !== LESSON_DESIGN_STUDIO_MODULE_KEY)
    : modules;

  const moduleCards: ModuleCard[] = visibleModules.map((module) => {
    const assignment = assignmentByModule.get(module.id);
    const progress = videoByModule.get(module.id);
    const latestQuiz = latestQuizByModule.get(module.id);

    const journey = module.interactiveJourney;
    const isInteractive = journey !== null;
    const totalScoredBeats = journey?.beats.length ?? 0;
    const correctBeats = journey
      ? (correctBeatsByJourneyId.get(journey.id)?.size ?? 0)
      : 0;
    const journeyCompletion = journey
      ? journeyCompletionByJourneyId.get(journey.id)
      : undefined;

    // Configuration issues — re-derive client-side using the central rules.
    // INTERACTIVE_JOURNEY modules with a journey row are always actionable.
    let configurationIssue: string | null = null;
    if (module.requiresQuiz && module.quizQuestions.length === 0) {
      configurationIssue = "Quiz is required but no quiz questions are configured for this module.";
    } else if (
      module.required &&
      !isInteractive &&
      !module.videoUrl &&
      !module.requiresQuiz &&
      !module.requiresEvidence
    ) {
      configurationIssue = "This required module has no actionable steps configured yet. Ask an admin to set it up.";
    } else if (
      module.required &&
      module.videoUrl &&
      module.videoProvider &&
      !TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(module.videoProvider)
    ) {
      configurationIssue = "Required module video provider must be YOUTUBE, VIMEO, or CUSTOM so watch tracking can count.";
    }

    // Per-channel readiness gates.
    const videoReady = !module.videoUrl || progress?.completed === true;
    const quizReady =
      !module.requiresQuiz ||
      (module.quizQuestions.length > 0 && passedQuizModuleIds.has(module.id));
    const journeyReady = !isInteractive || journeyCompletion?.passed === true;
    const fullyComplete = !configurationIssue && videoReady && quizReady && journeyReady;

    // Unified progress percentage: prefer journey beat-completion when the
    // module is interactive (no videos in current curriculum), otherwise
    // fall back to legacy video watch percentage.
    let progressPct: number;
    if (fullyComplete) {
      progressPct = 100;
    } else if (isInteractive) {
      progressPct =
        totalScoredBeats > 0
          ? Math.min(99, Math.round((correctBeats / totalScoredBeats) * 100))
          : 0;
    } else {
      const videoDuration = module.videoDuration ?? null;
      progressPct =
        videoDuration && videoDuration > 0
          ? Math.min(99, Math.round(((progress?.watchedSeconds ?? 0) / videoDuration) * 100))
          : (progress?.watchedSeconds ?? 0) > 0
            ? 30
            : 0;
    }

    const estimatedMinutes =
      journey?.estimatedMinutes ?? module.estimatedMinutes ?? null;

    return {
      module,
      assignment,
      latestQuiz,
      journeyProgress: {
        isInteractive,
        correctBeats,
        totalBeats: totalScoredBeats,
        scorePct: journeyCompletion?.scorePct ?? null,
        passed: journeyCompletion?.passed === true,
      },
      videoReady,
      quizReady,
      fullyComplete,
      progressPct,
      configurationIssue,
      estimatedMinutes,
    };
  });
  const postedSlots = interviewGate.slots.filter((slot) => slot.status === "POSTED");
  const confirmedSlot = interviewGate.slots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = interviewGate.slots.find((slot) => slot.status === "COMPLETED");
  const pendingAvailabilityRequests = interviewGate.availabilityRequests.filter(
    (request) => request.status === "PENDING"
  );

  // Single source of truth for the LDS gate. `readiness.lessonDesignStudioGate`
  // is computed inside `buildInstructorReadinessFromSnapshot` and shared with
  // the server-side hard gate on the LDS route via `getLessonDesignStudioGateStatus`.
  const readinessCheckPassed = readiness.lessonDesignStudioGate.unlocked;
  const readinessCheckModuleId =
    readiness.lessonDesignStudioGate.unlocked
      ? moduleCards.find((c) => c.module.contentKey === READINESS_CHECK_MODULE_KEY)
          ?.module.id ?? null
      : readiness.lessonDesignStudioGate.readinessCheckModuleId;

  const moduleWeight = readiness.requiredModulesCount;
  const doneModuleWeight = readiness.academyModulesComplete
    ? moduleWeight
    : readiness.completedRequiredModules;
  const totalTrainingWeight = moduleWeight + 1;
  const doneTrainingWeight = doneModuleWeight + (readiness.studioCapstoneComplete ? 1 : 0);
  const trainingPct =
    totalTrainingWeight > 0
      ? Math.round((doneTrainingWeight / totalTrainingWeight) * 100)
      : 0;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/instructor/workspace?tab=my-pathway" className="link" style={{ fontSize: 13 }}>
          ← Back to My Pathway
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Step 1 of Your Instructor Pathway</p>
          <h1 className="page-title">Instructor Training Academy</h1>
          <p className="page-subtitle">Work through every required module — short interactive journeys with practice, feedback, and a readiness check — to unlock the interview gate and offering approval.</p>
        </div>
      </div>

      {isSummerWorkshopInstructor && (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 16,
            borderColor: "#a78bfa",
            background: "#f5f3ff",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#5b21b6", lineHeight: 1.55 }}>
            <strong>Summer Workshop Instructor track.</strong>{" "}
            You're on the lighter onboarding path: core expectations,
            safety/professionalism, workshop delivery basics, and engagement tactics for camp
            settings. The Lesson Design Studio capstone is not required at this stage and is
            hidden — it becomes a follow-up if you're later promoted to full Instructor.
          </p>
        </div>
      )}

      {showLdsLockedBanner && !readinessCheckPassed ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 16,
            borderColor: "#f59e0b",
            background: "#fffbeb",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            <strong>Lesson Design Studio is locked.</strong>{" "}
            Complete the Readiness Check first
            {readinessCheckModuleId ? (
              <>
                {" — "}
                <Link
                  href={`/training/${readinessCheckModuleId}`}
                  className="link"
                >
                  open it now
                </Link>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      ) : null}

      {/* Roadmap progress bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Training Progress</div>
            <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 13 }}>
              {readiness.completedRequiredModules} of {readiness.requiredModulesCount} modules complete
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: readiness.trainingComplete ? "#16a34a" : "var(--ypp-purple)" }}>
            {trainingPct}%
          </div>
        </div>
        <div style={{ marginTop: 10, height: 10, background: "var(--gray-200)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ width: `${trainingPct}%`, height: "100%", background: readiness.trainingComplete ? "#16a34a" : "var(--ypp-purple)", borderRadius: 6 }} />
        </div>
        {readiness.trainingComplete && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
            Training complete — proceed to Step 2: Pass the Interview Gate
          </div>
        )}
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
              {interviewGate.outcome ? ` · Outcome: ${interviewGate.outcome}` : ""}
              {interviewGate.scheduledAt ? ` · Scheduled: ${formatDateTime(interviewGate.scheduledAt)}` : ""}
            </p>
          </div>
          {isReviewer ? (
            <a href={reviewerHref} className="button small outline" style={{ textDecoration: "none" }}>
              Reviewer view
            </a>
          ) : null}
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
            <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
              No posted slots right now. Request preferred times below — your chapter lead will post matching slots when available.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {postedSlots.map((slot) => (
                <div key={slot.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{formatDateTime(slot.scheduledAt)}</p>
                  <p style={{ margin: "6px 0 10px", fontSize: 13, color: "var(--muted)" }}>
                    {slot.duration} minutes{slot.notes ? ` · ${slot.notes}` : ""}
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
          <div className="card" style={{ background: "var(--surface-alt)", padding: 16 }}>
            <p style={{ marginTop: 0, fontSize: 13, color: "var(--muted)" }}>
              Use the shared interview scheduler to request times, confirm slots, and keep your reminder emails in one place.
            </p>
            <Link href="/interviews/schedule" className="button small" style={{ textDecoration: "none" }}>
              Open Interview Scheduler
            </Link>
          </div>

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
        <h3 style={{ marginBottom: 8 }}>Offering Approval</h3>
        <p style={{ marginTop: 0, fontSize: 14, color: "var(--muted)" }}>
          Each offering now needs approval before it can publish. Training and interview clear your readiness. Class settings is where you request approval.
        </p>
        <div
          style={{
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            {readiness.canRequestOfferingApproval
              ? "You are ready to request offering approval."
              : "Finish readiness requirements before requesting offering approval."}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#1d4ed8" }}>
            {readiness.nextAction.detail}
          </p>
          <div style={{ marginTop: 12 }}>
            <Link href="/instructor/class-settings" className="button small" style={{ textDecoration: "none" }}>
              Open Class Settings
            </Link>
          </div>
        </div>
      </div>

      {trainingCertificate ? (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--success, #16a34a)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>Training Certificate Earned</h3>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Issued {new Date(trainingCertificate.issuedAt).toLocaleDateString()} ·
                Certificate #{trainingCertificate.certificateNumber}
              </p>
            </div>
            <Link
              href="/certificates"
              className="button small"
              style={{ textDecoration: "none", whiteSpace: "nowrap" }}
            >
              View Certificate
            </Link>
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Academy Modules</h3>
        <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 14 }}>
          Each module is an interactive journey: read, practice, get feedback, then pass a short check. Modules unlock the next step in your pathway.
        </p>

        {/* Kanban columns — collapse to a single column on narrow screens */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          {(() => {
            const notStarted = moduleCards.filter(
              (c) => !c.fullyComplete && c.assignment?.status !== "IN_PROGRESS"
            );
            const inProgress = moduleCards.filter(
              (c) => !c.fullyComplete && c.assignment?.status === "IN_PROGRESS"
            );
            const complete = moduleCards.filter((c) => c.fullyComplete);
            const firstAvailable = moduleCards.find(
              (c) => !c.fullyComplete && c.assignment?.status !== "IN_PROGRESS"
            );
            const columns: {
              key: string;
              label: string;
              dotColor: string;
              cards: ModuleCard[];
              empty: string;
            }[] = [
              {
                key: "not-started",
                label: "Not Started",
                dotColor: "var(--border)",
                cards: notStarted,
                empty: "Every module is in progress or complete — nice work.",
              },
              {
                key: "in-progress",
                label: "In Progress",
                dotColor: "#6366f1",
                cards: inProgress,
                empty: firstAvailable
                  ? `Open "${firstAvailable.module.title}" to begin.`
                  : "Nothing started yet — pick up Module 1 from the left.",
              },
              {
                key: "complete",
                label: "Complete",
                dotColor: "#16a34a",
                cards: complete,
                empty: "Finish a module to see it here.",
              },
            ];
            return columns.map((column) => (
              <div key={column.key}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: column.dotColor,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {column.label} ({column.cards.length})
                  </span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {column.cards.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{column.empty}</p>
                  ) : (
                    column.cards.map((card) => (
                      <KanbanCard
                        key={card.module.id}
                        card={card}
                        readinessCheckPassed={readinessCheckPassed}
                        readinessCheckModuleId={readinessCheckModuleId}
                      />
                    ))
                  )}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
