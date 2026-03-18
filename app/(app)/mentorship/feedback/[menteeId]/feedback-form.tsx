"use client";

import { ProgressStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProgressBarSelector } from "@/components/progress-bar";
import {
  calculateOverallProgress,
  PROGRESS_STATUS_META,
} from "@/lib/mentorship-review-helpers";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  timetable: string | null;
  currentStatus: ProgressStatus | null;
  currentComments: string | null;
}

interface ExistingReview {
  overallStatus: ProgressStatus | null;
  overallComments: string | null;
  strengths: string | null;
  focusAreas: string | null;
  collaborationNotes: string | null;
  promotionReadiness: string | null;
  nextMonthPlan: string | null;
  mentorInternalNotes: string | null;
  characterCulturePoints: number;
  goalRatings: Array<{
    goalId: string;
    status: ProgressStatus;
    comments: string | null;
  }>;
}

interface FeedbackFormProps {
  menteeId: string;
  month: string;
  goals: Goal[];
  existingReview: ExistingReview | null;
  requiresChairApproval: boolean;
  allowChairEscalation?: boolean;
  submitAction: (formData: FormData) => Promise<void>;
}

export function FeedbackForm({
  menteeId,
  month,
  goals,
  existingReview,
  requiresChairApproval,
  allowChairEscalation = false,
  submitAction,
}: FeedbackFormProps) {
  const router = useRouter();
  const existingGoalRatings = new Map(
    (existingReview?.goalRatings ?? []).map((rating) => [rating.goalId, rating])
  );

  const [goalStatuses, setGoalStatuses] = useState<Record<string, ProgressStatus>>(
    goals.reduce((acc, goal) => {
      acc[goal.id] =
        existingGoalRatings.get(goal.id)?.status ??
        goal.currentStatus ??
        "GETTING_STARTED";
      return acc;
    }, {} as Record<string, ProgressStatus>)
  );
  const [goalComments, setGoalComments] = useState<Record<string, string>>(
    goals.reduce((acc, goal) => {
      acc[goal.id] =
        existingGoalRatings.get(goal.id)?.comments ??
        goal.currentComments ??
        "";
      return acc;
    }, {} as Record<string, string>)
  );
  const [overallStatus, setOverallStatus] = useState<ProgressStatus>(
    existingReview?.overallStatus ??
      calculateOverallProgress(Object.values(goalStatuses)) ??
      "GETTING_STARTED"
  );
  const [overallComments, setOverallComments] = useState(
    existingReview?.overallComments ?? ""
  );
  const [strengths, setStrengths] = useState(existingReview?.strengths ?? "");
  const [focusAreas, setFocusAreas] = useState(existingReview?.focusAreas ?? "");
  const [collaborationNotes, setCollaborationNotes] = useState(
    existingReview?.collaborationNotes ?? ""
  );
  const [promotionReadiness, setPromotionReadiness] = useState(
    existingReview?.promotionReadiness ?? ""
  );
  const [nextMonthPlan, setNextMonthPlan] = useState(
    existingReview?.nextMonthPlan ?? ""
  );
  const [mentorInternalNotes, setMentorInternalNotes] = useState(
    existingReview?.mentorInternalNotes ?? ""
  );
  const [characterCulturePoints, setCharacterCulturePoints] = useState(
    existingReview?.characterCulturePoints ?? 0
  );
  const [escalateToChair, setEscalateToChair] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("forUserId", menteeId);
      formData.append("month", month);
      formData.append("overallStatus", overallStatus);
      formData.append("overallComments", overallComments);
      formData.append("strengths", strengths);
      formData.append("focusAreas", focusAreas);
      formData.append("collaborationNotes", collaborationNotes);
      formData.append("promotionReadiness", promotionReadiness);
      formData.append("nextMonthPlan", nextMonthPlan);
      formData.append("mentorInternalNotes", mentorInternalNotes);
      formData.append("characterCulturePoints", String(characterCulturePoints));
      formData.append("escalateToChair", String(escalateToChair));

      goals.forEach((goal) => {
        formData.append(`goal_${goal.id}_status`, goalStatuses[goal.id]);
        formData.append(`goal_${goal.id}_comments`, goalComments[goal.id] || "");
      });

      await submitAction(formData);
      router.push(`/mentorship/mentees/${menteeId}`);
      router.refresh();
    } catch (error) {
      console.error("Failed to submit monthly goal review:", error);
      alert("Failed to submit the monthly goal review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{
          padding: 16,
          marginBottom: 24,
          borderRadius: "var(--radius-md)",
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="section-title" style={{ marginBottom: 8 }}>
          Monthly Goal Review Workflow
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
          {requiresChairApproval
            ? "Step 1: review each goal. Step 2: write the mentor summary. Step 3: submit this review to the Mentor Committee Chair for approval."
            : "Step 1: review each goal. Step 2: write the mentor summary. Step 3: publish this review directly to the mentorship workspace unless you choose to escalate it to chair review."}
        </p>
        {allowChairEscalation && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={escalateToChair}
              onChange={(event) => setEscalateToChair(event.target.checked)}
            />
            Escalate this student review to chair approval
          </label>
        )}
      </div>

      <div className="section-title">Per-Goal Ratings</div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Rate each goal using the YPP Red / Yellow / Green / Purple scale.
      </p>

      {goals.map((goal, index) => (
        <div
          key={goal.id}
          style={{
            padding: 20,
            marginBottom: 16,
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: 15 }}>
              Goal {index + 1}: {goal.title}
            </strong>
            {goal.timetable && (
              <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: 13 }}>
                By {goal.timetable}
              </span>
            )}
            {goal.description && (
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                {goal.description}
              </p>
            )}
          </div>

          <ProgressBarSelector
            name={`goal_${goal.id}_status`}
            value={goalStatuses[goal.id]}
            onChange={(status) =>
              setGoalStatuses((prev) => ({
                ...prev,
                [goal.id]: status,
              }))
            }
            label="Goal Rating"
          />

          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Goal Comments
            </label>
            <textarea
              value={goalComments[goal.id] || ""}
              onChange={(event) =>
                setGoalComments((prev) => ({
                  ...prev,
                  [goal.id]: event.target.value,
                }))
              }
              className="input"
              rows={3}
              placeholder="Describe progress, blockers, wins, and next steps for this goal."
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
      ))}

      <div
        style={{
          padding: 20,
          marginTop: 24,
          background: "#faf5ff",
          borderRadius: "var(--radius-md)",
          border: "1px solid #d8b4fe",
        }}
      >
        <div className="section-title" style={{ color: "#6b21a8" }}>
          Overall Progress
        </div>
        <p style={{ fontSize: 13, color: "#6b21a8", marginBottom: 14 }}>
          Choose the overall monthly progress bar that best fits the full month.
        </p>
        <ProgressBarSelector
          name="overallStatus"
          value={overallStatus}
          onChange={setOverallStatus}
        />
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="section-title">Mentor Summary</div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            Overall Impression of Progress
          </label>
          <textarea
            value={overallComments}
            onChange={(event) => setOverallComments(event.target.value)}
            className="input"
            rows={4}
            placeholder="Summarize the month overall."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            Strengths / What Worked Well
          </label>
          <textarea
            value={strengths}
            onChange={(event) => setStrengths(event.target.value)}
            className="input"
            rows={4}
            placeholder="Call out strengths and positive momentum."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            Areas for Development / Recommended Adjustments
          </label>
          <textarea
            value={focusAreas}
            onChange={(event) => setFocusAreas(event.target.value)}
            className="input"
            rows={4}
            placeholder="What should change or improve next month?"
            style={{ marginTop: 6 }}
          />
        </div>

        <div className="card">
          <div className="section-title">Committee-Facing Notes</div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            Collaboration & Communication Notes
          </label>
          <textarea
            value={collaborationNotes}
            onChange={(event) => setCollaborationNotes(event.target.value)}
            className="input"
            rows={4}
            placeholder="Summarize peer collaboration feedback and communication patterns."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            Promotion Readiness
          </label>
          <textarea
            value={promotionReadiness}
            onChange={(event) => setPromotionReadiness(event.target.value)}
            className="input"
            rows={3}
            placeholder="Describe promotion readiness and any conditions."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            Character & Culture Points
          </label>
          <input
            type="number"
            min={0}
            value={characterCulturePoints}
            onChange={(event) =>
              setCharacterCulturePoints(Number(event.target.value) || 0)
            }
            className="input"
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
            Internal Mentor Notes
          </label>
          <textarea
            value={mentorInternalNotes}
            onChange={(event) => setMentorInternalNotes(event.target.value)}
            className="input"
            rows={4}
            placeholder="Internal notes for chair and committee review only."
            style={{ marginTop: 6 }}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Plan of Action For Next Month</div>
        <textarea
          value={nextMonthPlan}
          onChange={(event) => setNextMonthPlan(event.target.value)}
          className="input"
          rows={5}
          placeholder="List the high-level objectives, next month goals, and implementation plan."
        />
      </div>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit To Chair For Approval"}
        </button>
        <button
          type="button"
          className="button ghost"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Purple scale key: {PROGRESS_STATUS_META.ABOVE_AND_BEYOND.label}
        </span>
      </div>
    </form>
  );
}
