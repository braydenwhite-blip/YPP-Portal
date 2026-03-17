"use client";

import { EXAMPLE_CURRICULA, type ExampleCurriculum, type ExampleWeek, type ActivityType } from "../examples-data";

const ACTIVITY_TYPES: { value: ActivityType; label: string; color: string; icon: string }[] = [
  { value: "WARM_UP",     label: "Warm Up",     color: "#f59e0b", icon: "☀" },
  { value: "INSTRUCTION", label: "Instruction", color: "#3b82f6", icon: "📚" },
  { value: "PRACTICE",    label: "Practice",    color: "#22c55e", icon: "✍" },
  { value: "DISCUSSION",  label: "Discussion",  color: "#8b5cf6", icon: "💬" },
  { value: "ASSESSMENT",  label: "Assessment",  color: "#ef4444", icon: "📋" },
  { value: "BREAK",       label: "Break",       color: "#6b7280", icon: "☕" },
  { value: "REFLECTION",  label: "Reflection",  color: "#ec4899", icon: "💭" },
  { value: "GROUP_WORK",  label: "Group Work",  color: "#14b8a6", icon: "👥" },
];

function getActivityConfig(type: ActivityType) {
  return ACTIVITY_TYPES.find((a) => a.value === type) ?? ACTIVITY_TYPES[0];
}

interface ExampleCurriculumPanelProps {
  activeTab: number;
  onTabChange: (index: number) => void;
}

export function ExampleCurriculumPanel({ activeTab, onTabChange }: ExampleCurriculumPanelProps) {
  const curriculum = EXAMPLE_CURRICULA[activeTab] ?? EXAMPLE_CURRICULA[0];

  return (
    <div className="cbs-example-panel">
      {/* Header */}
      <div className="cbs-example-header">
        <h2>Learn from Examples</h2>
        <p>Study these curricula to understand good structure</p>
      </div>

      {/* Tabs */}
      <div className="cbs-example-tabs">
        {EXAMPLE_CURRICULA.map((c, i) => (
          <button
            key={c.id}
            className={`cbs-example-tab ${i === activeTab ? "cbs-example-tab-active" : ""}`}
            onClick={() => onTabChange(i)}
            type="button"
          >
            {c.interestArea}
          </button>
        ))}
      </div>

      {/* Overview */}
      <div className="cbs-example-overview">
        <h3 className="cbs-example-title">{curriculum.title}</h3>
        <p className="cbs-example-description">{curriculum.description}</p>

        <div className="cbs-example-stats">
          {curriculum.weeks.length} weeks · {curriculum.classDurationMin} min/session
        </div>

        <div className="cbs-example-outcomes">
          <h4>Learning Outcomes</h4>
          <ol>
            {curriculum.outcomes.map((outcome, i) => (
              <li key={i}>{outcome}</li>
            ))}
          </ol>
        </div>
      </div>

      {/* Weeks */}
      <div className="cbs-example-weeks">
        {curriculum.weeks.map((week) => {
          const totalMin = week.activities.reduce((s, a) => s + a.durationMin, 0);
          return (
            <div key={week.weekNumber} className="cbs-example-week">
              <div className="cbs-example-week-header">
                <h4>Week {week.weekNumber}: {week.title}</h4>
                <span className="cbs-example-week-duration">{totalMin}m</span>
              </div>
              <p className="cbs-example-week-goal">{week.goal}</p>

              {/* Time bar */}
              <div className="cbs-time-bar">
                {week.activities.map((activity, ai) => {
                  const config = getActivityConfig(activity.type);
                  const widthPercent = totalMin > 0 ? (activity.durationMin / totalMin) * 100 : 0;
                  return (
                    <div
                      key={ai}
                      className="cbs-time-segment"
                      style={{ width: `${widthPercent}%`, backgroundColor: config.color }}
                      title={`${config.label}: ${activity.title} (${activity.durationMin}m)`}
                    />
                  );
                })}
              </div>

              {/* Activities */}
              <div className="cbs-example-activity-list">
                {week.activities.map((activity, ai) => {
                  const config = getActivityConfig(activity.type);
                  return (
                    <div key={ai} className="cbs-example-activity">
                      <div className="cbs-example-activity-row">
                        <span className="cbs-example-activity-dot" style={{ backgroundColor: config.color }} />
                        <span
                          className="cbs-example-activity-badge"
                          style={{ backgroundColor: config.color + "1a", color: config.color }}
                        >
                          {config.icon} {config.label}
                        </span>
                        <span className="cbs-example-activity-title">{activity.title}</span>
                        <span className="cbs-example-activity-duration">{activity.durationMin}m</span>
                      </div>
                      <p className="cbs-example-activity-desc">{activity.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="cbs-example-footer">
        <button
          className="cbs-btn cbs-btn-secondary"
          onClick={() => window.open(`/instructor/lesson-design-studio/print?example=${curriculum.id}`, "_blank")}
          type="button"
        >
          Export Example as PDF
        </button>
      </div>
    </div>
  );
}
