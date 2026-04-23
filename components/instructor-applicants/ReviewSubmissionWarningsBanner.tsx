"use client";

import { useMemo, useState } from "react";

interface Props {
  notice?: string | null;
  warningsJson?: string | null;
}

const SUBMIT_NOTICES = new Set([
  "application-review-submitted",
  "interview-review-submitted",
]);

const SAVE_NOTICES = new Set([
  "application-review-saved",
  "interview-review-saved",
]);

function parseWarnings(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry)).filter(Boolean);
  } catch {
    return [];
  }
}

export default function ReviewSubmissionWarningsBanner({ notice, warningsJson }: Props) {
  const warnings = useMemo(() => parseWarnings(warningsJson ?? null), [warningsJson]);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isSubmit = notice ? SUBMIT_NOTICES.has(notice) : false;
  const isSave = notice ? SAVE_NOTICES.has(notice) : false;

  if (!isSubmit && !isSave && warnings.length === 0) return null;

  const hasWarnings = warnings.length > 0;
  const color = hasWarnings ? "#92400e" : "#166534";
  const background = hasWarnings ? "#fffbeb" : "#f0fdf4";
  const border = hasWarnings ? "#fde68a" : "#bbf7d0";

  const title = hasWarnings
    ? isSubmit
      ? "Review submitted — but some fields are incomplete"
      : "Draft saved — some fields are incomplete"
    : isSubmit
      ? "Review submitted"
      : "Draft saved";

  return (
    <div
      role={hasWarnings ? "alert" : "status"}
      className="review-submission-warnings-banner"
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: "12px 16px",
        margin: "12px 0",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 600, color, fontSize: 14 }}>{title}</p>
        {hasWarnings ? (
          <ul style={{ margin: 0, paddingLeft: 18, color, fontSize: 13 }}>
            {warnings.map((warning, idx) => (
              <li key={idx} style={{ marginBottom: 2 }}>
                {warning}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color, fontSize: 13 }}>
            {isSubmit
              ? "Your review was submitted successfully."
              : "Your draft was saved."}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "none",
          color,
          fontSize: 18,
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1,
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}
