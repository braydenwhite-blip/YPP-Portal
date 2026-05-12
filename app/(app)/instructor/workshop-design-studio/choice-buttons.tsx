"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseWorkshopPath } from "@/lib/workshop-proposal-actions";
import type { WorkshopProposalSourceType } from "@prisma/client";

type ChooseWorkshopPathButtonsProps = {
  currentSource: WorkshopProposalSourceType | null;
  path: WorkshopProposalSourceType;
  continueHref: string;
  /** True when the row is locked (in review, approved, rejected). */
  disabled?: boolean;
  /**
   * True when an admin/reviewer is previewing the applicant view. The action
   * intentionally throws for reviewers, but in production Next.js masks
   * that thrown message to the generic "Server Components render error"
   * string. We short-circuit on the client to avoid surfacing that.
   */
  isReviewerPreview?: boolean;
};

export function ChooseWorkshopPathButtons({
  currentSource,
  path,
  continueHref,
  disabled = false,
  isReviewerPreview = false,
}: ChooseWorkshopPathButtonsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCurrent = currentSource === path;

  function handleSelect() {
    if (disabled || isReviewerPreview) return;
    setError(null);
    const fd = new FormData();
    fd.set("sourceType", path);
    startTransition(async () => {
      try {
        await chooseWorkshopPath(fd);
        router.push(continueHref);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Could not switch paths.";
        // In production, Next.js masks server-action errors to a generic
        // digest string. Show the user something they can act on instead.
        setError(
          message.toLowerCase().includes("server components render")
            ? "Something went wrong while saving. Refresh the page and try again."
            : message
        );
      }
    });
  }

  // Reviewer preview: surface a clearly read-only state instead of a button
  // that would call a server action that intentionally throws for reviewers.
  if (isReviewerPreview) {
    return (
      <div style={{ marginTop: 8 }}>
        <span
          className="pill pill-small"
          style={{
            background: "#f5f3ff",
            color: "#5b21b6",
            border: "1px solid #c4b5fd",
            display: "inline-block",
            fontSize: 12,
          }}
        >
          Applicant action — preview only
        </span>
      </div>
    );
  }

  if (isCurrent) {
    return (
      <Link
        href={continueHref}
        className="button"
        style={{ marginTop: 8, textDecoration: "none", display: "inline-block" }}
        aria-disabled={disabled}
      >
        Continue
      </Link>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="button secondary"
        onClick={handleSelect}
        disabled={disabled || isPending}
      >
        {isPending ? "Switching…" : "Pick this path"}
      </button>
      {error ? (
        <p
          role="alert"
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "#dc2626",
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
