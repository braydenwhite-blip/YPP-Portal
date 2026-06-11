// Leadership Roles & Contributions — small shared presentational helpers.
// Server-safe (no hooks); reuses the global pill/badge/card classes.

import type {
  AdvisingStatus,
  LeadershipContributionStatus,
  LeadershipExpectedLevel,
} from "@prisma/client";
import {
  ADVISING_STATUS_META,
  CONTRIBUTION_STATUS_META,
  EXPECTED_LEVEL_META,
} from "@/lib/leadership/constants";
import { STANDING_META, type ExpectationProgress } from "@/lib/leadership/expectations";

const TONE_CLASS: Record<string, string> = {
  neutral: "pill-neutral",
  info: "pill-info",
  success: "pill-success",
  warning: "pill-warning",
  danger: "pill-attention",
};

export function StatusPill({ status }: { status: LeadershipContributionStatus }) {
  const meta = CONTRIBUTION_STATUS_META[status];
  return <span className={`pill pill-small ${TONE_CLASS[meta.tone]}`}>{meta.label}</span>;
}

export function AdvisingStatusPill({ status }: { status: AdvisingStatus }) {
  const meta = ADVISING_STATUS_META[status];
  return <span className={`pill pill-small ${TONE_CLASS[meta.tone]}`}>{meta.label}</span>;
}

export function LevelBadge({ level }: { level: LeadershipExpectedLevel }) {
  return <span className="pill pill-small pill-purple">{EXPECTED_LEVEL_META[level].short}</span>;
}

export function WeightBadge({ weight, isOwnership }: { weight: number; isOwnership: boolean }) {
  return (
    <span className="pill pill-small pill-neutral">
      {isOwnership ? "Ownership" : weight >= 2 ? "Meaningful" : "Light"}
    </span>
  );
}

export function StandingPill({ standing }: { standing: ExpectationProgress["standing"] }) {
  const meta = STANDING_META[standing];
  return <span className={`pill pill-small ${TONE_CLASS[meta.tone]}`}>{meta.label}</span>;
}

export function ProgressBar({ percent, met }: { percent: number; met: boolean }) {
  return (
    <div
      style={{
        height: 8,
        borderRadius: 9999,
        background: "var(--gray-100, #f3f4f6)",
        overflow: "hidden",
      }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: 9999,
          background: met ? "#16a34a" : "#7c3aed",
          transition: "width .2s ease",
        }}
      />
    </div>
  );
}

export function formatLeadershipDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
