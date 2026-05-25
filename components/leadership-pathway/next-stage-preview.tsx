import {
  LEADERSHIP_STAGES,
  LeadershipStageId,
  MENTORSHIP_PATTERN,
  PROMOTION_PHILOSOPHY,
} from "@/lib/leadership-pathway";

interface NextStagePreviewProps {
  currentStageId: LeadershipStageId;
  nextStageId: LeadershipStageId | null;
}

/**
 * The aspirational "what's next" block — a pull-quote, not a card.
 *
 * Full-bleed within the content column, --bg-2 background, no border.
 * Stage label in Playfair 32px, lede pulled from PROMOTION_PHILOSOPHY
 * (already perfect aspirational copy in the data file), then two
 * teaser focus areas, then the mentorship pattern as a closing line.
 *
 * Edge cases:
 * - Lead Instructor: next is Org Leadership — normal preview.
 * - Org Leadership: no next stage — render a "What you steward"
 *   variant using their own focus areas.
 *
 * Tone discipline: no "On track for promotion!" badges, no progress
 * bars, no "X of Y goals met." Aspirational narrative, not gamified.
 */
export function NextStagePreview({
  currentStageId,
  nextStageId,
}: NextStagePreviewProps) {
  if (!nextStageId) {
    return <StewardshipBlock currentStageId={currentStageId} />;
  }

  const nextStage = LEADERSHIP_STAGES[nextStageId];
  const philosophy = PROMOTION_PHILOSOPHY[nextStageId];
  const mentorship = MENTORSHIP_PATTERN[nextStageId];
  const teaserFocus = nextStage.focusAreas.slice(0, 2);

  return (
    <section
      style={{
        background: "var(--bg-2)",
        padding: "36px 40px 40px",
        maxWidth: 880,
      }}
      aria-labelledby="next-stage-heading"
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        What&apos;s next
      </div>
      <h2
        id="next-stage-heading"
        style={{
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: "clamp(26px, 3.5vw, 32px)",
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: "var(--ypp-purple-800)",
          margin: "10px 0 0",
        }}
      >
        {nextStage.label}.
      </h2>

      {philosophy && (
        <p
          style={{
            fontFamily: "var(--font-lora), Georgia, serif",
            fontStyle: "italic",
            fontSize: 19,
            lineHeight: 1.5,
            color: "var(--text)",
            margin: "18px 0 0",
            maxWidth: "56ch",
          }}
        >
          &ldquo;{philosophy}&rdquo;
        </p>
      )}

      {teaserFocus.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted)",
              margin: 0,
            }}
          >
            At {nextStage.label} you&apos;ll be expected to:
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "10px 0 0",
              display: "grid",
              gap: 8,
            }}
          >
            {teaserFocus.map((item, idx) => (
              <li
                key={idx}
                style={{
                  fontFamily: "var(--font-lora), Georgia, serif",
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--text)",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  columnGap: 12,
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
        </div>
      )}

      {mentorship && (
        <p
          style={{
            fontSize: 12,
            color: "var(--muted)",
            margin: "22px 0 0",
            lineHeight: 1.55,
          }}
        >
          {mentorship}
        </p>
      )}
    </section>
  );
}

function StewardshipBlock({
  currentStageId,
}: {
  currentStageId: LeadershipStageId;
}) {
  const stage = LEADERSHIP_STAGES[currentStageId];
  const philosophy = PROMOTION_PHILOSOPHY[currentStageId];

  return (
    <section
      style={{
        background: "var(--bg-2)",
        padding: "36px 40px 40px",
        maxWidth: 880,
      }}
      aria-labelledby="stewardship-heading"
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        What you steward
      </div>
      <h2
        id="stewardship-heading"
        style={{
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: "clamp(26px, 3.5vw, 32px)",
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: "var(--ypp-purple-800)",
          margin: "10px 0 0",
        }}
      >
        {stage.label}.
      </h2>

      {philosophy && (
        <p
          style={{
            fontFamily: "var(--font-lora), Georgia, serif",
            fontStyle: "italic",
            fontSize: 19,
            lineHeight: 1.5,
            color: "var(--text)",
            margin: "18px 0 0",
            maxWidth: "56ch",
          }}
        >
          &ldquo;{philosophy}&rdquo;
        </p>
      )}

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "22px 0 0",
          display: "grid",
          gap: 8,
        }}
      >
        {stage.focusAreas.map((item, idx) => (
          <li
            key={idx}
            style={{
              fontFamily: "var(--font-lora), Georgia, serif",
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--text)",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 12,
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
    </section>
  );
}
