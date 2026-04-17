"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGoalReview } from "@/lib/goal-review-actions";
import { sendReflectionNudge } from "@/lib/gr-actions";
import type { ReviewDraftOutput } from "@/lib/ai/generate-review-draft";
import { AiCoachingSidebar } from "@/components/mentorship/ai-coaching-sidebar";

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  currentRating: string;
  currentComments: string | null;
  // G&R fields — present when sourced from GRDocumentGoal
  grDocumentGoalId?: string | null;
  timePhase?: string | null;
  priority?: string | null;
  currentProgressState?: string | null;
  currentLifecycleStatus?: string | null;
  dueDate?: string | null;
};

type ReflectionResponse = {
  goalId: string;
  progressMade: string;
  accomplishments: string;
  blockers: string | null;
  nextMonthPlans: string;
  objectiveAchieved: boolean;
};

type NextMonthGoalDraft = {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
};

type Props = {
  reflectionId: string;
  menteeName: string;
  cycleNumber: number;
  cycleMonthLabel: string;
  goals: GoalRow[];
  reflectionResponses: ReflectionResponse[];
  /** Whether the mentee has submitted a self-reflection for this cycle */
  hasReflection: boolean;
  initialReview: {
    overallRating: string;
    overallComments: string;
    planOfAction: string;
    bonusPoints: number;
    bonusReason: string;
    status: string;
    nextMonthGoalDraftsJson?: unknown;
  } | null;
  isQuarterly: boolean;
  pointsByRating: Record<string, number>;
  runningTotalPoints: number;
  currentTier: string | null;
  tierThresholds: { tier: string; min: number }[];
  maxActiveMonthlyGoals?: number;
  currentActiveMonthlyCount?: number;
};

const RATINGS: { value: string; label: string; color: string; description: string }[] = [
  { value: "BEHIND_SCHEDULE", label: "Behind Schedule", color: "#ef4444", description: "No catch-up path this cycle" },
  { value: "GETTING_STARTED", label: "Getting Started", color: "#f59e0b", description: "Behind but catch-up is possible" },
  { value: "ACHIEVED", label: "Achieved", color: "#22c55e", description: "Goals completed on schedule" },
  { value: "ABOVE_AND_BEYOND", label: "Above & Beyond", color: "#6366f1", description: "Significantly exceeds goals" },
];

function tierLabel(tier: string | null): string {
  if (!tier) return "No tier yet";
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

function nextTier(currentTotal: number, thresholds: { tier: string; min: number }[]) {
  const ascending = [...thresholds].sort((a, b) => a.min - b.min);
  return ascending.find((t) => currentTotal < t.min) ?? null;
}

function tierFor(total: number, thresholds: { tier: string; min: number }[]): string | null {
  const desc = [...thresholds].sort((a, b) => b.min - a.min);
  for (const t of desc) {
    if (total >= t.min) return t.tier;
  }
  return null;
}

function NudgePanel({ reflectionId, menteeName }: { reflectionId: string; menteeName: string }) {
  const [nudgeSent, setNudgeSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function sendNudge() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reflectionId", reflectionId);
      await sendReflectionNudge(fd);
      setNudgeSent(true);
    });
  }

  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 8,
        padding: "0.75rem 1rem",
        fontSize: "0.83rem",
        color: "#92400e",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        flexWrap: "wrap",
      }}
    >
      <span>
        <strong>Awaiting self-reflection</strong> — AI suggestions will be available once {menteeName} submits their reflection.
      </span>
      {nudgeSent ? (
        <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.8rem" }}>✓ Reminder sent</span>
      ) : (
        <button
          type="button"
          onClick={sendNudge}
          disabled={isPending}
          style={{
            padding: "0.3rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #f59e0b",
            background: "#fef3c7",
            color: "#92400e",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {isPending ? "Sending…" : "Send reminder"}
        </button>
      )}
    </div>
  );
}

export function GoalReviewForm({
  reflectionId,
  menteeName,
  cycleNumber,
  cycleMonthLabel,
  goals,
  reflectionResponses,
  hasReflection,
  initialReview,
  isQuarterly,
  pointsByRating,
  runningTotalPoints,
  currentTier,
  tierThresholds,
  maxActiveMonthlyGoals = 5,
  currentActiveMonthlyCount = 0,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Core review fields ────────────────────────────────────────────────────
  const [overallRating, setOverallRating] = useState(initialReview?.overallRating ?? "GETTING_STARTED");
  const [overallComments, setOverallComments] = useState(initialReview?.overallComments ?? "");
  const [planOfAction, setPlanOfAction] = useState(initialReview?.planOfAction ?? "");
  const [bonusPoints, setBonusPoints] = useState<number>(initialReview?.bonusPoints ?? 0);
  const [bonusReason, setBonusReason] = useState(initialReview?.bonusReason ?? "");

  function initGoalRatings(goalList: GoalRow[]) {
    const init: Record<string, { rating: string | null; comments: string }> = {};
    goalList.forEach((g) => {
      // Default to null (unset) unless a persisted rating exists — prevents accidental GETTING_STARTED on submit
      init[g.id] = { rating: g.currentRating || null, comments: g.currentComments ?? "" };
    });
    return init;
  }

  const [goalRatings, setGoalRatings] = useState<Record<string, { rating: string | null; comments: string }>>(
    () => initGoalRatings(goals)
  );

  // A13: re-seed when goals list changes (e.g. parent re-fetches)
  const goalsKey = goals.map((g) => g.id).join(",");
  useEffect(() => {
    setGoalRatings(initGoalRatings(goals));
    setGrProgressStates(() => {
      const init: Record<string, string> = {};
      goals.forEach((g) => { if (g.grDocumentGoalId) init[g.grDocumentGoalId] = g.currentProgressState ?? "NOT_STARTED"; });
      return init;
    });
    setGrLifecycleStatuses(() => {
      const init: Record<string, string> = {};
      goals.forEach((g) => { if (g.grDocumentGoalId) init[g.grDocumentGoalId] = g.currentLifecycleStatus ?? "ACTIVE"; });
      return init;
    });
  }, [goalsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── G&R-specific state ────────────────────────────────────────────────────
  const [grProgressStates, setGrProgressStates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    goals.forEach((g) => {
      if (g.grDocumentGoalId) init[g.grDocumentGoalId] = g.currentProgressState ?? "NOT_STARTED";
    });
    return init;
  });
  const [grLifecycleStatuses, setGrLifecycleStatuses] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    goals.forEach((g) => {
      if (g.grDocumentGoalId) init[g.grDocumentGoalId] = g.currentLifecycleStatus ?? "ACTIVE";
    });
    return init;
  });

  // Restore persisted next-month drafts from a previous DRAFT save (A6)
  const [nextMonthDrafts, setNextMonthDrafts] = useState<NextMonthGoalDraft[]>(() => {
    try {
      const raw = initialReview?.nextMonthGoalDraftsJson;
      if (Array.isArray(raw)) return raw as NextMonthGoalDraft[];
    } catch { /* ignore */ }
    return [];
  });

  // A14: compute effective monthly cap (subtract goals the mentor already marked complete/archived locally)
  const locallyCompletedCount = useMemo(
    () => Object.values(grLifecycleStatuses).filter((s) => s === "COMPLETED" || s === "ARCHIVED").length,
    [grLifecycleStatuses]
  );
  const monthlyDraftCount = nextMonthDrafts.length;
  const effectiveMonthlyCount = Math.max(0, currentActiveMonthlyCount - locallyCompletedCount) + monthlyDraftCount;
  const isOverCap = effectiveMonthlyCount > maxActiveMonthlyGoals;

  // ── AI draft state ────────────────────────────────────────────────────────
  const [aiDraftUsed, setAiDraftUsed] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  function handleApplyComment(goalId: string, comment: string) {
    setGoalRatings((prev) => ({
      ...prev,
      [goalId]: { ...(prev[goalId] ?? { rating: null, comments: "" }), comments: comment },
    }));
    setAiDraftUsed(true);
  }

  function handleApplyRating(goalId: string, rating: string) {
    setGoalRatings((prev) => ({
      ...prev,
      [goalId]: { ...(prev[goalId] ?? { rating: null, comments: "" }), rating },
    }));
    setAiDraftUsed(true);
  }

  function handleApplyAll(draft: ReviewDraftOutput) {
    if (draft.overallComments) setOverallComments(draft.overallComments);
    if (draft.planOfAction) setPlanOfAction(draft.planOfAction);
    setGoalRatings((prev) => {
      const next = { ...prev };
      goals.forEach((g) => {
        const comment = draft.perGoalComments?.[g.id];
        const rating = draft.perGoalSuggestedRating?.[g.id];
        next[g.id] = {
          rating: rating ?? next[g.id]?.rating ?? null,
          comments: comment ?? next[g.id]?.comments ?? "",
        };
      });
      return next;
    });
    setAiDraftUsed(true);
    setShowDraftBanner(true);
  }

  // ── Live award projection ─────────────────────────────────────────────────
  const projection = useMemo(() => {
    const base = pointsByRating[overallRating] ?? 0;
    const bonus = Math.max(0, Math.min(25, bonusPoints || 0));
    const cyclePoints = base + bonus;
    const projectedTotal = runningTotalPoints + cyclePoints;
    const projectedTier = tierFor(projectedTotal, tierThresholds);
    const willCross = projectedTier !== currentTier;
    const next = nextTier(projectedTotal, tierThresholds);
    return { base, bonus, cyclePoints, projectedTotal, projectedTier, willCross, next };
  }, [overallRating, bonusPoints, pointsByRating, runningTotalPoints, currentTier, tierThresholds]);

  // ── Form submission ───────────────────────────────────────────────────────
  function buildFormData(submitForApproval: boolean): FormData {
    const fd = new FormData();
    fd.set("reflectionId", reflectionId);
    fd.set("overallRating", overallRating);
    fd.set("overallComments", overallComments);
    fd.set("planOfAction", planOfAction);
    fd.set("bonusPoints", String(projection.bonus));
    if (bonusReason.trim()) fd.set("bonusReason", bonusReason.trim());
    if (submitForApproval) fd.set("submitForApproval", "true");
    if (aiDraftUsed) fd.set("aiDraftUsed", "true");
    goals.forEach((g) => {
      if (g.grDocumentGoalId) {
        fd.append("grGoalIds", g.grDocumentGoalId);
        // Fall back to GETTING_STARTED only on submit; draft saves can have null ratings
        fd.set(`goal_${g.grDocumentGoalId}_rating`, goalRatings[g.id]?.rating ?? (submitForApproval ? "GETTING_STARTED" : ""));
        fd.set(`goal_${g.grDocumentGoalId}_comments`, goalRatings[g.id]?.comments ?? "");
        const ps = grProgressStates[g.grDocumentGoalId];
        if (ps) fd.set(`goal_${g.grDocumentGoalId}_progressState`, ps);
        const ls = grLifecycleStatuses[g.grDocumentGoalId];
        if (ls) fd.set(`goal_${g.grDocumentGoalId}_lifecycleStatus`, ls);
      } else {
        fd.append("goalIds", g.id);
        fd.set(`goal_${g.id}_rating`, goalRatings[g.id]?.rating ?? (submitForApproval ? "GETTING_STARTED" : ""));
        fd.set(`goal_${g.id}_comments`, goalRatings[g.id]?.comments ?? "");
      }
    });
    if (nextMonthDrafts.length > 0) {
      fd.set("nextMonthGoalsJson", JSON.stringify(nextMonthDrafts));
    }
    if (carryForward.size > 0) {
      fd.set("carryForwardIds", JSON.stringify([...carryForward]));
    }
    return fd;
  }

  function addNextMonthDraft() {
    setNextMonthDrafts((prev) => [...prev, { title: "", description: "", priority: "NORMAL", dueDate: "" }]);
  }
  function removeNextMonthDraft(idx: number) {
    setNextMonthDrafts((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateNextMonthDraft(idx: number, patch: Partial<NextMonthGoalDraft>) {
    setNextMonthDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function handleSubmit(submitForApproval: boolean) {
    if (submitForApproval && !overallComments.trim()) {
      setError("Please write an overall summary before submitting for approval.");
      return;
    }
    if (submitForApproval && !planOfAction.trim()) {
      setError("Please write advice for next month before submitting for approval.");
      return;
    }
    // A15: require explicit rating per goal on submit
    if (submitForApproval) {
      const unrated = goals.filter((g) => !goalRatings[g.id]?.rating);
      if (unrated.length > 0) {
        setError(`Please rate all goals before submitting. Missing: ${unrated.map((g) => g.title).join(", ")}`);
        return;
      }
    }
    if (submitForApproval && isOverCap) {
      setError(`You have ${effectiveMonthlyCount} monthly goals queued but the cap is ${maxActiveMonthlyGoals}. Remove some next-month goals or mark existing ones as complete.`);
      return;
    }
    setError(null);
    setSuccess(null);
    const fd = buildFormData(submitForApproval);
    startTransition(async () => {
      try {
        await saveGoalReview(fd);
        setSuccess(
          submitForApproval
            ? `Submitted for chair approval. ${menteeName} will see the released review once approved.`
            : "Draft saved."
        );
        if (submitForApproval) {
          setTimeout(() => router.push("/mentorship/mentees"), 1200);
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save review");
      }
    });
  }

  const reflectionByGoal = useMemo(() => {
    const m = new Map<string, ReflectionResponse>();
    reflectionResponses.forEach((r) => m.set(r.goalId, r));
    return m;
  }, [reflectionResponses]);

  // B1: carry-forward toggles for MONTHLY goals
  const [carryForward, setCarryForward] = useState<Set<string>>(new Set());

  // B2: simple token-jaccard similarity (no deps)
  function tokenJaccard(a: string, b: string): number {
    const tokA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const tokB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    let intersection = 0;
    for (const t of tokA) { if (tokB.has(t)) intersection++; }
    const union = tokA.size + tokB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  function getSimilarActiveGoal(draftTitle: string): GoalRow | null {
    if (!draftTitle.trim()) return null;
    for (const g of goals) {
      if (tokenJaccard(draftTitle, g.title) >= 0.6) return g;
    }
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* AI Draft Banner */}
      {showDraftBanner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0.7rem 1rem",
            borderRadius: "var(--radius-md, 8px)",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#1d4ed8" }}>
            <strong>AI draft applied.</strong> All comment fields have been pre-filled — review and edit everything before submitting.
          </span>
          <button
            type="button"
            onClick={() => setShowDraftBanner(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#3b82f6",
              fontSize: "1rem",
              lineHeight: 1,
              padding: "0 4px",
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live award projection */}
      <section
        className="card"
        style={{
          padding: "1rem 1.1rem",
          borderLeft: "4px solid #f59e0b",
          background: "linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <strong style={{ fontSize: "0.95rem" }}>Live award preview</strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
              Updates as you change the overall rating and bonus points. Approval is granted by the chair.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#92400e" }}>+{projection.cyclePoints}</div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {projection.base} base + {projection.bonus} bonus
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          {[
            { label: "Running total", value: `${runningTotalPoints} pts` },
            { label: "After approval", value: `${projection.projectedTotal} pts` },
            { label: "Current tier", value: tierLabel(currentTier) },
            { label: "Projected tier", value: tierLabel(projection.projectedTier) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {label}
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{value}</div>
            </div>
          ))}
        </div>
        {projection.willCross && projection.projectedTier && (
          <p style={{ margin: "10px 0 0", fontSize: "0.85rem", color: "#92400e", fontWeight: 600 }}>
            Approval will move {menteeName} to {tierLabel(projection.projectedTier)}.
          </p>
        )}
        {projection.next && !projection.willCross && (
          <p style={{ margin: "10px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
            {projection.next.min - projection.projectedTotal} pts from {tierLabel(projection.next.tier)}
          </p>
        )}
      </section>

      {/* AI Coaching Sidebar — prominently placed before goal ratings */}
      {hasReflection && goals.length > 0 && (
        <AiCoachingSidebar
          reflectionId={reflectionId}
          goals={goals.map((g) => ({ id: g.id, title: g.title }))}
          onApplyComment={handleApplyComment}
          onApplyRating={handleApplyRating}
          onApplyAll={handleApplyAll}
        />
      )}
      {!hasReflection && goals.length > 0 && (
        <NudgePanel reflectionId={reflectionId} menteeName={menteeName} />
      )}

      {/* Per-goal G&R ratings */}
      <section className="card">
        <div className="section-title">Per-Goal Ratings — {cycleMonthLabel}, Cycle {cycleNumber}</div>
        <p className="muted" style={{ margin: "6px 0 14px", fontSize: "0.83rem" }}>
          Rate each program goal individually. {menteeName}&apos;s self-reflection is shown inline so you can ground each rating in their actual words.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {goals.length === 0 && (
            <div
              style={{
                padding: "1rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm, 6px)",
                fontSize: "0.85rem",
                color: "var(--muted)",
                textAlign: "center",
              }}
            >
              No active program goals are configured for this mentee&apos;s role. Ask your admin to add G&amp;R goals before writing this review.
            </div>
          )}
          {goals.map((g, idx) => {
            const rr = reflectionByGoal.get(g.id);
            const current = goalRatings[g.id] ?? { rating: null, comments: "" };
            const selectedRating = RATINGS.find((r) => r.value === current.rating);
            const isMonthly = g.timePhase === "MONTHLY";
            const isCF = carryForward.has(g.id);
            return (
              <div
                key={g.id}
                style={{
                  border: `1px solid ${selectedRating ? selectedRating.color + "55" : "var(--border)"}`,
                  borderLeft: `4px solid ${selectedRating?.color ?? "var(--border)"}`,
                  borderRadius: "var(--radius-md, 8px)",
                  padding: "0.9rem 1rem",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Goal {idx + 1}
                    </span>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginTop: 1 }}>{g.title}</div>
                    {g.description && (
                      <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.79rem" }}>{g.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                    {/* A15: "Not yet rated" chip when rating is null */}
                    {!selectedRating && (
                      <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.74rem", fontWeight: 600, background: "var(--surface-alt)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                        Not yet rated
                      </span>
                    )}
                    {selectedRating && (
                      <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.74rem", fontWeight: 700, background: `${selectedRating.color}18`, color: selectedRating.color, border: `1px solid ${selectedRating.color}44` }}>
                        {selectedRating.label}
                      </span>
                    )}
                    {/* B1: carry-forward toggle for MONTHLY goals */}
                    {isMonthly && (
                      <button
                        type="button"
                        onClick={() => setCarryForward((prev) => {
                          const next = new Set(prev);
                          if (next.has(g.id)) next.delete(g.id); else next.add(g.id);
                          return next;
                        })}
                        style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: 4,
                          border: `1px solid ${isCF ? "var(--success, #22c55e)" : "var(--border)"}`,
                          background: isCF ? "#f0fdf4" : "var(--surface)",
                          color: isCF ? "#16a34a" : "var(--muted)",
                          cursor: "pointer",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                        }}
                        title="Toggle to carry this goal into next month automatically"
                      >
                        {isCF ? "↻ Continuing" : "Continue →"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mentee's reflection inline */}
                {rr && (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: "0.65rem 0.8rem",
                      background: "#f8fafc",
                      borderRadius: 6,
                      fontSize: "0.81rem",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--muted)" }}>
                        {menteeName}&apos;s reflection
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "0.1rem 0.45rem",
                          borderRadius: 999,
                          background: rr.objectiveAchieved ? "#dcfce7" : "#fef3c7",
                          color: rr.objectiveAchieved ? "#166534" : "#92400e",
                        }}
                      >
                        {rr.objectiveAchieved ? "✓ Objective achieved" : "In progress"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {rr.progressMade && (
                        <div><span style={{ fontWeight: 600, color: "#475569" }}>Progress:</span> {rr.progressMade}</div>
                      )}
                      {rr.accomplishments && (
                        <div><span style={{ fontWeight: 600, color: "#475569" }}>Accomplishments:</span> {rr.accomplishments}</div>
                      )}
                      {rr.blockers && (
                        <div><span style={{ fontWeight: 600, color: "#b45309" }}>Blockers:</span> {rr.blockers}</div>
                      )}
                      {rr.nextMonthPlans && (
                        <div><span style={{ fontWeight: 600, color: "#475569" }}>Next month:</span> {rr.nextMonthPlans}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rating chips */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Your rating
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                    {RATINGS.map((r) => {
                      const selected = current.rating === r.value;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() =>
                            setGoalRatings((prev) => ({
                              ...prev,
                              [g.id]: { ...current, rating: r.value },
                            }))
                          }
                          title={r.description}
                          style={{
                            padding: "0.3rem 0.7rem",
                            borderRadius: 999,
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            border: `2px solid ${selected ? r.color : "var(--border)"}`,
                            background: selected ? `${r.color}18` : "transparent",
                            color: selected ? r.color : "var(--muted)",
                            cursor: "pointer",
                            transition: "all 0.12s",
                          }}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Per-goal comment */}
                <div style={{ marginBottom: g.grDocumentGoalId ? 10 : 0 }}>
                  <label style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Comment <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <textarea
                    value={current.comments}
                    onChange={(e) =>
                      setGoalRatings((prev) => ({
                        ...prev,
                        [g.id]: { ...current, comments: e.target.value },
                      }))
                    }
                    rows={2}
                    placeholder="Why this rating? Specifics help the chair and mentee."
                    style={{ width: "100%", marginTop: 4, resize: "vertical", fontSize: "0.85rem" }}
                  />
                </div>

                {/* G&R inline status updates */}
                {g.grDocumentGoalId && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                        Progress
                      </label>
                      <select
                        value={grProgressStates[g.grDocumentGoalId] ?? "NOT_STARTED"}
                        onChange={(e) => setGrProgressStates((prev) => ({ ...prev, [g.grDocumentGoalId!]: e.target.value }))}
                        style={{ width: "100%", marginTop: 3, fontSize: "0.82rem" }}
                      >
                        <option value="NOT_STARTED">Not Started</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                        Status
                      </label>
                      <select
                        value={grLifecycleStatuses[g.grDocumentGoalId] ?? "ACTIVE"}
                        onChange={(e) => setGrLifecycleStatuses((prev) => ({ ...prev, [g.grDocumentGoalId!]: e.target.value }))}
                        style={{ width: "100%", marginTop: 3, fontSize: "0.82rem" }}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Next-Month Goal Drafts */}
      {goals.some((g) => g.grDocumentGoalId) && (
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>Next-Month Goals</div>
              <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                Propose new monthly goals for {menteeName}. Submitted drafts go through admin approval before becoming active.
                {currentActiveMonthlyCount > 0 && ` (${currentActiveMonthlyCount} active monthly goal${currentActiveMonthlyCount > 1 ? "s" : ""} already)`}
              </p>
            </div>
            <button
              type="button"
              onClick={addNextMonthDraft}
              style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", flexShrink: 0, marginLeft: 10 }}
            >
              + Add Goal
            </button>
          </div>

          {isOverCap && (
            <div style={{ padding: "0.5rem 0.75rem", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 6, fontSize: "0.82rem", color: "#854d0e", marginBottom: 10 }}>
              The effective monthly goal count would be {effectiveMonthlyCount}, exceeding the cap of {maxActiveMonthlyGoals}. Remove some drafts or mark existing goals as completed.
            </div>
          )}

          {nextMonthDrafts.length === 0 && (
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "6px 0 0" }}>
              No next-month goals added. Use the button above to propose goals for the upcoming cycle.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: nextMonthDrafts.length > 0 ? 10 : 0 }}>
            {nextMonthDrafts.map((draft, idx) => (
              <div key={idx} style={{ padding: "0.75rem 0.9rem", border: "1px solid var(--border)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" }}>Goal {idx + 1}</span>
                  <button type="button" onClick={() => removeNextMonthDraft(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "1rem", lineHeight: 1 }}>✕</button>
                </div>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => updateNextMonthDraft(idx, { title: e.target.value })}
                  placeholder="Goal title"
                  style={{ width: "100%", fontSize: "0.88rem" }}
                />
                {/* B2: Similarity hint */}
                {(() => {
                  const similar = getSimilarActiveGoal(draft.title);
                  return similar ? (
                    <div style={{ fontSize: "0.76rem", background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 4, padding: "0.3rem 0.5rem", color: "#854d0e" }}>
                      Looks similar to active goal: &quot;{similar.title}&quot; — consider using the{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setCarryForward((prev) => new Set(prev).add(similar.id));
                          removeNextMonthDraft(idx);
                        }}
                        style={{ background: "none", border: "none", color: "#854d0e", cursor: "pointer", padding: 0, fontWeight: 700, textDecoration: "underline", fontSize: "0.76rem" }}
                      >
                        Continue toggle
                      </button>{" "}
                      instead.
                    </div>
                  ) : null;
                })()}
                <textarea
                  value={draft.description}
                  onChange={(e) => updateNextMonthDraft(idx, { description: e.target.value })}
                  placeholder="Description (optional)"
                  rows={2}
                  style={{ width: "100%", fontSize: "0.82rem", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)" }}>Priority</label>
                    <select value={draft.priority} onChange={(e) => updateNextMonthDraft(idx, { priority: e.target.value })} style={{ width: "100%", marginTop: 2, fontSize: "0.82rem" }}>
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)" }}>Due date (optional)</label>
                    <input type="date" value={draft.dueDate} onChange={(e) => updateNextMonthDraft(idx, { dueDate: e.target.value })} style={{ width: "100%", marginTop: 2, fontSize: "0.82rem" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Overall rating + written sections */}
      <section className="card">
        <div className="section-title">Overall Rating &amp; Written Review</div>

        {/* Overall rating chips */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: "0.83rem", fontWeight: 600 }}>Overall rating for the month</label>
          <p className="muted" style={{ margin: "3px 0 6px", fontSize: "0.78rem" }}>
            This drives the achievement point award. Choose based on the mentee&apos;s holistic performance across all goals.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {RATINGS.map((r) => {
              const selected = overallRating === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setOverallRating(r.value)}
                  title={r.description}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 999,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    border: `2px solid ${selected ? r.color : "var(--border)"}`,
                    background: selected ? `${r.color}18` : "transparent",
                    color: selected ? r.color : "var(--text)",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {r.label}{" "}
                  <span style={{ fontWeight: 400, opacity: 0.75, fontSize: "0.78rem" }}>
                    ({pointsByRating[r.value] ?? 0} pts)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Overall comments */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: "0.83rem", fontWeight: 600 }}>
            Overall summary <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <p className="muted" style={{ margin: "3px 0 4px", fontSize: "0.78rem" }}>
            Holistic impression for the month — speak directly to {menteeName}. Cover strengths, growth areas, and any cross-goal patterns you noticed.
          </p>
          <textarea
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            rows={4}
            placeholder={`What's the headline of this month for ${menteeName}?`}
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>

        {/* Advice for next month (planOfAction) */}
        <div style={{ marginBottom: isQuarterly ? 14 : 0 }}>
          <label style={{ fontSize: "0.83rem", fontWeight: 600 }}>
            Advice for next month <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <p className="muted" style={{ margin: "3px 0 4px", fontSize: "0.78rem" }}>
            Your narrative guidance for {menteeName} — strengths to build on, areas to focus, and cross-goal priorities.
          </p>
          <textarea
            value={planOfAction}
            onChange={(e) => setPlanOfAction(e.target.value)}
            rows={3}
            placeholder="e.g. Focus on completing the onboarding checklist, reach out to one external collaborator this month…"
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>

        {/* Quarterly fields */}
        {isQuarterly && (
          <div
            style={{
              marginTop: 6,
              padding: "0.75rem 0.9rem",
              background: "#faf5ff",
              border: "1px solid #e9d5ff",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#7c3aed" }}>
              Quarterly Review Fields (Cycle {cycleNumber})
            </div>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Projected future path</label>
              <textarea
                rows={2}
                placeholder="Where do you see this mentee heading? Roles, specializations, leadership track…"
                style={{ width: "100%", marginTop: 4, resize: "vertical" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: 600 }}>Promotion readiness</label>
              <textarea
                rows={2}
                placeholder="Is this mentee ready for expanded responsibilities? What would need to change?"
                style={{ width: "100%", marginTop: 4, resize: "vertical" }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Character & Culture Bonus */}
      <section className="card">
        <div className="section-title">Character &amp; Culture Bonus (0–25 pts)</div>
        <p className="muted" style={{ margin: "6px 0 10px", fontSize: "0.8rem" }}>
          Award up to 25 bonus points for exceptional community involvement, character, or cultural contribution outside the rated goals. The chair can adjust this on approval.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: 3 }}>Points</label>
            <input
              type="number"
              min={0}
              max={25}
              value={bonusPoints}
              onChange={(e) => setBonusPoints(Math.max(0, Math.min(25, parseInt(e.target.value, 10) || 0)))}
              style={{ width: 80 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: 3 }}>
              Reason {bonusPoints > 0 && <span style={{ color: "#ef4444" }}>*</span>}
            </label>
            <input
              type="text"
              value={bonusReason}
              onChange={(e) => setBonusReason(e.target.value)}
              placeholder="What community contribution or character trait are you recognizing?"
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </section>

      {/* Errors / success */}
      {error && (
        <p style={{ color: "var(--color-error, #dc2626)", fontWeight: 600, margin: 0 }}>{error}</p>
      )}
      {success && (
        <p style={{ color: "var(--color-success, #16a34a)", fontWeight: 600, margin: 0 }}>{success}</p>
      )}

      {/* Submit buttons */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", paddingBottom: 8 }}>
        <button
          type="button"
          className="button secondary"
          disabled={isPending}
          onClick={() => handleSubmit(false)}
        >
          {isPending ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={isPending || goals.length === 0}
          onClick={() => handleSubmit(true)}
          title={goals.length === 0 ? "No goals configured for this mentee" : undefined}
        >
          {isPending ? "Submitting…" : "Submit for Chair Approval"}
        </button>
      </div>

      {isQuarterly && (
        <p className="muted" style={{ fontSize: "0.75rem", margin: "0 0 8px", textAlign: "right" }}>
          Quarterly cycle — the chair will review this more thoroughly before approving.
        </p>
      )}
    </div>
  );
}
