"use client";

import Link from "next/link";

export default function FinalReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-shell" style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, color: "var(--ink-default, #1a0533)" }}>
        We couldn&apos;t load the chair review cockpit.
      </h1>
      <p style={{ color: "var(--ink-muted, #6b5f7a)", maxWidth: 540 }}>
        {error.message}. Try again, or fall back to the legacy chair workspace.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" className="button" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/admin/instructor-applicants/chair-queue" className="button outline">
          Back to chair queue
        </Link>
      </div>
    </div>
  );
}
