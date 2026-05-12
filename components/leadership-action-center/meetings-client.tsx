"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import KanbanDetailPanel from "@/components/kanban/kanban-detail-panel";
import {
  CategoryBadge,
  DueDateBadge,
  OfficerDiscussionBadge,
  StatusBadge,
} from "./badges";
import MeetingForm from "./meeting-form";
import {
  MEETING_KIND_LABELS,
} from "@/lib/leadership-action-center/constants";
import {
  formatMonthDay,
  formatMonthDayYear,
  formatWeekday,
} from "@/lib/leadership-action-center/dates";

interface MeetingDTO {
  id: string;
  title: string;
  kind: string;
  scheduledAt: string | null;
  notes: string | null;
  ownerId: string | null;
  ownerName: string | null;
  archivedAt: string | null;
  taskCount: number;
  tasks: Array<{
    id: string;
    title: string;
    category: keyof typeof import("@/lib/leadership-action-center/constants").CATEGORY_STYLES;
    status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
    dueDate: string | null;
    needsOfficerDiscussion: boolean;
    officerDiscussionDate: string | null;
    primaryOwnerName: string | null;
    notes: string | null;
  }>;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

export default function MeetingsClient({
  meetings,
  users,
}: {
  meetings: MeetingDTO[];
  users: UserOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFocus = searchParams?.get("focus") ?? null;
  const wantsNew = searchParams?.get("new") === "1";

  const [focusedId, setFocusedId] = useState<string | null>(initialFocus);
  const [creating, setCreating] = useState(wantsNew);

  const focused = useMemo(
    () => (focusedId ? meetings.find((m) => m.id === focusedId) ?? null : null),
    [focusedId, meetings]
  );

  function clearFocus() {
    setFocusedId(null);
    if (searchParams?.get("focus")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("focus");
      router.replace(`/admin/action-center/meetings?${next.toString()}`);
    }
  }

  function closeCreate() {
    setCreating(false);
    if (searchParams?.get("new")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      router.replace(`/admin/action-center/meetings?${next.toString()}`);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Click a meeting to see linked tasks and a generated agenda outline.
        </div>
        <button type="button" className="button small" onClick={() => setCreating(true)}>
          + New meeting
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {meetings.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
            No meetings yet. Add the recurring Officers / Marketing / Tech meetings to anchor
            agenda prep.
          </div>
        )}
        {meetings.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setFocusedId(m.id)}
            className="card"
            style={{
              textAlign: "left",
              cursor: "pointer",
              padding: 16,
              borderTop: "3px solid #6b21c8",
              background: m.archivedAt ? "#fafafa" : "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
              {MEETING_KIND_LABELS[m.kind as keyof typeof MEETING_KIND_LABELS] ?? m.kind}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginTop: 4 }}>
              {m.title}
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
              {m.scheduledAt
                ? `${formatWeekday(new Date(m.scheduledAt))}, ${formatMonthDayYear(new Date(m.scheduledAt))}`
                : "Unscheduled"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
              {m.taskCount} task{m.taskCount === 1 ? "" : "s"} ·{" "}
              {m.ownerName ? `Owner: ${m.ownerName}` : "Unassigned"}
            </div>
          </button>
        ))}
      </div>

      {creating && (
        <KanbanDetailPanel title="New meeting" onClose={closeCreate}>
          <MeetingForm users={users} onSaved={closeCreate} onCancel={closeCreate} />
        </KanbanDetailPanel>
      )}

      {focused && !creating && (
        <KanbanDetailPanel
          title={focused.title}
          subtitle={
            focused.scheduledAt
              ? `${formatWeekday(new Date(focused.scheduledAt))}, ${formatMonthDayYear(new Date(focused.scheduledAt))}`
              : "Unscheduled"
          }
          statusBadge={
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                background: "#ede9fe",
                color: "#3b0f6e",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {MEETING_KIND_LABELS[focused.kind as keyof typeof MEETING_KIND_LABELS] ?? focused.kind}
            </span>
          }
          onClose={clearFocus}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <details>
              <summary
                style={{
                  cursor: "pointer",
                  color: "#3b0f6e",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Edit meeting
              </summary>
              <MeetingForm
                initial={focused}
                users={users}
                onSaved={() => router.refresh()}
              />
            </details>

            {/* Suggested agenda */}
            <div>
              <div className="slideout-section-title">Suggested agenda (from tasks)</div>
              {focused.tasks.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                  No tasks linked to this meeting yet. Link tasks from the task editor.
                </p>
              ) : (
                <ol style={{ paddingLeft: 18, margin: 0 }}>
                  {focused.tasks
                    .slice()
                    .sort((a, b) => Number(b.needsOfficerDiscussion) - Number(a.needsOfficerDiscussion))
                    .map((task) => (
                      <li key={task.id} style={{ marginBottom: 8, fontSize: 14 }}>
                        <b style={{ color: "#0f172a" }}>{task.title}</b>
                        {task.notes && (
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {task.notes}
                          </div>
                        )}
                      </li>
                    ))}
                </ol>
              )}
            </div>

            {/* Officer-discussion call-out */}
            {focused.tasks.some((t) => t.needsOfficerDiscussion) && (
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 13,
                  color: "#78350f",
                }}
              >
                <b>Decisions needed:</b>{" "}
                {focused.tasks
                  .filter((t) => t.needsOfficerDiscussion)
                  .map((t) => t.title)
                  .join("; ")}
              </div>
            )}

            {/* Linked tasks */}
            <div>
              <div className="slideout-section-title">Linked tasks</div>
              {focused.tasks.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                  Link tasks to this meeting from the task editor (Linked meeting field).
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {focused.tasks.map((task) => (
                    <li
                      key={task.id}
                      style={{
                        padding: "10px 12px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>
                            {task.title}
                          </div>
                          {task.primaryOwnerName && (
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                              Owner: {task.primaryOwnerName}
                            </div>
                          )}
                        </div>
                        <DueDateBadge dueDate={task.dueDate ? new Date(task.dueDate) : null} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        <CategoryBadge category={task.category} size="small" />
                        <StatusBadge status={task.status} />
                        <OfficerDiscussionBadge
                          needs={task.needsOfficerDiscussion}
                          date={task.officerDiscussionDate ? new Date(task.officerDiscussionDate) : null}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {focused.notes && (
              <div>
                <div className="slideout-section-title">Standing notes</div>
                <p style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#0f172a", margin: 0 }}>
                  {focused.notes}
                </p>
              </div>
            )}

            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Last updated {formatMonthDay(new Date())}
            </div>
          </div>
        </KanbanDetailPanel>
      )}
    </div>
  );
}
