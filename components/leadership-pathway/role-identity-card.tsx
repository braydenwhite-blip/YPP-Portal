import {
  LEADERSHIP_STAGES,
  LeadershipStageId,
  OVERALL_ROLE_MISSION,
} from "@/lib/leadership-pathway";

interface RoleIdentityCardProps {
  stageId: LeadershipStageId | null;
  nextStageId: LeadershipStageId | null;
  /** Compact omits the full mission paragraph; used on profile / G&R headers. */
  compact?: boolean;
  /** Optional hover link target — when present, the card becomes a link. */
  href?: string | null;
}

/**
 * The headline "who you are at YPP" card. Renders the user's current
 * stage with mission, focus areas, mentorship pattern, and a calm
 * "what's next" hint pointing to the next stage.
 *
 * Lives on profile, /my-mentor, the leadership pathway page, and
 * (compact) on the G&R page. Single component, single look.
 */
export function RoleIdentityCard({
  stageId,
  nextStageId,
  compact = false,
  href,
}: RoleIdentityCardProps) {
  if (!stageId) {
    return (
      <div
        className="card"
        style={{
          background: "var(--surface)",
          padding: 16,
          lineHeight: 1.5,
        }}
      >
        <p
          className="badge"
          style={{
            background: "#f1f5f9",
            color: "#475569",
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          Your Role
        </p>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Once your YPP role is assigned, you&apos;ll see your stage,
          mentor, and growth expectations here.
        </p>
      </div>
    );
  }

  const stage = LEADERSHIP_STAGES[stageId];
  const nextStage = nextStageId ? LEADERSHIP_STAGES[nextStageId] : null;

  const inner = (
    <div
      className="card"
      style={{
        background: stage.color.bg,
        border: `1.5px solid ${stage.color.border}`,
        padding: compact ? 14 : 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "3px 10px",
              borderRadius: 999,
              background: stage.color.accent,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Your role at YPP
          </div>
          <h3
            style={{
              margin: "8px 0 4px",
              fontSize: compact ? 18 : 22,
              fontWeight: 700,
              color: stage.color.text,
            }}
          >
            {stage.label}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: stage.color.text,
              opacity: 0.85,
              fontWeight: 500,
            }}
          >
            {stage.tagline}
          </p>
        </div>
        {!compact && nextStage && (
          <div
            style={{
              flex: "0 0 auto",
              maxWidth: 220,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.7)",
              border: "1px dashed var(--border)",
            }}
            aria-label="Next role"
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Path forward
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                marginTop: 2,
              }}
            >
              → {nextStage.label}
            </div>
          </div>
        )}
      </div>

      {!compact && (
        <>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--text)",
            }}
          >
            {stage.mission}
          </p>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: stage.color.text,
              }}
            >
              What this looks like
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--text)",
                display: "grid",
                gap: 4,
              }}
            >
              {stage.focusAreas.map((area, i) => (
                <li key={i}>{area}</li>
              ))}
            </ul>
          </div>
          {stage.promotionWindow && (
            <p
              style={{
                margin: "14px 0 0",
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.65)",
                border: "1px solid var(--border)",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--text)",
              }}
            >
              <strong style={{ color: stage.color.text }}>What&apos;s next:</strong>{" "}
              {stage.promotionWindow}
            </p>
          )}
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 11,
              color: "var(--muted)",
              fontStyle: "italic",
              lineHeight: 1.4,
            }}
          >
            {OVERALL_ROLE_MISSION}
          </p>
        </>
      )}
    </div>
  );

  if (href) {
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    return (
      <a href={href} style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </a>
    );
  }
  return inner;
}
