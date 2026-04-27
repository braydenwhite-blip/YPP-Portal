"use client";

/**
 * Structured reason-code selector for REJECT. Drives the rejection email
 * tone so the chair doesn't author rejection prose from scratch and so the
 * candidate file has consistent legal language. (§8.5)
 */

export type RejectReasonCode =
  | "TEACHING_FIT"
  | "COMMUNICATION"
  | "PROFESSIONALISM"
  | "RED_FLAG"
  | "OTHER";

export interface RejectReasonCodePickerProps {
  reasonCode: RejectReasonCode | null;
  freeText: string;
  onChange: (code: RejectReasonCode, freeText: string) => void;
}

const REASONS: Array<{ code: RejectReasonCode; title: string; description: string; tone: string }> = [
  {
    code: "TEACHING_FIT",
    title: "Teaching fit",
    description:
      "Curriculum depth or pedagogical approach not aligned with program expectations.",
    tone: "Warm but clear: thanks them for time, names the curriculum gap, no defensive posture.",
  },
  {
    code: "COMMUNICATION",
    title: "Communication",
    description: "Concerns about how the applicant communicated with reviewers or students.",
    tone: "Direct and respectful — flags communication concerns without re-litigating examples.",
  },
  {
    code: "PROFESSIONALISM",
    title: "Professionalism",
    description: "Reliability, follow-through, or process concerns flagged across reviewers.",
    tone: "Brief and final — declines without an invitation to reapply this cycle.",
  },
  {
    code: "RED_FLAG",
    title: "Red flag",
    description:
      "Use when a tagged red-flag in interview notes drove the decision. Triggers escalation logging.",
    tone: "Cool, formal — minimal detail to the candidate, full context in the audit trail.",
  },
  {
    code: "OTHER",
    title: "Other",
    description: "Pick when none of the above fit. Required free-text replaces the default copy.",
    tone: "Free-text replaces the standard email body for this case.",
  },
];

export default function RejectReasonCodePicker({
  reasonCode,
  freeText,
  onChange,
}: RejectReasonCodePickerProps) {
  return (
    <fieldset
      className="reject-reason-picker"
      style={{
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 12,
        padding: 14,
        margin: 0,
      }}
    >
      <legend
        style={{
          padding: "0 8px",
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Reason for rejection
      </legend>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {REASONS.map((reason) => {
          const checked = reasonCode === reason.code;
          return (
            <li key={reason.code}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${checked ? "var(--ypp-purple-500, #8b3fe8)" : "var(--cockpit-line, rgba(71,85,105,0.18))"}`,
                  background: checked ? "var(--ypp-purple-50, #f3ecff)" : "var(--cockpit-surface, #fff)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="reject-reason"
                  value={reason.code}
                  checked={checked}
                  onChange={() => onChange(reason.code, freeText)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 13, color: "var(--ink-default, #1a0533)" }}>
                    {reason.title}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--ink-muted, #6b5f7a)" }}>
                    {reason.description}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--ink-faint, #a89cb8)",
                      fontStyle: "italic",
                      marginTop: 4,
                    }}
                  >
                    Email tone — {reason.tone}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {reasonCode === "OTHER" ? (
        <label
          style={{
            display: "block",
            marginTop: 10,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-default, #1a0533)",
          }}
        >
          Custom rejection text
          <textarea
            value={freeText}
            onChange={(e) => onChange("OTHER", e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Describe the reason — this text replaces the standard email template."
            style={{
              width: "100%",
              marginTop: 6,
              padding: 10,
              fontSize: 13,
              borderRadius: 10,
              border: "1px solid var(--cockpit-line, rgba(71,85,105,0.22))",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--ink-muted, #6b5f7a)" }}>
            {freeText.length} / 500
          </span>
        </label>
      ) : null}
    </fieldset>
  );
}
