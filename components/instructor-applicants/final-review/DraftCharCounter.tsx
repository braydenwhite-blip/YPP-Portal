/**
 * Subtle character counter under the rationale textarea. Renders nothing
 * until the soft limit (8 000) is hit; turns red at the hard cap (10 000).
 */

export interface DraftCharCounterProps {
  text: string;
  softLimit?: number;
  hardLimit?: number;
}

export default function DraftCharCounter({
  text,
  softLimit = 8_000,
  hardLimit = 10_000,
}: DraftCharCounterProps) {
  const length = text.length;
  if (length < softLimit) return null;
  const overHard = length >= hardLimit;
  const formattedCurrent = length.toLocaleString();
  const formattedHard = hardLimit.toLocaleString();
  return (
    <span
      className={`draft-char-counter ${overHard ? "over" : "near"}`}
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        background: overHard ? "rgba(239, 68, 68, 0.14)" : "rgba(234, 179, 8, 0.14)",
        color: overHard ? "#b91c1c" : "#a16207",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {formattedCurrent} / {formattedHard}
      {overHard ? " — reduce length to save" : " — approaching limit"}
    </span>
  );
}
