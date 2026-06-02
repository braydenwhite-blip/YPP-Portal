"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  formatDueDate,
  formatMonthDayYear,
  formatWeekday,
} from "@/lib/leadership-action-center/dates";
import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";
import {
  addMiscUpdate,
  assignActionItemToMeeting,
  createOfficerMeeting,
  deleteMiscUpdate,
  generateOfficerMeetingAgenda,
  generateOfficerMeetingSummaryEmail,
  saveMeetingNote,
  setOfficerMeetingStatus,
  unassignActionItemFromMeeting,
  updateMiscUpdate,
} from "@/lib/people-strategy/officer-meetings-actions";
import { StatusPill } from "@/components/people-strategy/pills";

export type MeetingActionItemDTO = {
  id: string;
  title: string;
  status: keyof typeof ACTION_STATUS_LABELS;
  deadlineStart: string;
  deadlineEnd: string | null;
  goalCategory: string | null;
  departmentName: string | null;
  leadName: string | null;
  assignees: Array<{ role: "LEAD" | "EXECUTING" | "INPUT"; name: string }>;
  discussionNotes: string;
};

export type MeetingMiscDTO = {
  id: string;
  body: string;
  addedByName: string;
  createdAt: string;
};

export type MeetingDTO = {
  id: string;
  date: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  agendaText: string | null;
  summaryEmailText: string | null;
  actionItems: MeetingActionItemDTO[];
  miscUpdates: MeetingMiscDTO[];
};

export type UnassignedItemDTO = {
  id: string;
  title: string;
  status: keyof typeof ACTION_STATUS_LABELS;
  deadlineStart: string;
  departmentName: string | null;
  leadName: string | null;
};

const ACCENT = "var(--ypp-primary-brand)";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const ASSIGNMENT_LABELS: Record<MeetingActionItemDTO["assignees"][number]["role"], string> = {
  LEAD: "Lead",
  EXECUTING: "Executing",
  INPUT: "Input",
};

function GeneratedTextBlock({ label, text }: { label: string; text: string }) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: ACCENT }}>
        {label}
      </summary>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "inherit",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--ypp-ink)",
          background: "var(--ypp-purple-50)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: 12,
          margin: "8px 0 0",
        }}
      >
        {text}
      </pre>
    </details>
  );
}

/**
 * Server-side agenda + summary-email generation (Prompt 06B). The agenda can
 * always be (re)generated; the summary email stays disabled until every linked
 * action item has discussion notes.
 */
function GenerateButtons({ meeting }: { meeting: MeetingDTO }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const missingNotes = meeting.actionItems.filter(
    (item) => item.discussionNotes.trim().length === 0
  );
  const summaryReady = missingNotes.length === 0;
  const summaryTitle = summaryReady
    ? "Compose the post-meeting recap email"
    : `Add discussion notes to all items first (${missingNotes.length} remaining)`;

  function run(action: () => Promise<unknown>) {
    setError(null);
    start(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Generation failed");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="button outline small"
          onClick={() => run(() => generateOfficerMeetingAgenda(meeting.id))}
          disabled={pending}
          title="Compose the meeting agenda from linked action items"
        >
          {meeting.agendaText ? "Regenerate agenda" : "Generate agenda"}
        </button>
        <button
          type="button"
          className="button outline small"
          onClick={() => run(() => generateOfficerMeetingSummaryEmail(meeting.id))}
          disabled={pending || !summaryReady}
          title={summaryTitle}
          style={!summaryReady ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
        >
          {meeting.summaryEmailText ? "Regenerate summary email" : "Generate summary email"}
        </button>
        {!summaryReady && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Summary email unlocks once all {meeting.actionItems.length} item
            {meeting.actionItems.length === 1 ? "" : "s"} have discussion notes.
          </span>
        )}
      </div>
      {error && <span style={{ color: "var(--error-color)", fontSize: 12 }}>{error}</span>}
      {meeting.agendaText && (
        <GeneratedTextBlock label="View generated agenda" text={meeting.agendaText} />
      )}
      {meeting.summaryEmailText && (
        <GeneratedTextBlock label="View generated summary email" text={meeting.summaryEmailText} />
      )}
    </div>
  );
}

function DiscussionNote({
  meetingId,
  item,
  disabled,
}: {
  meetingId: string;
  item: MeetingActionItemDTO;
  disabled: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(item.discussionNotes);
  const [pending, start] = useTransition();
  const dirty = value !== item.discussionNotes;
  const deadline = item.deadlineEnd ?? item.deadlineStart;
  const assigneeText =
    item.assignees.length > 0
      ? item.assignees
          .map((person) => `${ASSIGNMENT_LABELS[person.role]}: ${person.name}`)
          .join(" · ")
      : "No assignees listed";

  function save() {
    start(async () => {
      await saveMeetingNote({ meetingId, actionItemId: item.id, discussionNotes: value });
      router.refresh();
    });
  }

  function unassign() {
    start(async () => {
      await unassignActionItemFromMeeting(item.id);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <Link href={`/actions/${item.id}`} style={{ fontWeight: 600, fontSize: 14, color: "var(--ypp-ink)" }}>
          {item.title}
        </Link>
        <button
          type="button"
          className="button outline small"
          onClick={unassign}
          disabled={disabled || pending}
          title="Return to the unassigned tray"
        >
          Unassign
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 8px", lineHeight: 1.5 }}>
        {item.departmentName ?? "No department"} · {ACTION_STATUS_LABELS[item.status]} · Due{" "}
        {formatDueDate(new Date(deadline))}
        {item.goalCategory ? ` · Goal: ${item.goalCategory}` : " · Goal: Uncategorized"}
        {item.leadName ? ` · Lead: ${item.leadName}` : ""}
      </div>
      <div style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", lineHeight: 1.5 }}>
        {assigneeText}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled || pending}
        aria-label={`Discussion notes for ${item.title}`}
        placeholder="Discussion notes for this item…"
        rows={3}
        style={{
          width: "100%",
          fontSize: 13,
          padding: 8,
          borderRadius: "var(--radius-xs)",
          border: "1px solid var(--border)",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      {!disabled && (
        <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="button small"
            onClick={save}
            disabled={!dirty || pending}
          >
            {pending ? "Saving…" : dirty ? "Save notes" : "Saved"}
          </button>
        </div>
      )}
    </div>
  );
}

function MiscUpdates({
  meetingId,
  updates,
  disabled,
}: {
  meetingId: string;
  updates: MeetingMiscDTO[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!body.trim()) return;
    start(async () => {
      await addMiscUpdate({ meetingId, body });
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteMiscUpdate(id);
      router.refresh();
    });
  }

  function beginEdit(update: MeetingMiscDTO) {
    setEditingId(update.id);
    setEditingBody(update.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingBody("");
  }

  function saveEdit(id: string) {
    if (!editingBody.trim()) return;
    start(async () => {
      await updateMiscUpdate({ id, body: editingBody });
      setEditingId(null);
      setEditingBody("");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="slideout-section-title" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
        Miscellaneous updates
      </div>
      {updates.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13, fontStyle: "italic", margin: "0 0 8px" }}>
          No miscellaneous updates yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
          {updates.map((u) => (
            <li
              key={u.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-xs)",
                marginBottom: 6,
                background: "var(--surface)",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                {editingId === u.id ? (
                  <textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    disabled={pending}
                    aria-label="Edit miscellaneous update"
                    rows={2}
                    style={{
                      width: "100%",
                      fontSize: 13,
                      padding: 8,
                      borderRadius: "var(--radius-xs)",
                      border: "1px solid var(--border)",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: "var(--ypp-ink)", whiteSpace: "pre-wrap" }}>{u.body}</div>
                )}
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{u.addedByName}</div>
              </div>
              {!disabled && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {editingId === u.id ? (
                    <>
                      <button
                        type="button"
                        className="button small"
                        onClick={() => saveEdit(u.id)}
                        disabled={pending || !editingBody.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="button outline small"
                        onClick={cancelEdit}
                        disabled={pending}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button outline small"
                        onClick={() => beginEdit(u)}
                        disabled={pending}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button outline small"
                        onClick={() => remove(u.id)}
                        disabled={pending}
                        aria-label={`Delete update from ${u.addedByName}`}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a miscellaneous update…"
            aria-label="Add miscellaneous update"
            disabled={pending}
            style={{
              flex: "1 1 220px",
              fontSize: 13,
              padding: 8,
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border)",
            }}
          />
          <button type="button" className="button small" onClick={add} disabled={pending || !body.trim()}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function AssignFromTray({
  meetingId,
  unassigned,
  disabled,
}: {
  meetingId: string;
  unassigned: UnassignedItemDTO[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, start] = useTransition();

  function assign() {
    if (!selected) return;
    start(async () => {
      await assignActionItemToMeeting({ meetingId, actionItemId: selected });
      setSelected("");
      router.refresh();
    });
  }

  if (disabled) return null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={pending || unassigned.length === 0}
        aria-label="Link an unassigned action item to this meeting"
        style={{ fontSize: 13, padding: "6px 8px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", maxWidth: 320 }}
      >
        <option value="">
          {unassigned.length === 0 ? "No unassigned items" : "Link an action item…"}
        </option>
        {unassigned.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <button type="button" className="button small" onClick={assign} disabled={pending || !selected}>
        {pending ? "Linking…" : "Link item"}
      </button>
    </div>
  );
}

function MeetingBlock({
  meeting,
  unassigned,
}: {
  meeting: MeetingDTO;
  unassigned: UnassignedItemDTO[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Cancelled meetings are read-only; scheduled (incl. past-but-not-marked) and
  // completed meetings remain editable so notes can be finished after the fact.
  const readOnly = meeting.status === "CANCELLED";

  function setStatus(status: "SCHEDULED" | "COMPLETED" | "CANCELLED") {
    start(async () => {
      await setOfficerMeetingStatus(meeting.id, status);
      router.refresh();
    });
  }

  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderTop: `3px solid ${ACCENT}`,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ypp-ink)" }}>
            {formatWeekday(new Date(meeting.date))}, {formatMonthDayYear(new Date(meeting.date))}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {formatTime(meeting.date)} · {meeting.actionItems.length} item
            {meeting.actionItems.length === 1 ? "" : "s"} · {meeting.miscUpdates.length} update
            {meeting.miscUpdates.length === 1 ? "" : "s"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <StatusPill kind="meeting" status={meeting.status} />
          {meeting.status !== "COMPLETED" && (
            <button
              type="button"
              className="button outline small"
              onClick={() => setStatus("COMPLETED")}
              disabled={pending}
            >
              Mark completed
            </button>
          )}
          {meeting.status !== "CANCELLED" && (
            <button
              type="button"
              className="button outline small"
              onClick={() => setStatus("CANCELLED")}
              disabled={pending}
            >
              Cancel
            </button>
          )}
          {meeting.status !== "SCHEDULED" && (
            <button
              type="button"
              className="button outline small"
              onClick={() => setStatus("SCHEDULED")}
              disabled={pending}
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <GenerateButtons meeting={meeting} />

      {/* Linked action items + editable discussion notes */}
      <div>
        <div className="slideout-section-title" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          Action items for discussion
        </div>
        {meeting.actionItems.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13, fontStyle: "italic", margin: "0 0 8px" }}>
            No action items linked yet. Use the picker below to pull items in from the tray.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            {meeting.actionItems.map((item) => (
              <DiscussionNote key={item.id} meetingId={meeting.id} item={item} disabled={readOnly} />
            ))}
          </div>
        )}
        <AssignFromTray meetingId={meeting.id} unassigned={unassigned} disabled={readOnly} />
      </div>

      <MiscUpdates meetingId={meeting.id} updates={meeting.miscUpdates} disabled={readOnly} />
    </div>
  );
}

function ScheduleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!date) {
      setError("Pick a date and time.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        await createOfficerMeeting({ date });
        setDate("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not schedule meeting");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" className="button small" onClick={() => setOpen(true)}>
        + Schedule new meeting
      </button>
    );
  }

  return (
    <div
      className="card"
      style={{ padding: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-secondary)" }}>
        Meeting date &amp; time
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={pending}
          style={{ fontSize: 13, padding: 8, borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}
        />
      </label>
      <button type="button" className="button small" onClick={submit} disabled={pending}>
        {pending ? "Scheduling…" : "Schedule"}
      </button>
      <button
        type="button"
        className="button outline small"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        disabled={pending}
      >
        Cancel
      </button>
      {error && <span style={{ color: "var(--error-color)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export default function OfficerMeetingsClient({
  upcoming,
  past,
  unassigned,
}: {
  upcoming: MeetingDTO[];
  past: MeetingDTO[];
  unassigned: UnassignedItemDTO[];
}) {
  const [showPast, setShowPast] = useState(false);

  // Group upcoming meetings by calendar day.
  const upcomingGroups = useMemo(() => {
    const groups = new Map<string, MeetingDTO[]>();
    for (const m of upcoming) {
      const key = dayKey(m.date);
      const bucket = groups.get(key);
      if (bucket) bucket.push(m);
      else groups.set(key, [m]);
    }
    return Array.from(groups.values());
  }, [upcoming]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
      <ScheduleForm />

      {/* Upcoming, grouped by date */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>Upcoming meetings</h2>
        {upcomingGroups.length === 0 ? (
          <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>
            No upcoming meetings scheduled. Use “Schedule new meeting” to add one.
          </div>
        ) : (
          upcomingGroups.map((group) => (
            <div key={dayKey(group[0].date)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: ACCENT }}>
                {formatWeekday(new Date(group[0].date))}, {formatMonthDayYear(new Date(group[0].date))}
              </div>
              {group.map((m) => (
                <MeetingBlock key={m.id} meeting={m} unassigned={unassigned} />
              ))}
            </div>
          ))
        )}
      </section>

      {/* Unassigned tray */}
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>
          Unassigned tray
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Action items not yet assigned to a meeting. Link them from a meeting block above.
        </p>
        {unassigned.length === 0 ? (
          <div className="card" style={{ padding: 14, color: "var(--muted)", fontSize: 13 }}>
            All open action items are assigned to a meeting.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unassigned.map((item) => (
              <Link
                key={item.id}
                href={`/actions/${item.id}`}
                className="card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {item.departmentName ?? "—"} · {ACTION_STATUS_LABELS[item.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Past meetings */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          type="button"
          className="button outline small"
          onClick={() => setShowPast((v) => !v)}
          style={{ alignSelf: "flex-start" }}
        >
          {showPast ? "Hide" : "Show"} past meetings ({past.length})
        </button>
        {showPast &&
          (past.length === 0 ? (
            <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>
              No past meetings yet.
            </div>
          ) : (
            past.map((m) => (
              <MeetingBlock key={m.id} meeting={m} unassigned={unassigned} />
            ))
          ))}
      </section>
    </div>
  );
}
