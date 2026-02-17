"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Root Error Boundary
 *
 * Catches and handles errors at the root application level.
 * Logs errors to structured logging for monitoring.
 */
export default function RootError({
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
        errorBoundary: "root",
      },
      "Root error boundary caught error"
    );
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "20px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}
            >
              ⚠️
            </div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: "#1c1917",
                marginBottom: "8px",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "16px",
                color: "#78716c",
                marginBottom: "24px",
              }}
            >
              We've been notified and are looking into it. Please try refreshing
              the page.
            </p>

            {process.env.NODE_ENV === "development" && (
              <details
                style={{
                  marginTop: "24px",
                  padding: "16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  textAlign: "left",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    fontSize: "12px",
                    overflow: "auto",
                    color: "#991b1b",
                  }}
                >
                  {error.message}
                  {"\n\n"}
                  {error.stack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
              <button
                onClick={reset}
                style={{
                  padding: "12px 24px",
                  background: "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: "9999px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  padding: "12px 24px",
                  background: "#e5e7eb",
                  color: "#1c1917",
                  border: "none",
                  borderRadius: "9999px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
