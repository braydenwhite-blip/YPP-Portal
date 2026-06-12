import type { ApplicationSource } from "@prisma/client";
import { describeApplicationSource } from "@/lib/application-source-config";

interface ApplicationSourceBadgeProps {
  source: ApplicationSource | null | undefined;
  /** When true (default), use short label; false uses long label. */
  short?: boolean;
  /** Extra class for layout. */
  className?: string;
}

/**
 * Compact pill showing where an application came from. Renders nothing for
 * a missing source. Portal applications still render (intentional — admins
 * told us they want "Source: Portal Application" parity with external
 * sources rather than implicit "no badge = portal").
 */
export default function ApplicationSourceBadge({
  source,
  short = true,
  className = "",
}: ApplicationSourceBadgeProps) {
  if (!source) return null;
  const descriptor = describeApplicationSource(source);
  const label = short ? descriptor.shortLabel : descriptor.longLabel;
  return (
    <span
      className={`${descriptor.badgeClass} ${className}`.trim()}
      title={`Source: ${descriptor.longLabel} — ${descriptor.description}`}
      aria-label={`Application source: ${descriptor.longLabel}`}
    >
      Source: {label}
    </span>
  );
}
