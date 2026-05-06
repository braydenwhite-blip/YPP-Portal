"use client";

/**
 * RoomMeters — three subtle bars that visualise live workshop state.
 *
 *   Engagement · Clarity · Energy
 *
 * Each is a 0–100% value. The JourneyPlayer accumulates roomDelta values
 * from BeatFeedback across the session; this component just renders the
 * current level. When a value moves, the bar slides; on a downward move
 * it briefly tints red, on an upward move briefly green.
 *
 * The component renders nothing if all three meters are at the baseline
 * AND no beat in the session has emitted a delta yet — keeps the HUD
 * invisible for legacy content that hasn't been authored as a sim.
 */

import { useEffect, useRef, useState } from "react";

export type RoomState = {
  engagement: number;
  clarity: number;
  energy: number;
};

export type RoomMetersProps = {
  state: RoomState;
  /** When false, the HUD stays hidden (the journey hasn't emitted any
   *  roomDelta yet, so the meters carry no signal). */
  active: boolean;
};

const METERS: { key: keyof RoomState; label: string; emoji: string }[] = [
  { key: "engagement", label: "Engagement", emoji: "👀" },
  { key: "clarity", label: "Clarity", emoji: "💡" },
  { key: "energy", label: "Energy", emoji: "⚡" },
];

function clampPct(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

type FlashDirection = "up" | "down" | "up-strong" | "down-strong";

const STRONG_DELTA_THRESHOLD = 12; // ≥ 12 percentage points → "wow" shimmer

function levelState(value: number): "critical" | "hot" | null {
  if (value < 25) return "critical";
  if (value > 90) return "hot";
  return null;
}

export function RoomMeters({ state, active }: RoomMetersProps) {
  const prevRef = useRef<RoomState>(state);
  const [flash, setFlash] = useState<Partial<Record<keyof RoomState, FlashDirection>>>({});

  useEffect(() => {
    const prev = prevRef.current;
    const next: typeof flash = {};
    (Object.keys(state) as (keyof RoomState)[]).forEach((k) => {
      const diff = state[k] - prev[k];
      if (diff > 0) {
        next[k] = diff >= STRONG_DELTA_THRESHOLD ? "up-strong" : "up";
      } else if (diff < 0) {
        next[k] = -diff >= STRONG_DELTA_THRESHOLD ? "down-strong" : "down";
      }
    });
    prevRef.current = state;
    if (Object.keys(next).length === 0) return;
    setFlash(next);
    // "Strong" flashes hold a touch longer so the shimmer lands.
    const hold = Object.values(next).some((d) => d?.endsWith("strong")) ? 950 : 700;
    const id = setTimeout(() => setFlash({}), hold);
    return () => clearTimeout(id);
  }, [state]);

  if (!active) return null;

  return (
    <div
      className="room-meters"
      role="group"
      aria-label="Workshop room state"
    >
      {METERS.map(({ key, label, emoji }) => {
        const value = clampPct(state[key]);
        const dir = flash[key];
        const lvl = levelState(value);
        return (
          <div
            key={key}
            className="room-meters__row"
            data-flash={dir}
            data-state={lvl ?? undefined}
            aria-label={`${label} ${value}%${lvl === "critical" ? " — critical" : ""}`}
          >
            <span className="room-meters__label" aria-hidden="true">
              <span className="room-meters__emoji">{emoji}</span>
              {label}
            </span>
            <span className="room-meters__track" aria-hidden="true">
              <span
                className="room-meters__fill"
                style={{ width: `${value}%` }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
