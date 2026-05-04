"use client";

/**
 * Zone 1 from §12.5.1 — the risks-and-considerations manifest in the
 * cockpit's right rail. Groups warnings by severity, expands HIGH_RISK by
 * default, and lets the chair acknowledge HIGH_RISK warnings in-place so
 * the dock preview line and confirm modal stay in sync.
 */

import { useMemo, useState } from "react";
import {
  type FinalReviewWarning,
  type WarningSeverity,
  groupBySeverity,
} from "@/lib/final-review-warnings";
import { AlertOctagonIcon, AlertTriangleIcon, CheckIcon } from "./cockpit-icons";

const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  HIGH_RISK: "High risk",
  CAUTION: "Caution",
  INFO: "Considerations",
};

const SEVERITY_TONE: Record<WarningSeverity, { bg: string; fg: string }> = {
  HIGH_RISK: { bg: "rgba(239, 68, 68, 0.10)", fg: "#b91c1c" },
  CAUTION: { bg: "rgba(234, 179, 8, 0.12)", fg: "#a16207" },
  INFO: { bg: "rgba(107, 33, 200, 0.08)", fg: "var(--ypp-purple-700, #5a1da8)" },
};

export interface RisksPanelProps {
  warnings: FinalReviewWarning[];
  acknowledgements: Record<string, boolean>;
  onToggleAcknowledge: (key: string) => void;
}

export default function RisksPanel({
  warnings,
  acknowledgements,
  onToggleAcknowledge,
}: RisksPanelProps) {
  const grouped = useMemo(() => groupBySeverity(warnings), [warnings]);
  const [expanded, setExpanded] = useState<Record<WarningSeverity, boolean>>({
    HIGH_RISK: true,
    CAUTION: false,
    INFO: false,
  });

  function toggleGroup(sev: WarningSeverity) {
    setExpanded((prev) => ({ ...prev, [sev]: !prev[sev] }));
  }

  if (warnings.length === 0) {
    return (
      <div
        className="risks-panel empty"
        style={{
          background: "var(--cockpit-surface, #fff)",
          border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--ink-muted, #6b5f7a)",
          fontSize: 13,
        }}
      >
        <span style={{ color: "#16a34a", display: "inline-flex" }}>
          <CheckIcon size={16} />
        </span>
        No risks or considerations detected.
      </div>
    );
  }

  return (
    <section
      className="risks-panel"
      aria-label="Risks and considerations"
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Risks &amp; considerations
      </p>
      {(["HIGH_RISK", "CAUTION", "INFO"] as WarningSeverity[]).map((sev) => {
        const items = grouped[sev];
        if (items.length === 0) return null;
        const isOpen = expanded[sev];
        return (
          <div key={sev}>
            <button
              type="button"
              onClick={() => toggleGroup(sev)}
              aria-expanded={isOpen}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 8,
                background: SEVERITY_TONE[sev].bg,
                color: SEVERITY_TONE[sev].fg,
                border: "1px solid transparent",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {sev === "HIGH_RISK" ? (
                <AlertOctagonIcon size={14} />
              ) : sev === "CAUTION" ? (
                <AlertTriangleIcon size={14} />
              ) : (
                <CheckIcon size={14} />
              )}
              <span style={{ flex: 1, textAlign: "left" }}>
                {items.length} {SEVERITY_LABEL[sev]}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500 }}>{isOpen ? "Hide" : "Show"}</span>
            </button>
            {isOpen ? (
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((warning) => {
                  const acked = acknowledgements[warning.key] === true;
                  return (
                    <li
                      key={warning.key}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        background: "var(--cockpit-surface-strong, #faf8ff)",
                        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--ink-default, #1a0533)" }}>
                        {warning.message}
                      </p>
                      {warning.detail ? (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--ink-muted, #6b5f7a)" }}>
                          {warning.detail}
                        </p>
                      ) : null}
                      {sev === "HIGH_RISK" ? (
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--ink-default, #1a0533)",
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
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
