"use client";

import type { GoalNode } from "@/lib/training-phases";
import TrainingGoalCard from "./training-goal-card";
import styles from "./training-roadmap.module.css";

/**
 * TrainingGoalRoadmap — the GOAL-mirrored pathway that replaces the old
 * three-phase map. Renders the Academy as a sequential spine of nodes
 * (Welcome → GOAL 1–5 → Readiness Check → Lesson Design Studio), each a
 * TrainingGoalCard. The vocabulary comes from `lib/training-goals.ts` via the
 * view model, so the roadmap always mirrors the official role framework.
 */
export default function TrainingGoalRoadmap({
  goals,
  justCompletedId = null,
}: {
  goals: GoalNode[];
  /** Node the instructor just returned from — animates its check-in. */
  justCompletedId?: string | null;
}) {
  return (
    <ol className={styles.roadmap}>
      {goals.map((node, idx) => (
        <TrainingGoalCard
          key={node.id}
          node={node}
          position={idx + 1}
          justChecked={node.id === justCompletedId && node.state === "complete"}
        />
      ))}
    </ol>
  );
}
