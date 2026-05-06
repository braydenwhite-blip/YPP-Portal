"use client";

/**
 * Zone 3 from §12.5.3 — the warning block rendered inside the
 * `DecisionConfirmModal`. HIGH_RISK warnings carry per-key acknowledgement
 * checkboxes; CAUTION warnings render as bullet considerations; INFO is
 * suppressed (lives in the right-rail manifest only).
 */

import type { FinalReviewWarning } from "@/lib/final-review-warnings";
import { AlertOctagonIcon, AlertTriangleIcon } from "./cockpit-icons";

export interface ConfirmModalRisksProps {
  warnings: FinalReviewWarning[];
  acknowledgements: Record<string, boolean>;
  onToggleAcknowledge: (key: string) => void;
}

export default function ConfirmModalRisks({
  warnings,
  acknowledgements,
  onToggleAcknowledge,
}: ConfirmModalRisksProps) {
  const high = warnings.filter((w) => w.severity === "HIGH_RISK");
  const caution = warnings.filter((w) => w.severity === "CAUTION");
  if (high.length === 0 && caution.length === 0) return null;

  return (
    <section
      aria-label="Risks for this decision"
      style={{
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 12,
        padding: 14,
        background: "var(--cockpit-surface-strong, #faf8ff)",
      }}
    >
      {high.length > 0 ? (
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#b91c1c",
            }}
          >
            Risks ({high.length} need acknowledgement)
          </p>
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {high.map((warning) => {
              const acked = acknowledgements[warning.key] === true;
              return (
                <li
                  key={warning.key}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: "rgba(239, 68, 68, 0.06)",
                    border: "1px solid rgba(239, 68, 68, 0.32)",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <AlertOctagonIcon size={16} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#7f1d1d" }}>
                        {warning.message}
                      </p>
                      {warning.detail ? (
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#991b1b" }}>{warning.detail}</p>
                      ) : null}
                    </div>
                  </div>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#7f1d1d",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={acked}
                      onChange={() => onToggleAcknowledge(warning.key)}
                    />
                    I&apos;ve reviewed this risk
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {caution.length > 0 ? (
        <div style={{ marginTop: high.length > 0 ? 12 : 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#a16207",
            }}
          >
            Considerations
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--ink-muted, #6b5f7a)", display: "flex", flexDirection: "column", gap: 4 }}>
            {caution.map((warning) => (
              <li key={warning.key}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangleIcon size={12} />
                  <span style={{ color: "var(--ink-default, #1a0533)" }}>
                    <strong style={{ fontWeight: 600 }}>{warning.message}</strong>
                    {warning.detail ? <span style={{ color: "var(--ink-muted, #6b5f7a)" }}> {warning.detail}</span> : null}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
