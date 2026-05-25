"use client";

import { useMemo, useState } from "react";

import { CATEGORY_STYLES } from "@/lib/leadership-action-center/constants";
import {
  formatMonthDayYear,
  formatWeekday,
} from "@/lib/leadership-action-center/dates";
import type { BuiltDigest } from "@/lib/leadership-action-center/digest";

interface DigestActionItem {
  id: string;
  title: string;
  category: keyof typeof CATEGORY_STYLES;
  status: string;
  dueDate: string | null;
  needsOfficerDiscussion: boolean;
  officerDiscussionDate: string | null;
  primaryOwnerName: string | null;
  ownerNames: string[];
  inputNeededNames: string[];
  notes: string | null;
}

interface DigestSectionDTO {
  heading: string;
  items: DigestActionItem[];
}

interface MeetingDTO {
  id: string;
  title: string;
  kind: string;
  scheduledAt: string | null;
  kindLabel: string;
}

interface DigestPayload {
  weekStart: string;
  weekEnd: string;
  range: string;
  sections: DigestSectionDTO[];
  offTrack: DigestActionItem[];
  officerDiscussion: DigestActionItem[];
  meetings: MeetingDTO[];
  text: string;
  html: string;
}

export default function WeeklyDigestClient({ digest }: { digest: DigestPayload }) {
  const [viewMode, setViewMode] = useState<"preview" | "html" | "text">("preview");
  const [editedText, setEditedText] = useState(digest.text);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState<"text" | "html" | null>(null);

  const totalItems = useMemo(
    () => digest.sections.reduce((acc, s) => acc + s.items.length, 0),
    [digest.sections]
  );

  async function copy(value: string, kind: "text" | "html") {
    try {
      if (kind === "html" && typeof navigator !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([value], { type: "text/html" }),
            "text/plain": new Blob([digest.text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(value);
      }
      setCopied(kind);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt("Copy failed — copy the text manually:", value);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Toolbar */}
      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>
            Week of {formatWeekday(new Date(digest.weekStart))},{" "}
            {formatMonthDayYear(new Date(digest.weekStart))} →{" "}
            {formatMonthDayYear(new Date(digest.weekEnd))}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            {totalItems} task{totalItems === 1 ? "" : "s"} · {digest.meetings.length} meeting
            {digest.meetings.length === 1 ? "" : "s"} · {digest.offTrack.length} off-track ·{" "}
            {digest.officerDiscussion.length} need officer discussion
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div
            role="tablist"
            aria-label="Digest view mode"
            style={{
              display: "inline-flex",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              overflow: "hidden",
            }}
          >
            {(
              [
                { key: "preview", label: "Preview" },
                { key: "html", label: "HTML" },
                { key: "text", label: "Plain text" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={viewMode === tab.key}
                onClick={() => setViewMode(tab.key)}
                style={{
                  padding: "6px 12px",
                  background: viewMode === tab.key ? "#ede9fe" : "#fff",
                  color: viewMode === tab.key ? "#3b0f6e" : "#475569",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button outline small"
            onClick={() => copy(editedText, "text")}
          >
            {copied === "text" ? "✓ Copied" : "Copy plain text"}
          </button>
          <button
            type="button"
            className="button small"
            onClick={() => copy(digest.html, "html")}
          >
            {copied === "html" ? "✓ Copied" : "Copy rich text"}
          </button>
        </div>
      </div>

      {/* Off-track / officer call-outs */}
      {(digest.offTrack.length > 0 || digest.officerDiscussion.length > 0) && (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {digest.offTrack.length > 0 && (
            <div
              className="card"
              style={{ padding: 16, borderTop: "3px solid #dc2626" }}
            >
              <h3 style={{ margin: "0 0 8px", color: "#991b1b", fontSize: 15 }}>
                Off track this week
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#0f172a", fontSize: 13 }}>
                {digest.offTrack.map((item) => (
                  <li key={item.id} style={{ marginBottom: 4 }}>
                    <b>{item.title}</b>
                    <span style={{ color: "#64748b" }}>
                      {item.primaryOwnerName ? ` — ${item.primaryOwnerName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {digest.officerDiscussion.length > 0 && (
            <div
              className="card"
              style={{ padding: 16, borderTop: "3px solid #d97706" }}
            >
              <h3 style={{ margin: "0 0 8px", color: "#92400e", fontSize: 15 }}>
                Bring to officers
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#0f172a", fontSize: 13 }}>
                {digest.officerDiscussion.map((item) => (
                  <li key={item.id} style={{ marginBottom: 4 }}>
                    <b>{item.title}</b>
                    <span style={{ color: "#64748b" }}>
                      {item.officerDiscussionDate
                        ? ` · discuss ${formatMonthDayYear(new Date(item.officerDiscussionDate))}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main view area */}
      {viewMode === "preview" && (
        <div className="card" style={{ padding: 24 }}>
          <ColorKey />
          {digest.sections.length === 0 && (
            <p style={{ color: "#94a3b8", fontStyle: "italic" }}>
              No tasks for this week yet. Add some on the Tasks tab or run an import.
            </p>
          )}
          {digest.sections.map((section) => (
            <div key={section.heading} style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontFamily: "Georgia, serif",
                  color: "#3b0f6e",
                  margin: "0 0 12px",
                  fontSize: 18,
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: 6,
                }}
              >
                {section.heading}
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {section.items.map((item) => (
                  <DigestItem key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ))}

          {digest.meetings.length > 0 && (
            <div>
              <h3
                style={{
                  fontFamily: "Georgia, serif",
                  color: "#3b0f6e",
                  margin: "0 0 12px",
                  fontSize: 18,
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: 6,
                }}
              >
                Key meetings this week
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {digest.meetings.map((m) => (
                  <li
                    key={m.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: 14,
                    }}
                  >
                    <b style={{ color: "#0f172a" }}>{m.title}</b>{" "}
                    <span style={{ color: "#64748b" }}>({m.kindLabel})</span>{" "}
                    {m.scheduledAt && (
                      <span style={{ color: "#475569" }}>
                        — {formatWeekday(new Date(m.scheduledAt))},{" "}
                        {formatMonthDayYear(new Date(m.scheduledAt))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {viewMode === "html" && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
            Email-ready preview. Use “Copy rich text” above to paste into Gmail or Outlook with
            formatting preserved.
          </p>
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #e2e8f0",
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: digest.html }}
          />
        </div>
      )}

      {viewMode === "text" && (
        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Plain-text version — edit before copying. Doesn’t persist; reload to reset.
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {!editing && (
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
              )}
              {editing && (
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => {
                    setEditedText(digest.text);
                    setEditing(false);
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            readOnly={!editing}
            rows={Math.max(20, editedText.split("\n").length + 2)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 13,
              background: editing ? "#fff" : "#f8fafc",
            }}
          />
        </div>
      )}
    </div>
  );
}

function DigestItem({ item }: { item: DigestActionItem }) {
  const style = CATEGORY_STYLES[item.category];
  const detailParts: string[] = [];
  const owners = [item.primaryOwnerName, ...item.ownerNames]
    .filter((s): s is string => Boolean(s))
    .join(", ");
  if (owners) detailParts.push(`Owners: ${owners}`);
  if (item.inputNeededNames.length > 0) {
    detailParts.push(`Input from: ${item.inputNeededNames.join(", ")}`);
  }
  if (item.notes) detailParts.push(`Notes: ${item.notes}`);
  return (
    <li style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: style.accent,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, color: "#0f172a" }}>{item.title}</span>
        {item.status === "BLOCKED" && (
          <span
            style={{
              fontSize: 11,
              color: "#991b1b",
              background: "#fee2e2",
              padding: "1px 8px",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            ⚠ Blocked
          </span>
        )}
        {item.needsOfficerDiscussion && (
          <span
            style={{
              fontSize: 11,
              color: "#a16207",
              background: "#fef3c7",
              padding: "1px 8px",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            ★ Officers
          </span>
        )}
      </div>
      {detailParts.length > 0 && (
        <div
          style={{
            marginLeft: 18,
            color: "#64748b",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          {detailParts.join(" · ")}
        </div>
      )}
    </li>
  );
}

function ColorKey() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 18,
        fontSize: 12,
        color: "#475569",
      }}
    >
      <b>Color key:</b>
      {(Object.keys(CATEGORY_STYLES) as Array<keyof typeof CATEGORY_STYLES>).map((cat) => {
        const s = CATEGORY_STYLES[cat];
        return (
          <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: s.accent,
              }}
            />
            {s.colorName} · {s.label}
          </span>
        );
      })}
    </div>
  );
}

export type { DigestPayload, DigestActionItem, DigestSectionDTO, MeetingDTO };

// Convenience: convert the BuiltDigest server output into the client DTO.
export function toClientPayload(
  digest: BuiltDigest,
  weekStart: Date,
  weekEnd: Date,
  meetingKindLabels: Record<string, string>
): DigestPayload {
  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    range: digest.range,
    sections: digest.sections.map((s) => ({
      heading: s.heading,
      items: s.items.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category as keyof typeof CATEGORY_STYLES,
        status: item.status,
        dueDate: item.dueDate ? item.dueDate.toISOString() : null,
        needsOfficerDiscussion: item.needsOfficerDiscussion,
        officerDiscussionDate: item.officerDiscussionDate
          ? item.officerDiscussionDate.toISOString()
          : null,
        primaryOwnerName: item.primaryOwner?.name ?? null,
        ownerNames: item.ownerNames,
        inputNeededNames: [
          ...item.inputNeededFrom.map((link) => link.user.name ?? link.user.email),
          ...item.inputNeededNames,
        ],
        notes: item.notes ?? null,
      })),
    })),
    offTrack: digest.offTrack.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category as keyof typeof CATEGORY_STYLES,
      status: item.status,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      needsOfficerDiscussion: item.needsOfficerDiscussion,
      officerDiscussionDate: item.officerDiscussionDate
        ? item.officerDiscussionDate.toISOString()
        : null,
      primaryOwnerName: item.primaryOwner?.name ?? null,
      ownerNames: item.ownerNames,
      inputNeededNames: [
        ...item.inputNeededFrom.map((link) => link.user.name ?? link.user.email),
        ...item.inputNeededNames,
      ],
      notes: item.notes ?? null,
    })),
    officerDiscussion: digest.officerDiscussion.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category as keyof typeof CATEGORY_STYLES,
      status: item.status,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      needsOfficerDiscussion: item.needsOfficerDiscussion,
      officerDiscussionDate: item.officerDiscussionDate
        ? item.officerDiscussionDate.toISOString()
        : null,
      primaryOwnerName: item.primaryOwner?.name ?? null,
      ownerNames: item.ownerNames,
      inputNeededNames: [
        ...item.inputNeededFrom.map((link) => link.user.name ?? link.user.email),
        ...item.inputNeededNames,
      ],
      notes: item.notes ?? null,
    })),
    meetings: digest.meetings.map((m) => ({
      id: m.id,
      title: m.title,
      kind: m.kind,
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
      kindLabel: meetingKindLabels[m.kind] ?? m.kind,
    })),
    text: digest.text,
    html: digest.html,
  };
}
