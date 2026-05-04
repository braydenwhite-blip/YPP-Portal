"use client";

/**
 * "Promote to Full Instructor" admin action.
 *
 * Visible only when the applicant's `instructorSubtype` is SUMMER_WORKSHOP.
 * Opens a confirmation modal listing outstanding requirements (e.g. LDS)
 * before promoting. History is preserved server-side; this UI only triggers
 * the action and shows the requirements summary (plan §9, §10).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { promoteToFullInstructor } from "@/lib/summer-workshop-actions";
import type { PromotionEligibility } from "@/lib/summer-workshop";

interface PromoteToFullInstructorButtonProps {
  applicationId: string;
  applicantName: string;
  promotionEligibility?: PromotionEligibility | null;
}

export default function PromoteToFullInstructorButton({
  applicationId,
  applicantName,
  promotionEligibility,
}: PromoteToFullInstructorButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const outstanding = promotionEligibility?.outstandingRequirements ?? [
    "Lesson Design Studio capstone",
  ];

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await promoteToFullInstructor(applicationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="button"
        onClick={() => setOpen(true)}
        style={{ background: "#6b21c8", color: "white" }}
      >
        Promote to Full Instructor
      </button>

      {open && (
        <>
          <div
            onClick={() => !isPending && setOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 100,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Promote to Full Instructor"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              width: "min(520px, 92vw)",
              zIndex: 101,
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
              Promote to Full Instructor
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.55 }}>
              Promote <strong>{applicantName}</strong> from Summer Workshop Instructor to
              Standard Instructor. History (ratings, notes, interview reviews) is preserved.
            </p>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              <strong>Outstanding requirements</strong> — these become follow-ups on the
              standard Instructor profile after promotion. They are not waived.
              {outstanding.length > 0 ? (
                <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                  {outstanding.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: "8px 0 0", fontStyle: "italic" }}>None recorded.</p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                style={{
                  fontSize: 13,
                  color: "#991b1b",
                  background: "#fee2e2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "8px 10px",
                  margin: "0 0 12px",
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button"
                onClick={onConfirm}
                disabled={isPending}
                style={{ background: "#6b21c8", color: "white" }}
              >
                {isPending ? "Promoting…" : "Confirm Promotion"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
