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
  DEFAULT_ACTION_DEADLINE_DAYS,
} from "@/lib/people-strategy/constants";
import {
  ACTION_TYPE_GUIDANCE,
  ACTION_TYPE_LABELS,
  ACTION_TYPE_VALUES,
  isActionType,
} from "@/lib/people-strategy/action-types";
import { addDays, toDateInputValue } from "@/lib/leadership-action-center/dates";
import {
  addActionAssignment,
  addActionFileLink,
  createActionItem,
  removeActionAssignment,
  updateActionItem,
} from "@/lib/people-strategy/action-items-actions";
import { MotionArea, FeedbackBanner } from "@/components/people-strategy/motion";
import { deriveActionQualityWarnings } from "@/lib/people-strategy/action-quality";

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
  /** Controlled-vocabulary action type (or null/empty for untyped). */
  actionType?: string | null;
  visibility?: string;
  deadlineStart?: Date | string | null;
  deadlineEnd?: Date | string | null;
  leadId?: string | null;
  executingUserIds?: string[];
  inputUserIds?: string[];
  /**
   * Polymorphic related-entity link, resolved server-side. When present the
   * form shows a read-only "Linked to …" chip and carries the link through on
   * create. The link is intentionally NOT editable here — it is set from the
   * surface the action was started on (a class / mentorship / person page).
   */
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  /** Human label for the chip (e.g. the class title or person name). */
  relatedEntityLabel?: string | null;
  /** Type label for the chip (e.g. "Class" / "Mentorship" / "Person"). */
  relatedEntityTypeLabel?: string | null;
  /**
   * Source meeting this action was started from (a decision / recap). Carried
   * through on create so the new action links back to the meeting workspace,
   * exactly like the in-meeting converters do. Not user-editable here.
   */
  officerMeetingId?: string | null;
  // --- Action System 4.0 honest context (carried through on create) ---
  /** Definition of done — editable; seeded from a source when known. */
  successDefinition?: string | null;
  /** Provenance + strategic link, set from the source surface (read-only chips). */
  sourceType?: string | null;
  sourceId?: string | null;
  sourceActionId?: string | null;
  strategicInitiativeId?: string | null;
  strategicProjectId?: string | null;
  /** Server-resolved display copy for the context chips + smart CTA. */
  sourceHeader?: string | null;
  sourceLabel?: string | null;
  strategicLinkLabel?: string | null;
  /** A real suggested owner (user id) from the source — pre-selected, editable. */
  suggestedOwnerId?: string | null;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const REQUIRED_MARK = (
  <span aria-hidden className="ps-required">
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
    <div className="ps-field">
      <span className="ps-label">
        {label}
        {required && REQUIRED_MARK}
      </span>

      {selectedUsers.length > 0 && (
        <div className="ps-picker-chips">
          {selectedUsers.map((u) => (
            <span key={u.id} className="ps-picker-chip">
              {userLabel(u)}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                aria-label={`Remove ${u.name ?? u.email}`}
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
        className="ps-input"
      />

      {/* A plain scroll container of native checkboxes/radios — no role="listbox"
          here, which would be invalid ARIA wrapping native form controls. */}
      <div
        className="ps-picker-list"
        role="group"
        aria-label={`${typeof label === "string" ? label : "User"} options`}
      >
        {available.length === 0 && (
          <span className="ps-picker-empty">{emptyHint ?? "No users available."}</span>
        )}
        {available.length > 0 && filtered.length === 0 && (
          <span className="ps-picker-empty">No matches for “{query}”.</span>
        )}
        {filtered.map((u) => {
          const checked = selected.includes(u.id);
          return (
            <label
              key={u.id}
              className={`ps-picker-option${checked ? " is-selected" : ""}`}
            >
              <input
                type={single ? "radio" : "checkbox"}
                checked={checked}
                onChange={() => toggle(u.id)}
              />
              <span>
                {u.name ?? u.email}
                {u.name && <span style={{ color: "var(--muted)" }}> · {u.email}</span>}
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
  currentUserId,
  onSaved,
  onCancel,
}: {
  initial?: ActionItemFormInitial;
  users: UserOption[];
  departments: DepartmentOption[];
  /**
   * The signed-in creator. On a brand-new action they are pre-selected as Lead
   * (the most common case), so the form is submittable without hunting for a
   * name first.
   */
  currentUserId?: string | null;
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
  const [actionType, setActionType] = useState<string>(initial?.actionType ?? "");
  const [successDefinition, setSuccessDefinition] = useState(
    initial?.successDefinition ?? ""
  );
  // Track whether the user has deliberately set priority, so a type's suggested
  // default only nudges a fresh, untouched action and never overrides a choice.
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [visibility, setVisibility] = useState<string>(
    initial?.visibility ?? "ALL_LEADERSHIP"
  );
  // One clear Deadline (comment #12). Older items may still carry a start/end
  // range; seed from the end date when present, else the single deadline. A
  // brand-new action (no initial date) defaults to a tight, editable target so
  // the required field is never blank and creation isn't blocked.
  const initialDeadline = asDate(initial?.deadlineEnd ?? initial?.deadlineStart);
  const [deadline, setDeadline] = useState(
    toDateInputValue(
      initialDeadline ??
        (isEdit ? null : addDays(new Date(), DEFAULT_ACTION_DEADLINE_DAYS))
    )
  );
  // New action → default the Lead to the creator when they're assignable; an
  // edit keeps its existing lead.
  const defaultLeadId =
    initial?.leadId ??
    // A real suggested owner from the source (e.g. a meeting participant) wins
    // over the creator default — never invented, only passed from a source.
    (!isEdit && initial?.suggestedOwnerId && users.some((u) => u.id === initial.suggestedOwnerId)
      ? initial.suggestedOwnerId
      : null) ??
    (!isEdit && currentUserId && users.some((u) => u.id === currentUserId)
      ? currentUserId
      : null);
  const [leadIds, setLeadIds] = useState<string[]>(
    defaultLeadId ? [defaultLeadId] : []
  );
  const [executingIds, setExecutingIds] = useState<string[]>(initialExecuting);
  const [inputIds, setInputIds] = useState<string[]>(initialInput);

  // Optional attachment (kept simple: a single labelled link added on save).
  const [fileLabel, setFileLabel] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const leadId = leadIds[0] ?? "";

  // Read-only related-entity link (set from the surface that started the action;
  // never edited in this form). Only carried through on create.
  const relatedEntityType = initial?.relatedEntityType ?? null;
  const relatedEntityId = initial?.relatedEntityId ?? null;
  const hasRelatedEntity = Boolean(relatedEntityType && relatedEntityId);
  const relatedTypeLabel = initial?.relatedEntityTypeLabel ?? "Linked item";
  const relatedLabel = initial?.relatedEntityLabel ?? null;

  // When a type is chosen on a brand-new action, nudge priority to the type's
  // sensible default — but only until the user sets priority themselves.
  function handleActionTypeChange(next: string) {
    setActionType(next);
    if (!isEdit && !priorityTouched && isActionType(next)) {
      setPriority(ACTION_TYPE_GUIDANCE[next].suggestedPriority);
    }
  }

  const typeGuidance = isActionType(actionType)
    ? ACTION_TYPE_GUIDANCE[actionType].helper
    : null;

  // --- Action System 4.0: honest context chips, live warnings, smart CTA ---
  const sourceType = initial?.sourceType ?? null;
  const sourceLabel = initial?.sourceLabel ?? null;
  const strategicLinkLabel = initial?.strategicLinkLabel ?? null;
  const hasStrategicLink = Boolean(
    initial?.strategicInitiativeId || initial?.strategicProjectId
  );

  // Live quality warnings, recomputed from the current draft (helpful, not
  // blocking — they never prevent a save).
  const warnings = useMemo(
    () =>
      deriveActionQualityWarnings({
        title,
        hasOwner: Boolean(leadId) || executingIds.length > 0,
        hasDueDate: Boolean(deadline),
        successDefinition,
        status,
        sourceType,
        hasStrategicLink,
      }),
    [title, leadId, executingIds, deadline, successDefinition, status, sourceType, hasStrategicLink]
  );

  // Context-aware primary CTA — never a generic "Submit".
  const createCtaLabel = useMemo(() => {
    switch (sourceType) {
      case "FOLLOW_UP":
        return "Create follow-up";
      case "MEETING":
      case "MEETING_DECISION":
        return "Add meeting follow-up";
      case "PROJECT":
        return "Save project action";
      case "INITIATIVE":
        return "Save initiative action";
      case "ENTITY":
        return "Save linked action";
      default:
        return "Create action";
    }
  }, [sourceType]);

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
            // Always send the type on edit: a value sets it, an empty string
            // clears it (interpreted by parseActionTypeUpdate server-side).
            actionType,
            departmentId: departmentId || undefined,
            status,
            priority,
            visibility,
            // Single Deadline writes the start column; the legacy end column is
            // cleared so the item carries one canonical date.
            deadlineStart: deadline || undefined,
            deadlineEnd: null,
            leadId,
            // Definition of done is editable on an existing action.
            successDefinition: successDefinition.trim(),
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
            actionType: actionType || undefined,
            departmentId: departmentId || undefined,
            leadId,
            status,
            priority,
            visibility,
            deadlineStart: deadline,
            deadlineEnd: undefined,
            executingUserIds: executors,
            inputUserIds: inputIds,
            // Carry the read-only link through; the server re-validates it.
            relatedEntityType: relatedEntityType ?? undefined,
            relatedEntityId: relatedEntityId ?? undefined,
            // Carry the source meeting through when the action was started from
            // one (a decision / recap prefill); the server re-validates it.
            officerMeetingId: initial?.officerMeetingId ?? undefined,
            // Action 4.0 honest context — all server-revalidated. Source
            // provenance + the explicit strategic link travel with the action.
            sourceType: initial?.sourceType ?? undefined,
            sourceId: initial?.sourceId ?? undefined,
            sourceActionId: initial?.sourceActionId ?? undefined,
            strategicInitiativeId: initial?.strategicInitiativeId ?? undefined,
            strategicProjectId: initial?.strategicProjectId ?? undefined,
            successDefinition: successDefinition.trim() || undefined,
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
    <form onSubmit={handleSubmit} className="ps-form">
      <FeedbackBanner message={error} tone="error" style={{ padding: "8px 12px" }} />

      {hasRelatedEntity && (
        <div className="ps-linked-banner">
          <span style={{ fontWeight: 700 }}>Linked to {relatedTypeLabel}:</span>
          <span>{relatedLabel ?? "this item"}</span>
        </div>
      )}

      {(sourceLabel || strategicLinkLabel) && (
        <div className="ps-linked-banner" style={{ flexWrap: "wrap", gap: 12 }}>
          {sourceLabel ? (
            <span>
              <span style={{ fontWeight: 700 }}>Source: </span>
              {sourceLabel}
            </span>
          ) : null}
          {strategicLinkLabel ? (
            <span>
              <span style={{ fontWeight: 700 }}>Strategic: </span>
              {strategicLinkLabel}
            </span>
          ) : null}
        </div>
      )}

      <div className="ps-field">
        <label className="ps-label" htmlFor="action-title">
          Title{REQUIRED_MARK}
        </label>
        <input
          id="action-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="ps-input"
          placeholder="e.g. Refresh fall curriculum rollout"
        />
      </div>

      <div className="ps-field">
        <label className="ps-label" htmlFor="action-description">
          Description
        </label>
        <textarea
          id="action-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="ps-textarea"
          placeholder="Optional context, scope, and background"
        />
      </div>

      <div className="ps-field">
        <label className="ps-label" htmlFor="action-success">
          Definition of done
        </label>
        <textarea
          id="action-success"
          value={successDefinition}
          onChange={(e) => setSuccessDefinition(e.target.value)}
          rows={2}
          className="ps-textarea"
          placeholder="What specifically has to be true for this to count as done?"
        />
        <p className="ps-help" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
          A clear finish line keeps the action from drifting.
        </p>
      </div>

      <div className="ps-field">
        <label className="ps-label" htmlFor="action-type">
          Action type
        </label>
        <select
          id="action-type"
          value={actionType}
          onChange={(e) => handleActionTypeChange(e.target.value)}
          className="ps-select"
        >
          <option value="">— No type —</option>
          {ACTION_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {ACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {typeGuidance ? <p className="ps-hint">{typeGuidance}</p> : null}
      </div>

      <div className="ps-field-grid">
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-goal-category">
            Goal category
          </label>
          <input
            id="action-goal-category"
            value={goalCategory}
            onChange={(e) => setGoalCategory(e.target.value)}
            className="ps-input"
            placeholder="Goal this ladders up to"
          />
        </div>
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-department">
            Department
          </label>
          <select
            id="action-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="ps-select"
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

      <div className="ps-field-grid">
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-status">
            Status
          </label>
          <select
            id="action-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ps-select"
          >
            {ACTION_STATUS_SELECTABLE.map((s) => (
              <option key={s} value={s}>
                {ACTION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-priority">
            Priority
          </label>
          <select
            id="action-priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPriorityTouched(true);
            }}
            className="ps-select"
          >
            {ACTION_PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {ACTION_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-visibility">
            Visibility{REQUIRED_MARK}
          </label>
          <select
            id="action-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="ps-select"
          >
            {ACTION_VISIBILITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {ACTION_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ps-field-grid">
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-deadline">
            Deadline{REQUIRED_MARK}
          </label>
          <input
            id="action-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="ps-input"
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

      <fieldset className="ps-fieldset">
        <legend className="ps-label">Attachment (optional)</legend>
        <div className="ps-field-grid">
          <div className="ps-field">
            <label className="ps-label" htmlFor="action-file-label">
              Label
            </label>
            <input
              id="action-file-label"
              value={fileLabel}
              onChange={(e) => setFileLabel(e.target.value)}
              className="ps-input"
              placeholder="e.g. Project brief"
            />
          </div>
          <div className="ps-field">
            <label className="ps-label" htmlFor="action-file-url">
              Link (http/https)
            </label>
            <input
              id="action-file-url"
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="ps-input"
              placeholder="https://…"
            />
          </div>
        </div>
      </fieldset>

      {warnings.length > 0 && (
        <div
          className="card"
          role="status"
          style={{ padding: "10px 12px", borderColor: "var(--border)", background: "var(--surface-2, transparent)" }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
            Make this a stronger action
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--muted)" }}>
            {warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

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
          {pending ? "Saving…" : isEdit ? "Save changes" : createCtaLabel}
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
