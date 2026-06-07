"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActionCommentType, ActionItemStatus, ActionPriority } from "@prisma/client";

import {
  addActionComment,
  addActionFileLink,
  flagActionToLeadership,
  updateActionStatus,
} from "@/lib/people-strategy/action-items-actions";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_SELECTABLE,
} from "@/lib/people-strategy/constants";
import { cardRevealVariants } from "@/lib/people-strategy/motion";
import { Pill, PriorityPill } from "@/components/people-strategy/pills";
import { MotionArea, m, FeedbackBanner } from "@/components/people-strategy/motion";
import { getUserTitle } from "@/lib/user-title";
import { PersonLink } from "@/components/people-strategy/person-link";

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
  goalCategory: string | null;
  departmentName: string;
  departmentSlug: string | null;
  status: ActionItemStatus;
  priority: ActionPriority;
  completedAt: string | null;
  deadlineStart: string;
  deadlineEnd: string | null;
  visibility: "OFFICERS_ONLY" | "ALL_LEADERSHIP";
  officerMeetingId: string | null;
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

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--ypp-ink)",
  font: "inherit",
  fontSize: 14,
  padding: "9px 10px",
};

const TINY_LABEL: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

function initials(person: PersonDTO): string {
  const label = person.name?.trim() || person.email;
  const parts = label.split(/[\s@.]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function personName(person: PersonDTO): string {
  return person.name?.trim() || person.email;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
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

function daysUntil(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(value);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function deadlineText(item: ActionDetailDTO): { label: string; overdue: boolean } {
  // One clear deadline (comment #12): the effective due date is the end date
  // when an older item still carries a range, otherwise the single deadline.
  const due = item.deadlineEnd ?? item.deadlineStart;
  const days = daysUntil(due);
  const date = formatDate(due);

  if (item.status !== "COMPLETE" && days < 0) {
    return { label: `${date} (${Math.abs(days)}d overdue)`, overdue: true };
  }
  if (days === 0) return { label: `${date} (today)`, overdue: false };
  if (days === 1) return { label: `${date} (tomorrow)`, overdue: false };
  return { label: date, overdue: false };
}

// Brand-tinted header for every department. The previous version applied an
// off-brand rainbow (orange/cyan/green/indigo) keyed on the department name;
// this keeps a single accessible brand tint so the detail card reads as part of
// the portal's purple system rather than a separate dialect.
function departmentTheme() {
  // Professional, neutral header (#-3): a quiet accent tint on the neutral
  // canvas rather than a washed-purple band.
  return {
    bg: "var(--ps-surface)",
    border: "var(--border)",
    fg: "var(--ps-ink)",
  };
}

function PersonAvatar({ person }: { person: PersonDTO }) {
  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "var(--ps-accent-soft)",
        color: "var(--ps-accent)",
        border: "1px solid var(--border)",
        fontSize: 12,
        fontWeight: 800,
        flex: "0 0 auto",
      }}
      aria-hidden
    >
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny existing-avatar pattern.
        <img
          src={person.avatarUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials(person)
      )}
    </span>
  );
}

function PersonChip({ person }: { person: PersonDTO }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <PersonAvatar person={person} />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <PersonLink
          id={person.id}
          style={{ fontSize: 13, fontWeight: 700, color: "var(--ypp-ink)", overflowWrap: "anywhere" }}
        >
          {personName(person)}
        </PersonLink>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{getUserTitle(person)}</span>
      </span>
    </div>
  );
}

function PeopleColumn({ title, people }: { title: string; people: PersonDTO[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <span style={TINY_LABEL}>{title}</span>
      {people.length > 0 ? (
        people.map((person) => <PersonChip key={`${title}-${person.id}`} person={person} />)
      ) : (
        <span style={{ color: "#64748b", fontSize: 13 }}>None assigned</span>
      )}
    </div>
  );
}

// Collapsible section built on native <details> so every block can be
// expanded/collapsed (comment #18). `defaultOpen` controls the initial state —
// the Officer Meeting block passes `false` so it is collapsed by default.
function Section({
  title,
  children,
  actions,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        borderTop: "1px solid var(--border)",
        padding: "18px 20px",
      }}
    >
      <summary
        className="action-detail-section-summary"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span className="ad-chevron" aria-hidden style={{ color: "var(--muted)", fontSize: 12 }}>
            ▸
          </span>
          <h2 className="section-title" style={{ margin: 0 }}>{title}</h2>
        </span>
        {actions ? <span onClick={(e) => e.preventDefault()}>{actions}</span> : null}
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {children}
      </div>
    </details>
  );
}

export default function ActionDetailCard({
  item,
  canEdit,
  canFlag,
  closeHref,
}: {
  item: ActionDetailDTO;
  canEdit: boolean;
  canFlag: boolean;
  closeHref: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<ActionItemStatus>(item.status);
  const [comment, setComment] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const theme = departmentTheme();
  const due = deadlineText(item);

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

  function handleStatus(next: ActionItemStatus) {
    setStatus(next);
    runMutation(async () => updateActionStatus(item.id, next), "Status saved.");
  }

  function handleComment(type: ActionCommentType) {
    const body =
      comment.trim() ||
      (type === "INPUT_REQUESTED"
        ? `Input requested from ${item.people.input.map(personName).join(", ") || "assigned input partners"}.`
        : "");
    if (!body.trim()) return;
    runMutation(
      async () => {
        await addActionComment(item.id, body, type);
        setComment("");
      },
      type === "INPUT_REQUESTED" ? "Input request posted." : "Comment posted."
    );
  }

  function handleFlag() {
    runMutation(async () => {
      await flagActionToLeadership(item.id);
    }, "Flag sent to Leadership.");
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

  return (
    <MotionArea>
      <m.article
        className="card"
        style={{ padding: 0, overflow: "hidden", borderColor: "var(--border)" }}
        variants={cardRevealVariants}
        initial="initial"
        animate="animate"
      >
      <div
        style={{
          background: theme.bg,
          borderBottom: `1px solid ${theme.border}`,
          padding: "18px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p className="badge" style={{ margin: 0, color: theme.fg, background: "var(--surface)" }}>
            {item.departmentName} · {item.visibility === "OFFICERS_ONLY" ? "OFFICERS ONLY" : "LEADERSHIP"}
          </p>
          <h1 className="page-title" style={{ marginTop: 8, overflowWrap: "anywhere" }}>
            {item.title}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 1 auto", flexWrap: "wrap" }}>
          {canEdit && (
            <Link href={`/actions/${item.id}/edit`} className="button outline small">
              Edit
            </Link>
          )}
          <Link href={closeHref} className="button outline small" aria-label="Close action detail">
            ×
          </Link>
        </div>
      </div>

      <FeedbackBanner
        message={error ?? message}
        tone={error ? "error" : "success"}
        style={{ margin: "14px 20px 0" }}
      />

      <section
        style={{
          padding: "18px 20px",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={TINY_LABEL}>Status</span>
          <select
            value={status}
            onChange={(event) => handleStatus(event.target.value as ActionItemStatus)}
            disabled={pending || !canEdit}
            style={{ ...FIELD_STYLE, fontWeight: 700, color: "var(--ypp-ink)" }}
          >
            {ACTION_STATUS_SELECTABLE.map((value) => (
              <option key={value} value={value}>
                {ACTION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <PriorityPill priority={item.priority} />
          <Pill tone={due.overdue ? "overdue" : "neutral"}>{due.label}</Pill>
          {item.officerMeetingId && <Pill tone="purple">Officer meeting linked</Pill>}
        </div>
      </section>

      <Section title="Action Metadata">
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <Meta label="Goal Category" value={item.goalCategory ?? "Uncategorized"} />
          <Meta label="Department" value={item.departmentName} />
          <Meta label="Deadline" value={due.label} />
        </div>
      </Section>

      <Section title="People">
        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <PeopleColumn title="Lead" people={item.people.lead} />
          <PeopleColumn title="Executing" people={item.people.executing} />
          <PeopleColumn title="Input" people={item.people.input} />
        </div>
      </Section>

      {item.officerMeetingId && (
        <Section title="Officer Meeting" defaultOpen={false}>
          <div
            style={{
              border: "1px solid var(--warning-border)",
              background: "var(--warning-bg)",
              color: "var(--warning-text)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 14px",
              fontSize: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              This action is on an officer meeting agenda for discussion.
            </span>
            <Link href="/actions/meetings" className="button outline small">
              View officer meetings
            </Link>
          </div>
        </Section>
      )}

      <Section title="Description">
        <p style={{ margin: 0, color: item.description ? "#334155" : "#64748b", lineHeight: 1.6 }}>
          {item.description ?? "No description has been added yet."}
        </p>
      </Section>

      <Section
        title="Files & Links"
        defaultOpen={false}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button outline small"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending || !canEdit}
            >
              Attach
            </button>
            <button type="button" className="button outline small" onClick={handleLink} disabled={pending || !canEdit}>
              Link
            </button>
          </div>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: "none" }}
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx"
        />
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <input
            value={linkLabel}
            onChange={(event) => setLinkLabel(event.target.value)}
            placeholder="Link label"
            aria-label="File or link label"
            style={FIELD_STYLE}
            disabled={!canEdit}
          />
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://..."
            type="url"
            aria-label="File or link URL"
            style={FIELD_STYLE}
            disabled={!canEdit}
          />
        </div>
        {item.fileLinks.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>No files or links yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {item.fileLinks.map((file) => (
              <div
                key={file.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14, overflowWrap: "anywhere" }}>
                    {file.label}
                  </strong>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    Added by {personName(file.addedBy)} · {formatDate(file.addedAt)}
                  </span>
                </div>
                <a className="button outline small" href={file.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Escalate to Leadership" defaultOpen={false}>
        <div
          style={{
            border: `1px solid ${item.flaggedAt ? "var(--warning-border)" : "var(--border)"}`,
            background: item.flaggedAt ? "var(--warning-bg)" : "var(--ps-accent-soft)",
            color: item.flaggedAt ? "var(--warning-text)" : "var(--text-secondary)",
            borderRadius: "var(--radius-sm)",
            padding: "13px 14px",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            {item.flaggedAt
              ? `Flagged to Leadership on ${formatDate(item.flaggedAt)}. Re-flag if the situation has changed.`
              : "Flag this action when progress is blocked, accountability is unclear, or a Leadership decision is needed."}
          </span>
          <button type="button" className="button small" onClick={handleFlag} disabled={pending || !canFlag}>
            {item.flaggedAt ? "Flag again" : "Flag to Leadership"}
          </button>
        </div>
      </Section>

      <Section
        title="Activity & Comments"
        defaultOpen={false}
        actions={
          <button
            type="button"
            className="button outline small"
            onClick={() => handleComment("INPUT_REQUESTED")}
            disabled={pending}
          >
            Send for Input
          </button>
        }
      >
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          placeholder="Write a comment, status note, or input request."
          aria-label="Action comment"
          style={{ ...FIELD_STYLE, resize: "vertical", minHeight: 96 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button outline small"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending || !canEdit}
            >
              Attach
            </button>
            <button type="button" className="button outline small" onClick={handleLink} disabled={pending || !canEdit}>
              Link
            </button>
          </div>
          <button
            type="button"
            className="button small"
            onClick={() => handleComment("NOTE")}
            disabled={pending || !comment.trim()}
          >
            {pending ? "Working..." : "Post"}
          </button>
        </div>
        {item.comments.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>No comments yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {item.comments.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "11px 12px",
                  background: entry.type === "INPUT_REQUESTED" ? "var(--info-bg)" : "var(--surface)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <PersonChip person={entry.author} />
                  <span style={{ color: "var(--muted)", fontSize: 12, flex: "0 0 auto" }}>
                    {entry.type === "INPUT_REQUESTED" ? "Input requested" : "Comment"} ·{" "}
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {entry.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
      </m.article>
    </MotionArea>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={TINY_LABEL}>{label}</span>
      <strong style={{ color: "var(--ypp-ink)", fontSize: 14, overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}
