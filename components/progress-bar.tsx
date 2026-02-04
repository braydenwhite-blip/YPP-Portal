"use client";

import { ProgressStatus } from "@prisma/client";

interface ProgressBarProps {
  status: ProgressStatus;
  label?: string;
  showLabels?: boolean;
}

const STATUS_CONFIG = {
  BEHIND_SCHEDULE: {
    color: "#ef4444",
    label: "Behind schedule",
    description: "Incomplete/behind timetable schedule and no catch-up possible",
    position: 0
  },
  GETTING_STARTED: {
    color: "#eab308",
    label: "Getting started",
    description: "Incomplete/behind timetable schedule but catch-up possible",
    position: 1
  },
  ON_TRACK: {
    color: "#22c55e",
    label: "On track",
    description: "Complete/in line with timetable schedule in both quantity & quality",
    position: 2
  },
  ABOVE_AND_BEYOND: {
    color: "#3b82f6",
    label: "Above and beyond",
    description: "Exceeds goals in quantity & quality",
    position: 3
  }
};

export function ProgressBar({ status, label, showLabels = false }: ProgressBarProps) {
  const config = STATUS_CONFIG[status];
  const segments = Object.values(STATUS_CONFIG);

  return (
    <div className="progress-bar-container">
      {label && <div className="progress-bar-label">{label}</div>}
      <div className="progress-bar-track">
        {segments.map((segment, index) => (
          <div
            key={segment.label}
            className="progress-bar-segment"
            style={{
              backgroundColor: segment.color,
              opacity: index <= config.position ? 1 : 0.2
            }}
          />
        ))}
        <div
          className="progress-bar-indicator"
          style={{
            left: `${(config.position / 3) * 100}%`,
            transform: `translateX(${config.position === 0 ? "0" : config.position === 3 ? "-100%" : "-50%"})`
          }}
        />
      </div>
      {showLabels && (
        <div className="progress-bar-labels">
          {segments.map((segment) => (
            <div key={segment.label} className="progress-bar-label-item">
              <span className="progress-label-text">{segment.label}</span>
              <span className="progress-label-desc">{segment.description}</span>
            </div>
          ))}
        </div>
      )}
      <style jsx>{`
        .progress-bar-container {
          width: 100%;
        }
        .progress-bar-label {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
          color: var(--text);
        }
        .progress-bar-track {
          display: flex;
          height: 24px;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          gap: 2px;
        }
        .progress-bar-segment {
          flex: 1;
          transition: opacity 0.3s ease;
        }
        .progress-bar-indicator {
          position: absolute;
          top: 0;
          width: 4px;
          height: 100%;
          background: #0f172a;
          border-radius: 2px;
        }
        .progress-bar-labels {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 12px;
          font-size: 11px;
        }
        .progress-bar-label-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .progress-label-text {
          font-weight: 700;
          color: var(--text);
        }
        .progress-label-desc {
          color: var(--muted);
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
}

interface ProgressBarSelectorProps {
  name: string;
  value?: ProgressStatus;
  onChange?: (status: ProgressStatus) => void;
  label?: string;
}

export function ProgressBarSelector({ name, value, onChange, label }: ProgressBarSelectorProps) {
  const segments = Object.entries(STATUS_CONFIG);

  return (
    <div className="progress-selector-container">
      {label && <div className="progress-selector-label">{label}</div>}
      <div className="progress-selector-track">
        {segments.map(([key, segment]) => (
          <label
            key={key}
            className={`progress-selector-segment ${value === key ? "selected" : ""}`}
            style={{
              backgroundColor: value === key ? segment.color : `${segment.color}33`
            }}
          >
            <input
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => onChange?.(key as ProgressStatus)}
              className="sr-only"
            />
            <span className="segment-label">{segment.label}</span>
          </label>
        ))}
      </div>
      <div className="progress-selector-descriptions">
        {segments.map(([key, segment]) => (
          <div key={key} className="segment-desc">
            {segment.description}
          </div>
        ))}
      </div>
      <style jsx>{`
        .progress-selector-container {
          width: 100%;
        }
        .progress-selector-label {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
          color: var(--text);
        }
        .progress-selector-track {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
        }
        .progress-selector-segment {
          padding: 12px 8px;
          border-radius: 6px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s ease;
          border: 2px solid transparent;
        }
        .progress-selector-segment:hover {
          opacity: 0.9;
        }
        .progress-selector-segment.selected {
          border-color: #0f172a;
        }
        .segment-label {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }
        .progress-selector-descriptions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 8px;
        }
        .segment-desc {
          font-size: 10px;
          color: var(--muted);
          line-height: 1.3;
          text-align: center;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
      `}</style>
    </div>
  );
}

interface GoalProgressDisplayProps {
  goals: Array<{
    id: string;
    title: string;
    timetable?: string | null;
    latestStatus?: ProgressStatus | null;
    comments?: string | null;
  }>;
  showOverall?: boolean;
}

export function GoalProgressDisplay({ goals, showOverall = true }: GoalProgressDisplayProps) {
  const calculateOverall = () => {
    const statuses = goals
      .filter((g) => g.latestStatus)
      .map((g) => STATUS_CONFIG[g.latestStatus!].position);
    if (statuses.length === 0) return null;
    const avg = statuses.reduce((a, b) => a + b, 0) / statuses.length;
    if (avg < 0.75) return "BEHIND_SCHEDULE" as ProgressStatus;
    if (avg < 1.5) return "GETTING_STARTED" as ProgressStatus;
    if (avg < 2.5) return "ON_TRACK" as ProgressStatus;
    return "ABOVE_AND_BEYOND" as ProgressStatus;
  };

  const overall = showOverall ? calculateOverall() : null;

  return (
    <div className="goal-progress-display">
      {goals.map((goal, index) => (
        <div key={goal.id} className="goal-row">
          <div className="goal-info">
            <span className="goal-number">Goal {index + 1}</span>
            {goal.timetable && <span className="goal-timetable">By {goal.timetable}</span>}
          </div>
          <div className="goal-bar">
            {goal.latestStatus ? (
              <ProgressBar status={goal.latestStatus} />
            ) : (
              <div className="no-progress">No progress update yet</div>
            )}
          </div>
        </div>
      ))}
      {overall && (
        <div className="goal-row overall">
          <div className="goal-info">
            <span className="goal-number">Overall</span>
            <span className="goal-timetable">Including general expectations</span>
          </div>
          <div className="goal-bar">
            <ProgressBar status={overall} />
          </div>
        </div>
      )}
      <style jsx>{`
        .goal-progress-display {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .goal-row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 16px;
          align-items: center;
        }
        .goal-row.overall {
          margin-top: 8px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .goal-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .goal-number {
          font-weight: 700;
          font-size: 14px;
        }
        .goal-timetable {
          font-size: 11px;
          color: var(--muted);
        }
        .goal-bar {
          flex: 1;
        }
        .no-progress {
          color: var(--muted);
          font-size: 13px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
