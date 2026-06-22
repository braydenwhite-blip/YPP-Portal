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
import {
  ActionUserPicker,
  type ActionUserOption,
} from "@/components/people-strategy/action-user-picker";
import { ActionDepartmentPicker } from "@/components/people-strategy/action-department-picker";
import type { ActionDepartmentOption } from "@/lib/people-strategy/action-departments";
import { deriveActionQualityWarnings } from "@/lib/people-strategy/action-quality";
import { listInitiativeDefs } from "@/lib/people-strategy/strategic-initiatives";

interface UserOption extends ActionUserOption {}

type DepartmentOption = ActionDepartmentOption;

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

/** One-click deadline presets so common dates never need the date picker. */
const DEADLINE_PRESETS: Array<{ label: string; days: number }> = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

const COMMUNICATION_AUDIENCES = [
  "instructor",
  "applicant",
  "mentor",
  "partner",
  "parent",
  "officer",
  "other",
] as const;

const REQUIRED_MARK = (
  <span aria-hidden className="ps-required">
    *
  </span>
);

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ps-form-section" style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15 }}>{title}</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

export default function ActionItemForm({
  initial,
  users,
  departments,
  currentUserId,
  onSaved,
  onCancel,
  variant = "simple",
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
  /** `simple` = title + owner + due date upfront; rest in "More options". */
  variant?: "simple" | "full";
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const useSimpleLayout = variant === "simple";

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
  const initiativeOptions = useMemo(
    () => listInitiativeDefs().filter((initiative) => initiative.status !== "archived"),
    []
  );
  const initialStrategicInitiativeId = initial?.strategicInitiativeId ?? "";
  const [strategicInitiativeId, setStrategicInitiativeId] = useState(
    initialStrategicInitiativeId
  );

  // Optional attachment (kept simple: a single labelled link added on save).
  const [fileLabel, setFileLabel] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  // Communication-needed capture. There is no dedicated DB field; checking the
  // box composes a structured "Communication needed" line into the description
  // on save, which the operations summary's communication detector picks up.
  const [communicationNeeded, setCommunicationNeeded] = useState(false);
  const [communicationAudience, setCommunicationAudience] = useState<string>("instructor");
  const [communicationContact, setCommunicationContact] = useState("");

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
  const selectedInitiative = initiativeOptions.find(
    (initiative) => initiative.id === strategicInitiativeId
  );
  const preservesInitialProject =
    Boolean(initial?.strategicProjectId) &&
    strategicInitiativeId === initialStrategicInitiativeId;
  const strategicContextLabel =
    preservesInitialProject && strategicLinkLabel
      ? strategicLinkLabel
      : selectedInitiative?.title ?? null;
  const hasStrategicLink = Boolean(
    strategicInitiativeId || (preservesInitialProject && initial?.strategicProjectId)
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

  const showMoreOptions =
    !useSimpleLayout ||
    Boolean(
      initial?.description ||
        initial?.successDefinition ||
        initial?.actionType ||
        initial?.goalCategory ||
        initial?.departmentId ||
        (initial?.executingUserIds?.length ?? 0) > 0 ||
        (initial?.inputUserIds?.length ?? 0) > 0 ||
        hasRelatedEntity ||
        sourceLabel ||
        strategicContextLabel
    );

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

    // Compose the communication request into the description so it travels
    // with the action and the operations summary surfaces it under
    // "Communications needed".
    const communicationLine = communicationNeeded
      ? `Communication needed: message ${communicationContact.trim() || `the ${communicationAudience}`} (${communicationAudience}).`
      : null;
    const finalDescription = [description.trim(), communicationLine]
      .filter(Boolean)
      .join("\n\n");

    startTransition(async () => {
      try {
        if (isEdit && initial?.id) {
          const id = initial.id;
          await updateActionItem({
            id,
            title: title.trim(),
            description: finalDescription,
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
            strategicInitiativeId: strategicInitiativeId || null,
            strategicProjectId: preservesInitialProject
              ? initial?.strategicProjectId ?? null
              : null,
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
            description: finalDescription || undefined,
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
            strategicInitiativeId: strategicInitiativeId || undefined,
            strategicProjectId: preservesInitialProject
              ? initial?.strategicProjectId ?? undefined
              : undefined,
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
          router.push("/actions");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save the action item.");
      }
    });
  }

  const extendedFields = (
    <>
      <div className="ps-field">
        <label className="ps-label" htmlFor="action-success-ext">
          Next step / definition of done
        </label>
        <textarea
          id="action-success-ext"
          value={successDefinition}
          onChange={(e) => setSuccessDefinition(e.target.value)}
          rows={2}
          className="ps-textarea"
          placeholder="What has to happen next, and how will we know it is done?"
        />
      </div>

      <ActionUserPicker
        label="Executing (optional — defaults to owner)"
        users={users}
        selected={executingIds}
        onChange={setExecutingIds}
        emptyHint="No assignable users found."
      />

      <ActionUserPicker
        label="Input (optional)"
        users={users}
        selected={inputIds}
        onChange={setInputIds}
        emptyHint="No assignable users found."
      />

      <div className="ps-field-grid">
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-status-ext">
            Status
          </label>
          <select
            id="action-status-ext"
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
          <label className="ps-label" htmlFor="action-priority-ext">
            Priority
          </label>
          <select
            id="action-priority-ext"
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
          <label className="ps-label" htmlFor="action-visibility-ext">
            Visibility{REQUIRED_MARK}
          </label>
          <select
            id="action-visibility-ext"
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

      {hasRelatedEntity ? (
        <div className="ps-linked-banner">
          <span style={{ fontWeight: 700 }}>Linked to {relatedTypeLabel}:</span>
          <span>{relatedLabel ?? "this item"}</span>
        </div>
      ) : null}

      {(sourceLabel || strategicContextLabel) ? (
        <div className="ps-linked-banner" style={{ flexWrap: "wrap", gap: 12 }}>
          {sourceLabel ? (
            <span>
              <span style={{ fontWeight: 700 }}>Source: </span>
              {sourceLabel}
            </span>
          ) : null}
          {strategicContextLabel ? (
            <span>
              <span style={{ fontWeight: 700 }}>Strategic: </span>
              {strategicContextLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ps-field">
        <label className="ps-label" htmlFor="action-strategic-initiative-ext">
          Related initiative
        </label>
        <select
          id="action-strategic-initiative-ext"
          value={strategicInitiativeId}
          onChange={(e) => setStrategicInitiativeId(e.target.value)}
          className="ps-select"
        >
          <option value="">No related initiative</option>
          {initiativeOptions.map((initiative) => (
            <option key={initiative.id} value={initiative.id}>
              {initiative.title}
            </option>
          ))}
        </select>
      </div>

      <div className="ps-field">
        <label className="ps-label" htmlFor="action-description-ext">
          Description / context
        </label>
        <textarea
          id="action-description-ext"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="ps-textarea"
          placeholder="Optional context, scope, and background"
        />
      </div>

      <div className="ps-field-grid">
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-type-ext">
            Action type
          </label>
          <select
            id="action-type-ext"
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
        <ActionDepartmentPicker
          id="action-department-ext"
          departments={departments}
          value={departmentId}
          onChange={setDepartmentId}
          compact
        />
      </div>
    </>
  );

  return (
    <MotionArea>
    <form onSubmit={handleSubmit} className="ps-form">
      <FeedbackBanner message={error} tone="error" style={{ padding: "8px 12px" }} />

      {useSimpleLayout ? (
        <>
          <section className="ps-form-section" style={{ display: "grid", gap: 12 }}>
            <div className="ps-field">
              <label className="ps-label" htmlFor="action-title">
                What needs to happen?{REQUIRED_MARK}
              </label>
              <input
                id="action-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="ps-input"
                placeholder="e.g. Refresh fall curriculum rollout"
                autoFocus
              />
            </div>

            <ActionUserPicker
              label="Owner"
              required
              single
              users={users}
              selected={leadIds}
              onChange={setLeadIds}
              emptyHint="No assignable users found."
            />

            {currentUserId && users.some((u) => u.id === currentUserId) && leadIds[0] !== currentUserId ? (
              <button
                type="button"
                className="button outline small"
                style={{ justifySelf: "start" }}
                onClick={() => setLeadIds([currentUserId])}
              >
                Assign me
              </button>
            ) : null}

            <div className="ps-field">
              <label className="ps-label" htmlFor="action-deadline">
                Due{REQUIRED_MARK}
              </label>
              <input
                id="action-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="ps-input"
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {DEADLINE_PRESETS.map((preset) => {
                  const value = toDateInputValue(addDays(new Date(), preset.days));
                  const active = deadline === value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDeadline(value)}
                      className={`pill pill-${active ? "purple" : "neutral"} pill-small`}
                      style={{ cursor: "pointer", border: "1px solid var(--border)" }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <ActionDepartmentPicker
              id="action-department"
              departments={departments}
              value={departmentId}
              onChange={setDepartmentId}
            />
          </section>

          <details open={showMoreOptions} className="ps-form-more" style={{ marginTop: 4 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
              More options
            </summary>
            <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
              {extendedFields}
            </div>
          </details>
        </>
      ) : (
        <>
      <FormSection
        title="1. What needs to happen?"
        description="Write the action in plain language and define the finish line."
      >
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
          <label className="ps-label" htmlFor="action-success">
            Next step / definition of done
          </label>
          <textarea
            id="action-success"
            value={successDefinition}
            onChange={(e) => setSuccessDefinition(e.target.value)}
            rows={2}
            className="ps-textarea"
            placeholder="What has to happen next, and how will we know it is done?"
          />
          <p className="ps-help" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            A clear next step keeps the action from drifting.
          </p>
        </div>
      </FormSection>

      <FormSection
        title="2. Who owns it?"
        description="Pick the accountable lead first. Add executors or input people only when needed."
      >
        <ActionUserPicker
          label="Lead (exactly one)"
          required
          single
          users={users}
          selected={leadIds}
          onChange={setLeadIds}
          emptyHint="No assignable users found."
        />

        {currentUserId && users.some((u) => u.id === currentUserId) && leadIds[0] !== currentUserId ? (
          <button
            type="button"
            className="button outline small"
            style={{ justifySelf: "start" }}
            onClick={() => setLeadIds([currentUserId])}
          >
            Assign me as Lead
          </button>
        ) : null}

        <ActionUserPicker
          label="Executing (optional — defaults to the Lead)"
          users={users}
          selected={executingIds}
          onChange={setExecutingIds}
          emptyHint="No assignable users found."
        />

        <ActionUserPicker
          label="Input (optional)"
          users={users}
          selected={inputIds}
          onChange={setInputIds}
          emptyHint="No assignable users found."
        />
      </FormSection>

      <FormSection
        title="3. When is it due?"
        description="Set the date, status, priority, and visibility so the tracker can place it correctly."
      >
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {DEADLINE_PRESETS.map((preset) => {
                const value = toDateInputValue(addDays(new Date(), preset.days));
                const active = deadline === value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDeadline(value)}
                    className={`pill pill-${active ? "purple" : "neutral"} pill-small`}
                    style={{ cursor: "pointer", border: "1px solid var(--border)" }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
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
      </FormSection>

      <FormSection
        title="4. Where did this come from?"
        description="Keep the action tied to its meeting, decision, project, or related YPP record."
      >
        {hasRelatedEntity ? (
          <div className="ps-linked-banner">
            <span style={{ fontWeight: 700 }}>Linked to {relatedTypeLabel}:</span>
            <span>{relatedLabel ?? "this item"}</span>
          </div>
        ) : null}

        {(sourceLabel || strategicContextLabel) ? (
          <div className="ps-linked-banner" style={{ flexWrap: "wrap", gap: 12 }}>
            {sourceLabel ? (
              <span>
                <span style={{ fontWeight: 700 }}>Source: </span>
                {sourceLabel}
              </span>
            ) : null}
            {strategicContextLabel ? (
              <span>
                <span style={{ fontWeight: 700 }}>Strategic: </span>
                {strategicContextLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="ps-field">
          <label className="ps-label" htmlFor="action-strategic-initiative">
            Related initiative
          </label>
          <select
            id="action-strategic-initiative"
            value={strategicInitiativeId}
            onChange={(e) => setStrategicInitiativeId(e.target.value)}
            className="ps-select"
          >
            <option value="">No related initiative</option>
            {initiativeOptions.map((initiative) => (
              <option key={initiative.id} value={initiative.id}>
                {initiative.title}
              </option>
            ))}
          </select>
          <p className="ps-help" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Use this when the action moves a larger YPP strategic goal forward.
          </p>
        </div>

        {!hasRelatedEntity && !sourceLabel && !strategicContextLabel ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            No meeting or related record is attached yet. That is okay for a manual action.
          </p>
        ) : null}

        <div className="ps-field" style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={communicationNeeded}
              onChange={(e) => setCommunicationNeeded(e.target.checked)}
            />
            This action needs a message to be sent
          </label>
          {communicationNeeded ? (
            <div className="ps-field-grid">
              <div className="ps-field">
                <label className="ps-label" htmlFor="action-comm-audience">
                  Who is it for?
                </label>
                <select
                  id="action-comm-audience"
                  value={communicationAudience}
                  onChange={(e) => setCommunicationAudience(e.target.value)}
                  className="ps-select"
                >
                  {COMMUNICATION_AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>
                      {audience[0].toUpperCase() + audience.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor="action-comm-contact">
                  Person / group to contact
                </label>
                <input
                  id="action-comm-contact"
                  value={communicationContact}
                  onChange={(e) => setCommunicationContact(e.target.value)}
                  className="ps-input"
                  placeholder="e.g. Lily, Beth El, applicant families"
                />
              </div>
            </div>
          ) : null}
          <p className="ps-help" style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Marked communications surface in the Command Center and Weekly Execution under
            “Communications needed”. Nothing is sent automatically.
          </p>
        </div>
      </FormSection>

      <FormSection
        title="5. What context matters?"
        description="Add the background, category, department, and any supporting link someone will need later."
      >
        <div className="ps-field">
          <label className="ps-label" htmlFor="action-description">
            Description / context
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
        <ActionDepartmentPicker
          id="action-department"
          departments={departments}
          value={departmentId}
          onChange={setDepartmentId}
        />
        </div>

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
                placeholder="https://..."
              />
            </div>
          </div>
        </fieldset>
      </FormSection>
        </>
      )}

      {!useSimpleLayout && title.trim() ? (
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            padding: "9px 12px",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          <strong style={{ color: "var(--ypp-ink)" }}>You are capturing: </strong>
          “{title.trim()}”
          {leadId
            ? ` — owned by ${users.find((u) => u.id === leadId)?.name ?? users.find((u) => u.id === leadId)?.email ?? "the lead"}`
            : " — no owner yet"}
          {deadline ? `, due ${deadline}` : ", no due date yet"}
          {strategicContextLabel ? `, moving ${strategicContextLabel}` : ""}
          {sourceLabel ? `, from ${sourceLabel}` : ""}
          {communicationNeeded ? ` — includes a message to ${communicationContact.trim() || `the ${communicationAudience}`}` : ""}.
        </p>
      ) : null}

      {!useSimpleLayout && warnings.length > 0 && (
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
          onClick={() => (onCancel ? onCancel() : router.push("/actions"))}
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
