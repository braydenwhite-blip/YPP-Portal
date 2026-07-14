"use client";

import { useState, useTransition } from "react";

import { Button, ButtonLink } from "@/components/ui-v2";
import { shareProgressUpdateInPortal } from "@/lib/mentorship/progress-update-actions";

/**
 * Download PDF + share inside the portal (copy links / notify mentee or chair).
 */
export function ShareProgressUpdateControls({
  personId,
  reviewId,
  monthKey,
  canNotifyMentee = false,
  canNotifyChair = false,
  menteeFirstName = "them",
  compact = false,
}: {
  personId: string;
  reviewId: string;
  monthKey: string;
  canNotifyMentee?: boolean;
  canNotifyChair?: boolean;
  menteeFirstName?: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pdfPath = `/mentorship/people/${personId}/monthly-update/print?reviewId=${encodeURIComponent(reviewId)}&month=${encodeURIComponent(monthKey)}`;
  const portalPath = `/mentorship/people/${personId}?section=progress`;

  async function absoluteUrl(path: string) {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }

  async function copy(path: string, label: string) {
    setError(null);
    try {
      const url = await absoluteUrl(path);
      await navigator.clipboard.writeText(url);
      setMessage(`${label} copied`);
    } catch {
      setError("Could not copy — select the link manually.");
    }
  }

  function notify(audience: "mentee" | "chair") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await shareProgressUpdateInPortal({
          reviewId,
          menteeId: personId,
          audience,
        });
        setMessage(
          audience === "mentee"
            ? `Shared with ${menteeFirstName} in the portal`
            : "Shared with the chair in the portal"
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not share.");
      }
    });
  }

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={pdfPath} variant="secondary" size="sm">
          Download PDF
        </ButtonLink>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => copy(pdfPath, "PDF link")}
          disabled={pending}
        >
          Copy PDF link
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => copy(portalPath, "Portal link")}
          disabled={pending}
        >
          Copy portal link
        </Button>
        {canNotifyMentee ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => notify("mentee")}
            loading={pending}
          >
            Share with {menteeFirstName}
          </Button>
        ) : null}
        {canNotifyChair ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => notify("chair")}
            loading={pending}
          >
            Share with chair
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className="m-0 text-[12.5px] font-medium text-complete-700">{message}</p>
      ) : null}
      {error ? (
        <p className="m-0 text-[12.5px] font-medium text-danger-700">{error}</p>
      ) : null}
    </div>
  );
}
