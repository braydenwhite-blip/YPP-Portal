"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * App Error Boundary
 *
 * Catches and handles errors within the authenticated application pages.
 * Logs errors to structured logging for monitoring.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to structured logging
    logger.error(
      {
        err: error,
        digest: error.digest,
        errorBoundary: "app",
      },
      "App error boundary caught error"
    );
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-5">
      <div className="max-w-2xl w-full text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-6">
          We've been notified and are looking into it. Please try again or
          return to the dashboard.
        </p>

        {process.env.NODE_ENV === "development" && (
          <details className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
            <summary className="cursor-pointer font-semibold mb-2">
              Error Details (Development Only)
            </summary>
            <pre className="text-xs overflow-auto text-red-900 whitespace-pre-wrap">
              {error.message}
              {"\n\n"}
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-6 py-3 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-full font-semibold hover:bg-gray-300 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
