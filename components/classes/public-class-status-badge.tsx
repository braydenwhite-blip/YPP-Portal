import type { CSSProperties } from "react";
import {
  derivePublicClassStatus,
  type ClassStatusTone,
  type PublicClassStatusInfo,
  type PublicClassStatusInput,
} from "@/lib/class-status";

/**
 * Presentational badge for the derived public class status. Pure (no hooks) so it
 * renders in both server and client components. Pass either a precomputed
 * `info` (from `derivePublicClassStatus`) or the raw `input` to derive inline.
 *
 * Colors mirror the inline pill palette already used across the curriculum
 * surfaces so the badge reads as native, not bolted on.
 */

const TONE_STYLES: Record<ClassStatusTone, CSSProperties> = {
  success: { background: "#f0fdf4", color: "#16a34a" },
  warning: { background: "#fffbeb", color: "#b45309" },
  danger: { background: "#fef2f2", color: "#dc2626" },
  info: { background: "#eff6ff", color: "#1d4ed8" },
  purple: { background: "var(--ypp-purple-100, #f0e6ff)", color: "var(--ypp-purple, #6b21c8)" },
  neutral: { background: "var(--gray-100, #f3f4f6)", color: "var(--gray-600, #4b5563)" },
};

export function PublicClassStatusBadge({
  info,
  input,
  showSpots = false,
  style,
}: {
  info?: PublicClassStatusInfo;
  input?: PublicClassStatusInput;
  /** Append "· N left" to the label for at-a-glance capacity. */
  showSpots?: boolean;
  style?: CSSProperties;
}) {
  const resolved = info ?? (input ? derivePublicClassStatus(input) : null);
  if (!resolved) return null;

  const tone = TONE_STYLES[resolved.tone];
  const spotsSuffix =
    showSpots && (resolved.status === "OPEN" || resolved.status === "ALMOST_FULL")
      ? ` · ${resolved.spotsLeft} left`
      : "";

  return (
    <span
      className="pill"
      title={resolved.helper ?? undefined}
      style={{ fontWeight: 600, fontSize: 11, ...tone, ...style }}
    >
      {resolved.label}
      {spotsSuffix}
    </span>
  );
}
