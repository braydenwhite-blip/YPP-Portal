"use client";

export type KanbanView = "kanban" | "table";

export default function ViewToggle({
  view,
  onChange,
}: {
  view: KanbanView;
  onChange: (view: KanbanView) => void;
}) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn${view === "kanban" ? " active" : ""}`}
        onClick={() => onChange("kanban")}
      >
        Board
      </button>
      <button
        className={`view-toggle-btn${view === "table" ? " active" : ""}`}
        onClick={() => onChange("table")}
      >
        Table
      </button>
    </div>
  );
}
