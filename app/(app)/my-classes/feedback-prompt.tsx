"use client";

import { useState } from "react";
import { ClassFeedbackForm } from "@/components/classes/class-feedback-form";

type Prompt = {
  offeringId: string;
  title: string;
  instructorName: string;
  interestArea: string;
  endDate: string; // pre-formatted for display
};

/**
 * Post-class feedback prompt for My Classes: classes the student took that have
 * wrapped up but that they have not rated yet. Each row expands into the shared
 * feedback form; submitting a row removes the prompt on the next refresh.
 */
export function FeedbackPrompts({ prompts }: { prompts: Prompt[] }) {
  const [openId, setOpenId] = useState<string | null>(
    prompts.length === 1 ? prompts[0].offeringId : null,
  );

  if (prompts.length === 0) return null;

  return (
    <div
      className="card"
      style={{ marginBottom: 24, borderLeft: "4px solid #f59e0b" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 20 }} aria-hidden="true">
          ⭐
        </span>
        <h3 style={{ margin: 0 }}>How were your recent classes?</h3>
        <span
          className="pill"
          style={{ background: "#fffbeb", color: "#b45309", fontWeight: 700 }}
        >
          {prompts.length} to review
        </span>
      </div>
      <p style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 4 }}>
        Your feedback is shared with your instructor and the YPP team to make
        classes better. It only takes a minute.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {prompts.map((prompt) => {
          const isOpen = openId === prompt.offeringId;
          return (
            <div
              key={prompt.offeringId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{prompt.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    {prompt.instructorName} · {prompt.interestArea} · ended {prompt.endDate}
                  </div>
                </div>
                <button
                  className={`button ${isOpen ? "secondary" : "primary"}`}
                  style={{ fontSize: 13 }}
                  onClick={() =>
                    setOpenId(isOpen ? null : prompt.offeringId)
                  }
                >
                  {isOpen ? "Close" : "Give feedback"}
                </button>
              </div>

              {isOpen && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border-light, #eee)",
                  }}
                >
                  <ClassFeedbackForm
                    offeringId={prompt.offeringId}
                    onDone={() => setOpenId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
