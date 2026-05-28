import {
  getReviewStateChips,
  getReviewStateTonePalette,
  type ReviewStateInput,
} from "@/lib/mentorship-review-state";

type Props = ReviewStateInput & {
  title?: string;
};

/**
 * Renders the approval pipeline for a single review as a labelled chip strip,
 * so a chair can see at a glance what has happened and what is still pending:
 *   Submitted → Chair decision → Released to mentee → Points
 */
export function ReviewStateStrip({ title = "Where this review is", ...input }: Props) {
  const chips = getReviewStateChips(input);

  return (
    <section className="card" aria-label="Review approval state" style={{ display: "grid", gap: 10 }}>
      <strong style={{ fontSize: "0.9rem" }}>{title}</strong>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 8,
        }}
      >
        {chips.map((chip, idx) => {
          const palette = getReviewStateTonePalette(chip.tone);
          return (
            <li
              key={chip.key}
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <span
                aria-hidden
                style={{
                  flex: "0 0 auto",
                  marginTop: 2,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  background: palette.background,
                  color: palette.color,
                  border: `1px solid ${palette.color}33`,
                }}
              >
                {chip.done ? "✓" : idx + 1}
              </span>
              <span style={{ display: "grid", gap: 2 }}>
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: palette.color,
                  }}
                >
                  {chip.label}
                </span>
                <span className="muted" style={{ fontSize: "0.76rem", lineHeight: 1.4 }}>
                  {chip.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default ReviewStateStrip;
