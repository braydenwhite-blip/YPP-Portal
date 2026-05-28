import {
  RATING_ORDER,
  getGoalRatingCopy,
  type RatingAudience,
} from "@/lib/mentorship-rubric-copy";

interface RatingLegendProps {
  /**
   * Who is reading this legend. Drives the label + wording so mentees see
   * supportive copy and mentors/admins see operational copy.
   */
  audience: RatingAudience;
  title?: string;
  /** Compact renders a single horizontal row of chips with no descriptions. */
  compact?: boolean;
}

const MENTEE_NEXT_STEP: Record<string, string> = {
  ABOVE_AND_BEYOND: "Keep going — you may be ready for a stretch goal or a leadership role.",
  ACHIEVED: "Stay consistent and keep the momentum you've built.",
  GETTING_STARTED: "Your mentor will help break the next step into something easy to start.",
  BEHIND_SCHEDULE: "Your mentor and the team will help you reset with a clear, manageable plan.",
};

const OPERATOR_NEXT_STEP: Record<string, string> = {
  ABOVE_AND_BEYOND: "Consider an award nomination or a future mentor/leadership pathway.",
  ACHIEVED: "No action needed — acknowledge the progress.",
  GETTING_STARTED: "Add structure: clarify next steps and recommend a resource.",
  BEHIND_SCHEDULE: "Auto-flags for admin attention. Build a concrete recovery plan.",
};

/**
 * Canonical explainer for the purple / green / yellow / red rubric.
 * Renders the four ratings in canonical order with audience-appropriate
 * meaning and a "what to do next" line. Drop this onto any surface that
 * shows ratings so the rubric never feels random.
 */
export function RatingLegend({ audience, title, compact }: RatingLegendProps) {
  const headingDefault =
    audience === "mentee" ? "What your status colors mean" : "What the rating colors mean";
  const nextSteps = audience === "mentee" ? MENTEE_NEXT_STEP : OPERATOR_NEXT_STEP;

  if (compact) {
    return (
      <div
        role="list"
        aria-label={title ?? headingDefault}
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        {RATING_ORDER.map((rating) => {
          const cfg = getGoalRatingCopy(rating);
          const label = audience === "mentee" ? cfg.menteeLabel : cfg.label;
          return (
            <span
              key={rating}
              role="listitem"
              title={audience === "mentee" ? cfg.menteeDescription : cfg.mentorDescription}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: cfg.background,
                color: cfg.color,
                borderRadius: 999,
                padding: "0.2rem 0.6rem",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <span
                aria-hidden
                style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }}
              />
              {cfg.shortLabel} · {label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <section className="card" aria-label={title ?? headingDefault} style={{ display: "grid", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>{title ?? headingDefault}</h3>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
          {audience === "mentee"
            ? "These colors are about support, not grades. They tell you and your mentor where to focus next."
            : "Every rating maps to a clear next action. Red also flags the relationship for admin attention."}
        </p>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {RATING_ORDER.map((rating) => {
          const cfg = getGoalRatingCopy(rating);
          const label = audience === "mentee" ? cfg.menteeLabel : cfg.label;
          const description =
            audience === "mentee"
              ? cfg.menteeDescription
              : audience === "admin"
                ? cfg.adminDescription
                : cfg.mentorDescription;
          return (
            <div
              key={rating}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 10,
                alignItems: "start",
                padding: "8px 10px",
                borderRadius: 10,
                background: cfg.background,
              }}
            >
              <span
                aria-hidden
                style={{
                  marginTop: 4,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: cfg.color,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: cfg.color, fontSize: "0.85rem" }}>
                    {cfg.shortLabel} — {label}
                  </strong>
                  {cfg.adminAttention && audience !== "mentee" && (
                    <span
                      className="pill"
                      style={{ fontSize: "0.65rem", background: "#fee2e2", color: "#dc2626" }}
                    >
                      Flags admin
                    </span>
                  )}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#1f2937" }}>{description}</p>
                <p style={{ margin: "3px 0 0", fontSize: "0.75rem", fontWeight: 600, color: cfg.color }}>
                  Next: {nextSteps[rating]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default RatingLegend;
