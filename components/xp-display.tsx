"use client";

import { LEVELS } from "@/lib/xp-config";

interface XpDisplayProps {
  xp: number;
  level: number;
}

function getLevelInfo(xp: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl;
    else break;
  }
  const next = LEVELS.find((l) => l.level === current.level + 1);
  const xpIntoLevel = xp - current.xpRequired;
  const xpForNext = next ? next.xpRequired - current.xpRequired : 0;
  const progress = xpForNext > 0 ? xpIntoLevel / xpForNext : 1;
  return { current, next, xpIntoLevel, xpForNext, progress };
}

export default function XpDisplay({ xp, level }: XpDisplayProps) {
  const info = getLevelInfo(xp);

  return (
    <div className="xp-display">
      <div className="xp-level-badge">
        <span className="xp-level-number">{level}</span>
      </div>
      <div className="xp-info">
        <div className="xp-header">
          <span className="xp-title">{info.current.title}</span>
          <span className="xp-amount">{xp} XP</span>
        </div>
        <div className="xp-bar">
          <div
            className="xp-bar-fill"
            style={{ width: `${info.progress * 100}%` }}
          />
        </div>
        <div className="xp-footer">
          {info.next ? (
            <span className="xp-next">
              {info.xpForNext - info.xpIntoLevel} XP to {info.next.title}
            </span>
          ) : (
            <span className="xp-next">Max level reached!</span>
          )}
        </div>
      </div>
    </div>
  );
}
