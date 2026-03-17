"use client";

interface DockItem {
  index: number;
  label: string;
  isSaved: boolean;
  isActive: boolean;
}

interface OsDockProps {
  items: DockItem[];
  onSelect: (index: number) => void;
  phase: number;
  phases: string[];
}

export function OsDock({ items, onSelect, phase, phases }: OsDockProps) {
  return (
    <div className="os-dock-container">
      <div className="os-dock">
        {/* Phase indicators */}
        {phases.map((label, i) => {
          const isDone = i < phase;
          const isCurrent = i === phase;
          return (
            <div
              key={label}
              className={`os-dock-item ${isCurrent ? "active" : ""} ${isDone ? "done" : ""}`}
              style={{ cursor: "default" }}
              title={label}
            >
              <div className="os-dock-icon" style={{ fontSize: 9, padding: "0 2px", textAlign: "center" }}>
                {isDone ? "✓" : i + 1}
              </div>
              <div className="os-dock-dot" />
              <div className="os-dock-label">{label}</div>
            </div>
          );
        })}

        {/* Separator between phases and lessons */}
        {items.length > 0 && <div className="os-dock-separator" />}

        {/* Lesson plan slots */}
        {items.map((item) => (
          <div
            key={item.index}
            className={`os-dock-item ${item.isActive ? "active" : ""} ${item.isSaved ? "done" : ""}`}
            onClick={() => onSelect(item.index)}
            title={item.label}
          >
            <div className="os-dock-icon">
              {item.isSaved ? "✓" : item.index + 1}
            </div>
            <div className="os-dock-dot" />
            <div className="os-dock-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
