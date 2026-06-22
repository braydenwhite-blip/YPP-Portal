"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { FeedbackBanner } from "@/components/people-strategy/motion";
import {
  ActionUserPicker,
  type ActionUserOption,
} from "@/components/people-strategy/action-user-picker";
import { ActionDepartmentPicker } from "@/components/people-strategy/action-department-picker";
import type { ActionDepartmentOption } from "@/lib/people-strategy/action-departments";
import { addDays, toDateInputValue } from "@/lib/leadership-action-center/dates";
import { createActionItem } from "@/lib/people-strategy/action-items-actions";
import {
  ACTION_DEADLINE_PRESETS,
  actionDeadlinePresetHint,
  actionDeadlinePresetValue,
  matchActionDeadlinePreset,
  type ActionDeadlinePresetId,
} from "@/lib/people-strategy/action-deadline-presets";
import {
  ACTION_PRIORITY_LABELS,
  ACTION_PRIORITY_VALUES,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_SELECTABLE,
  DEFAULT_ACTION_DEADLINE_DAYS,
} from "@/lib/people-strategy/constants";

type UserOption = ActionUserOption;

const DEADLINE_PRESETS = ACTION_DEADLINE_PRESETS.filter((preset) => preset.id !== "this-week");

function defaultAssigneeIds(users: UserOption[], currentUserId: string): string[] {
  const defaultAssignee =
    users.some((u) => u.id === currentUserId) ? currentUserId : users[0]?.id ?? "";
  return defaultAssignee ? [defaultAssignee] : [];
}

/**
 * Add an action — inline expander on initiative panels and the action tracker.
 * For the dedicated `/actions/new` page, use {@link ActionCreateForm} instead.
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
  /** Open the inline form on load. */
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
      <div id="create-action" ref={rootRef} className="mt-4">
        <button
          type="button"
          className="group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-[rgba(107,33,200,0.28)] bg-[linear-gradient(135deg,rgba(107,33,200,0.14)_0%,rgba(139,63,232,0.08)_48%,rgba(255,255,255,0.92)_100%)] px-[18px] py-4 text-left font-[inherit] shadow-[var(--ps-accent-glow)] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-[rgba(107,33,200,0.45)] hover:shadow-[0_14px_32px_rgba(107,33,200,0.28)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ps-accent)]"
          onClick={() => setOpen(true)}
        >
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--ps-accent-gradient)] text-[26px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(107,33,200,0.35)]"
            aria-hidden
          >
            +
          </span>
          <span className="grid min-w-0 flex-1 gap-[3px]">
            <strong className="text-base font-extrabold tracking-[-0.02em] text-[var(--ps-ink,var(--ypp-ink))]">
              Add action
            </strong>
            <span className="text-[13px] leading-[1.4] text-[var(--ps-ink-soft,var(--muted))]">
              What needs to get done? Title, people, due date — under a minute.
            </span>
          </span>
          <span
            className="shrink-0 text-xl font-bold text-[var(--ps-accent)] opacity-85 transition-transform duration-150 group-hover:translate-x-[3px]"
            aria-hidden
          >
            →
          </span>
        </button>
      </div>
    );
  }

  return (
    <div id="create-action" ref={rootRef} className="ps-form-card mt-4">
      <form onSubmit={handleSubmit} className="ps-form">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="ps-section-title m-0">Add action</h2>
          <button
            type="button"
            className="button outline small"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </div>

        <p className="mb-3 text-[13px] text-[var(--ps-ink-soft,var(--muted))]">
          Title, people, and due date are required. Everything in More details is optional.
        </p>

        <FeedbackBanner message={error} tone="error" style={{ padding: "8px 12px" }} />

        <div className="ps-field">
          <label className="ps-label" htmlFor="quick-action-title-inline">
            What needs to get done? <span className="ps-required">*</span>
          </label>
          <input
            id="quick-action-title-inline"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="ps-input"
            placeholder="e.g. Confirm fall class schedule with chapter"
            autoComplete="off"
            autoFocus
          />
        </div>

        <ActionUserPicker
          id="quick-action-people-inline"
          label="Who's involved?"
          required
          users={users}
          selected={assignedUserIds}
          onChange={setAssignedUserIds}
          emptyHint="No assignable users found."
        />
        <p className="-mt-1 text-[12px] text-[var(--ps-ink-soft,var(--muted))]">
          Add everyone who should see this. The first person is the lead.
        </p>

        {currentUserId &&
        users.some((u) => u.id === currentUserId) &&
        !assignedUserIds.includes(currentUserId) ? (
          <button
            type="button"
            className="button outline small -mt-1 justify-self-start"
            onClick={() => setAssignedUserIds((current) => [currentUserId, ...current])}
          >
            Add me
          </button>
        ) : null}

        <div className="ps-field">
          <label className="ps-label" htmlFor="quick-action-deadline-inline">
            Due date <span className="ps-required">*</span>
          </label>
          <input
            id="quick-action-deadline-inline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="ps-input"
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DEADLINE_PRESETS.map((preset) => {
              const active = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`pill pill-${active ? "purple" : "neutral"} pill-small cursor-pointer border border-[var(--border)]`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {presetHint ? (
            <p className="mt-1.5 text-[12px] text-[var(--ps-ink-soft,var(--muted))]">{presetHint}</p>
          ) : null}
        </div>

        <ActionDepartmentPicker
          id="quick-action-department-inline"
          departments={departments}
          value={departmentId}
          onChange={setDepartmentId}
          compact
        />

        <details className="mt-1">
          <summary className="cursor-pointer text-[13px] font-semibold text-[var(--ps-ink-soft,var(--muted))]">
            More details (optional)
          </summary>
          <div className="mt-3 grid gap-3">
            <div className="ps-field">
              <label className="ps-label" htmlFor="quick-action-description-inline">
                Notes / context
              </label>
              <textarea
                id="quick-action-description-inline"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="ps-textarea"
                rows={3}
                placeholder="Links, background, next step…"
              />
            </div>

            <div className="ps-field-grid">
              <div className="ps-field">
                <label className="ps-label" htmlFor="quick-action-status-inline">
                  Status
                </label>
                <select
                  id="quick-action-status-inline"
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
                <label className="ps-label" htmlFor="quick-action-priority-inline">
                  Priority
                </label>
                <select
                  id="quick-action-priority-inline"
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
            </div>

            <ActionUserPicker
              id="quick-action-input-inline"
              label="Input (optional)"
              users={users}
              selected={inputUserIds}
              onChange={setInputUserIds}
              excludeIds={assignedUserIds}
              emptyHint="No assignable users found."
            />
          </div>
        </details>

        <div className="mt-2 flex justify-end gap-2">
          <button type="submit" className="button small" disabled={pending}>
            {pending ? "Saving…" : "Add action"}
          </button>
        </div>
      </form>
    </div>
  );
}
