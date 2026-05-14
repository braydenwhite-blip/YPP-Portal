import {
  LEADERSHIP_STAGES,
  LEADERSHIP_STAGE_ORDER,
  LeadershipStageId,
} from "@/lib/leadership-pathway";

interface StageRibbonProps {
  currentStageId: LeadershipStageId | null;
}

/**
 * A quiet step indicator: dot · line · dot. The current stage gets a
 * filled dot in its tone; past stages are filled gray; future stages
 * are outlined. No card chrome, no tagline, no "Stage N" prefix —
 * just the progression.
 */
export function StageRibbon({ currentStageId }: StageRibbonProps) {
  const stages = LEADERSHIP_STAGE_ORDER.map((id) => LEADERSHIP_STAGES[id]);
  const currentIndex = currentStageId
    ? LEADERSHIP_STAGE_ORDER.indexOf(currentStageId)
    : -1;

  return (
    <div
      role="group"
      aria-label="Instructor leadership pathway"
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        width: "100%",
        overflowX: "auto",
      }}
    >
      {stages.map((stage, idx) => {
        const isCurrent = idx === currentIndex;
        const isPast = currentIndex >= 0 && idx < currentIndex;
        const isFirst = idx === 0;
        const isLast = idx === stages.length - 1;
        const dotColor = isCurrent
          ? stage.color.accent
          : isPast
            ? "var(--muted)"
            : "transparent";
        const dotBorder = isCurrent
          ? stage.color.accent
          : isPast
            ? "var(--muted)"
            : "var(--border)";
        return (
          <div
            key={stage.id}
            style={{
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: 12,
              }}
            >
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: isFirst ? "transparent" : "var(--border)",
                }}
                aria-hidden
              />
              <span
                aria-hidden
                style={{
                  width: isCurrent ? 10 : 8,
                  height: isCurrent ? 10 : 8,
                  borderRadius: "50%",
                  background: dotColor,
                  border: `1.5px solid ${dotBorder}`,
                  flex: "0 0 auto",
                }}
              />
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: isLast ? "transparent" : "var(--border)",
                }}
                aria-hidden
              />
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent
                  ? stage.color.text
                  : isPast
                    ? "var(--text)"
                    : "var(--muted)",
                textAlign: "center",
                lineHeight: 1.3,
                padding: "0 4px",
              }}
            >
              {stage.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
