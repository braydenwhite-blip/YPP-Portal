"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChairDecisionAction, InstructorInterviewRecommendation } from "@prisma/client";

import { StatusBadge } from "@/components/ui-v2";
import DecisionDock from "@/components/instructor-applicants/final-review/DecisionDock";
import DecisionConfirmModal, {
  type DecisionConfirmPayload,
} from "@/components/instructor-applicants/final-review/DecisionConfirmModal";
import DecisionReadinessMeter from "@/components/instructor-applicants/final-review/DecisionReadinessMeter";
import {
  readinessSignalsFromChecks,
  buildDecisionReadinessChecks,
  readinessSummary,
  type DecisionReadinessCheck,
  type DecisionReadinessRecord,
} from "@/lib/applications/decision-readiness";
import {
  computeFinalReviewWarnings,
  type InterviewSignal,
} from "@/lib/final-review-warnings";
import { useCommitDecision } from "@/lib/use-commit-decision";
import { loadWorkspaceChairDraft } from "@/lib/instructor-applicants/workspace-chair-actions";
import { formatWorkspaceDisplayName } from "@/lib/instructor-applicants/workspace-display";
import type { WorkspaceApplicant } from "@/components/instructor-applicants/InstructorApplicantsWorkspace";

function pretty(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function workspaceApplicantToReadinessRecord(
  app: WorkspaceApplicant
): DecisionReadinessRecord {
  const materialsReadyAtISO =
    app.materialsReadyAt == null
      ? null
      : typeof app.materialsReadyAt === "string"
        ? app.materialsReadyAt
        : app.materialsReadyAt.toISOString();

  return {
    status: app.status,
    materialsReadyAtISO,
    materials: {
      courseOutline: Boolean(app.courseOutline?.trim()),
      firstClassPlan: Boolean(app.firstClassPlan?.trim()),
    },
    infoRequest: app.infoRequest,
    applicantResponse: app.applicantResponse,
    reviewer: app.reviewer?.id
      ? { id: app.reviewer.id, name: app.reviewer.name ?? "Reviewer" }
      : null,
    applicationReviews: app.applicationReviews.map((review, index) => ({
      reviewerName: app.reviewer?.name ?? `Reviewer ${index + 1}`,
      isLeadReview: index === 0,
      status: review.summary?.trim() || review.nextStep?.trim() ? "SUBMITTED" : "DRAFT",
      nextStep: review.nextStep,
      summary: review.summary,
    })),
    interviewReviews: app.interviewReviews.map((review) => ({
      reviewerName: review.reviewer.name ?? "Interviewer",
      status: review.recommendation ? "SUBMITTED" : "DRAFT",
    })),
    interviewerAssignments: app.interviewerAssignments.map((assignment) => ({
      interviewer: {
        id: assignment.interviewer.id,
        name: assignment.interviewer.name ?? "Interviewer",
      },
    })),
  };
}

export default function WorkspaceChairDecisionPanel({
  app,
  actorId,
  canMakeFinalDecision,
  activeChairName,
  decisionLockMessage,
  readinessChecks,
  readinessHeadline,
}: {
  app: WorkspaceApplicant;
  actorId: string;
  canMakeFinalDecision: boolean;
  activeChairName?: string | null;
  decisionLockMessage?: string;
  readinessChecks?: DecisionReadinessCheck[];
  readinessHeadline?: string;
}) {
  const router = useRouter();
  const commit = useCommitDecision();
  const displayName = formatWorkspaceDisplayName(app);

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draft, setDraft] = useState({ rationale: "", comparisonNotes: "" });
  const [initialDraft, setInitialDraft] = useState({
    rationale: "",
    comparisonNotes: "",
    savedAt: null as string | null,
  });
  const [pendingAction, setPendingAction] = useState<ChairDecisionAction | null>(null);
  const [acknowledgements, setAcknowledgements] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void loadWorkspaceChairDraft(app.id).then((loaded) => {
      if (cancelled) return;
      setInitialDraft(loaded);
      setDraft({ rationale: loaded.rationale, comparisonNotes: loaded.comparisonNotes });
      setDraftLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [app.id]);

  const resolvedChecks = useMemo(() => {
    if (readinessChecks?.length) return readinessChecks;
    return buildDecisionReadinessChecks(workspaceApplicantToReadinessRecord(app), {
      applicationId: app.id,
      actorId,
    });
  }, [readinessChecks, app]);

  const resolvedHeadline = useMemo(() => {
    if (readinessHeadline) return readinessHeadline;
    return readinessSummary(resolvedChecks).headline;
  }, [readinessHeadline, resolvedChecks]);

  const readiness = useMemo(
    () => readinessSignalsFromChecks(resolvedChecks),
    [resolvedChecks]
  );

  const recommendations = app.interviewReviews
    .map((r) => r.recommendation)
    .filter((r): r is InstructorInterviewRecommendation => Boolean(r));
  const totalReviews = recommendations.length;
  const rejectCount = recommendations.filter((r) => r === "REJECT").length;
  const hasMajorityReject = totalReviews > 0 && rejectCount > totalReviews / 2;
  const hasMixedConsensus =
    totalReviews > 1 &&
    new Set(recommendations.map((r) => (r === "ACCEPT_WITH_SUPPORT" ? "ACCEPT" : r))).size > 1;
  const hasRedFlags = false;

  const readOnly = !canMakeFinalDecision;
  const dockReadOnlyMessage = !canMakeFinalDecision
    ? activeChairName
      ? `${decisionLockMessage ?? "Only the currently assigned Chair can submit the final decision."} Current Chair: ${activeChairName}.`
      : decisionLockMessage ?? "Only the currently assigned Chair can submit the final decision."
    : undefined;

  const interviewSignals: InterviewSignal[] = useMemo(
    () =>
      app.interviewReviews.map((r) => ({
        reviewerName: r.reviewer.name,
        recommendation: r.recommendation as InstructorInterviewRecommendation | null,
        overallRating: r.overallRating as InterviewSignal["overallRating"],
        hasNarrative: r.categories.some((c) => Boolean(c.notes?.trim())),
        unscoredCategoryCount: r.categories.filter((c) => !c.rating).length,
      })),
    [app.interviewReviews]
  );

  const warnings = useMemo(
    () =>
      computeFinalReviewWarnings({
        pendingAction,
        status: app.status as "CHAIR_REVIEW",
        interviews: interviewSignals,
        rationaleLength: draft.rationale.trim().length,
        rejectReasonCode: null,
        hasMaterialsComplete: readiness.hasMaterialsComplete,
        hasOpenInfoRequest: !readiness.hasNoOpenInfoRequest,
        hasRecentTimelineActivity: true,
        hasPriorSupersededDecision: false,
        isCrossChapter: false,
        timeOnPageMs: 0,
      }),
    [pendingAction, app.status, interviewSignals, draft.rationale, readiness]
  );

  function toggleAcknowledge(key: string) {
    setAcknowledgements((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleChoose(action: ChairDecisionAction) {
    if (readOnly) return;
    setPendingAction(action);
  }

  function handleConfirm(payload: DecisionConfirmPayload) {
    void commit
      .commit({
        applicationId: app.id,
        action: payload.action,
        rationale: payload.rationale,
        comparisonNotes: payload.comparisonNotes,
        rejectReasonCode: payload.rejectReasonCode,
        rejectFreeText: payload.rejectFreeText,
        conditions: payload.conditions,
        emailOverride: payload.emailOverride,
        overrideWarnings: warnings
          .filter((w) => w.severity === "HIGH_RISK")
          .every((w) => acknowledgements[w.key] === true),
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    if (commit.state.status === "success") {
      setPendingAction(null);
      setAcknowledgements({});
      startTransition(() => {
        router.refresh();
      });
    }
  }, [commit.state, router]);

  const latestDecision = app.chairDecision
    ? {
        action: app.chairDecision.action as ChairDecisionAction,
        decidedAt:
          typeof app.chairDecision.decidedAt === "string"
            ? app.chairDecision.decidedAt
            : new Date(app.chairDecision.decidedAt).toISOString(),
      }
    : null;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DecisionReadinessMeter
          checks={resolvedChecks}
          summaryLine={resolvedHeadline}
          compact
        />
        {latestDecision ? (
          <StatusBadge tone="brand">{pretty(latestDecision.action)}</StatusBadge>
        ) : null}
      </div>
      {!canMakeFinalDecision ? (
        <p className="m-0 mb-3 rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2 text-[13px] text-ink-muted">
          {dockReadOnlyMessage}
        </p>
      ) : null}

      {draftLoaded ? (
        <>
          <DecisionDock
            variant="inline"
            applicationId={app.id}
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
            pending={commit.state.status === "pending" || commit.state.status === "retrying"}
            readOnly={readOnly}
            readOnlyMessage={dockReadOnlyMessage}
            warnings={warnings}
            acknowledgements={acknowledgements}
            onOpenRiskPreview={() => {
              if (!pendingAction) setPendingAction("APPROVE");
            }}
            onDraftChange={setDraft}
            onChoose={handleChoose}
          />
          <DecisionConfirmModal
            open={pendingAction !== null}
            action={pendingAction ?? "APPROVE"}
            application={{
              id: app.id,
              displayName,
              chapterName: app.applicant.chapter?.name ?? null,
              status: app.status as "CHAIR_REVIEW",
            }}
            rationale={draft.rationale}
            comparisonNotes={draft.comparisonNotes}
            readiness={readiness}
            priorDecision={latestDecision}
            consensus={{
              totalReviews,
              recommendations,
              redFlagCount: 0,
            }}
            submitting={commit.state.status === "pending" || commit.state.status === "retrying"}
            error={
              commit.state.status === "error" && commit.state.kind !== "validation"
                ? commit.state.error
                : null
            }
            warnings={warnings}
            acknowledgements={acknowledgements}
            onToggleAcknowledge={toggleAcknowledge}
            onCancel={() => {
              if (commit.state.status === "pending" || commit.state.status === "retrying") return;
              setPendingAction(null);
            }}
            onConfirm={handleConfirm}
          />
        </>
      ) : (
        <p className="m-0 text-[13px] text-ink-muted">Loading…</p>
      )}
    </div>
  );
}
