"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActionAssignmentRole, ActionCommentType, ActionItemStatus } from "@prisma/client";

import {
  addActionAssignment,
  addActionComment,
  addActionFileLink,
  approveActionItem,
  flagActionToLeadership,
  removeActionAssignment,
  updateActionItem,
  updateActionStatus,
} from "@/lib/people-strategy/action-items-actions";
import { isWaitingForActionApproval } from "@/lib/people-strategy/action-approval";
import { ActionDeleteButton } from "@/components/people-strategy/action-delete-button";
import {
  ActionUserPicker,
  type ActionUserOption,
} from "@/components/people-strategy/action-user-picker";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_SELECTABLE,
} from "@/lib/people-strategy/constants";
import { InitialsAvatar } from "@/components/people-strategy/action-presentation";
import { PersonLink } from "@/components/people-strategy/person-link";
import { buttonVariants, Button, cn } from "@/components/ui-v2";

export type RelatedActionLite = {
  id: string;
  title: string;
  status: ActionItemStatus;
  dueISO: string | null;
  leadName: string;
};

type PersonDTO = {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string | null;
  title: string | null;
  avatarUrl: string | null;
};

type CommentDTO = {
  id: string;
  body: string;
  type: ActionCommentType;
  createdAt: string;
  author: PersonDTO;
};

type FileLinkDTO = {
  id: string;
  label: string;
  url: string;
  addedAt: string;
  addedBy: PersonDTO;
};

export type ActionDetailDTO = {
  id: string;
  title: string;
  description: string | null;
  successDefinition: string | null;
  goalCategory: string | null;
  actionType: string | null;
  departmentName: string;
  departmentSlug: string | null;
  status: ActionItemStatus;
  priority: string;
  completedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  deadlineStart: string;
  deadlineEnd: string | null;
  visibility: "OFFICERS_ONLY" | "ALL_LEADERSHIP";
  officerMeetingId: string | null;
  officerMeetingTitle?: string | null;
  officerMeetingDate?: string | null;
  strategicInitiativeId?: string | null;
  strategicProjectId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityLabel?: string | null;
  relatedEntityHref?: string | null;
  relatedArea?: string | null;
  flaggedAt: string | null;
  lead: PersonDTO;
  people: {
    lead: PersonDTO[];
    executing: PersonDTO[];
    input: PersonDTO[];
  };
  comments: CommentDTO[];
  fileLinks: FileLinkDTO[];
};

const BTN_SECONDARY_SM = buttonVariants({ variant: "secondary", size: "sm" });
const BTN_PRIMARY_SM = buttonVariants({ variant: "primary", size: "sm" });

function personName(person: PersonDTO): string {
  return person.name?.trim() || person.email;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function HubSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RolePills({
  label,
  people,
  onRemove,
  pending = false,
}: {
  label: string;
  people: PersonDTO[];
  onRemove?: (userId: string) => void;
  pending?: boolean;
}) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      {people.map((person) => (
        <span
          key={person.id}
          className="inline-flex items-center gap-0.5 rounded-full border border-line-soft bg-surface py-0.5 pl-0.5 pr-1 text-[11.5px] font-semibold text-ink"
        >
          <PersonLink
            id={person.id}
            className="inline-flex items-center gap-1 px-1.5 no-underline hover:text-brand-700"
          >
            <InitialsAvatar name={personName(person)} size={18} />
            {personName(person)}
          </PersonLink>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(person.id)}
              disabled={pending}
              aria-label={`Remove ${personName(person)}`}
              className="flex size-5 items-center justify-center rounded-full text-[14px] leading-none text-ink-muted hover:bg-surface-soft hover:text-ink"
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function RelatedActionGroup({ title, actions }: { title: string; actions: RelatedActionLite[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{title}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {actions.map((action) => (
          <li key={action.id}>
            <Link
              href={`/actions/${action.id}`}
              className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
            >
              {action.title}
            </Link>
            <span className="ml-2 text-[12px] text-ink-muted">
              {action.leadName}
              {action.dueISO ? ` · ${formatDate(action.dueISO)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ActionDetailCard({
  item,
  canEdit,
  canAssign,
  canApprove = false,
  canFlag,
  canDelete,
  closeHref,
  assignableUsers = [],
  sameEntityActions = [],
  sameMeetingActions = [],
  variant = "hub",
}: {
  item: ActionDetailDTO;
  canEdit: boolean;
  canAssign: boolean;
  canApprove?: boolean;
  canFlag: boolean;
  canDelete: boolean;
  closeHref: string;
  assignableUsers?: ActionUserOption[];
  sameEntityActions?: RelatedActionLite[];
  sameMeetingActions?: RelatedActionLite[];
  variant?: "hub" | "full";
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<ActionItemStatus>(item.status);
  const [approvedAt, setApprovedAt] = useState<string | null>(item.approvedAt);
  const [description, setDescription] = useState(item.description ?? "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [addingRole, setAddingRole] = useState<ActionAssignmentRole | null>(null);
  const [comment, setComment] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setDescription(item.description ?? "");
  }, [item.description]);

  useEffect(() => {
    setStatus(item.status);
  }, [item.status]);

  useEffect(() => {
    setApprovedAt(item.approvedAt);
  }, [item.approvedAt]);

  const waitingApproval = isWaitingForActionApproval({
    status,
    approvedAt: approvedAt ? new Date(approvedAt) : null,
  });

  const assignedUserIds = [
    ...item.people.lead,
    ...item.people.executing,
    ...item.people.input,
  ].map((p) => p.id);

  const hasConnected =
    Boolean(item.relatedEntityHref) ||
    sameEntityActions.length > 0 ||
    sameMeetingActions.length > 0;

  function runMutation(work: () => Promise<void>, success: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await work();
        setMessage(success);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleApprove() {
    runMutation(async () => {
      await approveActionItem(item.id);
      setApprovedAt(new Date().toISOString());
    }, "Action approved.");
  }

  function handleStatus(next: ActionItemStatus) {
    setStatus(next);
    if (next !== "COMPLETE") setApprovedAt(null);
    runMutation(async () => updateActionStatus(item.id, next), "Status updated.");
  }

  function handleComment(type: ActionCommentType) {
    const body =
      comment.trim() ||
      (type === "INPUT_REQUESTED"
        ? `Input requested from ${item.people.input.map(personName).join(", ") || "assigned partners"}.`
        : "");
    if (!body.trim()) return;
    runMutation(
      async () => {
        await addActionComment(item.id, body, type);
        setComment("");
      },
      type === "INPUT_REQUESTED" ? "Input request sent." : "Comment posted."
    );
  }

  function handleFlag() {
    runMutation(async () => {
      await flagActionToLeadership(item.id);
    }, "Flagged for leadership.");
  }

  function handleLink() {
    if (!linkLabel.trim() || !linkUrl.trim()) {
      setError("Add both a label and a URL.");
      return;
    }
    runMutation(
      async () => {
        await addActionFileLink(item.id, linkLabel.trim(), linkUrl.trim());
        setLinkLabel("");
        setLinkUrl("");
      },
      "Link added."
    );
  }

  async function uploadFile(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("category", "OTHER");
    form.set("entityId", item.id);
    form.set("entityType", "ACTION_ITEM");

    const response = await fetch("/api/upload", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "Upload failed.");
    }
    await addActionFileLink(item.id, data.originalName ?? file.name, data.url);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    runMutation(async () => uploadFile(file), "File attached.");
  }

  function saveDescription() {
    runMutation(async () => {
      await updateActionItem({
        id: item.id,
        description: description.trim() || null,
      });
      setEditingDescription(false);
    }, "Description saved.");
  }

  function handleAddPerson(role: ActionAssignmentRole, userIds: string[]) {
    const userId = userIds[0];
    if (!userId) return;
    runMutation(async () => {
      await addActionAssignment(item.id, userId, role);
      setAddingRole(null);
    }, "Person added.");
  }

  function handleRemovePerson(role: ActionAssignmentRole, userId: string) {
    runMutation(async () => removeActionAssignment(item.id, userId, role), "Person removed.");
  }

  const roleAdders: Array<{ role: ActionAssignmentRole; label: string }> = [
    { role: "LEAD", label: "Change lead" },
    { role: "EXECUTING", label: "Add executing" },
    { role: "INPUT", label: "Add input" },
  ];

  if (variant !== "hub") {
    return null;
  }

  return (
    <article className="divide-y divide-line-soft overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
      {(error || message) && (
        <div
          className={cn(
            "mx-5 mt-4 rounded-[9px] px-3 py-2 text-[13px] font-medium",
            error ? "bg-red-50 text-red-800" : "bg-complete-50 text-complete-700"
          )}
          role="status"
        >
          {error ?? message}
        </div>
      )}

      <HubSection title="Status">
        {canEdit && status !== "COMPLETE" && status !== "DROPPED" ? (
          <div className="mb-4 flex flex-col gap-3 rounded-[14px] border border-line-card bg-gradient-to-br from-complete-50/40 via-surface to-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-complete-50 text-complete-700">
                <span aria-hidden className="text-[18px] leading-none">
                  ✓
                </span>
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[14px] font-semibold text-ink">Finished with this?</p>
                <p className="m-0 text-[12.5px] text-ink-muted">
                  Mark it complete when the work is done.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={pending}
              onClick={() => handleStatus("COMPLETE")}
              className="w-full shrink-0 sm:w-auto"
            >
              Mark complete
            </Button>
          </div>
        ) : null}

        {status === "COMPLETE" && waitingApproval ? (
          <div className="mb-4 rounded-[14px] border border-amber-200 bg-amber-50/70 px-4 py-3">
            <p className="m-0 text-[14px] font-semibold text-amber-950">Waiting for officer approval</p>
            <p className="m-0 mt-1 text-[12.5px] text-amber-900">
              This action is complete but needs an officer to sign off before it moves to Approved.
            </p>
            {canApprove ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={pending}
                onClick={handleApprove}
                className="mt-3"
              >
                Approve action
              </Button>
            ) : null}
          </div>
        ) : null}

        {status === "COMPLETE" && approvedAt ? (
          <div className="mb-4 flex items-center gap-3 rounded-[14px] border border-line-soft bg-complete-50/50 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-complete-50 text-complete-700">
              <span aria-hidden className="text-[16px] leading-none">
                ✓
              </span>
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-semibold text-complete-700">Approved</p>
              <p className="m-0 text-[12.5px] text-ink-muted">
                {item.approvedByName ? `By ${item.approvedByName}` : "Officer approved"}
                {approvedAt ? ` · ${formatDate(approvedAt)}` : ""}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-semibold text-ink-muted">Other status</span>
          <select
            value={status}
            onChange={(event) => handleStatus(event.target.value as ActionItemStatus)}
            disabled={pending || !canEdit}
            aria-label="Action status"
            className="h-10 min-w-[180px] rounded-[9px] border border-line-soft bg-surface px-3 text-[14px] font-semibold text-ink disabled:opacity-60"
          >
            {ACTION_STATUS_SELECTABLE.map((value) => (
              <option key={value} value={value}>
                {ACTION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          {!canEdit ? (
            <span className="text-[13px] text-ink-muted">You can view but not edit this action.</span>
          ) : null}
        </div>
      </HubSection>

      <HubSection
        title="People"
        action={
          canAssign ? (
            <button
              type="button"
              className={BTN_SECONDARY_SM}
              onClick={() => setAddingRole(addingRole ? null : "EXECUTING")}
              disabled={pending}
            >
              {addingRole ? "Done" : "+ Add people"}
            </button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <RolePills label="Lead" people={item.people.lead} />
          <RolePills
            label="Executing"
            people={item.people.executing}
            pending={pending}
            onRemove={
              canAssign
                ? (userId) => handleRemovePerson("EXECUTING", userId)
                : undefined
            }
          />
          <RolePills
            label="Input"
            people={item.people.input}
            pending={pending}
            onRemove={canAssign ? (userId) => handleRemovePerson("INPUT", userId) : undefined}
          />
        </div>

        {!item.people.lead.length &&
        !item.people.executing.length &&
        !item.people.input.length ? (
          <p className="m-0 text-[13px] text-ink-muted">No one assigned yet.</p>
        ) : null}

        {canAssign && addingRole ? (
          <div className="mt-4 flex flex-col gap-4 rounded-[12px] border border-line-soft bg-[#fafafc] p-4">
            <div className="flex flex-wrap gap-2">
              {roleAdders.map(({ role, label }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setAddingRole(role)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
                    addingRole === role
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-line-soft bg-surface text-ink-muted hover:border-brand-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ActionUserPicker
              key={`${addingRole}-${assignedUserIds.join(",")}`}
              label={
                addingRole === "LEAD"
                  ? "Search for new lead"
                  : addingRole === "EXECUTING"
                    ? "Search to add executing"
                    : "Search to add input"
              }
              single
              users={assignableUsers}
              selected={[]}
              onChange={(ids) => handleAddPerson(addingRole, ids)}
              excludeIds={
                addingRole === "LEAD"
                  ? item.people.lead.map((p) => p.id)
                  : assignedUserIds
              }
              variant="calm"
            />
          </div>
        ) : null}
      </HubSection>

      <HubSection
        title="Description"
        action={
          canEdit && !editingDescription ? (
            <button
              type="button"
              className={BTN_SECONDARY_SM}
              onClick={() => setEditingDescription(true)}
              disabled={pending}
            >
              Edit
            </button>
          ) : null
        }
      >
        {editingDescription ? (
          <div className="flex flex-col gap-3">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder="What needs to happen? Add context, links, or next steps…"
              aria-label="Action description"
              className="w-full resize-y rounded-[9px] border border-line-soft bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink"
              autoFocus
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY_SM}
                onClick={() => {
                  setDescription(item.description ?? "");
                  setEditingDescription(false);
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={BTN_PRIMARY_SM}
                onClick={saveDescription}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save description"}
              </button>
            </div>
          </div>
        ) : (
          <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {description.trim() || "No description yet."}
          </p>
        )}
        {item.successDefinition?.trim() ? (
          <p className="m-0 mt-3 text-[13px] text-ink-muted">
            <span className="font-semibold text-ink">Done when:</span> {item.successDefinition}
          </p>
        ) : null}
      </HubSection>

      {hasConnected ? (
        <HubSection title="Connected work">
          {item.relatedEntityHref && item.relatedEntityLabel ? (
            <p className="m-0 text-[14px]">
              <span className="text-ink-muted">Related to </span>
              <Link
                href={item.relatedEntityHref}
                className="font-semibold text-brand-700 no-underline hover:underline"
              >
                {item.relatedEntityLabel}
              </Link>
            </p>
          ) : null}
          {sameMeetingActions.length > 0 ? (
            <RelatedActionGroup title="From the same meeting" actions={sameMeetingActions} />
          ) : null}
          {sameEntityActions.length > 0 ? (
            <RelatedActionGroup title="Related actions" actions={sameEntityActions} />
          ) : null}
        </HubSection>
      ) : null}

      <HubSection
        title="Comments"
        action={
          canEdit ? (
            <button
              type="button"
              className={BTN_SECONDARY_SM}
              onClick={() => handleComment("INPUT_REQUESTED")}
              disabled={pending}
            >
              Request input
            </button>
          ) : null
        }
      >
        {canEdit ? (
          <div className="mb-4 flex flex-col gap-2">
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="Add a comment or status note…"
              aria-label="Comment"
              className="w-full resize-y rounded-[9px] border border-line-soft bg-surface px-3 py-2.5 text-[14px] text-ink"
            />
            <div className="flex justify-end">
              <button
                type="button"
                className={BTN_PRIMARY_SM}
                onClick={() => handleComment("NOTE")}
                disabled={pending || !comment.trim()}
              >
                {pending ? "Posting…" : "Post comment"}
              </button>
            </div>
          </div>
        ) : null}

        {item.comments.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">No comments yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {item.comments.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "rounded-[10px] border border-line-soft px-3.5 py-3",
                  entry.type === "INPUT_REQUESTED" ? "bg-brand-50/60" : "bg-[#fafafc]"
                )}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <InitialsAvatar name={personName(entry.author)} size={22} />
                    {personName(entry.author)}
                  </span>
                  <span className="text-[11.5px] text-ink-muted">
                    {entry.type === "INPUT_REQUESTED" ? "Input requested" : "Comment"} ·{" "}
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                  {entry.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </HubSection>

      <HubSection title="Files & links">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx"
        />
        {canEdit ? (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={linkLabel}
              onChange={(event) => setLinkLabel(event.target.value)}
              placeholder="Link label"
              aria-label="Link label"
              className="h-10 flex-1 rounded-[9px] border border-line-soft bg-surface px-3 text-[14px]"
              disabled={!canEdit}
            />
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://…"
              type="url"
              aria-label="Link URL"
              className="h-10 flex-1 rounded-[9px] border border-line-soft bg-surface px-3 text-[14px]"
              disabled={!canEdit}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={BTN_SECONDARY_SM}
                onClick={() => fileInputRef.current?.click()}
                disabled={pending}
              >
                Attach file
              </button>
              <button type="button" className={BTN_SECONDARY_SM} onClick={handleLink} disabled={pending}>
                Add link
              </button>
            </div>
          </div>
        ) : null}

        {item.fileLinks.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">No files or links yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {item.fileLinks.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line-soft px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="m-0 text-[14px] font-semibold text-ink">{file.label}</p>
                  <p className="m-0 text-[12px] text-ink-muted">
                    {personName(file.addedBy)} · {formatDate(file.addedAt)}
                  </p>
                </div>
                <a className={BTN_SECONDARY_SM} href={file.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </HubSection>

      {(canFlag || canDelete) && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-[#fafafc] px-5 py-3.5">
          {canFlag ? (
            <button type="button" className={BTN_SECONDARY_SM} onClick={handleFlag} disabled={pending}>
              {item.flaggedAt ? "Flag again" : "Flag for leadership"}
            </button>
          ) : (
            <span />
          )}
          {canDelete && item.status !== "DROPPED" ? (
            <ActionDeleteButton actionId={item.id} redirectTo={closeHref} />
          ) : null}
        </footer>
      )}
    </article>
  );
}
