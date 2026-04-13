"use client";

import { MentorshipReviewStatus, ProgressStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FieldLabel } from "@/components/field-help";
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
  status: MentorshipReviewStatus;
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
  const isReturnedForEdits = existingReview?.status === "RETURNED";
  const submitLabel = isReturnedForEdits
    ? "Resubmit For Approval"
    : requiresChairApproval || escalateToChair
      ? "Submit To Chair For Approval"
      : "Publish Monthly Review";

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
          {isReturnedForEdits
            ? "This draft was returned for edits. Step 1: strengthen the evidence and comments below. Step 2: update the student-facing summary. Step 3: resubmit it for approval."
            : requiresChairApproval
            ? "Step 1: review each goal. Step 2: write the student-facing summary. Step 3: submit this review to the review chair for approval."
            : "Step 1: review each goal. Step 2: write the student-facing summary. Step 3: publish this review directly unless you choose to escalate it to chair review."}
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

      <div className="section-title">Evidence From This Month</div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Start with the evidence. Rate each goal and explain the month in concrete terms before writing the final summary.
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
            <FieldLabel
              label="Goal Comments"
              help={{
                title: "Goal Comments",
                guidance:
                  "Use this box to explain why you chose the goal rating and what happened during the month.",
                example:
                  "Student finished the outline, asked for help on examples, and is ready to draft the final version next month.",
              }}
            />
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
          <div className="section-title">What The Mentee Will See</div>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
            These fields become the readable version of the review after approval.
          </p>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel
              label="Overall summary"
              help={{
                title: "Overall Summary",
                guidance:
                  "This is the plain-language story of the month. It should describe how the mentee is doing overall.",
                example:
                  "Steady month with clear follow-through on the main project goal, but still needs help turning ideas into a finished deliverable.",
              }}
            />
          </div>
          <textarea
            value={overallComments}
            onChange={(event) => setOverallComments(event.target.value)}
            className="input"
            rows={4}
            placeholder="Summarize the month in plain language."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <div style={{ marginBottom: 16 }}>
            <FieldLabel
              label="Strengths to keep building"
              help={{
                title: "Strengths To Keep Building",
                guidance:
                  "Call out the behaviors, habits, or results the mentee should keep doing.",
                example:
                  "Strong attendance, came prepared to sessions, and used feedback quickly.",
              }}
            />
          </div>
          <textarea
            value={strengths}
            onChange={(event) => setStrengths(event.target.value)}
            className="input"
            rows={4}
            placeholder="Call out strengths and positive momentum."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <FieldLabel
            label="Focus for next month"
            help={{
              title: "Focus For Next Month",
              guidance:
                "Use this to name the most important thing the mentee should change or improve next.",
              example:
                "Break the project into smaller weekly pieces and ask for feedback before the final draft.",
            }}
          />
          <textarea
            value={focusAreas}
            onChange={(event) => setFocusAreas(event.target.value)}
            className="input"
            rows={4}
            placeholder="What should the mentee focus on next?"
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <div style={{ marginBottom: 8 }}>
            <FieldLabel
              label="Next-month plan"
              help={{
                title: "Next-Month Plan",
                guidance:
                  "This is the forward-looking plan that turns the review into concrete action for the next month.",
                example:
                  "Finish draft two, meet once for feedback, and submit the final version before the next review window.",
              }}
            />
          </div>
          <textarea
            value={nextMonthPlan}
            onChange={(event) => setNextMonthPlan(event.target.value)}
            className="input"
            rows={5}
            placeholder="List the high-level objectives, next steps, and timeline for next month."
            style={{ marginTop: 6 }}
          />
        </div>

        <div className="card">
          <div className="section-title">Internal Review Notes</div>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
            These notes stay inside the approval workflow and help reviewers understand the decision.
          </p>

          <div style={{ marginBottom: 16 }}>
            <FieldLabel
              label="Collaboration and communication"
              help={{
                title: "Collaboration & Communication Notes",
                guidance:
                  "This is for patterns the chair should know about when they review the mentee's readiness and consistency.",
                example:
                  "Communicates well in sessions but still needs reminders to respond to follow-up messages on time.",
              }}
            />
          </div>
          <textarea
            value={collaborationNotes}
            onChange={(event) => setCollaborationNotes(event.target.value)}
            className="input"
            rows={4}
            placeholder="Summarize peer collaboration feedback and communication patterns."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <div style={{ marginBottom: 16 }}>
            <FieldLabel
              label="Readiness for promotion or added responsibility"
              help={{
                title: "Promotion Readiness",
                guidance:
                  "Use this field to say whether the mentee looks ready for the next level, role, or milestone and what conditions still need to be met.",
                example:
                  "Almost ready for promotion once the student shows independent follow-through for one more month.",
              }}
            />
          </div>
          <textarea
            value={promotionReadiness}
            onChange={(event) => setPromotionReadiness(event.target.value)}
            className="input"
            rows={3}
            placeholder="Describe promotion readiness and any conditions."
            style={{ marginTop: 6, marginBottom: 16 }}
          />

          <div style={{ marginBottom: 16 }}>
            <FieldLabel
              label="Character & Culture Points"
              help={{
                title: "Character & Culture Points",
                guidance:
                  "This is the number score for character and culture contributions during the month.",
                example:
                  "Add points when the mentee models helpfulness, responsibility, or community values in visible ways.",
              }}
            />
          </div>
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

          <FieldLabel
            label="Internal notes for reviewers only"
            help={{
              title: "Internal Mentor Notes",
              guidance:
                "These notes are for internal reviewers only. Use them for context you would not phrase directly in the mentee-facing summary.",
              example:
                "Needs extra structure from adults right now even though public-facing progress looks steady.",
            }}
          />
          <textarea
            value={mentorInternalNotes}
            onChange={(event) => setMentorInternalNotes(event.target.value)}
            className="input"
            rows={4}
            placeholder="Internal notes for chair review only."
            style={{ marginTop: 6 }}
          />
        </div>
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
          {isSubmitting ? "Submitting..." : submitLabel}
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
          The mentee sees the approved summary, plan, and goal ratings. Internal review notes stay in the approval workflow.
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Purple scale key: {PROGRESS_STATUS_META.ABOVE_AND_BEYOND.label}
        </span>
      </div>
    </form>
  );
}
