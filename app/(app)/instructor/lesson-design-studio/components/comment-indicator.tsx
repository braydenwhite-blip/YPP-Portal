"use client";

interface CommentIndicatorProps {
  count: number;
  unresolvedCount?: number;
  label: string;
  onClick: () => void;
}

export function CommentIndicator({
  count,
  unresolvedCount = 0,
  label,
  onClick,
}: CommentIndicatorProps) {
  return (
    <button
      type="button"
      className={`lds-comment-indicator${count > 0 ? " has-comments" : ""}${
        unresolvedCount > 0 ? " unresolved" : ""
      }`}
      onClick={onClick}
      aria-label={
        count > 0
          ? `${label}: ${count} comment${count === 1 ? "" : "s"}`
          : `${label}: add comment`
      }
    >
      <span className="lds-comment-indicator-icon" aria-hidden="true" />
      <span>{count > 0 ? count : "Add comment"}</span>
      {unresolvedCount > 0 ? (
        <span className="lds-comment-indicator-badge">{unresolvedCount}</span>
      ) : null}
    </button>
  );
}
