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
import { Button, BannerV2 } from "@/components/ui-v2";

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
      <Button variant="primary" onClick={() => setOpen(true)}>
        Promote to Full Instructor
      </Button>

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
              Full Instructor based on demonstrated readiness and leadership. History
              (ratings, notes, interview reviews) is preserved on the same record.
            </p>

            <BannerV2 tone="warning" className="mb-4 items-start">
              <span>
                <strong>Outstanding requirements</strong> — these become
                follow-ups on the standard Instructor profile after promotion.
                They are not waived.
              </span>
              {outstanding.length > 0 ? (
                <ul className="mt-2 ml-[18px] list-disc">
                  {outstanding.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 italic">None recorded.</p>
              )}
            </BannerV2>

            {error && (
              <BannerV2 tone="danger" role="alert" className="mb-3">
                {error}
              </BannerV2>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={onConfirm} loading={isPending}>
                {isPending ? "Promoting…" : "Confirm Promotion"}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
