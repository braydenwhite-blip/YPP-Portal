"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  CATEGORY_VALUES,
  CATEGORY_STYLES,
  PRIORITY_VALUES,
  PRIORITY_STYLES,
  STATUS_VALUES,
  STATUS_STYLES,
} from "@/lib/leadership-action-center/constants";
import { toDateInputValue } from "@/lib/leadership-action-center/dates";
import {
  createActionItem,
  updateActionItem,
  archiveActionItem,
  restoreActionItem,
} from "@/lib/leadership-action-center/actions";
import type {
  CreateActionItemInput,
  UpdateActionItemInput,
} from "@/lib/leadership-action-center/actions";

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

interface MeetingOption {
  id: string;
  title: string;
}

interface TaskInitialValues {
  id?: string;
  title?: string;
  description?: string | null;
  category?: string;
  status?: string;
  priority?: string;
  dueDate?: Date | string | null;
  weekStart?: Date | string | null;
  needsOfficerDiscussion?: boolean;
  officerDiscussionDate?: Date | string | null;
  meetingId?: string | null;
  primaryOwnerId?: string | null;
  ownerNames?: string[];
  inputNeededNames?: string[];
  inputNeededUserIds?: string[];
  notes?: string | null;
  archivedAt?: Date | string | null;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const FIELD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const INPUT: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  background: "#fff",
};

export default function TaskForm({
  initial,
  users,
  meetings,
  onSaved,
  onCancel,
}: {
  initial?: TaskInitialValues;
  users: UserOption[];
  meetings: MeetingOption[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "INSTRUCTION");
  const [status, setStatus] = useState<string>(initial?.status ?? "NOT_STARTED");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "NORMAL");
  const [dueDate, setDueDate] = useState(toDateInputValue(asDate(initial?.dueDate)));
  const [weekStart, setWeekStart] = useState(toDateInputValue(asDate(initial?.weekStart)));
  const [needsOfficerDiscussion, setNeedsOfficerDiscussion] = useState(
    initial?.needsOfficerDiscussion ?? false
  );
  const [officerDiscussionDate, setOfficerDiscussionDate] = useState(
    toDateInputValue(asDate(initial?.officerDiscussionDate))
  );
  const [meetingId, setMeetingId] = useState<string>(initial?.meetingId ?? "");
  const [primaryOwnerId, setPrimaryOwnerId] = useState<string>(initial?.primaryOwnerId ?? "");
  const [ownerNames, setOwnerNames] = useState((initial?.ownerNames ?? []).join(", "));
  const [inputNeededNames, setInputNeededNames] = useState(
    (initial?.inputNeededNames ?? []).join(", ")
  );
  const [inputNeededUserIds, setInputNeededUserIds] = useState<string[]>(
    initial?.inputNeededUserIds ?? []
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const archived = Boolean(initial?.archivedAt);

  function buildPayload(): CreateActionItemInput {
    return {
      title: title.trim(),
      description: description.trim(),
      category,
      status,
      priority,
      dueDate: dueDate || undefined,
      weekStart: weekStart || undefined,
      needsOfficerDiscussion,
      officerDiscussionDate: officerDiscussionDate || undefined,
      meetingId: meetingId || undefined,
      primaryOwnerId: primaryOwnerId || undefined,
      ownerNames: ownerNames
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      inputNeededNames: inputNeededNames
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      inputNeededUserIds,
      notes: notes.trim(),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (!payload.title) {
      setError("Title is required");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit && initial?.id) {
          const update: UpdateActionItemInput = { id: initial.id, ...payload };
          await updateActionItem(update);
        } else {
          await createActionItem(payload);
        }
        router.refresh();
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save task");
      }
    });
  }

  function handleArchive() {
    if (!initial?.id) return;
    if (!confirm("Archive this task? You can restore it later.")) return;
    startTransition(async () => {
      try {
        await archiveActionItem({ id: initial.id! });
        router.refresh();
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to archive");
      }
    });
  }

  function handleRestore() {
    if (!initial?.id) return;
    startTransition(async () => {
      try {
        await restoreActionItem({ id: initial.id! });
        router.refresh();
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to restore");
      }
    });
  }

  function toggleInputUser(userId: string) {
    setInputNeededUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div style={FIELD}>
        <label style={LABEL} htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={INPUT}
          placeholder="e.g. Email all summer camps about partnership"
        />
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="task-category">
            Category
          </label>
          <select
            id="task-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={INPUT}
          >
            {CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_STYLES[c].label}
              </option>
            ))}
          </select>
        </div>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="task-status">
            Status
          </label>
          <select
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={INPUT}
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STATUS_STYLES[s].label}
              </option>
            ))}
          </select>
        </div>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="task-priority">
            Priority
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={INPUT}
          >
            {PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_STYLES[p].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="task-due">
            Deadline
          </label>
          <input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={INPUT}
          />
        </div>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="task-week">
            Operating week (Monday)
          </label>
          <input
            id="task-week"
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            style={INPUT}
          />
        </div>
      </div>

      <div style={FIELD}>
        <label style={LABEL} htmlFor="task-owner">
          Primary owner (portal user)
        </label>
        <select
          id="task-owner"
          value={primaryOwnerId}
          onChange={(e) => setPrimaryOwnerId(e.target.value)}
          style={INPUT}
        >
          <option value="">— Unassigned —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
      </div>

      <div style={FIELD}>
        <label style={LABEL} htmlFor="task-owner-names">
          Other owners (free text, comma-separated)
        </label>
        <input
          id="task-owner-names"
          value={ownerNames}
          onChange={(e) => setOwnerNames(e.target.value)}
          style={INPUT}
          placeholder="People who don't have a portal account yet"
        />
      </div>

      <div style={FIELD}>
        <label style={LABEL}>Input needed from (portal users)</label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: 8,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            maxHeight: 140,
            overflowY: "auto",
            background: "#f8fafc",
          }}
        >
          {users.length === 0 && (
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              No leadership users found yet.
            </span>
          )}
          {users.map((u) => {
            const checked = inputNeededUserIds.includes(u.id);
            return (
              <label
                key={u.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: checked ? "#e0e7ff" : "#fff",
                  border: `1px solid ${checked ? "#6366f1" : "#cbd5e1"}`,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleInputUser(u.id)}
                  style={{ margin: 0 }}
                />
                {u.name ?? u.email}
              </label>
            );
          })}
        </div>
      </div>

      <div style={FIELD}>
        <label style={LABEL} htmlFor="task-input-names">
          Other input from (free text, comma-separated)
        </label>
        <input
          id="task-input-names"
          value={inputNeededNames}
          onChange={(e) => setInputNeededNames(e.target.value)}
          style={INPUT}
          placeholder="People without a portal account"
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          alignItems: "end",
        }}
      >
        <div style={FIELD}>
          <label style={{ ...LABEL, textTransform: "none" }}>
            <input
              type="checkbox"
              checked={needsOfficerDiscussion}
              onChange={(e) => setNeedsOfficerDiscussion(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Needs officer discussion
          </label>
        </div>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="task-officer-date">
            Officer discussion date
          </label>
          <input
            id="task-officer-date"
            type="date"
            value={officerDiscussionDate}
            onChange={(e) => setOfficerDiscussionDate(e.target.value)}
            style={INPUT}
            disabled={!needsOfficerDiscussion}
          />
        </div>
      </div>

      <div style={FIELD}>
        <label style={LABEL} htmlFor="task-meeting">
          Linked meeting
        </label>
        <select
          id="task-meeting"
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          style={INPUT}
        >
          <option value="">— None —</option>
          {meetings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      <div style={FIELD}>
        <label style={LABEL} htmlFor="task-description">
          Description
        </label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ ...INPUT, fontFamily: "inherit", resize: "vertical" }}
          placeholder="Optional context that doesn't fit in the title"
        />
      </div>

      <div style={FIELD}>
        <label style={LABEL} htmlFor="task-notes">
          Notes / blocker
        </label>
        <textarea
          id="task-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ ...INPUT, fontFamily: "inherit", resize: "vertical" }}
          placeholder="What's blocking this? What should the next person know?"
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {isEdit && !archived && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={pending}
              className="button outline small"
              style={{ borderColor: "#dc2626", color: "#dc2626" }}
            >
              Archive
            </button>
          )}
          {isEdit && archived && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={pending}
              className="button outline small"
            >
              Restore
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="button outline small"
              disabled={pending}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="button small" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </form>
  );
}
