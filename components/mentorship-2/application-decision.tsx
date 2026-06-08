"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { reviewMentorshipApplication } from "@/lib/mentorship-2/application-actions";
import {
  canTransitionApplication,
  type MentorshipApplicationStatus,
} from "@/lib/mentorship-2/constants";

/**
 * Application-level decisions that sit alongside the matching flow. Approving a
 * recommendation is what MATCHES an application; this control only covers the
 * other outcomes (mark under review, decline) via the M1 review action.
 */
export function ApplicationDecision({
  applicationId,
  status,
}: {
  applicationId: string;
  status: MentorshipApplicationStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function review(next: MentorshipApplicationStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await reviewMentorshipApplication({
          applicationId,
          status: next,
          reviewNotes: note.trim() || undefined,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update application.");
      }
    });
  }

  const canReview = canTransitionApplication(status, "UNDER_REVIEW");
  const canDecline = canTransitionApplication(status, "DECLINED");

  return (
    <section className="card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 15 }}>Application decision</h2>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Approving a recommended mentor above matches this application. Use these
        only to move it into review or to decline it.
      </p>
      {error && (
        <p role="alert" style={{ color: "var(--color-danger, #c0392b)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Review note (optional)"
        maxLength={2000}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canReview && (
          <button
            type="button"
            className="button secondary small"
            disabled={isPending}
            onClick={() => review("UNDER_REVIEW")}
          >
            Mark under review
          </button>
        )}
        {canDecline && (
          <button
            type="button"
            className="button secondary small"
            disabled={isPending}
            onClick={() => review("DECLINED")}
          >
            Decline application
          </button>
        )}
      </div>
    </section>
  );
}
