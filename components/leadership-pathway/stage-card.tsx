import {
  LEADERSHIP_STAGES,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface StageCardProps {
  stageId: LeadershipStageId;
  isCurrent: boolean;
  /** Optional footnote rendered under the card (used for the workshop note under Instructor). */
  footnote?: string;
}

/**
 * One editorial card in the full-pathway disclosure grid.
 *
 * Stage label in Playfair 22px, tagline in Lora italic 13px, three
 * focus areas em-dash separated (no bullets), `mentoredBy` line at
 * the bottom in DM Sans caps. The user's current stage gets a
 * bottom-edge stage-tone accent and an inline "(You)" marker.
 *
 * Workshop Instructor is intentionally not rendered as its own card —
 * the full pathway shows exactly four stages (Instructor, Senior,
 * Lead, Org Leadership). The Instructor card carries an optional
 * footnote noting that the workshop pathway is a lighter on-ramp.
 */
export function StageCard({ stageId, isCurrent, footnote }: StageCardProps) {
  const stage = LEADERSHIP_STAGES[stageId];
  const focusAreas = stage.focusAreas.slice(0, 3);

  return (
    <article
      style={{
        position: "relative",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "20px 22px 22px",
        display: "grid",
        gap: 10,
      }}
      aria-current={isCurrent ? "true" : undefined}
    >
      {isCurrent && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            background: stage.color.accent,
          }}
        />
      )}

      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--ypp-purple-800)",
            margin: 0,
          }}
        >
          {stage.label}
        </h3>
        {isCurrent && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: stage.color.text,
            }}
          >
            (You)
          </span>
        )}
      </header>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-lora), Georgia, serif",
          fontStyle: "italic",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--muted)",
        }}
      >
        {stage.tagline}.
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "4px 0 0",
          display: "grid",
          gap: 6,
        }}
      >
        {focusAreas.map((item, idx) => (
          <li
            key={idx}
            style={{
              fontFamily: "var(--font-lora), Georgia, serif",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text)",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 10,
              alignItems: "baseline",
            }}
          >
            <span aria-hidden style={{ color: "var(--muted)" }}>
              &mdash;
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        Mentored by{" "}
        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
          {stage.mentoredBy.replace(/\.$/, "")}
        </span>
      </div>

      {footnote && (
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: "var(--font-lora), Georgia, serif",
            fontStyle: "italic",
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          {footnote}
        </p>
      )}
    </article>
  );
}
