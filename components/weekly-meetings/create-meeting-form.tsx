"use client";

/**
 * Create-meeting form. Picking a type reveals the fields that type needs
 * (team + week for Weekly Team Impact, chapter + week for Chapter Impact).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, CardV2 } from "@/components/ui-v2";
import { createMeeting } from "@/lib/weekly-meetings/meeting-actions";
import { MEETING_TYPE_LABELS, type MeetingType } from "@/lib/weekly-meetings/meetings";

const inputCls =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

const TYPES: MeetingType[] = ["WEEKLY_TEAM_IMPACT", "OFFICER", "CHAPTER_IMPACT", "GENERIC"];

export function CreateMeetingForm({
  teams,
  chapters,
  people,
  defaultWeekKey,
}: {
  teams: { id: string; name: string }[];
  chapters: { id: string; name: string }[];
  people: { id: string; name: string }[];
  defaultWeekKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<MeetingType>("WEEKLY_TEAM_IMPACT");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [teamId, setTeamId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [weekStart, setWeekStart] = useState(defaultWeekKey);
  const [facilitatorId, setFacilitatorId] = useState("");

  const isImpact = type === "WEEKLY_TEAM_IMPACT" || type === "CHAPTER_IMPACT";

  function submit() {
    setError(null);
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
          facilitatorId: facilitatorId || undefined,
        })) as { ok?: boolean; id?: string };
        if (res?.ok && res.id) router.push(`/meetings/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create the meeting.");
      }
    });
  }

  return (
    <CardV2 padding="lg">
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>Meeting type</label>
          <div className="seg-tabs w-fit max-w-full">
            {TYPES.map((t) => (
              <button key={t} type="button" className={`seg-tab${t === type ? " active" : ""}`} onClick={() => setType(t)}>
                {MEETING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} placeholder={MEETING_TYPE_LABELS[type]} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Purpose (optional)</label>
          <textarea className={`${inputCls} min-h-[60px]`} placeholder="What is this meeting for?" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>When</label>
            <input type="datetime-local" className={inputCls} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Facilitator (optional)</label>
            <select className={inputCls} value={facilitatorId} onChange={(e) => setFacilitatorId(e.target.value)}>
              <option value="">You</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        {isImpact && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {type === "WEEKLY_TEAM_IMPACT" && (
              <div>
                <label className={labelCls}>Team (optional — blank = all teams)</label>
                <select className={inputCls} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">All teams</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            {type === "CHAPTER_IMPACT" && (
              <div>
                <label className={labelCls}>Chapter</label>
                <select className={inputCls} value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                  <option value="">Select a chapter…</option>
                  {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Reporting week</label>
              <input type="date" className={inputCls} value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
          </div>
        )}

        {error && <p className="m-0 text-[13px] text-danger-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.push("/meetings")}>Cancel</Button>
          <Button variant="primary" loading={pending} onClick={submit}>Create meeting</Button>
        </div>
      </div>
    </CardV2>
  );
}
