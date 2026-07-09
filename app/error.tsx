"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";
import { classifyError } from "@/lib/error-classifier";

const palette = {
  red:    { badge: "#fee2e2", badgeText: "#991b1b", detailsBg: "#fef2f2", detailsBorder: "#fecaca", detailsText: "#7f1d1d" },
  blue:   { badge: "#dbeafe", badgeText: "#1e40af", detailsBg: "#eff6ff", detailsBorder: "#bfdbfe", detailsText: "#1e3a8a" },
  orange: { badge: "#fed7aa", badgeText: "#9a3412", detailsBg: "#fff7ed", detailsBorder: "#fdba74", detailsText: "#7c2d12" },
  amber:  { badge: "#fef3c7", badgeText: "#92400e", detailsBg: "#fffbeb", detailsBorder: "#fde68a", detailsText: "#78350f" },
  yellow: { badge: "#fef9c3", badgeText: "#854d0e", detailsBg: "#fefce8", detailsBorder: "#fef08a", detailsText: "#713f12" },
  gray:   { badge: "#f3f4f6", badgeText: "#374151", detailsBg: "#f9fafb", detailsBorder: "#d1d5db", detailsText: "#1f2937" },
};

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const meta = classifyError(error);
  const p = palette[meta.color];

  useEffect(() => {
    reportClientError("root-error-boundary", error, { kind: meta.kind });
  }, [error, meta.kind]);

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
          <div style={{ maxWidth: "600px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>{meta.icon}</div>

            <span
              style={{
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: "9999px",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "12px",
                background: p.badge,
                color: p.badgeText,
              }}
            >
              {meta.label}
            </span>

            <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1c1917", marginBottom: "8px" }}>
              {meta.heading}
            </h1>
            <p style={{ fontSize: "16px", color: "#78716c", marginBottom: "16px" }}>
              {meta.description}
            </p>

            {error.digest && (
              <p style={{ fontSize: "12px", color: "#a8a29e", fontFamily: "monospace", marginBottom: "24px" }}>
                Reference: {error.digest}
              </p>
            )}

            {process.env.NODE_ENV === "development" && (
              <details
                style={{
                  marginBottom: "24px",
                  padding: "16px",
                  background: p.detailsBg,
                  border: `1px solid ${p.detailsBorder}`,
                  borderRadius: "8px",
                  textAlign: "left",
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: "8px" }}>
                  Error Details (dev only)
                </summary>
                <pre style={{ fontSize: "12px", overflow: "auto", color: p.detailsText, whiteSpace: "pre-wrap" }}>
                  {error.name}: {error.message}
                  {"\n\n"}
                  {error.stack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              {meta.retryable && (
                <button
                  onClick={reset}
                  style={{
                    padding: "12px 24px",
                    background: "#6b21c8",
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
              )}
              {meta.kind === "auth" && (
                <button
                  onClick={() => (window.location.href = "/api/auth/signin")}
                  style={{
                    padding: "12px 24px",
                    background: "#6b21c8",
                    color: "white",
                    border: "none",
                    borderRadius: "9999px",
                    fontSize: "16px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Sign In
                </button>
              )}
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
              {meta.kind === "not_found" && (
                <button
                  onClick={() => window.history.back()}
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
                  Go Back
                </button>
              )}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
