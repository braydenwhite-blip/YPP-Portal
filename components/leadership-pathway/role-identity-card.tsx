import {
  LEADERSHIP_STAGES,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface RoleIdentityCardProps {
  stageId: LeadershipStageId | null;
  nextStageId: LeadershipStageId | null;
  /**
   * Compact = a slim, typographic header (no bullets, no mission paragraph).
   * Full = used only on the /leadership-pathway hero and renders the
   * full role narrative.
   */
  compact?: boolean;
}

/**
 * Typographic role header. White surface, a 3px stage-tone accent on
 * the left, and otherwise no card chrome. Compact mode is the
 * default; the full mode is reserved for the canonical pathway page.
 */
export function RoleIdentityCard({
  stageId,
  nextStageId,
  compact = false,
}: RoleIdentityCardProps) {
  if (!stageId) {
    return (
      <div
        style={{
          padding: "12px 16px",
          borderLeft: "3px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Your role
        </div>
        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
          Once your YPP role is assigned, you&apos;ll see it here.
        </p>
      </div>
    );
  }

  const stage = LEADERSHIP_STAGES[stageId];
  const nextStage = nextStageId ? LEADERSHIP_STAGES[nextStageId] : null;

  if (compact) {
    return (
      <div
        style={{
          padding: "12px 16px",
          borderLeft: `3px solid ${stage.color.accent}`,
          background: "var(--surface)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Your role
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              marginTop: 2,
            }}
          >
            {stage.label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.45,
              marginTop: 2,
            }}
          >
            {stage.tagline}
          </div>
        </div>
        {nextStage && (
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            Next →{" "}
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {nextStage.label}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Full mode — used only on the /leadership-pathway hero.
  return (
    <div
      style={{
        padding: "20px 24px",
        borderLeft: `3px solid ${stage.color.accent}`,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        You are here
      </div>
      <h2
        style={{
          margin: "4px 0 6px",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--text)",
        }}
      >
        {stage.label}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          color: "var(--muted)",
          lineHeight: 1.5,
        }}
      >
        {stage.mission}
      </p>
      {nextStage && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          Next stage:{" "}
          <span style={{ color: "var(--text)", fontWeight: 600 }}>
            {nextStage.label}
          </span>
          {stage.promotionWindow ? ` — ${stage.promotionWindow}` : ""}
        </p>
      )}
    </div>
  );
}
