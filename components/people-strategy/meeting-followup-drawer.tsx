"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  MEETING_CATEGORY_VALUES,
  meetingCategoryLabel,
} from "@/lib/people-strategy/meeting-categories";
import { addFollowUp } from "@/lib/people-strategy/meetings-actions";
import { MeetingIcon } from "./meeting-icons";
import { Drawer, Field, Toggle, fieldStyle } from "./meeting-form-kit";
import { Avatar, CategoryBadge, MeetingButton, Pill, TinyLabel, dueText, fmtDate } from "./meeting-ui";
import type { PersonOption } from "./new-meeting-drawer";

/**
 * Add a follow-up to a meeting — optionally creating a linked Action Tracker
 * item in the same step. The toggle + live preview make the meeting→action
 * bridge obvious ("this follow-up will not get lost"). Mirrors the design's
 * ConvertFollowup drawer; submits through `addFollowUp({ …, createAction })`.
 */
export function AddFollowUpDrawer({
  meeting,
  people,
  defaultCreate = false,
  onClose,
}: {
  meeting: { id: string; title: string; startISO: string; category: string | null; facilitatorId?: string | null };
  people: PersonOption[];
  defaultCreate?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState(meeting.facilitatorId ?? people[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [area, setArea] = useState<string>(meeting.category ?? "OTHER");
  const [createAction, setCreateAction] = useState(defaultCreate);

  const ownerObj = people.find((p) => p.id === owner) ?? null;

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await addFollowUp({
          meetingId: meeting.id,
          title,
          description,
          ownerId: owner || undefined,
          dueDate: due || undefined,
          area,
          createAction,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the follow-up.");
      }
    });
  }

  return (
    <Drawer
      title={defaultCreate ? "Create Action Item" : "Add Follow-Up"}
      subtitle={`From ${meeting.title}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <MeetingButton variant="ghost" onClick={onClose}>
            Cancel
          </MeetingButton>
          <MeetingButton icon={createAction ? "bolt" : "check"} disabled={!title.trim() || pending} onClick={submit}>
            {pending ? "Saving…" : createAction ? "Save & Track in Action Tracker" : "Save Follow-Up"}
          </MeetingButton>
        </>
      }
    >
      {error && (
        <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: "var(--danger-fg)", background: "var(--danger-bg)", border: "1px solid #f3cccc", borderRadius: 10, padding: "9px 13px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Title" req>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" style={fieldStyle} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Context for whoever picks this up…" style={{ ...fieldStyle, resize: "vertical" }} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Owner">
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={fieldStyle}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={fieldStyle} />
          </Field>
        </div>
        <Field label="Related area">
          <select value={area} onChange={(e) => setArea(e.target.value)} style={fieldStyle}>
            {MEETING_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {meetingCategoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* the link toggle — the heart of the flow */}
      <button
        type="button"
        onClick={() => setCreateAction((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 15px",
          borderRadius: 13,
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
          border: `1.5px solid ${createAction ? "var(--ypp-purple-400)" : "var(--border)"}`,
          background: createAction ? "var(--ypp-purple-50)" : "var(--surface)",
        }}
      >
        <Toggle on={createAction} />
        <span style={{ flex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 800, color: "var(--ypp-ink)" }}>
            <MeetingIcon name="bolt" size={15} style={{ color: "var(--ypp-purple-600)" }} />
            Create linked Action Tracker item
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>
            Pushes this into the Action Tracker so it shows up in dashboards, deadlines, and the owner&rsquo;s queue &mdash; it won&rsquo;t get lost.
          </span>
        </span>
        <MeetingIcon name={createAction ? "checkCircle" : "plus"} size={20} style={{ color: createAction ? "var(--ypp-purple-600)" : "var(--muted)" }} />
      </button>

      {/* preview of the linked action */}
      {createAction && (
        <div style={{ border: "1px solid var(--ypp-purple-200)", borderRadius: 13, overflow: "hidden" }}>
          <div style={{ padding: "9px 14px", background: "var(--ypp-purple-50)", borderBottom: "1px solid var(--ypp-purple-200)", display: "flex", alignItems: "center", gap: 8 }}>
            <MeetingIcon name="bolt" size={14} style={{ color: "var(--ypp-purple-600)" }} />
            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--ypp-purple-700)" }}>Action Tracker preview</span>
          </div>
          <div style={{ padding: "14px 15px", display: "flex", flexDirection: "column", gap: 11, background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <Pill tone="purple" style={{ fontWeight: 700 }}>
                <MeetingIcon name="calendar" size={11} />
                Source: Meeting
              </Pill>
              <CategoryBadge category={area} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ypp-ink)" }}>{title || "Untitled action"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 4 }}>
              <Mini label="Source meeting" value={meeting.title} />
              <Mini label="Meeting date" value={fmtDate(meeting.startISO)} />
              <Mini
                label="Lead"
                value={
                  ownerObj ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Avatar name={ownerObj.name} size={18} />
                      {ownerObj.name}
                    </span>
                  ) : (
                    "Unassigned"
                  )
                }
              />
              <Mini label="Due" value={due ? dueText(due).label : "No due date"} />
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <TinyLabel>{label}</TinyLabel>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ypp-ink)" }}>{value}</span>
    </div>
  );
}
