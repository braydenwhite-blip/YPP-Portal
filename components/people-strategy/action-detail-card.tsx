"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActionCommentType, ActionItemStatus } from "@prisma/client";

import {
  addActionComment,
  addActionFileLink,
  flagActionToCPO,
  updateActionStatus,
} from "@/lib/people-strategy/action-items-actions";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_VALUES,
} from "@/lib/people-strategy/constants";

type PersonDTO = {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string | null;
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
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  font: "inherit",
  fontSize: 14,
  padding: "9px 10px",
};

const TINY_LABEL: React.CSSProperties = {
  color: "#64748b",
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

function roleTitle(role: string | null): string {
  if (!role) return "Portal user";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const days = daysUntil(item.deadlineStart);
  const range = item.deadlineEnd
    ? `${formatDate(item.deadlineStart)} - ${formatDate(item.deadlineEnd)}`
    : formatDate(item.deadlineStart);

  if (item.status !== "COMPLETE" && days < 0) {
    return { label: `${range} (${Math.abs(days)}d overdue)`, overdue: true };
  }
  if (days === 0) return { label: `${range} (today)`, overdue: false };
  if (days === 1) return { label: `${range} (tomorrow)`, overdue: false };
  return { label: range, overdue: false };
}

function departmentTheme(name: string, slug: string | null) {
  const key = `${slug ?? ""} ${name}`.toLowerCase();
  if (key.includes("marketing") || key.includes("communication")) {
    return { bg: "#fff7ed", border: "#fdba74", accent: "#ea580c", fg: "#7c2d12" };
  }
  if (key.includes("tech")) {
    return { bg: "#ecfeff", border: "#67e8f9", accent: "#0891b2", fg: "#164e63" };
  }
  if (key.includes("people") || key.includes("staff")) {
    return { bg: "#f0fdf4", border: "#86efac", accent: "#16a34a", fg: "#14532d" };
  }
  return { bg: "#eef2ff", border: "#a5b4fc", accent: "#4f46e5", fg: "#312e81" };
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
        background: "#e0e7ff",
        color: "#3730a3",
        border: "1px solid #c7d2fe",
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
        <strong style={{ fontSize: 13, color: "#0f172a", overflowWrap: "anywhere" }}>
          {personName(person)}
        </strong>
        <span style={{ color: "#64748b", fontSize: 12 }}>{roleTitle(person.primaryRole)}</span>
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
        <span style={{ color: "#94a3b8", fontSize: 13 }}>None assigned</span>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderTop: "1px solid #e2e8f0",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, color: "#0f172a" }}>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
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
  const theme = departmentTheme(item.departmentName, item.departmentSlug);
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
      await flagActionToCPO(item.id);
    }, "Flag sent to CPO.");
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
    <article className="card" style={{ padding: 0, overflow: "hidden", borderColor: "#dbe3ef" }}>
      <div
        style={{
          background: theme.bg,
          borderBottom: `1px solid ${theme.border}`,
          padding: "18px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p className="badge" style={{ margin: 0, color: theme.fg, background: "#fff" }}>
            {item.departmentName} · {item.visibility === "OFFICERS_ONLY" ? "OFFICERS ONLY" : "LEADERSHIP"}
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              color: "#0f172a",
              fontSize: 28,
              lineHeight: 1.15,
              overflowWrap: "anywhere",
            }}
          >
            {item.title}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          <button
            type="button"
            className="button outline small"
            onClick={handleFlag}
            disabled={pending || !canFlag}
          >
            Flag to CPO
          </button>
          <Link href={closeHref} className="button outline small" aria-label="Close action detail">
            X
          </Link>
        </div>
      </div>

      {(error || message) && (
        <div
          role={error ? "alert" : "status"}
          style={{
            margin: "14px 20px 0",
            borderRadius: 8,
            padding: "9px 11px",
            background: error ? "#fee2e2" : "#dcfce7",
            color: error ? "#991b1b" : "#166534",
            fontSize: 13,
          }}
        >
          {error ?? message}
        </div>
      )}

      <section
        style={{
          padding: "18px 20px",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(180px, 260px) 1fr",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={TINY_LABEL}>Status</span>
          <select
            value={status}
            onChange={(event) => handleStatus(event.target.value as ActionItemStatus)}
            disabled={pending || !canEdit}
            style={{ ...FIELD_STYLE, fontWeight: 700, color: "#1e293b" }}
          >
            {ACTION_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {ACTION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              padding: "6px 11px",
              background: due.overdue ? "#fee2e2" : "#f1f5f9",
              color: due.overdue ? "#991b1b" : "#334155",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {due.label}
          </span>
          {item.officerMeetingId && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "6px 11px",
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Officer meeting linked
            </span>
          )}
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
        <Section title="Officer Meeting">
          <div
            style={{
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#92400e",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Linked meeting id: {item.officerMeetingId}
          </div>
        </Section>
      )}

      <Section title="Description">
        <p style={{ margin: 0, color: item.description ? "#334155" : "#94a3b8", lineHeight: 1.6 }}>
          {item.description ?? "No description has been added yet."}
        </p>
      </Section>

      <Section
        title="Files & Links"
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
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>No files or links yet.</p>
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
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14, overflowWrap: "anywhere" }}>
                    {file.label}
                  </strong>
                  <span style={{ color: "#64748b", fontSize: 12 }}>
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

      <Section title="Escalation Policy">
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#7f1d1d",
            borderRadius: 8,
            padding: "13px 14px",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            Flag this action when progress is blocked, accountability is unclear, or a CPO decision is needed.
            {item.flaggedAt ? ` Last flagged ${formatDate(item.flaggedAt)}.` : ""}
          </span>
          <button type="button" className="button small" onClick={handleFlag} disabled={pending || !canFlag}>
            Flag to CPO
          </button>
        </div>
      </Section>

      <Section
        title="Activity & Comments"
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
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>No comments yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {item.comments.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "11px 12px",
                  background: entry.type === "INPUT_REQUESTED" ? "#eff6ff" : "#fff",
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
                  <span style={{ color: "#64748b", fontSize: 12, flex: "0 0 auto" }}>
                    {entry.type === "INPUT_REQUESTED" ? "Input requested" : "Comment"} ·{" "}
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p style={{ margin: 0, color: "#334155", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {entry.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={TINY_LABEL}>{label}</span>
      <strong style={{ color: "#0f172a", fontSize: 14, overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}
