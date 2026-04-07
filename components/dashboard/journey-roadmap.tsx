import Link from "next/link";

export type RoadmapMilestone = {
  key: string;
  label: string;
  reached: boolean;
  reachedAt?: Date;
  href?: string;
};

interface JourneyRoadmapProps {
  milestones: RoadmapMilestone[];
}

// The full set of milestones in order — user's reached ones are highlighted
const DEFAULT_MILESTONES: { key: string; label: string; href?: string }[] = [
  { key: "FIRST_LOGIN", label: "Joined YPP", href: "/" },
  { key: "FIRST_GOAL_SET", label: "Set first goal", href: "/goals" },
  { key: "FIRST_PATHWAY_STEP", label: "First pathway step", href: "/my-chapter" },
  { key: "FIRST_BADGE", label: "Earned first badge", href: "/badges" },
  { key: "FIRST_CHALLENGE", label: "First challenge", href: "/challenges" },
  { key: "FIVE_PATHWAY_STEPS", label: "5 pathway steps", href: "/my-chapter" },
  { key: "THREE_BADGES", label: "3 badges earned", href: "/badges" },
  { key: "TEN_PATHWAY_STEPS", label: "10 pathway steps", href: "/my-chapter" },
  { key: "FIVE_BADGES", label: "5 badges earned", href: "/badges" },
];

export default function JourneyRoadmap({ milestones }: JourneyRoadmapProps) {
  const reachedKeys = new Set(
    milestones.filter((m) => m.reached).map((m) => m.key)
  );

  // Build combined list
  const roadmap = DEFAULT_MILESTONES.map((def) => ({
    ...def,
    reached: reachedKeys.has(def.key),
  }));

  // Find the index of the last reached milestone
  let lastReachedIdx = -1;
  for (let i = roadmap.length - 1; i >= 0; i--) {
    if (roadmap[i].reached) {
      lastReachedIdx = i;
      break;
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>Your Journey</h3>
        <Link
          href="/my-chapter"
          style={{
            fontSize: 12,
            color: "var(--ypp-purple, #6b21c8)",
            textDecoration: "none",
          }}
        >
          Open chapter hub →
        </Link>
      </div>

      {/* Horizontal scrollable roadmap */}
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 0,
          paddingBottom: 8,
          scrollbarWidth: "thin",
        }}
      >
        {roadmap.map((item, i) => {
          const isCurrentStep = i === lastReachedIdx + 1 && !item.reached;

          return (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {/* Milestone node */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 80,
                }}
              >
                {/* Circle */}
                <div
                  style={{
                    width: isCurrentStep ? 28 : 24,
                    height: isCurrentStep ? 28 : 24,
                    borderRadius: "50%",
                    background: item.reached
                      ? "var(--ypp-purple, #6b21c8)"
                      : isCurrentStep
                        ? "white"
                        : "var(--gray-200, #e2e8f0)",
                    border: isCurrentStep
                      ? "3px solid var(--ypp-purple, #6b21c8)"
                      : "2px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: item.reached ? "white" : "var(--gray-400, #a0aec0)",
                    fontSize: 12,
                    fontWeight: 700,
                    transition: "all 0.2s",
                    boxShadow: isCurrentStep
                      ? "0 0 0 4px var(--ypp-purple-light, #f0e6ff)"
                      : "none",
                  }}
                >
                  {item.reached ? "✓" : i + 1}
                </div>

                {/* Label */}
                {item.href && item.reached ? (
                  <Link
                    href={item.href}
                    style={{
                      fontSize: 11,
                      textAlign: "center",
                      color: item.reached
                        ? "var(--ypp-purple, #6b21c8)"
                        : isCurrentStep
                          ? "var(--gray-700, #2d3748)"
                          : "var(--gray-400, #a0aec0)",
                      fontWeight: item.reached || isCurrentStep ? 600 : 400,
                      lineHeight: 1.3,
                      maxWidth: 80,
                      textDecoration: "none",
                    }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      textAlign: "center",
                      color: item.reached
                        ? "var(--ypp-purple, #6b21c8)"
                        : isCurrentStep
                          ? "var(--gray-700, #2d3748)"
                          : "var(--gray-400, #a0aec0)",
                      fontWeight: item.reached || isCurrentStep ? 600 : 400,
                      lineHeight: 1.3,
                      maxWidth: 80,
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {i < roadmap.length - 1 && (
                <div
                  style={{
                    width: 24,
                    height: 2,
                    background:
                      i < lastReachedIdx
                        ? "var(--ypp-purple, #6b21c8)"
                        : "var(--gray-200, #e2e8f0)",
                    marginTop: -20,
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
