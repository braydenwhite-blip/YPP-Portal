// Per-node health, in the same transparent shape used for chapter health
// (label + tone + 0–100 score + concrete reasons). Never a black box — every
// label is backed by reasons a human can verify. Pure + deterministic.

import type {
  ClassInput,
  CurriculumInput,
  NodeHealth,
  NodeKind,
  PartnerInput,
  NodeDependency,
} from "@/lib/organization/types";

const CHAPTER_LIFECYCLE_HEALTH: Record<string, NodeHealth> = {
  ACTIVE: { label: "On Track", tone: "success", score: 100, reasons: ["Chapter is active"] },
  LAUNCHING: { label: "Launching", tone: "neutral", score: 80, reasons: ["Chapter is launching"] },
  NEEDS_SUPPORT: { label: "Needs Support", tone: "warning", score: 55, reasons: ["Flagged as needing support"] },
  AT_RISK: { label: "At Risk", tone: "danger", score: 30, reasons: ["Flagged as at risk"] },
  PAUSED: { label: "Paused", tone: "neutral", score: 0, reasons: ["Chapter is paused"] },
};

/** Fallback chapter health when the loader doesn't supply a computed one. */
export function chapterNodeHealth(lifecycleStatus: string): NodeHealth {
  return (
    CHAPTER_LIFECYCLE_HEALTH[lifecycleStatus] ?? {
      label: "Unknown",
      tone: "neutral",
      score: 70,
      reasons: ["No lifecycle signal"],
    }
  );
}

export function partnerNodeHealth(p: PartnerInput): NodeHealth {
  const reasons: string[] = [];
  let score = 100;
  if (p.openIssues > 0) {
    score -= 25 * Math.min(p.openIssues, 2);
    reasons.push(`${p.openIssues} open issue${p.openIssues === 1 ? "" : "s"}`);
  }
  if (!p.confirmed) {
    score -= 15;
    reasons.push(`Relationship still in progress (${p.stageLabel})`);
  } else {
    reasons.push("Partnership confirmed");
  }
  return labelFromScore(score, reasons);
}

export function curriculumNodeHealth(c: CurriculumInput): NodeHealth {
  if (c.approved) return { label: "Approved", tone: "success", score: 100, reasons: ["Fully approved"] };
  if (c.submitted) return { label: "In Review", tone: "warning", score: 60, reasons: ["Submitted, awaiting approval"] };
  return { label: "Not Started", tone: "neutral", score: 40, reasons: ["Not yet submitted for review"] };
}

const RUNTIME_HEALTH: Record<ClassInput["health"], { label: string; tone: NodeHealth["tone"]; score: number }> = {
  healthy: { label: "Healthy", tone: "success", score: 100 },
  watch: { label: "Watch", tone: "warning", score: 70 },
  at_risk: { label: "At Risk", tone: "danger", score: 45 },
  critical: { label: "Critical", tone: "danger", score: 20 },
  unknown: { label: "No Data Yet", tone: "neutral", score: 80 },
};

export function classNodeHealth(c: ClassInput): NodeHealth {
  const base = RUNTIME_HEALTH[c.health];
  const reasons: string[] = [];
  if (c.attendancePercent != null) reasons.push(`Attendance ${c.attendancePercent}%`);
  if (c.averageRating != null) reasons.push(`Rating ${c.averageRating.toFixed(1)}★`);
  if (c.interventionNeeded) reasons.push("Intervention needed");
  if (!c.isLive && !c.isCompleted) reasons.push(`In setup — ${c.stageLabel}`);
  if (reasons.length === 0) reasons.push(c.stageLabel);
  return { label: base.label, tone: base.tone, score: base.score, reasons };
}

/** A student's health is read from the classes they're enrolled in. */
export function personNodeHealth(classes: ClassInput[]): NodeHealth {
  if (classes.length === 0)
    return { label: "Not Enrolled", tone: "neutral", score: 100, reasons: ["No active enrollment yet"] };
  const live = classes.filter((c) => c.isLive);
  const reasons: string[] = [];
  const atRisk = classes.filter((c) => c.health === "at_risk" || c.health === "critical");
  const attended = live.filter((c) => c.attendancePercent != null);
  const avgAttendance =
    attended.length > 0
      ? Math.round(attended.reduce((s, c) => s + (c.attendancePercent ?? 0), 0) / attended.length)
      : null;
  let score = 100;
  if (avgAttendance != null) {
    reasons.push(`Average attendance ${avgAttendance}%`);
    if (avgAttendance < 60) score -= 40;
    else if (avgAttendance < 80) score -= 15;
  }
  if (atRisk.length > 0) {
    score -= 20;
    reasons.push(`${atRisk.length} of their classes need attention`);
  }
  reasons.push(`Enrolled in ${classes.length} class${classes.length === 1 ? "" : "es"}`);
  return labelFromScore(score, reasons);
}

/**
 * Roll an instructor's or partner's health up from the classes they touch,
 * folding in any blocking dependencies attributed to them.
 */
export function rollupHealth(kind: NodeKind, classes: ClassInput[], deps: NodeDependency[]): NodeHealth {
  const reasons: string[] = [];
  let score = 100;

  const blocking = deps.filter((d) => d.blocking && d.state === "blocked");
  if (blocking.length > 0) {
    score -= 20 * Math.min(blocking.length, 2);
    reasons.push(`${blocking.length} blocking item${blocking.length === 1 ? "" : "s"}`);
  }

  const live = classes.filter((c) => c.isLive);
  const atRisk = classes.filter((c) => c.health === "at_risk" || c.health === "critical");
  const intervention = classes.filter((c) => c.interventionNeeded);

  if (kind === "instructor") {
    reasons.push(`Teaching ${live.length} live class${live.length === 1 ? "" : "es"}`);
    if (live.length >= 4) {
      score -= 15;
      reasons.push("Heavy teaching load");
    }
  } else {
    reasons.push(`${classes.length} class${classes.length === 1 ? "" : "es"} operating here`);
  }

  if (intervention.length > 0) {
    score -= 25;
    reasons.push(`${intervention.length} class${intervention.length === 1 ? "" : "es"} need intervention`);
  } else if (atRisk.length > 0) {
    score -= 15;
    reasons.push(`${atRisk.length} class${atRisk.length === 1 ? "" : "es"} at risk`);
  }

  return labelFromScore(score, reasons);
}

function labelFromScore(rawScore: number, reasons: string[]): NodeHealth {
  const score = Math.max(0, Math.min(100, rawScore));
  let label: string;
  let tone: NodeHealth["tone"];
  if (score >= 80) {
    label = "Healthy";
    tone = "success";
  } else if (score >= 55) {
    label = "Needs Attention";
    tone = "warning";
  } else {
    label = "At Risk";
    tone = "danger";
  }
  if (reasons.length === 0) reasons.push("All signals look healthy");
  return { label, tone, score, reasons };
}
