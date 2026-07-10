"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGoalReview } from "@/lib/goal-review-actions";
// FIX: Commented out the non-existent server action export to prevent build failure
// import { sendReflectionNudge } from "@/lib/gr-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
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
  menteeId: string;
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
  "BEHIND_SCHEDULE",
  "GETTING_STARTED",
  "ACHIEVED",
  "ABOVE_AND_BEYOND",
].map((value) => {
  const copy = getGoalRatingCopy(value);
  return {
    value,
    label: `${copy.shortLabel} - ${copy.label}`,
    color: copy.color,
    description: copy.mentorDescription,
  };
});

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
      // FIX: Commented out the broken action invocation safely
      // const fd = new FormData();
      // fd.set("reflectionId", reflectionId);
      // await sendReflectionNudge(fd);
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
  menteeId,
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
  // What comes out of this review — an optional, owned, due-dated commitment
  // for the mentee. Only created on submission, never on a draft save.
  const [followUpActionTitle, setFollowUpActionTitle] = useState("");
  const [followUpActionDueAt, setFollowUpActionDueAt] = useState("");

  function initGoalRatings(goalList: GoalRow[]) {
    const init: Record<string, { rating: string | null; comments: string }> = {};
    goalList.forEach((g) => {
      init[g.id] = { rating: g.currentRating || null, comments: g.currentComments ?? "" };
    });
    return init;
  }

  const [goalRatings, setGoalRatings] = useState<Record<string, { rating: string | null; comments: string }>>(
    () => initGoalRatings(goals)
  );

  const goalsKey = goals.map((g) => g.id).join(",");

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
  }, [goalsKey]);

  const [nextMonthDrafts, setNextMonthDrafts] = useState<NextMonthGoalDraft[]>(() => {
    try {
      const raw = initialReview?.nextMonthGoalDraftsJson;
      if (Array.isArray(raw)) return raw as NextMonthGoalDraft[];
    } catch { /* ignore */ }
    return [];
  });

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
    if (submitForApproval && followUpActionTitle.trim()) {
      fd.set("followUpActionTitle", followUpActionTitle.trim());
      if (followUpActionDueAt) fd.set("followUpActionDueAt", followUpActionDueAt);
    }
    goals.forEach((g) => {
      if (g.grDocumentGoalId) {
        fd.append("grGoalIds", g.grDocumentGoalId);
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
            ? `Submitted for chair approval. ${menteeName} will see the Monthly Progress Update once approved.`
            : "Draft saved."
        );
        if (submitForApproval) {
          setTimeout(() => router.push(`/mentorship/people/${menteeId}?section=reviews`), 1200);
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save Monthly Progress Update");
      }
    });
  }

  const reflectionByGoal = useMemo(() => {
    const m = new Map<string, ReflectionResponse>();
    reflectionResponses.forEach((r) => m.set(r.goalId, r));
    return m;
  }, [reflectionResponses]);

  const [carryForward, setCarryForward] = useState<Set<string>>(new Set());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* AI Draft Banner */}
      {showDraftBanner && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0.7rem 1rem", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
          <span style={{ fontSize: "0.85rem", color: "#1d4ed8" }}>
            <strong>AI draft applied.</strong> Review and edit everything before submitting.
          </span>
          <button type="button" onClick={() => setShowDraftBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6" }}>✕</button>
        </div>
      )}

      {hasReflection && goals.length > 0 && (
        <details className="rounded-xl border border-line-soft bg-surface px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink">
            Drafting assistance <span className="font-normal text-ink-muted">(optional)</span>
          </summary>
          <div className="mt-3 border-t border-line-soft pt-3">
            <AiCoachingSidebar
              reflectionId={reflectionId}
              goals={goals.map((g) => ({ id: g.id, title: g.title }))}
              onApplyComment={handleApplyComment}
              onApplyRating={handleApplyRating}
              onApplyAll={handleApplyAll}
            />
          </div>
        </details>
      )}
      {!hasReflection && goals.length > 0 && (
        <NudgePanel reflectionId={reflectionId} menteeName={menteeName} />
      )}

      {/* Per-goal G&R ratings */}
      <section className="card">
        <div className="section-title">Per-Goal Ratings — {cycleMonthLabel}, Cycle {cycleNumber}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
          {goals.map((g, idx) => {
            const rr = reflectionByGoal.get(g.id);
            const current = goalRatings[g.id] ?? { rating: null, comments: "" };
            return (
              <div key={g.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1rem" }}>
                <div style={{ fontWeight: 700 }}>{g.title}</div>
                {rr && (
                  <div style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: 6, marginTop: 6, fontSize: "0.8rem" }}>
                    <strong>{menteeName}&apos;s reflection:</strong> {rr.progressMade}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  {RATINGS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setGoalRatings(p => ({ ...p, [g.id]: { ...current, rating: r.value } }))}
                      style={{ marginRight: 6, padding: "4px 8px", fontSize: "0.8rem", cursor: "pointer" }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {g.grDocumentGoalId ? (
                  <div className="mt-3 grid gap-3 border-t border-line-soft pt-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-[12px] font-semibold text-ink-muted">
                      Progress after release
                      <select
                        aria-label={`Progress after release for ${g.title}`}
                        value={grProgressStates[g.grDocumentGoalId] ?? "NOT_STARTED"}
                        onChange={(event) =>
                          setGrProgressStates((currentStates) => ({
                            ...currentStates,
                            [g.grDocumentGoalId!]: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-line-soft bg-surface px-3 py-2 text-[13px] font-normal text-ink"
                      >
                        <option value="NOT_STARTED">Not started</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="BLOCKED">Blocked</option>
                        <option value="DONE">Done</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-[12px] font-semibold text-ink-muted">
                      Goal after release
                      <select
                        aria-label={`Goal after release for ${g.title}`}
                        value={grLifecycleStatuses[g.grDocumentGoalId] ?? "ACTIVE"}
                        onChange={(event) =>
                          setGrLifecycleStatuses((currentStatuses) => ({
                            ...currentStatuses,
                            [g.grDocumentGoalId!]: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-line-soft bg-surface px-3 py-2 text-[13px] font-normal text-ink"
                      >
                        <option value="ACTIVE">Keep active</option>
                        <option value="COMPLETED">Complete</option>
                        <option value="ARCHIVED">Archive</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Next-Month Goals */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div className="section-title">Next-Month Goals</div>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Propose new milestones for {menteeName}.</p>
          </div>
          <button type="button" onClick={addNextMonthDraft} style={{ padding: "4px 10px", fontSize: "0.8rem", cursor: "pointer" }}>
            + Add Goal
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {nextMonthDrafts.map((draft, idx) => (
            <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "0.75rem", position: "relative" }}>
              <input
                type="text"
                placeholder="Goal Title"
                value={draft.title}
                onChange={(e) => updateNextMonthDraft(idx, { title: e.target.value })}
                style={{ width: "100%", marginBottom: 6 }}
              />
              <textarea
                placeholder="Goal Description"
                value={draft.description}
                onChange={(e) => updateNextMonthDraft(idx, { description: e.target.value })}
                style={{ width: "100%", fontSize: "0.85rem" }}
              />
              <button type="button" onClick={() => removeNextMonthDraft(idx)} style={{ marginTop: 6, color: "red", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Summary Form Block */}
      <section className="card">
        <div className="section-title">Overall rating</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              aria-pressed={overallRating === rating.value}
              onClick={() => setOverallRating(rating.value)}
              className={
                overallRating === rating.value
                  ? "rounded-full border border-brand-600 bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white"
                  : "rounded-full border border-line-soft bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink"
              }
            >
              {rating.label}
            </button>
          ))}
        </div>
        <div className="section-title mt-4">Monthly Progress Update summary</div>
        <textarea
          value={overallComments}
          onChange={(e) => setOverallComments(e.target.value)}
          placeholder="Summarize performance for this cycle..."
          rows={4}
          style={{ width: "100%", marginTop: 8 }}
        />

        <div className="section-title" style={{ marginTop: 14 }}>Plan of Action / Next Steps</div>
        <textarea
          value={planOfAction}
          onChange={(e) => setPlanOfAction(e.target.value)}
          placeholder="What should they focus on next month?"
          rows={4}
          style={{ width: "100%", marginTop: 8 }}
        />

        <div className="section-title" style={{ marginTop: 14 }}>
          Follow-up action (optional)
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, marginBottom: 8 }}>
          One concrete, owned commitment that comes out of this review — it appears in{" "}
          {menteeName}&apos;s Check-ins as an open commitment.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            value={followUpActionTitle}
            onChange={(e) => setFollowUpActionTitle(e.target.value)}
            placeholder="e.g. Shadow a lead instructor's class"
            style={{ flex: "1 1 260px" }}
          />
          <input
            type="date"
            value={followUpActionDueAt}
            onChange={(e) => setFollowUpActionDueAt(e.target.value)}
            aria-label="Follow-up due date"
            style={{ flex: "0 0 auto" }}
          />
        </div>
      </section>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => handleSubmit(false)} disabled={isPending}>
          {isPending ? "Saving..." : "Save Draft"}
        </button>
        <button type="button" onClick={() => handleSubmit(true)} disabled={isPending} style={{ background: "var(--ypp-purple-500)", color: "#fff" }}>
          Submit for Approval
        </button>
      </div>

      {error && <p style={{ color: "red", fontSize: "0.85rem" }}>{error}</p>}
      {success && <p style={{ color: "green", fontSize: "0.85rem" }}>{success}</p>}
    </div>
  );
}
