"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  meetingCategoryIdentity,
  meetingCategoryLabel,
  meetingCategoryTone,
} from "@/lib/people-strategy/meeting-categories";
import type {
  EffectiveFollowUpStatus,
  EffectiveMeetingStatus,
} from "@/lib/people-strategy/meetings-status";
import { MeetingIcon, type MeetingIconName } from "./meeting-icons";

/**
 * Shared UI primitives for the Weekly Command Center — badges, cards, metric
 * cards, avatars, section titles, buttons. Ported from the approved design's
 * `ui.jsx`, using the portal's existing tokens so the surface matches the rest
 * of the Action Tracker. Self-contained inline styles keep the look faithful to
 * the mock without bolting a large CSS surface onto globals.css.
 */

// --- tone palettes ----------------------------------------------------------

type ToneName = "neutral" | "purple" | "success" | "warning" | "danger" | "info";
type Tone = { bg: string; fg: string; border: string };

const TONES: Record<ToneName, Tone> = {
  neutral: { bg: "var(--chip-bg)", fg: "var(--text-secondary)", border: "var(--chip-border)" },
  purple: { bg: "var(--ypp-purple-100)", fg: "var(--ypp-purple-700)", border: "var(--ypp-purple-200)" },
  success: { bg: "#e7f6ed", fg: "#16794a", border: "#c7ebd6" },
  warning: { bg: "#fdf0d9", fg: "#a45a09", border: "#f6dfb4" },
  danger: { bg: "#fde7e7", fg: "#bb2525", border: "#f7c9c9" },
  info: { bg: "#e7eefb", fg: "#2a5bb8", border: "#cdddf6" },
};

const MEETING_STATUS: Record<EffectiveMeetingStatus, { label: string; tone: ToneName }> = {
  today: { label: "Today", tone: "purple" },
  in_progress: { label: "In Progress", tone: "info" },
  upcoming: { label: "Upcoming", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  needs_follow_up: { label: "Needs Follow-Up", tone: "warning" },
  canceled: { label: "Canceled", tone: "neutral" },
};

const FOLLOW_STATUS: Record<EffectiveFollowUpStatus, { label: string; tone: ToneName }> = {
  open: { label: "Open", tone: "neutral" },
  in_progress: { label: "In Progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
};

const AGENDA_STATUS: Record<string, { label: string; tone: ToneName }> = {
  OPEN: { label: "Open", tone: "neutral" },
  DISCUSSED: { label: "Discussed", tone: "success" },
  DEFERRED: { label: "Deferred", tone: "warning" },
  CONVERTED: { label: "Converted to Action", tone: "purple" },
};

const PRIORITY: Record<string, { label: string; tone: ToneName }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Normal", tone: "info" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "danger" },
};

export { meetingCategoryLabel, meetingCategoryTone };

// --- date helpers (client, real now) ----------------------------------------

export function daysUntil(iso: string, now: Date = new Date()): number {
  const a = new Date(now);
  a.setHours(0, 0, 0, 0);
  const b = new Date(iso);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function fmtWeekday(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(iso)
  );
}

export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function dueText(iso: string | null): { label: string; overdue: boolean; soon?: boolean } {
  if (!iso) return { label: "No due date", overdue: false };
  const n = daysUntil(iso);
  if (n < 0) return { label: `${Math.abs(n)}d overdue`, overdue: true };
  if (n === 0) return { label: "Due today", overdue: false, soon: true };
  if (n === 1) return { label: "Due tomorrow", overdue: false, soon: true };
  return { label: `Due ${fmtDate(iso)}`, overdue: false };
}

// --- Pill / badges ----------------------------------------------------------

export function Pill({
  tone = "neutral",
  children,
  dot,
  style,
}: {
  tone?: ToneName;
  children: ReactNode;
  dot?: boolean;
  style?: CSSProperties;
}) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span style={{ width: 7, height: 7, borderRadius: 999, flex: "0 0 auto", background: t.fg }} />
      )}
      {children}
    </span>
  );
}

export function CategoryBadge({
  category,
  withIcon = true,
  style,
}: {
  category: string | null;
  withIcon?: boolean;
  style?: CSSProperties;
}) {
  const c = meetingCategoryTone(category);
  const id = meetingCategoryIdentity(category);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: withIcon ? "3px 10px 3px 8px" : "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {withIcon && <MeetingIcon name={id.icon as MeetingIconName} size={13} stroke={2} />}
      {meetingCategoryLabel(category)}
    </span>
  );
}

export function MeetingStatusBadge({
  status,
  style,
}: {
  status: EffectiveMeetingStatus;
  style?: CSSProperties;
}) {
  const m = MEETING_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Pill tone={m.tone} style={style}>
      {m.label}
    </Pill>
  );
}

export function FollowUpStatusBadge({
  status,
  style,
}: {
  status: EffectiveFollowUpStatus;
  style?: CSSProperties;
}) {
  const m = FOLLOW_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Pill tone={m.tone} style={style}>
      {m.label}
    </Pill>
  );
}

export function AgendaStatusBadge({ status, style }: { status: string; style?: CSSProperties }) {
  const m = AGENDA_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Pill tone={m.tone} style={style}>
      {m.label}
    </Pill>
  );
}

export function PriorityBadge({ priority, style }: { priority: string; style?: CSSProperties }) {
  const m = PRIORITY[priority] ?? PRIORITY.MEDIUM;
  return (
    <Pill tone={m.tone} dot style={style}>
      {m.label}
    </Pill>
  );
}

// --- Card -------------------------------------------------------------------

const ELEVATED_SHADOW = "0 1px 2px rgba(28,20,60,.04), 0 6px 16px -8px rgba(28,20,60,.10)";
const HOVER_SHADOW = "0 2px 4px rgba(28,20,60,.05), 0 14px 30px -12px rgba(28,20,60,.18)";

export function Card({
  children,
  style,
  accent,
  hover,
  onClick,
}: {
  children: ReactNode;
  style?: CSSProperties;
  accent?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: ELEVATED_SHADOW,
        borderLeft: accent ? `3px solid ${accent}` : "1px solid var(--border)",
        transition: "box-shadow .16s ease, transform .16s ease, border-color .16s ease",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        ...style,
      }}
      onMouseEnter={
        hover
          ? (e) => {
              e.currentTarget.style.boxShadow = HOVER_SHADOW;
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.borderColor = "var(--ypp-purple-200)";
              if (accent) e.currentTarget.style.borderLeftColor = accent;
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              e.currentTarget.style.boxShadow = ELEVATED_SHADOW;
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = "var(--border)";
              if (accent) e.currentTarget.style.borderLeftColor = accent;
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

// --- Avatar / PersonChip ----------------------------------------------------

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        background: "var(--ypp-purple-100)",
        color: "var(--ypp-purple-700)",
        border: "1px solid var(--ypp-purple-200)",
        fontSize: size * 0.38,
        fontWeight: 800,
      }}
    >
      {initials}
    </span>
  );
}

export function PersonChip({ name, sub, size = 30 }: { name: string; sub?: string; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <Avatar name={name} size={size} />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <strong style={{ fontSize: 13, color: "var(--ypp-ink)", whiteSpace: "nowrap" }}>{name}</strong>
        {sub && (
          <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{sub}</span>
        )}
      </span>
    </div>
  );
}

// --- SectionTitle -----------------------------------------------------------

export function SectionTitle({
  children,
  count,
  right,
  icon,
}: {
  children: ReactNode;
  count?: number | null;
  right?: ReactNode;
  icon?: MeetingIconName;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 4, height: 18, borderRadius: 4, background: "var(--ypp-purple-500)", flex: "0 0 auto" }} />
        {icon && <MeetingIcon name={icon} size={17} style={{ color: "var(--ypp-purple-600)" }} />}
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ypp-ink)", letterSpacing: "-.01em" }}>
          {children}
        </h2>
        {count != null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--muted)",
              background: "var(--chip-bg)",
              border: "1px solid var(--chip-border)",
              borderRadius: 999,
              padding: "1px 8px",
            }}
          >
            {count}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

// --- MetricCard -------------------------------------------------------------

export function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = "purple",
  active,
  alert,
  href,
  onClick,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: MeetingIconName;
  tone?: ToneName;
  active?: boolean;
  alert?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const t = TONES[tone];
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: t.bg,
            color: t.fg,
            flex: "0 0 auto",
          }}
        >
          <MeetingIcon name={icon} size={16} stroke={2} />
        </span>
      </div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          color: "var(--ypp-ink)",
          lineHeight: 1,
          letterSpacing: "-.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: alert ? "var(--danger-fg)" : "var(--muted)",
          fontWeight: alert ? 700 : 500,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {alert && <MeetingIcon name="alert" size={13} />}
        {sub}
      </div>
    </>
  );

  const baseStyle: CSSProperties = {
    textAlign: "left",
    font: "inherit",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderTop: active ? "3px solid var(--ypp-purple-600)" : "1px solid var(--border)",
    borderRadius: 16,
    padding: "16px 16px 15px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: ELEVATED_SHADOW,
    minWidth: 0,
    textDecoration: "none",
  };

  if (href) {
    return (
      <a href={href} style={baseStyle}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...baseStyle, cursor: "pointer" }}>
        {inner}
      </button>
    );
  }
  return <div style={baseStyle}>{inner}</div>;
}

// --- Button -----------------------------------------------------------------

export function MeetingButton({
  children,
  variant = "solid",
  size = "md",
  icon,
  iconRight,
  onClick,
  type = "button",
  disabled,
  style,
  full,
}: {
  children?: ReactNode;
  variant?: "solid" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: MeetingIconName;
  iconRight?: MeetingIconName;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
  full?: boolean;
}) {
  const sizes = {
    sm: { pad: "6px 11px", fs: 13 },
    md: { pad: "9px 15px", fs: 14 },
    lg: { pad: "11px 18px", fs: 15 },
  } as const;
  const s = sizes[size];
  const variants: Record<string, CSSProperties> = {
    solid: { background: "var(--ypp-purple-600)", color: "#fff", border: "1px solid var(--ypp-purple-600)" },
    outline: { background: "var(--surface)", color: "var(--ypp-purple-700)", border: "1px solid var(--ypp-purple-200)" },
    ghost: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
    danger: { background: "var(--surface)", color: "var(--danger-fg)", border: "1px solid #f0c2c2" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        font: "inherit",
        fontSize: s.fs,
        fontWeight: 700,
        padding: s.pad,
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        width: full ? "100%" : "auto",
        transition: "filter .15s, background .15s, border-color .15s",
        ...variants[variant],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.filter = "brightness(0.96)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "none";
      }}
    >
      {icon && <MeetingIcon name={icon} size={s.fs + 2} stroke={2.1} />}
      {children}
      {iconRight && <MeetingIcon name={iconRight} size={s.fs + 2} stroke={2.1} />}
    </button>
  );
}

export function TinyLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: ".03em",
        textTransform: "uppercase",
        color: "var(--muted)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  cta,
  onCta,
  compact,
}: {
  icon: MeetingIconName;
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: compact ? "26px 18px" : "44px 24px",
        border: "1px dashed var(--border)",
        borderRadius: 14,
        background: "var(--rail)",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          margin: "0 auto 13px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--ypp-purple-100)",
          color: "var(--ypp-purple-600)",
        }}
      >
        <MeetingIcon name={icon} size={22} />
      </div>
      <div style={{ fontSize: compact ? 14 : 15.5, fontWeight: 800, color: "var(--ypp-ink)", marginBottom: 5 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>
        {body}
      </div>
      {cta && onCta && (
        <div style={{ marginTop: 15 }}>
          <MeetingButton icon="plus" size="sm" onClick={onCta}>
            {cta}
          </MeetingButton>
        </div>
      )}
    </div>
  );
}
