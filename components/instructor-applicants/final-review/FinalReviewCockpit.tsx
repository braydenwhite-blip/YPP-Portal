"use client";

/**
 * Top-level client shell mounted by the server route at
 * /admin/instructor-applicants/[id]/review.
 *
 * Composition is intentionally flat: the cockpit owns the cross-section
 * context, the Framer Motion config, the pending-intent state, the commit
 * lifecycle, and the post-decision toast. Children are pure presenters.
 */

import { useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { useRouter } from "next/navigation";
import type { ChairDecisionAction, InstructorInterviewRecommendation } from "@prisma/client";

import type {
  SerializedApplicationForReview,
  QueueNeighbors,
  ChairDraftSnapshot,
} from "@/lib/final-review-queries";
import { computeReadinessSignals } from "@/lib/readiness-signals";
import { detectContrarianSignals, type ContrarianSignal } from "@/lib/contrarian-signals";
import { useCommitDecision } from "@/lib/use-commit-decision";

import { FinalReviewProvider, useFinalReviewContext } from "./FinalReviewContext";
import ApplicantSnapshotBar from "./ApplicantSnapshotBar";
import ReviewWorkspace from "./ReviewWorkspace";
import FeedbackPanel from "./FeedbackPanel";
import SignalPanel from "./SignalPanel";
import DecisionDock from "./DecisionDock";
import DecisionConfirmModal, { type DecisionConfirmPayload } from "./DecisionConfirmModal";
import ContrarianWarningModal from "./ContrarianWarningModal";
import DecisionPendingOverlay from "./DecisionPendingOverlay";
import PostDecisionToast from "./PostDecisionToast";
import DecisionReadinessMeter from "./DecisionReadinessMeter";
import RecommendationBadge from "@/components/instructor-applicants/shared/RecommendationBadge";
import RatingChip from "@/components/instructor-applicants/shared/RatingChip";
import ReviewerIdentityChip from "@/components/instructor-applicants/shared/ReviewerIdentityChip";
import { AlertTriangleIcon } from "./cockpit-icons";

export interface FinalReviewCockpitProps {
  application: SerializedApplicationForReview;
  queue: QueueNeighbors;
  initialDraft: ChairDraftSnapshot;
  actorId: string;
}

const ROUTE_PREFIX = "/admin/instructor-applicants";

function buildReviewRoute(id: string) {
  return `${ROUTE_PREFIX}/${id}/review`;
}

function deriveDisplayName(app: SerializedApplicationForReview): string {
  return (
    app.preferredFirstName?.trim() ||
    app.legalName?.trim() ||
    app.applicant.name?.trim() ||
    "Applicant"
  );
}

function CockpitInner({
  application,
  queue,
  initialDraft,
  actorId,
}: FinalReviewCockpitProps) {
  const router = useRouter();
  const { registerQuoteHandler } = useFinalReviewContext();
  const displayName = deriveDisplayName(application);

  const [draft, setDraft] = useState({
    rationale: initialDraft.rationale,
    comparisonNotes: initialDraft.comparisonNotes,
  });
  const [pendingAction, setPendingAction] = useState<ChairDecisionAction | null>(null);
  const [contrarianSignals, setContrarianSignals] = useState<ContrarianSignal[]>([]);
  const [contrarianAction, setContrarianAction] = useState<ChairDecisionAction | null>(null);
  const [overrideWarnings, setOverrideWarnings] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastDecided, setToastDecided] = useState<ChairDecisionAction | null>(null);

  const commit = useCommitDecision();

  const readiness = useMemo(
    () =>
      computeReadinessSignals({
        interviewReviews: application.interviewReviews,
        applicationReviews: application.reviewerNote
          ? [
              {
                summary: application.reviewerNote.summary,
                nextStep: application.reviewerNote.nextStep,
              },
            ]
          : [],
        materialsReadyAt: application.materialsReadyAt,
        infoRequest: null, // Phase 1 doesn't surface infoRequest in the serialized payload yet.
      }),
    [application]
  );

  const recommendations = application.interviewReviews
    .map((r) => r.recommendation)
    .filter((r): r is InstructorInterviewRecommendation => Boolean(r));
  const totalReviews = recommendations.length;
  const rejectCount = recommendations.filter((r) => r === "REJECT").length;
  const hasMajorityReject = totalReviews > 0 && rejectCount > totalReviews / 2;
  const hasMixedConsensus =
    totalReviews > 1 &&
    new Set(recommendations.map((r) => (r === "ACCEPT_WITH_SUPPORT" ? "ACCEPT" : r))).size > 1;
  const acceptingNames = application.interviewReviews
    .filter((r) => r.recommendation === "ACCEPT" || r.recommendation === "ACCEPT_WITH_SUPPORT")
    .map((r) => r.reviewerName ?? "Unknown reviewer");
  const rejectingNames = application.interviewReviews
    .filter((r) => r.recommendation === "REJECT")
    .map((r) => r.reviewerName ?? "Unknown reviewer");

  // Phase 1 does not surface RED_FLAG tags from the interview answers feed.
  // Treat as 0 until Phase 3 wires the feed; the contrarian guard still fires
  // on missing-interviews and majority-reject paths.
  const redFlagCount = 0;
  const hasRedFlags = redFlagCount > 0;

  const readOnly = application.status !== "CHAIR_REVIEW";

  function handleChoose(action: ChairDecisionAction) {
    if (readOnly) return;
    if ((action === "REJECT" || action === "REQUEST_INFO") && draft.rationale.trim().length === 0) {
      // Surface the modal anyway so the chair sees the inline error.
    }
    const signals = detectContrarianSignals({
      action,
      hasSubmittedInterviewReviews: readiness.hasSubmittedInterviewReviews,
      recommendations,
      redFlagCount,
      acceptingReviewerNames: acceptingNames,
      rejectingReviewerNames: rejectingNames,
      priorDecisionAction: application.latestDecision?.action ?? null,
    });
    if (signals.length > 0 && !overrideWarnings) {
      setContrarianAction(action);
      setContrarianSignals(signals);
      return;
    }
    setPendingAction(action);
  }

  function handleConfirm(payload: DecisionConfirmPayload) {
    commit
      .commit({
        applicationId: application.id,
        action: payload.action,
        rationale: payload.rationale,
        comparisonNotes: payload.comparisonNotes,
        rejectReasonCode: payload.rejectReasonCode,
        rejectFreeText: payload.rejectFreeText,
        overrideWarnings,
      })
      .catch(() => {
        // useCommitDecision already moves to the error state; nothing more here.
      });
  }

  // React to commit lifecycle.
  useEffect(() => {
    if (commit.state.status === "success") {
      setToastDecided(commit.state.action);
      setToastOpen(true);
      setPendingAction(null);
      setContrarianSignals([]);
      setContrarianAction(null);
      setOverrideWarnings(false);
      router.refresh();
    }
  }, [commit.state, router]);

  // Prefetch next applicant once we know there's one to advance to.
  useEffect(() => {
    if (queue.nextId) {
      router.prefetch(buildReviewRoute(queue.nextId));
    }
  }, [queue.nextId, router]);

  const next = queue.nextId
    ? (() => {
        const sibling = queue.siblings.find((s) => s.id === queue.nextId);
        return sibling
          ? {
              id: sibling.id,
              name: sibling.displayName,
              chapterName: sibling.chapterName,
              href: buildReviewRoute(sibling.id),
            }
          : null;
      })()
    : null;

  return (
    <div
      className="final-review-cockpit"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--cockpit-canvas, #f7f5fb)",
      }}
    >
      <ApplicantSnapshotBar
        application={{
          id: application.id,
          status: application.status,
          preferredFirstName: application.preferredFirstName,
          legalName: application.legalName,
          applicant: { id: application.applicant.id, name: application.applicant.name },
          chapterName: application.applicant.chapter?.name ?? null,
          subjectsOfInterest: application.subjectsOfInterest,
          daysInQueue: application.daysInQueue,
        }}
        readiness={readiness}
        queue={queue}
        latestDecision={application.latestDecision}
        routeBuilder={buildReviewRoute}
      />
      <main style={{ flex: 1 }}>
        <ReviewWorkspace>
          <FeedbackPanel>
            <CockpitConsensusCard
              recommendations={recommendations}
              applicantDisplayName={displayName}
              redFlagCount={redFlagCount}
            />
            <CockpitInterviewList
              interviewReviews={application.interviewReviews}
            />
            <CockpitReviewerNote application={application} />
            <CockpitMaterialsCard application={application} />
          </FeedbackPanel>
          <SignalPanel>
            <div
              style={{
                background: "var(--cockpit-surface, #fff)",
                border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-muted, #6b5f7a)",
                }}
              >
                Decision readiness
              </p>
              <div style={{ marginTop: 12 }}>
                <DecisionReadinessMeter signals={readiness} />
              </div>
            </div>
            <CockpitInterviewerRoster application={application} />
          </SignalPanel>
        </ReviewWorkspace>
      </main>
      <DecisionDock
        applicationId={application.id}
        actorId={actorId}
        initialRationale={initialDraft.rationale}
        initialComparisonNotes={initialDraft.comparisonNotes}
        initialSavedAt={initialDraft.savedAt}
        hasRedFlags={hasRedFlags}
        hasMajorityReject={hasMajorityReject}
        hasMixedConsensus={hasMixedConsensus}
        rationale={draft.rationale}
        comparisonNotes={draft.comparisonNotes}
        pendingAction={pendingAction}
        pending={commit.state.status === "pending"}
        readOnly={readOnly}
        onDraftChange={setDraft}
        onChoose={handleChoose}
        exposeQuoteHandler={registerQuoteHandler}
      />
      <ContrarianWarningModal
        open={contrarianSignals.length > 0 && contrarianAction !== null}
        signals={contrarianSignals}
        action={contrarianAction ?? "APPROVE"}
        onCancel={() => {
          setContrarianSignals([]);
          setContrarianAction(null);
        }}
        onContinue={() => {
          setOverrideWarnings(true);
          if (contrarianAction) setPendingAction(contrarianAction);
          setContrarianSignals([]);
          setContrarianAction(null);
        }}
      />
      <DecisionConfirmModal
        open={pendingAction !== null && contrarianSignals.length === 0}
        action={pendingAction ?? "APPROVE"}
        application={{
          id: application.id,
          displayName,
          chapterName: application.applicant.chapter?.name ?? null,
          status: application.status,
        }}
        rationale={draft.rationale}
        comparisonNotes={draft.comparisonNotes}
        readiness={readiness}
        priorDecision={application.latestDecision}
        consensus={{
          totalReviews,
          recommendations,
          redFlagCount,
        }}
        submitting={commit.state.status === "pending"}
        error={commit.state.status === "error" ? commit.state.error : null}
        onCancel={() => {
          if (commit.state.status === "pending") return;
          setPendingAction(null);
          commit.reset();
        }}
        onConfirm={handleConfirm}
      />
      <DecisionPendingOverlay open={commit.state.status === "pending"} />
      <PostDecisionToast
        open={toastOpen}
        decidedAction={toastDecided}
        decidedApplicantName={displayName}
        next={next}
        onDismiss={() => setToastOpen(false)}
      />
    </div>
  );
}

function CockpitConsensusCard({
  recommendations,
  applicantDisplayName,
  redFlagCount,
}: {
  recommendations: InstructorInterviewRecommendation[];
  applicantDisplayName: string;
  redFlagCount: number;
}) {
  const counts = recommendations.reduce(
    (acc, rec) => {
      acc[rec] = (acc[rec] ?? 0) + 1;
      return acc;
    },
    {} as Record<InstructorInterviewRecommendation, number>
  );
  const total = recommendations.length;
  const isUnanimousAccept =
    total > 0 && recommendations.every((r) => r === "ACCEPT" || r === "ACCEPT_WITH_SUPPORT");
  const isUnanimousReject = total > 0 && recommendations.every((r) => r === "REJECT");

  let headline = `Reviewers: split decision for ${applicantDisplayName}.`;
  if (total === 0) {
    headline = `No interview recommendations recorded yet for ${applicantDisplayName}.`;
  } else if (isUnanimousAccept) {
    headline = `${total} of ${total} interviewers recommend ${applicantDisplayName} for hire.`;
  } else if (isUnanimousReject) {
    headline = `${total} of ${total} interviewers recommend rejecting ${applicantDisplayName}.`;
  }

  return (
    <section
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 20,
      }}
      aria-label="Consensus summary"
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Consensus
      </p>
      <h2
        style={{
          margin: "6px 0 10px",
          fontSize: 22,
          lineHeight: 1.25,
          color: "var(--ink-default, #1a0533)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {headline}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(Object.keys(counts) as InstructorInterviewRecommendation[]).map((rec) => (
          <span key={rec} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <RecommendationBadge recommendation={rec} size="sm" />
            <span style={{ color: "var(--ink-muted, #6b5f7a)" }}>×{counts[rec]}</span>
          </span>
        ))}
        {redFlagCount > 0 ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(239, 68, 68, 0.12)",
              color: "#b91c1c",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <AlertTriangleIcon size={12} />
            {redFlagCount} red flag{redFlagCount > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function CockpitInterviewList({
  interviewReviews,
}: {
  interviewReviews: SerializedApplicationForReview["interviewReviews"];
}) {
  if (interviewReviews.length === 0) {
    return (
      <section
        style={{
          background: "var(--cockpit-surface, #fff)",
          border: "1px dashed var(--cockpit-line-strong, rgba(71,85,105,0.25))",
          borderRadius: 16,
          padding: 20,
          color: "var(--ink-muted, #6b5f7a)",
        }}
        aria-label="Interview reviews"
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Interview reviews
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>
          Interviews haven&apos;t been scored yet. Nudge interviewers from the queue dropdown to gather signal
          before deciding.
        </p>
      </section>
    );
  }
  return (
    <section
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
      aria-label="Interview reviews"
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Interview reviews · {interviewReviews.length}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {interviewReviews.map((review) => (
          <li
            key={review.id}
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--cockpit-line, rgba(71,85,105,0.16))",
              background: "var(--cockpit-surface-strong, #faf8ff)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <ReviewerIdentityChip
                user={{ id: review.reviewerId, name: review.reviewerName }}
                role="INTERVIEWER"
                round={review.round ?? undefined}
                size="sm"
              />
              <RecommendationBadge recommendation={review.recommendation} />
            </div>
            {review.summary ? (
              <p style={{ margin: "10px 0 6px", fontSize: 13, color: "var(--ink-default, #1a0533)", lineHeight: 1.5 }}>
                {review.summary}
              </p>
            ) : null}
            {review.categories.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {review.categories.map((cat) => (
                  <RatingChip
                    key={`${review.id}-${cat.category}`}
                    rating={(cat.rating ?? null) as Parameters<typeof RatingChip>[0]["rating"]}
                    label={cat.category.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}
                    variant="outline"
                    size="xs"
                  />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CockpitReviewerNote({
  application,
}: {
  application: SerializedApplicationForReview;
}) {
  const note = application.reviewerNote;
  if (!note || (!note.summary && !note.notes && !note.nextStep)) return null;
  return (
    <section
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      aria-label="Lead reviewer note"
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Lead reviewer note
        {application.reviewerName ? ` · ${application.reviewerName}` : ""}
      </p>
      {note.summary ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-default, #1a0533)" }}>
          {note.summary}
        </p>
      ) : null}
      {note.notes ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--ink-muted, #6b5f7a)",
            whiteSpace: "pre-wrap",
          }}
        >
          {note.notes}
        </p>
      ) : null}
      {note.nextStep ? (
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--ypp-purple-700, #5a1da8)" }}>
          Suggested next step: {note.nextStep}
        </p>
      ) : null}
    </section>
  );
}

function CockpitMaterialsCard({
  application,
}: {
  application: SerializedApplicationForReview;
}) {
  return (
    <section
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 20,
      }}
      aria-label="Submitted materials"
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Submitted materials
      </p>
      <dl
        style={{
          margin: "10px 0 0",
          display: "grid",
          gridTemplateColumns: "minmax(120px, max-content) 1fr",
          gap: "8px 16px",
          fontSize: 13,
        }}
      >
        <dt style={{ fontWeight: 600 }}>Course outline</dt>
        <dd style={{ margin: 0, color: "var(--ink-muted, #6b5f7a)" }}>
          {application.courseOutline?.trim() || "Not provided"}
        </dd>
        <dt style={{ fontWeight: 600 }}>First-class plan</dt>
        <dd style={{ margin: 0, color: "var(--ink-muted, #6b5f7a)" }}>
          {application.firstClassPlan?.trim() || "Not provided"}
        </dd>
        <dt style={{ fontWeight: 600 }}>Subjects</dt>
        <dd style={{ margin: 0, color: "var(--ink-muted, #6b5f7a)" }}>
          {application.subjectsOfInterest?.trim() || "Not provided"}
        </dd>
        <dt style={{ fontWeight: 600 }}>Course idea</dt>
        <dd style={{ margin: 0, color: "var(--ink-muted, #6b5f7a)" }}>
          {application.courseIdea?.trim() || application.textbook?.trim() || "Not provided"}
        </dd>
      </dl>
    </section>
  );
}

function CockpitInterviewerRoster({
  application,
}: {
  application: SerializedApplicationForReview;
}) {
  const roster = application.interviewerAssignments;
  if (roster.length === 0) return null;
  return (
    <section
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 16,
      }}
      aria-label="Interviewer roster"
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Interviewer roster
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
        {roster.map((assignment) => (
          <li key={assignment.id}>
            <ReviewerIdentityChip
              user={{ id: assignment.interviewerId, name: assignment.interviewerName }}
              role={assignment.role === "LEAD" ? "LEAD_INTERVIEWER" : "INTERVIEWER"}
              round={assignment.round ?? undefined}
              size="sm"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function FinalReviewCockpit(props: FinalReviewCockpitProps) {
  return (
    <MotionConfig reducedMotion="user">
      <FinalReviewProvider>
        <CockpitInner {...props} />
      </FinalReviewProvider>
    </MotionConfig>
  );
}
