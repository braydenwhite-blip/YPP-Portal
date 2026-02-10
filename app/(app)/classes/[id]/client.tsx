"use client";

import { useState } from "react";
import { enrollInClass, dropClass } from "@/lib/class-management-actions";
import { useRouter } from "next/navigation";

export function ClassDetailClient({
  offeringId,
  isEnrolled,
  isWaitlisted,
  isFull,
  isInstructor,
  enrollmentOpen,
}: {
  offeringId: string;
  isEnrolled: boolean;
  isWaitlisted: boolean;
  isFull: boolean;
  isInstructor: boolean;
  enrollmentOpen: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEnroll() {
    setLoading(true);
    setError("");
    try {
      const result = await enrollInClass(offeringId);
      if (result.waitlisted) {
        setError("Class is full. You have been added to the waitlist.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll");
    } finally {
      setLoading(false);
    }
  }

  async function handleDrop() {
    if (!confirm("Are you sure you want to drop this class?")) return;
    setLoading(true);
    setError("");
    try {
      await dropClass(offeringId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to drop class");
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
      {error && (
        <div style={{
          padding: "8px 12px",
          background: error.includes("waitlist") ? "#fffbeb" : "#fef2f2",
          color: error.includes("waitlist") ? "#f59e0b" : "#dc2626",
          borderRadius: 8,
          marginBottom: 8,
          fontSize: 13,
        }}>
          {error}
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
            On Waitlist
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
      ) : enrollmentOpen ? (
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
              : "Enroll Now"
          }
        </button>
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
