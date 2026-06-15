import type {
  ActionAttentionSeverity,
  ActionAttentionSignal,
} from "@/lib/people-strategy/action-attention";

/**
 * People Strategy — single-action "Needs attention" callout.
 *
 * Renders the rich `ActionAttentionSignal[]` derived for ONE action (see
 * `deriveActionSignals`) as a compact, explainable banner on the action detail
 * page. Every permitted viewer — member or leadership — sees, in plain
 * language, why the action is stuck and the recommended next move, so a single
 * action can never quietly fall through the cracks. The banner takes the colour
 * of the most severe signal and renders nothing when the action is healthy.
 */

const SEVERITY_STYLE: Record<
  ActionAttentionSeverity,
  { label: string; border: string; bg: string; fg: string; chipBg: string }
> = {
  critical: { label: "Critical", border: "#fecaca", bg: "#fef2f2", fg: "#b91c1c", chipBg: "#fee2e2" },
  high: { label: "High", border: "#fed7aa", bg: "#fff7ed", fg: "#c2410c", chipBg: "#ffedd5" },
  medium: { label: "Medium", border: "#fde68a", bg: "#fffbeb", fg: "#a16207", chipBg: "#fef9c3" },
  low: { label: "Low", border: "#e2e8f0", bg: "#f8fafc", fg: "#475569", chipBg: "#f1f5f9" },
};

const SEVERITY_RANK: Record<ActionAttentionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function ActionAttentionCallout({ signals }: { signals: ActionAttentionSignal[] }) {
  if (signals.length === 0) return null;

  // The banner colour follows the single most severe signal on this action.
  const top = [...signals].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )[0];
  const style = SEVERITY_STYLE[top.severity];

  return (
    <section
      aria-label="Needs attention"
      style={{
        marginBottom: 16,
        borderRadius: 12,
        border: `1px solid ${style.border}`,
        background: style.bg,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.3,
            padding: "2px 8px",
            borderRadius: 999,
            background: style.chipBg,
            color: style.fg,
          }}
        >
          {style.label}
        </span>
        <strong style={{ fontSize: 13, color: style.fg }}>Needs attention</strong>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {signals.map((signal, index) => (
          <li
            key={`${signal.kind}-${index}`}
            style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.4 }}
          >
            <span style={{ fontWeight: 600 }}>{signal.reason}</span>
            <span style={{ color: "#6b7280" }}>
              {" — "}
              {signal.nextStep}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
