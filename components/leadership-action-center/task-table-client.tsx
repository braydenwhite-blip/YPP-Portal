"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  CATEGORY_VALUES,
  CATEGORY_STYLES,
  STATUS_VALUES,
  STATUS_STYLES,
} from "@/lib/leadership-action-center/constants";
import {
  formatDueDate,
  formatMonthDay,
  isOverdue,
} from "@/lib/leadership-action-center/dates";
import {
  CategoryBadge,
  DueDateBadge,
  OfficerDiscussionBadge,
  PriorityBadge,
  StatusBadge,
} from "./badges";
import TaskForm from "./task-form";
import KanbanDetailPanel from "@/components/kanban/kanban-detail-panel";
import { quickUpdateStatus, addActionItemComment } from "@/lib/leadership-action-center/actions";
import type {
  LeadershipActionCategory,
  LeadershipActionStatus,
} from "@prisma/client";

interface TaskRowDTO {
  id: string;
  title: string;
  description: string | null;
  category: LeadershipActionCategory;
  status: LeadershipActionStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDate: string | null;
  weekStart: string | null;
  needsOfficerDiscussion: boolean;
  officerDiscussionDate: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  primaryOwnerId: string | null;
  primaryOwnerName: string | null;
  ownerNames: string[];
  inputNeededNames: string[];
  inputNeededUsers: Array<{ id: string; name: string | null; email: string }>;
  inputNeededUserIds: string[];
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string;
  updates: Array<{
    id: string;
    kind: string;
    body: string;
    createdAt: string;
    authorName: string | null;
  }>;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

interface MeetingOption {
  id: string;
  title: string;
}

interface FilterState {
  category: string;
  status: string;
  ownerId: string;
  meetingId: string;
  officer: boolean;
  bucket: "all" | "overdue" | "this-week" | "no-deadline";
  search: string;
}

const DEFAULT_FILTERS: FilterState = {
  category: "",
  status: "",
  ownerId: "",
  meetingId: "",
  officer: false,
  bucket: "all",
  search: "",
};

function readInitialFilters(params: URLSearchParams): FilterState {
  return {
    category: params.get("category") ?? "",
    status: params.get("status") ?? "",
    ownerId: params.get("owner") ?? "",
    meetingId: params.get("meeting") ?? "",
    officer: params.get("officer") === "1",
    bucket: (params.get("bucket") as FilterState["bucket"]) ?? "all",
    search: params.get("q") ?? "",
  };
}

export default function TaskTableClient({
  rows,
  users,
  meetings,
}: {
  rows: TaskRowDTO[];
  users: UserOption[];
  meetings: MeetingOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() =>
    readInitialFilters(new URLSearchParams(searchParams?.toString() ?? ""))
  );
  const initialFocus = searchParams?.get("focus") ?? null;
  const wantsNew = searchParams?.get("new") === "1";

  const [focusedId, setFocusedId] = useState<string | null>(initialFocus);
  const [isCreating, setIsCreating] = useState(wantsNew);
  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.category && row.category !== filters.category) return false;
      if (filters.status && row.status !== filters.status) return false;
      if (filters.ownerId && row.primaryOwnerId !== filters.ownerId) return false;
      if (filters.meetingId && row.meetingId !== filters.meetingId) return false;
      if (filters.officer && !row.needsOfficerDiscussion) return false;
      if (filters.bucket === "overdue") {
        const due = row.dueDate ? new Date(row.dueDate) : null;
        if (!isOverdue(due) || row.status === "COMPLETE") return false;
      }
      if (filters.bucket === "this-week") {
        if (!row.weekStart) return false;
      }
      if (filters.bucket === "no-deadline" && row.dueDate) return false;
      if (term) {
        const haystack = [
          row.title,
          row.description,
          row.notes,
          row.primaryOwnerName,
          ...row.ownerNames,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const focused = useMemo(
    () => (focusedId ? rows.find((r) => r.id === focusedId) ?? null : null),
    [rows, focusedId]
  );

  function clearFocus() {
    setFocusedId(null);
    setComment("");
    if (searchParams?.get("focus")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("focus");
      router.replace(`/admin/action-center/tasks?${next.toString()}`);
    }
  }

  function closeCreate() {
    setIsCreating(false);
    if (searchParams?.get("new")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      router.replace(`/admin/action-center/tasks?${next.toString()}`);
    }
  }

  async function handleQuickStatus(id: string, status: LeadershipActionStatus) {
    await quickUpdateStatus({ id, status });
    router.refresh();
  }

  async function handleAddComment(id: string) {
    if (!comment.trim()) return;
    setCommentBusy(true);
    try {
      await addActionItemComment({ id, body: comment.trim() });
      setComment("");
      router.refresh();
    } finally {
      setCommentBusy(false);
    }
  }

  return (
    <div>
      {/* Filter bar */}
      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 16,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        }}
      >
        <input
          type="search"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 14,
            background: "#fff",
            gridColumn: "1 / -1",
          }}
        />
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          style={selectStyle}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_STYLES[c].label}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          style={selectStyle}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {STATUS_STYLES[s].label}
            </option>
          ))}
        </select>
        <select
          value={filters.ownerId}
          onChange={(e) => setFilters((f) => ({ ...f, ownerId: e.target.value }))}
          style={selectStyle}
          aria-label="Filter by owner"
        >
          <option value="">All owners</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
        <select
          value={filters.meetingId}
          onChange={(e) => setFilters((f) => ({ ...f, meetingId: e.target.value }))}
          style={selectStyle}
          aria-label="Filter by meeting"
        >
          <option value="">All meetings</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <select
          value={filters.bucket}
          onChange={(e) =>
            setFilters((f) => ({ ...f, bucket: e.target.value as FilterState["bucket"] }))
          }
          style={selectStyle}
          aria-label="Filter by deadline bucket"
        >
          <option value="all">All deadlines</option>
          <option value="overdue">Overdue only</option>
          <option value="this-week">Has operating week</option>
          <option value="no-deadline">No deadline</option>
        </select>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#475569",
            background: filters.officer ? "#fef3c7" : "transparent",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={filters.officer}
            onChange={(e) => setFilters((f) => ({ ...f, officer: e.target.checked }))}
          />
          Needs officer discussion
        </label>
        <button
          type="button"
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="button outline small"
        >
          Reset
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Showing {filtered.length} of {rows.length} tasks
        </div>
        <button
          type="button"
          className="button small"
          onClick={() => setIsCreating(true)}
        >
          + New task
        </button>
      </div>

      {/* Table */}
      <div
        className="card"
        style={{ padding: 0, overflowX: "auto" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={th}>Category</th>
              <th style={th}>Task</th>
              <th style={th}>Deadline</th>
              <th style={th}>Owner</th>
              <th style={th}>Input from</th>
              <th style={th}>Status</th>
              <th style={th}>Officer?</th>
              <th style={th}>Meeting</th>
              <th style={th}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                  No tasks match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr
                key={row.id}
                onClick={() => setFocusedId(row.id)}
                style={{
                  borderTop: "1px solid #e2e8f0",
                  cursor: "pointer",
                  background: row.archivedAt ? "#fafafa" : "#fff",
                }}
              >
                <td style={td}>
                  <CategoryBadge category={row.category} size="small" />
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{row.title}</div>
                  {row.notes && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 280,
                      }}
                    >
                      {row.notes}
                    </div>
                  )}
                </td>
                <td style={td}>
                  <DueDateBadge dueDate={row.dueDate ? new Date(row.dueDate) : null} />
                </td>
                <td style={td}>
                  <div style={{ color: "#0f172a" }}>
                    {row.primaryOwnerName ?? row.ownerNames[0] ?? <span style={{ color: "#94a3b8" }}>—</span>}
                  </div>
                  {row.ownerNames.length > 1 && (
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      +{row.ownerNames.length - 1} more
                    </div>
                  )}
                </td>
                <td style={td}>
                  <div
                    style={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#475569",
                    }}
                  >
                    {[
                      ...row.inputNeededUsers.map((u) => u.name ?? u.email),
                      ...row.inputNeededNames,
                    ].join(", ") || <span style={{ color: "#94a3b8" }}>—</span>}
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <StatusBadge status={row.status} />
                    <PriorityBadge priority={row.priority} />
                  </div>
                </td>
                <td style={td}>
                  <OfficerDiscussionBadge
                    needs={row.needsOfficerDiscussion}
                    date={row.officerDiscussionDate ? new Date(row.officerDiscussionDate) : null}
                  />
                </td>
                <td style={td}>
                  {row.meetingTitle ? (
                    <span style={{ color: "#475569" }}>{row.meetingTitle}</span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td style={td}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>
                    {formatMonthDay(new Date(row.updatedAt))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isCreating && (
        <KanbanDetailPanel title="Create action" onClose={closeCreate}>
          <TaskForm
            users={users}
            meetings={meetings}
            onSaved={closeCreate}
            onCancel={closeCreate}
          />
        </KanbanDetailPanel>
      )}

      {focused && !isCreating && (
        <KanbanDetailPanel
          title={focused.title}
          subtitle={`Last updated ${formatMonthDay(new Date(focused.updatedAt))}`}
          statusBadge={
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <CategoryBadge category={focused.category} size="small" />
              <StatusBadge status={focused.status} />
              <PriorityBadge priority={focused.priority} />
              <OfficerDiscussionBadge
                needs={focused.needsOfficerDiscussion}
                date={focused.officerDiscussionDate ? new Date(focused.officerDiscussionDate) : null}
              />
            </div>
          }
          onClose={clearFocus}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Quick status buttons */}
            <div>
              <div className="slideout-section-title">Quick status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {STATUS_VALUES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleQuickStatus(focused.id, s)}
                    className="button outline small"
                    style={{
                      borderColor: focused.status === s ? "#6b21c8" : "#cbd5e1",
                      color: focused.status === s ? "#3b0f6e" : "#475569",
                      background: focused.status === s ? "#ede9fe" : "#fff",
                    }}
                  >
                    {STATUS_STYLES[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail summary */}
            <div className="slideout-section">
              <div className="slideout-section-title">Details</div>
              <DetailField label="Deadline" value={focused.dueDate ? formatDueDate(new Date(focused.dueDate)) : "—"} />
              <DetailField
                label="Owner"
                value={
                  focused.primaryOwnerName ??
                  focused.ownerNames.join(", ") ??
                  "Unassigned"
                }
              />
              <DetailField
                label="Input from"
                value={
                  [
                    ...focused.inputNeededUsers.map((u) => u.name ?? u.email),
                    ...focused.inputNeededNames,
                  ].join(", ") || "—"
                }
              />
              <DetailField label="Notes" value={focused.notes ?? "—"} />
            </div>

            {/* Edit form */}
            <details>
              <summary
                style={{
                  cursor: "pointer",
                  color: "#3b0f6e",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Edit task
              </summary>
              <TaskForm
                initial={{
                  id: focused.id,
                  title: focused.title,
                  description: focused.description,
                  category: focused.category,
                  status: focused.status,
                  priority: focused.priority,
                  dueDate: focused.dueDate,
                  weekStart: focused.weekStart,
                  needsOfficerDiscussion: focused.needsOfficerDiscussion,
                  officerDiscussionDate: focused.officerDiscussionDate,
                  meetingId: focused.meetingId,
                  primaryOwnerId: focused.primaryOwnerId,
                  ownerNames: focused.ownerNames,
                  inputNeededNames: focused.inputNeededNames,
                  inputNeededUserIds: focused.inputNeededUserIds,
                  notes: focused.notes,
                  archivedAt: focused.archivedAt,
                }}
                users={users}
                meetings={meetings}
                onSaved={() => router.refresh()}
              />
            </details>

            {/* Comment composer */}
            <div>
              <div className="slideout-section-title">Add update</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Write a comment, status note, or blocker update."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                  background: "#fff",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleAddComment(focused.id)}
                  className="button small"
                  disabled={commentBusy || !comment.trim()}
                >
                  {commentBusy ? "Posting…" : "Post update"}
                </button>
              </div>
            </div>

            {/* Activity log */}
            <div>
              <div className="slideout-section-title">Activity</div>
              {focused.updates.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
                  No activity yet.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {focused.updates.map((u) => (
                    <li
                      key={u.id}
                      style={{
                        padding: "10px 12px",
                        background: u.kind === "COMMENT" ? "#f8fafc" : "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          color: "#64748b",
                          fontSize: 11,
                          marginBottom: 4,
                        }}
                      >
                        <span>
                          {u.authorName ?? "System"} · {u.kind}
                        </span>
                        <span>{formatMonthDay(new Date(u.createdAt))}</span>
                      </div>
                      <div style={{ color: "#0f172a" }}>{u.body}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </KanbanDetailPanel>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="slideout-field">
      <div className="slideout-field-label">{label}</div>
      <div className="slideout-field-value">{value}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  background: "#fff",
  color: "#0f172a",
};

const th: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "top",
};
