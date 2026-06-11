import { cn } from "./cn";

/**
 * Quick-action row for previews and record headers. Max four actions at
 * preview altitude (master plan §18) — pass more and the rest belong on the
 * full 360, not here.
 */
export function ActionButtonGroup({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? "Quick actions"}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {children}
    </div>
  );
}
