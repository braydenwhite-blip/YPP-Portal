import {
  LEADERSHIP_STAGES,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface FocusAreasListProps {
  stageId: LeadershipStageId;
  /** Workshop users render the Instructor-tier focus areas. */
  instructorSubtype?: "STANDARD" | "SUMMER_WORKSHOP" | null;
}

/**
 * Editorial numbered list of the user's stage focus areas.
 *
 * Large Playfair numerals + Lora body + generous row gap. No bullets,
 * no chips, no icons. The single typographic move that most reframes
 * the page from "AI dashboard" to "elite development pipeline."
 *
 * Reads from `stage.focusAreas` (second-person aspirational voice) —
 * not the rubric `expectations` (third-person evaluation voice).
 * The rubric belongs inside the disclosure for cross-stage comparison.
 */
export function FocusAreasList({
  stageId,
  instructorSubtype,
}: FocusAreasListProps) {
  const isWorkshop =
    stageId === "WORKSHOP_INSTRUCTOR" ||
    instructorSubtype === "SUMMER_WORKSHOP";

  const sourceStageId: LeadershipStageId = isWorkshop
    ? "WORKSHOP_INSTRUCTOR"
    : stageId;
  const stage = LEADERSHIP_STAGES[sourceStageId];
  const items = stage.focusAreas;

  return (
    <section aria-labelledby="focus-areas-heading">
      <h2
        id="focus-areas-heading"
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--text)",
          margin: "0 0 24px",
        }}
      >
        What you&apos;re focused on right now
      </h2>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          columnGap: 40,
          rowGap: 22,
        }}
      >
        {items.map((item, idx) => (
          <li
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 18,
              alignItems: "baseline",
            }}
          >
            <span
              aria-hidden
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--ypp-purple-400)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontFamily: "var(--font-lora), Georgia, serif",
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--text)",
              }}
            >
              {item}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
