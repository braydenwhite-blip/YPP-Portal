"use client";

import NudgeBanner from "@/components/nudge-banner";
import type { NudgeData } from "@/lib/nudge-engine";

interface NudgeStripProps {
  nudges: NudgeData[];
}

export default function NudgeStrip({ nudges }: NudgeStripProps) {
  if (nudges.length === 0) return null;

  // Show at most 3 nudges
  const displayNudges = nudges.slice(0, 3);

  return (
    <div style={{ marginBottom: 16 }}>
      {displayNudges.map((nudge) => (
        <NudgeBanner key={nudge.id} nudge={nudge} />
      ))}
    </div>
  );
}
