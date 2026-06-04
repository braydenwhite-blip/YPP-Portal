"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ACTION_PRIORITY_LABELS,
  ACTION_PRIORITY_VALUES,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_SELECTABLE,
  ACTION_VISIBILITY_LABELS,
  ACTION_VISIBILITY_VALUES,
} from "@/lib/people-strategy/constants";
import { toDateInputValue } from "@/lib/leadership-action-center/dates";
import {
  addActionAssignment,
  addActionFileLink,
  createActionItem,
  removeActionAssignment,
  updateActionItem,
} from "@/lib/people-strategy/action-items-actions";
import { MotionArea, FeedbackBanner } from "@/components/people-strategy/motion";

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  primaryRole?: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
}

export interface ActionItemFormInitial {
  id?: string;
  title?: string;
  description?: string | null;
  goalCategory?: string | null;
  departmentId?: string | null;
  status?: string;
  priority?: string;
  visibility?: string;
  deadlineStart?: Date | string | null;
  deadlineEnd?: Date | string | null;
  leadId?: string | null;
  executingUserIds?: string[];
  inputUserIds?: string[];
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
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const INPUT: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border)",
  fontSize: 14,
  background: "var(--surface)",
};

const REQUIRED_MARK = (
  <span aria-hidden style={{ color: "var(--error-color)", marginLeft: 2 }}>
    *
  </span>
);

function userLabel(u: UserOption): string {
  return u.name ? `${u.name} (${u.email})` : u.email;
}

/**
 * Searchable user picker. Mirrors the existing Action Center chip pattern but
 * adds a filter box (the closest existing portal pattern, made searchable).
 * `single` enforces "exactly one"; multi mode allows any number.
 */
function UserPicker({
  label,
  required,
  single,
  users,
  selected,
  onChange,
  excludeIds = [],
  emptyHint,
}: {
  label: React.ReactNode;
  required?: boolean;
  single?: boolean;
  users: UserOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  excludeIds?: string[];
  emptyHint?: string;
}) {
  const [query, setQuery] = useState("");

  const available = useMemo(
    () => users.filter((u) => !excludeIds.includes(u.id)),
    [users, excludeIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((u) => {
      const hay = `${u.name ?? ""} ${u.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [available, query]);

  const selectedUsers = useMemo(
    () => selected.map((id) => users.find((u) => u.id === id)).filter(Boolean) as UserOption[],
    [selected, users]
  );

  function toggle(id: string) {
    if (single) {
      onChange(selected.includes(id) ? [] : [id]);
      return;
    }
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  }

  return (
    <div style={FIELD}>
      <span style={LABEL}>
        {label}
        {required && REQUIRED_MARK}
      </span>

      {selectedUsers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 2 }}>
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                background: "var(--ypp-purple-100)",
                border: "1px solid var(--ypp-purple-300)",
                color: "var(--ypp-purple-800)",
                fontSize: 12,
              }}
            >
              {userLabel(u)}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                aria-label={`Remove ${u.name ?? u.email}`}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--ypp-purple-700)",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        aria-label={`${typeof label === "string" ? label : "User"} search`}
        style={INPUT}
      />

      {/* A plain scroll container of native checkboxes/radios — no role="listbox"
          here, which would be invalid ARIA wrapping native form controls. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: 6,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          maxHeight: 180,
          overflowY: "auto",
          background: "var(--ypp-purple-50)",
        }}
        role="group"
        aria-label={`${typeof label === "string" ? label : "User"} options`}
      >
        {available.length === 0 && (
          <span style={{ fontSize: 13, color: "#64748b", padding: 4 }}>
            {emptyHint ?? "No users available."}
          </span>
        )}
        {available.length > 0 && filtered.length === 0 && (
          <span style={{ fontSize: 13, color: "#64748b", padding: 4 }}>
            No matches for “{query}”.
          </span>
        )}
        {filtered.map((u) => {
          const checked = selected.includes(u.id);
          return (
            <label
              key={u.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: "var(--radius-xs)",
                background: checked ? "var(--ypp-purple-100)" : "transparent",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <input
                type={single ? "radio" : "checkbox"}
                checked={checked}
                onChange={() => toggle(u.id)}
                style={{ margin: 0 }}
              />
              <span>
                {u.name ?? u.email}
                {u.name && (
                  <span style={{ color: "#64748b" }}> · {u.email}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function ActionItemForm({
  initial,
  users,
  departments,
  onSaved,
  onCancel,
}: {
  initial?: ActionItemFormInitial;
  users: UserOption[];
  departments: DepartmentOption[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const initialExecuting = useMemo(
    () => initial?.executingUserIds ?? [],
    [initial?.executingUserIds]
  );
  const initialInput = useMemo(
    () => initial?.inputUserIds ?? [],
    [initial?.inputUserIds]
  );

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [goalCategory, setGoalCategory] = useState(initial?.goalCategory ?? "");
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? "");
  const [status, setStatus] = useState<string>(initial?.status ?? "NOT_STARTED");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "MEDIUM");
  const [visibility, setVisibility] = useState<string>(
    initial?.visibility ?? "ALL_LEADERSHIP"
  );
  // One clear Deadline (comment #12). Older items may still carry a start/end
  // range; seed from the end date when present, else the single deadline.
  const [deadline, setDeadline] = useState(
    toDateInputValue(asDate(initial?.deadlineEnd ?? initial?.deadlineStart))
  );
  const [leadIds, setLeadIds] = useState<string[]>(
    initial?.leadId ? [initial.leadId] : []
  );
  const [executingIds, setExecutingIds] = useState<string[]>(initialExecuting);
  const [inputIds, setInputIds] = useState<string[]>(initialInput);

  // Optional attachment (kept simple: a single labelled link added on save).
  const [fileLabel, setFileLabel] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const leadId = leadIds[0] ?? "";

  function validate(): string | null {
    if (!title.trim()) return "Title is required.";
    if (!leadId) return "A Lead is required (exactly one).";
    // Executing is optional: when left empty the Lead is the implicit executor.
    if (!deadline) return "A Deadline is required.";
    if (!visibility) return "Visibility is required.";
    if ((fileLabel.trim() && !fileUrl.trim()) || (!fileLabel.trim() && fileUrl.trim())) {
      return "Provide both a label and a URL for the attachment, or leave both blank.";
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    // A lead may also be an executor; the roles are stored as separate rows.
    const executors = executingIds;
    const hasFileLink = fileLabel.trim() && fileUrl.trim();

    startTransition(async () => {
      try {
        if (isEdit && initial?.id) {
          const id = initial.id;
          await updateActionItem({
            id,
            title: title.trim(),
            description: description.trim(),
            goalCategory: goalCategory.trim(),
            departmentId: departmentId || undefined,
            status,
            priority,
            visibility,
            // Single Deadline writes the start column; the legacy end column is
            // cleared so the item carries one canonical date.
            deadlineStart: deadline || undefined,
            deadlineEnd: null,
            leadId,
          });

          // Sync EXECUTING / INPUT assignments by diffing against the initial set.
          await syncAssignments(id, "EXECUTING", initialExecuting, executors);
          await syncAssignments(id, "INPUT", initialInput, inputIds);

          if (hasFileLink) {
            await addActionFileLink(id, fileLabel.trim(), fileUrl.trim());
          }
        } else {
          const { id } = await createActionItem({
            title: title.trim(),
            description: description.trim() || undefined,
            goalCategory: goalCategory.trim() || undefined,
            departmentId: departmentId || undefined,
            leadId,
            status,
            priority,
            visibility,
            deadlineStart: deadline,
            deadlineEnd: undefined,
            executingUserIds: executors,
            inputUserIds: inputIds,
          });

          if (hasFileLink) {
            await addActionFileLink(id, fileLabel.trim(), fileUrl.trim());
          }
        }

        router.refresh();
        if (onSaved) {
          onSaved();
        } else {
          // Return to the canonical Action Tracker list, not the legacy
          // /admin/actions page, so creation lands the user back in /actions/*.
          router.push("/actions/all");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save the action item.");
      }
    });
  }

  return (
    <MotionArea>
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FeedbackBanner message={error} tone="error" style={{ padding: "8px 12px" }} />

      <div style={FIELD}>
        <label style={LABEL} htmlFor="action-title">
          Title{REQUIRED_MARK}
        </label>
        <input
          id="action-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={INPUT}
          placeholder="e.g. Refresh fall curriculum rollout"
        />
      </div>

      <div style={FIELD}>
        <label style={LABEL} htmlFor="action-description">
          Description
        </label>
        <textarea
          id="action-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ ...INPUT, fontFamily: "inherit", resize: "vertical" }}
          placeholder="Optional context, scope, and definition of done"
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div style={FIELD}>
          <label style={LABEL} htmlFor="action-goal-category">
            Goal category
          </label>
          <input
            id="action-goal-category"
            value={goalCategory}
            onChange={(e) => setGoalCategory(e.target.value)}
            style={INPUT}
            placeholder="Goal this ladders up to"
          />
        </div>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="action-department">
            Department
          </label>
          <select
            id="action-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            style={INPUT}
          >
            <option value="">— No department —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div style={FIELD}>
          <label style={LABEL} htmlFor="action-status">
            Status
          </label>
          <select
            id="action-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={INPUT}
          >
            {ACTION_STATUS_SELECTABLE.map((s) => (
              <option key={s} value={s}>
                {ACTION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="action-priority">
            Priority
          </label>
          <select
            id="action-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={INPUT}
          >
            {ACTION_PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {ACTION_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div style={FIELD}>
          <label style={LABEL} htmlFor="action-visibility">
            Visibility{REQUIRED_MARK}
          </label>
          <select
            id="action-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            style={INPUT}
          >
            {ACTION_VISIBILITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {ACTION_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div style={FIELD}>
          <label style={LABEL} htmlFor="action-deadline">
            Deadline{REQUIRED_MARK}
          </label>
          <input
            id="action-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={INPUT}
          />
        </div>
      </div>

      <UserPicker
        label="Lead (exactly one)"
        required
        single
        users={users}
        selected={leadIds}
        onChange={setLeadIds}
        emptyHint="No assignable users found."
      />

      <UserPicker
        label="Executing (optional — defaults to the Lead)"
        users={users}
        selected={executingIds}
        onChange={setExecutingIds}
        emptyHint="No assignable users found."
      />

      <UserPicker
        label="Input (optional)"
        users={users}
        selected={inputIds}
        onChange={setInputIds}
        emptyHint="No assignable users found."
      />

      <fieldset
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <legend style={{ ...LABEL, padding: "0 6px" }}>Attachment (optional)</legend>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <div style={FIELD}>
            <label style={LABEL} htmlFor="action-file-label">
              Label
            </label>
            <input
              id="action-file-label"
              value={fileLabel}
              onChange={(e) => setFileLabel(e.target.value)}
              style={INPUT}
              placeholder="e.g. Project brief"
            />
          </div>
          <div style={FIELD}>
            <label style={LABEL} htmlFor="action-file-url">
              Link (http/https)
            </label>
            <input
              id="action-file-url"
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              style={INPUT}
              placeholder="https://…"
            />
          </div>
        </div>
      </fieldset>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.push("/actions/all"))}
          className="button outline small"
          disabled={pending}
        >
          Cancel
        </button>
        <button type="submit" className="button small" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create action"}
        </button>
      </div>
    </form>
    </MotionArea>
  );
}

/** Add/remove assignment rows so the persisted set matches `next`. */
async function syncAssignments(
  actionId: string,
  role: "EXECUTING" | "INPUT",
  previous: string[],
  next: string[]
) {
  const prevSet = new Set(previous);
  const nextSet = new Set(next);

  for (const userId of next) {
    if (!prevSet.has(userId)) {
      await addActionAssignment(actionId, userId, role);
    }
  }
  for (const userId of previous) {
    if (!nextSet.has(userId)) {
      await removeActionAssignment(actionId, userId, role);
    }
  }
}
