"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, ButtonLink, cn } from "@/components/ui-v2";
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
  ACTION_STATUS_LABELS,
  ACTION_STATUS_SELECTABLE,
  DEFAULT_ACTION_DEADLINE_DAYS,
} from "@/lib/people-strategy/constants";

const DEADLINE_PRESETS = ACTION_DEADLINE_PRESETS.filter((preset) => preset.id !== "this-week");

const inputClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const titleInputClass = cn(inputClass, "py-3.5 text-[16px] font-medium tracking-[-0.01em]");
const selectClass = inputClass;

function defaultAssigneeIds(users: ActionUserOption[], currentUserId: string): string[] {
  const defaultAssignee =
    users.some((u) => u.id === currentUserId) ? currentUserId : users[0]?.id ?? "";
  return defaultAssignee ? [defaultAssignee] : [];
}

function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
          {hint ? <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-ink-muted">{hint}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Calm OS create-action form — used on `/actions/new`. */
export function ActionCreateForm({
  users,
  departments,
  currentUserId,
  redirectTo = "/actions",
  cancelHref,
  initiativeLink,
}: {
  users: ActionUserOption[];
  departments: ActionDepartmentOption[];
  currentUserId: string;
  redirectTo?: string;
  cancelHref?: string;
  initiativeLink?: { id: string; goalCategory?: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const activePreset = matchActionDeadlinePreset(deadline);
  const presetHint = activePreset ? actionDeadlinePresetHint(activePreset) : null;
  const backHref = cancelHref ?? redirectTo;

  function applyPreset(id: ActionDeadlinePresetId) {
    setDeadline(actionDeadlinePresetValue(id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Add a short title — what needs to get done?");
      return;
    }
    if (assignedUserIds.length === 0 || !deadline) {
      setError("Pick at least one person and a due date.");
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
          ...(initiativeLink
            ? {
                strategicInitiativeId: initiativeLink.id,
                sourceType: "INITIATIVE" as const,
                goalCategory: initiativeLink.goalCategory,
              }
            : {}),
        });
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save that action.");
      }
    });
  }

  if (users.length === 0) return null;

  return (
    <div
      id="create-action"
      className="overflow-hidden rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/40 via-surface to-surface shadow-card"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
          <FeedbackBanner message={error} tone="error" style={{ padding: "10px 14px" }} />

          <FormSection step={1} title="What needs doing?" hint="Keep it short — one clear outcome.">
            <input
              id="action-create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={titleInputClass}
              placeholder="e.g. Confirm fall class schedule with chapter"
              autoComplete="off"
              autoFocus
            />
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection step={2} title="Who's on this?" hint="Add everyone who should see it.">
            <ActionUserPicker
              id="action-create-people"
              variant="calm"
              label="People"
              required
              users={users}
              selected={assignedUserIds}
              onChange={setAssignedUserIds}
              emptyHint="No assignable users found."
            />
            {currentUserId &&
            users.some((u) => u.id === currentUserId) &&
            !assignedUserIds.includes(currentUserId) ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setAssignedUserIds((current) => [currentUserId, ...current])}
              >
                Add me
              </Button>
            ) : null}
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection step={3} title="When is it due?" hint="Pick a quick date or choose exactly.">
            <div className="flex flex-wrap gap-2">
              {DEADLINE_PRESETS.map((preset) => {
                const active = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                      active
                        ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                        : "border-line-soft bg-surface text-ink-muted hover:border-brand-300 hover:text-ink"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <label className="sr-only" htmlFor="action-create-deadline">
              Due date
            </label>
            <input
              id="action-create-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={cn(inputClass, "max-w-[220px]")}
            />
            {presetHint ? <p className="m-0 text-[12.5px] text-ink-muted">{presetHint}</p> : null}
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection
            step={4}
            title="Which team owns it?"
            hint="Chapters, tech, comms, social, officers, board, and the core teams."
          >
            <ActionDepartmentPicker
              id="action-create-department"
              label="Team / department"
              hint={undefined}
              departments={departments}
              value={departmentId}
              onChange={setDepartmentId}
              compact
            />
          </FormSection>

          <div className="rounded-[14px] border border-dashed border-line-soft bg-surface/60">
            <div className="border-b border-line-soft px-4 py-3.5">
              <p className="m-0 text-[13.5px] font-semibold text-ink">Notes & extras</p>
              <p className="m-0 mt-0.5 text-[12px] text-ink-muted">Optional</p>
            </div>

            <div className="space-y-4 border-t border-line-soft px-4 py-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-ink" htmlFor="action-create-notes">
                  Notes
                </label>
                <textarea
                  id="action-create-notes"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(inputClass, "min-h-[96px] resize-y")}
                  rows={3}
                  placeholder="Links, background, or next step…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-1">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-ink" htmlFor="action-create-status">
                    Status
                  </label>
                  <select
                    id="action-create-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={selectClass}
                  >
                    {ACTION_STATUS_SELECTABLE.map((value) => (
                      <option key={value} value={value}>
                        {ACTION_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ActionUserPicker
                id="action-create-input"
                variant="calm"
                label="Needs input from"
                users={users}
                selected={inputUserIds}
                onChange={setInputUserIds}
                excludeIds={assignedUserIds}
                emptyHint="No assignable users found."
              />
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
          <p className="m-0 text-[12.5px] text-ink-muted">Three fields — under a minute.</p>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={backHref} variant="ghost" size="md">
              Cancel
            </ButtonLink>
            <Button type="submit" variant="primary" size="md" disabled={pending}>
              {pending ? "Saving…" : "Add action →"}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
