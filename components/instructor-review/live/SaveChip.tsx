"use client";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type SaveChipProps = {
  status: SaveStatus;
  message: string;
  className?: string;
};

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "Ready",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function SaveChip({ status, message, className }: SaveChipProps) {
  const label = message || STATUS_LABEL[status];
  return (
    <span
      className={`iv-save-chip is-${status}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="iv-save-chip-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
