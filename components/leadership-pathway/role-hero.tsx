import {
  LEADERSHIP_STAGES,
  LeadershipStage,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface RoleHeroProps {
  stageId: LeadershipStageId;
  /**
   * When the user is on the Workshop Instructor pathway, the hero renders
   * as Instructor with a small "Workshop entry" pill — the workshop flow
   * is treated as a flavor of Instructor, never a separate visible stage.
   */
  instructorSubtype?: "STANDARD" | "SUMMER_WORKSHOP" | null;
}

const VISIBLE_STAGE_NUMBER: Record<LeadershipStageId, number> = {
  WORKSHOP_INSTRUCTOR: 1,
  INSTRUCTOR: 1,
  SENIOR_INSTRUCTOR: 2,
  LEAD_INSTRUCTOR: 3,
  ORGANIZATIONAL_LEADERSHIP: 4,
};

const VISIBLE_STAGE_TOTAL = 4;

/**
 * The role hero — the emotional anchor of /leadership-pathway.
 *
 * Typographic, white surface, no card chrome, bottom-edge accent stripe
 * (not left-edge — bottom-edge reads as "chapter heading" and signals
 * primacy on the page). Playfair display title in 56–64px.
 *
 * Workshop users see the Instructor hero with a small "Workshop entry"
 * pill — the only color separation. This honors the directive to never
 * visually separate Workshop Instructor from Instructor.
 */
export function RoleHero({ stageId, instructorSubtype }: RoleHeroProps) {
  const isWorkshop =
    stageId === "WORKSHOP_INSTRUCTOR" ||
    instructorSubtype === "SUMMER_WORKSHOP";

  // Workshop renders as Instructor everywhere visually.
  const displayStage: LeadershipStage = isWorkshop
    ? LEADERSHIP_STAGES.INSTRUCTOR
    : LEADERSHIP_STAGES[stageId];

  // For the "stage 02 of 4" indicator, workshop counts as Instructor (1/4).
  const displayNumber = VISIBLE_STAGE_NUMBER[isWorkshop ? "INSTRUCTOR" : stageId];

  const eyebrowLabel = isWorkshop ? "Workshop pathway" : "Your role";

  return (
    <section
      style={{
        position: "relative",
        background: "var(--surface)",
        padding: "48px 40px 44px",
        maxWidth: 880,
      }}
      aria-labelledby="role-hero-title"
    >
      {/* Bottom-edge accent stripe — not left-edge. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          background: displayStage.color.accent,
        }}
      />

      {/* Eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        <span>
          Stage {String(displayNumber).padStart(2, "0")} of{" "}
          {String(VISIBLE_STAGE_TOTAL).padStart(2, "0")}
        </span>
        <span aria-hidden style={{ color: "var(--border)" }}>
          ·
        </span>
        <span>{eyebrowLabel}</span>
      </div>

      {/* Playfair display title */}
      <h1
        id="role-hero-title"
        style={{
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: "clamp(36px, 6vw, 60px)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          color: "var(--ypp-purple-800)",
          margin: "12px 0 0",
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span>{displayStage.label}.</span>
        {isWorkshop && (
          <span
            style={{
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: LEADERSHIP_STAGES.WORKSHOP_INSTRUCTOR.color.text,
              background: LEADERSHIP_STAGES.WORKSHOP_INSTRUCTOR.color.bg,
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${LEADERSHIP_STAGES.WORKSHOP_INSTRUCTOR.color.border}`,
              whiteSpace: "nowrap",
              alignSelf: "center",
            }}
          >
            Workshop entry
          </span>
        )}
      </h1>

      {/* Italic tagline */}
      <p
        style={{
          fontFamily: "var(--font-lora), Georgia, serif",
          fontStyle: "italic",
          fontSize: 18,
          lineHeight: 1.45,
          color: "var(--muted)",
          margin: "14px 0 0",
          maxWidth: "56ch",
        }}
      >
        {displayStage.tagline}.
      </p>

      {/* Body mission */}
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: "var(--text)",
          margin: "20px 0 0",
          maxWidth: "64ch",
        }}
      >
        {isWorkshop
          ? LEADERSHIP_STAGES.WORKSHOP_INSTRUCTOR.mission
          : displayStage.mission}
      </p>

      {/* Promotion / cadence signature line */}
      {displayStage.promotionWindow && (
        <p
          style={{
            fontSize: 12,
            color: "var(--muted)",
            margin: "24px 0 0",
            lineHeight: 1.55,
          }}
        >
          {displayStage.promotionWindow}
        </p>
      )}
    </section>
  );
}
