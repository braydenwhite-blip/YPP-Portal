import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

/**
 * People Suite — shared presentational primitives for the Students, Instructors,
 * and Classes admin surfaces. Pure (no hooks / no client state) so they render
 * in both server and client components. The visual treatment lives in the
 * `PEOPLE SUITE` block of `app/globals.css`, scoped to `.psuite`.
 */

// ── Deterministic identity color ────────────────────────────────────────────
// A stable vivid gradient per name so every person reads as their own avatar
// without storing any color — the same name always yields the same hues.
function hueFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 360;
  }
  return hash;
}

function avatarGradient(name: string): string {
  const h = hueFromString(name || "?");
  const h2 = (h + 42) % 360;
  return `linear-gradient(135deg, hsl(${h} 78% 62%), hsl(${h2} 70% 46%))`;
}

export function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Gradient-ring avatar ─────────────────────────────────────────────────────
export function PeopleAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? " psuite-avatar-sm" : size === "lg" ? " psuite-avatar-lg" : "";
  return (
    <span
      className={`psuite-avatar${sizeClass}`}
      style={{ "--psuite-avatar-bg": avatarGradient(name) } as CSSProperties}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

// ── Identity cell: avatar + name (+ optional subline) ────────────────────────
export function IdentityCell({
  name,
  sub,
  href,
  size = "md",
}: {
  name: string;
  sub?: ReactNode;
  href?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="psuite-identity">
      <PeopleAvatar name={name} size={size} />
      <div className="psuite-identity-main">
        {href ? (
          <Link href={href} className="psuite-identity-name psuite-identity-link">
            {name}
          </Link>
        ) : (
          <span className="psuite-identity-name">{name}</span>
        )}
        {sub != null && sub !== "" ? (
          <span className="psuite-identity-sub">{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── Fill meter ───────────────────────────────────────────────────────────────
export type MeterTone = "accent" | "success" | "warning" | "danger";

export function Meter({
  value,
  max,
  label,
  tone = "accent",
  width,
}: {
  value: number;
  max: number;
  label?: ReactNode;
  tone?: MeterTone;
  /** Optional min-width override for the meter column. */
  width?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div
      className={`psuite-meter is-${tone}`}
      style={width ? { minWidth: width } : undefined}
    >
      <div className="psuite-meter-track">
        <span className="psuite-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      {label != null ? <span className="psuite-meter-label">{label}</span> : null}
    </div>
  );
}

// ── Soft chip ────────────────────────────────────────────────────────────────
export function SuiteChip({
  children,
  muted = false,
  title,
}: {
  children: ReactNode;
  muted?: boolean;
  title?: string;
}) {
  return (
    <span className={`psuite-chip${muted ? " psuite-chip--muted" : ""}`} title={title}>
      {children}
    </span>
  );
}

// ── Certificate / achievement chip ───────────────────────────────────────────
export function CertChip({ count }: { count: number }) {
  if (count <= 0) {
    return <span style={{ color: "var(--gray-400)", fontSize: 13 }}>—</span>;
  }
  return (
    <span className="psuite-cert">
      <span aria-hidden="true">★</span>
      {count}
    </span>
  );
}
