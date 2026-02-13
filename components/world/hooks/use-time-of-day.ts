"use client";

import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// Time-of-Day System — Maps real wall-clock to sky/lighting params
// ═══════════════════════════════════════════════════════════════

export type TimePhase = "DAWN" | "DAY" | "DUSK" | "NIGHT";

export interface TimeOfDayData {
  /** Current hour [0-24) as a fractional number */
  hour: number;
  /** Discrete phase label */
  phase: TimePhase;
  /** Sun elevation angle in degrees (negative = below horizon) */
  sunElevation: number;
  /** Sun azimuth in radians */
  sunAzimuth: number;
  /** Sun 3D position for Sky component */
  sunPosition: [number, number, number];
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Ambient light color */
  ambientColor: string;
  /** Directional (sun/moon) light intensity */
  directionalIntensity: number;
  /** Directional light color */
  directionalColor: string;
  /** Hemisphere sky color */
  hemiSkyColor: string;
  /** Hemisphere ground color */
  hemiGroundColor: string;
  /** Hemisphere intensity */
  hemiIntensity: number;
  /** Fog near distance */
  fogNear: number;
  /** Fog far distance */
  fogFar: number;
  /** Fog color */
  fogColor: string;
  /** Sky turbidity (haziness) */
  turbidity: number;
  /** Sky rayleigh scattering */
  rayleigh: number;
  /** 0=full night, 1=full day – useful for lerp */
  dayFactor: number;
  /** Stars visibility [0-1] */
  starsOpacity: number;
  /** Ocean color tint */
  oceanColor: string;
}

/** Smoothstep for blending between phases */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Hex color lerp */
function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Compute the current in-game hour from wall clock */
function getCurrentHour(accelerated: boolean): number {
  const now = new Date();
  if (accelerated) {
    // 1 real hour = 1 in-game day (24h cycle). Minutes map to hours.
    return (now.getMinutes() + now.getSeconds() / 60) / 60 * 24;
  }
  return now.getHours() + now.getMinutes() / 60;
}

/**
 * Compute time-of-day parameters from the real wall-clock.
 * Updates every 10 seconds so the sky transitions smoothly.
 * Initial state is always noon (hour=12) to guarantee a well-lit scene.
 */
export function useTimeOfDay(accelerated = true): TimeOfDayData {
  // Start at noon to guarantee the scene is visible on first render
  const [timeData, setTimeData] = useState<TimeOfDayData>(() => computeTimeParams(12));

  useEffect(() => {
    // Immediately compute current time after mount
    setTimeData(computeTimeParams(getCurrentHour(accelerated)));

    // Update every 10 seconds for smooth transitions
    const interval = setInterval(() => {
      setTimeData(computeTimeParams(getCurrentHour(accelerated)));
    }, 10_000);

    return () => clearInterval(interval);
  }, [accelerated]);

  return timeData;
}

/** Pure function: given an hour [0-24), produce all visual parameters */
export function computeTimeParams(hour: number): TimeOfDayData {
  // Phase boundaries (hours)
  //   Night:  0-5    (deep night)
  //   Dawn:   5-7    (sunrise transition)
  //   Day:    7-17   (full daylight)
  //   Dusk:   17-19  (sunset transition)
  //   Night:  19-24  (deep night)

  let phase: TimePhase;
  let dayFactor: number;

  if (hour < 5) {
    phase = "NIGHT";
    dayFactor = 0;
  } else if (hour < 7) {
    phase = "DAWN";
    dayFactor = smoothstep(5, 7, hour);
  } else if (hour < 17) {
    phase = "DAY";
    dayFactor = 1;
  } else if (hour < 19) {
    phase = "DUSK";
    dayFactor = 1 - smoothstep(17, 19, hour);
  } else {
    phase = "NIGHT";
    dayFactor = 0;
  }

  // Sun position
  // Azimuth rotates from east (sunrise) to west (sunset)
  const sunAzimuth = ((hour - 6) / 12) * Math.PI; // 0 at 6am, π at 6pm
  // Elevation peaks at noon
  const sunElevation = Math.sin(((hour - 6) / 12) * Math.PI) * 75;

  const sunDist = 400;
  const elRad = (Math.max(sunElevation, -10) * Math.PI) / 180;
  const sunPosition: [number, number, number] = [
    Math.cos(sunAzimuth) * Math.cos(elRad) * sunDist,
    Math.sin(elRad) * sunDist,
    Math.sin(sunAzimuth) * Math.cos(elRad) * sunDist,
  ];

  // Lighting — night minimums raised so the scene is always visible
  const ambientIntensity = lerp(0.35, 0.6, dayFactor);
  const ambientColor = lerpColor("#2a3a5a", "#ffffff", dayFactor);
  const directionalIntensity = lerp(0.3, 1.2, dayFactor);

  // Warm sunrise/sunset tint
  const isGoldenHour = (hour >= 5 && hour <= 8) || (hour >= 16 && hour <= 19);
  const goldenFactor = isGoldenHour
    ? 1 - Math.abs(((hour >= 16 ? hour - 17.5 : hour - 6.5) / 1.5))
    : 0;
  const clampedGolden = Math.max(0, Math.min(1, goldenFactor));
  const directionalColor = lerpColor(
    lerpColor("#4466aa", "#fff5e0", dayFactor),
    "#ffaa44",
    clampedGolden * 0.6,
  );

  // Hemisphere lighting
  const hemiSkyColor = lerpColor("#1a2a40", "#87ceeb", dayFactor);
  const hemiGroundColor = lerpColor("#1a2a20", "#3a6b35", dayFactor);
  const hemiIntensity = lerp(0.15, 0.3, dayFactor);

  // Fog — pushed far back so the scene is never swallowed
  const fogNear = lerp(120, 150, dayFactor);
  const fogFar = lerp(400, 500, dayFactor);
  const fogColor = lerpColor("#0f1a2e", "#c8dff5", dayFactor);

  // Sky shader params
  const turbidity = lerp(2, 8, dayFactor);
  const rayleigh = lerp(0.5, 2, dayFactor);

  // Stars
  const starsOpacity = 1 - smoothstep(5, 7, hour >= 12 ? 24 - hour : hour);

  // Ocean color shifts
  const oceanColor = lerpColor("#051525", "#0369a1", dayFactor);

  return {
    hour,
    phase,
    sunElevation,
    sunAzimuth,
    sunPosition,
    ambientIntensity,
    ambientColor,
    directionalIntensity,
    directionalColor,
    hemiSkyColor,
    hemiGroundColor,
    hemiIntensity,
    fogNear,
    fogFar,
    fogColor,
    turbidity,
    rayleigh,
    dayFactor,
    starsOpacity,
    oceanColor,
  };
}

/** Get the current season from real-world month */
export type Season = "SPRING" | "SUMMER" | "FALL" | "WINTER";
export function getCurrentSeason(): Season {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return "SPRING";
  if (month >= 5 && month <= 7) return "SUMMER";
  if (month >= 8 && month <= 10) return "FALL";
  return "WINTER";
}
