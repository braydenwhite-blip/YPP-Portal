"use client";

import type { ExamplePlan, ExampleAnnotation } from "../examples-data";
import { AnnotationCallout } from "./annotation-callout";

const ACTIVITY_COLORS: Record<string, string> = {
  WARM_UP: "#f59e0b",
  INSTRUCTION: "#3b82f6",
  PRACTICE: "#22c55e",
  DISCUSSION: "#8b5cf6",
  ASSESSMENT: "#ef4444",
  BREAK: "#6b7280",
  REFLECTION: "#ec4899",
  GROUP_WORK: "#14b8a6",
};

const ACTIVITY_LABELS: Record<string, string> = {
  WARM_UP: "Warm Up",
  INSTRUCTION: "Instruction",
  PRACTICE: "Practice",
  DISCUSSION: "Discussion",
  ASSESSMENT: "Assessment",
  BREAK: "Break",
  REFLECTION: "Reflection",
  GROUP_WORK: "Group Work",
};

interface ExampleCardProps {
  plan: ExamplePlan;
  annotations: ExampleAnnotation[];
}

export function ExampleCard({ plan, annotations }: ExampleCardProps) {
  const annotationMap = new Map(annotations.map((a) => [a.activityId, a]));
  const totalMin = plan.activities.reduce((s, a) => s + a.durationMin, 0);

  return (
    <div className={`os-example-card ${plan.quality}`}>
      {/* Card header */}
      <div className="os-example-card-header">
        <TrafficLightsSmall />
        <div className="os-example-card-meta">
          <div className="os-example-card-title">{plan.title}</div>
          <div className="os-example-card-sub">
            {plan.ageGroup} · {totalMin} min · In-person
          </div>
        </div>
        <div
          className="os-example-status-dot"
          title={plan.quality === "good" ? "Good example" : "Bad example"}
        />
      </div>

      {/* Timeline bar */}
      <div className="os-timeline-bar" style={{ margin: "10px 20px 0" }}>
        {plan.activities.map((a) => (
          <div
            key={a.id}
            className="os-timeline-segment"
            style={{
              width: `${(a.durationMin / totalMin) * 100}%`,
              background: ACTIVITY_COLORS[a.type] ?? "#6b7280",
            }}
            title={`${a.title} — ${a.durationMin} min`}
          />
        ))}
      </div>

      {/* Description */}
      <div style={{ padding: "12px 20px 4px", fontSize: 13, color: "var(--os-text-muted)", lineHeight: 1.6 }}>
        {plan.description}
      </div>

      {/* Overall note */}
      <div style={{ padding: "0 20px 12px" }}>
        <AnnotationCallout
          note={plan.overallNote}
          sentiment={plan.quality === "good" ? "positive" : "negative"}
        />
      </div>

      {/* Activities */}
      <div className="os-example-body">
        {plan.activities.map((activity) => {
          const annotation = annotationMap.get(activity.id);
          return (
            <div key={activity.id}>
              <div className="os-activity-row">
                <div
                  className="os-activity-type-dot"
                  style={{ background: ACTIVITY_COLORS[activity.type] ?? "#6b7280" }}
                />
                <div className="os-activity-info">
                  <div className="os-activity-title">{activity.title}</div>
                  <div className="os-activity-desc">{activity.description}</div>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 7px",
                        borderRadius: 5,
                        fontSize: 10,
                        fontWeight: 700,
                        background: `${ACTIVITY_COLORS[activity.type]}22`,
                        color: ACTIVITY_COLORS[activity.type] ?? "var(--os-text-muted)",
                        border: `1px solid ${ACTIVITY_COLORS[activity.type]}44`,
                      }}
                    >
                      {ACTIVITY_LABELS[activity.type] ?? activity.type}
                    </span>
                  </div>
                </div>
                <div className="os-activity-duration">{activity.durationMin} min</div>
              </div>
              {annotation && (
                <AnnotationCallout
                  note={annotation.note}
                  sentiment={annotation.sentiment}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrafficLightsSmall() {
  return (
    <div className="os-traffic-lights" style={{ transform: "scale(0.85)" }}>
      <div className="os-traffic-dot red" />
      <div className="os-traffic-dot yellow" />
      <div className="os-traffic-dot green" />
    </div>
  );
}
