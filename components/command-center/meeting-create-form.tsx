"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CcIcon } from "@/components/command-center/icons";
import { Button, ButtonLink, cn } from "@/components/ui-v2";
import { FeedbackBanner } from "@/components/people-strategy/motion";
import type { MeetingPrefill, PersonOption } from "@/components/people-strategy/new-meeting-drawer";
import {
  MEETING_CATEGORY_VALUES,
  meetingCategoryLabel,
} from "@/lib/people-strategy/meeting-categories";
import {
  MEETING_OPERATING_MODELS,
  MEETING_TYPE_VALUES,
  meetingTypeLabel,
} from "@/lib/people-strategy/meeting-operating-model";
import { MEETING_TEMPLATES, findMeetingTemplate } from "@/lib/people-strategy/meeting-templates";
import { createMeeting } from "@/lib/people-strategy/meetings-actions";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

const inputClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const titleInputClass = cn(inputClass, "py-3.5 text-[16px] font-medium tracking-[-0.01em]");

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

/** Calm OS schedule-meeting form — used on `/actions/meetings/new`. */
export function MeetingCreateForm({
  people,
  prefill,
  cancelHref = "/actions/meetings",
}: {
  people: PersonOption[];
  prefill?: MeetingPrefill;
  cancelHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);

  const [tpl, setTpl] = useState<string | null>(null);
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [purpose, setPurpose] = useState(prefill?.purpose ?? "");
  const [meetingType, setMeetingType] = useState<string>(prefill?.meetingType ?? "OFFICER_MEETING");
  const prefillModel = MEETING_OPERATING_MODELS[prefill?.meetingType as keyof typeof MEETING_OPERATING_MODELS];
  const [category, setCategory] = useState<string>(
    prefill?.category ?? prefillModel?.defaultCategory ?? "LEADERSHIP"
  );
  const [priority, setPriority] = useState<string>("MEDIUM");
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Add a meeting title.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createMeeting({
          title: title.trim(),
          purpose,
          meetingType,
          category,
          priority: priority as (typeof PRIORITIES)[number],
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
        router.push(`/actions/meetings/${res.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the meeting.");
      }
    });
  }

  return (
    <div
      id="create-meeting"
      className="overflow-hidden rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/40 via-surface to-surface shadow-card"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
          {prefill?.relatedEntityLabel ? (
            <div className="flex items-center gap-2 rounded-[12px] border border-brand-200 bg-brand-50/80 px-3.5 py-2.5 text-[13px] text-brand-800">
              <CcIcon name="handoff" size={15} className="shrink-0" />
              <span>
                Linking to <strong>{prefill.relatedEntityLabel}</strong>
              </span>
            </div>
          ) : null}

          <FeedbackBanner message={error} tone="error" style={{ padding: "10px 14px" }} />

          <FormSection step={1} title="What's this meeting?" hint="Pick a template or name it yourself.">
            <div className="flex flex-wrap gap-2">
              {MEETING_TEMPLATES.filter((t) => t.id !== "t_blank").slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                    tpl === t.id
                      ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                      : "border-line-soft bg-surface text-ink-muted hover:border-brand-300 hover:text-ink"
                  )}
                >
                  {t.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyTemplate("t_blank")}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                  tpl === "t_blank"
                    ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                    : "border-line-soft bg-surface text-ink-muted hover:border-brand-300 hover:text-ink"
                )}
              >
                Blank
              </button>
            </div>
            <input
              id="meeting-create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={titleInputClass}
              placeholder="e.g. Weekly leadership sync"
              autoComplete="off"
              autoFocus
            />
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection step={2} title="When is it?" hint="Date and time — weekly repeat is on by default.">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-date">
                  Date
                </label>
                <input
                  id="meeting-create-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-start">
                  Start
                </label>
                <input
                  id="meeting-create-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-end">
                  End
                </label>
                <input
                  id="meeting-create-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRecurring((r) => !r)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-colors",
                recurring
                  ? "border-brand-300 bg-brand-50/60"
                  : "border-line-soft bg-surface hover:bg-surface-soft"
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  recurring ? "border-brand-600 bg-brand-600" : "border-line-soft bg-surface"
                )}
              >
                {recurring ? <span className="size-2 rounded-full bg-white" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">Repeats weekly</span>
                <span className="block text-[12px] text-ink-muted">
                  {recurring ? "Shows on the calendar every week" : "One-time meeting"}
                </span>
              </span>
              <CcIcon name="calendar" size={16} className="shrink-0 text-brand-600" />
            </button>
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection step={3} title="Who's involved?" hint="Facilitator runs it — tap people to invite.">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-facilitator">
                Facilitator
              </label>
              <select
                id="meeting-create-facilitator"
                value={facilitatorId}
                onChange={(e) => setFacilitatorId(e.target.value)}
                className={inputClass}
              >
                <option value="">No facilitator</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {people.length > 0 ? (
              <div className="space-y-2">
                <p className="m-0 text-[13px] font-semibold text-ink">Attendees</p>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => {
                    const on = attendeeIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleAttendee(p.id)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                          on
                            ? "border-brand-500 bg-brand-600 text-white"
                            : "border-line-soft bg-surface text-ink-muted hover:border-brand-300 hover:text-ink"
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </FormSection>

          <div className="rounded-[14px] border border-dashed border-line-soft bg-surface/60">
            <button
              type="button"
              onClick={() => setShowExtras((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-soft/80"
              aria-expanded={showExtras}
            >
              <span className="flex items-center gap-2">
                <CcIcon name="layers" size={16} className="text-brand-600" />
                <span className="text-[13.5px] font-semibold text-ink">Purpose, type & agenda</span>
                <span className="text-[12px] text-ink-muted">Optional</span>
              </span>
              <CcIcon
                name="arrowRight"
                size={15}
                className={cn("text-ink-muted transition-transform", showExtras && "rotate-90")}
              />
            </button>

            {showExtras ? (
              <div className="space-y-4 border-t border-line-soft px-4 py-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-purpose">
                    Purpose
                  </label>
                  <textarea
                    id="meeting-create-purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                    placeholder="What this meeting is for…"
                    className={cn(inputClass, "min-h-[72px] resize-y")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-type">
                      Meeting type
                    </label>
                    <select
                      id="meeting-create-type"
                      value={meetingType}
                      onChange={(e) => {
                        const next = e.target.value;
                        setMeetingType(next);
                        const model = MEETING_OPERATING_MODELS[next as keyof typeof MEETING_OPERATING_MODELS];
                        if (model) setCategory(model.defaultCategory);
                      }}
                      className={inputClass}
                    >
                      {MEETING_TYPE_VALUES.map((type) => (
                        <option key={type} value={type}>
                          {meetingTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-category">
                      YPP area
                    </label>
                    <select
                      id="meeting-create-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={inputClass}
                    >
                      {MEETING_CATEGORY_VALUES.map((c) => (
                        <option key={c} value={c}>
                          {meetingCategoryLabel(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-priority">
                      Urgency
                    </label>
                    <select
                      id="meeting-create-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className={inputClass}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="m-0 text-[13px] font-semibold text-ink">Agenda items</p>
                  {agenda.length > 0 ? (
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {agenda.map((item, i) => (
                        <li
                          key={`${item}-${i}`}
                          className="flex items-center gap-2 rounded-[10px] border border-line-soft bg-surface px-3 py-2"
                        >
                          <span className="text-[11px] font-bold text-ink-muted">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item}</span>
                          <button
                            type="button"
                            onClick={() => setAgenda((items) => items.filter((_, idx) => idx !== i))}
                            className="text-ink-muted hover:text-ink"
                            aria-label="Remove agenda item"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 text-[12.5px] text-ink-muted">No agenda items yet.</p>
                  )}
                  <div className="flex gap-2">
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
                      className={inputClass}
                    />
                    <Button type="button" variant="secondary" size="md" onClick={addItem}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
          <p className="m-0 text-[12.5px] text-ink-muted">Title, date, and time — under a minute.</p>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={cancelHref} variant="ghost" size="md">
              Cancel
            </ButtonLink>
            <Button type="submit" variant="primary" size="md" disabled={pending || !title.trim()}>
              {pending ? "Creating…" : "Schedule meeting →"}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
