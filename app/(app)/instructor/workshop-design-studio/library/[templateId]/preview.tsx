"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectWorkshopTemplate } from "@/lib/workshop-proposal-actions";

type TemplatePreviewSelectProps = {
  templateId: string;
  isCurrentlySelected: boolean;
  editable: boolean;
  isReviewerPreview: boolean;
};

export function TemplatePreviewSelect({
  templateId,
  isCurrentlySelected,
  editable,
  isReviewerPreview,
}: TemplatePreviewSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSelect() {
    if (!editable || isReviewerPreview) return;
    setError(null);
    const fd = new FormData();
    fd.set("templateId", templateId);
    startTransition(async () => {
      try {
        await selectWorkshopTemplate(fd);
        router.push("/instructor/workshop-design-studio/review");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not pick this workshop."
        );
      }
    });
  }

  if (isReviewerPreview) {
    return (
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Reviewer preview</h4>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          Applicants would pick this workshop here. Use the admin reviews page
          to score real submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h4 style={{ marginTop: 0 }}>
        {isCurrentlySelected ? "Already selected" : "Use this workshop"}
      </h4>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        Picking this workshop sets it as your submission. You&rsquo;ll answer
        four reflection questions on the next page.
      </p>
      {isCurrentlySelected ? (
        <Link
          href="/instructor/workshop-design-studio/review"
          className="button"
          style={{ display: "block", textAlign: "center", textDecoration: "none" }}
        >
          Open reflection &amp; submit
        </Link>
      ) : (
        <button
          type="button"
          className="button"
          style={{ width: "100%" }}
          disabled={!editable || isPending}
          onClick={handleSelect}
        >
          {!editable
            ? "Locked while in review"
            : isPending
              ? "Picking…"
              : "Pick this workshop"}
        </button>
      )}
      {error ? (
        <p
          role="alert"
          style={{
            margin: "10px 0 0",
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
