"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";

function isStaleChunkError(error: Error): boolean {
  const message = error.message || "";
  const name = error.name || "";
  return (
    name === "ChunkLoadError" ||
    message.includes("Failed to load chunk") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch RSC payload")
  );
}

export default function InstructorApplicantsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError("instructor-applicants-error", error);
    // After a Turbopack/HMR cache wipe, old chunk URLs 404. A hard reload
    // picks up the new manifest instead of leaving the board stuck.
    if (isStaleChunkError(error) && typeof window !== "undefined") {
      const key = "ypp-instructor-board-chunk-reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-5">
      <div className="w-full max-w-lg text-center">
        <h2 className="mb-2 text-xl font-semibold text-ink">Something went wrong</h2>
        <p className="mb-2 text-sm text-ink-muted">
          {isStaleChunkError(error)
            ? "The page cache was out of date. Reload to pick up a fresh build."
            : "Could not load the Instructor Applicants board. Try reloading."}
        </p>
        {error.message && !isStaleChunkError(error) ? (
          <p className="mb-6 break-words font-mono text-[11px] text-ink-muted/80">
            {error.message}
          </p>
        ) : (
          <div className="mb-6" />
        )}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("ypp-instructor-board-chunk-reload");
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Reload
          </button>
          <a
            href="/admin/instructor-applicants"
            className="rounded-full bg-surface-soft px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-line"
          >
            Go back
          </a>
        </div>
      </div>
    </div>
  );
}
