"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, cn } from "@/components/ui-v2";
import {
  offerInterviewSlots,
  scheduleInstructorInterviewOnRecord,
} from "@/lib/instructor-application-actions";
import { cleanMeetingDetails } from "@/lib/meeting-details";

type OfferedSlot = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string | null;
  confirmedAt: string | null;
};

type Mode = "set" | "offer";

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const fieldClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-3 text-[15px] text-ink shadow-sm placeholder:text-ink-muted/60 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

const labelClass = "block text-[13px] font-semibold text-ink";

export function ApplicationRecordInterviewSchedule({
  applicationId,
  interviewScheduledAtISO,
  canSchedule,
  offeredSlots = [],
}: {
  applicationId: string;
  interviewScheduledAtISO: string | null;
  canSchedule: boolean;
  offeredSlots?: OfferedSlot[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("set");
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(interviewScheduledAtISO));
  const [meetingUrl, setMeetingUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [option1, setOption1] = useState("");
  const [option2, setOption2] = useState("");
  const [option3, setOption3] = useState("");
  const [offerMeeting, setOfferMeeting] = useState("");

  const pendingOffers = offeredSlots.filter((slot) => !slot.confirmedAt);
  const confirmedOffer = offeredSlots.find((slot) => slot.confirmedAt);
  const confirmedIso = interviewScheduledAtISO ?? confirmedOffer?.scheduledAt ?? null;
  const hasConfirmedTime = Boolean(confirmedIso);

  if (!canSchedule && !hasConfirmedTime && pendingOffers.length === 0) {
    return null;
  }

  function scheduleDirect(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await scheduleInstructorInterviewOnRecord({
        applicationId,
        scheduledAt,
        meetingUrl: meetingUrl.trim() || null,
        notes: null,
      });
      if (!result.success) {
        setMessage({ ok: false, text: result.error ?? "Could not save that time." });
        return;
      }
      setMessage({
        ok: true,
        text: hasConfirmedTime ? "Updated. Applicant notified." : "Booked. Applicant notified.",
      });
      router.refresh();
    });
  }

  function emailOptions(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const meeting = cleanMeetingDetails(offerMeeting);
    if (!meeting) {
      setMessage({ ok: false, text: "Add a meeting link first." });
      return;
    }
    const slots = [option1, option2, option3].map((value) => ({
      scheduledAt: new Date(value),
      durationMinutes: 60,
      meetingUrl: meeting,
    }));
    if (slots.some((slot) => Number.isNaN(slot.scheduledAt.getTime()))) {
      setMessage({ ok: false, text: "Fill in all 3 times." });
      return;
    }
    const now = new Date();
    if (slots.some((slot) => slot.scheduledAt <= now)) {
      setMessage({ ok: false, text: "All times must be in the future." });
      return;
    }
    const unique = new Set(slots.map((slot) => slot.scheduledAt.getTime()));
    if (unique.size !== 3) {
      setMessage({ ok: false, text: "Make each time different." });
      return;
    }

    startTransition(async () => {
      const result = await offerInterviewSlots(applicationId, slots);
      if (!result.success) {
        setMessage({ ok: false, text: result.error ?? "Could not email times." });
        return;
      }
      setMessage({ ok: true, text: "Emailed. Waiting for them to pick one." });
      setOption1("");
      setOption2("");
      setOption3("");
      setOfferMeeting("");
      router.refresh();
    });
  }

  return (
    <section
      id="scheduling"
      className="scroll-mt-24 overflow-hidden rounded-[16px] border border-line-soft bg-surface shadow-card"
    >
      <div className="border-b border-line-soft bg-gradient-to-br from-brand-50 via-surface to-surface px-5 py-5 sm:px-6">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
          Interview
        </p>
        <h2 className="m-0 mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-ink">
          {hasConfirmedTime ? "Interview time" : "Book the interview"}
        </h2>
        <p className="m-0 mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink-muted">
          {hasConfirmedTime
            ? "Change it anytime. We’ll email the applicant."
            : "Pick a time, or send three options and let them choose."}
        </p>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        {hasConfirmedTime ? (
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.06em] text-emerald-800">
              Confirmed
            </p>
            <p className="m-0 mt-1 text-[20px] font-bold tracking-[-0.02em] text-emerald-950">
              {formatWhen(confirmedIso)}
            </p>
          </div>
        ) : pendingOffers.length > 0 ? (
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="m-0 text-[13px] font-bold text-amber-950">
              Waiting for them to pick
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {pendingOffers.map((slot, index) => (
                <p key={slot.id} className="m-0 text-[14px] text-amber-900">
                  Option {index + 1}: {formatWhen(slot.scheduledAt)}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {canSchedule ? (
          <>
            {!hasConfirmedTime ? (
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                role="tablist"
                aria-label="How to schedule"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "set"}
                  onClick={() => {
                    setMode("set");
                    setMessage(null);
                  }}
                  className={cn(
                    "rounded-[14px] border px-4 py-3.5 text-left transition-colors",
                    mode === "set"
                      ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                      : "border-line-soft bg-surface-soft text-ink hover:border-brand-300"
                  )}
                >
                  <span className="block text-[15px] font-bold">We already picked a time</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[12.5px] leading-snug",
                      mode === "set" ? "text-white/85" : "text-ink-muted"
                    )}
                  >
                    Lock it in now
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "offer"}
                  onClick={() => {
                    setMode("offer");
                    setMessage(null);
                  }}
                  className={cn(
                    "rounded-[14px] border px-4 py-3.5 text-left transition-colors",
                    mode === "offer"
                      ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                      : "border-line-soft bg-surface-soft text-ink hover:border-brand-300"
                  )}
                >
                  <span className="block text-[15px] font-bold">Let them choose</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[12.5px] leading-snug",
                      mode === "offer" ? "text-white/85" : "text-ink-muted"
                    )}
                  >
                    Email 3 times
                  </span>
                </button>
              </div>
            ) : null}

            {mode === "set" || hasConfirmedTime ? (
              <form onSubmit={scheduleDirect} className="grid gap-4">
                <label className="block space-y-2">
                  <span className={labelClass}>When?</span>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Meeting link</span>
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="Zoom / Meet link (optional)"
                    className={fieldClass}
                  />
                </label>

                {message && (mode === "set" || hasConfirmedTime) ? (
                  <p
                    role="alert"
                    className={cn(
                      "m-0 rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-medium",
                      message.ok
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-[var(--error-bg)] text-[var(--error-text)]"
                    )}
                  >
                    {message.text}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={pending || !scheduledAt}
                  loading={pending}
                >
                  {hasConfirmedTime ? "Save new time" : "Book it"}
                </Button>
              </form>
            ) : (
              <form onSubmit={emailOptions} className="grid gap-4">
                <label className="block space-y-2">
                  <span className={labelClass}>Meeting link</span>
                  <input
                    type="url"
                    required
                    value={offerMeeting}
                    onChange={(e) => setOfferMeeting(e.target.value)}
                    placeholder="Zoom / Meet link"
                    className={fieldClass}
                  />
                </label>
                <div className="grid gap-3">
                  {(
                    [
                      [1, option1, setOption1],
                      [2, option2, setOption2],
                      [3, option3, setOption3],
                    ] as const
                  ).map(([n, value, setValue]) => (
                    <label key={n} className="block space-y-2">
                      <span className={labelClass}>Option {n}</span>
                      <input
                        type="datetime-local"
                        required
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  ))}
                </div>

                {message && mode === "offer" ? (
                  <p
                    role="alert"
                    className={cn(
                      "m-0 rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-medium",
                      message.ok
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-[var(--error-bg)] text-[var(--error-text)]"
                    )}
                  >
                    {message.text}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={pending}
                  loading={pending}
                >
                  Email 3 options
                </Button>
              </form>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
