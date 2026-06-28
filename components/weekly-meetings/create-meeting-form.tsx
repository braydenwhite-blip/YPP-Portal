"use client";

/**
 * Calm OS create-meeting form — mirrors `/actions/new` stepped layout.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button, ButtonLink, cn } from "@/components/ui-v2";
import { FeedbackBanner } from "@/components/people-strategy/motion";
import { MeetingPeoplePicker } from "@/components/weekly-meetings/meeting-people-picker";
import { MEETING_TYPE_COLORS } from "@/components/weekly-meetings/meetings-hub-analytics";
import { createMeeting } from "@/lib/weekly-meetings/meeting-actions";
import { MEETING_TYPE_LABELS, type MeetingType } from "@/lib/weekly-meetings/meeting-types";

const TYPES: MeetingType[] = ["OFFICER", "WEEKLY_TEAM_IMPACT", "CHAPTER_IMPACT", "GENERIC"];

const TYPE_HINTS: Record<MeetingType, string> = {
  OFFICER: "Leadership decisions, escalations, and follow-ups.",
  WEEKLY_TEAM_IMPACT: "Global ops team presents weekly KPIs and blockers.",
  CHAPTER_IMPACT: "Chapter presidents present their weekly impact.",
  GENERIC: "Partner calls, 1:1s, planning — anything else.",
};

const inputClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const titleInputClass = cn(inputClass, "py-3.5 text-[16px] font-medium tracking-[-0.01em]");

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

type TeamOption = { id: string; name: string; memberIds: string[] };
type ChapterOption = { id: string; name: string; presidentId: string | null };

export function CreateMeetingForm({
  teams,
  chapters,
  people,
  partners,
  defaultWeekKey,
  currentUserId,
  cancelHref = "/meetings",
}: {
  teams: TeamOption[];
  chapters: ChapterOption[];
  people: { id: string; name: string; email: string }[];
  partners: { id: string; name: string }[];
  defaultWeekKey: string;
  currentUserId: string;
  cancelHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<MeetingType>("GENERIC");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([currentUserId]);
  const [teamId, setTeamId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [weekStart, setWeekStart] = useState(defaultWeekKey);
  const [partnerId, setPartnerId] = useState("");
  const [purpose, setPurpose] = useState("");

  const isImpact = type === "WEEKLY_TEAM_IMPACT" || type === "CHAPTER_IMPACT";
  const selectedChapter = chapters.find((c) => c.id === chapterId);
  const scopeStep = isImpact ? 4 : null;

  useEffect(() => {
    if (type !== "WEEKLY_TEAM_IMPACT" || !teamId) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team?.memberIds.length) return;
    setAttendeeIds((current) => [...new Set([...current, ...team.memberIds])]);
  }, [teamId, type, teams]);

  useEffect(() => {
    if (type === "CHAPTER_IMPACT" && selectedChapter?.presidentId) {
      setAttendeeIds((current) =>
        current.includes(selectedChapter.presidentId!) ? current : [...current, selectedChapter.presidentId!],
      );
    }
  }, [chapterId, type, selectedChapter]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (type === "CHAPTER_IMPACT" && !chapterId) {
      setError("Pick a chapter for Chapter Impact.");
      return;
    }

    startTransition(async () => {
      try {
        const res = (await createMeeting({
          type,
          title: title.trim() || MEETING_TYPE_LABELS[type],
          purpose: purpose.trim() || undefined,
          scheduledAt: scheduledAt || new Date().toISOString(),
          teamId: type === "WEEKLY_TEAM_IMPACT" && teamId ? teamId : undefined,
          chapterId: type === "CHAPTER_IMPACT" && chapterId ? chapterId : undefined,
          weekStart: isImpact ? weekStart : undefined,
          partnerId: partnerId || undefined,
          attendeeIds,
        })) as { ok?: boolean; id?: string };
        if (res?.ok && res.id) {
          router.push(`/meetings/${res.id}`);
          router.refresh();
        }
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
          <FeedbackBanner message={error} tone="error" style={{ padding: "10px 14px" }} />

          <FormSection step={1} title="What kind of meeting?" hint="The form adapts to the type you pick.">
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPES.map((t) => {
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-[14px] border px-4 py-3 text-left transition-all",
                      active
                        ? "border-brand-400 bg-brand-50/90 shadow-sm ring-2 ring-brand-100"
                        : "border-line-soft bg-surface hover:border-brand-200 hover:bg-surface-soft/40",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: MEETING_TYPE_COLORS[t] }}
                      />
                      <span className="text-[14px] font-bold text-ink">{MEETING_TYPE_LABELS[t]}</span>
                    </span>
                    <span className="mt-1.5 block pl-[18px] text-[12px] leading-snug text-ink-muted">
                      {TYPE_HINTS[t]}
                    </span>
                  </button>
                );
              })}
            </div>
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection step={2} title="What's it called?" hint="Short title — defaults to the meeting type if blank.">
            <input
              id="meeting-create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={titleInputClass}
              placeholder={MEETING_TYPE_LABELS[type]}
              autoComplete="off"
              autoFocus
            />
          </FormSection>

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection step={3} title="When is it?" hint="Pick a date and time. Leave blank to use right now.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="sr-only" htmlFor="meeting-create-when">
                  Date & time
                </label>
                <input
                  id="meeting-create-when"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className={inputClass}
                />
              </div>
              {isImpact ? (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-week">
                    Reporting week
                  </label>
                  <input
                    id="meeting-create-week"
                    type="date"
                    className={inputClass}
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </FormSection>

          {isImpact ? (
            <>
              <div className="h-px bg-line-soft/80" aria-hidden />
              <FormSection
                step={scopeStep!}
                title="What's the scope?"
                hint={
                  type === "WEEKLY_TEAM_IMPACT"
                    ? "Optional team filter — picking a team adds its members to the invite list."
                    : "Which chapter is presenting this week."
                }
              >
                {type === "WEEKLY_TEAM_IMPACT" ? (
                  <select
                    id="meeting-create-team"
                    className={inputClass}
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                  >
                    <option value="">All teams</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    id="meeting-create-chapter"
                    className={inputClass}
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    required={type === "CHAPTER_IMPACT"}
                  >
                    <option value="">Select chapter…</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </FormSection>
            </>
          ) : null}

          <div className="h-px bg-line-soft/80" aria-hidden />

          <FormSection
            step={isImpact ? scopeStep! + 1 : 4}
            title="Who's invited?"
            hint="Search or add everyone — you can adjust on the meeting page later."
          >
            <MeetingPeoplePicker
              people={people}
              selectedIds={attendeeIds}
              onChange={setAttendeeIds}
              currentUserId={currentUserId}
              hideHeader
            />
          </FormSection>

          <div className="rounded-[14px] border border-dashed border-line-soft bg-surface/60">
            <div className="border-b border-line-soft px-4 py-3.5">
              <p className="m-0 text-[13.5px] font-semibold text-ink">Notes & extras</p>
              <p className="m-0 mt-0.5 text-[12px] text-ink-muted">Optional</p>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-partner">
                  Linked partner
                </label>
                <select
                  id="meeting-create-partner"
                  className={inputClass}
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  <option value="">No partner</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-ink" htmlFor="meeting-create-purpose">
                  Purpose
                </label>
                <textarea
                  id="meeting-create-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className={cn(inputClass, "min-h-[96px] resize-y")}
                  rows={3}
                  placeholder="What should this meeting accomplish?"
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
          <p className="m-0 text-[12.5px] text-ink-muted">
            {attendeeIds.length} invited · agenda & notes after you create it
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={cancelHref} variant="ghost" size="md">
              Cancel
            </ButtonLink>
            <Button type="submit" variant="primary" size="md" disabled={pending}>
              {pending ? "Creating…" : "Create meeting →"}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
