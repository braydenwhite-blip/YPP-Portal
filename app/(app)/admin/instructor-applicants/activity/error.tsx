"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";

export default function ActivityFeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError("activity-feed-error", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-5">
      <div className="max-w-lg w-full text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Could not load the activity feed. Try reloading.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors"
          >
            Reload
          </button>
          <a
            href="/admin/instructor-applicants/chair-queue"
            className="px-5 py-2.5 bg-gray-200 text-gray-900 rounded-full text-sm font-semibold hover:bg-gray-300 transition-colors"
          >
            Back to queue
          </a>
        </div>
      </div>
    </div>
  );
}
