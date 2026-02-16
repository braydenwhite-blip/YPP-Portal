"use client";

import { useState } from "react";

interface InterviewNoteTemplatesProps {
  onApply: (template: { content: string; recommendation: string; rating: string }) => void;
  disabled?: boolean;
}

const TEMPLATES = [
  {
    id: "strong-yes",
    label: "Strong Yes - Recommend Hire",
    pillClass: "pill-success",
    content:
      "Candidate demonstrated exceptional qualifications for this role. Strong communication skills, relevant experience, and clear passion for the mission. Confident this person would make an immediate positive impact.",
    recommendation: "STRONG_YES",
    rating: "5",
  },
  {
    id: "yes",
    label: "Yes - Good Fit",
    pillClass: "pill-success",
    content:
      "Solid candidate with relevant skills and experience. Good communication and genuine enthusiasm for the role. Would benefit the team.",
    recommendation: "YES",
    rating: "4",
  },
  {
    id: "maybe",
    label: "Maybe - Needs Discussion",
    pillClass: "pill-pathway",
    content:
      "Mixed signals from this interview. Some strong areas but also concerns worth discussing with the team before making a decision.",
    recommendation: "MAYBE",
    rating: "3",
  },
  {
    id: "no",
    label: "No - Not a Fit",
    pillClass: "pill-declined",
    content:
      "After careful consideration, this candidate does not appear to be the right fit for this role at this time. Key concerns noted below.",
    recommendation: "NO",
    rating: "2",
  },
];

export default function InterviewNoteTemplates({ onApply, disabled }: InterviewNoteTemplatesProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        className="button small outline"
        onClick={() => setExpanded(!expanded)}
        disabled={disabled}
        style={{ fontSize: 12 }}
      >
        {expanded ? "Hide Templates" : "Use a Template"}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <span className={`pill pill-small ${tpl.pillClass}`}>{tpl.label}</span>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  {tpl.content.slice(0, 80)}...
                </p>
              </div>
              <button
                type="button"
                className="button small"
                onClick={() => {
                  onApply({
                    content: tpl.content,
                    recommendation: tpl.recommendation,
                    rating: tpl.rating,
                  });
                  setExpanded(false);
                }}
                style={{ flexShrink: 0 }}
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
