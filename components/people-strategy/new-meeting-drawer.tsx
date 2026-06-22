"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  MEETING_CATEGORY_VALUES,
  meetingCategoryIdentity,
  meetingCategoryLabel,
  meetingCategoryTone,
} from "@/lib/people-strategy/meeting-categories";
import {
  MEETING_OPERATING_MODELS,
  MEETING_TYPE_VALUES,
  meetingTypeLabel,
} from "@/lib/people-strategy/meeting-operating-model";
import { MEETING_TEMPLATES, findMeetingTemplate } from "@/lib/people-strategy/meeting-templates";
import { createMeeting } from "@/lib/people-strategy/meetings-actions";
import { MeetingIcon, type MeetingIconName } from "./meeting-icons";
import { Drawer, Field, Label, Toggle, fieldStyle } from "./meeting-form-kit";
import { MeetingButton } from "./meeting-ui";

export interface PersonOption {
  id: string;
  name: string;
}

/**
 * Create-from-context prefill: when "Schedule meeting" is clicked on a class /
 * mentorship / partner page, that surface passes the area + entity link so the
 * new meeting is born already connected to the right part of the portal.
 */
export interface MeetingPrefill {
  meetingType?: string | null;
  category?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityLabel?: string | null;
  /** Suggested title / purpose when scheduled from a digest issue or entity. */
  title?: string | null;
  purpose?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  facilitatorId?: string | null;
  recurrence?: "WEEKLY" | "NONE" | null;
  attendeeIds?: string[];
  agendaTitles?: string[];
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewMeetingDrawer({
  people,
  onClose,
  prefill,
}: {
  people: PersonOption[];
  onClose: () => void;
  prefill?: MeetingPrefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tpl, setTpl] = useState<string | null>(null);
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [purpose, setPurpose] = useState(prefill?.purpose ?? "");
  const [meetingType, setMeetingType] = useState<string>(prefill?.meetingType ?? "OFFICER_MEETING");
  const prefillModel = MEETING_OPERATING_MODELS[prefill?.meetingType as keyof typeof MEETING_OPERATING_MODELS];
  const [category, setCategory] = useState<string>(
    prefill?.category ?? prefillModel?.defaultCategory ?? "LEADERSHIP"
  );
  const [date, setDate] = useState(prefill?.date ?? todayISO());
  const [start, setStart] = useState(prefill?.startTime ?? "18:00");
  const [end, setEnd] = useState(prefill?.endTime ?? "19:00");
  const [facilitatorId, setFacilitatorId] = useState(prefill?.facilitatorId ?? people[0]?.id ?? "");
  const [recurring, setRecurring] = useState(
    prefill?.recurrence ? prefill.recurrence === "WEEKLY" : true
  );
  const [attendeeIds, setAttendeeIds] = useState<string[]>(prefill?.attendeeIds ?? []);
  const [agenda, setAgenda] = useState<string[]>(prefill?.agendaTitles ?? []);
  const [newItem, setNewItem] = useState("");

  function applyTemplate(id: string) {
    const t = findMeetingTemplate(id);
    if (!t) return;
    setTpl(id);
    if (id !== "t_blank") {
      setTitle(t.name);
      setPurpose(t.purpose);
      setMeetingType(t.meetingType);
      setCategory(t.category);
    }
    setEnd(addMinutes(start, t.durationMinutes));
    setRecurring(t.recurrence === "WEEKLY");
    setAgenda(t.agenda);
  }

  function addItem() {
    const v = newItem.trim();
    if (v) {
      setAgenda((a) => [...a, v]);
      setNewItem("");
    }
  }

  function toggleAttendee(id: string) {
    setAttendeeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await createMeeting({
          title,
          purpose,
          meetingType,
          category,
          date,
          startTime: start,
          endTime: end,
          recurrence: recurring ? "WEEKLY" : "NONE",
          facilitatorId: facilitatorId || undefined,
          relatedEntityType: prefill?.relatedEntityType ?? undefined,
          relatedEntityId: prefill?.relatedEntityId ?? undefined,
          attendeeIds,
          agendaTitles: agenda,
        });
        router.push(`/meetings/${res.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create the meeting.");
      }
    });
  }

  return (
    <Drawer
      title="Log meeting"
      subtitle="Set up a meeting and pre-load its agenda."
      onClose={onClose}
      width={600}
      footer={
        <>
          <MeetingButton variant="ghost" onClick={onClose}>
            Cancel
          </MeetingButton>
          <MeetingButton icon="plus" disabled={!title.trim() || pending} onClick={submit}>
            {pending ? "Creating…" : "Create Meeting"}
          </MeetingButton>
        </>
      }
    >
      {error && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--danger-fg)",
            background: "var(--danger-bg)",
            border: "1px solid #f3cccc",
            borderRadius: 10,
            padding: "9px 13px",
          }}
        >
          {error}
        </div>
      )}

      {prefill?.relatedEntityLabel ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "10px 13px",
            borderRadius: 11,
            border: "1px solid var(--ypp-purple-200)",
            background: "var(--ypp-purple-50)",
            color: "var(--ypp-purple-800)",
            fontSize: 13,
          }}
        >
          <MeetingIcon name="link" size={15} />
          <span>
            Linking this meeting to <strong>{prefill.relatedEntityLabel}</strong>
          </span>
        </div>
      ) : null}

      {/* templates */}
      <div>
        <Label>Start from a template</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 8 }}>
          {MEETING_TEMPLATES.map((t) => {
            const active = tpl === t.id;
            const tc = meetingCategoryTone(t.category);
            const icon = t.id === "t_blank" ? "plus" : (meetingCategoryIdentity(t.category).icon as MeetingIconName);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                style={{
                  textAlign: "left",
                  font: "inherit",
                  cursor: "pointer",
                  padding: "10px 11px",
                  borderRadius: 11,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  border: `1.5px solid ${active ? "var(--ypp-purple-400)" : "var(--border)"}`,
                  background: active ? "var(--ypp-purple-50)" : "var(--surface)",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: tc.bg,
                    color: tc.fg,
                    flex: "0 0 auto",
                  }}
                >
                  <MeetingIcon name={icon} size={13} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ypp-ink)", lineHeight: 1.25 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {t.id === "t_blank" ? "Empty agenda" : `${t.agenda.length} agenda items · ${t.durationMinutes} min`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Meeting title" req>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly Leadership Sync" style={fieldStyle} />
      </Field>
      <Field label="Purpose">
        <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} placeholder="What this meeting is for…" style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Field label="Meeting type">
          <select
            value={meetingType}
            onChange={(e) => {
              const next = e.target.value;
              setMeetingType(next);
              const model = MEETING_OPERATING_MODELS[next as keyof typeof MEETING_OPERATING_MODELS];
              if (model) setCategory(model.defaultCategory);
            }}
            style={fieldStyle}
          >
            {MEETING_TYPE_VALUES.map((type) => (
              <option key={type} value={type}>
                {meetingTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category / YPP area">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
            {MEETING_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {meetingCategoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
        <Field label="Date" req>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Start">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="End">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} />
        </Field>
      </div>

      <Field label="Facilitator">
        <select value={facilitatorId} onChange={(e) => setFacilitatorId(e.target.value)} style={fieldStyle}>
          <option value="">No facilitator</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      {/* attendees */}
      <div>
        <Label>Attendees</Label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 7,
            maxHeight: 132,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 10,
            background: "var(--surface)",
          }}
        >
          {people.map((p) => {
            const on = attendeeIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleAttendee(p.id)}
                style={{
                  font: "inherit",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "5px 11px",
                  borderRadius: 999,
                  background: on ? "var(--ypp-purple-600)" : "var(--chip-bg)",
                  color: on ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${on ? "var(--ypp-purple-600)" : "var(--chip-border)"}`,
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* recurring toggle */}
      <button
        type="button"
        onClick={() => setRecurring((r) => !r)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "11px 13px",
          border: "1px solid var(--border)",
          borderRadius: 11,
          background: "var(--surface)",
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
        }}
      >
        <Toggle on={recurring} />
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ypp-ink)" }}>Recurring meeting</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {recurring ? "Repeats weekly — appears every week automatically" : "One-time meeting"}
          </span>
        </span>
        <MeetingIcon name="repeat" size={17} style={{ color: recurring ? "var(--ypp-purple-600)" : "var(--muted)" }} />
      </button>

      {/* agenda builder */}
      <div>
        <Label>Initial agenda</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 9 }}>
          {agenda.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 0" }}>
              Pick a template above or add items below.
            </div>
          )}
          {agenda.map((a, i) => (
            <div
              key={`${a}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 11px",
                border: "1px solid var(--border)",
                borderRadius: 9,
                background: "var(--surface)",
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", width: 16 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--ypp-ink)" }}>{a}</span>
              <button
                type="button"
                onClick={() => setAgenda((items) => items.filter((_, idx) => idx !== i))}
                aria-label="Remove"
                style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", padding: 2 }}
              >
                <MeetingIcon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Add an agenda item…"
            style={fieldStyle}
          />
          <MeetingButton variant="outline" icon="plus" onClick={addItem}>
            Add
          </MeetingButton>
        </div>
      </div>
    </Drawer>
  );
}
