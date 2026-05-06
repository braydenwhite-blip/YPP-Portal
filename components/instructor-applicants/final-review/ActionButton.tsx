"use client";

/**
 * Inner button primitive for the decision dock. Encapsulates icon + label +
 * tone + loading/disabled states + the `aria-describedby` consequence string.
 */

import type { ChairDecisionAction } from "@prisma/client";

export type ActionTone = "primary" | "primary-alt" | "secondary" | "destructive";

export interface ActionButtonProps {
  action: ChairDecisionAction;
  tone: ActionTone;
  icon: (props: { size?: number }) => JSX.Element;
  label: string;
  description: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

const TONE_STYLES: Record<ActionTone, { bg: string; fg: string; border: string; hover: string }> = {
  primary: {
    bg: "var(--ypp-purple-600, #6b21c8)",
    fg: "#fff",
    border: "transparent",
    hover: "var(--ypp-purple-700, #5a1da8)",
  },
  "primary-alt": {
    bg: "rgba(107, 33, 200, 0.12)",
    fg: "var(--ypp-purple-700, #5a1da8)",
    border: "var(--ypp-purple-600, #6b21c8)",
    hover: "rgba(107, 33, 200, 0.18)",
  },
  secondary: {
    bg: "var(--cockpit-surface, #fff)",
    fg: "var(--ink-default, #1a0533)",
    border: "var(--cockpit-line, rgba(71,85,105,0.22))",
    hover: "var(--cockpit-surface-strong, #faf8ff)",
  },
  destructive: {
    bg: "rgba(239, 68, 68, 0.1)",
    fg: "#b91c1c",
    border: "rgba(239, 68, 68, 0.4)",
    hover: "rgba(239, 68, 68, 0.18)",
  },
};

export default function ActionButton({
  action,
  tone,
  icon: Icon,
  label,
  description,
  disabled,
  loading,
  onClick,
}: ActionButtonProps) {
  const style = TONE_STYLES[tone];
  const descId = `action-${action}-desc`;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={loading || disabled || undefined}
        aria-describedby={descId}
        className={`action-button tone-${tone} action-${action.toLowerCase()}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 14px",
          minHeight: 44,
          background: style.bg,
          color: style.fg,
          border: `1px solid ${style.border}`,
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "background 120ms ease, transform 120ms ease",
        }}
      >
        {loading ? (
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: `2px solid ${style.fg}`,
              borderTopColor: "transparent",
              animation: "cockpit-spin 0.8s linear infinite",
            }}
          />
        ) : (
          <Icon size={16} />
        )}
        <span>{label}</span>
      </button>
      <span id={descId} className="sr-only">
        {description}
      </span>
    </>
  );
}
