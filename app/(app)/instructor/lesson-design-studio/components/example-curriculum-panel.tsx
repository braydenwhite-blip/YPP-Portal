"use client";

import { useEffect, useMemo } from "react";
import {
  EXAMPLE_CURRICULA,
  EXAMPLE_CURRICULUM_ANNOTATIONS,
  EXAMPLE_WEEK_ANNOTATIONS,
  type ExampleWeek,
  type ActivityType,
} from "../examples-data";

const ACTIVITY_TYPES: { value: ActivityType; label: string; color: string; icon: string }[] = [
  { value: "WARM_UP",     label: "Warm Up",     color: "#f59e0b", icon: "☀" },
  { value: "INSTRUCTION", label: "Instruction", color: "#3b82f6", icon: "📚" },
  { value: "PRACTICE",    label: "Practice",    color: "#22c55e", icon: "✍" },
  { value: "DISCUSSION",  label: "Discussion",  color: "#8b3fe8", icon: "💬" },
  { value: "ASSESSMENT",  label: "Assessment",  color: "#ef4444", icon: "📋" },
  { value: "BREAK",       label: "Break",       color: "#6b7280", icon: "☕" },
  { value: "REFLECTION",  label: "Reflection",  color: "#ec4899", icon: "💭" },
  { value: "GROUP_WORK",  label: "Group Work",  color: "#14b8a6", icon: "👥" },
];

const AT_HOME_ICONS: Record<string, string> = {
  REFLECTION_PROMPT: "✍",
  PRACTICE_TASK: "🎯",
  QUIZ: "📝",
  PRE_READING: "📖",
};

function getActivityConfig(type: ActivityType) {
  return ACTIVITY_TYPES.find((a) => a.value === type) ?? ACTIVITY_TYPES[0];
}

interface ExampleCurriculumPanelProps {
  activeTab: number;
  interestArea: string;
  autoRecommendEnabled?: boolean;
  onTabChange: (index: number, source?: "auto" | "user") => void;
  onImportWeek: (week: ExampleWeek) => boolean;
}

function normalizeTopic(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreInterestMatch(exampleInterestArea: string, draftInterestArea: string) {
  const example = normalizeTopic(exampleInterestArea);
  const draft = normalizeTopic(draftInterestArea);
  if (!draft) return 0;
  if (example === draft) return 100;
  if (example.includes(draft) || draft.includes(example)) return 80;

  const draftWords = new Set(draft.split(" ").filter(Boolean));
  const exampleWords = example.split(" ").filter(Boolean);
  const overlap = exampleWords.filter((word) => draftWords.has(word)).length;
  return overlap * 20;
}

export function ExampleCurriculumPanel({
  activeTab,
  interestArea,
  autoRecommendEnabled = true,
  onTabChange,
  onImportWeek,
}: ExampleCurriculumPanelProps) {
  const recommendedIndex = useMemo(() => {
    if (!interestArea.trim()) return 0;
    let bestIndex = 0;
    let bestScore = -1;

    EXAMPLE_CURRICULA.forEach((curriculum, index) => {
      const score = scoreInterestMatch(curriculum.interestArea, interestArea);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }, [interestArea]);

  useEffect(() => {
    if (autoRecommendEnabled && interestArea.trim()) {
      onTabChange(recommendedIndex, "auto");
    }
  }, [autoRecommendEnabled, interestArea, onTabChange, recommendedIndex]);

  const curriculum = EXAMPLE_CURRICULA[activeTab] ?? EXAMPLE_CURRICULA[0];
  const curriculumAnnotations = EXAMPLE_CURRICULUM_ANNOTATIONS[curriculum.id];
  const isRecommended = activeTab === recommendedIndex && interestArea.trim().length > 0;

  return (
    <div className="cbs-example-panel">
      {/* Header */}
      <div className="cbs-example-header">
        <h2>Learn from Examples</h2>
        <p>
          Study a few gold examples, notice why they work, then import a week as a starting point and adapt it.
        </p>
      </div>

      {/* Tabs */}
      <div className="cbs-example-tabs">
        {EXAMPLE_CURRICULA.map((c, i) => (
          <button
            key={c.id}
            className={`cbs-example-tab ${i === activeTab ? "cbs-example-tab-active" : ""}`}
            onClick={() => onTabChange(i, "user")}
            type="button"
          >
            {c.interestArea}
            {i === recommendedIndex && interestArea.trim() ? " • Best match" : ""}
          </button>
        ))}
      </div>

      {/* Overview */}
      <div className="cbs-example-overview">
        {isRecommended ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "#dbeafe",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Recommended for your interest area
          </div>
        ) : null}
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

        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
          }}
        >
          <h4 style={{ margin: "0 0 8px" }}>Why this example works</h4>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {curriculumAnnotations.whyThisCurriculumWorks.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
            }}
          >
            <h4 style={{ margin: "0 0 8px" }}>Student experience highlights</h4>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {curriculumAnnotations.studentExperienceHighlights.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
            }}
          >
            <h4 style={{ margin: "0 0 8px" }}>How to adapt it without losing the arc</h4>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {curriculumAnnotations.adaptationMoves.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#eff6ff",
            }}
          >
            <h4 style={{ margin: "0 0 8px" }}>What a reviewer should look for</h4>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {curriculumAnnotations.reviewerLens.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Weeks */}
      <div className="cbs-example-weeks">
        {curriculum.weeks.map((week) => {
          const totalMin = week.activities.reduce((s, a) => s + a.durationMin, 0);
          const weekAnnotations = EXAMPLE_WEEK_ANNOTATIONS[curriculum.id][week.weekNumber];
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

              {/* Teaching tips */}
              {week.teachingTips && (
                <div className="cbs-example-week-tips">
                  <span className="cbs-example-tips-label">💡 Teaching Tips</span>
                  <p className="cbs-example-tips-text">{week.teachingTips}</p>
                </div>
              )}

              <div
                style={{
                  marginTop: 10,
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                    Why this week works
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                    {weekAnnotations.whyThisWeekWorks}
                  </p>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                    Watch out for
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                    {weekAnnotations.watchOutFor}
                  </p>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                    Adapt it like this
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                    {weekAnnotations.adaptIt}
                  </p>
                </div>
              </div>

              {/* At-home assignment */}
              {week.atHomeAssignment && (
                <div className="cbs-example-week-homework">
                  <span className="cbs-example-homework-label">
                    {AT_HOME_ICONS[week.atHomeAssignment.type] ?? "📋"} At-Home Assignment
                  </span>
                  <p className="cbs-example-homework-title">{week.atHomeAssignment.title}</p>
                  <p className="cbs-example-homework-desc">{week.atHomeAssignment.description}</p>
                </div>
              )}

              {/* Import button */}
              <button
                className="cbs-example-import-btn"
                onClick={() => onImportWeek(week)}
                type="button"
              >
                + Import this week into my curriculum
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="cbs-example-footer">
        <p style={{ marginTop: 0, marginBottom: 12, fontSize: 13, color: "#64748b" }}>
          The goal is not to copy these word for word. The goal is to understand the moves, pacing, and student experience choices that make them teachable.
        </p>
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
