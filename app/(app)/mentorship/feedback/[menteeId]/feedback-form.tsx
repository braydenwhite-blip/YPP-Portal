"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressStatus } from "@prisma/client";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  timetable: string | null;
  currentStatus: ProgressStatus | null;
}

interface FeedbackFormProps {
  menteeId: string;
  goals: Goal[];
  submitAction: (formData: FormData) => Promise<void>;
}

const STATUS_CONFIG = {
  BEHIND_SCHEDULE: {
    color: "#ef4444",
    label: "Behind schedule",
    description: "Incomplete/behind timetable schedule and no catch-up possible"
  },
  GETTING_STARTED: {
    color: "#eab308",
    label: "Getting started",
    description: "Incomplete/behind timetable schedule but catch-up possible"
  },
  ON_TRACK: {
    color: "#22c55e",
    label: "On track",
    description: "Complete/in line with timetable schedule in both quantity & quality"
  },
  ABOVE_AND_BEYOND: {
    color: "#3b82f6",
    label: "Above and beyond",
    description: "Exceeds goals in quantity & quality"
  }
};

export function FeedbackForm({ menteeId, goals, submitAction }: FeedbackFormProps) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, ProgressStatus>>(
    goals.reduce((acc, goal) => {
      acc[goal.id] = goal.currentStatus ?? "ON_TRACK";
      return acc;
    }, {} as Record<string, ProgressStatus>)
  );
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overallComments, setOverallComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("forUserId", menteeId);
      formData.append("overallComments", overallComments);

      goals.forEach((goal) => {
        formData.append(`goal_${goal.id}_status`, statuses[goal.id]);
        if (comments[goal.id]) {
          formData.append(`goal_${goal.id}_comments`, comments[goal.id]);
        }
      });

      await submitAction(formData);
      router.push(`/mentorship/mentees/${menteeId}`);
      router.refresh();
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="section-title">Progress Update</div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Select the progress status for each goal. Click on a status segment to select it.
      </p>

      {/* Progress Bar Legend */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginBottom: 24,
          padding: 16,
          background: "var(--surface-alt)",
          borderRadius: "var(--radius-md)"
        }}
      >
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} style={{ textAlign: "center" }}>
            <div
              style={{
                width: "100%",
                height: 8,
                backgroundColor: config.color,
                borderRadius: 4,
                marginBottom: 8
              }}
            />
            <div style={{ fontWeight: 700, fontSize: 11 }}>{config.label}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.3, marginTop: 4 }}>
              {config.description}
            </div>
          </div>
        ))}
      </div>

      {/* Goals */}
      {goals.map((goal, index) => (
        <div
          key={goal.id}
          style={{
            padding: 20,
            marginBottom: 16,
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <strong style={{ fontSize: 15 }}>
                Goal {index + 1}: {goal.title}
              </strong>
              {goal.timetable && (
                <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: 13 }}>
                  By {goal.timetable}
                </span>
              )}
              {goal.description && (
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>{goal.description}</p>
              )}
            </div>
          </div>

          {/* Progress Bar Selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {(Object.entries(STATUS_CONFIG) as [ProgressStatus, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatuses((prev) => ({ ...prev, [goal.id]: key }))}
                    style={{
                      padding: "12px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s ease",
                      border: statuses[goal.id] === key ? "2px solid #0f172a" : "2px solid transparent",
                      backgroundColor: statuses[goal.id] === key ? config.color : `${config.color}33`,
                      color: "#0f172a"
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{config.label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Comments for this goal */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Comments (optional)</label>
            <textarea
              value={comments[goal.id] || ""}
              onChange={(e) => setComments((prev) => ({ ...prev, [goal.id]: e.target.value }))}
              className="input"
              rows={2}
              placeholder="Add specific feedback for this goal..."
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
      ))}

      {/* Overall Section */}
      <div
        style={{
          padding: 20,
          marginTop: 24,
          background: "#f0fdf4",
          borderRadius: "var(--radius-md)",
          border: "1px solid #bbf7d0"
        }}
      >
        <div className="section-title" style={{ color: "#166534" }}>
          Comments
        </div>
        <p style={{ fontSize: 13, color: "#166534", marginBottom: 12 }}>
          Overall impression of progress, what&apos;s worked well and recommended adjustments, relevant notes
          from/about colleagues, additional involvements in YPP (events, recruiting, etc.)
        </p>
        <textarea
          value={overallComments}
          onChange={(e) => setOverallComments(e.target.value)}
          className="input"
          rows={4}
          placeholder="Add overall feedback comments..."
        />
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Progress Feedback"}
        </button>
        <button
          type="button"
          className="button ghost"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
