"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { createActionItem } from "@/lib/people-strategy/action-items-actions";
import {
  ACTION_PRIORITY_LABELS,
  ACTION_PRIORITY_VALUES,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_SELECTABLE,
  DEFAULT_ACTION_DEADLINE_DAYS,
} from "@/lib/people-strategy/constants";
import type { ActionDepartmentOption } from "@/lib/people-strategy/action-queries";
import { addDays, toDateInputValue } from "@/lib/leadership-action-center/dates";
import {
  ACTION_DEADLINE_PRESETS,
  actionDeadlinePresetHint,
  actionDeadlinePresetValue,
  matchActionDeadlinePreset,
  type ActionDeadlinePresetId,
} from "@/lib/people-strategy/action-deadline-presets";
import { FeedbackBanner } from "@/components/people-strategy/motion";
import {
  ActionUserPicker,
  type ActionUserOption,
} from "@/components/people-strategy/action-user-picker";

type UserOption = ActionUserOption;

const DEADLINE_PRESETS = ACTION_DEADLINE_PRESETS.filter((preset) => preset.id !== "this-week");

function defaultAssigneeIds(users: UserOption[], currentUserId: string): string[] {
  const defaultAssignee =
    users.some((u) => u.id === currentUserId) ? currentUserId : users[0]?.id ?? "";
  return defaultAssignee ? [defaultAssignee] : [];
}

/**
 * Add an action — portal-styled form with 3 required fields and optional details.
 */
export function ActionQuickCreate({
  users,
  departments,
  currentUserId,
  redirectTo = "/actions",
  initiativeLink,
  defaultOpen = false,
}: {
  users: UserOption[];
  departments: ActionDepartmentOption[];
  currentUserId: string;
  redirectTo?: string;
  /** When set, new actions are linked to this initiative (plan → work). */
  initiativeLink?: { id: string; goalCategory?: string };
  /** Open the form on load (e.g. /actions?create=1). */
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!defaultOpen) return;
    setOpen(true);
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [defaultOpen]);

  const [title, setTitle] = useState("");
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>(() =>
    defaultAssigneeIds(users, currentUserId)
  );
  const [inputUserIds, setInputUserIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(
    toDateInputValue(addDays(new Date(), DEFAULT_ACTION_DEADLINE_DAYS))
  );
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("NOT_STARTED");
  const [priority, setPriority] = useState("MEDIUM");

  const activePreset = matchActionDeadlinePreset(deadline);
  const presetHint = activePreset ? actionDeadlinePresetHint(activePreset) : null;

  function applyPreset(id: ActionDeadlinePresetId) {
    setDeadline(actionDeadlinePresetValue(id));
  }

  function resetForm() {
    setTitle("");
    setAssignedUserIds(defaultAssigneeIds(users, currentUserId));
    setInputUserIds([]);
    setDescription("");
    setDepartmentId("");
    setStatus("NOT_STARTED");
    setPriority("MEDIUM");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Add a title — what needs to get done?");
      return;
    }
    if (assignedUserIds.length === 0 || !deadline) {
      setError("Add at least one person and a due date.");
      return;
    }

    const leadId = assignedUserIds[0];
    const executingUserIds = assignedUserIds.slice(1);

    startTransition(async () => {
      try {
        await createActionItem({
          title: trimmed,
          leadId,
          executingUserIds: executingUserIds.length > 0 ? executingUserIds : undefined,
          inputUserIds: inputUserIds.length > 0 ? inputUserIds : undefined,
          deadlineStart: deadline,
          description: description.trim() || undefined,
          departmentId: departmentId || undefined,
          status,
          priority,
          ...(initiativeLink
            ? {
                strategicInitiativeId: initiativeLink.id,
                sourceType: "INITIATIVE" as const,
                goalCategory: initiativeLink.goalCategory,
              }
            : {}),
        });
        resetForm();
        setOpen(false);
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add that.");
      }
    });
  }

  if (users.length === 0) return null;

  if (!open) {
    return (
      <div id="create-action" ref={rootRef} style={{ marginTop: 16 }}>
        <button type="button" className="ps-add-action-cta" onClick={() => setOpen(true)}>
          <span className="ps-add-action-cta-icon" aria-hidden>
            +
          </span>
          <span className="ps-add-action-cta-copy">
            <strong>Add action</strong>
            <span>What needs to get done? Title, people, due date — under a minute.</span>
          </span>
          <span className="ps-add-action-cta-arrow" aria-hidden>
            →
          </span>
        </button>
      </div>
    );
  }

  return (
    <div id="create-action" ref={rootRef} className="ps-form-card" style={{ marginTop: 16 }}>
      <form onSubmit={handleSubmit} className="ps-form">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <h2 className="ps-section-title" style={{ margin: 0 }}>
            Add action
          </h2>
          <button
            type="button"
            className="button outline small"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </div>

        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ps-ink-soft, var(--muted))" }}>
          Title, people, and due date are required. Everything in More details is optional.
        </p>

        <FeedbackBanner message={error} tone="error" style={{ padding: "8px 12px" }} />

        <div className="ps-field">
          <label className="ps-label" htmlFor="quick-action-title">
            What needs to get done? <span className="ps-required">*</span>
          </label>
          <input
            id="quick-action-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="ps-input"
            placeholder="e.g. Confirm fall class schedule with chapter"
            autoComplete="off"
            autoFocus
          />
        </div>

        <ActionUserPicker
          id="quick-action-people"
          label="Who's involved?"
          required
          users={users}
          selected={assignedUserIds}
          onChange={setAssignedUserIds}
          emptyHint="No assignable users found."
        />
        <p
          style={{
            margin: "-4px 0 0",
            fontSize: 12,
            color: "var(--ps-ink-soft, var(--muted))",
          }}
        >
          Add everyone who should see this. The first person is the lead.
        </p>

        {currentUserId && users.some((u) => u.id === currentUserId) && !assignedUserIds.includes(currentUserId) ? (
          <button
            type="button"
            className="button outline small"
            style={{ justifySelf: "start", marginTop: -4 }}
            onClick={() => setAssignedUserIds((current) => [currentUserId, ...current])}
          >
            Add me
          </button>
        ) : null}

        <div className="ps-field">
          <label className="ps-label" htmlFor="quick-action-deadline">
            Due date <span className="ps-required">*</span>
          </label>
          <input
            id="quick-action-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="ps-input"
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {DEADLINE_PRESETS.map((preset) => {
              const active = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`pill pill-${active ? "purple" : "neutral"} pill-small`}
                  style={{ cursor: "pointer", border: "1px solid var(--border)" }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {presetHint ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "var(--ps-ink-soft, var(--muted))",
              }}
            >
              {presetHint}
            </p>
          ) : null}
        </div>

        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ps-ink-soft, var(--muted))" }}>
            More details (optional)
          </summary>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div className="ps-field">
              <label className="ps-label" htmlFor="quick-action-description">
                Notes / context
              </label>
              <textarea
                id="quick-action-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="ps-textarea"
                rows={3}
                placeholder="Links, background, next step…"
              />
            </div>

            <div className="ps-field-grid">
              <div className="ps-field">
                <label className="ps-label" htmlFor="quick-action-status">
                  Status
                </label>
                <select
                  id="quick-action-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="ps-select"
                >
                  {ACTION_STATUS_SELECTABLE.map((value) => (
                    <option key={value} value={value}>
                      {ACTION_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor="quick-action-priority">
                  Priority
                </label>
                <select
                  id="quick-action-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
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
                <label className="ps-label" htmlFor="quick-action-department">
                  Department
                </label>
                <select
                  id="quick-action-department"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="ps-select"
                >
                  <option value="">— No department —</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ActionUserPicker
              id="quick-action-input"
              label="Input (optional)"
              users={users}
              selected={inputUserIds}
              onChange={setInputUserIds}
              excludeIds={assignedUserIds}
              emptyHint="No assignable users found."
            />
          </div>
        </details>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button type="submit" className="button small" disabled={pending}>
            {pending ? "Saving…" : "Add action"}
          </button>
        </div>
      </form>
    </div>
  );
}
