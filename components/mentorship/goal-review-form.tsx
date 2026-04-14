"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGoalReview } from "@/lib/goal-review-actions";

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  currentRating: string;
  currentComments: string | null;
};

type ReflectionResponse = {
  goalId: string;
  progressMade: string;
  accomplishments: string;
  blockers: string | null;
  nextMonthPlans: string;
  objectiveAchieved: boolean;
};

type Props = {
  reflectionId: string;
  menteeName: string;
  cycleNumber: number;
  cycleMonthLabel: string;
  goals: GoalRow[];
  reflectionResponses: ReflectionResponse[];
  initialReview: {
    overallRating: string;
    overallComments: string;
    planOfAction: string;
    bonusPoints: number;
    bonusReason: string;
    status: string;
  } | null;
  isQuarterly: boolean;
  // Award projection inputs (computed from POINT_TABLE on the server).
  pointsByRating: Record<string, number>;
  runningTotalPoints: number;
  currentTier: string | null;
  tierThresholds: { tier: string; min: number }[];
};

const RATINGS: { value: string; label: string; color: string }[] = [
  { value: "BEHIND_SCHEDULE", label: "Behind Schedule", color: "#ef4444" },
  { value: "GETTING_STARTED", label: "Getting Started", color: "#f59e0b" },
  { value: "ACHIEVED", label: "Achieved", color: "#22c55e" },
  { value: "ABOVE_AND_BEYOND", label: "Above & Beyond", color: "#6366f1" },
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

export function GoalReviewForm({
  reflectionId,
  menteeName,
  cycleNumber,
  cycleMonthLabel,
  goals,
  reflectionResponses,
  initialReview,
  isQuarterly,
  pointsByRating,
  runningTotalPoints,
  currentTier,
  tierThresholds,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [overallRating, setOverallRating] = useState(initialReview?.overallRating ?? "GETTING_STARTED");
  const [overallComments, setOverallComments] = useState(initialReview?.overallComments ?? "");
  const [planOfAction, setPlanOfAction] = useState(initialReview?.planOfAction ?? "");
  const [bonusPoints, setBonusPoints] = useState<number>(initialReview?.bonusPoints ?? 0);
  const [bonusReason, setBonusReason] = useState(initialReview?.bonusReason ?? "");
  const [goalRatings, setGoalRatings] = useState<Record<string, { rating: string; comments: string }>>(() => {
    const init: Record<string, { rating: string; comments: string }> = {};
    goals.forEach((g) => {
      init[g.id] = { rating: g.currentRating, comments: g.currentComments ?? "" };
    });
    return init;
  });

  // Live award projection
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

  function buildFormData(submitForApproval: boolean): FormData {
    const fd = new FormData();
    fd.set("reflectionId", reflectionId);
    fd.set("overallRating", overallRating);
    fd.set("overallComments", overallComments);
    fd.set("planOfAction", planOfAction);
    fd.set("bonusPoints", String(projection.bonus));
    if (bonusReason.trim()) fd.set("bonusReason", bonusReason.trim());
    if (submitForApproval) fd.set("submitForApproval", "true");
    goals.forEach((g) => {
      fd.append("goalIds", g.id);
      fd.set(`goal_${g.id}_rating`, goalRatings[g.id]?.rating ?? "GETTING_STARTED");
      fd.set(`goal_${g.id}_comments`, goalRatings[g.id]?.comments ?? "");
    });
    return fd;
  }

  function handleSubmit(submitForApproval: boolean) {
    if (submitForApproval && !overallComments.trim()) {
      setError("Please write an overall summary before submitting for approval.");
      return;
    }
    if (submitForApproval && !planOfAction.trim()) {
      setError("Please write a plan of action before submitting for approval.");
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Live award projection */}
      <section
        className="card"
        style={{
          padding: "1rem 1.1rem",
          borderLeft: "4px solid #f59e0b",
          background: "linear-gradient(135deg, #fffbeb 0%, #fefce8 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <strong style={{ fontSize: "0.95rem" }}>Live award preview</strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
              Updates as you change the overall rating and bonus points. Approval is granted by the chair.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>+{projection.cyclePoints}</div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {projection.base} base + {projection.bonus} bonus
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <div>
            <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Running total
            </div>
            <div style={{ fontWeight: 600 }}>{runningTotalPoints} pts</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
              After approval
            </div>
            <div style={{ fontWeight: 600 }}>{projection.projectedTotal} pts</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Current tier
            </div>
            <div style={{ fontWeight: 600 }}>{tierLabel(currentTier)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Projected tier
            </div>
            <div style={{ fontWeight: 600 }}>{tierLabel(projection.projectedTier)}</div>
          </div>
        </div>
        {projection.willCross && projection.projectedTier && (
          <p style={{ margin: "10px 0 0", fontSize: "0.85rem", color: "#92400e", fontWeight: 600 }}>
            Approval will move {menteeName} to {tierLabel(projection.projectedTier)}.
          </p>
        )}
      </section>

      {/* Per-goal G&R ratings — backbone of the modern review */}
      <section className="card">
        <div className="section-title">Per-Goal Ratings ({cycleMonthLabel}, Cycle {cycleNumber})</div>
        <p className="muted" style={{ margin: "6px 0 14px", fontSize: "0.85rem" }}>
          Rate each program goal. Mentee&apos;s self-reflection is shown inline so you can ground each rating in their own words.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {goals.length === 0 && (
            <div className="muted" style={{ padding: 16, textAlign: "center" }}>
              No active program goals are configured for this mentee&apos;s role. Ask your admin to add G&amp;R goals before writing this review.
            </div>
          )}
          {goals.map((g) => {
            const rr = reflectionByGoal.get(g.id);
            const current = goalRatings[g.id] ?? { rating: "GETTING_STARTED", comments: "" };
            return (
              <div
                key={g.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md, 8px)",
                  padding: "0.9rem 1rem",
                }}
              >
                <strong style={{ fontSize: "0.95rem" }}>{g.title}</strong>
                {g.description && (
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
                    {g.description}
                  </p>
                )}
                {rr && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "0.6rem 0.75rem",
                      background: "#f8fafc",
                      borderRadius: 6,
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>From {menteeName}&apos;s reflection:</div>
                    {rr.progressMade && <div><strong>Progress:</strong> {rr.progressMade}</div>}
                    {rr.accomplishments && <div><strong>Accomplishments:</strong> {rr.accomplishments}</div>}
                    {rr.blockers && <div><strong>Blockers:</strong> {rr.blockers}</div>}
                    {rr.nextMonthPlans && <div><strong>Next month:</strong> {rr.nextMonthPlans}</div>}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" }}>
                    Rating
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
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
                          style={{
                            padding: "0.3rem 0.7rem",
                            borderRadius: 999,
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            border: `2px solid ${selected ? r.color : "transparent"}`,
                            background: selected ? `${r.color}22` : "var(--surface-alt)",
                            color: selected ? r.color : "var(--text)",
                            cursor: "pointer",
                          }}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" }}>
                    Comments (optional)
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
                    style={{ width: "100%", marginTop: 4, resize: "vertical" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Overall rating */}
      <section className="card">
        <div className="section-title">Overall Rating for the Month</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {RATINGS.map((r) => {
            const selected = overallRating === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setOverallRating(r.value)}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: 999,
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  border: `2px solid ${selected ? r.color : "transparent"}`,
                  background: selected ? `${r.color}22` : "var(--surface-alt)",
                  color: selected ? r.color : "var(--text)",
                  cursor: "pointer",
                }}
              >
                {r.label} ({pointsByRating[r.value] ?? 0} pts)
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Overall summary for the mentee</label>
          <textarea
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            rows={4}
            placeholder="What's the headline of this month? Speak directly to the mentee."
            style={{ width: "100%", marginTop: 4, resize: "vertical" }}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Plan of action for next month</label>
          <textarea
            value={planOfAction}
            onChange={(e) => setPlanOfAction(e.target.value)}
            rows={3}
            placeholder="The 1-3 most important things for the mentee to focus on next month."
            style={{ width: "100%", marginTop: 4, resize: "vertical" }}
          />
        </div>
      </section>

      {/* Bonus points */}
      <section className="card">
        <div className="section-title">Character & Culture Bonus (0–25)</div>
        <p className="muted" style={{ margin: "6px 0 10px", fontSize: "0.8rem" }}>
          Add up to 25 points for character contributions outside the rated goals. The chair can adjust this on approval.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            min={0}
            max={25}
            value={bonusPoints}
            onChange={(e) => setBonusPoints(parseInt(e.target.value, 10) || 0)}
            style={{ width: 100 }}
          />
          <input
            type="text"
            value={bonusReason}
            onChange={(e) => setBonusReason(e.target.value)}
            placeholder="Reason for bonus (visible to the chair)"
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>
      </section>

      {error && <p style={{ color: "var(--color-error)", fontWeight: 600 }}>{error}</p>}
      {success && <p style={{ color: "var(--color-success)", fontWeight: 600 }}>{success}</p>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
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
        >
          {isPending ? "Submitting…" : "Submit for Chair Approval"}
        </button>
      </div>

      {isQuarterly && (
        <p className="muted" style={{ fontSize: "0.78rem", margin: 0, textAlign: "right" }}>
          This is a quarterly cycle — the chair will read it more thoroughly.
        </p>
      )}
    </div>
  );
}
