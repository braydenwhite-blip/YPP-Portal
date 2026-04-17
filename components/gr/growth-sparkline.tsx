"use client";

const RATING_COLORS: Record<string, string> = {
  BEHIND_SCHEDULE: "#ef4444",
  GETTING_STARTED: "#f59e0b",
  ACHIEVED: "#22c55e",
  ABOVE_AND_BEYOND: "#8b5cf6",
};

interface SparkPoint {
  cycleNumber: number;
  rating: string;
}

interface GrowthSparklineProps {
  history: SparkPoint[];
  maxCycles?: number;
}

export function GrowthSparkline({ history, maxCycles = 6 }: GrowthSparklineProps) {
  // Show last N cycles, pad left with nulls if fewer
  const recent = history.slice(-maxCycles);
  const padded: (SparkPoint | null)[] = [
    ...Array(Math.max(0, maxCycles - recent.length)).fill(null),
    ...recent,
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        marginTop: 4,
      }}
      title={`Last ${maxCycles} cycles`}
    >
      {padded.map((pt, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: pt ? (RATING_COLORS[pt.rating] ?? "#94a3b8") : "#e2e8f0",
            flexShrink: 0,
          }}
          title={pt ? `Cycle ${pt.cycleNumber}: ${pt.rating.replace(/_/g, " ")}` : "No data"}
        />
      ))}
    </div>
  );
}
