"use client";

import { useState } from "react";

interface DecisionTemplatesProps {
  onApply: (template: { accepted: string; notes: string }) => void;
  positionTitle: string;
}

const ACCEPT_TEMPLATES = [
  {
    id: "accept-standard",
    label: "Standard Acceptance",
    notes: (title: string) =>
      `Congratulations! We're pleased to offer you the ${title} role. Your skills and enthusiasm stood out, and we're excited to have you join the team. We'll follow up shortly with onboarding details and next steps.`,
  },
  {
    id: "accept-conditional",
    label: "Conditional Acceptance",
    notes: (title: string) =>
      `We'd like to extend a conditional offer for the ${title} position. Before we finalize, we'll need to complete a few additional steps. Please watch for a follow-up message with details.`,
  },
];

const REJECT_TEMPLATES = [
  {
    id: "reject-standard",
    label: "Standard Rejection",
    notes: (title: string) =>
      `Thank you for your interest in the ${title} position and for taking the time to apply. After careful review, we've decided to move forward with other candidates whose experience more closely matches our current needs. We encourage you to apply for future openings.`,
  },
  {
    id: "reject-encourage",
    label: "Rejection with Encouragement",
    notes: (title: string) =>
      `We appreciate your application for ${title}. While we won't be moving forward at this time, we were impressed by your enthusiasm. We'd love to see you apply again in the future or explore other opportunities in the network.`,
  },
];

export default function DecisionTemplates({ onApply, positionTitle }: DecisionTemplatesProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        className="button small outline"
        onClick={() => setExpanded(!expanded)}
        style={{ fontSize: 12 }}
      >
        {expanded ? "Hide Templates" : "Use a Response Template"}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#166534" }}>
              Acceptance Templates
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {ACCEPT_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    border: "1px solid #bbf7d0",
                    borderRadius: 8,
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    background: "#f0fdf4",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13 }}>{tpl.label}</strong>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      {tpl.notes(positionTitle).slice(0, 80)}...
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => {
                      onApply({ accepted: "true", notes: tpl.notes(positionTitle) });
                      setExpanded(false);
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#991b1b" }}>
              Rejection Templates
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {REJECT_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    background: "#fef2f2",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13 }}>{tpl.label}</strong>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      {tpl.notes(positionTitle).slice(0, 80)}...
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => {
                      onApply({ accepted: "false", notes: tpl.notes(positionTitle) });
                      setExpanded(false);
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
