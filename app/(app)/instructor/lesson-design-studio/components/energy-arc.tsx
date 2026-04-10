"use client";

import { useId } from "react";
import type { EnergyLevel } from "../types";

interface TimelineEnergyPoint {
  id: string;
  startMin: number;
  endMin: number;
  energyLevel: EnergyLevel | null;
}

interface EnergyArcProps {
  activities: TimelineEnergyPoint[];
  width: number;
  height?: number;
  pixelsPerMinute: number;
}

function mapEnergyToY(level: EnergyLevel | null, height: number) {
  switch (level) {
    case "HIGH":
      return height * 0.18;
    case "LOW":
      return height * 0.82;
    default:
      return height * 0.5;
  }
}

export function EnergyArc({
  activities,
  width,
  height = 74,
  pixelsPerMinute,
}: EnergyArcProps) {
  const gradientId = useId().replace(/:/g, "");

  if (activities.length === 0 || width <= 0) {
    return null;
  }

  const points: string[] = [];

  activities.forEach((activity, index) => {
    const y = mapEnergyToY(activity.energyLevel, height);
    const startX = activity.startMin * pixelsPerMinute;
    const centerX = (activity.startMin + activity.endMin) / 2 * pixelsPerMinute;
    const endX = activity.endMin * pixelsPerMinute;

    if (index === 0) {
      points.push(`${startX},${y}`);
    }

    points.push(`${centerX},${y}`);
    points.push(`${endX},${y}`);
  });

  return (
    <div className="lds-energy-arc" aria-hidden="true">
      <svg
        className="lds-energy-arc-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.92)" />
            <stop offset="50%" stopColor="rgba(245,158,11,0.9)" />
            <stop offset="100%" stopColor="rgba(239,68,68,0.92)" />
          </linearGradient>
        </defs>

        <line
          x1="0"
          y1={height * 0.18}
          x2={width}
          y2={height * 0.18}
          className="lds-energy-arc-guide"
        />
        <line
          x1="0"
          y1={height * 0.5}
          x2={width}
          y2={height * 0.5}
          className="lds-energy-arc-guide"
        />
        <line
          x1="0"
          y1={height * 0.82}
          x2={width}
          y2={height * 0.82}
          className="lds-energy-arc-guide"
        />

        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lds-energy-arc-line"
        />
      </svg>

      <div className="lds-energy-arc-labels">
        <span>High</span>
        <span>Medium</span>
        <span>Low</span>
      </div>
    </div>
  );
}
