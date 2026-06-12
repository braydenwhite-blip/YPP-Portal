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

const STATUS_CLASS: Record<SaveStatus, { chip: string; dot: string }> = {
  idle: { chip: "border-line bg-surface text-ink-muted", dot: "bg-gray-400" },
  dirty: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  saving: {
    chip: "border-brand-200 bg-brand-50 text-brand-700",
    dot: "animate-pulse bg-brand-600",
  },
  saved: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  error: { chip: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

export function SaveChip({ status, message, className }: SaveChipProps) {
  const label = message || STATUS_LABEL[status];
  const tone = STATUS_CLASS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${tone.chip}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
