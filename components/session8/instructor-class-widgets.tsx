"use client";

import { useState } from "react";
import {
  completeClassAndIssueCertificates,
  upsertInstructorStudentFeedback,
  releaseInstructorFeedback,
  upsertClassAnnouncement,
  respondToAttendanceReview,
} from "@/lib/session8/instructor-actions";

export function ClassCompletionAction({ offeringId, offeringEnded, alreadyCompleted }: { offeringId: string; offeringEnded: boolean; alreadyCompleted: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pending, setPending] = useState(false);

  if (alreadyCompleted) {
    return <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">This class is done.</p>;
  }
  if (!offeringEnded) {
    return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">You can finish the class after the last class day.</p>;
  }

  async function run() {
    setPending(true);
    const fd = new FormData();
    fd.set("offeringId", offeringId);
    const r = await completeClassAndIssueCertificates(fd);
    setResult(r);
    setPending(false);
    setConfirming(false);
  }

  return (
    <div className="space-y-2">
      {result && result.ok && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
          Marked {result.completedCount} enrollment(s) complete. {result.certificatesIssued} certificate(s) issued.
          {result.certificatesUnavailable && <p className="mt-1 text-amber-800">Certificates unavailable — no active template.</p>}
        </div>
      )}
      {result && !result.ok && <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">{result.error}</div>}
      {!result?.ok && (
        confirming ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>This marks every student complete and sends certificates when available. Continue?</p>
            <div className="mt-2 flex gap-2">
              <button disabled={pending} onClick={run} className="min-h-11 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                {pending ? "Finishing…" : "Yes, finish class"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="min-h-11 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
            Finish class & send certificates
          </button>
        )
      )}
    </div>
  );
}

type FeedbackRow = { id: string; studentId: string; body: string; strengths: string | null; growthAreas: string | null; releasedToFamilyAt: string | Date | null };

export function StudentFeedbackPanel({ offeringId, students, feedback }: { offeringId: string; students: { id: string; name: string | null }[]; feedback: FeedbackRow[] }) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const byStudent = new Map(feedback.map((f) => [f.studentId, f]));

  return (
    <div className="space-y-3">
      {students.map((s) => {
        const existing = byStudent.get(s.id);
        return (
          <div key={s.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{s.name ?? "Student"}</p>
                {existing ? (
                  <p className="text-sm text-slate-500">{existing.releasedToFamilyAt ? "Feedback released to family" : "Draft not yet released"}</p>
                ) : (
                  <p className="text-sm text-slate-500">No feedback written yet.</p>
                )}
              </div>
              <button type="button" onClick={() => setOpenFor(openFor === s.id ? null : s.id)} className="min-h-11 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                {openFor === s.id ? "Close" : existing ? "Edit feedback" : "Write feedback"}
              </button>
            </div>
            {openFor === s.id && (
              <form action={upsertInstructorStudentFeedback} className="mt-3 space-y-2">
                <input type="hidden" name="offeringId" value={offeringId} />
                <input type="hidden" name="studentId" value={s.id} />
                <label className="block text-sm font-semibold" htmlFor={`body-${s.id}`}>Feedback</label>
                <textarea id={`body-${s.id}`} name="body" defaultValue={existing?.body ?? ""} required className="w-full rounded-xl border p-3 text-sm" />
                <label className="block text-sm font-semibold" htmlFor={`strengths-${s.id}`}>Strengths (optional)</label>
                <textarea id={`strengths-${s.id}`} name="strengths" defaultValue={existing?.strengths ?? ""} className="w-full rounded-xl border p-3 text-sm" />
                <label className="block text-sm font-semibold" htmlFor={`growth-${s.id}`}>Growth areas (optional)</label>
                <textarea id={`growth-${s.id}`} name="growthAreas" defaultValue={existing?.growthAreas ?? ""} className="w-full rounded-xl border p-3 text-sm" />
                <button className="min-h-11 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Save feedback</button>
              </form>
            )}
            {existing && !existing.releasedToFamilyAt && (
              <form action={releaseInstructorFeedback} className="mt-2">
                <input type="hidden" name="feedbackId" value={existing.id} />
                <p className="mb-1 text-xs font-semibold text-amber-800">This will be visible to the student&apos;s family.</p>
                <button className="min-h-11 rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                  Release to family
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AnnouncementComposer({ offeringId }: { offeringId: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    published: boolean;
    scheduled?: boolean;
    scheduledPublishAt?: string | null;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [publishWhen, setPublishWhen] = useState<"asap" | "at">("asap");

  async function submit(formData: FormData) {
    setPending(true);
    formData.set("offeringId", offeringId);
    formData.set("publishWhen", publishWhen);
    const r = await upsertClassAnnouncement(formData);
    setResult(r);
    setPending(false);
    setOpen(false);
    setPublishWhen("asap");
  }

  return (
    <div className="space-y-2">
      {result && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900">
          {result.scheduled
            ? "Scheduled — it’ll post at the time you chose (Eastern Time)."
            : result.published
              ? "Posted to your class."
              : "Waiting for approval."}
        </p>
      )}
      {open ? (
        <form action={submit} className="space-y-2">
          <label className="block text-[13px] font-medium text-[#202124]" htmlFor="ann-title">
            Title
          </label>
          <input
            id="ann-title"
            name="title"
            required
            className="w-full rounded-lg border border-[#dadce0] p-3 text-sm"
          />
          <label className="block text-[13px] font-medium text-[#202124]" htmlFor="ann-body">
            Message
          </label>
          <textarea
            id="ann-body"
            name="body"
            required
            rows={3}
            className="w-full rounded-lg border border-[#dadce0] p-3 text-sm"
          />

          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium text-[#202124]">When to post</legend>
            <div className="flex flex-wrap gap-2">
              <label
                className={[
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
                  publishWhen === "asap"
                    ? "border-[#1967d2] bg-[#e8f0fe] font-medium text-[#174ea6]"
                    : "border-[#dadce0] bg-white text-[#5f6368]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="publishWhenUi"
                  checked={publishWhen === "asap"}
                  onChange={() => setPublishWhen("asap")}
                  className="sr-only"
                />
                Now
              </label>
              <label
                className={[
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]",
                  publishWhen === "at"
                    ? "border-[#1967d2] bg-[#e8f0fe] font-medium text-[#174ea6]"
                    : "border-[#dadce0] bg-white text-[#5f6368]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="publishWhenUi"
                  checked={publishWhen === "at"}
                  onChange={() => setPublishWhen("at")}
                  className="sr-only"
                />
                Pick a time
              </label>
            </div>
            {publishWhen === "at" ? (
              <div>
                <label
                  className="block text-[13px] font-medium text-[#202124]"
                  htmlFor="ann-at"
                >
                  Date & time
                </label>
                <input
                  id="ann-at"
                  name="scheduledAtLocal"
                  type="datetime-local"
                  required
                  className="mt-1 w-full rounded-lg border border-[#dadce0] p-3 text-sm"
                />
                <p className="m-0 mt-1.5 text-[12px] leading-4 text-[#5f6368]">
                  Uses Eastern Time. Families see the post then.
                </p>
              </div>
            ) : (
              <p className="m-0 text-[12px] text-[#5f6368]">
                Goes live right away.
              </p>
            )}
          </fieldset>

          <div className="flex gap-2">
            <button
              disabled={pending}
              className="min-h-10 rounded-full bg-[#1967d2] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
            >
              {pending ? "Posting…" : publishWhen === "at" ? "Schedule" : "Post"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPublishWhen("asap");
              }}
              className="min-h-10 rounded-full px-4 py-2 text-[13px] font-medium text-[#1967d2] hover:bg-[#e8f0fe]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-10 w-full rounded-full border border-[#dadce0] bg-[#f8f9fa] px-4 py-2 text-left text-[14px] text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
        >
          Write a message…
        </button>
      )}
    </div>
  );
}

export function AttendanceReviewResponse({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(formData: FormData) {
    formData.set("requestId", requestId);
    await respondToAttendanceReview(formData);
    setSent(true);
    setOpen(false);
  }

  if (sent) return <p className="text-xs text-emerald-700">Response sent to family.</p>;
  return open ? (
    <form action={submit} className="mt-2 space-y-2">
      <textarea name="body" required placeholder="Response visible to the family" className="w-full rounded-xl border p-2 text-sm" />
      <div className="flex gap-2">
        <button className="min-h-11 rounded-full bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white">Send response</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full border px-3 py-1.5 text-sm font-semibold text-slate-700">Cancel</button>
      </div>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="mt-1 min-h-11 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50">
      Respond
    </button>
  );
}
