"use client";

import { useState } from "react";
import { enrollInClass, dropClass } from "@/lib/class-management-actions";
import { useRouter } from "next/navigation";
import { requestPathwayFallback } from "@/lib/pathway-fallback-actions";
import type { PathwayFallbackRequestStatus } from "@prisma/client";

export function ClassDetailClient({
  offeringId,
  title,
  interestArea,
  learnerFitLabel,
  deliveryMode,
  isEnrolled,
  isWaitlisted,
  isFull,
  isInstructor,
  enrollmentOpen,
  waitlistPosition,
  requiresFallbackApproval,
  fallbackRequestStatus,
  canRequestFallback,
  fallbackPathwayId,
  fallbackPathwayStepId,
}: {
  offeringId: string;
  title: string;
  interestArea: string;
  learnerFitLabel: string;
  deliveryMode: string;
  isEnrolled: boolean;
  isWaitlisted: boolean;
  isFull: boolean;
  isInstructor: boolean;
  enrollmentOpen: boolean;
  waitlistPosition?: number;
  requiresFallbackApproval: boolean;
  fallbackRequestStatus: PathwayFallbackRequestStatus | null;
  canRequestFallback: boolean;
  fallbackPathwayId: string | null;
  fallbackPathwayStepId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: "error" | "info" | "waitlist";
  } | null>(null);
  const [showFitCheck, setShowFitCheck] = useState(false);
  const [fitGoal, setFitGoal] = useState("");
  const [fitNote, setFitNote] = useState("");
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [fitConfirmed, setFitConfirmed] = useState(false);

  async function runEnrollment() {
    setLoading(true);
    setFeedback(null);
    try {
      const result = await enrollInClass(offeringId);
      setShowFitCheck(false);
      if (result.waitlisted) {
        setFeedback({
          text: "Class is full. You have been added to the waitlist.",
          tone: "waitlist",
        });
      }
      router.refresh();
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : "Failed to enroll",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll() {
    setFeedback(null);
    setShowFitCheck(true);
  }

  async function handleDrop() {
    if (!confirm("Are you sure you want to drop this class?")) return;
    setLoading(true);
    setFeedback(null);
    try {
      await dropClass(offeringId);
      router.refresh();
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : "Failed to drop class",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleFallbackRequest() {
    if (!fallbackPathwayId || !fallbackPathwayStepId) {
      setFeedback({
        text: "This class needs a linked pathway step before partner-chapter access can be requested.",
        tone: "error",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const result = await requestPathwayFallback({
        pathwayId: fallbackPathwayId,
        pathwayStepId: fallbackPathwayStepId,
        targetOfferingId: offeringId,
      });

      if (result.alreadyExists) {
        setFeedback({
          text: "Your access request is already pending or approved.",
          tone: "info",
        });
      } else {
        setFeedback({
          text: "Partner-chapter access requested. You can keep exploring alternatives while it is reviewed.",
          tone: "info",
        });
      }
      router.refresh();
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : "Failed to request access",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  if (isInstructor) {
    return (
      <div style={{ padding: "8px 16px", background: "var(--ypp-purple-50)", borderRadius: 8, fontSize: 13, color: "var(--ypp-purple)" }}>
        You are the instructor
      </div>
    );
  }

  return (
    <div>
      {feedback && (
        <div style={{
          padding: "8px 12px",
          background:
            feedback.tone === "waitlist"
              ? "#fffbeb"
              : feedback.tone === "info"
                ? "#eff6ff"
                : "#fef2f2",
          color:
            feedback.tone === "waitlist"
              ? "#b45309"
              : feedback.tone === "info"
                ? "#1d4ed8"
                : "#dc2626",
          borderRadius: 8,
          marginBottom: 8,
          fontSize: 13,
        }}>
          {feedback.text}
        </div>
      )}

      {isEnrolled ? (
        <div>
          <div style={{
            padding: "8px 16px",
            background: "#f0fdf4",
            color: "#16a34a",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 8,
            fontWeight: 600,
          }}>
            Enrolled
          </div>
          <button
            onClick={handleDrop}
            className="button secondary"
            disabled={loading}
            style={{ fontSize: 13, width: "100%" }}
          >
            {loading ? "Processing..." : "Drop Class"}
          </button>
        </div>
      ) : isWaitlisted ? (
        <div>
          <div style={{
            padding: "8px 16px",
            background: "#fffbeb",
            color: "#f59e0b",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 8,
            fontWeight: 600,
          }}>
            {waitlistPosition ? `Waitlist #${waitlistPosition}` : "On Waitlist"}
          </div>
          <button
            onClick={handleDrop}
            className="button secondary"
            disabled={loading}
            style={{ fontSize: 13, width: "100%" }}
          >
            {loading ? "Processing..." : "Leave Waitlist"}
          </button>
        </div>
      ) : requiresFallbackApproval && fallbackRequestStatus !== "APPROVED" ? (
        <div>
          <div
            style={{
              padding: "8px 12px",
              background:
                fallbackRequestStatus === "PENDING" ? "#eff6ff" : "#fff7ed",
              color:
                fallbackRequestStatus === "PENDING" ? "#1d4ed8" : "#c2410c",
              borderRadius: 8,
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {fallbackRequestStatus === "PENDING"
              ? "Partner-chapter access request pending"
              : "Partner-chapter approval needed before enrollment"}
          </div>

          {canRequestFallback ? (
            <button
              onClick={handleFallbackRequest}
              className="button primary"
              disabled={loading || fallbackRequestStatus === "PENDING"}
              style={{ width: "100%" }}
            >
              {loading
                ? "Processing..."
                : fallbackRequestStatus === "PENDING"
                  ? "Request Pending"
                  : fallbackRequestStatus === "REJECTED"
                    ? "Request Access Again"
                    : "Request Partner-Chapter Access"}
            </button>
          ) : (
            <div
              style={{
                padding: "8px 12px",
                background: "var(--gray-100)",
                color: "var(--gray-700)",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              Start from the matching pathway or ask your chapter lead for help opening access.
            </div>
          )}
        </div>
      ) : enrollmentOpen ? (
        <div>
          {!showFitCheck ? (
            <button
              onClick={handleEnroll}
              className="button primary"
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading
                ? "Processing..."
                : isFull
                  ? "Join Waitlist"
                  : "Guided Fit Check"}
            </button>
          ) : (
            <div
              style={{
                textAlign: "left",
                padding: "12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface, #fff)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>Quick fit check</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                Take 20 seconds to confirm how <strong>{title}</strong> fits what you want to learn.
              </p>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  What do you want most from this class?
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    "Build a new skill I can use right away",
                    "Try something I have been curious about",
                    "Stay on track with my pathway",
                    "Create something I can share or show",
                  ].map((goal) => (
                    <label
                      key={goal}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="radio"
                        name="fit-goal"
                        checked={fitGoal === goal}
                        onChange={() => setFitGoal(goal)}
                      />
                      <span>{goal}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Optional note
                </label>
                <textarea
                  value={fitNote}
                  onChange={(event) => setFitNote(event.target.value)}
                  rows={2}
                  className="input"
                  placeholder={`Example: I want to explore ${interestArea.toLowerCase()} in a ${learnerFitLabel.toLowerCase()} setting.`}
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "start" }}>
                  <input
                    type="checkbox"
                    checked={scheduleConfirmed}
                    onChange={(event) => setScheduleConfirmed(event.target.checked)}
                  />
                  <span>The {deliveryMode.toLowerCase()} format and schedule work for me.</span>
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "start" }}>
                  <input
                    type="checkbox"
                    checked={fitConfirmed}
                    onChange={(event) => setFitConfirmed(event.target.checked)}
                  />
                  <span>This class matches what I want to explore right now.</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={() => setShowFitCheck(false)}
                  className="button secondary"
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  onClick={runEnrollment}
                  className="button primary"
                  disabled={loading || !fitGoal || !scheduleConfirmed || !fitConfirmed}
                  style={{ flex: 1 }}
                >
                  {loading
                    ? "Processing..."
                    : isFull
                      ? "Confirm Waitlist"
                      : "Confirm Enrollment"}
                </button>
              </div>

              {fitNote.trim().length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    background: "var(--gray-100)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  Personal goal: {fitNote.trim()}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: "8px 16px",
          background: "var(--gray-100)",
          color: "var(--gray-600)",
          borderRadius: 8,
          fontSize: 13,
        }}>
          Enrollment Closed
        </div>
      )}
    </div>
  );
}
