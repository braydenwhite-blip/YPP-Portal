"use client";

import { useState } from "react";
import type { ReviewDraftOutput } from "@/lib/ai/generate-review-draft";

const RATING_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  BEHIND_SCHEDULE: { label: "Behind Schedule", color: "#ef4444", bg: "#fef2f2" },
  GETTING_STARTED: { label: "Getting Started", color: "#d97706", bg: "#fffbeb" },
  ACHIEVED: { label: "Achieved", color: "#16a34a", bg: "#f0fdf4" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", color: "#7c3aed", bg: "#faf5ff" },
};

interface GoalMeta {
  id: string;
  title: string;
}

interface AiCoachingSidebarProps {
  reflectionId: string;
  goals: GoalMeta[];
  onApplyComment: (goalId: string, comment: string) => void;
  onApplyRating: (goalId: string, rating: string) => void;
  onApplyAll: (draft: ReviewDraftOutput) => void;
}

export function AiCoachingSidebar({
  reflectionId,
  goals,
  onApplyComment,
  onApplyRating,
  onApplyAll,
}: AiCoachingSidebarProps) {
  const [draft, setDraft] = useState<ReviewDraftOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedGoals, setAppliedGoals] = useState<Set<string>>(new Set());

  async function generate() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-review-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflectionId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setDraft((await res.json()) as ReviewDraftOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function applyGoal(goalId: string) {
    if (!draft) return;
    const comment = draft.perGoalComments?.[goalId];
    const rating = draft.perGoalSuggestedRating?.[goalId];
    if (comment) onApplyComment(goalId, comment);
    if (rating) onApplyRating(goalId, rating);
    setAppliedGoals((prev) => new Set(prev).add(goalId));
  }

  function applyAll() {
    if (!draft) return;
    onApplyAll(draft);
    setAppliedGoals(new Set(goals.map((g) => g.id)));
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--ypp-purple-50, #f5f3ff) 0%, var(--surface) 100%)",
        border: "1.5px solid var(--ypp-purple-200, #ddd6fe)",
        borderRadius: 10,
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "1.1rem" }}>✨</span>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ypp-purple-700, #6d28d9)" }}>
          AI Coaching Suggestions
        </span>
      </div>

      {!draft && !isLoading && (
        <div>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
            Get AI-suggested ratings and comments based on the mentee&apos;s self-reflection. Review and apply what fits.
          </p>
          <button
            onClick={generate}
            className="button primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Generate suggestions
          </button>
          {error && (
            <p style={{ color: "var(--danger, #ef4444)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              {error}
            </p>
          )}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: "1rem 0", color: "var(--muted)", fontSize: "0.85rem" }}>
          <div style={{ marginBottom: "0.5rem" }}>Analyzing reflection…</div>
          <div
            style={{
              width: 24,
              height: 24,
              border: "3px solid var(--ypp-purple-200)",
              borderTopColor: "var(--ypp-purple-500)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {draft && !isLoading && (
        <div>
          {/* Overall suggestion */}
          {draft.overallComments && (
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 6,
                padding: "0.6rem 0.75rem",
                marginBottom: "0.75rem",
                fontSize: "0.82rem",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Overall Comments
              </div>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{draft.overallComments}</p>
            </div>
          )}

          {/* Per-goal suggestions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {goals.map((g) => {
              const comment = draft.perGoalComments?.[g.id];
              const rating = draft.perGoalSuggestedRating?.[g.id];
              const ratingMeta = rating ? RATING_LABELS[rating] : null;
              const applied = appliedGoals.has(g.id);

              return (
                <div
                  key={g.id}
                  style={{
                    background: "var(--surface)",
                    borderRadius: 6,
                    padding: "0.6rem 0.75rem",
                    border: applied ? "1px solid var(--success, #22c55e)" : "1px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{g.title}</div>
                      {ratingMeta && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 3,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: ratingMeta.bg,
                            color: ratingMeta.color,
                            fontSize: "0.72rem",
                            fontWeight: 600,
                          }}
                        >
                          {ratingMeta.label}
                        </span>
                      )}
                      {comment && (
                        <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.45 }}>
                          {comment.length > 100 ? comment.slice(0, 100) + "…" : comment}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => applyGoal(g.id)}
                      disabled={applied}
                      style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: applied ? "var(--success, #22c55e)" : "var(--surface)",
                        color: applied ? "#fff" : "var(--text)",
                        cursor: applied ? "default" : "pointer",
                        fontSize: "0.75rem",
                        flexShrink: 0,
                      }}
                    >
                      {applied ? "✓" : "Apply"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={applyAll} className="button primary" style={{ flex: 1, justifyContent: "center", fontSize: "0.82rem" }}>
              Apply all
            </button>
            <button
              onClick={() => { setDraft(null); setAppliedGoals(new Set()); }}
              className="button ghost"
              style={{ fontSize: "0.82rem" }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
