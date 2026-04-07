"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGoalReview } from "@/lib/goal-review-actions";

export interface GoalResponse {
  goal: { id: string; title: string; description: string | null };
  progressMade: string;
  objectiveAchieved: boolean;
  accomplishments: string;
  blockers: string | null;
  nextMonthPlans: string;
}

export interface ExistingRating {
  goalId: string;
  rating: string;
  comments: string | null;
}

interface Props {
  reflectionId: string;
  goalResponses: GoalResponse[];
  isQuarterly: boolean;
  cycleNumber: number;
  mentorshipId?: string;
  existingReview: {
    id: string;
    overallRating: string;
    overallComments: string;
    planOfAction: string;
    projectedFuturePath: string | null;
    promotionReadiness: string | null;
    bonusPoints: number;
    bonusReason: string | null;
    status: string;
    goalRatings: ExistingRating[];
    chairComments: string | null;
  } | null;
  isReadOnly: boolean;
}

const RATING_OPTIONS = [
  { value: "BEHIND_SCHEDULE", label: "Behind Schedule", color: "#ef4444", bg: "#fef2f2", description: "Behind timetable with no catch-up possible" },
  { value: "GETTING_STARTED", label: "Getting Started", color: "#d97706", bg: "#fffbeb", description: "Behind but catch-up is possible" },
  { value: "ACHIEVED", label: "Achieved", color: "#16a34a", bg: "#f0fdf4", description: "Completed in line with schedule" },
  { value: "ABOVE_AND_BEYOND", label: "Above & Beyond", color: "#7c3aed", bg: "#faf5ff", description: "Exceeds goals in quantity & quality" },
] as const;

type RatingValue = (typeof RATING_OPTIONS)[number]["value"];

function RatingSelector({
  value,
  onChange,
  disabled,
}: {
  value: RatingValue | "";
  onChange: (v: RatingValue) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
      {RATING_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "0.6rem 0.4rem",
              borderRadius: "var(--radius-sm)",
              border: selected ? `2px solid ${opt.color}` : "2px solid transparent",
              background: selected ? opt.bg : `${opt.color}18`,
              cursor: disabled ? "default" : "pointer",
              textAlign: "center",
              opacity: disabled && !selected ? 0.5 : 1,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "0.75rem", color: opt.color }}>{opt.label}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: "0.2rem", lineHeight: 1.3 }}>
              {opt.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SectionReflection({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        background: "var(--surface-alt)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        marginBottom: "0.5rem",
      }}
    >
      <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.3rem" }}>
        {label}
        {hint && <span style={{ fontWeight: 400 }}> — {hint}</span>}
      </p>
      <p style={{ fontSize: "0.88rem", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{value}</p>
    </div>
  );
}

export default function ReviewForm({
  reflectionId,
  goalResponses,
  isQuarterly,
  cycleNumber,
  mentorshipId,
  existingReview,
  isReadOnly,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [overallRating, setOverallRating] = useState<RatingValue | "">(
    (existingReview?.overallRating as RatingValue) ?? ""
  );
  const [overallComments, setOverallComments] = useState(existingReview?.overallComments ?? "");
  const [planOfAction, setPlanOfAction] = useState(existingReview?.planOfAction ?? "");
  const [projectedFuturePath, setProjectedFuturePath] = useState(existingReview?.projectedFuturePath ?? "");
  const [promotionReadiness, setPromotionReadiness] = useState(existingReview?.promotionReadiness ?? "");
  const [bonusPoints, setBonusPoints] = useState(existingReview?.bonusPoints ?? 0);
  const [bonusReason, setBonusReason] = useState(existingReview?.bonusReason ?? "");
  const [goalRatings, setGoalRatings] = useState<Record<string, RatingValue | "">>(
    Object.fromEntries(
      goalResponses.map((gr) => [
        gr.goal.id,
        ((existingReview?.goalRatings.find((r) => r.goalId === gr.goal.id)?.rating ?? "") as RatingValue | ""),
      ])
    )
  );
  const [goalComments, setGoalComments] = useState<Record<string, string>>(
    Object.fromEntries(
      goalResponses.map((gr) => [
        gr.goal.id,
        existingReview?.goalRatings.find((r) => r.goalId === gr.goal.id)?.comments ?? "",
      ])
    )
  );

  function handleSave(submitForApproval: boolean) {
    if (!overallRating) { setError("Please select an overall rating."); return; }
    if (!overallComments.trim()) { setError("Overall comments are required."); return; }
    if (!planOfAction.trim()) { setError("Plan of action is required."); return; }
    if (bonusPoints > 0 && !bonusReason.trim()) { setError("Please provide a reason for the bonus points."); return; }
    for (const gr of goalResponses) {
      if (!goalRatings[gr.goal.id]) { setError(`Please select a rating for: ${gr.goal.title}`); return; }
    }
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("reflectionId", reflectionId);
        formData.set("overallRating", overallRating);
        formData.set("overallComments", overallComments);
        formData.set("planOfAction", planOfAction);
        formData.set("projectedFuturePath", projectedFuturePath);
        formData.set("promotionReadiness", promotionReadiness);
        formData.set("bonusPoints", String(bonusPoints));
        formData.set("bonusReason", bonusReason);
        formData.set("submitForApproval", String(submitForApproval));
        goalResponses.forEach((gr) => {
          formData.append("goalIds", gr.goal.id);
          formData.set(`goal_${gr.goal.id}_rating`, goalRatings[gr.goal.id] ?? "");
          formData.set(`goal_${gr.goal.id}_comments`, goalComments[gr.goal.id] ?? "");
        });
        await saveGoalReview(formData);
        router.push("/mentorship-program/reviews");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save review");
      }
    });
  }

  const chairFeedback = existingReview?.chairComments;
  const isChangesRequested = existingReview?.status === "CHANGES_REQUESTED";

  return (
    <div>
      {/* Chair feedback banner */}
      {isChangesRequested && chairFeedback && (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "var(--radius-md)",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ fontWeight: 700, color: "#c2410c", marginBottom: "0.35rem" }}>
            ⚠ Chair Requested Changes
          </p>
          <p style={{ fontSize: "0.88rem", color: "var(--text)", margin: 0 }}>{chairFeedback}</p>
        </div>
      )}

      {goalResponses.length === 0 && (
        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
          }}
        >
          <p style={{ fontWeight: 700, marginBottom: "0.4rem" }}>No active goals for this cycle</p>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            This mentee did not have any active role-specific goals during this reflection cycle. Complete the
            review using the written reflection, your overall comments, and the plan of action below.
          </p>
        </div>
      )}

      {/* Per-goal section */}
      {goalResponses.map((gr, idx) => {
        const ratingVal = goalRatings[gr.goal.id];
        const selectedOpt = RATING_OPTIONS.find((o) => o.value === ratingVal);
        return (
          <div key={gr.goal.id} className="card" style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <p style={{ fontWeight: 700, margin: 0 }}>
                  Goal {idx + 1}: {gr.goal.title}
                </p>
                {gr.goal.description && (
                  <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.2rem 0 0" }}>
                    {gr.goal.description}
                  </p>
                )}
              </div>
              {selectedOpt && (
                <span
                  className="pill"
                  style={{ background: selectedOpt.bg, color: selectedOpt.color, flexShrink: 0 }}
                >
                  {selectedOpt.label}
                </span>
              )}
            </div>

            {/* Mentee's self-reflection for this goal */}
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "0.5rem" }}>
                Mentee's Reflection
              </p>
              <SectionReflection label="Progress Made" value={gr.progressMade} />
              <SectionReflection
                label="Objective"
                value={gr.objectiveAchieved ? "✓ Achieved this cycle" : "✗ Not yet achieved"}
              />
              <SectionReflection label="Accomplishments" value={gr.accomplishments} />
              {gr.blockers && <SectionReflection label="Blockers" value={gr.blockers} />}
              <SectionReflection label="Next Month's Plans" value={gr.nextMonthPlans} />
            </div>

            {/* Mentor rating */}
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "0.5rem" }}>
                Your Rating
              </p>
              <RatingSelector
                value={ratingVal ?? ""}
                onChange={(v) => setGoalRatings((prev) => ({ ...prev, [gr.goal.id]: v }))}
                disabled={isReadOnly}
              />
              {!isReadOnly && (
                <div style={{ marginTop: "0.75rem" }}>
                  <label style={{ fontWeight: 600, fontSize: "0.85rem" }}>Comments (optional)</label>
                  <textarea
                    value={goalComments[gr.goal.id] ?? ""}
                    onChange={(e) => setGoalComments((prev) => ({ ...prev, [gr.goal.id]: e.target.value }))}
                    rows={2}
                    placeholder="Specific feedback on this goal…"
                    style={{ width: "100%", marginTop: "0.4rem", resize: "vertical" }}
                  />
                </div>
              )}
              {isReadOnly && goalComments[gr.goal.id] && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.88rem", color: "var(--muted)" }}>
                  {goalComments[gr.goal.id]}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Overall review */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontWeight: 700, marginBottom: "1rem" }}>Overall Review</p>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Overall Rating</label>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            This drives the achievement point award. Choose based on the mentee's holistic performance.
          </p>
          <RatingSelector value={overallRating} onChange={setOverallRating} disabled={isReadOnly} />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>
            Overall Comments <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
            Overall impression, strengths, development areas, peer collaboration notes, YPP involvement
          </p>
          <textarea
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
            rows={4}
            disabled={isReadOnly}
            placeholder="Share your overall assessment of the mentee's performance this cycle…"
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>
            Plan of Action <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
            High-level objectives and action items for next month
          </p>
          <textarea
            value={planOfAction}
            onChange={(e) => setPlanOfAction(e.target.value)}
            rows={3}
            disabled={isReadOnly}
            placeholder="Describe the plan and priorities for next month…"
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>

        {/* Character & Culture Bonus Points */}
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "#fefce8",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-sm)",
            marginBottom: isQuarterly ? "1.25rem" : 0,
          }}
        >
          <p style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.3rem", color: "#92400e" }}>
            Character & Culture Bonus
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
            Award 0–25 bonus points for exceptional community involvement, character, or cultural contribution.
          </p>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            <div style={{ width: "100px", flexShrink: 0 }}>
              <label style={{ fontWeight: 600, fontSize: "0.82rem" }}>Points (0–25)</label>
              <input
                type="number"
                min={0}
                max={25}
                value={bonusPoints}
                onChange={(e) => setBonusPoints(Math.max(0, Math.min(25, parseInt(e.target.value, 10) || 0)))}
                disabled={isReadOnly}
                style={{ width: "100%", marginTop: "0.3rem" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                Reason {bonusPoints > 0 && <span style={{ color: "#ef4444" }}>*</span>}
              </label>
              <textarea
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                rows={2}
                disabled={isReadOnly}
                placeholder="Describe the community involvement or character trait being recognized…"
                style={{ width: "100%", marginTop: "0.3rem", resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        {isQuarterly && (
          <>
            <div
              style={{
                padding: "0.6rem 0.9rem",
                background: "var(--ypp-purple-50)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "1rem",
                fontSize: "0.82rem",
                color: "var(--ypp-purple-700)",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Quarterly Fields — completed by full Mentor Committee</span>
              {existingReview?.status === "APPROVED" && (
                <a
                  href={`/mentorship-program/quarterly/${existingReview.id}`}
                  className="button primary small"
                  style={{ fontSize: "0.72rem" }}
                >
                  Quarterly Dashboard + Stakeholder Feedback →
                </a>
              )}
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Projected Future Path (optional)</label>
              <textarea
                value={projectedFuturePath}
                onChange={(e) => setProjectedFuturePath(e.target.value)}
                rows={2}
                disabled={isReadOnly}
                placeholder="Where do you see this mentee heading? Future roles, specializations…"
                style={{ width: "100%", marginTop: "0.4rem", resize: "vertical" }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Promotion Readiness (optional)</label>
              <textarea
                value={promotionReadiness}
                onChange={(e) => setPromotionReadiness(e.target.value)}
                rows={2}
                disabled={isReadOnly}
                placeholder="Is the mentee ready for promotion or expanded responsibilities?"
                style={{ width: "100%", marginTop: "0.4rem", resize: "vertical" }}
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--color-error)", fontWeight: 600, marginBottom: "1rem" }}>{error}</p>
      )}

      {!isReadOnly && (
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            className="button primary"
            disabled={isPending}
            onClick={() => handleSave(true)}
          >
            {isPending ? "Submitting…" : "Submit for Chair Approval"}
          </button>
          <button
            className="button outline"
            disabled={isPending}
            onClick={() => handleSave(false)}
          >
            Save Draft
          </button>
          <button className="button ghost" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
