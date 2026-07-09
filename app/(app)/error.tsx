"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";
import { classifyError } from "@/lib/error-classifier";

const colorMap = {
  red: {
    badge: "bg-red-100 text-red-800",
    details: "bg-red-50 border-red-200 text-red-900",
  },
  blue: {
    badge: "bg-blue-100 text-blue-800",
    details: "bg-blue-50 border-blue-200 text-blue-900",
  },
  orange: {
    badge: "bg-orange-100 text-orange-800",
    details: "bg-orange-50 border-orange-200 text-orange-900",
  },
  amber: {
    badge: "bg-amber-100 text-amber-800",
    details: "bg-amber-50 border-amber-200 text-amber-900",
  },
  yellow: {
    badge: "bg-yellow-100 text-yellow-800",
    details: "bg-yellow-50 border-yellow-200 text-yellow-900",
  },
  gray: {
    badge: "bg-gray-100 text-gray-800",
    details: "bg-gray-50 border-gray-200 text-gray-900",
  },
};

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const meta = classifyError(error);
  const colors = colorMap[meta.color];

  useEffect(() => {
    reportClientError("app-error-boundary", error, { kind: meta.kind });
  }, [error, meta.kind]);

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-5">
      <div className="max-w-2xl w-full text-center">
        <div className="text-6xl mb-4">{meta.icon}</div>

        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-3 ${colors.badge}`}
        >
          {meta.label}
        </span>

        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {meta.heading}
        </h2>
        <p className="text-gray-600 mb-4">{meta.description}</p>

        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">
            Reference: {error.digest}
          </p>
        )}

        {process.env.NODE_ENV === "development" && (
          <details
            className={`mt-2 mb-6 p-4 border rounded-lg text-left ${colors.details}`}
          >
            <summary className="cursor-pointer font-semibold mb-2">
              Error Details (dev only)
            </summary>
            <pre className="text-xs overflow-auto whitespace-pre-wrap">
              {error.name}: {error.message}
              {"\n\n"}
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center">
          {meta.retryable && (
            <button
              onClick={reset}
              className="px-6 py-3 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors"
            >
              Try Again
            </button>
          )}
          {meta.kind === "auth" && (
            <a
              href="/api/auth/signin"
              className="px-6 py-3 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition-colors"
            >
              Sign In
            </a>
          )}
          <a
            href="/"
            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-full font-semibold hover:bg-gray-300 transition-colors"
          >
            Go to Dashboard
          </a>
          {meta.kind === "not_found" && (
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-gray-200 text-gray-900 rounded-full font-semibold hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
