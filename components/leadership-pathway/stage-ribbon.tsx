import {
  LEADERSHIP_STAGES,
  LEADERSHIP_STAGE_ORDER,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface StageRibbonProps {
  currentStageId: LeadershipStageId | null;
  /** When true, render compact "chip" mode for headers; otherwise full ribbon. */
  compact?: boolean;
  /** Optional click handler — when omitted, ribbon is purely visual. */
}

/**
 * A continuous, calm visualization of the YPP leadership pathway with the
 * current user's stage highlighted. Used at the top of the Leadership
 * Pathway page, on the My Mentor page, and (compact) on the G&R header.
 *
 * Deliberately not gamified: no XP bars, no "levels", no medals — just a
 * quiet, prestigious line that says "you are part of a pipeline."
 */
export function StageRibbon({ currentStageId, compact = false }: StageRibbonProps) {
  const stages = LEADERSHIP_STAGE_ORDER.map((id) => LEADERSHIP_STAGES[id]);
  const currentIndex = currentStageId
    ? LEADERSHIP_STAGE_ORDER.indexOf(currentStageId)
    : -1;

  return (
    <div
      role="group"
      aria-label="YPP instructor leadership pathway"
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: compact ? "10px 12px" : "16px 18px",
        overflowX: "auto",
        flexWrap: compact ? "nowrap" : "wrap",
      }}
    >
      {stages.map((stage, idx) => {
        const isCurrent = idx === currentIndex;
        const isPast = currentIndex >= 0 && idx < currentIndex;
        const isFuture = currentIndex >= 0 && idx > currentIndex;
        const isUnknown = currentIndex < 0;

        return (
          <div
            key={stage.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: compact ? "0 0 auto" : "1 1 0",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                alignItems: "flex-start",
                padding: compact ? "4px 10px" : "8px 12px",
                background: isCurrent
                  ? stage.color.bg
                  : isPast
                    ? "rgba(0,0,0,0.02)"
                    : "transparent",
                border: isCurrent
                  ? `1.5px solid ${stage.color.border}`
                  : "1px solid transparent",
                borderRadius: 10,
                minWidth: 0,
                flex: "1 1 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: compact ? 11 : 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: isCurrent
                    ? stage.color.text
                    : isPast
                      ? "var(--muted)"
                      : isFuture
                        ? "var(--muted)"
                        : "var(--muted)",
                  opacity: isUnknown || isFuture ? 0.65 : 1,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isCurrent
                      ? stage.color.accent
                      : isPast
                        ? "var(--muted)"
                        : "transparent",
                    border: isFuture
                      ? "1.5px solid var(--border)"
                      : `1.5px solid ${isCurrent ? stage.color.accent : "var(--muted)"}`,
                  }}
                />
                Stage {idx + 1}
              </div>
              <div
                style={{
                  fontSize: compact ? 13 : 15,
                  fontWeight: isCurrent ? 700 : 600,
                  color: isCurrent ? stage.color.text : "var(--text)",
                  opacity: isFuture ? 0.7 : 1,
                  whiteSpace: compact ? "nowrap" : "normal",
                }}
              >
                {stage.label}
              </div>
              {!compact && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    opacity: isFuture ? 0.7 : 1,
                    lineHeight: 1.35,
                  }}
                >
                  {stage.tagline}
                </div>
              )}
              {isCurrent && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: stage.color.text,
                  }}
                  aria-label="You are here"
                >
                  You are here
                </div>
              )}
            </div>
            {idx < stages.length - 1 && (
              <span
                aria-hidden
                style={{
                  fontSize: 14,
                  color: "var(--muted)",
                  opacity: 0.5,
                  padding: "0 2px",
                  alignSelf: "center",
                }}
              >
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
