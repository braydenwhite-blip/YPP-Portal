"use client";

type ReviewNotesBannerProps = {
  status: string;
  reviewNotes?: string | null;
  reviewerName?: string | null;
  onDismiss?: () => void;
};

export function ReviewNotesBanner({
  status,
  reviewNotes,
  reviewerName,
  onDismiss,
}: ReviewNotesBannerProps) {
  if (status !== "NEEDS_REVISION" || !reviewNotes) return null;

  return (
    <div
      style={{
        padding: "14px 18px",
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        borderRadius: "var(--radius-md)",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <strong style={{ fontSize: 14, color: "#991b1b", display: "block", marginBottom: 6 }}>
            Revision Requested
          </strong>
          {reviewerName && (
            <div style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 4 }}>
              From: {reviewerName}
            </div>
          )}
          <div
            style={{
              fontSize: 13,
              color: "#991b1b",
              lineHeight: 1.6,
              padding: "8px 12px",
              background: "#fff",
              border: "1px solid #fecaca",
              borderRadius: "var(--radius-sm, 4px)",
            }}
          >
            {reviewNotes}
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            className="button outline small"
            onClick={onDismiss}
            style={{ fontSize: 11, flexShrink: 0, marginLeft: 12 }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
